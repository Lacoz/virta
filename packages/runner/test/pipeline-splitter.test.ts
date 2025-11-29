import { describe, it, expect } from "vitest";
import { PipelineSplitter } from "../src/pipeline-splitter.js";
import { PipelineDefinition, PipelineStep } from "@virta/core";

class Step1 implements PipelineStep<any, any> { execute() {} }
class Step2 implements PipelineStep<any, any> { execute() {} }

describe("PipelineSplitter", () => {
  it("returns null for single step pipeline", () => {
    const def: PipelineDefinition<any, any> = {
      steps: [{ ctor: Step1 }]
    };
    
    const splitter = new PipelineSplitter();
    const split = splitter.splitPipeline(def);
    
    expect(split).toBeNull();
  });

  it("splits a multi-step pipeline", () => {
    const def: PipelineDefinition<any, any> = {
      steps: [
        { ctor: Step1 },
        { ctor: Step2, dependsOn: [Step1] }
      ]
    };
    
    const splitter = new PipelineSplitter();
    const split = splitter.splitPipeline(def);
    
    expect(split).not.toBeNull();
    expect(split!.prefix.steps).toHaveLength(1);
    expect(split!.suffix.steps).toHaveLength(1);
  });
});

