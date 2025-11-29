#!/usr/bin/env node

/**
 * CLI entry point for Virta MCP Server
 * 
 * This server exposes Virta pipelines as MCP tools for LLM agents.
 * 
 * Usage:
 *   virta-mcp
 * 
 * The server communicates via stdio using the Model Context Protocol.
 */

import { startMcpServer } from "./server.js";

startMcpServer().catch((error) => {
  console.error("Failed to start MCP server:", error);
  process.exit(1);
});


