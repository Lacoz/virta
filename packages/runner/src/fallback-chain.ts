import { PipelineDefinition, PipelineResult, LambdaTimeoutError } from "@virta/core";
import { RunnerAdapter } from "./RunnerAdapter.js";
import { RunnerOptions } from "./types.js";
import { LambdaAdapter } from "./adapters/lambda.js";
import { HybridAdapter } from "./adapters/hybrid.js";
import { FargateAdapter } from "./adapters/fargate.js";

export class FallbackChainRunner {
  constructor(
    private lambdaAdapter: LambdaAdapter = new LambdaAdapter(),
    private hybridAdapter: HybridAdapter = new HybridAdapter(),
    private fargateAdapter: FargateAdapter = new FargateAdapter()
  ) {}

  async runWithFallbackChain<S, T>(definition: PipelineDefinition<S, T>, options: RunnerOptions<S, T>): Promise<PipelineResult<S, T>> {
      try {
          // 1. Try Lambda
          return await this.lambdaAdapter.run(definition, options);
      } catch (error) {
          if (error instanceof LambdaTimeoutError) {
              console.warn("Lambda timeout detected, attempting fallback to Hybrid/Fargate");
              try {
                  // 2. Try Hybrid
                  return await this.hybridAdapter.run(definition, options);
              } catch (hybridError) {
                   console.warn("Hybrid execution failed, attempting fallback to Fargate");
                   // 3. Try Fargate
                   return await this.fargateAdapter.run(definition, options);
              }
          }
          throw error;
      }
  }
}

