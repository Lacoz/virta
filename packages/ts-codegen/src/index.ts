/**
 * @virta/ts-codegen
 * 
 * TypeScript code generation and parsing for Virta pipelines.
 * 
 * This package provides:
 * - Generate TypeScript source code from PipelineDefinition
 * - Parse TypeScript files back to PipelineDefinition
 * - Validate DAG structure in generated/parsed code
 */

export { pipelineDefinitionToTypeScript } from "./export.js";
export { typeScriptToPipelineDefinition } from "./import.js";
export type { TypeScriptExportOptions } from "./export.js";
export type { TypeScriptImportOptions } from "./import.js";

