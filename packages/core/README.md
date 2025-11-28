# @virta/core

Virta's core DAG pipeline engine. It provides the foundational types and utilities described in [SPEC.md](../../SPEC.md):

- `TransformationContext` shared across steps
- constructor-based `PipelineStep` identity and `RegisteredStep` metadata
- `buildLevels` to group dependency-satisfied steps for parallel execution
- `runPipeline` with lifecycle hooks returning a structured `PipelineResult`

## Usage

```ts
import { buildLevels, runPipeline, type PipelineDefinition, type PipelineStep } from "@virta/core";

// Define steps using class constructors for identity
class FetchUser implements PipelineStep<unknown, { user?: string }> {
  async execute(ctx) {
    ctx.target.user = "alice";
  }
}

class GreetUser implements PipelineStep<unknown, { user?: string; greeting?: string }> {
  execute(ctx) {
    ctx.target.greeting = `hello, ${ctx.target.user}`;
  }
}

const definition: PipelineDefinition<unknown, { user?: string; greeting?: string }> = {
  steps: [
    { ctor: FetchUser },
    { ctor: GreetUser, dependsOn: [FetchUser] },
  ],
};

const levels = buildLevels(definition);
// => [[FetchUser], [GreetUser]]

const result = await runPipeline(definition, {
  source: {},
  target: {},
});

console.log(result.status); // "success"
console.log(result.context.target.greeting); // "hello, alice"
```

## Testing

Use pnpm workspaces to run the Vitest suite for this package:

```
pnpm -C packages/core test
```
