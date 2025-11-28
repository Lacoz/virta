/**
 * @virta/jsonata
 * 
 * JSONata helpers for step-level transformations in Virta pipelines.
 * 
 * JSONata is used as an expression language inside steps, not as a workflow DSL.
 * This package provides utilities for creating pipeline steps that use JSONata
 * expressions for data transformation and enrichment.
 */

export { JsonataStep } from "./JsonataStep.js";
export { createJsonataStep } from "./createJsonataStep.js";
export type { JsonataStepOptions } from "./JsonataStep.js";
export {
  loadExpression,
  loadExpressionFromFile,
  loadExpressionFromUrl,
} from "./loadExpression.js";

