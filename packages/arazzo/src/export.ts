import type { PipelineDefinition, PipelineNodeDefinition } from "@virta/registry";
import type {
  ArazzoDocument,
  ArazzoScenario,
  ArazzoStep,
  ArazzoOperationStep,
} from "./types.js";

/**
 * Converts a Virta PipelineDefinition to Arazzo workflow format.
 * 
 * This function generates an Arazzo document that can be used with
 * OpenAPI-based workflow tools.
 * 
 * @param def - PipelineDefinition to convert
 * @param scenarioName - Name for the generated scenario
 * @param options - Optional configuration for Arazzo generation
 * @returns Arazzo workflow document
 * 
 * @example
 * ```ts
 * const pipelineDef: PipelineDefinition = {
 *   nodes: [
 *     { id: "validate", type: "task", dependsOn: [], stepRef: "validateOrder" },
 *     { id: "process", type: "task", dependsOn: ["validate"], stepRef: "processOrder" },
 *   ],
 * };
 * 
 * const arazzoDoc = pipelineDefinitionToArazzo(pipelineDef, "order-processing");
 * ```
 */
export function pipelineDefinitionToArazzo(
  def: PipelineDefinition,
  scenarioName: string,
  options?: {
    arazzoVersion?: string;
    openapi?: string | Record<string, unknown>;
    info?: {
      title?: string;
      version?: string;
      description?: string;
    };
  }
): ArazzoDocument {
  const steps: ArazzoStep[] = [];
  
  // Convert nodes to Arazzo steps
  for (const node of def.nodes) {
    const step = convertNodeToArazzoStep(node);
    steps.push(step);
  }
  
  const scenario: ArazzoScenario = {
    steps,
  };
  
  // Extract description from config if available
  const firstNode = def.nodes[0];
  if (firstNode?.config && typeof firstNode.config === "object") {
    const config = firstNode.config as Record<string, unknown>;
    if (config.description && typeof config.description === "string") {
      scenario.description = config.description;
    }
  }
  
  const result: ArazzoDocument = {
    scenarios: {
      [scenarioName]: scenario,
    },
  };
  
  if (options?.arazzoVersion) {
    result.arazzo = options.arazzoVersion;
  } else {
    result.arazzo = "1.0.0";
  }
  
  if (options?.openapi) {
    result.openapi = options.openapi;
  }
  
  if (options?.info) {
    result.info = options.info;
  }
  
  return result;
}

/**
 * Converts a PipelineNodeDefinition to an Arazzo Step
 */
function convertNodeToArazzoStep(
  node: PipelineNodeDefinition
): ArazzoStep {
  const baseStep: ArazzoStep = {
    id: node.id,
    description: node.config && typeof node.config === "object" && "description" in node.config
      ? (node.config as any).description
      : undefined,
  };
  
  // Set runAfter from dependsOn
  if (node.dependsOn && node.dependsOn.length > 0) {
    baseStep.runAfter = node.dependsOn;
  }
  
  switch (node.type) {
    case "task": {
      const operationStep: ArazzoOperationStep = {
        ...baseStep,
        type: "operation",
        operationId: node.stepRef || node.id,
      };
      
      // Preserve Arazzo-specific config if available
      if (node.config && typeof node.config === "object") {
        const config = node.config as Record<string, unknown>;
        if (config.operationId) operationStep.operationId = config.operationId as string;
        if (config.path) operationStep.path = config.path as string;
        if (config.method) operationStep.method = config.method as string;
        if (config.inputs) operationStep.inputs = config.inputs as Record<string, unknown>;
        if (config.outputs) operationStep.outputs = config.outputs as Record<string, unknown>;
      }
      
      return operationStep;
    }
    
    case "pass": {
      return {
        ...baseStep,
        type: "pass",
        data: node.config && typeof node.config === "object" && "data" in node.config
          ? (node.config as any).data
          : undefined,
      };
    }
    
    case "choice": {
      // Choice nodes map to switch steps
      return {
        ...baseStep,
        type: "switch",
        expression: node.config && typeof node.config === "object" && "expression" in node.config
          ? (node.config as any).expression
          : undefined,
        cases: node.config && typeof node.config === "object" && "cases" in node.config
          ? (node.config as any).cases
          : undefined,
      };
    }
    
    case "parallel": {
      return {
        ...baseStep,
        type: "parallel",
        branches: node.config && typeof node.config === "object" && "branches" in node.config
          ? (node.config as any).branches
          : undefined,
      };
    }
    
    default:
      // Fallback to operation step
      return {
        ...baseStep,
        type: "operation",
        operationId: node.stepRef || node.id,
      };
  }
}


