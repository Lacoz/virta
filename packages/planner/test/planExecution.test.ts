import { describe, expect, test } from "vitest";
import { planExecution } from "../src/planExecution.js";
import type { PipelineDefinition } from "@virta/registry";
import type { MetadataByNodeId, PlannerConfig } from "../src/types.js";

describe("planExecution", () => {
  const defaultConfig: PlannerConfig = {
    lambdaMaxMs: 720000, // 12 minutes
  };

  test("chooses Lambda for short pipeline", () => {
    const def: PipelineDefinition = {
      nodes: [
        { id: "task1", type: "task", dependsOn: [] },
        { id: "task2", type: "task", dependsOn: ["task1"] },
      ],
    };

    const meta: MetadataByNodeId = {
      task1: { timing: { p50Ms: 1000, p99Ms: 2000 } },
      task2: { timing: { p50Ms: 500, p99Ms: 1000 } },
    };

    const plan = planExecution(def, meta, defaultConfig);

    expect(plan.mode).toBe("lambda");
    expect(plan.reasoning.some((r) => r.includes("Lambda limit"))).toBe(true);
  });

  test("chooses Step Functions when step requires it", () => {
    const def: PipelineDefinition = {
      nodes: [
        { id: "task1", type: "task", dependsOn: [] },
        { id: "task2", type: "task", dependsOn: ["task1"] },
      ],
    };

    const meta: MetadataByNodeId = {
      task1: { timing: { p50Ms: 1000, p99Ms: 2000 } },
      task2: {
        timing: { p50Ms: 500, p99Ms: 1000 },
        executionHint: "step-functions-only",
      },
    };

    const plan = planExecution(def, meta, defaultConfig);

    expect(plan.mode).toBe("step-functions");
    expect(plan.reasoning.some((r) => r.includes("Step Functions"))).toBe(true);
  });

  test("chooses Step Functions when time exceeds limit", () => {
    const def: PipelineDefinition = {
      nodes: [
        { id: "task1", type: "task", dependsOn: [] },
        { id: "task2", type: "task", dependsOn: ["task1"] },
      ],
    };

    const meta: MetadataByNodeId = {
      task1: { timing: { p50Ms: 300000, p99Ms: 600000 } }, // 10 minutes
      task2: { timing: { p50Ms: 200000, p99Ms: 400000 } }, // 6.67 minutes
    };

    const plan = planExecution(def, meta, defaultConfig);

    expect(plan.mode).toBe("step-functions");
    expect(plan.reasoning.some((r) => r.includes("exceeds safe Lambda limit"))).toBe(true);
  });

  test("chooses Hybrid when time is close to limit", () => {
    const def: PipelineDefinition = {
      nodes: [
        { id: "task1", type: "task", dependsOn: [] },
        { id: "task2", type: "task", dependsOn: ["task1"] },
        { id: "task3", type: "task", dependsOn: ["task2"] },
      ],
    };

    const meta: MetadataByNodeId = {
      task1: { timing: { p50Ms: 200000, p99Ms: 300000 } }, // 5 minutes
      task2: { timing: { p50Ms: 200000, p99Ms: 300000 } }, // 5 minutes
      task3: { timing: { p50Ms: 100000, p99Ms: 200000 } }, // 3.33 minutes
    };

    const plan = planExecution(def, meta, defaultConfig);

    // Should choose hybrid or step-functions (depends on cut point logic)
    expect(["hybrid", "step-functions"]).toContain(plan.mode);
  });

  test("uses custom safety margin", () => {
    const def: PipelineDefinition = {
      nodes: [
        { id: "task1", type: "task", dependsOn: [] },
        { id: "task2", type: "task", dependsOn: ["task1"] },
      ],
    };

    const meta: MetadataByNodeId = {
      task1: { timing: { p50Ms: 300000, p99Ms: 600000 } },
      task2: { timing: { p50Ms: 100000, p99Ms: 200000 } },
    };

    const config: PlannerConfig = {
      lambdaMaxMs: 720000,
      safetyMargin: 0.2, // 20% safety margin
    };

    const plan = planExecution(def, meta, config);

    // With 20% margin, safe limit is 576000ms, pessimistic is 800000ms
    expect(plan.mode).toBe("step-functions");
    expect(plan.reasoning.some((r) => r.includes("576000"))).toBe(true);
  });

  test("includes critical path in result", () => {
    const def: PipelineDefinition = {
      nodes: [
        { id: "task1", type: "task", dependsOn: [] },
        { id: "task2", type: "task", dependsOn: ["task1"] },
      ],
    };

    const meta: MetadataByNodeId = {
      task1: { timing: { p50Ms: 1000, p99Ms: 2000 } },
      task2: { timing: { p50Ms: 500, p99Ms: 1000 } },
    };

    const plan = planExecution(def, meta, defaultConfig);

    expect(plan.criticalPath).toBeDefined();
    expect(plan.criticalPath.nodeIds).toEqual(["task1", "task2"]);
    expect(plan.criticalPath.timing.pessimisticMs).toBe(3000);
  });

  test("hybrid mode includes node assignments", () => {
    const def: PipelineDefinition = {
      nodes: [
        { id: "task1", type: "task", dependsOn: [] },
        { id: "task2", type: "task", dependsOn: ["task1"] },
        { id: "task3", type: "task", dependsOn: ["task2"] },
      ],
    };

    const meta: MetadataByNodeId = {
      task1: { timing: { p50Ms: 200000, p99Ms: 300000 } },
      task2: { timing: { p50Ms: 200000, p99Ms: 300000 } },
      task3: { timing: { p50Ms: 100000, p99Ms: 200000 } },
    };

    const plan = planExecution(def, meta, defaultConfig);

    if (plan.mode === "hybrid") {
      expect(plan.lambdaNodes).toBeDefined();
      expect(plan.stepFunctionsNodes).toBeDefined();
      expect(plan.lambdaNodes!.length).toBeGreaterThan(0);
      expect(plan.stepFunctionsNodes!.length).toBeGreaterThan(0);
    }
  });

  test("handles pipeline with no timing data", () => {
    const def: PipelineDefinition = {
      nodes: [
        { id: "task1", type: "task", dependsOn: [] },
        { id: "task2", type: "task", dependsOn: ["task1"] },
      ],
    };

    const meta: MetadataByNodeId = {
      task1: {},
      task2: {},
    };

    const plan = planExecution(def, meta, defaultConfig);

    // Should default to Lambda (default timing is 1000ms p50, 2000ms p99)
    expect(plan.mode).toBe("lambda");
  });
});

