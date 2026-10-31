# ai-agent-llm

A small, beginner-friendly **AI agent** written in JavaScript.

You ask it a math question in plain English (for example, *"Please add 5 and 3."*). The AI model (Google **Gemini**) works out which calculator tool it needs, the program runs that tool, and the AI uses the result to give you the final answer.

It's built with [LangChain](https://js.langchain.com/) and [LangGraph](https://langchain-ai.github.io/langgraphjs/), two popular libraries for building AI apps.

---

## Table of contents

1. [Key ideas (read this first)](#1-key-ideas-read-this-first)
2. [How the agent works](#2-how-the-agent-works)
3. [What you need before you start](#3-what-you-need-before-you-start)
4. [Setup, step by step](#4-setup-step-by-step)
5. [Run the agent](#5-run-the-agent)
6. [A tour of the code](#6-a-tour-of-the-code)
7. [Things to try next](#7-things-to-try-next)
8. [Troubleshooting](#8-troubleshooting)
9. [Project files](#9-project-files)

---

## 1. Key ideas (read this first)

If you're new to AI agents, these five terms are all you need:

| Term | What it means in plain English |
|------|--------------------------------|
| **LLM** (Large Language Model) | An AI that reads text and writes text back. Here it's Google's Gemini. |
| **Tool** | A normal JavaScript function that the AI is allowed to ask for. In this project the tools are `add`, `multiply` and `divide`. |
| **Tool call** | The AI saying "please run the `add` tool with `a = 5` and `b = 3`." The AI never runs code itself. It asks, and *our program* runs the function. |
| **Agent** | A loop: the AI thinks → asks for a tool → gets the result → thinks again, until it has the answer. |
| **Graph** | LangGraph describes the agent as a flowchart. Each box is a **node** (a step) and each arrow is an **edge** (what happens next). |

Why use tools at all? LLMs are good with language but can get arithmetic wrong. Giving them a real calculator makes the answers dependable.

---

## 2. How the agent works

Here is the flowchart (graph) that `index.js` builds:

```
        ┌─────────┐
        │  START  │
        └────┬────┘
             │
             ▼
     ┌───────────────┐
     │    llmCall    │◄─────────────┐
     │ (ask Gemini)  │              │
     └───────┬───────┘              │
             │                      │
   Did Gemini ask for a tool?       │
       │                │           │
      NO               YES          │
       │                │           │
       ▼                ▼           │
   ┌───────┐     ┌─────────────┐    │
   │  END  │     │    tools    │────┘
   └───────┘     │ (run add,   │  send the result
                 │  multiply,  │  back to Gemini
                 │  or divide) │
                 └─────────────┘
```

For the question *"Please add 5 and 3."* this is what happens:

1. **llmCall**: Gemini reads the question and replies, "I want to call `add` with `a = 5`, `b = 3`."
2. **shouldContinue**: the program sees a tool call, so it goes to the `tools` step.
3. **tools**: the program runs `add(5, 3)` and gets `8`.
4. **llmCall** (again): Gemini now knows the result is 8 and writes a normal answer.
5. **shouldContinue**: no more tool calls, so the program goes to **END** and prints the answer.

---

## 3. What you need before you start

- **Node.js version 20 or newer.** Check by running this in a terminal:
  ```bash
  node --version
  ```
  If you get an error or a number below 20, download Node.js from <https://nodejs.org/> (pick the "LTS" version).
- **A Google Gemini API key** (free to get):
  1. Go to <https://aistudio.google.com/apikey>.
  2. Sign in with your Google account.
  3. Click **Create API key** and copy it.
- *(Optional)* **A LangSmith account** at <https://smith.langchain.com/>. LangSmith lets you watch each step of your agent in a web dashboard. You don't need it to run the project.

---

## 4. Setup, step by step

### Step 1: Open a terminal in the project folder

```bash
cd "path/to/ai-agent-langchain'"
```

> **Tip:** the folder name ends with an apostrophe (`'`), so put the whole path inside **double quotes** as shown above, or the terminal will get confused.

### Step 2: Install the libraries

```bash
npm install
```

This reads `package.json` and downloads everything the project needs into a `node_modules` folder. It may take a minute.

### Step 3: Create your `.env` file

The `.env` file holds your secret keys. Create a file called `.env` in the project folder (if it isn't there already) and add:

```env
# Required: your Gemini key from Google AI Studio
GOOGLE_API_KEY=paste-your-gemini-key-here

# Optional: only if you want to use LangSmith tracing
LANGSMITH_TRACING=true
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_API_KEY=paste-your-langsmith-key-here
```

If you're not using LangSmith, leave out the `LANGSMITH_*` lines, or set `LANGSMITH_TRACING=false`.

> ⚠️ **Never share your `.env` file or upload it to GitHub.** It's already listed in `.gitignore`, so Git ignores it. Keep it that way.

---

## 5. Run the agent

```bash
node index.js
```

You should see something like this:

```
Calling Gemini...
Running tool add({"a":5,"b":3})
Calling Gemini...
5 + 3 = 8.
```

The last line comes from the AI, so the exact wording may be a little different each time.

---

## 6. A tour of the code

Everything is in **`index.js`**, which you can read from top to bottom in this order:

### a) Load settings

```js
import "dotenv/config";
```
This reads your `.env` file so the program can find `GOOGLE_API_KEY`.

### b) Define the tools

```js
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
```
Each tool has two parts:
- **The function** (`a + b`): the code that actually runs.
- **The description and schema**: these tell the AI what the tool does and what inputs it needs. The schema is written with [Zod](https://zod.dev/), a library for describing data shapes. Here it says "`a` and `b` must be numbers."

`multiply` and `divide` follow the same pattern.

### c) Set up the AI model

```js
const llmGemini = new ChatGoogleGenerativeAI({
  model: "gemini-3.8-flash",
  temperature: 0,
  maxRetries: 2,
});

const llmWithTools = llmGemini.bindTools(tools);
```
- `model`: which Gemini model to use.
- `temperature: 0`: makes the answers predictable rather than "creative", which is what you want for math.
- `maxRetries: 2`: if the request fails, try again up to 2 times.
- `bindTools(tools)`: tells Gemini which tools it may ask for.

### d) The three steps of the agent

| Function | What it does |
|----------|--------------|
| `llmCall(state)` | Sends the conversation so far (plus a system message saying "you do arithmetic") to Gemini and saves the reply. |
| `toolNode(state)` | Looks at Gemini's last reply, finds each tool it asked for, runs it, and saves the results. |
| `shouldContinue(state)` | Decides what happens next: if Gemini asked for a tool, go to `tools`; if not, stop. |

`state` is the agent's memory. Here it's simply the list of messages so far (`state.messages`).

### e) Connect the steps into a graph

```js
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
```
This is the code version of the flowchart in [section 2](#2-how-the-agent-works):
- `addNode`: adds a box.
- `addEdge`: adds an arrow that always goes the same way.
- `addConditionalEdges`: adds a fork in the road, using `shouldContinue` to pick the direction.
- `compile()`: turns the plan into an agent you can run.

### f) Ask a question

```js
const messages = [
    { role: 'user', content: 'Please add 5 and 3.' }
];

const result = await agentBuilder.invoke({ messages });
console.log(result.messages.at(-1).content);
```
This starts the agent with your question and prints the last message, which is the final answer.

---

## 7. Things to try next

Once it works, try changing things. That's the best way to learn.

1. **Ask a harder question.** Change the `content` near the bottom of `index.js`:
   ```js
   content: 'What is (12 multiplied by 4) divided by 3, then add 10?'
   ```
   Run it again and watch the AI call several tools one after another.

2. **Add your own tool.** For example, a `subtract` tool:
   ```js
   const subtract = tool(
       async ({ a, b }) => {
           return a - b;
       },
       {
           name: 'subtract',
           description: 'Subtracts the second number from the first',
           schema: z.object({
               a: z.number().describe('Number to subtract from'),
               b: z.number().describe('Number to subtract')
           })
       }
   );
   ```
   Then add it to the list: `const tools = [multipy, add, divide, subtract];`

3. **Change the system message** inside `llmCall` to give the AI a different personality, for example "Explain each step like I'm 10 years old."

4. **Turn on LangSmith** (see [Step 3](#step-3-create-your-env-file)) and open <https://smith.langchain.com/> to see every step of a run in your browser.

---

## 8. Troubleshooting

| Problem | Likely cause and fix |
|---------|----------------------|
| `Cannot find module '@langchain/...'` | The libraries aren't installed. Run `npm install`. |
| Error mentioning an **API key** or **401 / 403** | `GOOGLE_API_KEY` is missing or wrong. Check your `.env` file: no spaces around `=` and no quotes needed. |
| Error mentioning the **model** not found | The model name may have changed. Open `index.js` and set `model:` to a model listed at <https://ai.google.dev/gemini-api/docs/models>. |
| `SyntaxError: Cannot use import statement outside a module` | `package.json` must contain `"type": "module"`. It already does, so don't remove it. |
| `cd` command fails or the terminal waits for more input | The folder name contains `'`. Wrap the path in double quotes. |
| Errors mentioning **LangSmith** | Set `LANGSMITH_TRACING=false` in `.env` or check your LangSmith key. |
| `429` / "quota exceeded" | You've hit the free usage limit. Wait a bit and try again. |

---

## 9. Project files

```
ai-agent-langchain'/
├── index.js           # The whole agent: tools, model, graph, and the question
├── package.json       # Project info and the list of libraries it uses
├── package-lock.json  # Exact library versions (created by npm, don't edit)
├── .env               # Your secret API keys (you create this; never commit it)
├── .gitignore         # Tells Git to ignore node_modules/ and .env
└── README.md          # This file
```

### Libraries used

| Library | Why it's here |
|---------|---------------|
| `@langchain/core` | The building blocks: `tool()` and message types. |
| `@langchain/google-genai` | Connects LangChain to Google Gemini. |
| `@langchain/langgraph` | Builds the agent's flowchart (graph). |
| `zod` | Describes the inputs each tool expects. |
| `dotenv` | Loads secret keys from the `.env` file. |
| `@langchain/anthropic` | Installed but not used yet. You can use it to switch the agent to Anthropic's Claude models. |

---

Happy building! 🚀
