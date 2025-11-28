/**
 * Order processing pipeline exported from Arazzo
 */

import {
  buildLevels,
  runPipeline,
  type PipelineDefinition,
  type PipelineStep,
  type TransformationContext,
} from "@virta/core";

/**
 * Step: validate
 * Validate the order
 */
class ValidateOrderStep implements PipelineStep<OrderData, ProcessedOrder> {
  execute(ctx: TransformationContext<OrderData, ProcessedOrder>): void {
    // TODO: Implement step logic for validate
    // stepRef: validateOrder
    // Access ctx.source and modify ctx.target
  }
}

/**
 * Step: process
 * Process the validated order
 */
class ProcessOrderStep implements PipelineStep<OrderData, ProcessedOrder> {
  execute(ctx: TransformationContext<OrderData, ProcessedOrder>): void {
    // TODO: Implement step logic for process
    // stepRef: processOrder
    // Access ctx.source and modify ctx.target
  }
}

/**
 * Step: format
 * Format the processed order
 */
class FormatOrderStep implements PipelineStep<OrderData, ProcessedOrder> {
  execute(ctx: TransformationContext<OrderData, ProcessedOrder>): void {
    // TODO: Implement step logic for format
    // stepRef: formatOrder
    // Access ctx.source and modify ctx.target
  }
}

/**
 * Pipeline definition for OrderProcessing
 */
const orderprocessingDefinition: PipelineDefinition<OrderData, ProcessedOrder> = {
  steps: [
    {
      ctor: ValidateOrderStep,
    },
    {
      ctor: ProcessOrderStep,
      dependsOn: [ValidateOrderStep],
    },
    {
      ctor: FormatOrderStep,
      dependsOn: [ProcessOrderStep],
    }
  ],
};

/**
 * Run the OrderProcessing pipeline
 */
export async function runOrderProcessing(
  source: OrderData,
  target: ProcessedOrder = {} as ProcessedOrder
) {
  return await runPipeline(orderprocessingDefinition, {
    source,
    target,
  });
}

export { orderprocessingDefinition };
export { ValidateOrderStep, ProcessOrderStep, FormatOrderStep };