# Virta — Technical Specification (Draft)

**Virta** is a TypeScript-based **DAG workflow & pipeline engine**.

It provides:

-   a **pure TypeScript core** (no vendor lock-in),
    
-   **parallel step execution** of independent steps,
    
-   support for **multiple workflow definition formats** (import/export unless noted):

    -   **Amazon States Language (ASL)** ([docs](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-amazon-states-language.html)),

    -   **Arazzo** ([spec](https://spec.openapis.org/arazzo/v1.0.0)),

    -   **BPMN 2.0** ([OMG spec](https://www.omg.org/spec/BPMN/2.0)) for process import/export mapped to DAG semantics,

    -   **JSONata** ([docs](https://jsonata.org/)) inside-step transformations,
        
-   an **execution planner** that can decide between:

    -   inline **AWS Lambda** execution,

    -   **AWS Step Functions**,

    -   or a **hybrid** split (part Lambda, part Step Functions),

-   an optional **MCP server** so LLM tools (ChatGPT, IDE agents…) can inspect, plan, and execute pipelines.


> **Name**: _Virta_ — Finnish for _flow / current_.

## Workflow compatibility matrix (import/export fidelity)

| Capability / Feature                          | ASL (AWS Step Functions) | Arazzo                           | BPMN 2.0                                  |
|-----------------------------------------------|--------------------------|----------------------------------|-------------------------------------------|
| DAG task graph (steps + dependencies)         | ✅ Full                  | ✅ Full                          | ✅ Full (tasks/gateways mapped to DAG nodes) |
| Parallel branches                             | ✅ Parallel state        | ✅ `parallel` block              | ✅ Parallel gateways                       |
| Conditional choice                            | ✅ Choice state          | ✅ `switch`/`when`               | ✅ Exclusive gateways                      |
| Loop/repeat constructs                        | ⚠️ Limited (`Map`, `Retry`) | ⚠️ Limited (`loop` / bounded)    | ⚠️ Limited (bounded loops; no unbounded `while`)   |
| Timers / waits                                | ✅ Wait state            | ✅ `sleep`                       | ✅ Intermediate timer events               |
| Error handling & retries                      | ✅ `Catch` / `Retry`      | ✅ `on_error`                     | ✅ Boundary events (mapped to retries/compensation) |
| Data mapping / expressions                    | ✅ Pass/Parameters       | ✅ Inputs/Outputs (JSONata)      | ✅ Data objects (JSONata inside tasks)     |
| Human tasks / forms                           | ❌ Not modeled           | ❌ Not modeled                   | ⚠️ Partial (import/export only for service tasks)  |
| Vendor-specific extensions                    | ⚠️ Partial (`States.*`)  | ⚠️ Partial (custom blocks)       | ⚠️ Partial (drops non-mappable extensions)         |

Round-trip intent: import/export fidelity is measured against this matrix; unsupported elements are dropped or downgraded with explicit warnings. Each adapter package ships fixtures and validators to flag gaps when formats evolve.

## 1\. Core: TypeScript DAG Pipeline Engine

### 1.1 Core Types

#### `TransformationContext`

Shared, mutable context passed to all steps:

```ts
type TransformationContext<S, T> = {
  source: S;
  target: T;
  stopPipeline?: boolean;
  error?: unknown;
};
```

-   `source`: original input entity (e.g. `Account`, `Event`, `Message`).
    
-   `target`: accumulated result (e.g. DTO, command object).
    
-   `stopPipeline`: when set to `true` by a step, no further levels execute.
    
-   `error`: optional captured error information.
    

#### `PipelineStep`

Each step is a class implementing:

```ts
interface PipelineStep<S, T> {
  execute(ctx: TransformationContext<S, T>): Promise<void> | void;
}
```

-   No string `name` property is required.
    
-   Step identity is based on the **class constructor** (the `ctor`).
    

#### `StepCtor` and `RegisteredStep`

Steps are registered with the engine along with their dependencies and metadata:

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

Notes:

-   **No string IDs** inside the core; only `StepCtor` references.
    
-   `dependsOn` defines the DAG edges.
    
-   `meta` holds planner-related / operational metadata (used by the execution planner).
    

### 1.2 DAG Construction: `buildLevels`

The core engine needs an execution plan (levels) derived from `RegisteredStep[]`.

```ts
function buildLevels<S, T>(steps: RegisteredStep<S, T>[]): RegisteredStep<S, T>[][];
```

Responsibilities:

-   Performs a **topological sort** of steps based on `dependsOn`.
    
-   Detects **dependency cycles** and throws an error if found.
    
-   Groups steps into **levels**, where:
    
    -   All steps in the same level have all their dependencies satisfied,
        
    -   Steps in the same level can run in **parallel**.
        

### 1.3 Pipeline Runner: `runPipeline`

#### Hooks

Hooks allow monitoring, logging, metrics, etc:

```ts
interface PipelineHooks<S, T> {
  beforePipeline?(ctx: TransformationContext<S, T>): void | Promise<void>;
  afterPipeline?(result: PipelineResult<S, T>): void | Promise<void>;
  beforeStep?(step: PipelineStep<S, T>, ctx: TransformationContext<S, T>): void | Promise<void>;
  afterStep?(step: PipelineStep<S, T>, ctx: TransformationContext<S, T>): void | Promise<void>;
  onError?(step: PipelineStep<S, T>, error: unknown, ctx: TransformationContext<S, T>): void | Promise<void>;
}
```

#### Result

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

-   `success`: all levels executed without error and `stopPipeline` was never set.
    
-   `stopped`: a step set `stopPipeline = true`, so further execution was intentionally halted.
    
-   `error`: a step threw an unhandled error (after configured retries), and the pipeline stopped.
    

#### Runner API

```ts
async function runPipeline<S, T>(
  steps: RegisteredStep<S, T>[],
  ctx: TransformationContext<S, T>,
  hooks?: PipelineHooks<S, T>
): Promise<PipelineResult<S, T>>;
```

Behavior:

-   Uses `buildLevels` to compute `RegisteredStep[][]`.
    
-   Executes levels **sequentially**.
    
-   Executes steps **in parallel** inside each level via `Promise.all`.
    
-   Observes `ctx.stopPipeline`:
    
    -   If set in any step, the runner stops executing further levels.
        
-   Error handling:
    
    -   Catches errors from `execute`.
        
    -   Invokes `hooks.onError` if provided.
        
    -   Sets `PipelineResult.status = "error"` and `errorStep`.
        
-   Optional retry mechanism:
    
    -   Implemented via a small `runStepWithRetry` wrapper.
        
    -   Driven by configuration (global or per-step).
        

Implementation detail(s) like retry strategy are configurable and not hard-coded in this spec.

## 2\. Intermediate DAG Model: `PipelineDefinition`

To support multiple external workflow formats (ASL, Arazzo, custom JSON/YAML), Virta uses an intermediate DAG structure.

```ts
type NodeId = string;

interface PipelineNodeDefinition {
  id: NodeId;
  type: "task" | "parallel" | "choice" | "pass";
  dependsOn: NodeId[];
  stepRef?: string; // external id used to resolve TS steps via registry
  config?: any; // raw config for this node (ASL state, Arazzo step, etc.)
}

interface PipelineDefinition {
  nodes: PipelineNodeDefinition[];
  entryNodes?: NodeId[];
}
```

Conversion to core:

```ts
function pipelineDefinitionToRegisteredSteps<S, T>(
  def: PipelineDefinition,
  registry: StepRegistry<S, T>
): RegisteredStep<S, T>[];
```

Responsibilities:

-   Look up `stepRef` via `StepRegistry`.
    
-   Convert node dependencies (`dependsOn` as NodeId) into `StepCtor[]`.
    
-   Attach metadata (e.g., from `config` or external metadata stores).
    

## 3\. Step Registry

External formats (ASL, Arazzo, JSON configs) refer to steps via string IDs.  
Virta resolves these to actual TypeScript step classes via a registry.

```ts
class StepRegistry<S, T> {
  private map = new Map<string, StepCtor<S, T>>();

  register(id: string, ctor: StepCtor<S, T>) {
    this.map.set(id, ctor);
  }

  resolve(id: string): StepCtor<S, T> {
    const ctor = this.map.get(id);
    if (!ctor) {
      throw new Error(`Unknown stepRef: ${id}`);
    }
    return ctor;
  }
}
```

-   Multiple modules/packages can contribute step registrations.
    
-   The registry is used by adapters (ASL, Arazzo, custom formats) to build `RegisteredStep[]` from `PipelineDefinition`.
    

## 4\. JSONata Integration

JSONata is used as **an expression language inside steps**, not as a workflow DSL.

Package: `@virta/jsonata`.

### 4.1 JSONata-Based Step

Example of a generic step that applies a JSONata expression:

```ts
class JsonataStep<S, T> implements PipelineStep<S, T> {
  constructor(private expression: string) {}

  async execute(ctx: TransformationContext<S, T>) {
    const input = { source: ctx.source, target: ctx.target };

    // pseudocode:
    // const result = jsonata(this.expression).evaluate(input);
    // ctx.target = merge(ctx.target, result);
  }
}
```

Possible extensions:

-   Steps can read JSONata expression from `PipelineNodeDefinition.config`.
    
-   JSONata can be used for mapping and enrichment logic.
    
-   Optional: JSONata for boolean conditions in future choice nodes.
    

## 5\. Amazon States Language (ASL) Integration

Virta supports **import and export** of workflows defined in **Amazon States Language** ([docs](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-amazon-states-language.html)).

Package: `@virta/asl`.

### 5.1 ASL → `PipelineDefinition` (Import)

```ts
function aslToPipelineDefinition(aslJson: any): PipelineDefinition;
```

Responsibilities:

-   Iterate over `aslJson.States`.
    
-   For each state:
    
    -   Create a `PipelineNodeDefinition` with:
        
        -   `id`: state name,
            
        -   `type`: derived from `Type`:
            
            -   `Task` → `"task"`
                
            -   `Pass` → `"pass"`
                
            -   `Choice` → `"choice"`
                
            -   `Parallel` → `"parallel"`
                
        -   `config`: raw state configuration,
            
        -   `stepRef`: mapping from the state’s `Resource` or other field to an internal step ID.
            
-   Derive `dependsOn` relationships by inverting:
    
    -   `Next` chains,
        
    -   `Parallel` branch entries,
        
    -   optional `Catch` transitions (if modeled).
        

### 5.2 `PipelineDefinition` → ASL (Export)

```ts
function pipelineDefinitionToAsl(def: PipelineDefinition): any; // returns ASL JSON
```

Used for:

-   Generating ASL definitions for AWS Step Functions.
    
-   Documentation / visualization of Virta workflows in AWS-native tools.
    

Implementation details (e.g., how to map custom node types to ASL patterns) can evolve independently.

## 6\. Arazzo Integration

[Arazzo](https://spec.openapis.org/arazzo/v1.0.0) defines workflows over OpenAPI operations.

Virta uses Arazzo as another **full workflow specification format**.

Package: `@virta/arazzo`.

### 6.1 Arazzo → `PipelineDefinition` (Import)

```ts
function arazzoToPipelineDefinition(
  arazzoJson: any,
  scenarioName: string
): PipelineDefinition;
```

Mapping strategy:

-   Look up a `scenario` by `scenarioName`.
    
-   For each scenario step:
    
    -   `id` → `PipelineNodeDefinition.id`
        
    -   `runAfter` (or similar field) → `dependsOn`
        
    -   `operationId` (or equivalent) → `stepRef`
        
    -   additional OpenAPI/HTTP details → `config`.
        

### 6.2 Optional Export

Optionally Virta can export its internal DAG to Arazzo to:

-   Provide human-readable documentation.
    
-   Allow external tools to consume Virta workflows via standardized formats.
    

## 7. BPMN 2.0 Integration

[BPMN 2.0](https://www.omg.org/spec/BPMN/2.0) is supported for **import/export** to interoperate with business process tooling while preserving DAG semantics.

Package: `@virta/bpmn`.

### 7.1 BPMN → `PipelineDefinition` (Import)

```ts
function bpmnToPipelineDefinition(bpmnXml: string): PipelineDefinition;
```

Mapping strategy:

-   Parse the BPMN XML model and identify **tasks** (service/user tasks mapped to `"task"`) and **gateways** (exclusive/parallel mapped to `"choice"`/`"parallel"`).
-   Translate sequence flows into `dependsOn` relationships, preserving branch joins and splits.
-   Carry over data objects or extension elements into `config` for downstream adapters.

### 7.2 `PipelineDefinition` → BPMN (Export)

```ts
function pipelineDefinitionToBpmn(def: PipelineDefinition): string; // BPMN XML
```

Use cases:

-   Enable BPMN-native visualization and documentation of Virta DAGs.
-   Round-trip pipelines where non-mappable extensions are dropped with warnings.

### 7.3 Round-Trip Validation

-   The BPMN adapter should ship **fixtures and validators** that cover tasks, parallel/exclusive gateways, timers, and error handlers aligned with the workflow compatibility matrix in `README.md`.
-   Warnings should surface when BPMN-specific constructs (e.g., ad-hoc subprocesses, event subprocesses, message correlations) cannot map cleanly to DAG semantics.

## 8. Execution Planner (Lambda vs Step Functions vs Hybrid)

The **planner** decides how a given Virta pipeline should run in AWS.

Package: `@virta/planner`.

### 7.1 Inputs

-   `PipelineDefinition` + `StepMetadata` per node/step.
    
-   Derived or persisted metrics:
    
    -   per-step execution times (p50, p95, p99).
        
-   Configuration, for example:
    

```ts
interface PlannerConfig {
  lambdaMaxMs: number; // e.g. 12 * 60_000
  defaultExecutionMode?: ExecutionMode; // fallback policy
}

type ExecutionMode = "lambda" | "step-functions" | "hybrid";
```

### 7.2 Critical Path Computation

The planner computes:

-   **Critical path** through the DAG:
    
    -   longest path (in sum of times) from entry to exit.
        
-   Two estimates per pipeline:
    
    -   **optimistic**: sum of per-step `p50Ms`,
        
    -   **pessimistic**: sum of per-step `p99Ms`.
        

These estimates are used to decide which execution strategy is safe given Lambda time limits and reliability constraints.

### 7.3 Decision Logic (High Level)

```ts
function planExecution(
  def: PipelineDefinition,
  metaByNodeId: Record<string, StepMetadata>,
  config: PlannerConfig
): ExecutionMode;
```

Suggested rules:

-   **Lambda**:
    
    -   No steps with `executionHint = "step-functions-only"`.
        
    -   Pessimistic critical path (`p99`) < `lambdaMaxMs` (e.g. 12 minutes).
        
-   **Step Functions**:
    
    -   At least one step with `executionHint = "step-functions-only"`, or
        
    -   `p99` of critical path is too close to or above safe Lambda limit.
        
-   **Hybrid**:
    
    -   It is possible to choose a “cut point”:
        
        -   prefix of DAG runs in Lambda,
            
        -   suffix runs via Step Functions.
            
    -   Planner may produce more detailed info:
        
        -   which nodes belong to Lambda vs Step Functions.
            

## 9. Runtime Timeout Handling (Lambda Runtime)

When Virta pipelines run **inside AWS Lambda**, the runner uses hooks to measure step runtimes:

-   `beforeStep`:
    
    -   record a timestamp per step.
        
-   `afterStep`:
    
    -   compute `durationMs`,
        
    -   update telemetry (e.g. CloudWatch, custom metrics store).
        

If a step:

-   throws a timeout-specific error (e.g. `StepTimeoutError`), or
    
-   exceeds a configured threshold,
    

the Lambda runtime will:

1.  Mark the step as “timed out” or “over budget”.
    
2.  Publish an event, for example via EventBridge:
    

```json
{
  "type": "step.timeout",
  "pipelineId": "customer-onboarding",
  "stepId": "GenerateBigReport",
  "durationMs": 910000,
  "lambdaRequestId": "..."
}
```

The planner consumes these events and:

-   updates per-step statistics (p50/p95/p99),
    
-   may revise `executionHint` or recommended `ExecutionMode`,
    
-   can trigger infra migration (Lambda → Step Functions, or vice versa).
    

## 10. Infrastructure Regeneration (CDK / projen)

Virta does **not** embed AWS-specific logic directly in the core engine.  
Instead, an integration package uses **AWS CDK** (optionally with **projen**) to generate infra stacks based on planner decisions.

Package: `@virta/cdk`.

### 9.1 Modes

Given:

-   `PipelineDefinition`,
    
-   chosen `ExecutionMode`,
    
-   environment config,
    

the CDK generator can produce:

1.  **Lambda-only stack**
    
    -   One Lambda function that:
        
        -   loads pipeline config,
            
        -   calls `runPipeline`,
            
        -   returns result.
            
2.  **Step Functions stack**
    
    -   An ASL state machine generated from `PipelineDefinition`.
        
    -   Lambda tasks or service integrations representing nodes.
        
3.  **Hybrid stack**
    
    -   Lambda function executes a prefix of the pipeline.
        
    -   At a chosen cut point, Lambda starts a Step Functions execution.
        
    -   Step Functions executes remaining nodes.
        

### 9.2 Planner + Infra Integration

A possible workflow:

-   Planner receives timeout/performance events.
    
-   Planner runs `planExecution`.
    
-   If execution mode changes (Lambda → Step Functions or vice versa):
    
    -   planner updates CDK/projen definitions.
        
    -   A CI/CD pipeline deploys the updated stack (manual review or auto).
        

The exact automation level (auto PR vs auto deploy) is configurable and outside the core engine.

## 11. MCP Server (Optional)

Virta can be exposed via an **MCP server** so LLM tools and IDE agents can introspect and operate on pipelines.

Package: `@virta/mcp-server`.

### 10.1 Example MCP Tools

-   `list_pipelines`  
    Returns available pipeline IDs and metadata.
    
-   `get_pipeline_definition`  
    Returns `PipelineDefinition` as JSON.
    
-   `run_pipeline_preview`  
    Evaluates plan (critical path, estimated times, recommended execution mode) without executing steps.
    
-   `run_pipeline`  
    Executes a pipeline for a given `pipelineId` and `source` payload.  
    Returns `PipelineResult` summary.
    
-   `plan_execution`  
    Directly calls the planner to determine `ExecutionMode` and optional details (e.g. suggested split).
    
-   `export_asl`  
    Returns ASL JSON for a pipeline.
    
-   `export_arazzo`
    Returns Arazzo scenario JSON/YAML.

-   `export_bpmn`
    Returns BPMN 2.0 XML for a pipeline.

-   `import_asl` / `import_arazzo` / `import_bpmn`
    Register or update Virta pipelines from external specs.
    

This allows:

-   ChatGPT-like tools to inspect Virta DAGs and explain them.
    
-   Assisted editing and refactoring of workflows.
    
-   Execution and testing from within IDEs or AI tooling.
    

## 12. Suggested Monorepo Layout

Top-level repo name: `virta` (or `virta-flow` if needed for uniqueness). Directory names remain unscoped (`packages/core`), while `package.json` names use the scoped `@virta/*` convention that matches common TypeScript/Node package naming.

```
virta/
  packages/
    core/         # package name @virta/core — core DAG engine (ctx, PipelineStep, buildLevels, runPipeline)
    registry/     # package name @virta/registry — StepRegistry, PipelineDefinition <-> RegisteredStep utils
    jsonata/      # package name @virta/jsonata — JSONata-based steps and helpers
    asl/          # package name @virta/asl — ASL <-> PipelineDefinition import/export
    arazzo/       # package name @virta/arazzo — Arazzo <-> PipelineDefinition import/export
    bpmn/         # package name @virta/bpmn — BPMN <-> PipelineDefinition import/export with validators
    planner/      # package name @virta/planner — critical path, timing, ExecutionMode decisions
    cdk/          # package name @virta/cdk — CDK/projen-based infra generators
    mcp-server/   # package name @virta/mcp-server — MCP server exposing Virta as tools
    examples/     # package name @virta/examples — example pipelines, AWS demos, docs samples
```

Build / tooling (to be decided):

-   Package manager: `pnpm` / `npm` / `yarn`.
    
-   Build: `tsc`, `tsup`, or `esbuild`.
    
-   Monorepo tooling: `pnpm workspaces`, `nx`, or `turborepo`.
    
-   Infra code generation: `projen` + `aws-cdk`.
    

## 13. Open Decisions (for Future Design Discussion)

These aspects are **intentionally left open** so they can be decided later:

1.  **Core build toolchain**
    
    -   Only `tsc`, or bundler (tsup/esbuild/rollup).
        
    -   Node.js minimum runtime version.
        
2.  **JSONata integration details**
    
    -   Which JSONata runtime library.
        
    -   How to sandbox expressions and configure resource limits.
        
3.  **ASL mapping depth**
    
    -   Whether all Virta features must be ASL-compatible.
        
    -   How to handle `Choice`, `Map`, `Parallel` states in detail.
        
4.  **Arazzo integration scope**
    
    -   Is Arazzo only an import format, or full round-trip (export + import)?
        
    -   How tightly Arazzo should be coupled with OpenAPI spec resolution.
        
5.  **Planner aggressiveness**
    
    -   Conservative vs aggressive auto-migration Lambda ↔ Step Functions.
        
    -   Manual vs automatic override of execution modes by operators.
        
6.  **MCP server deployment**
    
    -   Local/dev only, or also running in cloud alongside Virta workloads.
        
7.  **CDK change management**
    
    -   Auto-generated PRs vs fully automated infra changes.
        
    -   Versioning and rollout strategy for migrating existing pipelines.
        

_This specification defines Virta’s architecture and responsibilities at a high level.  
Implementation details (APIs, config shapes, retry/backoff strategies, logging formats) can be refined iteratively once the core packages are scaffolded._
