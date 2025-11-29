import { PipelineDefinition, PipelineResult, runPipeline, StepCtor } from "@virta/core";
import { RunnerAdapter } from "../RunnerAdapter.js";
import { RunnerOptions } from "../types.js";
import { PipelineSplitter } from "../pipeline-splitter.js";
import { LambdaAdapter } from "./lambda.js";
import { StepFunctionsAdapter } from "./step-functions.js";

export class HybridAdapter implements RunnerAdapter {
  constructor(
      private lambdaAdapter: LambdaAdapter = new LambdaAdapter(),
      private sfnAdapter: StepFunctionsAdapter = new StepFunctionsAdapter(),
      private splitter: PipelineSplitter = new PipelineSplitter()
  ) {}

  async run<S, T>(definition: PipelineDefinition<S, T>, options: RunnerOptions<S, T>): Promise<PipelineResult<S, T>> {
      // 1. Determine split point (this logic might need planner info or heuristic)
      // For simplicity, we ask the splitter
      const split = this.splitter.splitPipeline(definition);
      
      if (!split) {
          // Cannot split, run fully in Lambda (or fallback to Fargate if needed, but here just Lambda)
          return this.lambdaAdapter.run(definition, options);
      }
      
      // 2. Run prefix in Lambda
      const prefixResult = await this.lambdaAdapter.run(split.prefix, options);
      
      if (prefixResult.status !== "success") {
          return prefixResult; // Error or stopped
      }
      
      // 3. Run suffix in Step Functions
      // We pass the result context of prefix as source for suffix
      const suffixOptions = {
          ...options,
          source: prefixResult.context.target as any, // Type casting as S -> T transition happens
      };
      
      const suffixResult = await this.sfnAdapter.run(split.suffix as PipelineDefinition<any, T>, suffixOptions);
      
      // 4. Merge results (suffix result is the final result)
      return {
          ...suffixResult,
          executedSteps: [...prefixResult.executedSteps, ...suffixResult.executedSteps],
          completedLevels: [...prefixResult.completedLevels, ...suffixResult.completedLevels]
      };
  }
}

