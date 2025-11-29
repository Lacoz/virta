# @virta/asl

Amazon States Language (ASL) import/export for Virta pipelines.

This package provides conversion between ASL (AWS Step Functions) format and Virta's PipelineDefinition intermediate model, enabling round-trip interoperability with AWS Step Functions.

## Installation

```bash
pnpm add @virta/asl
```

## Usage

### Import ASL to PipelineDefinition

Convert an ASL state machine definition to Virta's PipelineDefinition:

```typescript
import { aslToPipelineDefinition } from "@virta/asl";
import { pipelineDefinitionToRegisteredSteps } from "@virta/registry";
import { StepRegistry } from "@virta/registry";

const aslDefinition = {
  StartAt: "ValidateOrder",
  States: {
    ValidateOrder: {
      Type: "Task",
      Resource: "arn:aws:lambda:us-east-1:123456789012:function:ValidateOrder",
      Next: "ProcessOrder",
    },
    ProcessOrder: {
      Type: "Task",
      Resource: "arn:aws:lambda:us-east-1:123456789012:function:ProcessOrder",
      End: true,
    },
  },
};

// Convert to PipelineDefinition
const pipelineDef = aslToPipelineDefinition(aslDefinition);

// Convert to RegisteredStep[] using registry
const registry = new StepRegistry();
registry.register("ValidateOrder", ValidateOrderStep);
registry.register("ProcessOrder", ProcessOrderStep);

const coreDefinition = {
  steps: pipelineDefinitionToRegisteredSteps(pipelineDef, registry),
};

// Use with core engine
const result = await runPipeline(coreDefinition, { source, target });
```

### Export PipelineDefinition to ASL

Convert a Virta PipelineDefinition to ASL format:

```typescript
import { pipelineDefinitionToAsl } from "@virta/asl";
import type { PipelineDefinition } from "@virta/registry";

const pipelineDef: PipelineDefinition = {
  nodes: [
    {
      id: "validate",
      type: "task",
      dependsOn: [],
      stepRef: "validate",
    },
    {
      id: "process",
      type: "task",
      dependsOn: ["validate"],
      stepRef: "process",
    },
  ],
};

// Convert to ASL
const aslDefinition = pipelineDefinitionToAsl(pipelineDef, {
  comment: "Order processing workflow",
  version: "1.0",
  resourceMapper: (stepRef) =>
    `arn:aws:lambda:us-east-1:123456789012:function:${stepRef}`,
});

// Use with AWS Step Functions
console.log(JSON.stringify(aslDefinition, null, 2));
```

## Supported ASL Features

### State Types

- ✅ **Task** - Maps to `"task"` node type
- ✅ **Pass** - Maps to `"pass"` node type
- ✅ **Choice** - Maps to `"choice"` node type
- ✅ **Parallel** - Maps to `"parallel"` node type
- ⚠️ **Map** - Maps to `"task"` (limited support)
- ⚠️ **Wait** - Maps to `"task"` (limited support)
- ⚠️ **Succeed** - Maps to `"task"` (limited support)
- ⚠️ **Fail** - Maps to `"task"` (limited support)

### ASL Features

- ✅ **Next transitions** - Converted to dependencies
- ✅ **Parallel branches** - Preserved in PipelineDefinition
- ✅ **Choice rules** - Preserved in config
- ✅ **Catch/Retry** - Preserved in config
- ✅ **Resource ARNs** - Extracted to stepRef
- ✅ **State metadata** - Preserved in config

## API Reference

### `aslToPipelineDefinition(aslJson: AslStateMachine): PipelineDefinition`

Converts an ASL state machine definition to PipelineDefinition.

**Parameters:**
- `aslJson` - ASL state machine definition

**Returns:** PipelineDefinition ready for conversion to RegisteredStep[]

**Example:**
```typescript
const asl = {
  StartAt: "Start",
  States: {
    Start: {
      Type: "Task",
      Resource: "arn:aws:lambda:...",
      End: true,
    },
  },
};

const pipelineDef = aslToPipelineDefinition(asl);
```

### `pipelineDefinitionToAsl(def: PipelineDefinition, options?: AslExportOptions): AslStateMachine`

Converts a PipelineDefinition to ASL format.

**Parameters:**
- `def` - PipelineDefinition to convert
- `options` - Optional configuration:
  - `comment?: string` - Comment for the state machine
  - `version?: string` - Version string
  - `timeoutSeconds?: number` - Timeout for the state machine
  - `resourceMapper?: (stepRef: string) => string` - Function to map stepRef to Resource ARN

**Returns:** ASL state machine definition

**Example:**
```typescript
const asl = pipelineDefinitionToAsl(pipelineDef, {
  comment: "My workflow",
  resourceMapper: (stepRef) => `arn:aws:lambda:...:function:${stepRef}`,
});
```

## Step Reference Extraction

The import function automatically extracts step references from ASL Resource ARNs:

- **Lambda ARNs**: `arn:aws:lambda:region:account:function:name` → `name`
- **Activity ARNs**: `arn:aws:states:region:account:activity:name` → `name`
- **String identifiers**: Non-ARN strings are used directly

## Round-Trip Conversion

The package supports round-trip conversion:

```typescript
// ASL → PipelineDefinition → ASL
const asl1 = { /* ... */ };
const pipelineDef = aslToPipelineDefinition(asl1);
const asl2 = pipelineDefinitionToAsl(pipelineDef);

// ASL structure is preserved (with some limitations)
```

## Limitations

1. **Nested Parallel branches**: Parallel state branches contain nested state machines. The current implementation preserves the Parallel state structure but doesn't flatten nested states.

2. **Map/Wait/Succeed/Fail states**: These are mapped to `"task"` type. Full support may be added in future versions.

3. **Complex Choice rules**: Choice state rules are preserved in config but may require custom handling for execution.

## See Also

- [AWS Step Functions ASL Documentation](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-amazon-states-language.html)
- [Virta Registry Documentation](../registry/README.md)
- [Virta Core Documentation](../core/README.md)
- [Examples Package](../examples/README.md) - Contains ASL examples


