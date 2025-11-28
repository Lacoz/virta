/**
 * Basic example: Simple sequential pipeline with data transformation
 * 
 * This example demonstrates a simple pipeline that processes user data
 * through multiple steps in sequence.
 */

import {
  buildLevels,
  runPipeline,
  type PipelineDefinition,
  type PipelineStep,
  type TransformationContext,
} from "@virta/core";

// Define the data types
type UserData = {
  name: string;
  email: string;
};

type ProcessedUser = {
  name: string;
  email: string;
  normalizedEmail: string;
  displayName: string;
  isValid: boolean;
};

// Step 1: Normalize email
class NormalizeEmailStep implements PipelineStep<UserData, ProcessedUser> {
  execute(ctx: TransformationContext<UserData, ProcessedUser>) {
    ctx.target.normalizedEmail = ctx.source.email.toLowerCase().trim();
  }
}

// Step 2: Create display name (depends on normalized email)
class CreateDisplayNameStep implements PipelineStep<UserData, ProcessedUser> {
  execute(ctx: TransformationContext<UserData, ProcessedUser>) {
    const [firstName, ...rest] = ctx.source.name.split(" ");
    ctx.target.displayName = `${firstName} (${ctx.target.normalizedEmail})`;
  }
}

// Step 3: Validate user data (depends on both previous steps)
class ValidateUserStep implements PipelineStep<UserData, ProcessedUser> {
  execute(ctx: TransformationContext<UserData, ProcessedUser>) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    ctx.target.isValid =
      emailRegex.test(ctx.target.normalizedEmail) &&
      ctx.target.displayName.length > 0;
  }
}

// Initialize target with source data
class InitializeStep implements PipelineStep<UserData, ProcessedUser> {
  execute(ctx: TransformationContext<UserData, ProcessedUser>) {
    ctx.target.name = ctx.source.name;
    ctx.target.email = ctx.source.email;
  }
}

async function main() {
  console.log("=== Basic Pipeline Example ===\n");

  // Define the pipeline
  const definition: PipelineDefinition<UserData, ProcessedUser> = {
    steps: [
      { ctor: InitializeStep },
      { ctor: NormalizeEmailStep, dependsOn: [InitializeStep] },
      { ctor: CreateDisplayNameStep, dependsOn: [NormalizeEmailStep] },
      { ctor: ValidateUserStep, dependsOn: [CreateDisplayNameStep, NormalizeEmailStep] },
    ],
  };

  // Show the execution levels
  const levels = buildLevels(definition);
  console.log("Execution levels:");
  levels.forEach((level, index) => {
    console.log(`  Level ${index + 1}: ${level.map((s) => s.name).join(", ")}`);
  });
  console.log();

  // Run the pipeline
  const result = await runPipeline(definition, {
    source: {
      name: "John Doe",
      email: "  JOHN.DOE@EXAMPLE.COM  ",
    },
    target: {} as ProcessedUser,
  });

  // Display results
  console.log("Pipeline result:", result.status);
  console.log("Processed user:", result.context.target);
  console.log("Executed steps:", result.executedSteps.length);
  console.log("Completed levels:", result.completedLevels.length);
}

main().catch(console.error);

