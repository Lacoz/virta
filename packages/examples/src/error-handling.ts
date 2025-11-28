/**
 * Error handling example: How Virta handles errors in pipelines
 * 
 * This example demonstrates error handling, error propagation,
 * and how the pipeline stops when an error occurs.
 */

import {
  buildLevels,
  runPipeline,
  type PipelineDefinition,
  type PipelineStep,
  type TransformationContext,
} from "@virta/core";

type InputData = {
  value: number;
};

type ProcessedData = {
  value: number;
  doubled?: number;
  squared?: number;
  validated?: boolean;
  result?: string;
};

// Step that succeeds
class DoubleValueStep implements PipelineStep<InputData, ProcessedData> {
  execute(ctx: TransformationContext<InputData, ProcessedData>) {
    ctx.target.doubled = ctx.source.value * 2;
  }
}

// Step that fails
class FailingStep implements PipelineStep<InputData, ProcessedData> {
  execute() {
    throw new Error("Simulated failure in processing step");
  }
}

// Step that depends on failing step (won't execute)
class DependentStep implements PipelineStep<InputData, ProcessedData> {
  execute(ctx: TransformationContext<InputData, ProcessedData>) {
    ctx.target.result = "This should not execute";
  }
}

// Step that runs before the error
class InitializeStep implements PipelineStep<InputData, ProcessedData> {
  execute(ctx: TransformationContext<InputData, ProcessedData>) {
    ctx.target.value = ctx.source.value;
  }
}

async function main() {
  console.log("=== Error Handling Example ===\n");

  const definition: PipelineDefinition<InputData, ProcessedData> = {
    steps: [
      { ctor: InitializeStep },
      { ctor: DoubleValueStep, dependsOn: [InitializeStep] },
      { ctor: FailingStep, dependsOn: [DoubleValueStep] },
      { ctor: DependentStep, dependsOn: [FailingStep] },
    ],
  };

  const levels = buildLevels(definition);
  console.log("Execution levels:");
  levels.forEach((level, index) => {
    console.log(`  Level ${index + 1}: ${level.map((s) => s.name).join(", ")}`);
  });
  console.log();

  const result = await runPipeline(definition, {
    source: { value: 5 },
    target: {} as ProcessedData,
  });

  console.log("Pipeline status:", result.status);
  console.log("Errors:", result.errors.length);
  if (result.errors.length > 0) {
    console.log("  Error details:");
    result.errors.forEach((error, index) => {
      console.log(`    ${index + 1}. Step: ${error.step.name}`);
      console.log(`       Error: ${error.error instanceof Error ? error.error.message : String(error.error)}`);
    });
  }
  console.log();
  console.log("Executed steps:", result.executedSteps.map((s) => s.name).join(", "));
  console.log("Completed levels:", result.completedLevels.length);
  console.log();
  console.log("Context state:", result.context.target);
  console.log();
  console.log("Note: Pipeline stops at the level where error occurred.");
  console.log("      Subsequent levels are not executed.");
}

main().catch(console.error);

