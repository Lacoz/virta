import type {
  RegisteredStep,
  StepCtor,
  StepMetadata,
} from "@virta/core";
import type {
  PipelineDefinition,
  PipelineNodeDefinition,
  NodeId,
} from "./PipelineDefinition.js";
import type { StepRegistry } from "./StepRegistry.js";

/**
 * Converts a PipelineDefinition (intermediate DAG model) to RegisteredStep[]
 * (core model) using a StepRegistry to resolve step references.
 * 
 * This function:
 * - Looks up `stepRef` via StepRegistry
 * - Converts node dependencies (`dependsOn` as NodeId) into `StepCtor[]`
 * - Attaches metadata from node config
 * 
 * @param def - Pipeline definition using intermediate DAG model
 * @param registry - Step registry for resolving stepRef IDs
 * @returns Array of RegisteredStep instances ready for core engine
 * @throws Error if stepRef cannot be resolved or dependencies are invalid
 * 
 * @example
 * ```ts
 * const definition: PipelineDefinition = {
 *   nodes: [
 *     { id: "step1", type: "task", dependsOn: [], stepRef: "validate" },
 *     { id: "step2", type: "task", dependsOn: ["step1"], stepRef: "transform" },
 *   ],
 * };
 * 
 * const registry = new StepRegistry();
 * registry.register("validate", ValidateStep);
 * registry.register("transform", TransformStep);
 * 
 * const steps = pipelineDefinitionToRegisteredSteps(definition, registry);
 * ```
 */
export function pipelineDefinitionToRegisteredSteps<S, T>(
  def: PipelineDefinition,
  registry: StepRegistry<S, T>
): RegisteredStep<S, T>[] {
  // Build a map of node ID to node definition for quick lookup
  const nodeMap = new Map<NodeId, PipelineNodeDefinition>();
  for (const node of def.nodes) {
    nodeMap.set(node.id, node);
  }

  // Build a map of node ID to StepCtor
  const nodeIdToCtor = new Map<NodeId, StepCtor<S, T>>();
  
  // First pass: resolve all stepRefs to constructors
  for (const node of def.nodes) {
    if (!node.stepRef) {
      throw new Error(`Node "${node.id}" has no stepRef`);
    }
    
    const ctor = registry.resolve(node.stepRef);
    nodeIdToCtor.set(node.id, ctor);
  }

  // Second pass: convert to RegisteredStep[]
  const registeredSteps: RegisteredStep<S, T>[] = [];
  
  for (const node of def.nodes) {
    const ctor = nodeIdToCtor.get(node.id)!;
    
    // Convert node dependencies (NodeId[]) to StepCtor[]
    const dependsOn: StepCtor<S, T>[] = node.dependsOn.map((nodeId) => {
      const depCtor = nodeIdToCtor.get(nodeId);
      if (!depCtor) {
        throw new Error(
          `Node "${node.id}" depends on "${nodeId}" which is not found in pipeline definition`
        );
      }
      return depCtor;
    });

    // Extract metadata from config if available
    const meta: StepMetadata | undefined = extractMetadata(node.config);

    registeredSteps.push({
      ctor,
      dependsOn: dependsOn.length > 0 ? dependsOn : undefined,
      meta,
    });
  }

  return registeredSteps;
}

/**
 * Converts RegisteredStep[] (core model) back to PipelineDefinition
 * (intermediate DAG model) using a StepRegistry to generate stepRef IDs.
 * 
 * This is useful for exporting pipelines to external formats.
 * 
 * @param steps - Array of RegisteredStep instances
 * @param registry - Step registry for generating stepRef IDs
 * @returns Pipeline definition using intermediate DAG model
 * 
 * @example
 * ```ts
 * const steps: RegisteredStep[] = [
 *   { ctor: ValidateStep },
 *   { ctor: TransformStep, dependsOn: [ValidateStep] },
 * ];
 * 
 * const registry = new StepRegistry();
 * registry.register("validate", ValidateStep);
 * registry.register("transform", TransformStep);
 * 
 * const definition = registeredStepsToPipelineDefinition(steps, registry);
 * ```
 */
export function registeredStepsToPipelineDefinition<S, T>(
  steps: RegisteredStep<S, T>[],
  registry: StepRegistry<S, T>
): PipelineDefinition {
  // Build reverse map: StepCtor -> stepRef ID
  const ctorToId = new Map<StepCtor<S, T>, string>();
  for (const [id, ctor] of registry.getRegisteredIds().map((id) => [
    id,
    registry.resolve(id),
  ] as [string, StepCtor<S, T>])) {
    ctorToId.set(ctor, id);
  }

  // Build a map of StepCtor to node ID
  const ctorToNodeId = new Map<StepCtor<S, T>, NodeId>();
  const nodes: PipelineNodeDefinition[] = [];

  // First pass: create nodes for all steps
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepRef = ctorToId.get(step.ctor);
    
    if (!stepRef) {
      throw new Error(
        `Step constructor ${step.ctor.name} is not registered in the registry`
      );
    }

    // Generate node ID (use stepRef or generate one)
    const nodeId: NodeId = stepRef;

    ctorToNodeId.set(step.ctor, nodeId);

    nodes.push({
      id: nodeId,
      type: "task", // Default type, could be inferred from metadata
      dependsOn: [], // Will be filled in second pass
      stepRef,
      config: step.meta ? { metadata: step.meta } : undefined,
    });
  }

  // Second pass: set dependencies
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const nodeId = ctorToNodeId.get(step.ctor)!;
    const node = nodes.find((n) => n.id === nodeId)!;

    if (step.dependsOn && step.dependsOn.length > 0) {
      node.dependsOn = step.dependsOn.map((ctor) => {
        const depNodeId = ctorToNodeId.get(ctor);
        if (!depNodeId) {
          throw new Error(
            `Dependency ${ctor.name} is not found in the registered steps`
          );
        }
        return depNodeId;
      });
    }
  }

  // Find entry nodes (nodes with no dependencies)
  const entryNodes = nodes
    .filter((node) => node.dependsOn.length === 0)
    .map((node) => node.id);

  return {
    nodes,
    entryNodes: entryNodes.length > 0 ? entryNodes : undefined,
  };
}

/**
 * Extracts StepMetadata from node config.
 * 
 * @param config - Raw config from PipelineNodeDefinition
 * @returns Extracted metadata or undefined
 */
function extractMetadata(config: unknown): StepMetadata | undefined {
  if (!config || typeof config !== "object") {
    return undefined;
  }

  const configObj = config as Record<string, unknown>;
  
  // Check if config has a metadata field
  if (configObj.metadata && typeof configObj.metadata === "object") {
    const meta = configObj.metadata as Record<string, unknown>;
    const result: StepMetadata = {};

    if (meta.executionHint && typeof meta.executionHint === "string") {
      if (
        meta.executionHint === "lambda-only" ||
        meta.executionHint === "step-functions-only" ||
        meta.executionHint === "auto"
      ) {
        result.executionHint = meta.executionHint;
      }
    }

    if (meta.timing && typeof meta.timing === "object") {
      const timing = meta.timing as Record<string, unknown>;
      result.timing = {};
      
      if (typeof timing.p50Ms === "number") {
        result.timing.p50Ms = timing.p50Ms;
      }
      
      if (typeof timing.p99Ms === "number") {
        result.timing.p99Ms = timing.p99Ms;
      }
    }

    return Object.keys(result).length > 0 ? result : undefined;
  }

  return undefined;
}


