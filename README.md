# Virta

Virta is a TypeScript-based **DAG workflow and pipeline engine** focused on portability, round-trip workflow interoperability, and secure tooling for AI-assisted development.

For a detailed technical reference covering the DAG engine, workflow formats, and tooling expectations, see [`SPEC.md`](SPEC.md).

## Core capabilities
- **Pure TypeScript runtime** with constructor-based step identity and parallel execution across DAG levels.
- **Topological planning** via `buildLevels` to group dependency-satisfied steps that can run in parallel.
- **Hooked pipeline runner** (`runPipeline`) that surfaces lifecycle events and returns structured `PipelineResult` status.

## Workflow formats
Virta intentionally supports multiple representations so teams can exchange workflows with external systems:
- **Amazon States Language (ASL)** ([docs](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-amazon-states-language.html)) import/export.
- **Arazzo** ([spec](https://spec.openapis.org/arazzo/v1.0.0)) import/export.
- **BPMN 2.0** ([OMG spec](https://www.omg.org/spec/BPMN/2.0)) process import/export to interoperate with BPM tools while preserving DAG semantics.
- **JSONata** ([docs](https://jsonata.org/)) for inside-step transformations.

## Execution planning
An execution planner selects the right deployment model per pipeline:
- Inline **AWS Lambda** for simple or latency-sensitive pipelines.
- **AWS Step Functions** for orchestrated workflows.
- **Hybrid** splits when some steps need orchestration and others prefer inline execution.

## MCP server (optional)
Virta can be exposed through an MCP server so LLM tools and IDE agents can introspect and operate pipelines:
- Tools include listing pipelines, retrieving definitions, previewing plans, running pipelines, and exporting/importing ASL, Arazzo, or BPMN.
- Suggested package name: `@virta/mcp-server`.

## Repository layout (proposed)
Monorepo packages are organized to keep the core runtime separate from format adapters and infra tooling (scoped packages prefa
ced with `@virta/`):
- `packages/@virta/core` — DAG engine (`TransformationContext`, `PipelineStep`, `buildLevels`, `runPipeline`).
- `packages/@virta/registry` — registration utilities and `PipelineDefinition` conversion helpers.
- `packages/@virta/jsonata` — JSONata helpers for step-level transformations.
- `packages/@virta/asl`, `packages/@virta/arazzo`, `packages/@virta/bpmn` — import/export adapters for ASL, Arazzo, and BPMN.
- `packages/@virta/planner` — critical path analysis and execution mode selection.
- `packages/@virta/cdk` — CDK/projen infrastructure generators for Lambda/Step Functions deployments.
- `packages/@virta/mcp-server` — MCP tooling surface for pipelines.
- `packages/@virta/examples` — sample pipelines and demos.

## Development environment
Use the devcontainer for isolated, least-privilege development:
- Node.js **24 LTS** base image with pnpm available.
- Security flags keep the container non-root with `cap-drop=ALL` and `no-new-privileges` by default.
- Recommended extensions: ESLint, Prettier, and workspace trust enabled for TypeScript tooling.
