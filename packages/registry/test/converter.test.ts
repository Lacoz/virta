import { describe, expect, test } from "vitest";
import type {
  PipelineStep,
  TransformationContext,
  RegisteredStep,
} from "@virta/core";
import { StepRegistry } from "../src/StepRegistry.js";
import {
  pipelineDefinitionToRegisteredSteps,
  registeredStepsToPipelineDefinition,
} from "../src/converter.js";
import type { PipelineDefinition } from "../src/PipelineDefinition.js";

type TestContext = {
  order: string[];
};

class StepA implements PipelineStep<unknown, TestContext> {
  execute(ctx: TransformationContext<unknown, TestContext>) {
    ctx.target.order.push("A");
  }
}

class StepB implements PipelineStep<unknown, TestContext> {
  execute(ctx: TransformationContext<unknown, TestContext>) {
    ctx.target.order.push("B");
  }
}

class StepC implements PipelineStep<unknown, TestContext> {
  execute(ctx: TransformationContext<unknown, TestContext>) {
    ctx.target.order.push("C");
  }
}

describe("pipelineDefinitionToRegisteredSteps", () => {
  test("converts PipelineDefinition to RegisteredStep[]", () => {
    const registry = new StepRegistry<unknown, TestContext>();
    registry.register("stepA", StepA);
    registry.register("stepB", StepB);

    const definition: PipelineDefinition = {
      nodes: [
        { id: "node1", type: "task", dependsOn: [], stepRef: "stepA" },
        { id: "node2", type: "task", dependsOn: ["node1"], stepRef: "stepB" },
      ],
    };

    const steps = pipelineDefinitionToRegisteredSteps(definition, registry);

    expect(steps).toHaveLength(2);
    expect(steps[0]?.ctor).toBe(StepA);
    expect(steps[0]?.dependsOn).toBeUndefined();
    expect(steps[1]?.ctor).toBe(StepB);
    expect(steps[1]?.dependsOn).toEqual([StepA]);
  });

  test("handles multiple dependencies", () => {
    const registry = new StepRegistry<unknown, TestContext>();
    registry.register("stepA", StepA);
    registry.register("stepB", StepB);
    registry.register("stepC", StepC);

    const definition: PipelineDefinition = {
      nodes: [
        { id: "node1", type: "task", dependsOn: [], stepRef: "stepA" },
        { id: "node2", type: "task", dependsOn: [], stepRef: "stepB" },
        {
          id: "node3",
          type: "task",
          dependsOn: ["node1", "node2"],
          stepRef: "stepC",
        },
      ],
    };

    const steps = pipelineDefinitionToRegisteredSteps(definition, registry);

    expect(steps).toHaveLength(3);
    const stepC = steps.find((s) => s.ctor === StepC);
    expect(stepC?.dependsOn).toEqual([StepA, StepB]);
  });

  test("extracts metadata from config", () => {
    const registry = new StepRegistry<unknown, TestContext>();
    registry.register("stepA", StepA);

    const definition: PipelineDefinition = {
      nodes: [
        {
          id: "node1",
          type: "task",
          dependsOn: [],
          stepRef: "stepA",
          config: {
            metadata: {
              executionHint: "lambda-only",
              timing: {
                p50Ms: 10,
                p99Ms: 50,
              },
            },
          },
        },
      ],
    };

    const steps = pipelineDefinitionToRegisteredSteps(definition, registry);

    expect(steps[0]?.meta?.executionHint).toBe("lambda-only");
    expect(steps[0]?.meta?.timing?.p50Ms).toBe(10);
    expect(steps[0]?.meta?.timing?.p99Ms).toBe(50);
  });

  test("throws error if stepRef is missing", () => {
    const registry = new StepRegistry<unknown, TestContext>();
    registry.register("stepA", StepA);

    const definition: PipelineDefinition = {
      nodes: [
        { id: "node1", type: "task", dependsOn: [], stepRef: "stepA" },
        { id: "node2", type: "task", dependsOn: ["node1"] }, // Missing stepRef
      ],
    };

    expect(() =>
      pipelineDefinitionToRegisteredSteps(definition, registry)
    ).toThrow('Node "node2" has no stepRef');
  });

  test("throws error if stepRef cannot be resolved", () => {
    const registry = new StepRegistry<unknown, TestContext>();

    const definition: PipelineDefinition = {
      nodes: [
        { id: "node1", type: "task", dependsOn: [], stepRef: "unknown" },
      ],
    };

    expect(() =>
      pipelineDefinitionToRegisteredSteps(definition, registry)
    ).toThrow("Unknown stepRef: unknown");
  });

  test("throws error if dependency node is not found", () => {
    const registry = new StepRegistry<unknown, TestContext>();
    registry.register("stepA", StepA);

    const definition: PipelineDefinition = {
      nodes: [
        {
          id: "node1",
          type: "task",
          dependsOn: ["missing"],
          stepRef: "stepA",
        },
      ],
    };

    expect(() =>
      pipelineDefinitionToRegisteredSteps(definition, registry)
    ).toThrow('Node "node1" depends on "missing" which is not found');
  });
});

describe("registeredStepsToPipelineDefinition", () => {
  test("converts RegisteredStep[] to PipelineDefinition", () => {
    const registry = new StepRegistry<unknown, TestContext>();
    registry.register("stepA", StepA);
    registry.register("stepB", StepB);

    const steps: RegisteredStep<unknown, TestContext>[] = [
      { ctor: StepA },
      { ctor: StepB, dependsOn: [StepA] },
    ];

    const definition = registeredStepsToPipelineDefinition(steps, registry);

    expect(definition.nodes).toHaveLength(2);
    expect(definition.nodes[0]?.stepRef).toBe("stepA");
    expect(definition.nodes[0]?.dependsOn).toEqual([]);
    expect(definition.nodes[1]?.stepRef).toBe("stepB");
    expect(definition.nodes[1]?.dependsOn).toEqual(["stepA"]);
  });

  test("identifies entry nodes", () => {
    const registry = new StepRegistry<unknown, TestContext>();
    registry.register("stepA", StepA);
    registry.register("stepB", StepB);
    registry.register("stepC", StepC);

    const steps: RegisteredStep<unknown, TestContext>[] = [
      { ctor: StepA },
      { ctor: StepB },
      { ctor: StepC, dependsOn: [StepA, StepB] },
    ];

    const definition = registeredStepsToPipelineDefinition(steps, registry);

    expect(definition.entryNodes).toContain("stepA");
    expect(definition.entryNodes).toContain("stepB");
    expect(definition.entryNodes).not.toContain("stepC");
  });

  test("preserves metadata in config", () => {
    const registry = new StepRegistry<unknown, TestContext>();
    registry.register("stepA", StepA);

    const steps: RegisteredStep<unknown, TestContext>[] = [
      {
        ctor: StepA,
        meta: {
          executionHint: "lambda-only",
          timing: { p50Ms: 10, p99Ms: 50 },
        },
      },
    ];

    const definition = registeredStepsToPipelineDefinition(steps, registry);

    expect(definition.nodes[0]?.config).toBeDefined();
    const config = definition.nodes[0]?.config as Record<string, unknown>;
    expect(config.metadata).toBeDefined();
  });

  test("throws error if step constructor is not registered", () => {
    const registry = new StepRegistry<unknown, TestContext>();
    // StepA is not registered

    const steps: RegisteredStep<unknown, TestContext>[] = [
      { ctor: StepA },
    ];

    expect(() =>
      registeredStepsToPipelineDefinition(steps, registry)
    ).toThrow("is not registered in the registry");
  });

  test("handles round-trip conversion", () => {
    const registry = new StepRegistry<unknown, TestContext>();
    registry.register("stepA", StepA);
    registry.register("stepB", StepB);
    registry.register("stepC", StepC);

    const originalSteps: RegisteredStep<unknown, TestContext>[] = [
      { ctor: StepA },
      { ctor: StepB, dependsOn: [StepA] },
      { ctor: StepC, dependsOn: [StepA, StepB] },
    ];

    // Convert to PipelineDefinition
    const definition = registeredStepsToPipelineDefinition(
      originalSteps,
      registry
    );

    // Convert back to RegisteredStep[]
    const convertedSteps = pipelineDefinitionToRegisteredSteps(
      definition,
      registry
    );

    // Verify structure is preserved
    expect(convertedSteps).toHaveLength(3);
    expect(convertedSteps[0]?.ctor).toBe(StepA);
    expect(convertedSteps[1]?.ctor).toBe(StepB);
    expect(convertedSteps[1]?.dependsOn).toEqual([StepA]);
    expect(convertedSteps[2]?.ctor).toBe(StepC);
    expect(convertedSteps[2]?.dependsOn).toEqual([StepA, StepB]);
  });
});


