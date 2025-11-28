/**
 * Arazzo example: Import and export workflows using Arazzo format
 * 
 * This example demonstrates how to:
 * - Import Arazzo workflow documents to Virta PipelineDefinition
 * - Export PipelineDefinition to Arazzo format
 * - Use Arazzo with StepRegistry for execution
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
} from "@virta/registry";
import {
  arazzoToPipelineDefinition,
  pipelineDefinitionToArazzo,
  type ArazzoDocument,
} from "@virta/arazzo";

type OrderData = {
  orderId: string;
  amount: number;
  status: string;
};

type ProcessedOrder = {
  orderId: string;
  validated: boolean;
  processed: boolean;
  formatted: string;
};

// Define step classes
class ValidateOrderStep implements PipelineStep<OrderData, ProcessedOrder> {
  execute(ctx: TransformationContext<OrderData, ProcessedOrder>) {
    ctx.target.validated = ctx.source.amount > 0;
  }
}

class ProcessOrderStep implements PipelineStep<OrderData, ProcessedOrder> {
  execute(ctx: TransformationContext<OrderData, ProcessedOrder>) {
    ctx.target.processed = ctx.target.validated === true;
  }
}

class FormatOrderStep implements PipelineStep<OrderData, ProcessedOrder> {
  execute(ctx: TransformationContext<OrderData, ProcessedOrder>) {
    ctx.target.formatted = `Order ${ctx.target.orderId}: $${ctx.source.amount}`;
  }
}

async function main() {
  console.log("=== Arazzo Import/Export Example ===\n");

  // Step 1: Define Arazzo workflow document (as it would appear in OpenAPI tools)
  const arazzoDoc: ArazzoDocument = {
    arazzo: "1.0.0",
    info: {
      title: "Order Processing Workflow",
      version: "1.0.0",
      description: "Processes orders through validation, processing, and formatting",
    },
    scenarios: {
      "order-processing": {
        description: "Main order processing scenario",
        steps: [
          {
            id: "validate",
            type: "operation",
            operationId: "validateOrder",
            description: "Validate the order",
          },
          {
            id: "process",
            type: "operation",
            operationId: "processOrder",
            description: "Process the validated order",
            runAfter: ["validate"],
          },
          {
            id: "format",
            type: "operation",
            operationId: "formatOrder",
            description: "Format the processed order",
            runAfter: ["process"],
          },
        ],
      },
    },
  };

  console.log("Original Arazzo Document:");
  console.log(JSON.stringify(arazzoDoc, null, 2));
  console.log();

  // Step 2: Import Arazzo to PipelineDefinition
  const pipelineDef = arazzoToPipelineDefinition(arazzoDoc, "order-processing");

  console.log("Converted to PipelineDefinition:");
  console.log(JSON.stringify(pipelineDef, null, 2));
  console.log();

  // Step 3: Create registry and register steps
  const registry = new StepRegistry<OrderData, ProcessedOrder>();
  registry.register("validateOrder", ValidateOrderStep);
  registry.register("processOrder", ProcessOrderStep);
  registry.register("formatOrder", FormatOrderStep);

  // Step 4: Convert to core RegisteredStep[] model
  const coreDefinition = {
    steps: pipelineDefinitionToRegisteredSteps(pipelineDef, registry),
  };

  console.log("Converted to core RegisteredStep[] model");
  const levels = buildLevels(coreDefinition);
  console.log("Execution levels:");
  levels.forEach((level, index) => {
    console.log(`  Level ${index + 1}: ${level.map((s) => s.name).join(", ")}`);
  });
  console.log();

  // Step 5: Run the pipeline
  const result = await runPipeline(coreDefinition, {
    source: {
      orderId: "ORD-12345",
      amount: 99.99,
      status: "pending",
    },
    target: {} as ProcessedOrder,
  });

  console.log("Pipeline result:", result.status);
  console.log("Processed order:", JSON.stringify(result.context.target, null, 2));
  console.log();

  // Step 6: Export back to Arazzo
  const exportedArazzo = pipelineDefinitionToArazzo(pipelineDef, "order-processing", {
    arazzoVersion: "1.0.0",
    info: {
      title: "Exported Order Processing Workflow",
      version: "1.0.0",
      description: "Exported from Virta",
    },
  });

  console.log("Exported Arazzo Document:");
  console.log(JSON.stringify(exportedArazzo, null, 2));
  console.log();
  console.log("Note: Arazzo enables round-trip conversion between:");
  console.log("  - OpenAPI Arazzo workflows → Virta PipelineDefinition");
  console.log("  - Virta PipelineDefinition → OpenAPI Arazzo workflows");
}

main().catch(console.error);

