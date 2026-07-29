/**
 * MCP client configuration generator (C3). Pure functions porting the existing
 * connect logic: given a connection token, produce the per-client config a user
 * pastes into Claude Code / Cursor / any MCP client.
 */
export const MCP_URL = process.env.NEXT_PUBLIC_MCP_URL ?? "http://127.0.0.1:4401/mcp";

export type McpClient = "claude-code" | "cursor" | "other";

export const MCP_CLIENTS: { id: McpClient; label: string }[] = [
  { id: "claude-code", label: "Claude Code" },
  { id: "cursor", label: "Cursor" },
  { id: "other", label: "Otra IA" },
];

export function mcpConfig(client: McpClient, token: string, url: string = MCP_URL): string {
  if (client === "claude-code") {
    return JSON.stringify(
      { mcpServers: { savia: { type: "http", url, headers: { Authorization: `Bearer ${token}` } } } },
      null,
      2,
    );
  }
  if (client === "cursor") {
    return JSON.stringify(
      { mcpServers: { savia: { url, headers: { Authorization: `Bearer ${token}` } } } },
      null,
      2,
    );
  }
  return JSON.stringify({ url, headers: { Authorization: `Bearer ${token}` } }, null, 2);
}
