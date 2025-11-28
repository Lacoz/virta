/**
 * ASL (Amazon States Language) example: Import and export workflows
 * 
 * This example demonstrates how to:
 * - Import ASL definitions to Virta PipelineDefinition
 * - Export PipelineDefinition to ASL format
 * - Use ASL with StepRegistry for execution
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
  aslToPipelineDefinition,
  pipelineDefinitionToAsl,
  type AslStateMachine,
  type AslTaskState,
} from "@virta/asl";

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
  console.log("=== ASL Import/Export Example ===\n");

  // Step 1: Define ASL state machine (as it would appear in AWS Step Functions)
  const aslDefinition: AslStateMachine = {
    Comment: "Order processing workflow",
    StartAt: "ValidateOrder",
    States: {
      ValidateOrder: {
        Type: "Task",
        Resource: "arn:aws:lambda:us-east-1:123456789012:function:ValidateOrder",
        Next: "ProcessOrder",
      } as AslTaskState,
      ProcessOrder: {
        Type: "Task",
        Resource: "arn:aws:lambda:us-east-1:123456789012:function:ProcessOrder",
        Next: "FormatOrder",
      } as AslTaskState,
      FormatOrder: {
        Type: "Task",
        Resource: "arn:aws:lambda:us-east-1:123456789012:function:FormatOrder",
        End: true,
      } as AslTaskState,
    },
  };

  console.log("Original ASL Definition:");
  console.log(JSON.stringify(aslDefinition, null, 2));
  console.log();

  // Step 2: Import ASL to PipelineDefinition
  const pipelineDef = aslToPipelineDefinition(aslDefinition);

  console.log("Converted to PipelineDefinition:");
  console.log(JSON.stringify(pipelineDef, null, 2));
  console.log();

  // Step 3: Create registry and register steps
  const registry = new StepRegistry<OrderData, ProcessedOrder>();
  registry.register("ValidateOrder", ValidateOrderStep);
  registry.register("ProcessOrder", ProcessOrderStep);
  registry.register("FormatOrder", FormatOrderStep);

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

  // Step 6: Export back to ASL
  const exportedAsl = pipelineDefinitionToAsl(pipelineDef, {
    comment: "Exported from Virta",
    version: "1.0",
    resourceMapper: (stepRef) =>
      `arn:aws:lambda:us-east-1:123456789012:function:${stepRef}`,
  });

  console.log("Exported ASL Definition:");
  console.log(JSON.stringify(exportedAsl, null, 2));
  console.log();
  console.log("Note: ASL enables round-trip conversion between:");
  console.log("  - AWS Step Functions ASL → Virta PipelineDefinition");
  console.log("  - Virta PipelineDefinition → AWS Step Functions ASL");
}

main().catch(console.error);

