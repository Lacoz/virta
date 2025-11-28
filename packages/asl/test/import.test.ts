import { describe, expect, test } from "vitest";
import { aslToPipelineDefinition } from "../src/import.js";
import type { AslStateMachine } from "../src/types.js";

describe("aslToPipelineDefinition", () => {
  test("converts simple ASL state machine with linear flow", () => {
    const asl: AslStateMachine = {
      StartAt: "ValidateOrder",
      States: {
        ValidateOrder: {
          Type: "Task",
          Resource: "arn:aws:lambda:us-east-1:123456789012:function:ValidateOrder",
          Next: "ProcessOrder",
        },
        ProcessOrder: {
          Type: "Task",
          Resource: "arn:aws:lambda:us-east-1:123456789012:function:ProcessOrder",
          End: true,
        },
      },
    };

    const result = aslToPipelineDefinition(asl);

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0]?.id).toBe("ValidateOrder");
    expect(result.nodes[0]?.type).toBe("task");
    expect(result.nodes[0]?.stepRef).toBe("ValidateOrder");
    expect(result.nodes[0]?.dependsOn).toEqual([]);

    expect(result.nodes[1]?.id).toBe("ProcessOrder");
    expect(result.nodes[1]?.type).toBe("task");
    expect(result.nodes[1]?.stepRef).toBe("ProcessOrder");
    expect(result.nodes[1]?.dependsOn).toEqual(["ValidateOrder"]);

    expect(result.entryNodes).toContain("ValidateOrder");
  });

  test("converts ASL with parallel branches", () => {
    const asl: AslStateMachine = {
      StartAt: "Start",
      States: {
        Start: {
          Type: "Pass",
          Next: "ParallelProcessing",
        },
        ParallelProcessing: {
          Type: "Parallel",
          Branches: [
            {
              StartAt: "Branch1",
              States: {
                Branch1: {
                  Type: "Task",
                  Resource: "arn:aws:lambda:us-east-1:123456789012:function:Branch1",
                  End: true,
                },
              },
            },
            {
              StartAt: "Branch2",
              States: {
                Branch2: {
                  Type: "Task",
                  Resource: "arn:aws:lambda:us-east-1:123456789012:function:Branch2",
                  End: true,
                },
              },
            },
          ],
          Next: "End",
        },
        End: {
          Type: "Succeed",
        },
      },
    };

    const result = aslToPipelineDefinition(asl);

    // Parallel branches contain nested states, so we only get top-level states
    expect(result.nodes.length).toBeGreaterThanOrEqual(3);
    const parallelNode = result.nodes.find((n) => n.id === "ParallelProcessing");
    expect(parallelNode?.type).toBe("parallel");
  });

  test("converts ASL with choice state", () => {
    const asl: AslStateMachine = {
      StartAt: "CheckCondition",
      States: {
        CheckCondition: {
          Type: "Choice",
          Choices: [
            {
              Variable: "$.status",
              StringEquals: "active",
              Next: "ProcessActive",
            },
            {
              Variable: "$.status",
              StringEquals: "inactive",
              Next: "ProcessInactive",
            },
          ],
          Default: "ProcessDefault",
        },
        ProcessActive: {
          Type: "Task",
          Resource: "arn:aws:lambda:us-east-1:123456789012:function:ProcessActive",
          End: true,
        },
        ProcessInactive: {
          Type: "Task",
          Resource: "arn:aws:lambda:us-east-1:123456789012:function:ProcessInactive",
          End: true,
        },
        ProcessDefault: {
          Type: "Task",
          Resource: "arn:aws:lambda:us-east-1:123456789012:function:ProcessDefault",
          End: true,
        },
      },
    };

    const result = aslToPipelineDefinition(asl);

    expect(result.nodes).toHaveLength(4);
    const choiceNode = result.nodes.find((n) => n.id === "CheckCondition");
    expect(choiceNode?.type).toBe("choice");

    const processActive = result.nodes.find((n) => n.id === "ProcessActive");
    expect(processActive?.dependsOn).toContain("CheckCondition");
  });

  test("extracts stepRef from Lambda ARN", () => {
    const asl: AslStateMachine = {
      StartAt: "MyFunction",
      States: {
        MyFunction: {
          Type: "Task",
          Resource: "arn:aws:lambda:us-east-1:123456789012:function:MyFunction",
          End: true,
        },
      },
    };

    const result = aslToPipelineDefinition(asl);

    expect(result.nodes[0]?.stepRef).toBe("MyFunction");
  });

  test("extracts stepRef from activity ARN", () => {
    const asl: AslStateMachine = {
      StartAt: "MyActivity",
      States: {
        MyActivity: {
          Type: "Task",
          Resource: "arn:aws:states:us-east-1:123456789012:activity:MyActivity",
          End: true,
        },
      },
    };

    const result = aslToPipelineDefinition(asl);

    expect(result.nodes[0]?.stepRef).toBe("MyActivity");
  });

  test("preserves ASL state config", () => {
    const asl: AslStateMachine = {
      StartAt: "TaskWithConfig",
      States: {
        TaskWithConfig: {
          Type: "Task",
          Resource: "arn:aws:lambda:us-east-1:123456789012:function:TaskWithConfig",
          TimeoutSeconds: 30,
          Retry: [
            {
              ErrorEquals: ["States.ALL"],
              IntervalSeconds: 2,
              MaxAttempts: 3,
            },
          ],
          End: true,
        },
      },
    };

    const result = aslToPipelineDefinition(asl);

    expect(result.nodes[0]?.config).toBeDefined();
    const config = result.nodes[0]?.config as any;
    expect(config.Type).toBe("Task");
    expect(config.TimeoutSeconds).toBe(30);
    expect(config.Retry).toBeDefined();
  });

  test("handles Pass state", () => {
    const asl: AslStateMachine = {
      StartAt: "PassState",
      States: {
        PassState: {
          Type: "Pass",
          Result: { message: "Hello" },
          Next: "NextState",
        },
        NextState: {
          Type: "Task",
          Resource: "arn:aws:lambda:us-east-1:123456789012:function:NextState",
          End: true,
        },
      },
    };

    const result = aslToPipelineDefinition(asl);

    const passNode = result.nodes.find((n) => n.id === "PassState");
    expect(passNode?.type).toBe("pass");
    expect(passNode?.stepRef).toBe("PassState");
  });
});

