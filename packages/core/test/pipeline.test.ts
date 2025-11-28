import { describe, expect, test, vi } from "vitest";

import {
  buildLevels,
  runPipeline,
  type PipelineDefinition,
  type PipelineStep,
  type TransformationContext,
} from "../src";

type TestContext = {
  order: string[];
  greeting?: string;
};

class StepA implements PipelineStep<unknown, TestContext> {
  execute(ctx: TransformationContext<unknown, TestContext>) {
    ctx.target.order.push("A");
  }
}

class StepB implements PipelineStep<unknown, TestContext> {
  async execute(ctx: TransformationContext<unknown, TestContext>) {
    ctx.target.order.push("B");
  }
}

class StepC implements PipelineStep<unknown, TestContext> {
  execute(ctx: TransformationContext<unknown, TestContext>) {
    ctx.target.order.push("C");
  }
}

class StopStep implements PipelineStep<unknown, TestContext> {
  execute(ctx: TransformationContext<unknown, TestContext>) {
    ctx.target.order.push("STOP");
    ctx.stopPipeline = true;
  }
}

class FailingStep implements PipelineStep<unknown, TestContext> {
  execute() {
    throw new Error("boom");
  }
}

describe("buildLevels", () => {
  test("groups dependency-satisfied constructors into levels", () => {
    const definition: PipelineDefinition<unknown, TestContext> = {
      steps: [
        { ctor: StepA },
        { ctor: StepB, dependsOn: [StepA] },
        { ctor: StepC, dependsOn: [StepB] },
      ],
    };

    const levels = buildLevels(definition);

    expect(levels).toEqual([[StepA], [StepB], [StepC]]);
  });

  test("throws when a dependency is not registered", () => {
    class MissingDependency {}

    const definition: PipelineDefinition<unknown, TestContext> = {
      steps: [
        { ctor: StepA },
        { ctor: StepB, dependsOn: [StepA, MissingDependency as unknown as typeof StepA] },
      ],
    };

    expect(() => buildLevels(definition)).toThrowError("Step dependency not registered");
  });
});

describe("runPipeline", () => {
  test("executes hooks and respects stopPipeline flag", async () => {
    const hooks = {
      onLevelStart: vi.fn(),
      onLevelComplete: vi.fn(),
      onStepStart: vi.fn(),
      onStepSuccess: vi.fn(),
      onPipelineComplete: vi.fn(),
    };

    const definition: PipelineDefinition<unknown, TestContext> = {
      steps: [
        { ctor: StepA },
        { ctor: StopStep, dependsOn: [StepA] },
        { ctor: StepC, dependsOn: [StopStep] },
      ],
    };

    const result = await runPipeline(definition, {
      source: {},
      target: { order: [] },
      hooks,
    });

    expect(result.status).toBe("stopped");
    expect(result.context.target.order).toEqual(["A", "STOP"]);
    expect(result.executedSteps).toEqual([StepA, StopStep]);
    expect(result.completedLevels).toHaveLength(2);

    expect(hooks.onLevelStart).toHaveBeenCalledTimes(2);
    expect(hooks.onLevelComplete).toHaveBeenCalledTimes(2);
    expect(hooks.onStepStart).toHaveBeenCalledTimes(2);
    expect(hooks.onStepSuccess).toHaveBeenCalledTimes(2);
    expect(hooks.onPipelineComplete).toHaveBeenCalledWith(result);
  });

  test("captures errors and halts subsequent levels", async () => {
    const definition: PipelineDefinition<unknown, TestContext> = {
      steps: [
        { ctor: StepA },
        { ctor: FailingStep, dependsOn: [StepA] },
        { ctor: StepC, dependsOn: [FailingStep] },
      ],
    };

    const result = await runPipeline(definition, {
      source: {},
      target: { order: [] },
    });

    expect(result.status).toBe("error");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.step).toBe(FailingStep);
    expect(result.executedSteps).toEqual([StepA]);
    expect(result.completedLevels).toHaveLength(2);
    expect(result.context.target.order).toEqual(["A"]);
  });
});
