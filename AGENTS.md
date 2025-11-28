# Virta Contributor Guidance

This file applies to the entire repository. Follow these rules when updating code or docs:

- **Core principles:** Preserve the TypeScript DAG engine model from `spec.md` (constructor-based step identity, `buildLevels` for topological ordering, `runPipeline` with hooks and `PipelineResult`). Keep workflow semantics compatible with ASL, Arazzo, and BPMN import/export.
- **Round-trip formats:** When touching workflow IO, maintain parity across ASL, Arazzo, and BPMN. Imported BPMN models should map tasks/gateways into DAG steps; exported BPMN must preserve parallelism and dependencies.
- **Planner expectations:** Execution planning must support Lambda, Step Functions, and hybrid modes. Keep metadata (`executionHint`, timing) available for decisions.
- **Docs:** If you change architecture or workflow support, update `spec.md` to stay aligned with the rules above.
- **Testing:** Prefer fast, local checks. For TypeScript packages, run targeted unit tests or linting relevant to the area you modify.
- **Tooling:** Use the dev container (`.devcontainer/devcontainer.json`) for an isolated, least-privilege environment. Do not relax the security flags (`cap-drop=ALL`, `no-new-privileges`).
