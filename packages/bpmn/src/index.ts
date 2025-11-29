/**
 * @virta/bpmn
 * 
 * BPMN 2.0 import/export for Virta pipelines.
 * 
 * This package provides conversion between BPMN 2.0 XML format
 * and Virta's PipelineDefinition intermediate model.
 */

export { bpmnToPipelineDefinition } from "./import.js";
export { pipelineDefinitionToBpmn } from "./export.js";
export type {
  BpmnElementType,
  BpmnGatewayType,
  BpmnElement,
  BpmnProcess,
  BpmnDefinitions,
} from "./types.js";


