import { StepCtor, TransformationContext } from "./index.js";

export interface CheckpointData<S, T> {
  executedSteps: string[]; // Store class names
  context: TransformationContext<S, T>;
  timestamp: number;
}

export class ExecutionCheckpoint<S, T> {
  constructor(
    public readonly executedSteps: Set<StepCtor<S, T>> = new Set(),
    public context: TransformationContext<S, T>
  ) {}

  addExecutedStep(step: StepCtor<S, T>) {
    this.executedSteps.add(step);
  }

  hasExecuted(step: StepCtor<S, T>): boolean {
    return this.executedSteps.has(step);
  }

  serialize(): string {
    const data: CheckpointData<S, T> = {
      executedSteps: Array.from(this.executedSteps).map((ctor) => ctor.name),
      context: this.context,
      timestamp: Date.now(),
    };
    return JSON.stringify(data);
  }

  static deserialize<S, T>(
    json: string,
    stepMap: Map<string, StepCtor<S, T>>
  ): ExecutionCheckpoint<S, T> {
    const data: CheckpointData<S, T> = JSON.parse(json);
    const executedSteps = new Set<StepCtor<S, T>>();

    for (const className of data.executedSteps) {
      const ctor = stepMap.get(className);
      if (ctor) {
        executedSteps.add(ctor);
      } else {
        // In a real scenario, we might want to throw or log if a step is missing
        // For now, we skip to be safe, but it implies the step map must be complete
        console.warn(`Step class ${className} not found in stepMap during deserialization`);
      }
    }

    return new ExecutionCheckpoint(executedSteps, data.context);
  }
}

