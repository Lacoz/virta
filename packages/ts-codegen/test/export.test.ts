import { describe, expect, test } from "vitest";
import { pipelineDefinitionToTypeScript } from "../src/export.js";
import type { PipelineDefinition } from "@virta/registry";

describe("pipelineDefinitionToTypeScript", () => {
  test("generates TypeScript code for simple pipeline", () => {
    const def: PipelineDefinition = {
      nodes: [
        { id: "task1", type: "task", dependsOn: [], stepRef: "task1" },
        { id: "task2", type: "task", dependsOn: ["task1"], stepRef: "task2" },
      ],
    };

    const code = pipelineDefinitionToTypeScript(def, {
      pipelineName: "TestPipeline",
      sourceType: "OrderData",
      targetType: "ProcessedOrder",
    });

    expect(code).toContain("class Task1Step");
    expect(code).toContain("class Task2Step");
    expect(code).toContain("testpipelineDefinition");
    expect(code).toContain("runTestPipeline");
    expect(code).toContain("from \"@virta/core\"");
    expect(code).toContain("dependsOn: [Task1Step]");
  });

  test("generates stub implementations by default", () => {
    const def: PipelineDefinition = {
      nodes: [
        { id: "validate", type: "task", dependsOn: [], stepRef: "validate" },
      ],
    };

    const code = pipelineDefinitionToTypeScript(def);

    expect(code).toContain("// TODO: Implement step logic");
    expect(code).toContain("execute(ctx: TransformationContext");
  });

  test("generates JSONata implementations when mode is jsonata", () => {
    const def: PipelineDefinition = {
      nodes: [
        {
          id: "transform",
          type: "task",
          dependsOn: [],
          stepRef: "transform",
          config: {
            expression: '{"result": source.value * 2}',
          },
        },
      ],
    };

    const code = pipelineDefinitionToTypeScript(def, {
      implementationMode: "jsonata",
    });

    expect(code).toContain("JsonataStep");
    expect(code).toContain("from \"@virta/jsonata\"");
    expect(code).toContain('expression: "{\\"result\\": source.value * 2}"');
  });

  test("generates empty implementations when mode is empty", () => {
    const def: PipelineDefinition = {
      nodes: [
        { id: "task1", type: "task", dependsOn: [], stepRef: "task1" },
      ],
    };

    const code = pipelineDefinitionToTypeScript(def, {
      implementationMode: "empty",
    });

    expect(code).toContain("// Empty implementation");
    expect(code).not.toContain("TODO");
  });

  test("includes metadata in generated code", () => {
    const def: PipelineDefinition = {
      nodes: [
        {
          id: "task1",
          type: "task",
          dependsOn: [],
          stepRef: "task1",
          config: {
            executionHint: "step-functions-only",
            timing: { p50Ms: 1000, p99Ms: 2000 },
          },
        },
      ],
    };

    const code = pipelineDefinitionToTypeScript(def);

    expect(code).toContain('executionHint: "step-functions-only"');
    expect(code).toContain("p50Ms: 1000");
    expect(code).toContain("p99Ms: 2000");
  });

  test("generates valid class names from various node IDs", () => {
    const def: PipelineDefinition = {
      nodes: [
        { id: "validate-order", type: "task", dependsOn: [], stepRef: "validateOrder" },
        { id: "process_order", type: "task", dependsOn: [], stepRef: "processOrder" },
        { id: "formatOrder", type: "task", dependsOn: [], stepRef: "formatOrder" },
      ],
    };

    const code = pipelineDefinitionToTypeScript(def);

    expect(code).toContain("class ValidateOrderStep");
    expect(code).toContain("class ProcessOrderStep");
    expect(code).toContain("class FormatOrderStep");
  });

  test("handles parallel dependencies correctly", () => {
    const def: PipelineDefinition = {
      nodes: [
        { id: "start", type: "task", dependsOn: [], stepRef: "start" },
        { id: "branch1", type: "task", dependsOn: ["start"], stepRef: "branch1" },
        { id: "branch2", type: "task", dependsOn: ["start"], stepRef: "branch2" },
        { id: "end", type: "task", dependsOn: ["branch1", "branch2"], stepRef: "end" },
      ],
    };

    const code = pipelineDefinitionToTypeScript(def);

    expect(code).toContain("dependsOn: [StartStep]");
    expect(code).toContain("dependsOn: [Branch1Step, Branch2Step]");
  });

  test("includes custom header comment", () => {
    const def: PipelineDefinition = {
      nodes: [{ id: "task1", type: "task", dependsOn: [], stepRef: "task1" }],
    };

    const code = pipelineDefinitionToTypeScript(def, {
      headerComment: "Custom pipeline for order processing",
    });

    expect(code).toContain("Custom pipeline for order processing");
  });

  test("can exclude imports", () => {
    const def: PipelineDefinition = {
      nodes: [{ id: "task1", type: "task", dependsOn: [], stepRef: "task1" }],
    };

    const code = pipelineDefinitionToTypeScript(def, {
      includeImports: false,
    });

    expect(code).not.toContain("from \"@virta/core\"");
  });
});

