/**
 * @virta/registry
 * 
 * Registration utilities and PipelineDefinition conversion helpers for Virta.
 * 
 * This package provides:
 * - StepRegistry: Maps string IDs to step constructors
 * - PipelineDefinition: Intermediate DAG model for external formats
 * - Conversion utilities between PipelineDefinition and RegisteredStep[]
 */

export { StepRegistry } from "./StepRegistry.js";
export {
  type NodeId,
  type PipelineNodeDefinition,
  type PipelineDefinition,
} from "./PipelineDefinition.js";
export {
  pipelineDefinitionToRegisteredSteps,
  registeredStepsToPipelineDefinition,
} from "./converter.js";


