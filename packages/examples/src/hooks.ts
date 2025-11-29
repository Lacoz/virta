/**
 * Hooks example: Using lifecycle hooks for monitoring and logging
 * 
 * This example demonstrates how to use pipeline hooks to monitor
 * execution, log progress, and track performance.
 */

import {
  buildLevels,
  runPipeline,
  type PipelineDefinition,
  type PipelineHooks,
  type PipelineStep,
  type TransformationContext,
} from "@virta/core";

type OrderData = {
  orderId: string;
  items: string[];
};

type ProcessedOrder = {
  orderId: string;
  items: string[];
  validated: boolean;
  priced: boolean;
  inventoryChecked: boolean;
  ready: boolean;
};

class ValidateOrderStep implements PipelineStep<OrderData, ProcessedOrder> {
  async execute(ctx: TransformationContext<OrderData, ProcessedOrder>) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    ctx.target.validated = ctx.source.items.length > 0;
  }
}

class PriceOrderStep implements PipelineStep<OrderData, ProcessedOrder> {
  async execute(ctx: TransformationContext<OrderData, ProcessedOrder>) {
    await new Promise((resolve) => setTimeout(resolve, 30));
    ctx.target.priced = true;
  }
}

class CheckInventoryStep implements PipelineStep<OrderData, ProcessedOrder> {
  async execute(ctx: TransformationContext<OrderData, ProcessedOrder>) {
    await new Promise((resolve) => setTimeout(resolve, 40));
    ctx.target.inventoryChecked = true;
  }
}

class FinalizeOrderStep implements PipelineStep<OrderData, ProcessedOrder> {
  execute(ctx: TransformationContext<OrderData, ProcessedOrder>) {
    ctx.target.ready =
      ctx.target.validated && ctx.target.priced && ctx.target.inventoryChecked;
  }
}

class InitializeStep implements PipelineStep<OrderData, ProcessedOrder> {
  execute(ctx: TransformationContext<OrderData, ProcessedOrder>) {
    ctx.target.orderId = ctx.source.orderId;
    ctx.target.items = [...ctx.source.items];
  }
}

async function main() {
  console.log("=== Hooks Example ===\n");

  const definition: PipelineDefinition<OrderData, ProcessedOrder> = {
    steps: [
      { ctor: InitializeStep },
      { ctor: ValidateOrderStep, dependsOn: [InitializeStep] },
      { ctor: PriceOrderStep, dependsOn: [InitializeStep] },
      { ctor: CheckInventoryStep, dependsOn: [InitializeStep] },
      {
        ctor: FinalizeOrderStep,
        dependsOn: [ValidateOrderStep, PriceOrderStep, CheckInventoryStep],
      },
    ],
  };

  const levels = buildLevels(definition);
  console.log("Pipeline structure:");
  levels.forEach((level, index) => {
    console.log(`  Level ${index + 1}: ${level.map((s) => s.name).join(", ")}`);
  });
  console.log();

  // Define hooks for monitoring
  const hooks: PipelineHooks<OrderData, ProcessedOrder> = {
    onLevelStart: (level, ctx) => {
      const stepNames = level.map((s) => s.name).join(", ");
      console.log(`🚀 Level started: ${stepNames}`);
    },
    onLevelComplete: (level, ctx) => {
      const stepNames = level.map((s) => s.name).join(", ");
      console.log(`✅ Level completed: ${stepNames}`);
    },
    onStepStart: (step, ctx) => {
      console.log(`  → Starting: ${step.name}`);
    },
    onStepSuccess: (step, ctx) => {
      console.log(`  ✓ Completed: ${step.name}`);
    },
    onStepError: (step, error, ctx) => {
      console.log(`  ✗ Failed: ${step.name} - ${error instanceof Error ? error.message : String(error)}`);
    },
    onPipelineComplete: (result) => {
      console.log();
      console.log("📊 Pipeline Summary:");
      console.log(`   Status: ${result.status}`);
      console.log(`   Executed steps: ${result.executedSteps.length}`);
      console.log(`   Completed levels: ${result.completedLevels.length}`);
      console.log(`   Errors: ${result.errors.length}`);
    },
  };

  console.log("Running pipeline with hooks...\n");

  const result = await runPipeline(definition, {
    source: {
      orderId: "ORD-12345",
      items: ["item1", "item2", "item3"],
    },
    target: {} as ProcessedOrder,
    hooks,
  });

  console.log();
  console.log("Final order state:", result.context.target);
}

main().catch(console.error);


