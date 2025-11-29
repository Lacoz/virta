# @virta/runner

Unified execution runner for Virta pipelines with support for multiple environments and automatic fallback strategies.

## Features

- **Unified API**: Single `run()` entry point for all execution modes.
- **Adapters**:
  - `lambda`: AWS Lambda execution (direct).
  - `step-functions`: AWS Step Functions execution (orchestrated).
  - `hybrid`: Split execution (Lambda prefix + Step Functions suffix).
  - `fargate`: AWS Fargate execution (direct).
  - `docker-local`: Local simulation using `docker-lambda` and `docker-step-functions`.
  - `in-memory`: Local Node.js execution.
- **Runtime Utilities**: Timeout monitoring, execution checkpointing.
- **Automatic Fallback**: Lambda -> Hybrid -> Fargate chain on timeout risk.

## Usage

```typescript
import { run } from "@virta/runner";
import { myPipelineDef } from "./pipeline";

// Run with auto-detection or specific mode
const result = await run(myPipelineDef, {
  source: { ... },
  target: { ... },
  executionMode: "auto" // Uses fallback chain
});
```

## Docker Simulation

To use the `docker-local` adapter, ensure you have Docker running and the `docker-compose.yml` services up:

```bash
docker-compose up -d
```

Then run your pipeline with `executionMode: "docker-local"`.

