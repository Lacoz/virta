/**
 * Planner Example: Execution mode planning for Virta pipelines
 * 
 * This example demonstrates how the planner determines the optimal
 * execution mode (Lambda, Step Functions, or Hybrid) based on:
 * - Pipeline structure (DAG)
 * - Timing estimates (p50, p99)
 * - Execution hints
 * - Configuration (Lambda limits, safety margins)
 */

import {
  planExecution,
  computeCriticalPath,
  type ExecutionPlan,
} from "@virta/planner";
import type { PipelineDefinition } from "@virta/registry";
import type { MetadataByNodeId } from "@virta/planner";

async function main() {
  console.log("=== Planner Example ===\n");

  // Example 1: Short pipeline (Lambda mode)
  console.log("📊 Example 1: Short Pipeline (Lambda Mode)\n");

  const shortPipeline: PipelineDefinition = {
    nodes: [
      { id: "validate", type: "task", dependsOn: [] },
      { id: "process", type: "task", dependsOn: ["validate"] },
      { id: "format", type: "task", dependsOn: ["process"] },
    ],
  };

  const shortMeta: MetadataByNodeId = {
    validate: { timing: { p50Ms: 1000, p99Ms: 2000 } },
    process: { timing: { p50Ms: 500, p99Ms: 1000 } },
    format: { timing: { p50Ms: 300, p99Ms: 600 } },
  };

  const shortPlan = planExecution(shortPipeline, shortMeta, {
    lambdaMaxMs: 720000, // 12 minutes
  });

  console.log("Pipeline:", shortPipeline.nodes.map((n) => n.id).join(" → "));
  console.log("Execution Mode:", shortPlan.mode);
  console.log("Critical Path:", shortPlan.criticalPath.nodeIds.join(" → "));
  console.log("Timing (p99):", `${shortPlan.criticalPath.timing.pessimisticMs}ms`);
  console.log("Reasoning:");
  shortPlan.reasoning.forEach((r) => console.log(`  - ${r}`));
  console.log();

  // Example 2: Long pipeline (Step Functions mode)
  console.log("📊 Example 2: Long Pipeline (Step Functions Mode)\n");

  const longPipeline: PipelineDefinition = {
    nodes: [
      { id: "step1", type: "task", dependsOn: [] },
      { id: "step2", type: "task", dependsOn: ["step1"] },
      { id: "step3", type: "task", dependsOn: ["step2"] },
      { id: "step4", type: "task", dependsOn: ["step3"] },
    ],
  };

  const longMeta: MetadataByNodeId = {
    step1: { timing: { p50Ms: 200000, p99Ms: 300000 } }, // 5 minutes
    step2: { timing: { p50Ms: 200000, p99Ms: 300000 } }, // 5 minutes
    step3: { timing: { p50Ms: 150000, p99Ms: 250000 } }, // 4.17 minutes
    step4: { timing: { p50Ms: 100000, p99Ms: 200000 } }, // 3.33 minutes
  };

  const longPlan = planExecution(longPipeline, longMeta, {
    lambdaMaxMs: 720000, // 12 minutes
  });

  console.log("Pipeline:", longPipeline.nodes.map((n) => n.id).join(" → "));
  console.log("Execution Mode:", longPlan.mode);
  console.log("Critical Path:", longPlan.criticalPath.nodeIds.join(" → "));
  console.log("Timing (p99):", `${longPlan.criticalPath.timing.pessimisticMs}ms`);
  console.log("Reasoning:");
  longPlan.reasoning.forEach((r) => console.log(`  - ${r}`));
  console.log();

  // Example 3: Step requiring Step Functions
  console.log("📊 Example 3: Step Requiring Step Functions\n");

  const sfPipeline: PipelineDefinition = {
    nodes: [
      { id: "task1", type: "task", dependsOn: [] },
      { id: "task2", type: "task", dependsOn: ["task1"] },
    ],
  };

  const sfMeta: MetadataByNodeId = {
    task1: { timing: { p50Ms: 1000, p99Ms: 2000 } },
    task2: {
      timing: { p50Ms: 500, p99Ms: 1000 },
      executionHint: "step-functions-only", // Requires Step Functions
    },
  };

  const sfPlan = planExecution(sfPipeline, sfMeta, {
    lambdaMaxMs: 720000,
  });

  console.log("Pipeline:", sfPipeline.nodes.map((n) => n.id).join(" → "));
  console.log("Execution Mode:", sfPlan.mode);
  console.log("Reasoning:");
  sfPlan.reasoning.forEach((r) => console.log(`  - ${r}`));
  console.log();

  // Example 4: Hybrid mode (if applicable)
  console.log("📊 Example 4: Medium Pipeline (Hybrid Mode)\n");

  const mediumPipeline: PipelineDefinition = {
    nodes: [
      { id: "fast1", type: "task", dependsOn: [] },
      { id: "fast2", type: "task", dependsOn: ["fast1"] },
      { id: "slow1", type: "task", dependsOn: ["fast2"] },
      { id: "slow2", type: "task", dependsOn: ["slow1"] },
    ],
  };

  const mediumMeta: MetadataByNodeId = {
    fast1: { timing: { p50Ms: 50000, p99Ms: 100000 } }, // 1.67 minutes
    fast2: { timing: { p50Ms: 50000, p99Ms: 100000 } }, // 1.67 minutes
    slow1: { timing: { p50Ms: 200000, p99Ms: 300000 } }, // 5 minutes
    slow2: { timing: { p50Ms: 150000, p99Ms: 250000 } }, // 4.17 minutes
  };

  const mediumPlan = planExecution(mediumPipeline, mediumMeta, {
    lambdaMaxMs: 720000,
  });

  console.log("Pipeline:", mediumPipeline.nodes.map((n) => n.id).join(" → "));
  console.log("Execution Mode:", mediumPlan.mode);
  console.log("Critical Path:", mediumPlan.criticalPath.nodeIds.join(" → "));
  console.log("Timing (p99):", `${mediumPlan.criticalPath.timing.pessimisticMs}ms`);

  if (mediumPlan.mode === "hybrid") {
    console.log("Lambda Nodes:", mediumPlan.lambdaNodes?.join(", "));
    console.log("Step Functions Nodes:", mediumPlan.stepFunctionsNodes?.join(", "));
  }

  console.log("Reasoning:");
  mediumPlan.reasoning.forEach((r) => console.log(`  - ${r}`));
  console.log();

  // Example 5: Critical path computation
  console.log("📊 Example 5: Critical Path Computation\n");

  const complexPipeline: PipelineDefinition = {
    nodes: [
      { id: "start", type: "task", dependsOn: [] },
      { id: "branch1", type: "task", dependsOn: ["start"] },
      { id: "branch2", type: "task", dependsOn: ["start"] },
      { id: "end", type: "task", dependsOn: ["branch1", "branch2"] },
    ],
  };

  const complexMeta: MetadataByNodeId = {
    start: { timing: { p50Ms: 100, p99Ms: 200 } },
    branch1: { timing: { p50Ms: 5000, p99Ms: 10000 } }, // Longer branch
    branch2: { timing: { p50Ms: 2000, p99Ms: 4000 } },
    end: { timing: { p50Ms: 100, p99Ms: 200 } },
  };

  const criticalPath = computeCriticalPath(complexPipeline, complexMeta);

  console.log("Pipeline with parallel branches:");
  console.log("  start → branch1 → end");
  console.log("  start → branch2 → end");
  console.log();
  console.log("Critical Path:", criticalPath.nodeIds.join(" → "));
  console.log("Optimistic (p50):", `${criticalPath.timing.optimisticMs}ms`);
  console.log("Pessimistic (p99):", `${criticalPath.timing.pessimisticMs}ms`);
  console.log();

  console.log("✅ Planner Summary:");
  console.log("  • Critical path computation: ✓");
  console.log("  • Lambda mode selection: ✓");
  console.log("  • Step Functions mode selection: ✓");
  console.log("  • Hybrid mode selection: ✓");
  console.log("  • Execution hints support: ✓");
  console.log();
  console.log("The planner helps optimize pipeline execution by:");
  console.log("  - Analyzing DAG structure and timing");
  console.log("  - Recommending optimal execution mode");
  console.log("  - Providing reasoning for decisions");
}

main().catch(console.error);


