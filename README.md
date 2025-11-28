# Virta

Virta is a TypeScript-based **DAG workflow and pipeline engine** focused on portability, round-trip workflow interoperability, and secure tooling for AI-assisted development. See [SPEC.md](SPEC.md) for the full technical specification.

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

### Workflow compatibility matrix
| Capability / Feature                          | ASL (AWS Step Functions) | Arazzo                           | BPMN 2.0                                          |
|-----------------------------------------------|--------------------------|----------------------------------|---------------------------------------------------|
| DAG task graph (steps + dependencies)         | ✅ Full                  | ✅ Full                          | ✅ Full (tasks/gateways mapped to DAG nodes)       |
| Parallel branches                             | ✅ Parallel state        | ✅ `parallel` block              | ✅ Parallel gateways                               |
| Conditional choice                            | ✅ Choice state          | ✅ `switch`/`when`               | ✅ Exclusive gateways                              |
| Loop/repeat constructs                        | ⚠️ Limited (`Map`, `Retry`) | ⚠️ Limited (`loop` / bounded)    | ⚠️ Limited (bounded loops; no unbounded `while`)   |
| Timers / waits                                | ✅ Wait state            | ✅ `sleep`                       | ✅ Intermediate timer events                       |
| Error handling & retries                      | ✅ `Catch` / `Retry`      | ✅ `on_error`                     | ✅ Boundary events (mapped to retries/compensation) |
| Data mapping / expressions                    | ✅ Pass/Parameters       | ✅ Inputs/Outputs (JSONata)      | ✅ Data objects (JSONata inside tasks)             |
| Human tasks / forms                           | ❌ Not modeled           | ❌ Not modeled                   | ⚠️ Partial (import/export only for service tasks)  |
| Vendor-specific extensions                    | ⚠️ Partial (`States.*`)  | ⚠️ Partial (custom blocks)       | ⚠️ Partial (drops non-mappable extensions)         |

Round-trip intent: import/export fidelity is measured against this matrix; unsupported elements are dropped or downgraded with explicit warnings. A conformance validator (per adapter package) will exercise feature-coverage fixtures to flag gaps when formats evolve.

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
Monorepo packages are organized to keep the core runtime separate from format adapters and infra tooling. Folder names stay unscoped (e.g., `packages/core`), while `package.json` names use the scoped `@virta/*` convention common across TypeScript/Node libraries:
- `packages/core` (`@virta/core`) — DAG engine (`TransformationContext`, `PipelineStep`, `buildLevels`, `runPipeline`).
- `packages/registry` (`@virta/registry`) — registration utilities and `PipelineDefinition` conversion helpers.
- `packages/jsonata` (`@virta/jsonata`) — JSONata helpers for step-level transformations.
- `packages/asl`, `packages/arazzo`, `packages/bpmn` (`@virta/asl`, `@virta/arazzo`, `@virta/bpmn`) — import/export adapters for ASL, Arazzo, and BPMN.
- `packages/planner` (`@virta/planner`) — critical path analysis and execution mode selection.
- `packages/cdk` (`@virta/cdk`) — CDK/projen infrastructure generators for Lambda/Step Functions deployments.
- `packages/mcp-server` (`@virta/mcp-server`) — MCP tooling surface for pipelines.
- `packages/examples` (`@virta/examples`) — sample pipelines and demos.

## Development environment

### Workspace scripts (pnpm)
- `pnpm install` to restore dependencies.
- `pnpm -r build` / `pnpm -r lint` to build and type-check all packages.
- `pnpm -r test` to run package-level test suites (e.g., `@virta/core`).

### Versioning and releases
Changes are versioned with [Changesets](https://github.com/changesets/changesets):
- Run `pnpm changeset` to record package-specific change notes.
- Run `pnpm version:packages` to apply pending changesets and update package versions across the monorepo.
- Run `pnpm release` to publish updated packages after builds/tests succeed.

### Publishing to GitHub Packages
Virta packages publish under the `@virta` scope to GitHub Packages:
1. Authenticate with a token that has the `packages:write` scope: `export GITHUB_TOKEN=<gh_token>`.
2. Use the repo `.npmrc` (scope registry is already set to `https://npm.pkg.github.com`).
3. Run validation before publishing: `pnpm -r lint` and `pnpm -r test`.
4. Create a changeset for each package that should release: `pnpm changeset`.
5. Apply the versions: `pnpm version:packages` (this updates `package.json` files and changelogs).
6. Publish to GitHub Packages: `pnpm release`.

To ship the current `@virta/core` build first, add the changeset noted above, then run steps 5 and 6 to push the package to GitHub Packages.

### GitHub Actions release automation
Releases can also run via CI with the `Release packages` workflow. On pushes to `main`, the workflow:
- installs dependencies with pnpm on Node.js 24, runs `pnpm -r lint` and `pnpm -r test`, and then invokes `changesets/action@v1` with `pnpm version:packages` / `pnpm release`.
- uses `secrets.GITHUB_TOKEN` for both repository writes and publishing to `npm.pkg.github.com` (the `.npmrc` expects `GITHUB_TOKEN`).

When there are unpublished changesets, the workflow opens a release PR. Merging that PR triggers the publish step to GitHub Packages with the updated versions and changelogs.
