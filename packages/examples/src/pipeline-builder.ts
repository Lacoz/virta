/**
 * PipelineBuilder example: Complex e-commerce order processing pipeline
 *
 * This example demonstrates PipelineBuilder with:
 * - Multiple parallel execution branches
 * - Complex dependency chains
 * - Step metadata (timing, execution hints)
 * - Integration with planner
 * - Comparison with explicit approach
 */

import {
  PipelineBuilder,
  buildLevels,
  runPipeline,
  type PipelineStep,
  type TransformationContext,
} from "@virta/core";
import { StepRegistry, registeredStepsToPipelineDefinition } from "@virta/registry";
import { planExecution } from "@virta/planner";

// Data types
type OrderData = {
  orderId: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number; price: number }>;
  shippingAddress: string;
  paymentMethod: string;
};

type ProcessedOrder = {
  orderId: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number; price: number }>;
  shippingAddress: string;
  paymentMethod: string;
  totalAmount: number;
  itemCount: number;
  isValid: boolean;
  inventoryChecked: boolean;
  paymentValidated: boolean;
  shippingCalculated: boolean;
  shippingCost: number;
  finalAmount: number;
  readyToShip: boolean;
};

// Step implementations
class InitializeOrderStep implements PipelineStep<OrderData, ProcessedOrder> {
  execute(ctx: TransformationContext<OrderData, ProcessedOrder>) {
    ctx.target.orderId = ctx.source.orderId;
    ctx.target.customerId = ctx.source.customerId;
    ctx.target.items = ctx.source.items;
    ctx.target.shippingAddress = ctx.source.shippingAddress;
    ctx.target.paymentMethod = ctx.source.paymentMethod;
  }
}

class CalculateTotalStep implements PipelineStep<OrderData, ProcessedOrder> {
  execute(ctx: TransformationContext<OrderData, ProcessedOrder>) {
    ctx.target.totalAmount = ctx.source.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
  }
}

class CountItemsStep implements PipelineStep<OrderData, ProcessedOrder> {
  execute(ctx: TransformationContext<OrderData, ProcessedOrder>) {
    ctx.target.itemCount = ctx.source.items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
  }
}

class ValidateOrderStep implements PipelineStep<OrderData, ProcessedOrder> {
  execute(ctx: TransformationContext<OrderData, ProcessedOrder>) {
    ctx.target.isValid =
      ctx.target.totalAmount > 0 &&
      ctx.target.itemCount > 0 &&
      ctx.target.shippingAddress.length > 0;
  }
}

class CheckInventoryStep implements PipelineStep<OrderData, ProcessedOrder> {
  async execute(ctx: TransformationContext<OrderData, ProcessedOrder>) {
    // Simulate async inventory check
    await new Promise((resolve) => setTimeout(resolve, 50));
    ctx.target.inventoryChecked = true;
  }
}

class ValidatePaymentStep implements PipelineStep<OrderData, ProcessedOrder> {
  async execute(ctx: TransformationContext<OrderData, ProcessedOrder>) {
    // Simulate async payment validation
    await new Promise((resolve) => setTimeout(resolve, 80));
    ctx.target.paymentValidated = ctx.source.paymentMethod.length > 0;
  }
}

class CalculateShippingStep implements PipelineStep<OrderData, ProcessedOrder> {
  async execute(ctx: TransformationContext<OrderData, ProcessedOrder>) {
    // Simulate async shipping calculation
    await new Promise((resolve) => setTimeout(resolve, 60));
    ctx.target.shippingCalculated = true;
    ctx.target.shippingCost = ctx.target.itemCount * 2.5; // $2.50 per item
  }
}

class CalculateFinalAmountStep implements PipelineStep<OrderData, ProcessedOrder> {
  execute(ctx: TransformationContext<OrderData, ProcessedOrder>) {
    ctx.target.finalAmount = ctx.target.totalAmount + ctx.target.shippingCost;
  }
}

class FinalizeOrderStep implements PipelineStep<OrderData, ProcessedOrder> {
  execute(ctx: TransformationContext<OrderData, ProcessedOrder>) {
    ctx.target.readyToShip =
      ctx.target.isValid &&
      ctx.target.inventoryChecked &&
      ctx.target.paymentValidated &&
      ctx.target.shippingCalculated;
  }
}

async function main() {
  console.log("=== PipelineBuilder: Complex Order Processing ===\n");

  // Build pipeline using PipelineBuilder
  const pipeline = new PipelineBuilder<OrderData, ProcessedOrder>()
    .add(InitializeOrderStep)
    // Parallel branch 1: Calculations
    .add(CalculateTotalStep, {
      dependsOn: [InitializeOrderStep],
      meta: {
        timing: { p50Ms: 10, p99Ms: 20 },
        executionHint: "lambda-only",
      },
    })
    .add(CountItemsStep, {
      dependsOn: [InitializeOrderStep],
      meta: {
        timing: { p50Ms: 10, p99Ms: 20 },
        executionHint: "lambda-only",
      },
    })
    // Validation depends on calculations
    .add(ValidateOrderStep, {
      dependsOn: [CalculateTotalStep, CountItemsStep],
      meta: {
        timing: { p50Ms: 5, p99Ms: 10 },
        executionHint: "lambda-only",
      },
    })
    // Parallel branch 2: External services (can run in parallel)
    .add(CheckInventoryStep, {
      dependsOn: [ValidateOrderStep],
      meta: {
        timing: { p50Ms: 50, p99Ms: 100 },
        executionHint: "lambda-only",
      },
    })
    .add(ValidatePaymentStep, {
      dependsOn: [ValidateOrderStep],
      meta: {
        timing: { p50Ms: 80, p99Ms: 150 },
        executionHint: "lambda-only",
      },
    })
    .add(CalculateShippingStep, {
      dependsOn: [CountItemsStep],
      meta: {
        timing: { p50Ms: 60, p99Ms: 120 },
        executionHint: "lambda-only",
      },
    })
    // Final calculations
    .add(CalculateFinalAmountStep, {
      dependsOn: [CalculateTotalStep, CalculateShippingStep],
      meta: {
        timing: { p50Ms: 5, p99Ms: 10 },
        executionHint: "lambda-only",
      },
    })
    // Final step depends on all validations
    .add(FinalizeOrderStep, {
      dependsOn: [CheckInventoryStep, ValidatePaymentStep, CalculateFinalAmountStep],
      meta: {
        timing: { p50Ms: 5, p99Ms: 10 },
        executionHint: "lambda-only",
      },
    })
    .build();

  console.log("Pipeline built with PipelineBuilder");
  console.log(`Total steps: ${pipeline.steps.length}\n`);

  // Show execution levels
  const levels = buildLevels(pipeline);
  console.log("Execution levels (steps in same level run in parallel):");
  levels.forEach((level, index) => {
    const stepNames = level.map((s) => s.name);
    console.log(`  Level ${index + 1}: ${stepNames.join(", ")}`);
    if (level.length > 1) {
      console.log(`    ⚡ ${level.length} steps will execute in parallel`);
    }
  });
  console.log();

  // Run the pipeline
  const orderData: OrderData = {
    orderId: "ORD-12345",
    customerId: "CUST-789",
    items: [
      { productId: "PROD-1", quantity: 2, price: 29.99 },
      { productId: "PROD-2", quantity: 1, price: 49.99 },
    ],
    shippingAddress: "123 Main St, City, State 12345",
    paymentMethod: "credit-card",
  };

  const startTime = Date.now();
  const result = await runPipeline(pipeline, {
    source: orderData,
    target: {} as ProcessedOrder,
  });
  const duration = Date.now() - startTime;

  console.log("Pipeline execution result:");
  console.log(`  Status: ${result.status}`);
  console.log(`  Execution time: ${duration}ms`);
  console.log(`  Executed steps: ${result.executedSteps.length}`);
  console.log(`  Completed levels: ${result.completedLevels.length}`);
  console.log();

  console.log("Processed order:");
  console.log(JSON.stringify(result.context.target, null, 2));
  console.log();

  // Demonstrate integration with planner
  console.log("=== Integration with Planner ===\n");

  // Create registry for planner conversion
  const registry = new StepRegistry<OrderData, ProcessedOrder>();
  registry.register("initialize", InitializeOrderStep);
  registry.register("calculateTotal", CalculateTotalStep);
  registry.register("countItems", CountItemsStep);
  registry.register("validate", ValidateOrderStep);
  registry.register("checkInventory", CheckInventoryStep);
  registry.register("validatePayment", ValidatePaymentStep);
  registry.register("calculateShipping", CalculateShippingStep);
  registry.register("calculateFinal", CalculateFinalAmountStep);
  registry.register("finalize", FinalizeOrderStep);

  // Convert to registry format for planner
  const registryPipeline = registeredStepsToPipelineDefinition(pipeline.steps, registry);

  // Create metadata map for planner
  const metadataByNodeId = {
    initialize: { timing: { p50Ms: 5, p99Ms: 10 } },
    calculateTotal: { timing: { p50Ms: 10, p99Ms: 20 } },
    countItems: { timing: { p50Ms: 10, p99Ms: 20 } },
    validate: { timing: { p50Ms: 5, p99Ms: 10 } },
    checkInventory: { timing: { p50Ms: 50, p99Ms: 100 } },
    validatePayment: { timing: { p50Ms: 80, p99Ms: 150 } },
    calculateShipping: { timing: { p50Ms: 60, p99Ms: 120 } },
    calculateFinal: { timing: { p50Ms: 5, p99Ms: 10 } },
    finalize: { timing: { p50Ms: 5, p99Ms: 10 } },
  };

  // Plan execution
  const plan = planExecution(registryPipeline, metadataByNodeId, {
    lambdaMaxMs: 720000, // 12 minutes
  });

  console.log("Execution plan:");
  console.log(`  Mode: ${plan.mode}`);
  console.log(`  Critical path: ${plan.criticalPath.nodeIds.join(" → ")}`);
  console.log(`  Critical path timing (p99): ${plan.criticalPath.timing.pessimisticMs}ms`);
  console.log("  Reasoning:");
  plan.reasoning.forEach((r) => console.log(`    - ${r}`));
  console.log();

  // Comparison with explicit approach
  console.log("=== Comparison: PipelineBuilder vs Explicit ===\n");
  console.log("PipelineBuilder advantages:");
  console.log("  ✓ Fluent API - easier to read and maintain");
  console.log("  ✓ Method chaining - natural flow");
  console.log("  ✓ Less boilerplate - no need to manually construct steps array");
  console.log("  ✓ Same functionality - produces identical PipelineDefinition");
  console.log();
  console.log("Both approaches are valid - choose based on preference!");
}

main().catch(console.error);

