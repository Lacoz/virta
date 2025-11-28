import { describe, expect, test } from "vitest";
import { typeScriptToPipelineDefinition } from "../src/import.js";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("typeScriptToPipelineDefinition", () => {
  test("imports pipeline from generated TypeScript file", async () => {
    const testFile = join(tmpdir(), `virta-test-${Date.now()}.ts`);
    
    // Use the format that export.ts generates
    const tsCode = `/**
 * Step: task1
 */
class Task1Step implements PipelineStep<any, any> {
  execute(ctx: TransformationContext<any, any>): void {}
}

/**
 * Step: task2
 */
class Task2Step implements PipelineStep<any, any> {
  execute(ctx: TransformationContext<any, any>): void {}
}

const pipelineDefinition: PipelineDefinition<any, any> = {
  steps: [
    {
      ctor: Task1Step,
    },
    {
      ctor: Task2Step,
      dependsOn: [Task1Step],
    },
  ],
};`;

    await writeFile(testFile, tsCode, "utf-8");

    try {
      const def = await typeScriptToPipelineDefinition(testFile);

      expect(def.nodes).toHaveLength(2);
      expect(def.nodes[0]?.id).toBe("task1");
      expect(def.nodes[1]?.id).toBe("task2");
      expect(def.nodes[1]?.dependsOn).toContain("task1");
    } finally {
      await unlink(testFile).catch(() => {});
    }
  });

  test("validates DAG and rejects cycles", async () => {
    const testFile = join(tmpdir(), `virta-test-cycle-${Date.now()}.ts`);
    
    // Create a pipeline with a cycle: task1 -> task2 -> task1
    const tsCode = `/**
 * Step: task1
 */
class Task1Step implements PipelineStep<any, any> {
  execute(ctx: TransformationContext<any, any>): void {}
}

/**
 * Step: task2
 */
class Task2Step implements PipelineStep<any, any> {
  execute(ctx: TransformationContext<any, any>): void {}
}

const pipelineDefinition: PipelineDefinition<any, any> = {
  steps: [
    {
      ctor: Task1Step,
      dependsOn: [Task2Step],
    },
    {
      ctor: Task2Step,
      dependsOn: [Task1Step],
    },
  ],
};`;

    await writeFile(testFile, tsCode, "utf-8");

    try {
      await expect(typeScriptToPipelineDefinition(testFile)).rejects.toThrow(
        /Pipeline.*cycle/
      );
    } finally {
      await unlink(testFile).catch(() => {});
    }
  });

  test("validates DAG and rejects missing dependencies", async () => {
    const testFile = join(tmpdir(), `virta-test-missing-${Date.now()}.ts`);
    
    const tsCode = `/**
 * Step: task1
 */
class Task1Step implements PipelineStep<any, any> {
  execute(ctx: TransformationContext<any, any>): void {}
}

const pipelineDefinition: PipelineDefinition<any, any> = {
  steps: [
    {
      ctor: Task1Step,
      dependsOn: ["nonexistent"],
    },
  ],
};`;

    await writeFile(testFile, tsCode, "utf-8");

    try {
      await expect(typeScriptToPipelineDefinition(testFile)).rejects.toThrow(
        "does not exist in the pipeline"
      );
    } finally {
      await unlink(testFile).catch(() => {});
    }
  });

  test("throws error for file without pipeline definition", async () => {
    const testFile = join(tmpdir(), `virta-test-${Date.now()}.ts`);
    
    await writeFile(testFile, "const x = 1;", "utf-8");

    try {
      await expect(typeScriptToPipelineDefinition(testFile)).rejects.toThrow(
        "Could not find pipeline definition"
      );
    } finally {
      await unlink(testFile).catch(() => {});
    }
  });

  test("throws error for evaluation mode (not implemented)", async () => {
    const testFile = join(tmpdir(), `virta-test-${Date.now()}.ts`);
    
    await writeFile(testFile, "const x = 1;", "utf-8");

    try {
      await expect(
        typeScriptToPipelineDefinition(testFile, { evaluate: true })
      ).rejects.toThrow("TypeScript evaluation is not yet implemented");
    } finally {
      await unlink(testFile).catch(() => {});
    }
  });
});
