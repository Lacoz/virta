/**
 * Parallel execution example: Steps that can run in parallel
 * 
 * This example demonstrates how Virta automatically groups steps
 * that have no dependencies into the same level for parallel execution.
 */

import {
  buildLevels,
  runPipeline,
  type PipelineDefinition,
  type PipelineStep,
  type TransformationContext,
} from "@virta/core";

type ProductData = {
  id: string;
  name: string;
  price: number;
};

type EnrichedProduct = {
  id: string;
  name: string;
  price: number;
  formattedPrice: string;
  category: string;
  inStock: boolean;
  metadata: {
    currency: string;
    region: string;
  };
};

// These steps can run in parallel (no dependencies)
class FormatPriceStep implements PipelineStep<ProductData, EnrichedProduct> {
  async execute(ctx: TransformationContext<ProductData, EnrichedProduct>) {
    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 10));
    ctx.target.formattedPrice = `$${ctx.source.price.toFixed(2)}`;
  }
}

class DetermineCategoryStep implements PipelineStep<ProductData, EnrichedProduct> {
  async execute(ctx: TransformationContext<ProductData, EnrichedProduct>) {
    await new Promise((resolve) => setTimeout(resolve, 15));
    const price = ctx.source.price;
    ctx.target.category =
      price < 10 ? "budget" : price < 50 ? "standard" : "premium";
  }
}

class CheckStockStep implements PipelineStep<ProductData, EnrichedProduct> {
  async execute(ctx: TransformationContext<ProductData, EnrichedProduct>) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    // Simulate stock check
    ctx.target.inStock = Math.random() > 0.3;
  }
}

// This step depends on all previous steps
class CreateMetadataStep implements PipelineStep<ProductData, EnrichedProduct> {
  execute(ctx: TransformationContext<ProductData, EnrichedProduct>) {
    ctx.target.metadata = {
      currency: "USD",
      region: ctx.target.category === "premium" ? "US" : "Global",
    };
  }
}

class InitializeStep implements PipelineStep<ProductData, EnrichedProduct> {
  execute(ctx: TransformationContext<ProductData, EnrichedProduct>) {
    ctx.target.id = ctx.source.id;
    ctx.target.name = ctx.source.name;
    ctx.target.price = ctx.source.price;
  }
}

async function main() {
  console.log("=== Parallel Execution Example ===\n");

  const definition: PipelineDefinition<ProductData, EnrichedProduct> = {
    steps: [
      { ctor: InitializeStep },
      // These three steps can run in parallel
      { ctor: FormatPriceStep, dependsOn: [InitializeStep] },
      { ctor: DetermineCategoryStep, dependsOn: [InitializeStep] },
      { ctor: CheckStockStep, dependsOn: [InitializeStep] },
      // This step waits for all three to complete
      {
        ctor: CreateMetadataStep,
        dependsOn: [FormatPriceStep, DetermineCategoryStep, CheckStockStep],
      },
    ],
  };

  const levels = buildLevels(definition);
  console.log("Execution levels (steps in same level run in parallel):");
  levels.forEach((level, index) => {
    const stepNames = level.map((s) => s.name);
    console.log(`  Level ${index + 1}: ${stepNames.join(", ")}`);
    if (level.length > 1) {
      console.log(`    ⚡ ${level.length} steps will execute in parallel`);
    }
  });
  console.log();

  const startTime = Date.now();
  const result = await runPipeline(definition, {
    source: {
      id: "prod-123",
      name: "Example Product",
      price: 29.99,
    },
    target: {} as EnrichedProduct,
  });
  const duration = Date.now() - startTime;

  console.log("Pipeline result:", result.status);
  console.log("Enriched product:", JSON.stringify(result.context.target, null, 2));
  console.log(`Execution time: ${duration}ms`);
  console.log("Note: Parallel steps reduce total execution time");
}

main().catch(console.error);

