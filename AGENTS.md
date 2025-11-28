# Virta Contributor Guidance

This file applies to the entire repository. Follow these rules when updating code or docs:

- **Core principles:** Preserve the TypeScript DAG engine model (constructor-based step identity, `buildLevels` for topological ordering, `runPipeline` with hooks and `PipelineResult`). Keep workflow semantics compatible with ASL, Arazzo, and BPMN import/export.
- **Round-trip formats:** When touching workflow IO, maintain parity across ASL, Arazzo, and BPMN. Imported BPMN models should map tasks/gateways into DAG steps; exported BPMN must preserve parallelism and dependencies.
- **Compatibility matrix & validation:** Keep the workflow compatibility matrix in `README.md` current. Each adapter package should maintain conformance fixtures and validators that assert supported/unsupported elements for ASL, Arazzo, and BPMN.
- **Planner expectations:** Execution planning must support Lambda, Step Functions, and hybrid modes. Keep metadata (`executionHint`, timing) available for decisions.
- **Docs:** Keep repository docs aligned with the current architecture and workflow support when you make changes.
- **Testing:** Prefer fast, local checks. For TypeScript packages, run targeted unit tests or linting relevant to the area you modify.
- **Tooling:** Use secure development practices. For TypeScript packages, ensure proper linting and type checking.
- **Commits & releases:** Use semantic commit messages (e.g., `feat: add BPMN import`) and follow semantic versioning when cutting releases.
