# @virta/registry

Registration utilities and PipelineDefinition conversion helpers for Virta.

This package provides the bridge between external workflow formats (ASL, Arazzo, JSON configs) and Virta's core DAG engine. It includes:

- **StepRegistry**: Maps string IDs to step constructors
- **PipelineDefinition**: Intermediate DAG model for external formats
- **Conversion utilities**: Convert between PipelineDefinition and RegisteredStep[]

## Installation

```bash
pnpm add @virta/registry
```

## Usage

### StepRegistry

Register step constructors with string IDs for use in external formats:

```typescript
import { StepRegistry } from "@virta/registry";
import { ValidateStep, TransformStep } from "./steps";

const registry = new StepRegistry<SourceData, TargetData>();

// Register individual steps
registry.register("validate", ValidateStep);
registry.register("transform", TransformStep);

// Or register multiple at once
registry.registerAll({
  validate: ValidateStep,
  transform: TransformStep,
  enrich: EnrichStep,
});

// Resolve step by ID
const ValidateStep = registry.resolve("validate");

// Check if step is registered
if (registry.has("validate")) {
  // ...
}

// Get all registered IDs
const ids = registry.getRegisteredIds();
```

### PipelineDefinition

The intermediate DAG model allows external formats to represent pipelines:

```typescript
import type { PipelineDefinition } from "@virta/registry";

const definition: PipelineDefinition = {
  nodes: [
    {
      id: "step1",
      type: "task",
      dependsOn: [],
      stepRef: "validate",
    },
    {
      id: "step2",
      type: "task",
      dependsOn: ["step1"],
      stepRef: "transform",
    },
  ],
};
```

### Converting to Core Model

Convert PipelineDefinition to RegisteredStep[] for use with core engine:

```typescript
import {
  pipelineDefinitionToRegisteredSteps,
  StepRegistry,
} from "@virta/registry";
import { runPipeline, type PipelineDefinition } from "@virta/core";

const registry = new StepRegistry();
registry.register("validate", ValidateStep);
registry.register("transform", TransformStep);

const intermediateDef: PipelineDefinition = {
  nodes: [
    { id: "step1", type: "task", dependsOn: [], stepRef: "validate" },
    { id: "step2", type: "task", dependsOn: ["step1"], stepRef: "transform" },
  ],
};

// Convert to core model
const coreDefinition: PipelineDefinition = {
  steps: pipelineDefinitionToRegisteredSteps(intermediateDef, registry),
};

// Use with core engine
const result = await runPipeline(coreDefinition, {
  source: inputData,
  target: {},
});
```

### Converting from Core Model

Convert RegisteredStep[] back to PipelineDefinition for export:

```typescript
import {
  registeredStepsToPipelineDefinition,
  StepRegistry,
} from "@virta/registry";

const registry = new StepRegistry();
registry.register("validate", ValidateStep);
registry.register("transform", TransformStep);

const coreDefinition: PipelineDefinition = {
  steps: [
    { ctor: ValidateStep },
    { ctor: TransformStep, dependsOn: [ValidateStep] },
  ],
};

// Convert to intermediate model for export
const intermediateDef = registeredStepsToPipelineDefinition(
  coreDefinition.steps,
  registry
);

// Now you can export to ASL, Arazzo, etc.
```

### Metadata Support

PipelineDefinition nodes can include metadata in their config:

```typescript
const definition: PipelineDefinition = {
  nodes: [
    {
      id: "step1",
      type: "task",
      dependsOn: [],
      stepRef: "validate",
      config: {
        metadata: {
          executionHint: "lambda-only",
          timing: {
            p50Ms: 10,
            p99Ms: 50,
          },
        },
      },
    },
  ],
};
```

The metadata is automatically extracted and attached to RegisteredStep instances during conversion.

## API Reference

### `StepRegistry<S, T>`

Registry for mapping string IDs to step constructors.

**Methods:**
- `register(id: string, ctor: StepCtor<S, T>): void` - Register a step
- `resolve(id: string): StepCtor<S, T>` - Resolve step by ID
- `has(id: string): boolean` - Check if ID is registered
- `getRegisteredIds(): string[]` - Get all registered IDs
- `clear(): void` - Clear all registrations
- `registerAll(registrations: Record<string, StepCtor<S, T>>): void` - Register multiple steps

### `PipelineDefinition`

Intermediate DAG model for external formats.

```typescript
interface PipelineDefinition {
  nodes: PipelineNodeDefinition[];
  entryNodes?: NodeId[];
}

interface PipelineNodeDefinition {
  id: NodeId;
  type: NodeType;
  dependsOn: NodeId[];
  stepRef?: string;
  config?: unknown;
}
```

### `pipelineDefinitionToRegisteredSteps<S, T>(def: PipelineDefinition, registry: StepRegistry<S, T>): RegisteredStep<S, T>[]`

Converts PipelineDefinition to RegisteredStep[].

### `registeredStepsToPipelineDefinition<S, T>(steps: RegisteredStep<S, T>[], registry: StepRegistry<S, T>): PipelineDefinition`

Converts RegisteredStep[] to PipelineDefinition.

## Use Cases

1. **Import from external formats**: ASL, Arazzo, or custom JSON/YAML formats can be converted to PipelineDefinition, then to RegisteredStep[] for execution.

2. **Export to external formats**: Core RegisteredStep[] pipelines can be converted to PipelineDefinition, then exported to ASL, Arazzo, etc.

3. **Dynamic pipeline construction**: Build pipelines from configuration files that reference steps by string IDs.

4. **Multi-package step registration**: Different packages can register their steps in a shared registry.

## See Also

- [Virta Core Documentation](../core/README.md)
- [Examples Package](../examples/README.md) - Contains a complete registry example

