import { describe, expect, test } from "vitest";
import { arazzoToPipelineDefinition } from "../src/import.js";
import type { ArazzoDocument } from "../src/types.js";

describe("arazzoToPipelineDefinition", () => {
  test("converts simple Arazzo scenario with linear flow", () => {
    const arazzo: ArazzoDocument = {
      arazzo: "1.0.0",
      scenarios: {
        "order-processing": {
          steps: [
            {
              id: "validate",
              type: "operation",
              operationId: "validateOrder",
            },
            {
              id: "process",
              type: "operation",
              operationId: "processOrder",
              runAfter: ["validate"],
            },
          ],
        },
      },
    };

    const result = arazzoToPipelineDefinition(arazzo, "order-processing");

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0]?.id).toBe("validate");
    expect(result.nodes[0]?.type).toBe("task");
    expect(result.nodes[0]?.stepRef).toBe("validateOrder");
    expect(result.nodes[0]?.dependsOn).toEqual([]);

    expect(result.nodes[1]?.id).toBe("process");
    expect(result.nodes[1]?.type).toBe("task");
    expect(result.nodes[1]?.stepRef).toBe("processOrder");
    expect(result.nodes[1]?.dependsOn).toEqual(["validate"]);

    expect(result.entryNodes).toContain("validate");
  });

  test("converts Arazzo scenario with parallel steps", () => {
    const arazzo: ArazzoDocument = {
      scenarios: {
        "parallel-processing": {
          steps: [
            {
              id: "start",
              type: "operation",
              operationId: "start",
            },
            {
              id: "branch1",
              type: "operation",
              operationId: "branch1",
              runAfter: ["start"],
            },
            {
              id: "branch2",
              type: "operation",
              operationId: "branch2",
              runAfter: ["start"],
            },
          ],
        },
      },
    };

    const result = arazzoToPipelineDefinition(arazzo, "parallel-processing");

    expect(result.nodes).toHaveLength(3);
    const branch1 = result.nodes.find((n) => n.id === "branch1");
    const branch2 = result.nodes.find((n) => n.id === "branch2");
    
    expect(branch1?.dependsOn).toEqual(["start"]);
    expect(branch2?.dependsOn).toEqual(["start"]);
  });

  test("converts Arazzo scenario with switch step", () => {
    const arazzo: ArazzoDocument = {
      scenarios: {
        "conditional-processing": {
          steps: [
            {
              id: "check",
              type: "switch",
              expression: "$.status",
              cases: [
                {
                  when: "active",
                  steps: [{ id: "process-active", type: "operation", operationId: "processActive" }],
                },
              ],
            },
          ],
        },
      },
    };

    const result = arazzoToPipelineDefinition(arazzo, "conditional-processing");

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]?.type).toBe("choice");
  });

  test("extracts stepRef from operationId", () => {
    const arazzo: ArazzoDocument = {
      scenarios: {
        "test": {
          steps: [
            {
              id: "myStep",
              type: "operation",
              operationId: "myOperation",
            },
          ],
        },
      },
    };

    const result = arazzoToPipelineDefinition(arazzo, "test");

    expect(result.nodes[0]?.stepRef).toBe("myOperation");
  });

  test("uses step id as stepRef when operationId is missing", () => {
    const arazzo: ArazzoDocument = {
      scenarios: {
        "test": {
          steps: [
            {
              id: "myStep",
              type: "operation",
            },
          ],
        },
      },
    };

    const result = arazzoToPipelineDefinition(arazzo, "test");

    expect(result.nodes[0]?.stepRef).toBe("myStep");
  });

  test("preserves Arazzo step config", () => {
    const arazzo: ArazzoDocument = {
      scenarios: {
        "test": {
          steps: [
            {
              id: "myStep",
              type: "operation",
              operationId: "myOperation",
              inputs: { param1: "value1" },
              outputs: { result: "$.response" },
            },
          ],
        },
      },
    };

    const result = arazzoToPipelineDefinition(arazzo, "test");

    expect(result.nodes[0]?.config).toBeDefined();
    const config = result.nodes[0]?.config as any;
    expect(config.operationId).toBe("myOperation");
    expect(config.inputs).toEqual({ param1: "value1" });
    expect(config.outputs).toEqual({ result: "$.response" });
  });

  test("handles pass step", () => {
    const arazzo: ArazzoDocument = {
      scenarios: {
        "test": {
          steps: [
            {
              id: "passStep",
              type: "pass",
              data: { message: "Hello" },
            },
          ],
        },
      },
    };

    const result = arazzoToPipelineDefinition(arazzo, "test");

    const passNode = result.nodes.find((n) => n.id === "passStep");
    expect(passNode?.type).toBe("pass");
  });

  test("throws error if scenario is not found", () => {
    const arazzo: ArazzoDocument = {
      scenarios: {
        "other-scenario": {
          steps: [],
        },
      },
    };

    expect(() => arazzoToPipelineDefinition(arazzo, "missing-scenario")).toThrow(
      'Scenario "missing-scenario" not found'
    );
  });
});

