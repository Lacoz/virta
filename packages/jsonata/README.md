# @virta/jsonata

JSONata helpers for step-level transformations in Virta pipelines.

JSONata is used as an expression language inside steps, not as a workflow DSL. This package provides utilities for creating pipeline steps that use JSONata expressions for data transformation and enrichment.

## Installation

```bash
pnpm add @virta/jsonata
```

## Usage

### Loading Expressions

JSONata expressions can be provided in three ways:

1. **Inline expression** - Direct string in code
2. **Local file** - Load from a file on disk
3. **HTTP/HTTPS URL** - Fetch from a remote URL

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

### Loading from File

Load a JSONata expression from a local file:

```typescript
import { JsonataStep } from "@virta/jsonata";

class TransformStep extends JsonataStep<SourceData, TargetData> {
  constructor() {
    super({
      expressionPath: "./expressions/transform.jsonata",
    });
  }
}
```

### Loading from URL

Load a JSONata expression from an HTTP/HTTPS URL:

```typescript
import { JsonataStep } from "@virta/jsonata";

class TransformStep extends JsonataStep<SourceData, TargetData> {
  constructor() {
    super({
      expressionUrl: "https://example.com/transformations/transform.jsonata",
      fetchOptions: {
        headers: {
          "Authorization": "Bearer token",
        },
      },
    });
  }
}
```

### Using Factory Function

You can also use the `createJsonataStep` factory function, which auto-detects the source:

```typescript
import { createJsonataStep } from "@virta/jsonata";

// Inline expression
const step1 = createJsonataStep<SourceData, TargetData>(
  '{"computed": source.value * 2}'
);

// File path (auto-detected)
const step2 = createJsonataStep<SourceData, TargetData>(
  "./expressions/transform.jsonata"
);

// URL (auto-detected)
const step3 = createJsonataStep<SourceData, TargetData>(
  "https://example.com/transform.jsonata"
);
```

### JSONata Expression Input

The JSONata expression receives an input object containing:
- `source`: The source data from the transformation context
- `target`: The current target data from the transformation context

### Options

```typescript
interface JsonataStepOptions {
  expression?: string;        // Inline JSONata expression
  expressionPath?: string;    // Path to local file containing expression
  expressionUrl?: string;     // URL to fetch expression from
  fetchOptions?: RequestInit; // Optional fetch options for URLs
  merge?: boolean;            // Merge result into target (default: true)
  input?: Record<string, unknown>; // Custom input object
}
```

**Note:** You must provide exactly one of `expression`, `expressionPath`, or `expressionUrl`.

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

## Loading Expressions from External Sources

### Helper Functions

You can also use the helper functions directly:

```typescript
import {
  loadExpression,
  loadExpressionFromFile,
  loadExpressionFromUrl,
} from "@virta/jsonata";

// Load from file
const expr1 = await loadExpressionFromFile("./transform.jsonata");

// Load from URL
const expr2 = await loadExpressionFromUrl("https://example.com/transform.jsonata");

// Auto-detect (file or URL)
const expr3 = await loadExpression("./transform.jsonata");
const expr4 = await loadExpression("https://example.com/transform.jsonata");
```

### Expression Caching

When loading from external sources, the expression is compiled and cached after the first load. Subsequent executions of the same step will reuse the cached compiled expression, improving performance.

## See Also

- [JSONata Documentation](https://docs.jsonata.org/)
- [Virta Core Documentation](../core/README.md)
- [Examples Package](../examples/README.md) - Contains complete JSONata examples including external sources

