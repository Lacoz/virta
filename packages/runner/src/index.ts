import { PipelineDefinition, PipelineResult } from "@virta/core";
import { RunnerAdapter } from "./RunnerAdapter.js";
import { RunnerOptions } from "./types.js";
import { InMemoryAdapter } from "./adapters/in-memory.js";
import { LambdaAdapter } from "./adapters/lambda.js";
import { StepFunctionsAdapter } from "./adapters/step-functions.js";
import { FargateAdapter } from "./adapters/fargate.js";
import { DockerLocalAdapter } from "./adapters/docker-local.js";
import { HybridAdapter } from "./adapters/hybrid.js";
import { FallbackChainRunner } from "./fallback-chain.js";

const adapters: Record<string, RunnerAdapter> = {
    "in-memory": new InMemoryAdapter(),
    "lambda": new LambdaAdapter(),
    "step-functions": new StepFunctionsAdapter(),
    "fargate": new FargateAdapter(),
    "docker-local": new DockerLocalAdapter(),
    "hybrid": new HybridAdapter(),
};

export async function run<S, T>(definition: PipelineDefinition<S, T>, options: RunnerOptions<S, T> = { source: {} as S, target: {} as T}): Promise<PipelineResult<S, T>> {
    const mode = options.executionMode || "in-memory";
    
    if (mode === "auto" || mode === "lambda-fallback") {
        const chain = new FallbackChainRunner();
        return chain.runWithFallbackChain(definition, options);
    }

    const adapter = adapters[mode];
    if (!adapter) {
        throw new Error(`Unknown execution mode: ${mode}`);
    }
    return adapter.run(definition, options);
}

export * from "./RunnerAdapter.js";
export * from "./types.js";
export * from "./pipeline-splitter.js";
export * from "./fallback-chain.js";
export * from "./adapters/in-memory.js";
export * from "./adapters/lambda.js";
export * from "./adapters/step-functions.js";
export * from "./adapters/fargate.js";
export * from "./adapters/docker-local.js";
export * from "./adapters/hybrid.js";

