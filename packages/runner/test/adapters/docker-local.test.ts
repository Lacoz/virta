import { describe, it, expect, vi } from "vitest";
import { DockerLocalAdapter } from "../../src/adapters/docker-local.js";
import { PipelineDefinition, PipelineStep, TransformationContext } from "@virta/core";

class TestStep implements PipelineStep<any, any> {
  execute(ctx: TransformationContext<any, any>) {
    ctx.target.ran = true;
  }
}

describe("DockerLocalAdapter", () => {
  it("simulates execution", async () => {
    const definition: PipelineDefinition<any, any> = {
      steps: [{ ctor: TestStep }]
    };
    
    const adapter = new DockerLocalAdapter();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    
    const result = await adapter.run(definition, {
      source: {},
      target: {}
    });
    
    expect(consoleSpy).toHaveBeenCalledWith("Running in Docker Local adapter");
    expect(result.status).toBe("success");
    
    consoleSpy.mockRestore();
  });
});

