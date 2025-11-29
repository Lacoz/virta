# @virta/mcp-server

MCP server exposing Virta pipelines as tools for LLM agents and IDE assistants.

This package provides a Model Context Protocol (MCP) server that allows AI tools (ChatGPT, Claude, IDE agents) to introspect, plan, and execute Virta pipelines.

## Installation

```bash
pnpm add @virta/mcp-server
```

## Usage

### Starting the MCP Server

```bash
virta-mcp
```

Or programmatically:

```typescript
import { startMcpServer } from "@virta/mcp-server";

await startMcpServer();
```

### MCP Tools

The server exposes the following tools:

#### `list_pipelines`
Returns available pipeline IDs and metadata.

**Parameters:** None

**Returns:** Array of pipeline metadata objects

#### `get_pipeline_definition`
Returns PipelineDefinition as JSON for a given pipeline ID.

**Parameters:**
- `pipelineId: string` - The ID of the pipeline to retrieve

**Returns:** PipelineDefinition JSON

#### `run_pipeline_preview`
Evaluates plan (critical path, estimated times, recommended execution mode) without executing steps.

**Parameters:**
- `pipelineId: string` - The ID of the pipeline to preview

**Returns:** Preview information including critical path, execution plan, and execution levels

#### `run_pipeline`
Executes a pipeline for a given pipelineId and source payload.

**Parameters:**
- `pipelineId: string` - The ID of the pipeline to execute
- `source: object` - Source data for the pipeline

**Returns:** PipelineResult with status, executed steps, errors, and context

#### `plan_execution`
Directly calls the planner to determine ExecutionMode and optional details.

**Parameters:**
- `pipelineId: string` - The ID of the pipeline to plan
- `lambdaMaxMs?: number` - Maximum Lambda execution time in milliseconds (default: 720000)

**Returns:** ExecutionPlan with mode, critical path, and reasoning

#### `export_asl`
Returns ASL JSON for a pipeline.

**Parameters:**
- `pipelineId: string` - The ID of the pipeline to export

**Returns:** ASL state machine JSON

#### `export_arazzo`
Returns Arazzo scenario JSON for a pipeline.

**Parameters:**
- `pipelineId: string` - The ID of the pipeline to export
- `scenarioName?: string` - Optional scenario name (defaults to pipelineId)

**Returns:** Arazzo workflow document JSON

#### `export_bpmn`
Returns BPMN 2.0 XML for a pipeline.

**Parameters:**
- `pipelineId: string` - The ID of the pipeline to export

**Returns:** BPMN 2.0 XML string

#### `import_asl`
Register or update a Virta pipeline from ASL JSON.

**Parameters:**
- `pipelineId: string` - The ID for the new/updated pipeline
- `aslJson: object` - ASL state machine definition
- `metadataByNodeId?: object` - Optional metadata map for nodes

**Returns:** Success confirmation with node count

#### `import_arazzo`
Register or update a Virta pipeline from Arazzo JSON.

**Parameters:**
- `pipelineId: string` - The ID for the new/updated pipeline
- `arazzoJson: object` - Arazzo workflow document
- `scenarioName: string` - The scenario name to import
- `metadataByNodeId?: object` - Optional metadata map for nodes

**Returns:** Success confirmation with node count

#### `import_bpmn`
Register or update a Virta pipeline from BPMN XML.

**Parameters:**
- `pipelineId: string` - The ID for the new/updated pipeline
- `bpmnXml: string` - BPMN 2.0 XML string
- `metadataByNodeId?: object` - Optional metadata map for nodes

**Returns:** Success confirmation with node count

## Pipeline Storage

The server uses an in-memory `PipelineStorage` by default. In production, you can replace this with:
- File-based storage
- Database (PostgreSQL, MongoDB, etc.)
- Cloud storage (S3, DynamoDB, etc.)

## Configuration

The MCP server communicates via stdio using the Model Context Protocol. To use it with MCP clients:

1. Configure your MCP client (e.g., Claude Desktop, Cursor) to use the server
2. Point to the `virta-mcp` binary or `node dist/cli.js`
3. The server will handle tool discovery and execution automatically

## Example MCP Client Configuration

For Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "virta": {
      "command": "node",
      "args": ["/path/to/virta/packages/mcp-server/dist/cli.js"]
    }
  }
}
```

## API Reference

### `createVirtaMcpServer()`

Creates and configures a Virta MCP server instance.

**Returns:** `{ server: Server, storage: PipelineStorage }`

### `startMcpServer()`

Starts the MCP server with stdio transport.

**Returns:** `Promise<void>`

### `PipelineStorage`

In-memory pipeline storage with methods:
- `save(metadata: PipelineMetadata): void`
- `get(id: string): PipelineMetadata | undefined`
- `list(): Array<{ id, name, description, updatedAt }>`
- `delete(id: string): boolean`
- `has(id: string): boolean`
- `clear(): void`

## See Also

- [Model Context Protocol](https://modelcontextprotocol.io)
- [Virta Core](../core/README.md)
- [Virta Planner](../planner/README.md)
- [Virta ASL](../asl/README.md)
- [Virta Arazzo](../arazzo/README.md)
- [Virta BPMN](../bpmn/README.md)


