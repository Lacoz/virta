/**
 * Intermediate DAG model for external workflow formats.
 * 
 * This model allows external formats (ASL, Arazzo, JSON configs) to be
 * converted to and from Virta's core RegisteredStep model.
 */

/**
 * Unique identifier for a pipeline node
 */
export type NodeId = string;

/**
 * Type of pipeline node
 */
export type NodeType = "task" | "parallel" | "choice" | "pass";

/**
 * Definition of a single node in a pipeline DAG.
 * 
 * Nodes can reference external steps via `stepRef` (resolved through StepRegistry)
 * or contain raw configuration from external formats.
 */
export interface PipelineNodeDefinition {
  /**
   * Unique identifier for this node
   */
  id: NodeId;
  
  /**
   * Type of node (task, parallel, choice, pass)
   */
  type: NodeType;
  
  /**
   * IDs of nodes this node depends on (DAG edges)
   */
  dependsOn: NodeId[];
  
  /**
   * External step reference ID (resolved via StepRegistry)
   * Used to map string IDs from external formats to TypeScript step classes
   */
  stepRef?: string;
  
  /**
   * Raw configuration from external format (ASL state, Arazzo step, etc.)
   * This allows preserving format-specific metadata
   */
  config?: unknown;
}

/**
 * Complete pipeline definition using the intermediate DAG model.
 * 
 * This structure is used as a bridge between external workflow formats
 * (ASL, Arazzo, custom JSON/YAML) and Virta's core RegisteredStep model.
 */
export interface PipelineDefinition {
  /**
   * All nodes in the pipeline
   */
  nodes: PipelineNodeDefinition[];
  
  /**
   * Optional entry nodes (nodes with no dependencies)
   * If not specified, entry nodes are inferred from nodes with empty dependsOn
   */
  entryNodes?: NodeId[];
}

