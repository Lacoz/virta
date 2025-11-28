import jsonata from "jsonata";
import type {
  PipelineStep,
  TransformationContext,
} from "@virta/core";

/**
 * Options for configuring a JsonataStep
 */
export interface JsonataStepOptions {
  /**
   * The JSONata expression to evaluate
   */
  expression: string;
  /**
   * Whether to merge the result into the target context
   * If false, the result replaces the target
   * @default true
   */
  merge?: boolean;
  /**
   * Custom input object to pass to JSONata expression
   * If not provided, uses { source, target } as input
   */
  input?: Record<string, unknown>;
}

/**
 * A pipeline step that applies a JSONata expression to transform data.
 * 
 * The JSONata expression receives an input object containing:
 * - `source`: The source data from the transformation context
 * - `target`: The current target data from the transformation context
 * 
 * The result of the expression is merged into or replaces the target context.
 * 
 * @example
 * ```ts
 * const step = new JsonataStep({
 *   expression: "$merge([target, { computed: source.value * 2 }])"
 * });
 * ```
 */
export class JsonataStep<S, T> implements PipelineStep<S, T> {
  private readonly compiledExpression: jsonata.Expression;
  private readonly merge: boolean;
  private readonly customInput?: Record<string, unknown>;

  constructor(options: JsonataStepOptions) {
    this.compiledExpression = jsonata(options.expression);
    this.merge = options.merge ?? true;
    this.customInput = options.input;
  }

  async execute(ctx: TransformationContext<S, T>): Promise<void> {
    // Prepare input for JSONata expression
    const input = this.customInput ?? {
      source: ctx.source,
      target: ctx.target,
    };

    // Evaluate the JSONata expression
    let result: unknown;
    try {
      const evaluationResult = this.compiledExpression.evaluate(input);
      // JSONata evaluate can return a Promise
      result = evaluationResult instanceof Promise ? await evaluationResult : evaluationResult;
    } catch (error) {
      throw new Error(`JSONata evaluation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Handle the result
    if (result === undefined || result === null) {
      // Expression returned nothing, do nothing
      return;
    }

    // If result is an object, merge or assign it
    if (typeof result === "object" && result !== null) {
      if (Array.isArray(result)) {
        // If result is an array, take the first element if it's an object
        if (result.length > 0 && typeof result[0] === "object" && result[0] !== null) {
          Object.assign(ctx.target as Record<string, unknown>, result[0] as Record<string, unknown>);
        }
      } else {
        // Merge result into target (Object.assign merges properties)
        Object.assign(ctx.target as Record<string, unknown>, result as Record<string, unknown>);
      }
    }
  }
}

