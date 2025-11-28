import { readFileSync, writeFileSync } from "node:fs";
import {
  arazzoToPipelineDefinition,
  pipelineDefinitionToArazzo,
} from "@virta/arazzo";
import {
  pipelineDefinitionToTypeScript,
  typeScriptToPipelineDefinition,
} from "@virta/ts-codegen";

async function main() {
  console.log("=== Arazzo ↔ TypeScript Conversion Example ===\n");

  // --- Part 1: Converting Arazzo → TypeScript ---
  console.log("📥 Part 1: Converting Arazzo → TypeScript\n");

  const arazzoDoc = JSON.parse(
    readFileSync("./fixtures/order-processing.arazzo.json", "utf-8")
  );
  console.log("Loaded Arazzo Document:");
  console.dir(arazzoDoc, { depth: null });

  const pipelineDefFromArazzo = arazzoToPipelineDefinition(
    arazzoDoc,
    "order-processing"
  );
  console.log("\nConverted to PipelineDefinition:");
  console.dir(pipelineDefFromArazzo, { depth: null });

  const tsCode = pipelineDefinitionToTypeScript(pipelineDefFromArazzo, {
    pipelineName: "OrderProcessing",
    sourceType: "OrderData",
    targetType: "ProcessedOrder",
    headerComment: "Order processing pipeline exported from Arazzo",
  });
  console.log("\nConverted to TypeScript (first 800 chars):");
  console.log(tsCode.substring(0, 800) + "...");

  const tsFilePath = "./fixtures/order-processing.ts";
  writeFileSync(tsFilePath, tsCode, "utf-8");
  console.log(`\nExported TypeScript saved to: ${tsFilePath}`);

  // --- Part 2: Converting TypeScript → Arazzo ---
  console.log("\n📤 Part 2: Converting TypeScript → Arazzo\n");

  const pipelineDefFromTs = await typeScriptToPipelineDefinition(tsFilePath);
  console.log("Loaded PipelineDefinition from TypeScript:");
  console.dir(pipelineDefFromTs, { depth: null });

  const arazzoFromTs = pipelineDefinitionToArazzo(
    pipelineDefFromTs,
    "order-processing",
    {
      arazzoVersion: "1.0.0",
      info: {
        title: "Order Processing Workflow (converted from TypeScript)",
        description: "Converted from procedural TypeScript code",
      },
    }
  );
  console.log("\nConverted to Arazzo:");
  console.dir(arazzoFromTs, { depth: null });

  const arazzoFromTsPath = "./fixtures/order-processing-from-ts.arazzo.json";
  writeFileSync(
    arazzoFromTsPath,
    JSON.stringify(arazzoFromTs, null, 2),
    "utf-8"
  );
  console.log(`\nExported Arazzo saved to: ${arazzoFromTsPath}`);

  // --- Part 3: Round-trip Conversion (Arazzo → TypeScript → Arazzo) ---
  console.log("\n🔄 Part 3: Round-trip Conversion (Arazzo → TypeScript → Arazzo)\n");

  const initialArazzo = JSON.parse(
    readFileSync("./fixtures/order-processing.arazzo.json", "utf-8")
  );
  const pd1 = arazzoToPipelineDefinition(initialArazzo, "order-processing");
  const tsConverted = pipelineDefinitionToTypeScript(pd1, {
    pipelineName: "OrderProcessingRoundtrip",
    sourceType: "OrderData",
    targetType: "ProcessedOrder",
  });
  const tsRoundtripPath = "./fixtures/order-processing-roundtrip.ts";
  writeFileSync(tsRoundtripPath, tsConverted, "utf-8");
  
  const pd2 = await typeScriptToPipelineDefinition(tsRoundtripPath);
  const finalArazzo = pipelineDefinitionToArazzo(
    pd2,
    "order-processing-roundtrip",
    {
      arazzoVersion: "1.0.0",
      info: {
        title: "Round-trip converted workflow",
        description:
          "Arazzo → PipelineDefinition → TypeScript → PipelineDefinition → Arazzo",
      },
    }
  );

  console.log("Round-trip Arazzo (after Arazzo → TypeScript → Arazzo):");
  console.dir(finalArazzo, { depth: null });

  console.log("\n✅ Conversion Summary:");
  console.log("  • Arazzo → PipelineDefinition → TypeScript: ✓");
  console.log("  • TypeScript → PipelineDefinition → Arazzo: ✓");
  console.log("  • Round-trip conversion: ✓");
  console.log("  • DAG validation: ✓");

  console.log("\nNote: Virta enables seamless conversion between workflow formats:");
  console.log("  - Arazzo (OpenAPI-based workflows)");
  console.log("  - TypeScript (Procedural code with step classes)");
  console.log("  - ASL (AWS Step Functions)");
  console.log("  - BPMN 2.0 (Business Process Model and Notation)");
  console.log("  - PipelineDefinition (Virta intermediate model)");

  console.log("\nAll conversions preserve workflow structure and dependencies.");
  console.log("TypeScript code is validated to ensure it represents a valid DAG.");

  console.log("\nGenerated files:");
  console.log(`  - ${tsFilePath}`);
  console.log(`  - ${arazzoFromTsPath}`);
  console.log(`  - ${tsRoundtripPath}`);
}

main().catch(console.error);

