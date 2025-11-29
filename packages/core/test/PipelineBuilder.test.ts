import { describe, test, expect } from "vitest";
import {
  PipelineBuilder,
  buildLevels,
  runPipeline,
  type PipelineStep,
  type TransformationContext,
} from "../src/index.js";

interface TestContext {
  value?: number;
}

class StepA implements PipelineStep<unknown, TestContext> {
  execute(ctx: TransformationContext<unknown, TestContext>) {
    ctx.target.value = 1;
  }
}

class StepB implements PipelineStep<unknown, TestContext> {
  execute(ctx: TransformationContext<unknown, TestContext>) {
    ctx.target.value = (ctx.target.value || 0) + 2;
  }
}

class StepC implements PipelineStep<unknown, TestContext> {
  execute(ctx: TransformationContext<unknown, TestContext>) {
    ctx.target.value = (ctx.target.value || 0) + 3;
  }
}

describe("PipelineBuilder", () => {
  test("builds simple pipeline", () => {
    const pipeline = new PipelineBuilder<unknown, TestContext>()
      .add(StepA)
      .add(StepB, { dependsOn: [StepA] })
      .build();

    expect(pipeline.steps).toHaveLength(2);
    expect(pipeline.steps[0]?.ctor).toBe(StepA);
    expect(pipeline.steps[1]?.ctor).toBe(StepB);
    expect(pipeline.steps[1]?.dependsOn).toEqual([StepA]);
  });

  test("builds pipeline with metadata", () => {
    const pipeline = new PipelineBuilder<unknown, TestContext>()
      .add(StepA, {
        meta: {
          timing: { p50Ms: 1000, p99Ms: 2000 },
          executionHint: "lambda-only",
        },
      })
      .build();

    expect(pipeline.steps[0]?.meta?.timing?.p50Ms).toBe(1000);
    expect(pipeline.steps[0]?.meta?.timing?.p99Ms).toBe(2000);
    expect(pipeline.steps[0]?.meta?.executionHint).toBe("lambda-only");
  });

  test("builds pipeline with complex dependencies", () => {
    const pipeline = new PipelineBuilder<unknown, TestContext>()
      .add(StepA)
      .add(StepB, { dependsOn: [StepA] })
      .add(StepC, { dependsOn: [StepA] })
      .build();

    expect(pipeline.steps).toHaveLength(3);
    expect(pipeline.steps[0]?.ctor).toBe(StepA);
    expect(pipeline.steps[1]?.ctor).toBe(StepB);
    expect(pipeline.steps[2]?.ctor).toBe(StepC);
    expect(pipeline.steps[1]?.dependsOn).toEqual([StepA]);
    expect(pipeline.steps[2]?.dependsOn).toEqual([StepA]);
  });

  test("works with buildLevels", () => {
    const pipeline = new PipelineBuilder<unknown, TestContext>()
      .add(StepA)
      .add(StepB, { dependsOn: [StepA] })
      .add(StepC, { dependsOn: [StepB] })
      .build();

    const levels = buildLevels(pipeline);
    expect(levels).toHaveLength(3);
    expect(levels[0]).toEqual([StepA]);
    expect(levels[1]).toEqual([StepB]);
    expect(levels[2]).toEqual([StepC]);
  });

  test("works with runPipeline", async () => {
    const pipeline = new PipelineBuilder<unknown, TestContext>()
      .add(StepA)
      .add(StepB, { dependsOn: [StepA] })
      .build();

    const result = await runPipeline(pipeline, {
      source: {},
      target: {} as TestContext,
    });

    expect(result.status).toBe("success");
    expect(result.context.target.value).toBe(3); // 1 + 2
  });

  test("supports method chaining", () => {
    const builder = new PipelineBuilder<unknown, TestContext>();
    const result = builder
      .add(StepA)
      .add(StepB, { dependsOn: [StepA] })
      .add(StepC, { dependsOn: [StepB] })
      .build();

    expect(result.steps).toHaveLength(3);
    expect(builder).toBeInstanceOf(PipelineBuilder);
  });

  test("handles steps without dependencies", () => {
    const pipeline = new PipelineBuilder<unknown, TestContext>()
      .add(StepA)
      .add(StepB)
      .build();

    expect(pipeline.steps[0]?.dependsOn).toBeUndefined();
    expect(pipeline.steps[1]?.dependsOn).toBeUndefined();
  });

  test("handles steps without metadata", () => {
    const pipeline = new PipelineBuilder<unknown, TestContext>()
      .add(StepA)
      .build();

    expect(pipeline.steps[0]?.meta).toBeUndefined();
  });
});

