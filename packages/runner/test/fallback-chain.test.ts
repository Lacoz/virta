import { describe, it, expect, vi } from "vitest";
import { FallbackChainRunner } from "../src/fallback-chain.js";
import { PipelineDefinition, PipelineStep, TransformationContext, LambdaTimeoutError } from "@virta/core";
import { LambdaAdapter } from "../src/adapters/lambda.js";
import { HybridAdapter } from "../src/adapters/hybrid.js";
import { FargateAdapter } from "../src/adapters/fargate.js";

class TestStep implements PipelineStep<any, any> {
  execute(ctx: TransformationContext<any, any>) {}
}

describe("FallbackChainRunner", () => {
  const definition: PipelineDefinition<any, any> = {
    steps: [{ ctor: TestStep }]
  };

  it("runs lambda adapter successfully if no error", async () => {
    const lambdaMock = new LambdaAdapter();
    lambdaMock.run = vi.fn().mockResolvedValue({ status: "success" });
    
    const runner = new FallbackChainRunner(lambdaMock);
    await runner.runWithFallbackChain(definition, { source: {}, target: {} });
    
    expect(lambdaMock.run).toHaveBeenCalled();
  });

  it("falls back to hybrid if lambda times out", async () => {
    const lambdaMock = new LambdaAdapter();
    lambdaMock.run = vi.fn().mockRejectedValue(new LambdaTimeoutError());
    
    const hybridMock = new HybridAdapter();
    hybridMock.run = vi.fn().mockResolvedValue({ status: "success" });
    
    const runner = new FallbackChainRunner(lambdaMock, hybridMock);
    await runner.runWithFallbackChain(definition, { source: {}, target: {} });
    
    expect(lambdaMock.run).toHaveBeenCalled();
    expect(hybridMock.run).toHaveBeenCalled();
  });

  it("falls back to fargate if hybrid fails", async () => {
    const lambdaMock = new LambdaAdapter();
    lambdaMock.run = vi.fn().mockRejectedValue(new LambdaTimeoutError());
    
    const hybridMock = new HybridAdapter();
    hybridMock.run = vi.fn().mockRejectedValue(new Error("Hybrid split failed"));
    
    const fargateMock = new FargateAdapter();
    fargateMock.run = vi.fn().mockResolvedValue({ status: "success" });
    
    const runner = new FallbackChainRunner(lambdaMock, hybridMock, fargateMock);
    await runner.runWithFallbackChain(definition, { source: {}, target: {} });
    
    expect(lambdaMock.run).toHaveBeenCalled();
    expect(hybridMock.run).toHaveBeenCalled();
    expect(fargateMock.run).toHaveBeenCalled();
  });
});

