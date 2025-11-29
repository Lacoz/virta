/**
 * Registry example: Using StepRegistry and PipelineDefinition
 * 
 * This example demonstrates how to:
 * - Register steps with string IDs using StepRegistry
 * - Convert between PipelineDefinition (intermediate model) and RegisteredStep[]
 * - Use registry to resolve step references from external formats
 */

import {
  buildLevels,
  runPipeline,
  type PipelineDefinition as CorePipelineDefinition,
  type PipelineStep,
  type TransformationContext,
} from "@virta/core";
import {
  StepRegistry,
  pipelineDefinitionToRegisteredSteps,
  registeredStepsToPipelineDefinition,
  type PipelineDefinition,
} from "@virta/registry";

type OrderData = {
  orderId: string;
  items: Array<{ price: number }>;
};

type ProcessedOrder = {
  orderId: string;
  validated: boolean;
  itemCount: number;
  total: number;
  formatted: string;
};

// Define step classes
class ValidateOrderStep implements PipelineStep<OrderData, ProcessedOrder> {
  execute(ctx: TransformationContext<OrderData, ProcessedOrder>) {
    ctx.target.validated = ctx.source.items.length > 0;
  }
}

class CountItemsStep implements PipelineStep<OrderData, ProcessedOrder> {
  execute(ctx: TransformationContext<OrderData, ProcessedOrder>) {
    ctx.target.itemCount = ctx.source.items.length;
  }
}

class CalculateTotalStep implements PipelineStep<OrderData, ProcessedOrder> {
  execute(ctx: TransformationContext<OrderData, ProcessedOrder>) {
    ctx.target.total = ctx.source.items.reduce((sum, item) => sum + item.price, 0);
  }
}

class FormatTotalStep implements PipelineStep<OrderData, ProcessedOrder> {
  execute(ctx: TransformationContext<OrderData, ProcessedOrder>) {
    ctx.target.formatted = `$${ctx.target.total.toFixed(2)}`;
  }
}

class InitializeStep implements PipelineStep<OrderData, ProcessedOrder> {
  execute(ctx: TransformationContext<OrderData, ProcessedOrder>) {
    ctx.target.orderId = ctx.source.orderId;
  }
}

async function main() {
  console.log("=== Registry Example ===\n");

  // Step 1: Create and populate registry
  const registry = new StepRegistry<OrderData, ProcessedOrder>();
  registry.register("initialize", InitializeStep);
  registry.register("validate", ValidateOrderStep);
  registry.register("count", CountItemsStep);
  registry.register("calculate", CalculateTotalStep);
  registry.register("format", FormatTotalStep);

  console.log("Registered step IDs:", registry.getRegisteredIds());
  console.log();

  // Step 2: Define pipeline using intermediate DAG model (PipelineDefinition)
  // This is how external formats (ASL, Arazzo, JSON) would represent the pipeline
  const intermediateDefinition: PipelineDefinition = {
    nodes: [
      {
        id: "init",
        type: "task",
        dependsOn: [],
        stepRef: "initialize",
      },
      {
        id: "validate",
        type: "task",
        dependsOn: ["init"],
        stepRef: "validate",
      },
      {
        id: "count",
        type: "task",
        dependsOn: ["init"],
        stepRef: "count",
      },
      {
        id: "calculate",
        type: "task",
        dependsOn: ["init"],
        stepRef: "calculate",
      },
      {
        id: "format",
        type: "task",
        dependsOn: ["calculate"],
        stepRef: "format",
      },
    ],
  };

  console.log("Intermediate PipelineDefinition (from external format):");
  console.log(JSON.stringify(intermediateDefinition, null, 2));
  console.log();

  // Step 3: Convert to core RegisteredStep[] model
  const coreDefinition = {
    steps: pipelineDefinitionToRegisteredSteps(intermediateDefinition, registry),
  };

  console.log("Converted to core RegisteredStep[] model");
  const levels = buildLevels(coreDefinition);
  console.log("Execution levels:");
  levels.forEach((level, index) => {
    console.log(`  Level ${index + 1}: ${level.map((s) => s.name).join(", ")}`);
  });
  console.log();

  // Step 4: Run the pipeline
  const result = await runPipeline(coreDefinition, {
    source: {
      orderId: "ORD-12345",
      items: [
        { price: 10.99 },
        { price: 25.50 },
        { price: 5.00 },
      ],
    },
    target: {} as ProcessedOrder,
  });

  console.log("Pipeline result:", result.status);
  console.log("Processed order:", JSON.stringify(result.context.target, null, 2));
  console.log();

  // Step 5: Convert back to intermediate model (for export)
  const exportedDefinition = registeredStepsToPipelineDefinition(
    coreDefinition.steps,
    registry
  );

  console.log("Exported PipelineDefinition (for external format):");
  console.log(JSON.stringify(exportedDefinition, null, 2));
  console.log();
  console.log("Note: Registry enables conversion between:");
  console.log("  - External formats (ASL, Arazzo, JSON) -> PipelineDefinition");
  console.log("  - PipelineDefinition -> Core RegisteredStep[]");
  console.log("  - Core RegisteredStep[] -> PipelineDefinition (for export)");
}

main().catch(console.error);


