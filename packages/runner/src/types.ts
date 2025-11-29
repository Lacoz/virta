import { PipelineDefinition, PipelineResult, RunPipelineOptions } from "@virta/core";

export interface RunnerAdapter<S, T> {
  run(definition: PipelineDefinition<S, T>, options: RunnerOptions<S, T>): Promise<PipelineResult<S, T>>;
}

export interface RunnerOptions<S, T> extends RunPipelineOptions<S, T> {
  // Additional options can be added here
  executionMode?: string;
  timeoutMs?: number;
  checkpoint?: string; // Serialized checkpoint to resume from
}

export type RunnerAdapterFactory = () => RunnerAdapter<any, any>;

