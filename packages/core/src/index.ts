/**
 * Core types and utilities for Virta's DAG pipeline engine.
 *
 * Step identity is based on the constructor reference (`StepCtor`),
 * matching the design in SPEC.md. `buildLevels` topologically sorts
 * registered steps into parallelizable levels, and `runPipeline`
 * executes them with lifecycle hooks and a structured result.
 */

export type TransformationContext<S, T> = {
  source: S;
  target: T;
  stopPipeline?: boolean;
  error?: unknown;
};

export interface PipelineStep<S, T> {
  execute(ctx: TransformationContext<S, T>): Promise<void> | void;
}

export type StepCtor<S, T> = new () => PipelineStep<S, T>;

export type ExecutionHint = "lambda-only" | "step-functions-only" | "auto";

export interface StepMetadata {
  executionHint?: ExecutionHint;
  timing?: {
    p50Ms?: number;
    p99Ms?: number;
  };
}

export interface RegisteredStep<S, T> {
  ctor: StepCtor<S, T>;
  dependsOn?: StepCtor<S, T>[];
  meta?: StepMetadata;
}

export interface PipelineDefinition<S, T> {
  steps: RegisteredStep<S, T>[];
}

export type PipelineStatus = "success" | "error" | "stopped";

export interface PipelineErrorEntry<S, T> {
  step: StepCtor<S, T>;
  error: unknown;
}

export interface PipelineHooks<S, T> {
  onLevelStart?: (level: StepCtor<S, T>[], ctx: TransformationContext<S, T>) => void | Promise<void>;
  onLevelComplete?: (level: StepCtor<S, T>[], ctx: TransformationContext<S, T>) => void | Promise<void>;
  onStepStart?: (step: StepCtor<S, T>, ctx: TransformationContext<S, T>) => void | Promise<void>;
  onStepSuccess?: (step: StepCtor<S, T>, ctx: TransformationContext<S, T>) => void | Promise<void>;
  onStepError?: (step: StepCtor<S, T>, error: unknown, ctx: TransformationContext<S, T>) => void | Promise<void>;
  onPipelineComplete?: (result: PipelineResult<S, T>) => void | Promise<void>;
}

export interface PipelineResult<S, T> {
  status: PipelineStatus;
  context: TransformationContext<S, T>;
  errors: PipelineErrorEntry<S, T>[];
  executedSteps: StepCtor<S, T>[];
  completedLevels: StepCtor<S, T>[][];
}

/**
 * Validates uniqueness and dependency resolution, returning constructors
 * grouped into execution levels. Each level contains steps whose
 * dependencies are satisfied by previous levels, enabling parallel
 * execution within the level.
 */
export function buildLevels<S, T>(definition: PipelineDefinition<S, T>): StepCtor<S, T>[][] {
  const levels: StepCtor<S, T>[][] = [];
  const seenCtors = new Set<StepCtor<S, T>>();
  const registeredSteps = definition.steps.map((step) => {
    if (seenCtors.has(step.ctor)) {
      throw new Error("Duplicate step constructor registered");
    }
    seenCtors.add(step.ctor);
    return step;
  });

  const remaining = new Map<StepCtor<S, T>, RegisteredStep<S, T>>(
    registeredSteps.map((step) => [step.ctor, step])
  );
  const resolved = new Set<StepCtor<S, T>>();

  while (remaining.size > 0) {
    const ready: StepCtor<S, T>[] = [];

    for (const [ctor, step] of remaining.entries()) {
      const dependencies = step.dependsOn ?? [];
      dependencies.forEach((dependency) => {
        if (!seenCtors.has(dependency)) {
          throw new Error("Step dependency not registered");
        }
      });
      const isSatisfied = dependencies.every((dependency) => resolved.has(dependency));
      if (isSatisfied) {
        ready.push(ctor);
      }
    }

    if (ready.length === 0) {
      throw new Error("Cyclic or unsatisfied dependencies detected");
    }

    ready.forEach((ctor) => {
      remaining.delete(ctor);
      resolved.add(ctor);
    });

    levels.push(ready);
  }

  return levels;
}

export interface RunPipelineOptions<S, T> {
  source: S;
  target: T;
  hooks?: PipelineHooks<S, T>;
}

async function runLevel<S, T>(
  level: StepCtor<S, T>[],
  ctx: TransformationContext<S, T>,
  hooks?: PipelineHooks<S, T>,
  executedSteps?: StepCtor<S, T>[],
  errors?: PipelineErrorEntry<S, T>[]
): Promise<boolean> {
  await hooks?.onLevelStart?.(level, ctx);

  const executions = level.map(async (ctor) => {
    const step = new ctor();
    await hooks?.onStepStart?.(ctor, ctx);

    try {
      await step.execute(ctx);
      executedSteps?.push(ctor);
      await hooks?.onStepSuccess?.(ctor, ctx);
      return { status: "fulfilled" as const };
    } catch (error) {
      ctx.error = error;
      errors?.push({ step: ctor, error });
      await hooks?.onStepError?.(ctor, error, ctx);
      return { status: "rejected" as const };
    }
  });

  const results = await Promise.all(executions);
  const hasError = results.some((result) => result.status === "rejected");

  await hooks?.onLevelComplete?.(level, ctx);
  return hasError;
}

/**
 * Executes the pipeline defined by registered steps. Steps within the same
 * level run in parallel; levels execute sequentially. The function
 * respects `ctx.stopPipeline` requests from any step and returns a
 * structured `PipelineResult` with status, errors, and execution history.
 */
export async function runPipeline<S, T>(
  definition: PipelineDefinition<S, T>,
  options: RunPipelineOptions<S, T>
): Promise<PipelineResult<S, T>> {
  const { source, target, hooks } = options;
  const ctx: TransformationContext<S, T> = { source, target };
  const executedSteps: StepCtor<S, T>[] = [];
  const errors: PipelineErrorEntry<S, T>[] = [];
  const completedLevels: StepCtor<S, T>[][] = [];

  const levels = buildLevels(definition);

  for (const level of levels) {
    const hasError = await runLevel(level, ctx, hooks, executedSteps, errors);
    completedLevels.push(level);

    if (hasError || ctx.stopPipeline) {
      break;
    }
  }

  const status: PipelineStatus = errors.length > 0 ? "error" : ctx.stopPipeline ? "stopped" : "success";
  const result: PipelineResult<S, T> = {
    status,
    context: ctx,
    errors,
    executedSteps,
    completedLevels,
  };

  await hooks?.onPipelineComplete?.(result);
  return result;
}

export { PipelineBuilder } from "./PipelineBuilder.js";
