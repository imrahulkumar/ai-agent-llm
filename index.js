import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import "dotenv/config";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { MessagesAnnotation, StateGraph,  START,
  END, } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";
const multipy = tool(
    async ({ a, b }) => {
        return a * b;
    },
    {
        name: 'multiply',
        description: 'Multiplies two numbers',
        schema: z.object({
            a: z.number().describe('First number to multiply'),
            b: z.number().describe('Second number to multiply')
        })
    }
);

const add = tool(
    async ({ a, b }) => {
        return a + b;
    },
    {
        name: 'add',
        description: 'Adds two numbers',
        schema: z.object({
            a: z.number().describe('First number to add'),
            b: z.number().describe('Second number to add')
        })
    }
);

const divide  = tool(
    async ({ a, b }) => {
        return a / b;
    },
    {
        name: 'divide',
        description: 'Divides two numbers',
        schema: z.object({
            a: z.number().describe('First number to divide'),
            b: z.number().describe('Second number to divide')
        })
    }
);

const tools = [multipy, add, divide];

const toolByName = Object.fromEntries(tools.map(tool => [tool.name, tool]));


const llmGemini = new ChatGoogleGenerativeAI({
  model: "gemini-3.8-flash",
  temperature: 0,
  maxRetries: 2,
});

const llmWithTools = llmGemini.bindTools(tools); 


async function llmCall(state) {

    console.log('Calling Gemini...');
    const result  = await llmWithTools.invoke([
        {
            role: 'system',
            content: 'You are a helpful assistant tasked with performing arithmetic operations on a set of inputs.'
        },
        ...state.messages
    ], { timeout: 60000 });

    return {
        messages: [result]
    }
}

async function toolNode(state) {

  const lastMessage = state.messages.at(-1);

  if (lastMessage == null || !AIMessage.isInstance(lastMessage)) {
    return { messages: [] };
  }

  const result = [];
  for (const toolCall of lastMessage.tool_calls ?? []) {
    const tool = toolByName[toolCall.name];
    console.log(`Running tool ${toolCall.name}(${JSON.stringify(toolCall.args)})`);
    const observation = await tool.invoke(toolCall);
    result.push(observation);
  }

  return { messages: result };

}



function shouldContinue(state) {
  const lastMessage = state.messages.at(-1);

  // Check if it's an AIMessage before accessing tool_calls
  if (!lastMessage || !AIMessage.isInstance(lastMessage)) {
    return END;
  }

  // If the LLM makes a tool call, then perform an action
  if (lastMessage.tool_calls?.length) {
    return "Action";
  }

  // Otherwise, we stop (reply to the user)
  return END;
};


const agentBuilder = new StateGraph(MessagesAnnotation)
.addNode("llmCall", llmCall)
.addNode("tools", toolNode)
.addEdge(START, "llmCall")
.addConditionalEdges("llmCall", shouldContinue, {
    "Action": "tools",
    [END]: END
})
.addEdge("tools", "llmCall")
.compile();



const messages = [
    {
        role: 'user',
        content: 'Please add 5 and 3.'
    }
];

const result  = await agentBuilder.invoke({ messages });
console.log(result.messages.at(-1).content);