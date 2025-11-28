import type { PipelineDefinition, PipelineNodeDefinition } from "@virta/registry";
import type {
  ArazzoDocument,
  ArazzoScenario,
  ArazzoStep,
  ArazzoOperationStep,
  ArazzoParallelStep,
  ArazzoSwitchStep,
} from "./types.js";

/**
 * Converts an Arazzo workflow document to Virta's PipelineDefinition format.
 * 
 * This function:
 * - Looks up a scenario by name
 * - Converts scenario steps to PipelineNodeDefinition
 * - Maps step dependencies from runAfter
 * - Extracts operationId as stepRef
 * - Preserves OpenAPI/HTTP details in config
 * 
 * @param arazzoJson - Arazzo workflow document
 * @param scenarioName - Name of the scenario to convert
 * @returns PipelineDefinition ready for conversion to RegisteredStep[]
 * @throws Error if scenario is not found
 * 
 * @example
 * ```ts
 * const arazzoDoc = {
 *   scenarios: {
 *     "order-processing": {
 *       steps: [
 *         { id: "validate", type: "operation", operationId: "validateOrder" },
 *         { id: "process", type: "operation", operationId: "processOrder", runAfter: ["validate"] },
 *       ],
 *     },
 *   },
 * };
 * 
 * const pipelineDef = arazzoToPipelineDefinition(arazzoDoc, "order-processing");
 * ```
 */
export function arazzoToPipelineDefinition(
  arazzoJson: ArazzoDocument,
  scenarioName: string
): PipelineDefinition {
  if (!arazzoJson.scenarios || !arazzoJson.scenarios[scenarioName]) {
    throw new Error(`Scenario "${scenarioName}" not found in Arazzo document`);
  }

  const scenario = arazzoJson.scenarios[scenarioName];
  const nodes: PipelineNodeDefinition[] = [];
  
  // Convert steps to nodes
  // In Arazzo, runAfter means "this step depends on these steps"
  // So we directly use runAfter as dependsOn
  for (const step of scenario.steps) {
    const nodeType = mapArazzoStepTypeToNodeType(step.type || "operation");
    const dependsOn = step.runAfter && Array.isArray(step.runAfter) 
      ? step.runAfter 
      : [];
    
    // Extract stepRef from operationId or use step id
    let stepRef: string | undefined;
    if (step.type === "operation" || !step.type) {
      const operationStep = step as ArazzoOperationStep;
      stepRef = operationStep.operationId || step.id;
    } else {
      stepRef = step.id;
    }
    
    nodes.push({
      id: step.id,
      type: nodeType,
      dependsOn,
      stepRef,
      config: {
        ...step,
        scenarioName,
        arazzoVersion: arazzoJson.arazzo,
      },
    });
  }
  
  // Find entry nodes (steps with no dependencies)
  const entryNodes = nodes
    .filter((node) => node.dependsOn.length === 0)
    .map((node) => node.id);
  
  return {
    nodes,
    entryNodes: entryNodes.length > 0 ? entryNodes : undefined,
  };
}

/**
 * Maps Arazzo step type to PipelineDefinition node type
 */
function mapArazzoStepTypeToNodeType(
  arazzoType: string | undefined
): PipelineNodeDefinition["type"] {
  switch (arazzoType) {
    case "operation":
      return "task";
    case "pass":
      return "pass";
    case "switch":
      return "choice";
    case "parallel":
      return "parallel";
    case "loop":
    case "sleep":
      // Map unsupported types to "task" for now
      return "task";
    default:
      // Default to "task" for operation steps
      return "task";
  }
}

