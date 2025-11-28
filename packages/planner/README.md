# @virta/planner

Execution planner for Virta pipelines. Determines the optimal execution mode (Lambda, Step Functions, or Hybrid) based on pipeline structure, timing estimates, and configuration.

## Installation

```bash
pnpm add @virta/planner
```

## Usage

### Basic Planning

```typescript
import { planExecution } from "@virta/planner";
import type { PipelineDefinition } from "@virta/registry";

const pipelineDef: PipelineDefinition = {
  nodes: [
    { id: "task1", type: "task", dependsOn: [] },
    { id: "task2", type: "task", dependsOn: ["task1"] },
  ],
};

const meta = {
  task1: { timing: { p50Ms: 1000, p99Ms: 2000 } },
  task2: { timing: { p50Ms: 500, p99Ms: 1000 } },
};

const plan = planExecution(pipelineDef, meta, {
  lambdaMaxMs: 720000, // 12 minutes
});

console.log(plan.mode); // "lambda" | "step-functions" | "hybrid"
console.log(plan.criticalPath); // Critical path information
console.log(plan.reasoning); // Array of decision reasoning strings
```

### Critical Path Computation

```typescript
import { computeCriticalPath } from "@virta/planner";

const criticalPath = computeCriticalPath(pipelineDef, meta);

console.log(criticalPath.nodeIds); // ["task1", "task2", ...]
console.log(criticalPath.timing.optimisticMs); // p50 estimate
console.log(criticalPath.timing.pessimisticMs); // p99 estimate
```

## API Reference

### `planExecution(def, metaByNodeId, config)`

Plans the execution mode for a pipeline.

**Parameters:**
- `def: PipelineDefinition` - Pipeline definition
- `metaByNodeId: MetadataByNodeId` - Metadata map (node ID -> StepMetadata)
- `config: PlannerConfig` - Planner configuration

**Returns:** `ExecutionPlan` with:
- `mode: ExecutionMode` - Recommended execution mode
- `criticalPath: CriticalPath` - Critical path information
- `lambdaNodes?: NodeId[]` - For hybrid mode: nodes in Lambda
- `stepFunctionsNodes?: NodeId[]` - For hybrid mode: nodes in Step Functions
- `reasoning: string[]` - Decision reasoning

### `computeCriticalPath(def, metaByNodeId)`

Computes the critical path (longest path) through the DAG.

**Parameters:**
- `def: PipelineDefinition` - Pipeline definition
- `metaByNodeId: MetadataByNodeId` - Metadata map

**Returns:** `CriticalPath` with node IDs and timing estimates

## Execution Modes

### Lambda

Chosen when:
- No steps require Step Functions (`executionHint !== "step-functions-only"`)
- Pessimistic critical path time < safe Lambda limit

**Use cases:**
- Short-running pipelines (< 10 minutes)
- Low latency requirements
- Simple workflows

### Step Functions

Chosen when:
- At least one step requires Step Functions (`executionHint === "step-functions-only"`), or
- Pessimistic critical path time >= safe Lambda limit

**Use cases:**
- Long-running pipelines (> 10 minutes)
- Complex orchestration needs
- Steps that require Step Functions features

### Hybrid

Chosen when:
- Pessimistic time is close to Lambda limit (within 80% of safe limit)
- A good cut point can be found

**Use cases:**
- Medium-running pipelines (8-12 minutes)
- Mix of fast and slow steps
- Optimize for latency (fast prefix) and reliability (slow suffix)

## Configuration

### `PlannerConfig`

```typescript
interface PlannerConfig {
  /**
   * Maximum execution time for Lambda functions in milliseconds.
   * Default: 12 minutes (720000 ms)
   */
  lambdaMaxMs: number;

  /**
   * Fallback execution mode if planner cannot determine optimal mode.
   * Default: "lambda"
   */
  defaultExecutionMode?: ExecutionMode;

  /**
   * Safety margin as a percentage (0-1) to apply to Lambda time limits.
   * Default: 0.1 (10% safety margin)
   */
  safetyMargin?: number;
}
```

## Timing Estimates

The planner uses timing estimates from `StepMetadata`:

```typescript
interface StepMetadata {
  timing?: {
    p50Ms?: number; // Optimistic estimate (median)
    p99Ms?: number; // Pessimistic estimate (99th percentile)
  };
  executionHint?: "lambda-only" | "step-functions-only" | "auto";
}
```

**Defaults:**
- If `p50Ms` is missing: defaults to 1000ms
- If `p99Ms` is missing: defaults to 2x `p50Ms`

## Critical Path

The critical path is the longest path through the DAG from entry nodes to exit nodes, measured by execution time. The planner uses the pessimistic (p99) estimate of the critical path to make decisions.

**Example:**
```
task1 (2s) → task2 (1s) → task3 (4s)
     ↓
task4 (3s) → task5 (2s)
```

Critical path: `task1 → task2 → task3` (7s total)

## Examples

See the [examples package](../examples/README.md) for complete examples:
- `planner.ts` - Basic planner usage
- Integration with ASL, Arazzo, and BPMN workflows

## See Also

- [Virta Core](../core/README.md) - DAG engine
- [Virta Registry](../registry/README.md) - PipelineDefinition model
- [SPEC.md](../../SPEC.md) - Full specification

