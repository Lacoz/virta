import { describe, expect, test } from "vitest";
import { pipelineDefinitionToBpmn } from "../src/export.js";
import type { PipelineDefinition } from "@virta/registry";

describe("pipelineDefinitionToBpmn", () => {
  test("converts simple PipelineDefinition to BPMN XML", async () => {
    const def: PipelineDefinition = {
      nodes: [
        {
          id: "task1",
          type: "task",
          dependsOn: [],
          stepRef: "task1",
        },
        {
          id: "task2",
          type: "task",
          dependsOn: ["task1"],
          stepRef: "task2",
        },
      ],
      entryNodes: ["task1"],
    };

    const result = await pipelineDefinitionToBpmn(def);

    expect(result).toContain("<?xml");
    expect(result).toContain("bpmn:definitions");
    expect(result).toContain("task1");
    expect(result).toContain("task2");
    expect(result).toContain("bpmn:sequenceFlow");
  });

  test("includes process name if provided", async () => {
    const def: PipelineDefinition = {
      nodes: [
        {
          id: "task1",
          type: "task",
          dependsOn: [],
          stepRef: "task1",
        },
      ],
    };

    const result = await pipelineDefinitionToBpmn(def, {
      processName: "My Custom Process",
    });

    expect(result).toContain("My Custom Process");
  });

  test("converts choice node to exclusive gateway", async () => {
    const def: PipelineDefinition = {
      nodes: [
        {
          id: "choice1",
          type: "choice",
          dependsOn: [],
          stepRef: "choice1",
        },
      ],
    };

    const result = await pipelineDefinitionToBpmn(def);

    expect(result).toContain("exclusiveGateway");
    expect(result).toContain("choice1");
  });

  test("converts parallel node to parallel gateway", async () => {
    const def: PipelineDefinition = {
      nodes: [
        {
          id: "parallel1",
          type: "parallel",
          dependsOn: [],
          stepRef: "parallel1",
        },
      ],
    };

    const result = await pipelineDefinitionToBpmn(def);

    expect(result).toContain("parallelGateway");
    expect(result).toContain("parallel1");
  });

  test("creates sequence flows from dependencies", async () => {
    const def: PipelineDefinition = {
      nodes: [
        {
          id: "task1",
          type: "task",
          dependsOn: [],
          stepRef: "task1",
        },
        {
          id: "task2",
          type: "task",
          dependsOn: ["task1"],
          stepRef: "task2",
        },
      ],
    };

    const result = await pipelineDefinitionToBpmn(def);

    // Should contain sequence flow connecting task1 to task2
    expect(result).toContain("sequenceFlow");
    // Should have start and end events
    expect(result).toContain("startEvent");
    expect(result).toContain("endEvent");
  });

  test("handles multiple entry nodes", async () => {
    const def: PipelineDefinition = {
      nodes: [
        {
          id: "task1",
          type: "task",
          dependsOn: [],
          stepRef: "task1",
        },
        {
          id: "task2",
          type: "task",
          dependsOn: [],
          stepRef: "task2",
        },
      ],
      entryNodes: ["task1", "task2"],
    };

    const result = await pipelineDefinitionToBpmn(def);

    expect(result).toContain("task1");
    expect(result).toContain("task2");
  });
});

