import type { StepMetadata } from "@virta/core";
import type { PipelineDefinition, NodeId } from "@virta/registry";

/**
 * Execution mode for Virta pipelines
 */
export type ExecutionMode = "lambda" | "step-functions" | "hybrid";

/**
 * Configuration for the execution planner
 */
export interface PlannerConfig {
  /**
   * Maximum execution time for Lambda functions in milliseconds.
   * Default: 12 minutes (12 * 60 * 1000 = 720000 ms)
   */
  lambdaMaxMs: number;

  /**
   * Fallback execution mode if planner cannot determine optimal mode.
   * Default: "lambda"
   */
  defaultExecutionMode?: ExecutionMode;

  /**
   * Safety margin as a percentage (0-1) to apply to Lambda time limits.
   * For example, 0.1 means use 90% of lambdaMaxMs as the safe limit.
   * Default: 0.1 (10% safety margin)
   */
  safetyMargin?: number;
}

/**
 * Timing estimates for a pipeline path
 */
export interface PathTiming {
  /**
   * Optimistic estimate (p50) in milliseconds
   */
  optimisticMs: number;

  /**
   * Pessimistic estimate (p99) in milliseconds
   */
  pessimisticMs: number;
}

/**
 * Critical path information
 */
export interface CriticalPath {
  /**
   * Node IDs in the critical path (longest path through DAG)
   */
  nodeIds: NodeId[];

  /**
   * Timing estimates for the critical path
   */
  timing: PathTiming;
}

/**
 * Detailed execution plan result
 */
export interface ExecutionPlan {
  /**
   * Recommended execution mode
   */
  mode: ExecutionMode;

  /**
   * Critical path information
   */
  criticalPath: CriticalPath;

  /**
   * For hybrid mode: node IDs that should run in Lambda
   */
  lambdaNodes?: NodeId[];

  /**
   * For hybrid mode: node IDs that should run in Step Functions
   */
  stepFunctionsNodes?: NodeId[];

  /**
   * Reasoning for the decision
   */
  reasoning: string[];
}

/**
 * Metadata map: node ID -> StepMetadata
 */
export type MetadataByNodeId = Record<NodeId, StepMetadata>;


