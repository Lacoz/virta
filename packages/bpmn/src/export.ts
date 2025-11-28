import BpmnModdle from "bpmn-moddle";
import type { PipelineDefinition, PipelineNodeDefinition } from "@virta/registry";

/**
 * Converts a Virta PipelineDefinition to BPMN 2.0 XML format.
 * 
 * This function generates BPMN XML that can be used with BPMN tools
 * for visualization and documentation.
 * 
 * @param def - PipelineDefinition to convert
 * @param options - Optional configuration for BPMN generation
 * @returns BPMN 2.0 XML string
 * 
 * @example
 * ```ts
 * const pipelineDef: PipelineDefinition = {
 *   nodes: [
 *     { id: "task1", type: "task", dependsOn: [], stepRef: "task1" },
 *     { id: "task2", type: "task", dependsOn: ["task1"], stepRef: "task2" },
 *   ],
 * };
 * 
 * const bpmnXml = await pipelineDefinitionToBpmn(pipelineDef);
 * ```
 */
export async function pipelineDefinitionToBpmn(
  def: PipelineDefinition,
  options?: {
    processId?: string;
    processName?: string;
    targetNamespace?: string;
  }
): Promise<string> {
  const moddle = new BpmnModdle();
  
  const processId = options?.processId || "Process_1";
  const processName = options?.processName || "Virta Process";
  const targetNamespace = options?.targetNamespace || "http://virta.io/schema/bpmn";
  
  // Create BPMN definitions
  const definitions = moddle.create("bpmn:Definitions", {
    id: "Definitions_1",
    targetNamespace,
  }) as any;
  
  // Create process
  const process = moddle.create("bpmn:Process", {
    id: processId,
    name: processName,
    isExecutable: true,
  }) as any;
  
  definitions.get("rootElements").push(process);
  
  // Create start event
  const startEvent = moddle.create("bpmn:StartEvent", {
    id: "StartEvent_1",
  });
  process.get("flowElements").push(startEvent);
  
  // Create nodes and sequence flows
  const nodeToElementMap = new Map<string, any>();
  
  // Create BPMN elements for each node
  for (const node of def.nodes) {
    const bpmnElement = createBpmnElementFromNode(moddle, node);
    process.get("flowElements").push(bpmnElement);
    nodeToElementMap.set(node.id, bpmnElement);
  }
  
  // Create end event
  const endEvent = moddle.create("bpmn:EndEvent", {
    id: "EndEvent_1",
  });
  process.get("flowElements").push(endEvent);
  
  // Create sequence flows based on dependencies
  let flowCounter = 1;
  
  // Connect start event to entry nodes
  const entryNodeIds = def.entryNodes || def.nodes.filter((n) => n.dependsOn.length === 0).map((n) => n.id);
  for (const entryNodeId of entryNodeIds) {
    const entryElement = nodeToElementMap.get(entryNodeId);
    if (entryElement) {
      const flow = moddle.create("bpmn:SequenceFlow", {
        id: `Flow_${flowCounter++}`,
        sourceRef: startEvent,
        targetRef: entryElement,
      });
      process.get("flowElements").push(flow);
    }
  }
  
  // Connect nodes based on dependencies
  for (const node of def.nodes) {
    const sourceElement = nodeToElementMap.get(node.id);
    if (!sourceElement) continue;
    
    if (node.dependsOn && node.dependsOn.length > 0) {
      for (const depId of node.dependsOn) {
        const targetElement = nodeToElementMap.get(depId);
        if (targetElement) {
          const flow = moddle.create("bpmn:SequenceFlow", {
            id: `Flow_${flowCounter++}`,
            sourceRef: targetElement,
            targetRef: sourceElement,
          });
          process.get("flowElements").push(flow);
        }
      }
    } else {
      // Node with no dependencies connects to end event
      const flow = moddle.create("bpmn:SequenceFlow", {
        id: `Flow_${flowCounter++}`,
        sourceRef: sourceElement,
        targetRef: endEvent,
      });
      process.get("flowElements").push(flow);
    }
  }
  
  // Connect nodes with no dependents to end event
  for (const node of def.nodes) {
    const element = nodeToElementMap.get(node.id);
    if (!element) continue;
    
    const hasDependents = def.nodes.some((n) => n.dependsOn?.includes(node.id));
    if (!hasDependents) {
      const flow = moddle.create("bpmn:SequenceFlow", {
        id: `Flow_${flowCounter++}`,
        sourceRef: element,
        targetRef: endEvent,
      });
      process.get("flowElements").push(flow);
    }
  }
  
  // Serialize to XML
  try {
    const result = await moddle.toXML(definitions);
    return result.xml;
  } catch (error) {
    throw new Error(
      `Failed to serialize BPMN to XML: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Creates a BPMN element from a PipelineNodeDefinition
 */
function createBpmnElementFromNode(
  moddle: BpmnModdle,
  node: PipelineNodeDefinition
): any {
  const name = node.config && typeof node.config === "object" && "name" in node.config
    ? (node.config as any).name
    : node.id;
  
  switch (node.type) {
    case "task": {
      return moddle.create("bpmn:ServiceTask", {
        id: node.id,
        name: name || node.stepRef || node.id,
      });
    }
    
    case "pass": {
      return moddle.create("bpmn:ScriptTask", {
        id: node.id,
        name: name || node.id,
      });
    }
    
    case "choice": {
      return moddle.create("bpmn:ExclusiveGateway", {
        id: node.id,
        name: name || node.id,
      });
    }
    
    case "parallel": {
      return moddle.create("bpmn:ParallelGateway", {
        id: node.id,
        name: name || node.id,
      });
    }
    
    default: {
      // Fallback to service task
      return moddle.create("bpmn:ServiceTask", {
        id: node.id,
        name: name || node.stepRef || node.id,
      });
    }
  }
}

