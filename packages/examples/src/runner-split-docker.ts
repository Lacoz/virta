import { PipelineDefinition, PipelineStep, TransformationContext } from "@virta/core";
import { run, PipelineSplitter } from "@virta/runner";

class Step1 implements PipelineStep<any, any> { execute() {} }
class Step2 implements PipelineStep<any, any> { execute() {} }
class Step3 implements PipelineStep<any, any> { execute() {} }
class Step4 implements PipelineStep<any, any> { execute() {} }

const definition: PipelineDefinition<any, any> = {
  steps: [
    { ctor: Step1 },
    { ctor: Step2, dependsOn: [Step1] },
    { ctor: Step3, dependsOn: [Step2] },
    { ctor: Step4, dependsOn: [Step3] }
  ]
};

async function main() {
  console.log("Starting Split Docker Example");
  
  const splitter = new PipelineSplitter();
  const split = splitter.splitPipeline(definition);
  
  if (split) {
      console.log("Pipeline Split Result:");
      console.log("Prefix steps:", split.prefix.steps.map(s => s.ctor.name));
      console.log("Suffix steps:", split.suffix.steps.map(s => s.ctor.name));
      
      console.log("\nRunning Hybrid Execution (Simulated)...");
      const result = await run(definition, {
          source: {}, 
          target: {},
          executionMode: "hybrid"
      });
      console.log("Execution completed:", result.status);
  } else {
      console.log("Could not split pipeline.");
  }
}

main();

