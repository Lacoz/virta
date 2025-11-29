## Execution planning
An execution planner selects the right deployment model per pipeline:
- Inline **AWS Lambda** for simple or latency-sensitive pipelines.
- **AWS Step Functions** for orchestrated workflows.
- **Hybrid** splits when some steps need orchestration and others prefer inline execution.

## Unified Runner & Fallback
The `@virta/runner` package provides a unified execution API with automatic fallback:
- **Lambda-first execution** attempts to run in Lambda (or local simulation).
- **Runtime monitoring** detects approaching timeouts.
- **Automatic fallback** migrates execution to Step Functions (via hybrid split) or Fargate if needed.
- **Local simulation** via `docker-local` adapter using `docker-lambda` and `docker-step-functions`.
