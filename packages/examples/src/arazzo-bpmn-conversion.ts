/**
 * Arazzo ↔ BPMN Conversion Example
 * 
 * This example demonstrates round-trip conversion between Arazzo and BPMN formats:
 * - Load Arazzo workflow from file
 * - Convert Arazzo → PipelineDefinition → BPMN
 * - Load BPMN workflow from file
 * - Convert BPMN → PipelineDefinition → Arazzo
 * - Show bidirectional conversion capabilities
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  arazzoToPipelineDefinition,
  pipelineDefinitionToArazzo,
  type ArazzoDocument,
} from "@virta/arazzo";
import {
  bpmnToPipelineDefinition,
  pipelineDefinitionToBpmn,
} from "@virta/bpmn";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function loadArazzoFromFile(filePath: string): Promise<ArazzoDocument> {
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content) as ArazzoDocument;
}

async function main() {
  console.log("=== Arazzo ↔ BPMN Conversion Example ===\n");

  const fixturesDir = join(__dirname, "..", "fixtures");

  // ============================================
  // Part 1: Arazzo → BPMN Conversion
  // ============================================
  console.log("📥 Part 1: Converting Arazzo → BPMN\n");

  try {
    // Load Arazzo workflow from file
    const arazzoFilePath = join(fixturesDir, "order-processing.arazzo.json");
    const arazzoDoc = await loadArazzoFromFile(arazzoFilePath);

    console.log("Loaded Arazzo Document:");
    console.log(JSON.stringify(arazzoDoc, null, 2));
    console.log();

    // Convert Arazzo → PipelineDefinition
    const pipelineDefFromArazzo = arazzoToPipelineDefinition(
      arazzoDoc,
      "order-processing"
    );

    console.log("Converted to PipelineDefinition:");
    console.log(JSON.stringify(pipelineDefFromArazzo, null, 2));
    console.log();

    // Convert PipelineDefinition → BPMN
    const bpmnFromArazzo = await pipelineDefinitionToBpmn(
      pipelineDefFromArazzo,
      {
        processId: "Process_FromArazzo",
        processName: "Order Processing (converted from Arazzo)",
        targetNamespace: "http://virta.io/schema/bpmn",
      }
    );

    console.log("Converted to BPMN XML (first 600 chars):");
    console.log(bpmnFromArazzo.substring(0, 600) + "...\n");

    // Save exported BPMN
    const exportedBpmnPath = join(
      fixturesDir,
      "order-processing-from-arazzo.bpmn"
    );
    await writeFile(exportedBpmnPath, bpmnFromArazzo, "utf-8");
    console.log(`Exported BPMN saved to: ${exportedBpmnPath}\n`);

    // ============================================
    // Part 2: BPMN → Arazzo Conversion
    // ============================================
    console.log("📤 Part 2: Converting BPMN → Arazzo\n");

    // Load BPMN workflow from file
    const bpmnFilePath = join(fixturesDir, "order-processing.bpmn");
    const bpmnXml = await readFile(bpmnFilePath, "utf-8");

    console.log("Loaded BPMN XML (first 500 chars):");
    console.log(bpmnXml.substring(0, 500) + "...\n");

    // Convert BPMN → PipelineDefinition
    const pipelineDefFromBpmn = await bpmnToPipelineDefinition(bpmnXml);

    console.log("Converted to PipelineDefinition:");
    console.log(JSON.stringify(pipelineDefFromBpmn, null, 2));
    console.log();

    // Convert PipelineDefinition → Arazzo
    const arazzoFromBpmn = pipelineDefinitionToArazzo(
      pipelineDefFromBpmn,
      "order-processing",
      {
        arazzoVersion: "1.0.0",
        info: {
          title: "Order Processing Workflow (converted from BPMN)",
          version: "1.0.0",
          description: "Converted from BPMN 2.0 XML format",
        },
      }
    );

    console.log("Converted to Arazzo:");
    console.log(JSON.stringify(arazzoFromBpmn, null, 2));
    console.log();

    // Save exported Arazzo
    const exportedArazzoPath = join(
      fixturesDir,
      "order-processing-from-bpmn.arazzo.json"
    );
    await writeFile(
      exportedArazzoPath,
      JSON.stringify(arazzoFromBpmn, null, 2),
      "utf-8"
    );
    console.log(`Exported Arazzo saved to: ${exportedArazzoPath}\n`);

    // ============================================
    // Part 3: Round-trip Conversion
    // ============================================
    console.log("🔄 Part 3: Round-trip Conversion (Arazzo → BPMN → Arazzo)\n");

    const roundTripArazzo = pipelineDefinitionToArazzo(
      pipelineDefFromArazzo,
      "order-processing-roundtrip",
      {
        arazzoVersion: "1.0.0",
        info: {
          title: "Round-trip converted workflow",
          version: "1.0.0",
          description:
            "Arazzo → PipelineDefinition → BPMN → PipelineDefinition → Arazzo",
        },
      }
    );

    console.log("Round-trip Arazzo (after Arazzo → BPMN → Arazzo):");
    console.log(JSON.stringify(roundTripArazzo, null, 2));
    console.log();

    // ============================================
    // Summary
    // ============================================
    console.log("✅ Conversion Summary:");
    console.log("  • Arazzo → PipelineDefinition → BPMN: ✓");
    console.log("  • BPMN → PipelineDefinition → Arazzo: ✓");
    console.log("  • Round-trip conversion: ✓");
    console.log();
    console.log("Note: Virta enables seamless conversion between workflow formats:");
    console.log("  - Arazzo (OpenAPI-based workflows)");
    console.log("  - BPMN 2.0 (Business Process Model and Notation)");
    console.log("  - ASL (AWS Step Functions)");
    console.log("  - PipelineDefinition (Virta intermediate model)");
    console.log();
    console.log("All conversions preserve workflow structure and dependencies.");
    console.log();
    console.log("Generated files:");
    console.log(`  - ${exportedBpmnPath}`);
    console.log(`  - ${exportedArazzoPath}`);
  } catch (error) {
    console.error("Error during conversion:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Stack:", error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);

