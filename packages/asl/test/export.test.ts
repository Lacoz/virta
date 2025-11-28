import { describe, expect, test } from "vitest";
import { pipelineDefinitionToAsl } from "../src/export.js";
import type { PipelineDefinition } from "@virta/registry";

describe("pipelineDefinitionToAsl", () => {
  test("converts simple PipelineDefinition to ASL", () => {
    const def: PipelineDefinition = {
      nodes: [
        {
          id: "validate",
          type: "task",
          dependsOn: [],
          stepRef: "validate",
        },
        {
          id: "process",
          type: "task",
          dependsOn: ["validate"],
          stepRef: "process",
        },
      ],
      entryNodes: ["validate"],
    };

    const result = pipelineDefinitionToAsl(def);

    expect(result.StartAt).toBe("validate");
    expect(result.States).toHaveProperty("validate");
    expect(result.States).toHaveProperty("process");
    expect(result.States.validate?.Type).toBe("Task");
    expect(result.States.process?.Type).toBe("Task");
    expect(result.States.validate?.Next).toBe("process");
    expect(result.States.process?.End).toBe(true);
  });

  test("uses custom resource mapper", () => {
    const def: PipelineDefinition = {
      nodes: [
        {
          id: "myStep",
          type: "task",
          dependsOn: [],
          stepRef: "myStep",
        },
      ],
      entryNodes: ["myStep"],
    };

    const result = pipelineDefinitionToAsl(def, {
      resourceMapper: (stepRef) => `arn:aws:lambda:us-west-2:999999999999:function:${stepRef}`,
    });

    const state = result.States.myStep as any;
    expect(state.Resource).toBe("arn:aws:lambda:us-west-2:999999999999:function:myStep");
  });

  test("converts Pass state", () => {
    const def: PipelineDefinition = {
      nodes: [
        {
          id: "passState",
          type: "pass",
          dependsOn: [],
          stepRef: "passState",
          config: {
            Type: "Pass",
            Result: { message: "Hello" },
          },
        },
      ],
      entryNodes: ["passState"],
    };

    const result = pipelineDefinitionToAsl(def);

    expect(result.States.passState?.Type).toBe("Pass");
    const passState = result.States.passState as any;
    expect(passState.Result).toEqual({ message: "Hello" });
  });

  test("preserves ASL-specific config from node config", () => {
    const def: PipelineDefinition = {
      nodes: [
        {
          id: "taskWithRetry",
          type: "task",
          dependsOn: [],
          stepRef: "taskWithRetry",
          config: {
            Type: "Task",
            TimeoutSeconds: 60,
            Retry: [
              {
                ErrorEquals: ["States.ALL"],
                IntervalSeconds: 2,
                MaxAttempts: 3,
              },
            ],
          },
        },
      ],
      entryNodes: ["taskWithRetry"],
    };

    const result = pipelineDefinitionToAsl(def);

    const taskState = result.States.taskWithRetry as any;
    expect(taskState.TimeoutSeconds).toBe(60);
    expect(taskState.Retry).toBeDefined();
    expect(taskState.Retry[0]?.ErrorEquals).toEqual(["States.ALL"]);
  });

  test("handles multiple entry nodes", () => {
    const def: PipelineDefinition = {
      nodes: [
        {
          id: "start1",
          type: "task",
          dependsOn: [],
          stepRef: "start1",
        },
        {
          id: "start2",
          type: "task",
          dependsOn: [],
          stepRef: "start2",
        },
      ],
      entryNodes: ["start1", "start2"],
    };

    const result = pipelineDefinitionToAsl(def);

    // Should use first entry node as StartAt
    expect(result.StartAt).toBe("start1");
  });

  test("adds comment and version if provided", () => {
    const def: PipelineDefinition = {
      nodes: [
        {
          id: "start",
          type: "task",
          dependsOn: [],
          stepRef: "start",
        },
      ],
      entryNodes: ["start"],
    };

    const result = pipelineDefinitionToAsl(def, {
      comment: "Test workflow",
      version: "1.0",
    });

    expect(result.Comment).toBe("Test workflow");
    expect(result.Version).toBe("1.0");
  });
});

