import { describe, expect, test } from "vitest";
import type { PipelineStep, TransformationContext } from "@virta/core";
import { StepRegistry } from "../src/StepRegistry.js";

type TestContext = {
  value: number;
};

class StepA implements PipelineStep<unknown, TestContext> {
  execute(ctx: TransformationContext<unknown, TestContext>) {
    ctx.target.value = 1;
  }
}

class StepB implements PipelineStep<unknown, TestContext> {
  execute(ctx: TransformationContext<unknown, TestContext>) {
    ctx.target.value = 2;
  }
}

describe("StepRegistry", () => {
  test("registers and resolves step constructors", () => {
    const registry = new StepRegistry<unknown, TestContext>();
    
    registry.register("stepA", StepA);
    registry.register("stepB", StepB);

    expect(registry.resolve("stepA")).toBe(StepA);
    expect(registry.resolve("stepB")).toBe(StepB);
  });

  test("throws error when resolving unknown step", () => {
    const registry = new StepRegistry<unknown, TestContext>();
    
    expect(() => registry.resolve("unknown")).toThrow("Unknown stepRef: unknown");
  });

  test("throws error when registering duplicate ID", () => {
    const registry = new StepRegistry<unknown, TestContext>();
    
    registry.register("stepA", StepA);
    
    expect(() => registry.register("stepA", StepB)).toThrow(
      'Step ID "stepA" is already registered'
    );
  });

  test("checks if step ID is registered", () => {
    const registry = new StepRegistry<unknown, TestContext>();
    
    expect(registry.has("stepA")).toBe(false);
    
    registry.register("stepA", StepA);
    
    expect(registry.has("stepA")).toBe(true);
    expect(registry.has("stepB")).toBe(false);
  });

  test("returns all registered IDs", () => {
    const registry = new StepRegistry<unknown, TestContext>();
    
    expect(registry.getRegisteredIds()).toEqual([]);
    
    registry.register("stepA", StepA);
    registry.register("stepB", StepB);
    
    const ids = registry.getRegisteredIds();
    expect(ids).toContain("stepA");
    expect(ids).toContain("stepB");
    expect(ids.length).toBe(2);
  });

  test("clears all registrations", () => {
    const registry = new StepRegistry<unknown, TestContext>();
    
    registry.register("stepA", StepA);
    registry.register("stepB", StepB);
    
    expect(registry.getRegisteredIds().length).toBe(2);
    
    registry.clear();
    
    expect(registry.getRegisteredIds().length).toBe(0);
    expect(() => registry.resolve("stepA")).toThrow();
  });

  test("registers multiple steps at once", () => {
    const registry = new StepRegistry<unknown, TestContext>();
    
    registry.registerAll({
      stepA: StepA,
      stepB: StepB,
    });
    
    expect(registry.resolve("stepA")).toBe(StepA);
    expect(registry.resolve("stepB")).toBe(StepB);
    expect(registry.getRegisteredIds().length).toBe(2);
  });
});

