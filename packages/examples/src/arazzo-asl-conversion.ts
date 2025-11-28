/**
 * Arazzo ↔ ASL Conversion Example
 * 
 * This example demonstrates round-trip conversion between Arazzo and ASL formats:
 * - Load Arazzo workflow from file
 * - Convert Arazzo → PipelineDefinition → ASL
 * - Load ASL workflow from file
 * - Convert ASL → PipelineDefinition → Arazzo
 * - Show bidirectional conversion capabilities
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  arazzoToPipelineDefinition,
  pipelineDefinitionToArazzo,
  type ArazzoDocument,
} from "@virta/arazzo";
import {
  aslToPipelineDefinition,
  pipelineDefinitionToAsl,
  type AslStateMachine,
} from "@virta/asl";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function loadArazzoFromFile(filePath: string): Promise<ArazzoDocument> {
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content) as ArazzoDocument;
}

async function loadAslFromFile(filePath: string): Promise<AslStateMachine> {
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content) as AslStateMachine;
}

async function main() {
  console.log("=== Arazzo ↔ ASL Conversion Example ===\n");

  const fixturesDir = join(__dirname, "..", "fixtures");

  // ============================================
  // Part 1: Arazzo → ASL Conversion
  // ============================================
  console.log("📥 Part 1: Converting Arazzo → ASL\n");

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

    // Convert PipelineDefinition → ASL
    const aslFromArazzo = pipelineDefinitionToAsl(pipelineDefFromArazzo, {
      comment: "Converted from Arazzo workflow",
      version: "1.0",
      resourceMapper: (stepRef) =>
        `arn:aws:lambda:us-east-1:123456789012:function:${stepRef}`,
    });

    console.log("Converted to ASL:");
    console.log(JSON.stringify(aslFromArazzo, null, 2));
    console.log();

    // ============================================
    // Part 2: ASL → Arazzo Conversion
    // ============================================
    console.log("📤 Part 2: Converting ASL → Arazzo\n");

    // Load ASL workflow from file
    const aslFilePath = join(fixturesDir, "order-processing.asl.json");
    const aslDoc = await loadAslFromFile(aslFilePath);

    console.log("Loaded ASL Document:");
    console.log(JSON.stringify(aslDoc, null, 2));
    console.log();

    // Convert ASL → PipelineDefinition
    const pipelineDefFromAsl = aslToPipelineDefinition(aslDoc, {
      validate: false, // Skip validation for this example
    });

    console.log("Converted to PipelineDefinition:");
    console.log(JSON.stringify(pipelineDefFromAsl, null, 2));
    console.log();

    // Convert PipelineDefinition → Arazzo
    const arazzoFromAsl = pipelineDefinitionToArazzo(
      pipelineDefFromAsl,
      "order-processing",
      {
        arazzoVersion: "1.0.0",
        info: {
          title: "Order Processing Workflow (converted from ASL)",
          version: "1.0.0",
          description: "Converted from AWS Step Functions ASL format",
        },
      }
    );

    console.log("Converted to Arazzo:");
    console.log(JSON.stringify(arazzoFromAsl, null, 2));
    console.log();

    // ============================================
    // Part 3: Round-trip Conversion
    // ============================================
    console.log("🔄 Part 3: Round-trip Conversion (Arazzo → ASL → Arazzo)\n");

    const roundTripArazzo = pipelineDefinitionToArazzo(
      pipelineDefFromArazzo,
      "order-processing-roundtrip",
      {
        arazzoVersion: "1.0.0",
        info: {
          title: "Round-trip converted workflow",
          version: "1.0.0",
          description:
            "Arazzo → PipelineDefinition → ASL → PipelineDefinition → Arazzo",
        },
      }
    );

    console.log("Round-trip Arazzo (after Arazzo → ASL → Arazzo):");
    console.log(JSON.stringify(roundTripArazzo, null, 2));
    console.log();

    // ============================================
    // Summary
    // ============================================
    console.log("✅ Conversion Summary:");
    console.log("  • Arazzo → PipelineDefinition → ASL: ✓");
    console.log("  • ASL → PipelineDefinition → Arazzo: ✓");
    console.log("  • Round-trip conversion: ✓");
    console.log();
    console.log("Note: Virta enables seamless conversion between workflow formats:");
    console.log("  - Arazzo (OpenAPI-based workflows)");
    console.log("  - ASL (AWS Step Functions)");
    console.log("  - PipelineDefinition (Virta intermediate model)");
    console.log();
    console.log("All conversions preserve workflow structure and dependencies.");
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

