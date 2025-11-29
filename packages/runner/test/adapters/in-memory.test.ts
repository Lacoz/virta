import { describe, it, expect } from "vitest";
import { InMemoryAdapter } from "../../src/adapters/in-memory.js";
import { PipelineDefinition, PipelineStep, TransformationContext } from "@virta/core";

class TestStep implements PipelineStep<any, any> {
  execute(ctx: TransformationContext<any, any>) {
    ctx.target.ran = true;
  }
}

describe("InMemoryAdapter", () => {
  it("runs a simple pipeline", async () => {
    const definition: PipelineDefinition<any, any> = {
      steps: [{ ctor: TestStep }]
    };
    
    const adapter = new InMemoryAdapter();
    const result = await adapter.run(definition, {
      source: {},
      target: {}
    });
    
    expect(result.status).toBe("success");
    expect(result.context.target.ran).toBe(true);
  });
});

