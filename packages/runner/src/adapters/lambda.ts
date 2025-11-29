import { PipelineDefinition, PipelineResult, runPipeline, RuntimeMonitor, createTimeoutHooks } from "@virta/core";
import { RunnerAdapter } from "../RunnerAdapter.js";
import { RunnerOptions } from "../types.js";

export class LambdaAdapter implements RunnerAdapter {
  async run<S, T>(definition: PipelineDefinition<S, T>, options: RunnerOptions<S, T>): Promise<PipelineResult<S, T>> {
    // Default Lambda timeout is usually 15m, but we can configure it
    const timeoutMs = options.timeoutMs ?? 15 * 60 * 1000; 
    
    const monitor = new RuntimeMonitor({ timeoutMs });
    
    const hooks = createTimeoutHooks(monitor, options.hooks);
    
    return runPipeline(definition, { ...options, hooks });
  }
}

