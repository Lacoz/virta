/**
 * @virta/planner
 * 
 * Execution planner for Virta pipelines.
 * 
 * This package provides:
 * - Critical path computation through DAGs
 * - Execution mode decision logic (Lambda vs Step Functions vs Hybrid)
 * - Timing estimates and safety margins
 */

export { planExecution } from "./planExecution.js";
export { computeCriticalPath } from "./criticalPath.js";
export type {
  ExecutionMode,
  PlannerConfig,
  PathTiming,
  CriticalPath,
  ExecutionPlan,
  MetadataByNodeId,
} from "./types.js";


