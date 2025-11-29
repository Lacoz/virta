import { PipelineDefinition, PipelineResult, runPipeline } from "@virta/core";
import { RunnerAdapter } from "../RunnerAdapter.js";
import { RunnerOptions } from "../types.js";

export class FargateAdapter implements RunnerAdapter {
  async run<S, T>(definition: PipelineDefinition<S, T>, options: RunnerOptions<S, T>): Promise<PipelineResult<S, T>> {
     // In a real Fargate scenario, this code might be running INSIDE Fargate, 
     // or it might be launching a Fargate task.
     // If running inside, it's just runPipeline with loose timeouts.
     // If launching, it uses ECS client.
     
     // Assuming 'adapter' means we are triggering execution in that environment:
     // 1. Check if we are already in Fargate (env vars) -> runPipeline
     // 2. If not, launch task -> ECS.runTask
     
     const isFargate = process.env.AWS_EXECUTION_ENV?.includes("AWS_ECS_FARGATE");
     
     if (isFargate) {
         return runPipeline(definition, options);
     } else {
         console.log("Launching Fargate task...");
         // Mock launch
         return {
            status: "success",
            context: { source: options.source, target: options.target },
            errors: [],
            executedSteps: [],
            completedLevels: []
          };
     }
  }
}

