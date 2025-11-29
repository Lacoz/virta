import { PipelineDefinition, RegisteredStep } from "@virta/core";

export interface SplitResult<S, T> {
    prefix: PipelineDefinition<S, any>;
    suffix: PipelineDefinition<any, T>;
}

export class PipelineSplitter {
    splitPipeline<S, T>(definition: PipelineDefinition<S, T>): SplitResult<S, T> | null {
        // Logic to split pipeline
        // For now, simple heuristic: split after 50% of steps
        const steps = definition.steps;
        if (steps.length < 2) return null;
        
        const splitIndex = Math.floor(steps.length / 2);
        
        const prefixSteps = steps.slice(0, splitIndex);
        const suffixSteps = steps.slice(splitIndex);
        
        // Verify dependency integrity: suffix steps should not depend on steps NOT in prefix (which is impossible in DAG if sorted, but good to check)
        // Also we assume 'buildLevels' has run or steps are topological? 
        // Steps in definition are not necessarily sorted.
        
        // Ideally we use buildLevels to find safe cut points.
        
        return {
            prefix: { steps: prefixSteps },
            suffix: { steps: suffixSteps } as any // casting for T
        };
    }
}

