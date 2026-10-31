import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { llm } from '@langchain/tool'; 
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
            a: z.number().description('First number to multiply'),
            b: z.number().description('Second number to multiply')
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
            a: z.number().description('First number to add'),
            b: z.number().description('Second number to add')
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
            a: z.number().description('First number to divide'),
            b: z.number().description('Second number to divide')
        })
    }
);

const tools = [multipy, add, divide];

const toolByName = Object.fromEntries(tools.map(tool => [tool.name, tool]));
const llmQithTools = llm.bindTools(tools);


const llmGemini = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  temperature: 0,
  maxRetries: 2,
});

const llmWithTools = llmGemini.bindTools(tools); 


async function llmCall(state) {

    const result  = await llmWithTools.invoke([
        {
            role: 'user',
            content: 'You are a helpful assistant tasked with performing arithmetic operations on a set of inputs.'
        },
        ...state.message
    ]);

    return {
        message: [result]
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
    END: END
})
.addEdge("tools", "llmCall")
.compile();



const message =  [
    {
        role: 'user',
        content: 'Please add 5 and 3.'
    }
];

const result  = await agentBuilder.invoke({ messages });
console.log(result);