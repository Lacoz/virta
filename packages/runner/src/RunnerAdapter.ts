import { PipelineDefinition, PipelineResult } from "@virta/core";
import { RunnerOptions } from "./types.js";

export interface RunnerAdapter {
  run<S, T>(definition: PipelineDefinition<S, T>, options: RunnerOptions<S, T>): Promise<PipelineResult<S, T>>;
}

