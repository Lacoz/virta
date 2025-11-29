import { PipelineDefinition, PipelineStep, TransformationContext } from "@virta/core";
import { run } from "@virta/runner";

// Step 1: Runs quickly in Lambda
class FastInitStep implements PipelineStep<any, any> {
  execute(ctx: TransformationContext<any, any>): void {
    console.log("[Lambda] Initializing...");
    ctx.target.init = true;
  }
}

// Step 2: Takes time, detects timeout risk
class HeavyProcessingStep implements PipelineStep<any, any> {
  async execute(ctx: TransformationContext<any, any>): Promise<void> {
    console.log("[Lambda] Heavy processing started...");
    // Simulate time passing
    await new Promise(resolve => setTimeout(resolve, 100)); 
    console.log("[Lambda] Approaching timeout!");
    // In real scenario, RuntimeMonitor would flag this
  }
}

// Step 3: Should run in Step Functions (post-migration)
class FinalizeStep implements PipelineStep<any, any> {
  execute(ctx: TransformationContext<any, any>): void {
    console.log("[Step Functions] Finalizing...");
    ctx.target.done = true;
  }
}

const definition: PipelineDefinition<any, any> = {
  steps: [
    { ctor: FastInitStep },
    { ctor: HeavyProcessingStep, dependsOn: [FastInitStep] },
    { ctor: FinalizeStep, dependsOn: [HeavyProcessingStep] }
  ]
};

async function main() {
  console.log("Starting Migration Docker Example");
  console.log("This example simulates starting in Lambda and migrating to Step Functions.");

  const result = await run(definition, {
    source: {},
    target: {},
    executionMode: "docker-local",
    // In a real scenario, we'd pass flags to simulate specific conditions
  });

  console.log("Final Result:", result);
}

main();

