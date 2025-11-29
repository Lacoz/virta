import { PipelineHooks, StepCtor, TransformationContext } from "./index.js";
import { RuntimeMonitor } from "./RuntimeMonitor.js";
import { LambdaTimeoutError } from "./errors.js";

export function createTimeoutHooks<S, T>(
  monitor: RuntimeMonitor,
  baseHooks?: PipelineHooks<S, T>
): PipelineHooks<S, T> {
  return {
    ...baseHooks,
    onStepStart: async (step: StepCtor<S, T>, ctx: TransformationContext<S, T>) => {
      monitor.check();
      
      // If we are approaching timeout, we might want to preemptively stop execution
      // But typically we want to let the monitor callback handle the logic (like flagging for fallback)
      // Here we could throw if we absolutely must stop immediately
      if (monitor.getRemainingTime() <= 100) { // Less than 100ms is effectively a timeout
         throw new LambdaTimeoutError();
      }

      if (baseHooks?.onStepStart) {
        await baseHooks.onStepStart(step, ctx);
      }
    },
    onLevelStart: async (level: StepCtor<S, T>[], ctx: TransformationContext<S, T>) => {
        monitor.check();
        if (monitor.getRemainingTime() <= 100) {
             throw new LambdaTimeoutError();
        }
        if (baseHooks?.onLevelStart) {
            await baseHooks.onLevelStart(level, ctx);
        }
    }
  };
}

