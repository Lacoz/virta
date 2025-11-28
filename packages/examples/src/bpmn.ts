/**
 * BPMN example: Import and export workflows using BPMN 2.0 format
 * 
 * This example demonstrates how to:
 * - Import BPMN XML documents to Virta PipelineDefinition
 * - Export PipelineDefinition to BPMN XML
 * - Use BPMN with StepRegistry for execution
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
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
} from "@virta/registry";
import {
  bpmnToPipelineDefinition,
  pipelineDefinitionToBpmn,
} from "@virta/bpmn";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  console.log("=== BPMN Import/Export Example ===\n");

  const fixturesDir = join(__dirname, "..", "fixtures");

  // Step 1: Load BPMN XML from file
  const bpmnFilePath = join(fixturesDir, "order-processing.bpmn");
  const bpmnXml = await readFile(bpmnFilePath, "utf-8");

  console.log("Loaded BPMN XML (first 500 chars):");
  console.log(bpmnXml.substring(0, 500) + "...\n");

  // Step 2: Import BPMN to PipelineDefinition
  const pipelineDef = await bpmnToPipelineDefinition(bpmnXml);

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

  // Step 6: Export back to BPMN
  const exportedBpmnXml = await pipelineDefinitionToBpmn(pipelineDef, {
    processId: "Process_Exported",
    processName: "Order Processing (Exported from Virta)",
    targetNamespace: "http://virta.io/schema/bpmn",
  });

  console.log("Exported BPMN XML (first 500 chars):");
  console.log(exportedBpmnXml.substring(0, 500) + "...\n");

  // Step 7: Save exported BPMN to file
  const exportedBpmnPath = join(fixturesDir, "order-processing-exported.bpmn");
  await writeFile(exportedBpmnPath, exportedBpmnXml, "utf-8");
  console.log(`Exported BPMN saved to: ${exportedBpmnPath}\n`);

  console.log("Note: BPMN enables round-trip conversion between:");
  console.log("  - BPMN 2.0 XML → Virta PipelineDefinition");
  console.log("  - Virta PipelineDefinition → BPMN 2.0 XML");
  console.log();
  console.log("BPMN files can be opened in tools like:");
  console.log("  - Camunda Modeler");
  console.log("  - bpmn.io Modeler");
  console.log("  - Other BPMN 2.0 compatible tools");
}

main().catch(console.error);

