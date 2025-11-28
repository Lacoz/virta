# @virta/examples

Example pipelines and demos for Virta DAG engine.

This package demonstrates various features and usage patterns of the Virta pipeline engine.

## Examples

### Basic Pipeline (`basic.ts`)

A simple sequential pipeline that processes user data through multiple transformation steps.

**Run:**
```bash
pnpm example:basic
```

**What it demonstrates:**
- Sequential step execution
- Data transformation through pipeline
- Dependency management between steps

### Parallel Execution (`parallel.ts`)

Shows how Virta automatically groups independent steps into the same level for parallel execution.

**Run:**
```bash
pnpm example:parallel
```

**What it demonstrates:**
- Automatic parallelization of independent steps
- Performance benefits of parallel execution
- Level-based execution model

### Error Handling (`error-handling.ts`)

Demonstrates how errors are handled and propagated through the pipeline.

**Run:**
```bash
pnpm example:error-handling
```

**What it demonstrates:**
- Error capture and reporting
- Pipeline halting on errors
- Error context preservation

### Hooks (`hooks.ts`)

Shows how to use lifecycle hooks for monitoring, logging, and tracking pipeline execution.

**Run:**
```bash
pnpm example:hooks
```

**What it demonstrates:**
- Lifecycle hooks (onLevelStart, onStepStart, etc.)
- Pipeline monitoring
- Execution tracking

### JSONata (`jsonata.ts`)

Demonstrates using JSONata expressions for data transformation within pipeline steps.

**Run:**
```bash
pnpm example:jsonata
```

**What it demonstrates:**
- JSONata expressions for data transformation
- Complex calculations using JSONata functions
- Combining JSONata steps with regular steps

### JSONata External Sources (`jsonata-external.ts`)

Shows how to load JSONata expressions from external files and URLs.

**Run:**
```bash
pnpm example:jsonata-external
```

**What it demonstrates:**
- Loading expressions from local files
- Loading expressions from HTTP/HTTPS URLs
- Auto-detection of expression source type
- Expression caching for performance

### Registry (`registry.ts`)

Demonstrates using StepRegistry and PipelineDefinition for converting between external formats and core model.

**Run:**
```bash
pnpm example:registry
```

**What it demonstrates:**
- Registering steps with string IDs
- Converting PipelineDefinition to RegisteredStep[]
- Converting RegisteredStep[] back to PipelineDefinition
- Round-trip conversion for import/export workflows

### ASL (`asl.ts`)

Shows how to import and export workflows using Amazon States Language (ASL) format.

**Run:**
```bash
pnpm example:asl
```

**What it demonstrates:**
- Importing ASL state machine definitions
- Converting ASL to PipelineDefinition
- Exporting PipelineDefinition to ASL
- Round-trip conversion with AWS Step Functions format

### Arazzo (`arazzo.ts`)

Demonstrates importing and exporting workflows using Arazzo (OpenAPI-based) format.

**Run:**
```bash
pnpm example:arazzo
```

**What it demonstrates:**
- Importing Arazzo workflow documents
- Converting Arazzo scenarios to PipelineDefinition
- Exporting PipelineDefinition to Arazzo
- Round-trip conversion with OpenAPI workflow tools

### Arazzo ↔ ASL Conversion (`arazzo-asl-conversion.ts`)

Shows bidirectional conversion between Arazzo and ASL formats using static files.

**Run:**
```bash
pnpm example:arazzo-asl
```

**What it demonstrates:**
- Loading Arazzo workflows from JSON files
- Loading ASL workflows from JSON files
- Converting Arazzo → PipelineDefinition → ASL
- Converting ASL → PipelineDefinition → Arazzo
- Round-trip conversion between formats
- Using PipelineDefinition as intermediate format for format conversion

### Arazzo ↔ BPMN Conversion (`arazzo-bpmn-conversion.ts`)

Shows bidirectional conversion between Arazzo and BPMN formats using static files.

**Run:**
```bash
pnpm example:arazzo-bpmn
```

**What it demonstrates:**
- Loading Arazzo workflows from JSON files
- Loading BPMN workflows from XML files
- Converting Arazzo → PipelineDefinition → BPMN
- Converting BPMN → PipelineDefinition → Arazzo
- Round-trip conversion between formats
- Saving converted workflows to files
- Using PipelineDefinition as intermediate format for format conversion

### BPMN (`bpmn.ts`)

Demonstrates importing and exporting workflows using BPMN 2.0 XML format.

**Run:**
```bash
pnpm example:bpmn
```

**What it demonstrates:**
- Loading BPMN XML from files
- Converting BPMN → PipelineDefinition
- Exporting PipelineDefinition → BPMN XML
- Round-trip conversion with BPMN tools
- Using bpmn-moddle for XML parsing and generation

## Running Examples

All examples can be run using the npm scripts defined in `package.json`:

```bash
# Run basic example
pnpm example:basic

# Run parallel execution example
pnpm example:parallel

# Run error handling example
pnpm example:error-handling

# Run hooks example
pnpm example:hooks
```

Or directly with `tsx`:

```bash
tsx src/basic.ts
tsx src/parallel.ts
tsx src/error-handling.ts
tsx src/hooks.ts
```

## Structure

Each example is a standalone TypeScript file that:
1. Defines custom step classes implementing `PipelineStep`
2. Creates a `PipelineDefinition` with step dependencies
3. Uses `buildLevels` to show execution levels
4. Runs the pipeline with `runPipeline`
5. Displays results and execution information

## Learning Path

1. Start with **basic.ts** to understand the core concepts
2. Move to **parallel.ts** to see automatic parallelization
3. Check **error-handling.ts** to understand error behavior
4. Explore **hooks.ts** for advanced monitoring capabilities

