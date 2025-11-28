import { describe, expect, test } from "vitest";
import { pipelineDefinitionToArazzo } from "../src/export.js";
import type { PipelineDefinition } from "@virta/registry";

describe("pipelineDefinitionToArazzo", () => {
  test("converts simple PipelineDefinition to Arazzo", () => {
    const def: PipelineDefinition = {
      nodes: [
        {
          id: "validate",
          type: "task",
          dependsOn: [],
          stepRef: "validateOrder",
        },
        {
          id: "process",
          type: "task",
          dependsOn: ["validate"],
          stepRef: "processOrder",
        },
      ],
      entryNodes: ["validate"],
    };

    const result = pipelineDefinitionToArazzo(def, "order-processing");

    expect(result.scenarios).toHaveProperty("order-processing");
    expect(result.scenarios?.["order-processing"]?.steps).toHaveLength(2);
    expect(result.scenarios?.["order-processing"]?.steps[0]?.id).toBe("validate");
    expect(result.scenarios?.["order-processing"]?.steps[0]?.type).toBe("operation");
    expect((result.scenarios?.["order-processing"]?.steps[0] as any).operationId).toBe("validateOrder");
    
    expect(result.scenarios?.["order-processing"]?.steps[1]?.id).toBe("process");
    expect((result.scenarios?.["order-processing"]?.steps[1] as any).runAfter).toEqual(["validate"]);
  });

  test("maps runAfter from dependsOn", () => {
    const def: PipelineDefinition = {
      nodes: [
        {
          id: "step1",
          type: "task",
          dependsOn: [],
          stepRef: "step1",
        },
        {
          id: "step2",
          type: "task",
          dependsOn: ["step1"],
          stepRef: "step2",
        },
      ],
    };

    const result = pipelineDefinitionToArazzo(def, "test");

    const step2 = result.scenarios?.["test"]?.steps.find((s) => s.id === "step2");
    expect(step2?.runAfter).toEqual(["step1"]);
  });

  test("converts Pass node to pass step", () => {
    const def: PipelineDefinition = {
      nodes: [
        {
          id: "passStep",
          type: "pass",
          dependsOn: [],
          stepRef: "passStep",
          config: {
            data: { message: "Hello" },
          },
        },
      ],
    };

    const result = pipelineDefinitionToArazzo(def, "test");

    const passStep = result.scenarios?.["test"]?.steps.find((s) => s.id === "passStep");
    expect(passStep?.type).toBe("pass");
    expect((passStep as any).data).toEqual({ message: "Hello" });
  });

  test("converts Choice node to switch step", () => {
    const def: PipelineDefinition = {
      nodes: [
        {
          id: "switchStep",
          type: "choice",
          dependsOn: [],
          stepRef: "switchStep",
          config: {
            expression: "$.status",
            cases: [
              { when: "active", steps: [] },
            ],
          },
        },
      ],
    };

    const result = pipelineDefinitionToArazzo(def, "test");

    const switchStep = result.scenarios?.["test"]?.steps.find((s) => s.id === "switchStep");
    expect(switchStep?.type).toBe("switch");
    expect((switchStep as any).expression).toBe("$.status");
  });

  test("preserves Arazzo-specific config", () => {
    const def: PipelineDefinition = {
      nodes: [
        {
          id: "operationStep",
          type: "task",
          dependsOn: [],
          stepRef: "operationStep",
          config: {
            operationId: "customOperation",
            path: "/api/endpoint",
            method: "POST",
            inputs: { param1: "value1" },
            outputs: { result: "$.response" },
          },
        },
      ],
    };

    const result = pipelineDefinitionToArazzo(def, "test");

    const step = result.scenarios?.["test"]?.steps[0] as any;
    expect(step.operationId).toBe("customOperation");
    expect(step.path).toBe("/api/endpoint");
    expect(step.method).toBe("POST");
    expect(step.inputs).toEqual({ param1: "value1" });
    expect(step.outputs).toEqual({ result: "$.response" });
  });

  test("adds arazzo version and info if provided", () => {
    const def: PipelineDefinition = {
      nodes: [
        {
          id: "step1",
          type: "task",
          dependsOn: [],
          stepRef: "step1",
        },
      ],
    };

    const result = pipelineDefinitionToArazzo(def, "test", {
      arazzoVersion: "1.0.0",
      info: {
        title: "Test Workflow",
        version: "1.0.0",
        description: "Test description",
      },
    });

    expect(result.arazzo).toBe("1.0.0");
    expect(result.info?.title).toBe("Test Workflow");
    expect(result.info?.version).toBe("1.0.0");
    expect(result.info?.description).toBe("Test description");
  });

  test("defaults arazzo version to 1.0.0", () => {
    const def: PipelineDefinition = {
      nodes: [
        {
          id: "step1",
          type: "task",
          dependsOn: [],
          stepRef: "step1",
        },
      ],
    };

    const result = pipelineDefinitionToArazzo(def, "test");

    expect(result.arazzo).toBe("1.0.0");
  });
});

