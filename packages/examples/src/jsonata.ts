/**
 * JSONata example: Using JSONata expressions for data transformation
 * 
 * This example demonstrates how to use JSONata expressions within
 * pipeline steps to perform complex data transformations and calculations.
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
  customer: {
    name: string;
    email: string;
  };
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }>;
};

type ProcessedOrder = {
  orderId: string;
  customerName?: string;
  customerEmail?: string;
  itemCount?: number;
  subtotal?: number;
  tax?: number;
  total?: number;
  averageItemPrice?: number;
  formattedTotal?: string;
};

// Initialize step
class InitializeStep implements PipelineStep<OrderData, ProcessedOrder> {
  execute(ctx: TransformationContext<OrderData, ProcessedOrder>) {
    ctx.target.orderId = ctx.source.orderId;
  }
}

// Extract customer info using JSONata
class ExtractCustomerStep extends JsonataStep<OrderData, ProcessedOrder> {
  constructor() {
    super({
      expression: '{"customerName": source.customer.name, "customerEmail": source.customer.email}',
    });
  }
}

// Calculate order statistics using JSONata
// Note: For complex calculations, we'll use a simpler approach
class CalculateStatsStep extends JsonataStep<OrderData, ProcessedOrder> {
  constructor() {
    super({
      expression: `{
        "itemCount": $count(source.items),
        "subtotal": $sum(source.items.price),
        "averageItemPrice": $average(source.items.price)
      }`,
    });
  }
}

// Calculate tax and total
class CalculateTotalStep extends JsonataStep<OrderData, ProcessedOrder> {
  constructor() {
    super({
      expression: `{
        "tax": $round(target.subtotal * 0.1, 2),
        "total": target.subtotal + $round(target.subtotal * 0.1, 2)
      }`,
    });
  }
}

// Format total as currency using JSONata
class FormatTotalStep extends JsonataStep<OrderData, ProcessedOrder> {
  constructor() {
    super({
      expression: '{"formattedTotal": "$" & $string($round(target.total, 2))}',
    });
  }
}

async function main() {
  console.log("=== JSONata Example ===\n");

  const definition: PipelineDefinition<OrderData, ProcessedOrder> = {
    steps: [
      { ctor: InitializeStep },
      { ctor: ExtractCustomerStep, dependsOn: [InitializeStep] },
      { ctor: CalculateStatsStep, dependsOn: [ExtractCustomerStep] },
      { ctor: CalculateTotalStep, dependsOn: [CalculateStatsStep] },
      { ctor: FormatTotalStep, dependsOn: [CalculateTotalStep] },
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
      customer: {
        name: "John Doe",
        email: "john@example.com",
      },
      items: [
        { productId: "P1", name: "Product A", price: 10.99, quantity: 2 },
        { productId: "P2", name: "Product B", price: 25.50, quantity: 1 },
        { productId: "P3", name: "Product C", price: 5.00, quantity: 3 },
      ],
    },
    target: {} as ProcessedOrder,
  });

  console.log("Pipeline result:", result.status);
  console.log("\nProcessed order:");
  console.log(JSON.stringify(result.context.target, null, 2));
  console.log("\nNote: JSONata expressions enable powerful data transformations");
  console.log("      without writing custom transformation logic.");
}

main().catch(console.error);

