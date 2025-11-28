import type { PipelineDefinition, PipelineNodeDefinition } from "@virta/registry";
import type { StepMetadata } from "@virta/core";

/**
 * Options for TypeScript export
 */
export interface TypeScriptExportOptions {
  /**
   * Name of the pipeline (used for class names and variable names)
   */
  pipelineName?: string;
  /**
   * Source type name (e.g., "OrderData")
   */
  sourceType?: string;
  /**
   * Target type name (e.g., "ProcessedOrder")
   */
  targetType?: string;
  /**
   * Whether to generate step implementations or just stubs
   * @default "stub"
   */
  implementationMode?: "stub" | "jsonata" | "empty";
  /**
   * Whether to include imports
   * @default true
   */
  includeImports?: boolean;
  /**
   * Custom header comment
   */
  headerComment?: string;
}

/**
 * Exports a PipelineDefinition to procedural TypeScript code.
 * 
 * Generates:
 * - Step class definitions (stubs or with JSONata)
 * - Pipeline definition with RegisteredStep[]
 * - Ready-to-run TypeScript code
 * 
 * @param def Pipeline definition to export
 * @param options Export options
 * @returns TypeScript code as string
 * 
 * @example
 * ```ts
 * const tsCode = pipelineDefinitionToTypeScript(pipelineDef, {
 *   pipelineName: "OrderProcessing",
 *   sourceType: "OrderData",
 *   targetType: "ProcessedOrder",
 * });
 * 
 * await writeFile("pipeline.ts", tsCode, "utf-8");
 * ```
 */
export function pipelineDefinitionToTypeScript(
  def: PipelineDefinition,
  options?: TypeScriptExportOptions
): string {
  const pipelineName = options?.pipelineName || "Pipeline";
  const sourceType = options?.sourceType || "any";
  const targetType = options?.targetType || "any";
  const implementationMode = options?.implementationMode || "stub";
  const includeImports = options?.includeImports !== false;

  const lines: string[] = [];

  // Header comment
  if (options?.headerComment) {
    lines.push(`/**`);
    lines.push(` * ${options.headerComment}`);
    lines.push(` */`);
    lines.push("");
  } else {
    lines.push(`/**`);
    lines.push(` * Generated pipeline: ${pipelineName}`);
    lines.push(` * Generated from PipelineDefinition`);
    lines.push(` * `);
    lines.push(` * This file contains step classes and pipeline definition.`);
    lines.push(` * You can customize step implementations as needed.`);
    lines.push(` */`);
    lines.push("");
  }

  // Imports
  if (includeImports) {
    lines.push(`import {`);
    lines.push(`  buildLevels,`);
    lines.push(`  runPipeline,`);
    lines.push(`  type PipelineDefinition,`);
    lines.push(`  type PipelineStep,`);
    lines.push(`  type TransformationContext,`);
    lines.push(`} from "@virta/core";`);
    
    if (implementationMode === "jsonata") {
      lines.push(`import { JsonataStep } from "@virta/jsonata";`);
    }
    
    lines.push("");
  }

  // Generate step classes
  const stepClassNames = new Map<string, string>();
  
  for (const node of def.nodes) {
    // Prefer stepRef over node.id for class name generation
    const className = generateClassName(node.stepRef || node.id);
    stepClassNames.set(node.id, className);

    lines.push(`/**`);
    lines.push(` * Step: ${node.id}`);
    if (node.config && typeof node.config === "object" && "description" in node.config) {
      lines.push(` * ${node.config.description}`);
    }
    lines.push(` */`);
    lines.push(`class ${className} implements PipelineStep<${sourceType}, ${targetType}> {`);

    if (implementationMode === "jsonata" && node.config) {
      // Try to extract JSONata expression from config
      const jsonataExpr = extractJsonataExpression(node.config);
      if (jsonataExpr) {
        lines.push(`  private step = new JsonataStep<${sourceType}, ${targetType}>({`);
        lines.push(`    expression: ${JSON.stringify(jsonataExpr)},`);
        lines.push(`  });`);
        lines.push("");
        lines.push(`  async execute(ctx: TransformationContext<${sourceType}, ${targetType}>): Promise<void> {`);
        lines.push(`    await this.step.execute(ctx);`);
        lines.push(`  }`);
      } else {
        lines.push(`  execute(ctx: TransformationContext<${sourceType}, ${targetType}>): void {`);
        lines.push(`    // TODO: Implement step logic`);
        lines.push(`    // Access ctx.source and modify ctx.target`);
        lines.push(`  }`);
      }
    } else if (implementationMode === "empty") {
      lines.push(`  execute(ctx: TransformationContext<${sourceType}, ${targetType}>): void {`);
      lines.push(`    // Empty implementation`);
      lines.push(`  }`);
    } else {
      // Stub mode (default)
      lines.push(`  execute(ctx: TransformationContext<${sourceType}, ${targetType}>): void {`);
      lines.push(`    // TODO: Implement step logic for ${node.id}`);
      if (node.stepRef) {
        lines.push(`    // stepRef: ${node.stepRef}`);
      }
      lines.push(`    // Access ctx.source and modify ctx.target`);
      lines.push(`  }`);
    }

    lines.push(`}`);
    lines.push("");
  }

  // Generate pipeline definition
  lines.push(`/**`);
  lines.push(` * Pipeline definition for ${pipelineName}`);
  lines.push(` */`);
  lines.push(`const ${pipelineName.toLowerCase()}Definition: PipelineDefinition<${sourceType}, ${targetType}> = {`);
  lines.push(`  steps: [`);

  for (let i = 0; i < def.nodes.length; i++) {
    const node = def.nodes[i];
    const className = stepClassNames.get(node.id)!;
    const isLast = i === def.nodes.length - 1;

    lines.push(`    {`);
    lines.push(`      ctor: ${className},`);

    if (node.dependsOn.length > 0) {
      const dependsOnClasses = node.dependsOn
        .map((depId) => stepClassNames.get(depId))
        .filter((name): name is string => name !== undefined);
      
      if (dependsOnClasses.length > 0) {
        lines.push(`      dependsOn: [${dependsOnClasses.join(", ")}],`);
      }
    }

    // Add metadata if available
    if (node.config && typeof node.config === "object") {
      const meta = extractMetadata(node.config);
      if (meta && (meta.executionHint || meta.timing)) {
        lines.push(`      meta: {`);
        if (meta.executionHint) {
          lines.push(`        executionHint: "${meta.executionHint}",`);
        }
        if (meta.timing) {
          lines.push(`        timing: {`);
          if (meta.timing.p50Ms) {
            lines.push(`          p50Ms: ${meta.timing.p50Ms},`);
          }
          if (meta.timing.p99Ms) {
            lines.push(`          p99Ms: ${meta.timing.p99Ms},`);
          }
          lines.push(`        },`);
        }
        lines.push(`      },`);
      }
    }

    lines.push(`    }${isLast ? "" : ","}`);
  }

  lines.push(`  ],`);
  lines.push(`};`);
  lines.push("");

  // Generate helper function to run the pipeline
  lines.push(`/**`);
  lines.push(` * Run the ${pipelineName} pipeline`);
  lines.push(` */`);
  lines.push(`export async function run${pipelineName}(`);
  lines.push(`  source: ${sourceType},`);
  lines.push(`  target: ${targetType} = {} as ${targetType}`);
  lines.push(`) {`);
  lines.push(`  return await runPipeline(${pipelineName.toLowerCase()}Definition, {`);
  lines.push(`    source,`);
  lines.push(`    target,`);
  lines.push(`  });`);
  lines.push(`}`);
  lines.push("");

  // Export the definition
  lines.push(`export { ${pipelineName.toLowerCase()}Definition };`);
  lines.push(`export { ${Array.from(stepClassNames.values()).join(", ")} };`);

  return lines.join("\n");
}

/**
 * Generates a valid TypeScript class name from a node ID or stepRef
 */
function generateClassName(base: string): string {
  // Convert to PascalCase
  const parts = base
    .split(/[-_\s]+/)
    .map((part) => {
      // Handle camelCase: "formatOrder" -> ["format", "Order"]
      if (part.length > 0 && part[0] === part[0].toLowerCase()) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    });
  
  const className = parts.join("") + "Step";
  
  // Ensure it's a valid identifier
  if (!/^[a-zA-Z_$]/.test(className)) {
    return "Step" + className;
  }
  
  return className;
}

/**
 * Extracts JSONata expression from node config
 */
function extractJsonataExpression(config: unknown): string | null {
  if (!config || typeof config !== "object") {
    return null;
  }

  // Check for common JSONata expression fields
  const obj = config as Record<string, unknown>;
  
  if (typeof obj.expression === "string") {
    return obj.expression;
  }
  
  if (typeof obj.jsonataExpression === "string") {
    return obj.jsonataExpression;
  }

  // Check nested config
  if (obj.config && typeof obj.config === "object") {
    return extractJsonataExpression(obj.config);
  }

  return null;
}

/**
 * Extracts StepMetadata from node config
 */
function extractMetadata(config: unknown): StepMetadata | undefined {
  if (!config || typeof config !== "object") {
    return undefined;
  }

  const obj = config as Record<string, unknown>;
  const meta: StepMetadata = {};

  if (obj.executionHint && typeof obj.executionHint === "string") {
    meta.executionHint = obj.executionHint as StepMetadata["executionHint"];
  }

  if (obj.timing && typeof obj.timing === "object") {
    const timing = obj.timing as Record<string, unknown>;
    meta.timing = {};
    
    if (typeof timing.p50Ms === "number") {
      meta.timing.p50Ms = timing.p50Ms;
    }
    if (typeof timing.p99Ms === "number") {
      meta.timing.p99Ms = timing.p99Ms;
    }
  }

  return Object.keys(meta).length > 0 ? meta : undefined;
}

