import BpmnModdle from "bpmn-moddle";
import type { PipelineDefinition, PipelineNodeDefinition } from "@virta/registry";
import type { BpmnElement, BpmnProcess, BpmnDefinitions } from "./types.js";

/**
 * Converts a BPMN 2.0 XML document to Virta's PipelineDefinition format.
 * 
 * This function:
 * - Parses BPMN XML using bpmn-moddle
 * - Identifies tasks (service/user/script tasks) and gateways (exclusive/parallel)
 * - Translates sequence flows into dependencies
 * - Maps BPMN elements to PipelineDefinition nodes
 * 
 * @param bpmnXml - BPMN 2.0 XML string
 * @returns PipelineDefinition ready for conversion to RegisteredStep[]
 * @throws Error if BPMN XML cannot be parsed or is invalid
 * 
 * @example
 * ```ts
 * const bpmnXml = `<?xml version="1.0"?>
 *   <bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL">
 *     <bpmn2:process id="Process_1">
 *       <bpmn2:startEvent id="StartEvent_1"/>
 *       <bpmn2:serviceTask id="Task_1" name="Validate"/>
 *       <bpmn2:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1"/>
 *     </bpmn2:process>
 *   </bpmn2:definitions>`;
 * 
 * const pipelineDef = bpmnToPipelineDefinition(bpmnXml);
 * ```
 */
export async function bpmnToPipelineDefinition(
  bpmnXml: string
): Promise<PipelineDefinition> {
  const moddle = new BpmnModdle();
  
  let definitions: BpmnDefinitions;
  try {
    const result = await moddle.fromXML(bpmnXml);
    definitions = result.rootElement as BpmnDefinitions;
  } catch (error) {
    throw new Error(
      `Failed to parse BPMN XML: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  
  // Find the first process (BPMN can have multiple processes)
  const process = definitions.rootElements?.find(
    (el): el is BpmnProcess => {
      if (!el || typeof el !== "object") return false;
      if (!("$type" in el)) return false;
      return el.$type === "bpmn:Process";
    }
  ) as BpmnProcess | undefined;
  
  if (!process || !process.flowElements) {
    throw new Error("BPMN document does not contain a valid process with flow elements");
  }
  
  const nodes: PipelineNodeDefinition[] = [];
  const elementMap = new Map<string, BpmnElement>();
  
  // Build element map and identify mappable elements
  for (const element of process.flowElements) {
    if (element && typeof element === "object" && "id" in element) {
      const bpmnElement = element as BpmnElement;
      elementMap.set(bpmnElement.id, bpmnElement);
    }
  }
  
  // Build reverse dependency map: elementId -> elements that depend on it
  const dependents = new Map<string, Set<string>>();
  
  // Initialize dependents map
  for (const [id] of elementMap) {
    dependents.set(id, new Set());
  }
  
  // Process sequence flows to build dependency graph
  for (const [id, element] of elementMap) {
    if (element.$type === "bpmn:SequenceFlow") {
      const sourceRef = getRefId(element.sourceRef);
      const targetRef = getRefId(element.targetRef);
      
      if (sourceRef && targetRef) {
        const dependentsSet = dependents.get(targetRef);
        if (dependentsSet) {
          dependentsSet.add(sourceRef);
        }
      }
    }
  }
  
  // Convert BPMN elements to nodes
  for (const [id, element] of elementMap) {
    // Skip sequence flows (they're just dependencies)
    if (element.$type === "bpmn:SequenceFlow") {
      continue;
    }
    
    // Skip start/end events (they're implicit in PipelineDefinition)
    if (element.$type === "bpmn:StartEvent" || element.$type === "bpmn:EndEvent") {
      continue;
    }
    
    const nodeType = mapBpmnTypeToNodeType(element.$type);
    if (!nodeType) {
      // Skip unmappable elements
      continue;
    }
    
    const dependsOn = Array.from(dependents.get(id) || [])
      .filter((depId) => {
        const depElement = elementMap.get(depId);
        // Don't include start events in dependencies
        return depElement && depElement.$type !== "bpmn:StartEvent";
      });
    
    nodes.push({
      id: element.id,
      type: nodeType,
      dependsOn,
      stepRef: element.id, // Use element ID as stepRef
      config: {
        bpmnType: element.$type,
        name: element.name,
        element: element, // Store full BPMN element for round-trip
      },
    });
  }
  
  // Find entry nodes (elements with no dependencies or only start event dependencies)
  const entryNodes = nodes
    .filter((node) => {
      const deps = node.dependsOn || [];
      return deps.length === 0 || deps.every((depId) => {
        const depElement = elementMap.get(depId);
        return depElement?.$type === "bpmn:StartEvent";
      });
    })
    .map((node) => node.id);
  
  return {
    nodes,
    entryNodes: entryNodes.length > 0 ? entryNodes : undefined,
  };
}

/**
 * Maps BPMN element type to PipelineDefinition node type
 */
function mapBpmnTypeToNodeType(
  bpmnType: string
): PipelineNodeDefinition["type"] | null {
  switch (bpmnType) {
    case "bpmn:Task":
    case "bpmn:ServiceTask":
    case "bpmn:UserTask":
    case "bpmn:ScriptTask":
      return "task";
    
    case "bpmn:ExclusiveGateway":
      return "choice";
    
    case "bpmn:ParallelGateway":
      return "parallel";
    
    case "bpmn:InclusiveGateway":
      // Inclusive gateways are complex, map to parallel for now
      return "parallel";
    
    default:
      return null; // Unmappable type
  }
}

/**
 * Extracts reference ID from BPMN reference (can be object or string)
 */
function getRefId(ref: unknown): string | null {
  if (typeof ref === "string") {
    return ref;
  }
  if (ref && typeof ref === "object" && "id" in ref) {
    return String(ref.id);
  }
  return null;
}

