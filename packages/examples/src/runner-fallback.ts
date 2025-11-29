import { PipelineDefinition, PipelineStep, TransformationContext } from "@virta/core";
import { run } from "@virta/runner";

// A slow step that might timeout
class SlowStep implements PipelineStep<any, any> {
  async execute(ctx: TransformationContext<any, any>): Promise<void> {
    console.log("Executing Slow Step");
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate work
    ctx.target.slow = true;
  }
}

const definition: PipelineDefinition<any, any> = {
  steps: [
    { ctor: SlowStep }
  ]
};

async function main() {
  console.log("Starting Fallback Runner Example");
  
  try {
    // Configure very short timeout to trigger fallback logic (simulated)
    const result = await run(definition, {
      source: {},
      target: {},
      executionMode: "lambda-fallback", // This triggers the FallbackChainRunner
      timeoutMs: 500 // Should timeout if actually enforced, triggering fallback
    });
    
    console.log("Result:", result);
  } catch (error) {
    console.error("Error running pipeline:", error);
  }
}

main();

