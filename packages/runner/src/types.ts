import { PipelineDefinition, PipelineResult, RunPipelineOptions } from "@virta/core";
import type { RunnerAdapter } from "./RunnerAdapter.js";

export interface RunnerOptions<S, T> extends RunPipelineOptions<S, T> {
  // Additional options can be added here
  executionMode?: string;
  timeoutMs?: number;
  checkpoint?: string; // Serialized checkpoint to resume from
}

export type RunnerAdapterFactory = () => RunnerAdapter;

