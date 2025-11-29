import { describe, expect, test } from "vitest";
import { computeCriticalPath } from "../src/criticalPath.js";
import type { PipelineDefinition } from "@virta/registry";
import type { MetadataByNodeId } from "../src/types.js";

describe("computeCriticalPath", () => {
  test("computes critical path for linear pipeline", () => {
    const def: PipelineDefinition = {
      nodes: [
        { id: "task1", type: "task", dependsOn: [] },
        { id: "task2", type: "task", dependsOn: ["task1"] },
        { id: "task3", type: "task", dependsOn: ["task2"] },
      ],
    };

    const meta: MetadataByNodeId = {
      task1: { timing: { p50Ms: 1000, p99Ms: 2000 } },
      task2: { timing: { p50Ms: 500, p99Ms: 1000 } },
      task3: { timing: { p50Ms: 2000, p99Ms: 4000 } },
    };

    const result = computeCriticalPath(def, meta);

    expect(result.nodeIds).toEqual(["task1", "task2", "task3"]);
    expect(result.timing.optimisticMs).toBe(3500); // 1000 + 500 + 2000
    expect(result.timing.pessimisticMs).toBe(7000); // 2000 + 1000 + 4000
  });

  test("computes critical path for parallel branches", () => {
    const def: PipelineDefinition = {
      nodes: [
        { id: "start", type: "task", dependsOn: [] },
        { id: "branch1", type: "task", dependsOn: ["start"] },
        { id: "branch2", type: "task", dependsOn: ["start"] },
        { id: "end", type: "task", dependsOn: ["branch1", "branch2"] },
      ],
    };

    const meta: MetadataByNodeId = {
      start: { timing: { p50Ms: 100, p99Ms: 200 } },
      branch1: { timing: { p50Ms: 1000, p99Ms: 2000 } }, // Longer branch
      branch2: { timing: { p50Ms: 500, p99Ms: 1000 } },
      end: { timing: { p50Ms: 100, p99Ms: 200 } },
    };

    const result = computeCriticalPath(def, meta);

    // Critical path should be start -> branch1 -> end
    expect(result.nodeIds).toContain("start");
    expect(result.nodeIds).toContain("branch1");
    expect(result.nodeIds).toContain("end");
    expect(result.timing.pessimisticMs).toBe(2400); // 200 + 2000 + 200
  });

  test("uses default timing when metadata is missing", () => {
    const def: PipelineDefinition = {
      nodes: [
        { id: "task1", type: "task", dependsOn: [] },
        { id: "task2", type: "task", dependsOn: ["task1"] },
      ],
    };

    const meta: MetadataByNodeId = {
      task1: {}, // No timing
      task2: { timing: { p50Ms: 500 } }, // Only p50
    };

    const result = computeCriticalPath(def, meta);

    expect(result.nodeIds).toEqual(["task1", "task2"]);
    // task1: default 1000ms (p50), 2000ms (p99 = 2x p50)
    // task2: 500ms (p50), 1000ms (p99 = 2x p50)
    expect(result.timing.optimisticMs).toBe(1500);
    expect(result.timing.pessimisticMs).toBe(3000);
  });

  test("handles single node pipeline", () => {
    const def: PipelineDefinition = {
      nodes: [{ id: "task1", type: "task", dependsOn: [] }],
    };

    const meta: MetadataByNodeId = {
      task1: { timing: { p50Ms: 1000, p99Ms: 2000 } },
    };

    const result = computeCriticalPath(def, meta);

    expect(result.nodeIds).toEqual(["task1"]);
    expect(result.timing.optimisticMs).toBe(1000);
    expect(result.timing.pessimisticMs).toBe(2000);
  });

  test("throws error for pipeline with no entry nodes", () => {
    const def: PipelineDefinition = {
      nodes: [
        { id: "task1", type: "task", dependsOn: ["task2"] },
        { id: "task2", type: "task", dependsOn: ["task1"] },
      ],
    };

    const meta: MetadataByNodeId = {
      task1: { timing: { p50Ms: 1000 } },
      task2: { timing: { p50Ms: 1000 } },
    };

    expect(() => computeCriticalPath(def, meta)).toThrow("no entry nodes");
  });

  test("respects explicit entry nodes", () => {
    const def: PipelineDefinition = {
      nodes: [
        { id: "task1", type: "task", dependsOn: [] },
        { id: "task2", type: "task", dependsOn: ["task1"] },
        { id: "task3", type: "task", dependsOn: [] }, // Also no deps, but not in entryNodes
      ],
      entryNodes: ["task1"],
    };

    const meta: MetadataByNodeId = {
      task1: { timing: { p50Ms: 1000, p99Ms: 2000 } },
      task2: { timing: { p50Ms: 500, p99Ms: 1000 } },
      task3: { timing: { p50Ms: 5000, p99Ms: 10000 } },
    };

    const result = computeCriticalPath(def, meta);

    // Should only consider task1 -> task2 path (task3 is not an entry node)
    expect(result.nodeIds).toEqual(["task1", "task2"]);
  });
});


