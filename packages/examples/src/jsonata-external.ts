/**
 * JSONata external sources example: Loading expressions from files and URLs
 * 
 * This example demonstrates how to load JSONata expressions from:
 * - Local files
 * - HTTP/HTTPS URLs
 */

import {
  buildLevels,
  runPipeline,
  type PipelineDefinition,
  type PipelineStep,
  type TransformationContext,
} from "@virta/core";
import { JsonataStep, createJsonataStep } from "@virta/jsonata";

type OrderData = {
  orderId: string;
  items: Array<{ price: number; quantity: number }>;
};

type ProcessedOrder = {
  orderId: string;
  itemCount?: number;
  subtotal?: number;
  formattedSubtotal?: string;
};

// Initialize step
class InitializeStep implements PipelineStep<OrderData, ProcessedOrder> {
  execute(ctx: TransformationContext<OrderData, ProcessedOrder>) {
    ctx.target.orderId = ctx.source.orderId;
  }
}

// Example 1: Load from inline expression (traditional way)
class InlineExpressionStep extends JsonataStep<OrderData, ProcessedOrder> {
  constructor() {
    super({
      expression: '{"itemCount": $count(source.items)}',
    });
  }
}

// Example 2: Load from local file
class FileExpressionStep extends JsonataStep<OrderData, ProcessedOrder> {
  constructor() {
    super({
      expressionPath: "./expressions/calculate-subtotal.jsonata",
    });
  }
}

// Example 3: Load from URL (commented out - requires actual URL)
// class UrlExpressionStep extends JsonataStep<OrderData, ProcessedOrder> {
//   constructor() {
//     super({
//       expressionUrl: "https://example.com/transformations/format-total.jsonata",
//     });
//   }
// }

// Example 4: Using file path directly (same as Example 2, but shown for clarity)
class AutoDetectStepClass extends JsonataStep<OrderData, ProcessedOrder> {
  constructor() {
    super({
      expressionPath: "./expressions/format-subtotal.jsonata",
    });
  }
}

async function main() {
  console.log("=== JSONata External Sources Example ===\n");

  // Create expression files for demonstration
  const fs = await import("node:fs/promises");
  const expressionsDir = "./expressions";
  
  try {
    await fs.mkdir(expressionsDir, { recursive: true });
    await fs.writeFile(
      `${expressionsDir}/calculate-subtotal.jsonata`,
      '{"subtotal": $sum(source.items.price)}'
    );
    await fs.writeFile(
      `${expressionsDir}/format-subtotal.jsonata`,
      '{"formattedSubtotal": "$" & $string($round(target.subtotal, 2))}'
    );
  } catch (error) {
    console.error("Failed to create expression files:", error);
    return;
  }

  const definition: PipelineDefinition<OrderData, ProcessedOrder> = {
    steps: [
      { ctor: InitializeStep },
      { ctor: InlineExpressionStep, dependsOn: [InitializeStep] },
      { ctor: FileExpressionStep, dependsOn: [InlineExpressionStep] },
      { ctor: AutoDetectStepClass, dependsOn: [FileExpressionStep] },
    ],
  };

  const levels = buildLevels(definition);
  console.log("Execution levels:");
  levels.forEach((level, index) => {
    console.log(`  Level ${index + 1}: ${level.map((s) => s.name).join(", ")}`);
  });
  console.log();

  const result = await runPipeline(definition, {
    source: {
      orderId: "ORD-12345",
      items: [
        { price: 10.99, quantity: 2 },
        { price: 25.50, quantity: 1 },
      ],
    },
    target: {} as ProcessedOrder,
  });

  console.log("Pipeline result:", result.status);
  console.log("\nProcessed order:");
  console.log(JSON.stringify(result.context.target, null, 2));
  console.log("\nNote: JSONata expressions can be loaded from:");
  console.log("  - Inline expressions (expression: '...')");
  console.log("  - Local files (expressionPath: './file.jsonata')");
  console.log("  - HTTP/HTTPS URLs (expressionUrl: 'https://...')");
  console.log("  - Auto-detected via createJsonataStep()");
}

main().catch(console.error);

