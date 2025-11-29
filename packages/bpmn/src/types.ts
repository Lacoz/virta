/**
 * Type definitions for BPMN 2.0 elements
 * 
 * Based on BPMN 2.0 specification:
 * https://www.omg.org/spec/BPMN/2.0/
 * 
 * These types represent the key BPMN elements we need to map to PipelineDefinition.
 * Full BPMN types are provided by bpmn-moddle.
 */

/**
 * BPMN element types that map to PipelineDefinition nodes
 */
export type BpmnElementType =
  | "bpmn:Task"
  | "bpmn:ServiceTask"
  | "bpmn:UserTask"
  | "bpmn:ScriptTask"
  | "bpmn:ExclusiveGateway"
  | "bpmn:ParallelGateway"
  | "bpmn:InclusiveGateway"
  | "bpmn:StartEvent"
  | "bpmn:EndEvent"
  | "bpmn:IntermediateCatchEvent"
  | "bpmn:SequenceFlow";

/**
 * BPMN Gateway types
 */
export type BpmnGatewayType = "exclusive" | "parallel" | "inclusive";

/**
 * Simplified BPMN element structure for mapping
 */
export interface BpmnElement {
  id: string;
  $type: string;
  name?: string;
  incoming?: Array<{ id: string } | string>;
  outgoing?: Array<{ id: string } | string>;
  [key: string]: unknown;
}

/**
 * BPMN Process structure
 */
export interface BpmnProcess {
  id: string;
  $type: "bpmn:Process";
  flowElements?: BpmnElement[];
  [key: string]: unknown;
}

/**
 * BPMN Definitions structure
 */
export interface BpmnDefinitions {
  id: string;
  $type: "bpmn:Definitions";
  rootElements?: Array<BpmnProcess | unknown>;
  [key: string]: unknown;
}


