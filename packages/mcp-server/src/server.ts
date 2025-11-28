import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";
import { PipelineStorage } from "./storage.js";

/**
 * Creates and configures a Virta MCP server
 */
export function createVirtaMcpServer(): {
  server: Server;
  storage: PipelineStorage;
} {
  const server = new Server(
    {
      name: "virta-mcp-server",
      version: "0.0.1",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const storage = new PipelineStorage();

  // Register all tools (this handles both tool definitions and tool calls)
  registerTools(server, storage);

  return { server, storage };
}

/**
 * Starts the MCP server with stdio transport
 */
export async function startMcpServer(): Promise<void> {
  const { server } = createVirtaMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Virta MCP Server started");
}
