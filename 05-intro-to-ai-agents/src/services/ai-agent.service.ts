import { Type, type Content, type FunctionDeclaration } from "@google/genai";
import fs from "node:fs/promises";
import path from "node:path";

import { createGeminiClient, getGeminiConfig } from "@/configs/gemini";

type Role = "user" | "model";

type ChatMessage = {
  role: Role;
  content: string;
};

type CalculationInput = {
  operation: "add" | "subtract" | "multiply" | "divide" | "mod" | "power";
  a: number;
  b: number;
};

type WeatherInput = {
  city: string;
};

type ExchangeInput = {
  from: string;
  to: string;
};

type DirectoryInput = {
  path: string;
};

type FileInput = DirectoryInput & {
  content: string;
};

type GeminiFunctionTool = {
  functionDeclarations: FunctionDeclaration[];
};

type ToolFunctions = Record<
  string,
  (...args: any[]) => Promise<unknown> | unknown
>;

const ai = createGeminiClient();
const { model } = getGeminiConfig();
const websiteWorkspace = path.resolve("generated-sites");
const chatHistory: ChatMessage[] = [];
const websiteHistory: ChatMessage[] = [];

const chatSystemPrompt = `You are a helpful AI assistant with access to external tools.

Follow these rules:
1. For arithmetic calculations, ALWAYS use the calculator tool.
2. Always use calculator tool for even trivial calculation
3. For current weather, ALWAYS use the currentWeather tool.
4. For currency conversion or exchange rates, ALWAYS use the convertCurrency tool.
5. You may call multiple tools when solving a multi-step request.
6. After receiving tool results, explain the answer naturally.
7. Never invent current weather or exchange-rate information.`;

const websiteSystemPrompt = `You are an expert frontend website developer.

Your job is to create complete static websites using the available tools.

Follow these rules:
1. Create a separate directory for every website.
2. Create index.html.
3. Create style.css.
4. Create script.js when JavaScript is useful.
5. Build modern, beautiful and responsive websites.
6. Use only HTML, CSS and vanilla JavaScript.
7. Do not just return website code in your response. Actually create the files using tools.
8. After creating the website, list the project files.
9. Read important files again if needed and fix obvious problems.
10. Finish only when the complete website has been created.`;

function calculate({ operation, a, b }: CalculationInput): number {
  console.log("Calculator tool called");

  if (operation === "add") return a + b;
  if (operation === "subtract") return a - b;
  if (operation === "multiply") return a * b;
  if (operation === "divide") {
    if (b === 0) throw new Error("Cannot divide by 0");
    return a / b;
  }
  if (operation === "mod") {
    if (b === 0) throw new Error("Cannot calculate mod by 0");
    return a % b;
  }
  if (operation === "power") return a ** b;

  throw new Error(`Unsupported operation ${operation}`);
}

async function currentWeather({ city }: WeatherInput): Promise<string> {
  console.log("Weather tool called");

  const url = new URL("https://api.weatherapi.com/v1/current.json");
  url.searchParams.set("key", process.env.WEATHER_API_KEY ?? "");
  url.searchParams.set("q", city);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.text();
}

async function getExchangeRate({ from, to }: ExchangeInput): Promise<string> {
  console.log("Currency Exchange tool called");

  const response = await fetch(
    `https://api.frankfurter.dev/v2/rate/${encodeURIComponent(from)}/${encodeURIComponent(to)}`
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.text();
}

async function convertCurrency(input: ExchangeInput): Promise<string> {
  return getExchangeRate(input);
}

function safePath(relativePath: string): string {
  const resolved = path.resolve(websiteWorkspace, relativePath);

  if (
    resolved !== websiteWorkspace &&
    !resolved.startsWith(`${websiteWorkspace}${path.sep}`)
  ) {
    throw new Error("Access outside generated-sites is not allowed");
  }

  return resolved;
}

async function createDirectory({
  path: relativePath
}: DirectoryInput): Promise<string> {
  try {
    await fs.mkdir(safePath(relativePath), { recursive: true });
    return `Directory created successfully: ${relativePath}`;
  } catch (error) {
    return `Failed to create directory: ${(error as Error).message}`;
  }
}

async function writeFile({
  path: relativePath,
  content
}: FileInput): Promise<string> {
  try {
    const file = safePath(relativePath);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content, "utf8");
    return `File written successfully: ${relativePath}`;
  } catch (error) {
    return `Failed to write file: ${(error as Error).message}`;
  }
}

async function readFile({
  path: relativePath
}: DirectoryInput): Promise<string> {
  try {
    return await fs.readFile(safePath(relativePath), "utf8");
  } catch (error) {
    return `Failed to read file: ${(error as Error).message}`;
  }
}

async function listFiles({
  path: relativePath
}: DirectoryInput): Promise<string> {
  try {
    const directory = safePath(relativePath);

    try {
      await fs.access(directory);
    } catch {
      return `Directory does not exist: ${relativePath}`;
    }

    const files: string[] = [];

    async function walk(current: string): Promise<void> {
      for (const entry of await fs.readdir(current, { withFileTypes: true })) {
        const item = path.join(current, entry.name);
        files.push(path.relative(websiteWorkspace, item));

        if (entry.isDirectory()) {
          await walk(item);
        }
      }
    }

    await walk(directory);
    return files.join("\n");
  } catch (error) {
    return `Failed to list files: ${(error as Error).message}`;
  }
}

function tool(
  name: string,
  description: string,
  properties: Record<string, { type: Type; description: string }>
): GeminiFunctionTool {
  return {
    functionDeclarations: [
      {
        name,
        description,
        parameters: {
          type: Type.OBJECT,
          properties: properties as Record<string, any>,
          required: Object.keys(properties)
        } as any
      }
    ]
  };
}

const chatTools: GeminiFunctionTool[] = [
  {
    functionDeclarations: [
      {
        name: "calculate",
        description:
          "Performs arithmetic calculations. Supported operations: add, subtract, multiply, divide, mod, power.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            operation: {
              type: Type.STRING,
              description:
                "Operation: add, subtract, multiply, divide, mod, power"
            },
            a: {
              type: Type.NUMBER,
              description: "First number"
            },
            b: {
              type: Type.NUMBER,
              description: "Second number"
            }
          },
          required: ["operation", "a", "b"]
        } as any
      }
    ]
  },
  {
    functionDeclarations: [
      {
        name: "currentWeather",
        description: "Get the current weather of a city.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            city: {
              type: Type.STRING,
              description: "Name of the city"
            }
          },
          required: ["city"]
        } as any
      }
    ]
  },
  {
    functionDeclarations: [
      {
        name: "convertCurrency",
        description: "Gets the latest exchange rate between two currencies.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            from: {
              type: Type.STRING,
              description: "Source currency code, for example USD"
            },
            to: {
              type: Type.STRING,
              description: "Target currency code, for example INR"
            }
          },
          required: ["from", "to"]
        } as any
      }
    ]
  }
];

const websiteTools: GeminiFunctionTool[] = [
  tool(
    "createDirectory",
    "Creates a new directory inside the website workspace.",
    {
      path: {
        type: Type.STRING,
        description: "Relative directory path, for example brewlab"
      }
    }
  ),
  tool(
    "writeFile",
    "Creates or overwrites a text file inside the website workspace. Use this to create HTML, CSS and JavaScript files.",
    {
      path: {
        type: Type.STRING,
        description: "Relative file path, for example brewlab/index.html"
      },
      content: {
        type: Type.STRING,
        description: "Complete content that should be written into the file"
      }
    }
  ),
  tool(
    "readFile",
    "Reads the contents of an existing file from the website workspace.",
    {
      path: {
        type: Type.STRING,
        description: "Relative file path"
      }
    }
  ),
  tool(
    "listFiles",
    "Lists all files and directories inside a website project.",
    {
      path: {
        type: Type.STRING,
        description: "Relative directory path, for example brewlab"
      }
    }
  )
];

function toGeminiContents(history: ChatMessage[]): Content[] {
  return history.map(({ role, content }) => ({
    role: role === "user" ? "user" : "model",
    parts: [{ text: content }]
  }));
}

async function complete(
  systemPrompt: string,
  history: ChatMessage[],
  tools: GeminiFunctionTool[],
  functions: ToolFunctions,
  message: string
): Promise<string> {
  history.push({ role: "user", content: message });

  while (true) {
    const response = await ai.models.generateContent({
      model,
      contents: toGeminiContents(history),
      config: {
        systemInstruction: systemPrompt,
        tools
      }
    });

    const calls = response.functionCalls ?? [];

    if (calls.length === 0) {
      const finalText = response.text?.trim();

      if (!finalText) {
        throw new Error("Gemini returned an empty response");
      }

      history.push({ role: "model", content: finalText });
      return finalText;
    }

    for (const call of calls) {
      const name = call.name ?? "";
      const fn = functions[name];

      if (!fn) {
        throw new Error(`Unsupported tool call: ${name}`);
      }

      const result = await fn(call.args ?? {});
      history.push({
        role: "user",
        content: `Tool result for ${name}: ${JSON.stringify(result)}`
      });
    }
  }
}

export function chat(message: string): Promise<string> {
  return complete(
    chatSystemPrompt,
    chatHistory,
    chatTools,
    {
      calculate,
      currentWeather,
      convertCurrency
    },
    message
  );
}

export async function generateWebsite(message: string): Promise<string> {
  await fs.mkdir(websiteWorkspace, { recursive: true });

  return complete(
    websiteSystemPrompt,
    websiteHistory,
    websiteTools,
    {
      createDirectory,
      writeFile,
      readFile,
      listFiles
    },
    message
  );
}

export function createAgentService() {
  return {
    async summarize(ticket: string): Promise<string> {
      return chat(ticket);
    }
  };
}
