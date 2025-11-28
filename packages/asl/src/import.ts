import type { PipelineDefinition, PipelineNodeDefinition } from "@virta/registry";
import type { AslStateMachine, AslState, AslChoiceState, AslParallelState, AslTaskState } from "./types.js";
// @ts-expect-error - asl-validator doesn't have TypeScript definitions
import validate from "asl-validator";

/**
 * Converts an ASL (Amazon States Language) state machine definition
 * to Virta's PipelineDefinition format.
 * 
 * This function:
 * - Validates the ASL definition (optional, can be disabled)
 * - Iterates over ASL States
 * - Creates PipelineNodeDefinition for each state
 * - Derives dependencies from Next chains, Parallel branches, and Catch transitions
 * - Maps state types to PipelineDefinition node types
 * 
 * @param aslJson - ASL state machine definition
 * @param options - Optional configuration
 * @param options.validate - Whether to validate ASL before conversion (default: true)
 * @returns PipelineDefinition ready for conversion to RegisteredStep[]
 * @throws Error if validation fails (when enabled)
 * 
 * @example
 * ```ts
 * const aslDefinition = {
 *   StartAt: "ValidateOrder",
 *   States: {
 *     ValidateOrder: {
 *       Type: "Task",
 *       Resource: "arn:aws:lambda:...",
 *       Next: "ProcessOrder"
 *     },
 *     ProcessOrder: {
 *       Type: "Task",
 *       Resource: "arn:aws:lambda:...",
 *       End: true
 *     }
 *   }
 * };
 * 
 * const pipelineDef = aslToPipelineDefinition(aslDefinition);
 * ```
 */
export function aslToPipelineDefinition(
  aslJson: AslStateMachine,
  options?: { validate?: boolean }
): PipelineDefinition {
  // Validate ASL if requested (default: true)
  if (options?.validate !== false) {
    try {
      validate(aslJson);
    } catch (error) {
      throw new Error(
        `ASL validation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  const nodes: PipelineNodeDefinition[] = [];
  const stateNames = Object.keys(aslJson.States);
  
  // Build reverse dependency map: state -> states that depend on it
  const dependents = new Map<string, Set<string>>();
  
  // Initialize dependents map
  for (const stateName of stateNames) {
    dependents.set(stateName, new Set());
  }
  
  // Process each state to build dependency graph
  for (const [stateName, state] of Object.entries(aslJson.States)) {
    // Handle Next transitions
    if (state.Next) {
      const dependentsSet = dependents.get(state.Next);
      if (dependentsSet) {
        dependentsSet.add(stateName);
      }
    }
    
    // Handle Choice state branches
    if (state.Type === "Choice" && "Choices" in state) {
      const choiceState = state as AslChoiceState;
      for (const choice of choiceState.Choices || []) {
        if (choice.Next) {
          const dependentsSet = dependents.get(choice.Next);
          if (dependentsSet) {
            dependentsSet.add(stateName);
          }
        }
      }
      // Handle Default branch
      if (choiceState.Default) {
        const dependentsSet = dependents.get(choiceState.Default);
        if (dependentsSet) {
          dependentsSet.add(stateName);
        }
      }
    }
    
    // Handle Parallel state branches
    if (state.Type === "Parallel" && "Branches" in state) {
      const parallelState = state as import("./types.js").AslParallelState;
      for (const branch of parallelState.Branches || []) {
        if (branch.StartAt) {
          const dependentsSet = dependents.get(branch.StartAt);
          if (dependentsSet) {
            dependentsSet.add(stateName);
          }
        }
      }
    }
    
    // Handle Catch transitions
    if ("Catch" in state && state.Catch) {
      const catchBlocks = state.Catch;
      if (Array.isArray(catchBlocks)) {
        for (const catchBlock of catchBlocks) {
          if (catchBlock.Next) {
            const dependentsSet = dependents.get(catchBlock.Next);
            if (dependentsSet) {
              dependentsSet.add(stateName);
            }
          }
        }
      }
    }
  }
  
  // Create nodes
  for (const [stateName, state] of Object.entries(aslJson.States)) {
    const nodeType = mapAslTypeToNodeType(state.Type);
    const dependsOn = Array.from(dependents.get(stateName) || []);
    
    // Extract stepRef from Resource (for Task states) or use state name
    let stepRef: string | undefined;
    if (state.Type === "Task" && "Resource" in state) {
      const taskState = state as AslTaskState;
      const resource = taskState.Resource;
      stepRef = typeof resource === "string" 
        ? extractStepRefFromResource(resource)
        : stateName;
    } else if (state.Type === "Pass") {
      // Pass states might not have a Resource, use state name as stepRef
      stepRef = stateName;
    } else {
      // For other types, use state name
      stepRef = stateName;
    }
    
    nodes.push({
      id: stateName,
      type: nodeType,
      dependsOn,
      stepRef,
      config: state, // Store full ASL state as config
    });
  }
  
  // Find entry nodes (states with no dependencies, or StartAt state)
  const entryNodes: string[] = [];
  for (const node of nodes) {
    if (node.dependsOn.length === 0 || node.id === aslJson.StartAt) {
      entryNodes.push(node.id);
    }
  }
  
  // Ensure StartAt is in entryNodes
  if (aslJson.StartAt && !entryNodes.includes(aslJson.StartAt)) {
    entryNodes.push(aslJson.StartAt);
  }
  
  return {
    nodes,
    entryNodes: entryNodes.length > 0 ? entryNodes : undefined,
  };
}

/**
 * Maps ASL state type to PipelineDefinition node type
 */
function mapAslTypeToNodeType(aslType: AslState["Type"]): PipelineNodeDefinition["type"] {
  switch (aslType) {
    case "Task":
      return "task";
    case "Pass":
      return "pass";
    case "Choice":
      return "choice";
    case "Parallel":
      return "parallel";
    case "Map":
    case "Wait":
    case "Succeed":
    case "Fail":
      // Map unsupported types to "task" for now
      return "task";
    default:
      return "task";
  }
}

/**
 * Extracts step reference ID from ASL Resource ARN or string.
 * 
 * For Lambda ARNs: extracts function name
 * For other resources: extracts meaningful identifier
 * Falls back to full resource string if no pattern matches
 */
function extractStepRefFromResource(resource: string): string {
  // Lambda ARN pattern: arn:aws:lambda:region:account:function:name
  const lambdaMatch = resource.match(/arn:aws:lambda:[^:]+:[^:]+:function:([^:]+)/);
  if (lambdaMatch) {
    return lambdaMatch[1];
  }
  
  // Activity ARN pattern: arn:aws:states:region:account:activity:name
  const activityMatch = resource.match(/arn:aws:states:[^:]+:[^:]+:activity:([^:]+)/);
  if (activityMatch) {
    return activityMatch[1];
  }
  
  // If it's just a string identifier (not an ARN), use it directly
  if (!resource.startsWith("arn:")) {
    return resource;
  }
  
  // Fallback: use last part of ARN
  const parts = resource.split(":");
  return parts[parts.length - 1] || resource;
}

