import { JsonataStep, type JsonataStepOptions } from "./JsonataStep.js";

/**
 * Factory function to create a JsonataStep instance.
 * 
 * This is a convenience function that provides a more functional API
 * for creating JSONata-based pipeline steps.
 * 
 * @param expression - The JSONata expression to evaluate (or path/URL)
 * @param options - Optional configuration for the step
 * @returns A new JsonataStep instance
 * 
 * @example
 * ```ts
 * // From inline expression
 * const step = createJsonataStep('{"total": $sum(source.items.price)}');
 * 
 * // From file
 * const step2 = createJsonataStep("./transform.jsonata");
 * 
 * // From URL
 * const step3 = createJsonataStep("https://example.com/transform.jsonata");
 * ```
 */
export function createJsonataStep<S, T>(
  expression: string,
  options?: Omit<JsonataStepOptions, "expression" | "expressionPath" | "expressionUrl">
): JsonataStep<S, T> {
  // Auto-detect if it's a URL or file path
  if (expression.startsWith("http://") || expression.startsWith("https://")) {
    return new JsonataStep({
      expressionUrl: expression,
      ...options,
    });
  } else if (expression.includes("/") || expression.includes("\\") || expression.endsWith(".jsonata")) {
    // Likely a file path
    return new JsonataStep({
      expressionPath: expression,
      ...options,
    });
  } else {
    // Inline expression
    return new JsonataStep({
      expression,
      ...options,
    });
  }
}

