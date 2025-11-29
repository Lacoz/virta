# @virta/ts-codegen

TypeScript code generation and parsing for Virta pipelines.

This package provides bidirectional conversion between Virta's `PipelineDefinition` format and procedural TypeScript code:

- **Generate TypeScript code** from `PipelineDefinition` with step classes and pipeline definitions
- **Parse TypeScript files** back to `PipelineDefinition` using TypeScript Compiler API
- **Validate DAG structure** to ensure generated/parsed pipelines are valid (no cycles, valid dependencies)

## Installation

```bash
pnpm add @virta/ts-codegen
```

## Usage

### Export PipelineDefinition to TypeScript

```typescript
import { pipelineDefinitionToTypeScript } from "@virta/ts-codegen";
import type { PipelineDefinition } from "@virta/registry";

const pipelineDef: PipelineDefinition = {
  nodes: [
    { id: "validate", type: "task", dependsOn: [], stepRef: "validateOrder" },
    { id: "process", type: "task", dependsOn: ["validate"], stepRef: "processOrder" },
  ],
};

const tsCode = pipelineDefinitionToTypeScript(pipelineDef, {
  pipelineName: "OrderProcessing",
  sourceType: "OrderData",
  targetType: "ProcessedOrder",
  implementationMode: "stub", // or "jsonata" or "empty"
});

// Write to file
await writeFile("pipeline.ts", tsCode, "utf-8");
```

### Import TypeScript to PipelineDefinition

```typescript
import { typeScriptToPipelineDefinition } from "@virta/ts-codegen";

// Parse TypeScript file back to PipelineDefinition
const pipelineDef = await typeScriptToPipelineDefinition("./pipeline.ts");

// The pipeline is automatically validated as a DAG
// Throws error if cycles or missing dependencies are detected
```

### Export Options

- `pipelineName`: Name for the pipeline (used in class/variable names)
- `sourceType`: TypeScript type name for source data
- `targetType`: TypeScript type name for target data
- `implementationMode`: 
  - `"stub"` (default): Generate TODO stubs
  - `"jsonata"`: Generate JSONata-based implementations if expressions are found
  - `"empty"`: Generate empty implementations
- `includeImports`: Whether to include import statements (default: `true`)
- `headerComment`: Custom header comment for generated file

### DAG Validation

The import function automatically validates that the parsed TypeScript represents a valid DAG:

- ✅ All dependencies reference existing nodes
- ✅ No cycles in the dependency graph
- ✅ Proper error messages with cycle details if validation fails

## Example

See `packages/examples/src/arazzo-ts-conversion.ts` for a complete example demonstrating:

- Arazzo → TypeScript conversion
- TypeScript → Arazzo conversion
- Round-trip conversion with validation

## API

### `pipelineDefinitionToTypeScript(def, options?)`

Generates TypeScript source code from a `PipelineDefinition`.

**Returns:** TypeScript code as string

### `typeScriptToPipelineDefinition(filePath, options?)`

Parses a TypeScript file and extracts the `PipelineDefinition`.

**Returns:** `Promise<PipelineDefinition>`

**Throws:** Error if:
- File cannot be read
- Pipeline definition not found
- DAG validation fails (cycles or missing dependencies)

## Implementation Details

- Uses **TypeScript Compiler API** for reliable parsing (not regex-based)
- Generates clean, readable TypeScript code with proper formatting
- Supports step class generation with customizable implementations
- Validates DAG structure using Kahn's algorithm and DFS cycle detection


