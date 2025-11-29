import type {
  StepCtor,
  RegisteredStep,
  PipelineDefinition,
  StepMetadata,
} from "./index.js";

/**
 * Builder class for constructing PipelineDefinition instances.
 *
 * Provides a fluent API for building pipelines step by step.
 *
 * @example
 * ```ts
 * const pipeline = new PipelineBuilder<OrderData, ProcessedOrder>()
 *   .add(ValidateOrderStep)
 *   .add(ProcessOrderStep, { dependsOn: [ValidateOrderStep] })
 *   .build();
 * ```
 */
export class PipelineBuilder<S, T> {
  private steps: RegisteredStep<S, T>[] = [];

  /**
   * Adds a step to the pipeline.
   *
   * @param ctor - Step constructor class
   * @param options - Optional step configuration
   * @param options.dependsOn - Array of step constructors this step depends on
   * @param options.meta - Step metadata (timing, execution hints, etc.)
   * @returns The builder instance for method chaining
   */
  add(
    ctor: StepCtor<S, T>,
    options?: {
      dependsOn?: StepCtor<S, T>[];
      meta?: StepMetadata;
    }
  ): this {
    this.steps.push({
      ctor,
      dependsOn: options?.dependsOn,
      meta: options?.meta,
    });
    return this;
  }

  /**
   * Builds and returns the PipelineDefinition.
   *
   * @returns The constructed PipelineDefinition
   */
  build(): PipelineDefinition<S, T> {
    return { steps: this.steps };
  }
}

