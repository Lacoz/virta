import type { PipelineDefinition, NodeId } from "@virta/registry";
import type { ExecutionMode, PlannerConfig, ExecutionPlan, MetadataByNodeId } from "./types.js";
import { computeCriticalPath } from "./criticalPath.js";

/**
 * Plans the execution mode for a Virta pipeline.
 * 
 * This function analyzes the pipeline DAG, computes the critical path,
 * and determines the optimal execution mode (Lambda, Step Functions, or Hybrid).
 * 
 * @param def Pipeline definition
 * @param metaByNodeId Metadata map containing timing and execution hints per node
 * @param config Planner configuration
 * @returns Execution plan with recommended mode and reasoning
 * 
 * @example
 * ```ts
 * const plan = planExecution(pipelineDef, {
 *   "task1": { timing: { p50Ms: 1000, p99Ms: 2000 } },
 *   "task2": { timing: { p50Ms: 500, p99Ms: 1000 } },
 * }, {
 *   lambdaMaxMs: 720000, // 12 minutes
 * });
 * 
 * console.log(plan.mode); // "lambda" | "step-functions" | "hybrid"
 * ```
 */
export function planExecution(
  def: PipelineDefinition,
  metaByNodeId: MetadataByNodeId,
  config: PlannerConfig
): ExecutionPlan {
  const reasoning: string[] = [];
  
  // Compute critical path
  const criticalPath = computeCriticalPath(def, metaByNodeId);
  reasoning.push(
    `Critical path: ${criticalPath.nodeIds.join(" → ")} (p99: ${criticalPath.timing.pessimisticMs}ms)`
  );

  // Check for step-functions-only hints
  const hasStepFunctionsOnly = def.nodes.some(
    (node) => metaByNodeId[node.id]?.executionHint === "step-functions-only"
  );

  if (hasStepFunctionsOnly) {
    reasoning.push("At least one step requires Step Functions execution");
    return {
      mode: "step-functions",
      criticalPath,
      reasoning,
    };
  }

  // Apply safety margin
  const safetyMargin = config.safetyMargin ?? 0.1;
  const safeLambdaLimit = config.lambdaMaxMs * (1 - safetyMargin);
  reasoning.push(`Safe Lambda limit: ${safeLambdaLimit}ms (${config.lambdaMaxMs}ms - ${(safetyMargin * 100).toFixed(0)}%)`);

  // Decision logic
  const pessimisticTime = criticalPath.timing.pessimisticMs;

  // If pessimistic time exceeds safe limit, use Step Functions
  if (pessimisticTime >= safeLambdaLimit) {
    reasoning.push(`Pessimistic time (${pessimisticTime}ms) exceeds safe Lambda limit`);
    return {
      mode: "step-functions",
      criticalPath,
      reasoning,
    };
  }

  // If pessimistic time is close to limit (within 20% of safe limit), consider hybrid
  const hybridThreshold = safeLambdaLimit * 0.8;
  if (pessimisticTime >= hybridThreshold) {
    reasoning.push(`Pessimistic time (${pessimisticTime}ms) is close to safe limit, considering hybrid mode`);
    
    // Try to find a cut point for hybrid execution
    const hybridPlan = findHybridCutPoint(def, metaByNodeId, config, criticalPath);
    if (hybridPlan) {
      return hybridPlan;
    }
  }

  // Default to Lambda if all checks pass
  reasoning.push(`Pessimistic time (${pessimisticTime}ms) is well within safe Lambda limit`);
  return {
    mode: "lambda",
    criticalPath,
    reasoning,
  };
}

/**
 * Attempts to find a cut point for hybrid execution.
 * 
 * Hybrid mode splits the pipeline:
 * - Prefix runs in Lambda (faster, lower latency)
 * - Suffix runs in Step Functions (more reliable for long-running)
 * 
 * @param def Pipeline definition
 * @param metaByNodeId Metadata map
 * @param config Planner configuration
 * @param criticalPath Critical path information
 * @returns Hybrid execution plan if a good cut point is found, null otherwise
 */
function findHybridCutPoint(
  def: PipelineDefinition,
  metaByNodeId: MetadataByNodeId,
  config: PlannerConfig,
  criticalPath: { nodeIds: NodeId[]; timing: { optimisticMs: number; pessimisticMs: number } }
): ExecutionPlan | null {
  const safetyMargin = config.safetyMargin ?? 0.1;
  const safeLambdaLimit = config.lambdaMaxMs * (1 - safetyMargin);

  // Try to find a cut point along the critical path
  let prefixTime = 0;
  const lambdaNodes: NodeId[] = [];
  const stepFunctionsNodes: NodeId[] = [];

  for (let i = 0; i < criticalPath.nodeIds.length; i++) {
    const nodeId = criticalPath.nodeIds[i];
    const meta = metaByNodeId[nodeId];
    const nodeTime = meta?.timing?.p99Ms ?? 1000;

    if (prefixTime + nodeTime <= safeLambdaLimit * 0.7) {
      // Safe to include in Lambda prefix
      prefixTime += nodeTime;
      lambdaNodes.push(nodeId);
    } else {
      // Remaining nodes go to Step Functions
      for (let j = i; j < criticalPath.nodeIds.length; j++) {
        stepFunctionsNodes.push(criticalPath.nodeIds[j]);
      }
      break;
    }
  }

  // If we found a reasonable split (at least 2 nodes in each part), use hybrid
  if (lambdaNodes.length > 0 && stepFunctionsNodes.length > 0) {
    // Include all nodes (not just critical path) in the appropriate bucket
    const allLambdaNodes = new Set<NodeId>(lambdaNodes);
    const allStepFunctionsNodes = new Set<NodeId>(stepFunctionsNodes);

    // Add non-critical-path nodes based on dependencies
    for (const node of def.nodes) {
      if (criticalPath.nodeIds.includes(node.id)) continue;

      // If node depends only on Lambda nodes, it can be Lambda
      const allDepsInLambda = node.dependsOn.every((depId) => allLambdaNodes.has(depId));
      if (allDepsInLambda && node.dependsOn.length > 0) {
        allLambdaNodes.add(node.id);
      } else {
        allStepFunctionsNodes.add(node.id);
      }
    }

    return {
      mode: "hybrid",
      criticalPath,
      lambdaNodes: Array.from(allLambdaNodes),
      stepFunctionsNodes: Array.from(allStepFunctionsNodes),
      reasoning: [
        `Found hybrid cut point: ${lambdaNodes.length} nodes in Lambda prefix, ${stepFunctionsNodes.length} nodes in Step Functions suffix`,
        `Lambda prefix time: ${prefixTime}ms`,
      ],
    };
  }

  return null;
}


