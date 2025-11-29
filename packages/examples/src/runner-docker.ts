import { PipelineDefinition, PipelineStep, TransformationContext, StepCtor } from "@virta/core";
import { run } from "@virta/runner";

// Define some simple steps
class StepA implements PipelineStep<any, any> {
  execute(ctx: TransformationContext<any, any>): void {
    console.log("Executing Step A");
    ctx.target.stepA = true;
  }
}

class StepB implements PipelineStep<any, any> {
  execute(ctx: TransformationContext<any, any>): void {
    console.log("Executing Step B");
    ctx.target.stepB = true;
  }
}

const definition: PipelineDefinition<any, any> = {
  steps: [
    { ctor: StepA },
    { ctor: StepB, dependsOn: [StepA] }
  ]
};

async function main() {
  console.log("Starting Docker Local Runner Example");
  
  try {
    const result = await run(definition, {
      source: {},
      target: {},
      executionMode: "docker-local"
    });
    
    console.log("Result:", result);
  } catch (error) {
    console.error("Error running pipeline:", error);
  }
}

main();

