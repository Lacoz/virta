import { describe, expect, test } from "vitest";
import {
  buildLevels,
  runPipeline,
  type PipelineDefinition,
  type TransformationContext,
} from "@virta/core";
import { JsonataStep, createJsonataStep } from "../src/index.js";

type SourceData = {
  name: string;
  items: Array<{ price: number; quantity: number }>;
};

type TargetData = {
  name?: string;
  total?: number;
  itemCount?: number;
  averagePrice?: number;
};

describe("JsonataStep", () => {
  test("applies JSONata expression to transform data", async () => {
    const step = new JsonataStep<SourceData, TargetData>({
      expression: '{"name": source.name}',
    });

    const ctx: TransformationContext<SourceData, TargetData> = {
      source: { name: "Test", items: [] },
      target: {},
    };

    await step.execute(ctx);

    expect(ctx.target.name).toBe("Test");
  });

  test("calculates computed values using JSONata", async () => {
    const step = new JsonataStep<SourceData, TargetData>({
      expression: '{"total": $sum(source.items.price)}',
    });

    const ctx: TransformationContext<SourceData, TargetData> = {
      source: {
        name: "Order",
        items: [
          { price: 10, quantity: 2 },
          { price: 20, quantity: 1 },
        ],
      },
      target: {},
    };

    await step.execute(ctx);

    expect(ctx.target.total).toBe(30);
  });

  test("merges result into target by default", async () => {
    const step = new JsonataStep<SourceData, TargetData>({
      expression: '{"computed": source.name & " processed"}',
    });

    const ctx: TransformationContext<SourceData, TargetData> = {
      source: { name: "Test", items: [] },
      target: { name: "Original" },
    };

    await step.execute(ctx);

    expect(ctx.target.name).toBe("Original"); // Preserved
    expect((ctx.target as any).computed).toBe("Test processed");
  });

  test("handles complex transformations", async () => {
    const step = new JsonataStep<SourceData, TargetData>({
      expression: `{
        "name": source.name,
        "itemCount": $count(source.items),
        "total": $sum(source.items.price),
        "averagePrice": $average(source.items.price)
      }`,
    });

    const ctx: TransformationContext<SourceData, TargetData> = {
      source: {
        name: "Order",
        items: [
          { price: 10, quantity: 2 },
          { price: 20, quantity: 1 },
          { price: 30, quantity: 1 },
        ],
      },
      target: {},
    };

    await step.execute(ctx);

    expect(ctx.target.name).toBe("Order");
    expect(ctx.target.itemCount).toBe(3);
    expect(ctx.target.total).toBe(60);
    expect(ctx.target.averagePrice).toBe(20);
  });

  test("works in a pipeline with other steps", async () => {
    class InitializeStep {
      execute(ctx: TransformationContext<SourceData, TargetData>) {
        ctx.target.name = ctx.source.name;
      }
    }

    // Create a wrapper class for the JsonataStep instance
    class TotalCalculationStep extends JsonataStep<SourceData, TargetData> {
      constructor() {
        super({
          expression: '{"total": $sum(source.items.price)}',
        });
      }
    }

    const definition: PipelineDefinition<SourceData, TargetData> = {
      steps: [
        { ctor: InitializeStep as any },
        { ctor: TotalCalculationStep as any, dependsOn: [InitializeStep as any] },
      ],
    };

    const result = await runPipeline(definition, {
      source: {
        name: "Order",
        items: [{ price: 10, quantity: 1 }, { price: 20, quantity: 1 }],
      },
      target: {} as TargetData,
    });

    expect(result.status).toBe("success");
    expect(result.context.target.name).toBe("Order");
    expect(result.context.target.total).toBe(30);
  });
});

describe("createJsonataStep", () => {
  test("creates a JsonataStep instance", () => {
    const step = createJsonataStep<SourceData, TargetData>(
      '{"name": source.name}'
    );

    expect(step).toBeInstanceOf(JsonataStep);
  });

  test("accepts options", () => {
    const step = createJsonataStep<SourceData, TargetData>(
      "{ name: source.name }",
      { merge: false }
    );

    expect(step).toBeInstanceOf(JsonataStep);
  });
});

