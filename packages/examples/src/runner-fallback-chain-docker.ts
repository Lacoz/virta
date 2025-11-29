import { PipelineDefinition, PipelineStep, TransformationContext } from "@virta/core";
import { run } from "@virta/runner";

class UnstableStep implements PipelineStep<any, any> {
  execute(): void {
     console.log("Unstable step running...");
  }
}

const definition: PipelineDefinition<any, any> = {
  steps: [{ ctor: UnstableStep }]
};

async function main() {
  console.log("Starting Fallback Chain Docker Example");
  
  // This would be run inside the docker container ideally
  const result = await run(definition, {
      source: {},
      target: {},
      executionMode: "auto", // Trigger fallback chain
      timeoutMs: 100 // Force timeout
  });
  
  console.log("Result status:", result.status);
  // In a full implementation, we would check if it fell back to Fargate
}

main();

