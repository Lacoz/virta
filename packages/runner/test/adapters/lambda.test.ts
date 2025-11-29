import { describe, it, expect } from "vitest";
import { LambdaAdapter } from "../../src/adapters/lambda.js";
import { PipelineDefinition, PipelineStep, TransformationContext } from "@virta/core";

class TestStep implements PipelineStep<any, any> {
  execute(ctx: TransformationContext<any, any>) {
    ctx.target.ran = true;
  }
}

describe("LambdaAdapter", () => {
  it("runs a pipeline with runtime monitoring hooks", async () => {
    const definition: PipelineDefinition<any, any> = {
      steps: [{ ctor: TestStep }]
    };
    
    const adapter = new LambdaAdapter();
    const result = await adapter.run(definition, {
      source: {},
      target: {},
      timeoutMs: 1000 // short timeout test
    });
    
    expect(result.status).toBe("success");
    expect(result.context.target.ran).toBe(true);
  });
});

