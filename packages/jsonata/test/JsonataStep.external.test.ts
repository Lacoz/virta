import { describe, expect, test, vi, beforeEach } from "vitest";
import {
  JsonataStep,
  type TransformationContext,
} from "../src/index.js";

global.fetch = vi.fn();

type SourceData = {
  name: string;
  value: number;
};

type TargetData = {
  name?: string;
  computed?: number;
};

describe("JsonataStep with external sources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("loads expression from file path", async () => {
    const filePath = "./test/fixtures/simple.jsonata";

    const step = new JsonataStep<SourceData, TargetData>({
      expressionPath: filePath,
    });

    const ctx: TransformationContext<SourceData, TargetData> = {
      source: { name: "Test", value: 10 },
      target: {},
    };

    await step.execute(ctx);

    expect(ctx.target.name).toBe("Test");
  });

  test("loads expression from URL", async () => {
    const url = "https://example.com/transform.jsonata";
    const content = '{"computed": source.value * 2}';

    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => content,
    });

    const step = new JsonataStep<SourceData, TargetData>({
      expressionUrl: url,
    });

    const ctx: TransformationContext<SourceData, TargetData> = {
      source: { name: "Test", value: 10 },
      target: {},
    };

    await step.execute(ctx);

    expect(ctx.target.computed).toBe(20);
    expect(global.fetch).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        headers: expect.objectContaining({
          "Accept": "text/plain, application/json",
        }),
      })
    );
  });

  test("throws error if no expression source provided", () => {
    expect(() => {
      new JsonataStep<SourceData, TargetData>({} as any);
    }).toThrow("JsonataStep requires one of: expression, expressionPath, or expressionUrl");
  });

  test("caches compiled expression after first load", async () => {
    const url = "https://example.com/transform.jsonata";
    const content = '{"name": source.name}';

    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => content,
    });

    const step = new JsonataStep<SourceData, TargetData>({
      expressionUrl: url,
    });

    const ctx: TransformationContext<SourceData, TargetData> = {
      source: { name: "Test", value: 10 },
      target: {},
    };

    // Execute twice - should only fetch once
    await step.execute(ctx);
    await step.execute(ctx);

    // Fetch should be called only once (expression is cached)
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

