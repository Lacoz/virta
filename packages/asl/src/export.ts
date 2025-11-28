import type { PipelineDefinition, PipelineNodeDefinition } from "@virta/registry";
import type {
  AslStateMachine,
  AslState,
  AslTaskState,
  AslPassState,
  AslChoiceState,
  AslParallelState,
} from "./types.js";
// @ts-expect-error - asl-validator doesn't have TypeScript definitions
import validate from "asl-validator";

/**
 * Converts a Virta PipelineDefinition to ASL (Amazon States Language) format.
 * 
 * This function generates ASL JSON that can be used with AWS Step Functions.
 * 
 * @param def - PipelineDefinition to convert
 * @param options - Optional configuration for ASL generation
 * @returns ASL state machine definition
 * 
 * @example
 * ```ts
 * const pipelineDef: PipelineDefinition = {
 *   nodes: [
 *     { id: "validate", type: "task", dependsOn: [], stepRef: "validate" },
 *     { id: "process", type: "task", dependsOn: ["validate"], stepRef: "process" },
 *   ],
 * };
 * 
 * const aslDefinition = pipelineDefinitionToAsl(pipelineDef);
 * ```
 */
export function pipelineDefinitionToAsl(
  def: PipelineDefinition,
  options?: {
    comment?: string;
    version?: string;
    timeoutSeconds?: number;
    resourceMapper?: (stepRef: string) => string;
    validate?: boolean;
  }
): AslStateMachine {
  const states: Record<string, AslState> = {};
  const nodeMap = new Map<string, PipelineNodeDefinition>();
  
  // Build node map
  for (const node of def.nodes) {
    nodeMap.set(node.id, node);
  }
  
  // Determine StartAt state
  let startAt: string;
  if (def.entryNodes && def.entryNodes.length > 0) {
    startAt = def.entryNodes[0];
  } else {
    // Find node with no dependencies
    const entryNode = def.nodes.find((n) => n.dependsOn.length === 0);
    startAt = entryNode?.id || def.nodes[0]?.id || "Start";
  }
  
  // Convert each node to ASL state
  for (const node of def.nodes) {
    const aslState = convertNodeToAslState(node, nodeMap, options?.resourceMapper);
    states[node.id] = aslState;
  }
  
  // Build Next chains based on dependencies
  for (const node of def.nodes) {
    const state = states[node.id];
    if (!state) continue;
    
    // Find nodes that depend on this node
    const nextNodes = def.nodes.filter((n) => n.dependsOn.includes(node.id));
    
    if (nextNodes.length === 0) {
      // This is an end state
      (state as any).End = true;
    } else if (nextNodes.length === 1) {
      // Single next state - set Next property
      (state as any).Next = nextNodes[0].id;
      // Remove End if it was set
      if ("End" in state) {
        delete (state as any).End;
      }
    } else {
      // Multiple dependents - this requires a Parallel or Choice state
      // For simplicity, we'll create a Parallel state that branches to all dependents
      // In a more sophisticated implementation, we might analyze the graph structure
      if (state.Type === "Task" || state.Type === "Pass") {
        // Convert to Parallel state
        const parallelState: AslParallelState = {
          Type: "Parallel",
          Branches: nextNodes.map((nextNode) => ({
            StartAt: nextNode.id,
            States: {
              [nextNode.id]: states[nextNode.id]!,
            },
          })),
        };
        states[node.id] = parallelState;
      } else {
        // For other state types, just set Next to first dependent
        (state as any).Next = nextNodes[0].id;
      }
    }
  }
  
  const result: AslStateMachine = {
    StartAt: startAt,
    States: states,
  };
  
  if (options?.comment) {
    result.Comment = options.comment;
  }
  
  if (options?.version) {
    result.Version = options.version;
  }
  
  if (options?.timeoutSeconds) {
    result.TimeoutSeconds = options.timeoutSeconds;
  }
  
  // Validate exported ASL if requested (default: true)
  if (options?.validate !== false) {
    try {
      validate(result);
    } catch (error) {
      throw new Error(
        `Exported ASL validation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  return result;
}

/**
 * Converts a PipelineNodeDefinition to an ASL State
 */
function convertNodeToAslState(
  node: PipelineNodeDefinition,
  nodeMap: Map<string, PipelineNodeDefinition>,
  resourceMapper?: (stepRef: string) => string
): AslState {
  const baseState: Partial<AslState> = {
    Comment: node.config && typeof node.config === "object" && "Comment" in node.config
      ? (node.config as any).Comment
      : undefined,
  };
  
  switch (node.type) {
    case "task": {
      const taskState: AslTaskState = {
        ...baseState,
        Type: "Task",
        Resource: resourceMapper
          ? resourceMapper(node.stepRef || node.id)
          : node.stepRef || `arn:aws:lambda:us-east-1:123456789012:function:${node.stepRef || node.id}`,
      };
      
      // Preserve ASL-specific config if available
      if (node.config && typeof node.config === "object") {
        const config = node.config as any;
        if (config.TimeoutSeconds) taskState.TimeoutSeconds = config.TimeoutSeconds;
        if (config.HeartbeatSeconds) taskState.HeartbeatSeconds = config.HeartbeatSeconds;
        if (config.Retry) taskState.Retry = config.Retry;
        if (config.Catch) taskState.Catch = config.Catch;
        if (config.Parameters) taskState.Parameters = config.Parameters;
      }
      
      return taskState;
    }
    
    case "pass": {
      const passState: AslPassState = {
        ...baseState,
        Type: "Pass",
      };
      
      if (node.config && typeof node.config === "object") {
        const config = node.config as any;
        if (config.Result !== undefined) passState.Result = config.Result;
        if (config.ResultPath) passState.ResultPath = config.ResultPath;
        if (config.Parameters) passState.Parameters = config.Parameters;
      }
      
      return passState;
    }
    
    case "choice": {
      const choiceState: AslChoiceState = {
        ...baseState,
        Type: "Choice",
        Choices: [],
      };
      
      if (node.config && typeof node.config === "object") {
        const config = node.config as any;
        if (config.Choices) choiceState.Choices = config.Choices;
        if (config.Default) choiceState.Default = config.Default;
      }
      
      return choiceState;
    }
    
    case "parallel": {
      const parallelState: AslParallelState = {
        ...baseState,
        Type: "Parallel",
        Branches: [],
      };
      
      if (node.config && typeof node.config === "object") {
        const config = node.config as any;
        if (config.Branches) parallelState.Branches = config.Branches;
      }
      
      return parallelState;
    }
    
    default: {
      // Fallback to Task
      const taskState: AslTaskState = {
        ...baseState,
        Type: "Task",
        Resource: node.stepRef || `arn:aws:lambda:us-east-1:123456789012:function:${node.id}`,
      };
      return taskState;
    }
  }
}

