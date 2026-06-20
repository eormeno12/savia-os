import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type OpenAI from "openai";
import type { FunctionTool } from "openai/resources/responses/responses.js";

const CLIENT_NAME = "savia-demo";
const clientCache = new Map<string, Client>();

export async function getClient(userId: string): Promise<Client> {
  if (!clientCache.has(userId)) {
    const baseUrl = process.env.MEM0_MCP_URL ?? "http://localhost:8765";
    const url = new URL(`/mcp/${CLIENT_NAME}/http/${userId}`, baseUrl);

    const client = new Client({ name: CLIENT_NAME, version: "0.1.0" });
    await client.connect(new StreamableHTTPClientTransport(url));
    clientCache.set(userId, client);
  }
  return clientCache.get(userId)!;
}

// Tools are identical for every user — cache after first fetch.
let cachedCompletionsTools: OpenAI.Chat.ChatCompletionTool[] | null = null;
let cachedResponsesTools: FunctionTool[] | null = null;

export async function getMcpToolsAsOpenAI(userId: string): Promise<OpenAI.Chat.ChatCompletionTool[]> {
  if (cachedCompletionsTools) return cachedCompletionsTools;
  const { tools } = await (await getClient(userId)).listTools();
  cachedCompletionsTools = tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description ?? "",
      parameters: t.inputSchema as Record<string, unknown>,
    },
  }));
  return cachedCompletionsTools;
}

// Responses API tool format — flat, no nested `function` wrapper.
export async function getMcpToolsForResponses(userId: string): Promise<FunctionTool[]> {
  if (cachedResponsesTools) return cachedResponsesTools;
  const { tools } = await (await getClient(userId)).listTools();
  cachedResponsesTools = tools.map((t) => ({
    type: "function" as const,
    name: t.name,
    description: t.description ?? "",
    parameters: t.inputSchema as Record<string, unknown>,
    strict: false as const,
  }));
  return cachedResponsesTools;
}

export async function callMcpTool(
  userId: string,
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  const result = await (await getClient(userId)).callTool({ name, arguments: args });
  const content = result.content as { type: string; text?: string }[];
  return content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}
