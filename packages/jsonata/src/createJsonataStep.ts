import { JsonataStep, type JsonataStepOptions } from "./JsonataStep.js";

/**
 * Factory function to create a JsonataStep instance.
 * 
 * This is a convenience function that provides a more functional API
 * for creating JSONata-based pipeline steps.
 * 
 * @param expression - The JSONata expression to evaluate
 * @param options - Optional configuration for the step
 * @returns A new JsonataStep instance
 * 
 * @example
 * ```ts
 * const step = createJsonataStep(
 *   "$merge([target, { total: $sum(source.items.price) }])"
 * );
 * ```
 */
export function createJsonataStep<S, T>(
  expression: string,
  options?: Omit<JsonataStepOptions, "expression">
): JsonataStep<S, T> {
  return new JsonataStep({
    expression,
    ...options,
  });
}

