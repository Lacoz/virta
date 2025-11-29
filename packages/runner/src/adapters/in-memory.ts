import { PipelineDefinition, PipelineResult, runPipeline } from "@virta/core";
import { RunnerAdapter } from "../RunnerAdapter.js";
import { RunnerOptions } from "../types.js";

export class InMemoryAdapter implements RunnerAdapter {
  async run<S, T>(definition: PipelineDefinition<S, T>, options: RunnerOptions<S, T>): Promise<PipelineResult<S, T>> {
    return runPipeline(definition, options);
  }
}

