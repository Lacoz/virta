import { readFile } from "node:fs/promises";
import * as ts from "typescript";
import type { PipelineDefinition } from "@virta/registry";

/**
 * Options for TypeScript import
 */
export interface TypeScriptImportOptions {
  /**
   * Whether to evaluate the TypeScript code (requires tsx or similar)
   * @default false
   */
  evaluate?: boolean;
  /**
   * Custom module loader (for custom evaluation)
   */
  moduleLoader?: (code: string) => Promise<any>;
}

/**
 * Imports a PipelineDefinition from a TypeScript file using TypeScript Compiler API.
 * 
 * This function uses the official TypeScript Compiler API to parse the AST
 * and extract the pipeline definition reliably.
 * 
 * @param filePath Path to the TypeScript file
 * @param options Import options
 * @returns PipelineDefinition extracted from the file
 * 
 * @example
 * ```ts
 * const pipelineDef = await typeScriptToPipelineDefinition("./pipeline.ts");
 * ```
 */
export async function typeScriptToPipelineDefinition(
  filePath: string,
  options?: TypeScriptImportOptions
): Promise<PipelineDefinition> {
  const code = await readFile(filePath, "utf-8");

  if (options?.evaluate || options?.moduleLoader) {
    // For evaluation, we'd need tsx or similar runtime
    // This is a placeholder for future implementation
    throw new Error(
      "TypeScript evaluation is not yet implemented. " +
      "Please use a TypeScript compiler or runtime like tsx."
    );
  }

  // Parse TypeScript source file
  const sourceFile = ts.createSourceFile(
    filePath,
    code,
    ts.ScriptTarget.Latest,
    true
  );

  // Extract step class names with their node IDs from comments
  const stepClassMap = new Map<string, string>(); // className -> nodeId
  
  // Find all class declarations
  function visit(node: ts.Node) {
    if (ts.isClassDeclaration(node) && node.name) {
      const className = node.name.text;
      
      // Check for JSDoc comment with "Step:" marker
      // Get comments directly from the node
      const sourceText = sourceFile.getFullText();
      const nodeStart = node.getFullStart();
      const nodePos = node.getStart();
      
      // Get text between fullStart and start (includes leading comments)
      const leadingText = sourceText.substring(nodeStart, nodePos);
      
      // Look for comment pattern: /** * Step: <nodeId> */
      // Search backwards from the class declaration
      const lines = leadingText.split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        const stepMatch = lines[i].match(/\*\s*Step:\s*(.+)/);
        if (stepMatch) {
          const nodeId = stepMatch[1].trim();
          stepClassMap.set(className, nodeId);
          break;
        }
      }
    }
    
    ts.forEachChild(node, visit);
  }
  
  visit(sourceFile);

  // Find pipeline definition
  let pipelineDefinition: PipelineDefinition | null = null;

  function findPipelineDefinition(node: ts.Node) {
    // Look for: const <name>Definition: PipelineDefinition<...> = { steps: [...] }
    if (
      ts.isVariableDeclaration(node) &&
      node.type &&
      ts.isTypeReferenceNode(node.type) &&
      node.type.typeName &&
      ts.isIdentifier(node.type.typeName) &&
      node.type.typeName.text === "PipelineDefinition"
    ) {
      if (node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
        const stepsProperty = node.initializer.properties.find(
          (prop) =>
            ts.isPropertyAssignment(prop) &&
            ts.isIdentifier(prop.name) &&
            prop.name.text === "steps"
        ) as ts.PropertyAssignment | undefined;

        if (
          stepsProperty &&
          ts.isArrayLiteralExpression(stepsProperty.initializer)
        ) {
          const nodes: Array<{
            id: string;
            type: "task" | "parallel" | "choice" | "pass";
            dependsOn: string[];
            stepRef: string;
          }> = [];

          // Parse each step in the array
          for (const element of stepsProperty.initializer.elements) {
            if (ts.isObjectLiteralExpression(element)) {
              let ctor: string | null = null;
              const dependsOn: string[] = [];

              // Extract ctor
              const ctorProperty = element.properties.find(
                (prop) =>
                  ts.isPropertyAssignment(prop) &&
                  ts.isIdentifier(prop.name) &&
                  prop.name.text === "ctor"
              ) as ts.PropertyAssignment | undefined;

              if (ctorProperty && ts.isIdentifier(ctorProperty.initializer)) {
                ctor = ctorProperty.initializer.text;
              }

              // Extract dependsOn
              const dependsOnProperty = element.properties.find(
                (prop) =>
                  ts.isPropertyAssignment(prop) &&
                  ts.isIdentifier(prop.name) &&
                  prop.name.text === "dependsOn"
              ) as ts.PropertyAssignment | undefined;

              if (
                dependsOnProperty &&
                ts.isArrayLiteralExpression(dependsOnProperty.initializer)
              ) {
                for (const depElement of dependsOnProperty.initializer.elements) {
                  if (ts.isIdentifier(depElement)) {
                    const depClass = depElement.text;
                    const depNodeId =
                      Array.from(stepClassMap.entries()).find(
                        ([cls]) => cls === depClass
                      )?.[1] || depClass.replace(/Step$/, "").toLowerCase();
                    dependsOn.push(depNodeId);
                  } else if (ts.isStringLiteral(depElement)) {
                    // Handle string literals in dependsOn
                    dependsOn.push(depElement.text);
                  }
                }
              }

              if (ctor) {
                const nodeId =
                  stepClassMap.get(ctor) ||
                  ctor.replace(/Step$/, "").toLowerCase();
                
                // Map dependsOn class names to nodeIds
                const mappedDependsOn = dependsOn.map((depClassOrId) => {
                  // If it's already a nodeId (from string literal), use it
                  if (stepClassMap.has(depClassOrId)) {
                    return stepClassMap.get(depClassOrId)!;
                  }
                  // Try to find by class name
                  const foundNodeId = Array.from(stepClassMap.entries()).find(
                    ([cls]) => cls === depClassOrId
                  )?.[1];
                  return foundNodeId || depClassOrId.toLowerCase();
                });
                
                nodes.push({
                  id: nodeId,
                  type: "task",
                  dependsOn: mappedDependsOn,
                  stepRef: nodeId,
                });
              }
            }
          }

          pipelineDefinition = {
            nodes,
            entryNodes: nodes
              .filter((n) => n.dependsOn.length === 0)
              .map((n) => n.id),
          };
        }
      }
    }

    ts.forEachChild(node, findPipelineDefinition);
  }

  findPipelineDefinition(sourceFile);

  if (!pipelineDefinition) {
    throw new Error(
      `Could not find pipeline definition in TypeScript file: ${filePath}`
    );
  }

  // Validate that the pipeline is a valid DAG (no cycles)
  validateDAG(pipelineDefinition);

  return pipelineDefinition;
}

/**
 * Validates that a PipelineDefinition is a valid DAG (Directed Acyclic Graph).
 * 
 * Checks:
 * - All dependencies reference existing nodes
 * - No cycles in the dependency graph
 * 
 * @param def Pipeline definition to validate
 * @throws Error if the pipeline is not a valid DAG
 */
function validateDAG(def: PipelineDefinition): void {
  const nodeIds = new Set(def.nodes.map((n) => n.id));
  
  // Check that all dependencies reference existing nodes
  for (const node of def.nodes) {
    for (const depId of node.dependsOn) {
      if (!nodeIds.has(depId)) {
        throw new Error(
          `Node "${node.id}" depends on "${depId}" which does not exist in the pipeline`
        );
      }
    }
  }

  // Check for cycles using topological sort (Kahn's algorithm)
  const inDegree = new Map<string, number>();
  const adjacencyList = new Map<string, string[]>();
  
  // Initialize in-degree for all nodes
  for (const node of def.nodes) {
    inDegree.set(node.id, 0);
    adjacencyList.set(node.id, []);
  }
  
  // Build adjacency list (reverse: dependency -> dependents) and calculate in-degrees
  for (const node of def.nodes) {
    for (const depId of node.dependsOn) {
      const dependents = adjacencyList.get(depId) || [];
      dependents.push(node.id);
      adjacencyList.set(depId, dependents);
      inDegree.set(node.id, (inDegree.get(node.id) || 0) + 1);
    }
  }
  
  // Find all nodes with no incoming edges (entry nodes)
  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }
  
  let processedCount = 0;
  
  // Process nodes in topological order
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    processedCount++;
    
    const dependents = adjacencyList.get(nodeId) || [];
    for (const dependentId of dependents) {
      const currentInDegree = inDegree.get(dependentId) || 0;
      inDegree.set(dependentId, currentInDegree - 1);
      
      if (inDegree.get(dependentId) === 0) {
        queue.push(dependentId);
      }
    }
  }
  
  // If we didn't process all nodes, there's a cycle
  if (processedCount !== def.nodes.length) {
    // Find the cycle for better error message
    const cycle = findCycle(def);
    if (cycle && cycle.length > 1) {
      throw new Error(
        `Pipeline contains a cycle: ${cycle.join(" → ")} → ${cycle[0]}`
      );
    } else {
      throw new Error(
        `Pipeline is not a valid DAG: ${def.nodes.length - processedCount} node(s) are part of a cycle`
      );
    }
  }
}

/**
 * Finds a cycle in the dependency graph using DFS.
 * 
 * @param def Pipeline definition
 * @returns Array of node IDs forming a cycle, or empty array if no cycle found
 */
function findCycle(def: PipelineDefinition): string[] {
  const WHITE = 0; // Unvisited
  const GRAY = 1;  // Currently being processed (in current DFS path)
  const BLACK = 2; // Fully processed
  
  const color = new Map<string, number>();
  
  // Initialize all nodes as white
  for (const node of def.nodes) {
    color.set(node.id, WHITE);
  }
  
  // Build adjacency list: node -> nodes it depends on (forward edges)
  const adjacencyList = new Map<string, string[]>();
  for (const node of def.nodes) {
    adjacencyList.set(node.id, node.dependsOn);
  }
  
  // Track path for cycle reconstruction
  const path: string[] = [];
  let foundCycle: string[] | null = null;
  
  // DFS to find cycle
  function dfs(nodeId: string): void {
    if (foundCycle) return; // Already found a cycle
    
    const currentColor = color.get(nodeId);
    
    if (currentColor === GRAY) {
      // Found a back edge - cycle detected
      // Find where this node appears in the current path
      const cycleStart = path.indexOf(nodeId);
      if (cycleStart >= 0 && cycleStart < path.length - 1) {
        // Return the cycle: from first occurrence to current node
        // Only if it's not just the same node (self-loop)
        foundCycle = path.slice(cycleStart).concat([nodeId]);
      }
      return;
    }
    
    if (currentColor === BLACK) {
      // Already processed, no cycle from here
      return;
    }
    
    // Mark as being processed and add to path
    color.set(nodeId, GRAY);
    path.push(nodeId);
    
    // Visit all neighbors (nodes this node depends on)
    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighborId of neighbors) {
      dfs(neighborId);
      if (foundCycle) return;
    }
    
    // Mark as fully processed and remove from path
    color.set(nodeId, BLACK);
    path.pop();
  }
  
  // Try DFS from each unvisited node
  for (const node of def.nodes) {
    if (color.get(node.id) === WHITE && !foundCycle) {
      dfs(node.id);
    }
  }
  
  return foundCycle || [];
}
