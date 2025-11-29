import type { PipelineDefinition, NodeId } from "@virta/registry";
import type { MetadataByNodeId, PathTiming, CriticalPath } from "./types.js";

/**
 * Computes the critical path (longest path) through a DAG.
 * 
 * The critical path is the path from entry nodes to exit nodes
 * that has the longest total execution time.
 * 
 * @param def Pipeline definition
 * @param metaByNodeId Metadata map for timing information
 * @returns Critical path information
 */
export function computeCriticalPath(
  def: PipelineDefinition,
  metaByNodeId: MetadataByNodeId
): CriticalPath {
  const nodeMap = new Map<NodeId, { dependsOn: NodeId[]; timing: PathTiming }>();
  
  // Build node map with timing information
  for (const node of def.nodes) {
    const meta = metaByNodeId[node.id];
    const p50 = meta?.timing?.p50Ms ?? 1000; // Default 1s if not specified
    const p99 = meta?.timing?.p99Ms ?? p50 * 2; // Default 2x p50 if p99 not specified
    
    nodeMap.set(node.id, {
      dependsOn: node.dependsOn,
      timing: {
        optimisticMs: p50,
        pessimisticMs: p99,
      },
    });
  }

  // Find entry nodes
  const entryNodes = def.entryNodes ?? def.nodes
    .filter((n) => n.dependsOn.length === 0)
    .map((n) => n.id);

  if (entryNodes.length === 0) {
    throw new Error("Pipeline has no entry nodes");
  }

  // Compute longest path using dynamic programming (topological order)
  const longestPath = new Map<NodeId, { path: NodeId[]; timing: PathTiming }>();
  
  // Initialize entry nodes
  for (const entryId of entryNodes) {
    const node = nodeMap.get(entryId);
    if (node) {
      longestPath.set(entryId, {
        path: [entryId],
        timing: node.timing,
      });
    }
  }

  // Process nodes in topological order
  const processed = new Set<NodeId>();
  const queue: NodeId[] = [...entryNodes];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (processed.has(nodeId)) continue;
    processed.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) continue;

    const currentPath = longestPath.get(nodeId) ?? {
      path: [nodeId],
      timing: { optimisticMs: 0, pessimisticMs: 0 },
    };

    // Update dependents
    for (const dependent of def.nodes) {
      if (dependent.dependsOn.includes(nodeId)) {
        const dependentNode = nodeMap.get(dependent.id);
        if (!dependentNode) continue;

        const dependentPath = longestPath.get(dependent.id);
        const newOptimistic = currentPath.timing.optimisticMs + dependentNode.timing.optimisticMs;
        const newPessimistic = currentPath.timing.pessimisticMs + dependentNode.timing.pessimisticMs;

        if (
          !dependentPath ||
          newPessimistic > dependentPath.timing.pessimisticMs ||
          (newPessimistic === dependentPath.timing.pessimisticMs &&
            newOptimistic > dependentPath.timing.optimisticMs)
        ) {
          longestPath.set(dependent.id, {
            path: [...currentPath.path, dependent.id],
            timing: {
              optimisticMs: newOptimistic,
              pessimisticMs: newPessimistic,
            },
          });
        }

        // Check if all dependencies are processed
        const allDepsProcessed = dependent.dependsOn.every((depId) => processed.has(depId));
        if (allDepsProcessed && !queue.includes(dependent.id)) {
          queue.push(dependent.id);
        }
      }
    }
  }

  // Find the longest path among all exit nodes (nodes with no dependents)
  const exitNodes = def.nodes.filter(
    (n) => !def.nodes.some((other) => other.dependsOn.includes(n.id))
  );

  if (exitNodes.length === 0) {
    // Fallback: use the longest path found
    let maxPath: { path: NodeId[]; timing: PathTiming } | null = null;
    for (const path of longestPath.values()) {
      if (!maxPath || path.timing.pessimisticMs > maxPath.timing.pessimisticMs) {
        maxPath = path;
      }
    }
    if (!maxPath) {
      throw new Error("Could not compute critical path");
    }
    return {
      nodeIds: maxPath.path,
      timing: maxPath.timing,
    };
  }

  // Find exit node with longest path
  let maxExitPath: { path: NodeId[]; timing: PathTiming } | null = null;
  for (const exitNode of exitNodes) {
    const path = longestPath.get(exitNode.id);
    if (path && (!maxExitPath || path.timing.pessimisticMs > maxExitPath.timing.pessimisticMs)) {
      maxExitPath = path;
    }
  }

  if (!maxExitPath) {
    throw new Error("Could not compute critical path");
  }

  return {
    nodeIds: maxExitPath.path,
    timing: maxExitPath.timing,
  };
}


