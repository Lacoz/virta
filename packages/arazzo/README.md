# @virta/arazzo

Arazzo workflow format import/export for Virta pipelines.

This package provides conversion between Arazzo (OpenAPI-based workflows) format and Virta's PipelineDefinition intermediate model, enabling round-trip interoperability with OpenAPI workflow tools.

## Installation

```bash
pnpm add @virta/arazzo
```

## Usage

### Import Arazzo to PipelineDefinition

Convert an Arazzo workflow document to Virta's PipelineDefinition:

```typescript
import { arazzoToPipelineDefinition } from "@virta/arazzo";
import { pipelineDefinitionToRegisteredSteps } from "@virta/registry";
import { StepRegistry } from "@virta/registry";

const arazzoDoc = {
  arazzo: "1.0.0",
  scenarios: {
    "order-processing": {
      steps: [
        {
          id: "validate",
          type: "operation",
          operationId: "validateOrder",
        },
        {
          id: "process",
          type: "operation",
          operationId: "processOrder",
          runAfter: ["validate"],
        },
      ],
    },
  },
};

// Convert to PipelineDefinition
const pipelineDef = arazzoToPipelineDefinition(arazzoDoc, "order-processing");

// Convert to RegisteredStep[] using registry
const registry = new StepRegistry();
registry.register("validateOrder", ValidateOrderStep);
registry.register("processOrder", ProcessOrderStep);

const coreDefinition = {
  steps: pipelineDefinitionToRegisteredSteps(pipelineDef, registry),
};

// Use with core engine
const result = await runPipeline(coreDefinition, { source, target });
```

### Export PipelineDefinition to Arazzo

Convert a Virta PipelineDefinition to Arazzo format:

```typescript
import { pipelineDefinitionToArazzo } from "@virta/arazzo";
import type { PipelineDefinition } from "@virta/registry";

const pipelineDef: PipelineDefinition = {
  nodes: [
    {
      id: "validate",
      type: "task",
      dependsOn: [],
      stepRef: "validateOrder",
    },
    {
      id: "process",
      type: "task",
      dependsOn: ["validate"],
      stepRef: "processOrder",
    },
  ],
};

// Convert to Arazzo
const arazzoDoc = pipelineDefinitionToArazzo(pipelineDef, "order-processing", {
  arazzoVersion: "1.0.0",
  info: {
    title: "Order Processing Workflow",
    version: "1.0.0",
  },
});

// Use with OpenAPI workflow tools
console.log(JSON.stringify(arazzoDoc, null, 2));
```

## Supported Arazzo Features

### Step Types

- ✅ **operation** - Maps to `"task"` node type
- ✅ **pass** - Maps to `"pass"` node type
- ✅ **switch** - Maps to `"choice"` node type
- ✅ **parallel** - Maps to `"parallel"` node type
- ⚠️ **loop** - Maps to `"task"` (limited support)
- ⚠️ **sleep** - Maps to `"task"` (limited support)

### Arazzo Features

- ✅ **runAfter** - Converted to dependencies
- ✅ **operationId** - Extracted to stepRef
- ✅ **inputs/outputs** - Preserved in config
- ✅ **OpenAPI references** - Preserved in config
- ✅ **Scenario structure** - Full support

## API Reference

### `arazzoToPipelineDefinition(arazzoJson: ArazzoDocument, scenarioName: string): PipelineDefinition`

Converts an Arazzo workflow document to PipelineDefinition.

**Parameters:**
- `arazzoJson` - Arazzo workflow document
- `scenarioName` - Name of the scenario to convert

**Returns:** PipelineDefinition ready for conversion to RegisteredStep[]

**Example:**
```typescript
const arazzo = {
  scenarios: {
    "my-scenario": {
      steps: [
        { id: "step1", type: "operation", operationId: "op1" },
      ],
    },
  },
};

const pipelineDef = arazzoToPipelineDefinition(arazzo, "my-scenario");
```

### `pipelineDefinitionToArazzo(def: PipelineDefinition, scenarioName: string, options?: ArazzoExportOptions): ArazzoDocument`

Converts a PipelineDefinition to Arazzo format.

**Parameters:**
- `def` - PipelineDefinition to convert
- `scenarioName` - Name for the generated scenario
- `options` - Optional configuration:
  - `arazzoVersion?: string` - Arazzo version (default: "1.0.0")
  - `openapi?: string | Record<string, unknown>` - OpenAPI reference
  - `info?: { title?: string; version?: string; description?: string }` - Workflow metadata

**Returns:** Arazzo workflow document

**Example:**
```typescript
const arazzo = pipelineDefinitionToArazzo(pipelineDef, "my-scenario", {
  arazzoVersion: "1.0.0",
  info: { title: "My Workflow" },
});
```

## Step Reference Extraction

The import function extracts step references from Arazzo operation steps:

- **operationId** → Used as stepRef
- **step id** → Used as stepRef fallback if operationId is missing

## Round-Trip Conversion

The package supports round-trip conversion:

```typescript
// Arazzo → PipelineDefinition → Arazzo
const arazzo1 = { /* ... */ };
const pipelineDef = arazzoToPipelineDefinition(arazzo1, "scenario");
const arazzo2 = pipelineDefinitionToArazzo(pipelineDef, "scenario");

// Arazzo structure is preserved (with some limitations)
```

## Limitations

1. **Nested steps**: Switch and parallel steps may contain nested step structures. The current implementation preserves the structure but may require custom handling for execution.

2. **Loop/sleep steps**: These are mapped to `"task"` type. Full support may be added in future versions.

3. **OpenAPI references**: OpenAPI operation references are preserved in config but may require resolution for execution.

## See Also

- [Arazzo Specification](https://spec.openapis.org/arazzo/v1.0.0)
- [Virta Registry Documentation](../registry/README.md)
- [Virta Core Documentation](../core/README.md)
- [Examples Package](../examples/README.md) - Contains Arazzo examples


