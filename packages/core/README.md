# @virta/core

Virta's core DAG pipeline engine. It provides the foundational types and utilities described in [SPEC.md](../../SPEC.md):

- `TransformationContext` shared across steps
- constructor-based `PipelineStep` identity and `RegisteredStep` metadata
- `buildLevels` to group dependency-satisfied steps for parallel execution
- `runPipeline` with lifecycle hooks returning a structured `PipelineResult`
- `PipelineBuilder` for fluent pipeline construction (optional)

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

## PipelineBuilder (Optional)

The `PipelineBuilder` provides a fluent API for constructing pipelines:

```ts
import { PipelineBuilder } from "@virta/core";

const definition = new PipelineBuilder<unknown, { user?: string; greeting?: string }>()
  .add(FetchUser)
  .add(GreetUser, { dependsOn: [FetchUser] })
  .build();

const result = await runPipeline(definition, {
  source: {},
  target: {},
});
```

The builder creates the same `PipelineDefinition` as the explicit approach. Both methods are equally valid - choose based on preference.

## Testing

Use pnpm workspaces to run the Vitest suite for this package:

```
pnpm -C packages/core test
```
