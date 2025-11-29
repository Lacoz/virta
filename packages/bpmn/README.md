# @virta/bpmn

BPMN 2.0 import/export for Virta pipelines.

This package provides conversion between BPMN 2.0 XML format and Virta's PipelineDefinition intermediate model, enabling round-trip interoperability with BPMN tools and business process modeling software.

## Installation

```bash
pnpm add @virta/bpmn
```

## Usage

### Import BPMN to PipelineDefinition

Convert a BPMN 2.0 XML document to Virta's PipelineDefinition:

```typescript
import { bpmnToPipelineDefinition } from "@virta/bpmn";
import { pipelineDefinitionToRegisteredSteps } from "@virta/registry";
import { StepRegistry } from "@virta/registry";
import { readFile } from "node:fs/promises";

// Load BPMN XML from file
const bpmnXml = await readFile("./workflow.bpmn", "utf-8");

// Convert to PipelineDefinition
const pipelineDef = await bpmnToPipelineDefinition(bpmnXml);

// Convert to RegisteredStep[] using registry
const registry = new StepRegistry();
registry.register("Task_1", ValidateStep);
registry.register("Task_2", ProcessStep);

const coreDefinition = {
  steps: pipelineDefinitionToRegisteredSteps(pipelineDef, registry),
};

// Use with core engine
const result = await runPipeline(coreDefinition, { source, target });
```

### Export PipelineDefinition to BPMN

Convert a Virta PipelineDefinition to BPMN 2.0 XML format:

```typescript
import { pipelineDefinitionToBpmn } from "@virta/bpmn";
import type { PipelineDefinition } from "@virta/registry";
import { writeFile } from "node:fs/promises";

const pipelineDef: PipelineDefinition = {
  nodes: [
    {
      id: "task1",
      type: "task",
      dependsOn: [],
      stepRef: "task1",
    },
    {
      id: "task2",
      type: "task",
      dependsOn: ["task1"],
      stepRef: "task2",
    },
  ],
};

// Convert to BPMN XML
const bpmnXml = await pipelineDefinitionToBpmn(pipelineDef, {
  processId: "MyProcess",
  processName: "My Workflow",
  targetNamespace: "http://example.com/bpmn",
});

// Save to file
await writeFile("./workflow.bpmn", bpmnXml, "utf-8");
```

## Supported BPMN Features

### Element Types

- ✅ **ServiceTask** - Maps to `"task"` node type
- ✅ **UserTask** - Maps to `"task"` node type
- ✅ **ScriptTask** - Maps to `"task"` node type
- ✅ **Task** - Maps to `"task"` node type
- ✅ **ExclusiveGateway** - Maps to `"choice"` node type
- ✅ **ParallelGateway** - Maps to `"parallel"` node type
- ⚠️ **InclusiveGateway** - Maps to `"parallel"` (limited support)
- ⚠️ **StartEvent/EndEvent** - Implicit in PipelineDefinition (not mapped as nodes)

### BPMN Features

- ✅ **Sequence Flows** - Converted to dependencies
- ✅ **Parallel Gateways** - Preserved in PipelineDefinition
- ✅ **Exclusive Gateways** - Preserved as choice nodes
- ✅ **Task names** - Preserved in config
- ✅ **BPMN metadata** - Preserved in config

## API Reference

### `bpmnToPipelineDefinition(bpmnXml: string): Promise<PipelineDefinition>`

Converts a BPMN 2.0 XML document to PipelineDefinition.

**Parameters:**
- `bpmnXml` - BPMN 2.0 XML string

**Returns:** Promise resolving to PipelineDefinition ready for conversion to RegisteredStep[]

**Example:**
```typescript
const bpmnXml = `<?xml version="1.0"?>
  <bpmn2:definitions>
    <bpmn2:process>
      <bpmn2:serviceTask id="Task_1"/>
    </bpmn2:process>
  </bpmn2:definitions>`;

const pipelineDef = await bpmnToPipelineDefinition(bpmnXml);
```

### `pipelineDefinitionToBpmn(def: PipelineDefinition, options?: BpmnExportOptions): Promise<string>`

Converts a PipelineDefinition to BPMN 2.0 XML format.

**Parameters:**
- `def` - PipelineDefinition to convert
- `options` - Optional configuration:
  - `processId?: string` - Process ID (default: "Process_1")
  - `processName?: string` - Process name (default: "Virta Process")
  - `targetNamespace?: string` - Target namespace (default: "http://virta.io/schema/bpmn")

**Returns:** Promise resolving to BPMN 2.0 XML string

**Example:**
```typescript
const bpmnXml = await pipelineDefinitionToBpmn(pipelineDef, {
  processName: "My Workflow",
  targetNamespace: "http://example.com/bpmn",
});
```

## BPMN Element Mapping

The import function maps BPMN elements as follows:

- **Tasks** (ServiceTask, UserTask, ScriptTask) → `"task"` nodes
- **ExclusiveGateway** → `"choice"` nodes
- **ParallelGateway** → `"parallel"` nodes
- **SequenceFlow** → dependencies in `dependsOn`
- **StartEvent/EndEvent** → Implicit (not mapped as nodes)

## Round-Trip Conversion

The package supports round-trip conversion:

```typescript
// BPMN → PipelineDefinition → BPMN
const bpmn1 = `<?xml...>`;
const pipelineDef = await bpmnToPipelineDefinition(bpmn1);
const bpmn2 = await pipelineDefinitionToBpmn(pipelineDef);

// BPMN structure is preserved (with some limitations)
```

## Limitations

1. **Complex gateways**: Inclusive gateways and complex gateway conditions are mapped to parallel/choice but may require custom handling.

2. **Event subprocesses**: Event subprocesses and ad-hoc subprocesses are not fully supported.

3. **Message flows**: Message flows and correlation are not mapped to DAG semantics.

4. **Timers and errors**: Timer events and error handlers are preserved in config but may require custom execution logic.

5. **Data objects**: Data objects are preserved in config but not mapped to PipelineDefinition structure.

## Dependencies

This package uses [bpmn-moddle](https://github.com/bpmn-io/bpmn-moddle) for BPMN XML parsing and generation, which provides:
- Full BPMN 2.0 meta-model support
- XML validation
- Type-safe element creation

## See Also

- [BPMN 2.0 Specification](https://www.omg.org/spec/BPMN/2.0/)
- [bpmn-moddle Documentation](https://github.com/bpmn-io/bpmn-moddle)
- [Virta Registry Documentation](../registry/README.md)
- [Virta Core Documentation](../core/README.md)
- [Examples Package](../examples/README.md) - Contains BPMN examples


