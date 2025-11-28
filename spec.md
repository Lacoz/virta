# Virta — Technical Specification (Draft)

Virta is a TypeScript-based **DAG workflow and pipeline engine** designed to keep the core runtime portable while offering multiple workflow definition formats.

## Overview

Virta provides:

- A **pure TypeScript core** (no vendor lock-in).
- **Parallel execution** for independent steps in a DAG.
- Support for **multiple workflow definition formats**, including JSONata (inside-step transformations), Amazon States Language (ASL), Arazzo (OpenAPI-based API workflows), and **BPMN** for **import/export** interoperability.
- An **execution planner** that can choose between inline **AWS Lambda**, **AWS Step Functions**, or a **hybrid** split deployment.
- An optional **MCP server** so LLM tools (ChatGPT, IDE agents, etc.) can inspect, plan, and execute pipelines.

> **Name**: _Virta_ — Finnish for _flow / current_.

## 1. Core: TypeScript DAG Pipeline Engine

### 1.1 Core Types

**`TransformationContext`** — shared, mutable context passed to all steps:

```ts
type TransformationContext<S, T> = {
  source: S;
  target: T;
  stopPipeline?: boolean;
  error?: unknown;
};
```

- `source`: original input entity (e.g., `Account`, `Event`, `Message`).
- `target`: accumulated result (e.g., DTO, command object).
- `stopPipeline`: when set to `true`, no further levels execute.
- `error`: optional captured error information.

**`PipelineStep`** — contract for each step:

```ts
interface PipelineStep<S, T> {
  execute(ctx: TransformationContext<S, T>): Promise<void> | void;
}
```

- No string `name` is required.
- Step identity is based on the **class constructor**.

**`StepCtor` and `RegisteredStep`** — registration metadata and dependencies:

```ts
type StepCtor<S, T> = new () => PipelineStep<S, T>;

interface StepMetadata {
  executionHint?: "lambda-only" | "step-functions-only" | "auto";
  timing?: {
    p50Ms?: number; // optimistic estimate or learned metric
    p99Ms?: number; // pessimistic estimate or SLO-bound
  };
  // future: tags, ownership, cost profile, etc.
}

interface RegisteredStep<S, T> {
  ctor: StepCtor<S, T>;
  dependsOn?: StepCtor<S, T>[]; // DAG edges using class references
  meta?: StepMetadata;
}
```

- **No string IDs** inside the core; only `StepCtor` references.
- `dependsOn` defines the DAG edges.
- `meta` holds planner-related / operational metadata.

### 1.2 DAG Construction: `buildLevels`

The engine produces execution levels from registered steps.

```ts
function buildLevels<S, T>(steps: RegisteredStep<S, T>[]): RegisteredStep<S, T>[][];
```

Responsibilities:

- Perform a **topological sort** based on `dependsOn`.
- Detect **dependency cycles** and throw an error if found.
- Group steps into **levels** where:
  - All steps in the same level have all dependencies satisfied.
  - Steps in the same level can run **in parallel**.

### 1.3 Pipeline Runner: `runPipeline`

**Hooks** enable monitoring, logging, and metrics:

```ts
interface PipelineHooks<S, T> {
  beforePipeline?(ctx: TransformationContext<S, T>): void | Promise<void>;
  afterPipeline?(result: PipelineResult<S, T>): void | Promise<void>;
  beforeStep?(step: PipelineStep<S, T>, ctx: TransformationContext<S, T>): void | Promise<void>;
  afterStep?(step: PipelineStep<S, T>, ctx: TransformationContext<S, T>): void | Promise<void>;
  onError?(step: PipelineStep<S, T>, error: unknown, ctx: TransformationContext<S, T>): void | Promise<void>;
}
```

**Result** — status and captured context:

```ts
type PipelineStatus = "success" | "stopped" | "error";

interface PipelineResult<S, T> {
  status: PipelineStatus;
  completedSteps: string[];
  skippedSteps: string[];
  errorStep?: string;
  error?: unknown;
  ctx: TransformationContext<S, T>;
}
```

- `success`: all levels executed without error and `stopPipeline` was never set.
- `stopped`: a step set `stopPipeline = true`, so further execution halted intentionally.
- `error`: a step threw an unhandled error (after configured retries), and the pipeline stopped.

## 2. Execution Planning and Deployment

The planner chooses how a pipeline executes:

- **Inline AWS Lambda** execution.
- **AWS Step Functions** orchestration.
- **Hybrid** mode (a split between Lambda and Step Functions).

If execution mode changes (Lambda → Step Functions or vice versa):

- The planner updates CDK/projen definitions.
- A CI/CD pipeline deploys the updated stack (manual review or automated).
- Automation level (auto PR vs. auto deploy) is configurable and outside the core engine.

## 3. Workflow Definition Formats

Virta intentionally supports multiple representations for interoperability:

- **JSONata** for inside-step transformations.
- **Amazon States Language (ASL)** import/export.
- **Arazzo** (OpenAPI-based API workflows) import/export.
- **BPMN process import/export** (conceptually aligned with ASL/Arazzo) to exchange processes with BPM tools; imported models should map BPMN tasks/gateways into Virta DAG steps, and exported models should preserve parallelism and dependencies without losing DAG semantics.

## 4. MCP Server (Optional)

Virta can be exposed via an **MCP server** so LLM tools and IDE agents can introspect and operate on pipelines. Suggested package: `@virta/mcp-server` (alias: `virta-mcp-server`).

### 4.1 Example MCP Tools

- `list_pipelines`: returns available pipeline IDs and metadata.
- `get_pipeline_definition`: returns `PipelineDefinition` as JSON.
- `run_pipeline_preview`: evaluates plan (critical path, estimated times, recommended execution mode) without executing steps.
- `run_pipeline`: executes a pipeline for a given `pipelineId` and `source` payload; returns `PipelineResult` summary.
- `plan_execution`: calls the planner to determine `ExecutionMode` and optional details (e.g., suggested split).
- `export_asl`: returns ASL JSON for a pipeline.
- `export_arazzo`: returns Arazzo scenario JSON/YAML.
- `export_bpmn`: returns BPMN 2.0 XML for a pipeline (mirrors ASL/Arazzo export intent to interoperate with BPM suites).
- `import_asl` / `import_arazzo` / `import_bpmn`: register or update Virta pipelines from external specs.

This allows:

- ChatGPT-like tools to inspect Virta DAGs and explain them.
- Assisted editing and refactoring of workflows.
- Execution and testing from within IDEs or AI tooling.

## 5. Suggested Monorepo Layout

Top-level repo name: `virta` (or `virta-flow` if needed for uniqueness).

```
virta/
  packages/
    @virta/core           # core DAG engine (ctx, PipelineStep, buildLevels, runPipeline)
    @virta/registry       # StepRegistry, PipelineDefinition <-> RegisteredStep utils
    @virta/jsonata        # JSONata-based steps and helpers
    @virta/asl            # ASL <-> PipelineDefinition import/export
    @virta/arazzo         # Arazzo <-> PipelineDefinition import/export
    @virta/bpmn           # BPMN <-> PipelineDefinition export/import helpers
    @virta/planner        # critical path, timing, ExecutionMode decisions
    @virta/cdk            # CDK/projen-based infra generators
    @virta/mcp-server     # MCP server exposing Virta as tools
    @virta/examples       # example pipelines, AWS demos, docs samples
```

Build / tooling (to be decided):

- Package manager: `pnpm` / `npm` / `yarn`.
- Build: `tsc`, `tsup`, or `esbuild`.
- Monorepo tooling: `pnpm workspaces`, `nx`, or `turborepo`.
- Infra code generation: `projen` + `aws-cdk`.

## 6. Open Decisions (for Future Design Discussion)

These aspects are intentionally left open to decide later:

1. **Core build toolchain**
   - Only `tsc`, or bundler (tsup/esbuild/rollup).
   - Node.js minimum runtime version.

2. **JSONata integration details**
   - Which JSONata runtime library.
   - How to sandbox expressions and configure resource limits.

3. **ASL mapping depth**
   - Whether all Virta features must be ASL-compatible.
   - How to handle `Choice`, `Map`, `Parallel` states in detail.

4. **Arazzo and BPMN integration scope**
   - Define the minimum **round-trip** (import + export) fidelity for each format.
   - How tightly Arazzo should be coupled with OpenAPI spec resolution.
   - Which BPMN elements (tasks, gateways, subprocesses, error events) are in-scope for import, and how to represent parallelism and error handling while preserving DAG semantics.

5. **Planner aggressiveness**
   - Conservative vs. aggressive auto-migration Lambda ↔ Step Functions.
   - Manual vs. automatic override of execution modes by operators.

6. **MCP server deployment**
   - Local/dev only, or also running in cloud alongside Virta workloads.

7. **CDK change management**
   - Auto-generated PRs vs. fully automated infra changes.
   - Versioning and rollout strategy for migrating existing pipelines.

_This specification defines Virta’s architecture and responsibilities at a high level. Implementation details (APIs, config shapes, retry/backoff strategies, logging formats) can be refined iteratively once the core packages are scaffolded._
