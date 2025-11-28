# @virta/jsonata

JSONata helpers for step-level transformations in Virta pipelines.

JSONata is used as an expression language inside steps, not as a workflow DSL. This package provides utilities for creating pipeline steps that use JSONata expressions for data transformation and enrichment.

## Installation

```bash
pnpm add @virta/jsonata
```

## Usage

### Basic Usage

Create a pipeline step that uses a JSONata expression:

```typescript
import { JsonataStep } from "@virta/jsonata";
import { runPipeline, type PipelineDefinition } from "@virta/core";

// Define a step using JSONata expression
class TransformStep extends JsonataStep<SourceData, TargetData> {
  constructor() {
    super({
      expression: '{"name": source.name, "total": $sum(source.items.price)}',
    });
  }
}

// Use in pipeline
const definition: PipelineDefinition<SourceData, TargetData> = {
  steps: [{ ctor: TransformStep }],
};

const result = await runPipeline(definition, {
  source: { name: "Order", items: [{ price: 10 }, { price: 20 }] },
  target: {},
});
```

### Using Factory Function

You can also use the `createJsonataStep` factory function:

```typescript
import { createJsonataStep } from "@virta/jsonata";

const step = createJsonataStep<SourceData, TargetData>(
  '{"computed": source.value * 2}'
);
```

### JSONata Expression Input

The JSONata expression receives an input object containing:
- `source`: The source data from the transformation context
- `target`: The current target data from the transformation context

### Options

```typescript
interface JsonataStepOptions {
  expression: string;        // JSONata expression to evaluate
  merge?: boolean;           // Merge result into target (default: true)
  input?: Record<string, unknown>; // Custom input object
}
```

## Examples

### Simple Transformation

```typescript
class ExtractNameStep extends JsonataStep<SourceData, TargetData> {
  constructor() {
    super({
      expression: '{"name": source.name}',
    });
  }
}
```

### Complex Calculations

```typescript
class CalculateStatsStep extends JsonataStep<OrderData, ProcessedOrder> {
  constructor() {
    super({
      expression: `{
        "itemCount": $count(source.items),
        "subtotal": $sum(source.items.price * source.items.quantity),
        "averagePrice": $average(source.items.price)
      }`,
    });
  }
}
```

### Using Target Context

```typescript
class CalculateTotalStep extends JsonataStep<OrderData, ProcessedOrder> {
  constructor() {
    super({
      expression: `{
        "tax": $round(target.subtotal * 0.1, 2),
        "total": target.subtotal + $round(target.subtotal * 0.1, 2)
      }`,
    });
  }
}
```

## Important Notes

1. **Object Keys**: JSONata requires quoted keys in object literals. Use `{"key": value}` not `{key: value}`.

2. **Result Merging**: By default, the result is merged into the target context. Set `merge: false` to replace the target.

3. **Async Evaluation**: JSONata expressions are evaluated asynchronously, so the step's `execute` method is async.

4. **Error Handling**: If the JSONata expression fails, an error is thrown with details about the failure.

## API Reference

### `JsonataStep<S, T>`

A pipeline step class that applies a JSONata expression.

**Constructor:**
```typescript
new JsonataStep(options: JsonataStepOptions)
```

**Methods:**
- `execute(ctx: TransformationContext<S, T>): Promise<void>`

### `createJsonataStep<S, T>(expression: string, options?: Omit<JsonataStepOptions, "expression">)`

Factory function to create a `JsonataStep` instance.

## See Also

- [JSONata Documentation](https://docs.jsonata.org/)
- [Virta Core Documentation](../core/README.md)
- [Examples Package](../examples/README.md) - Contains a complete JSONata example

