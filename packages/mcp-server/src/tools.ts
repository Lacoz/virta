import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { PipelineDefinition } from "@virta/registry";
import type { StepMetadata } from "@virta/core";
import { planExecution, computeCriticalPath } from "@virta/planner";
import { pipelineDefinitionToAsl } from "@virta/asl";
import { pipelineDefinitionToArazzo } from "@virta/arazzo";
import { pipelineDefinitionToBpmn } from "@virta/bpmn";
import { aslToPipelineDefinition } from "@virta/asl";
import { arazzoToPipelineDefinition } from "@virta/arazzo";
import { bpmnToPipelineDefinition } from "@virta/bpmn";
import { runPipeline, buildLevels } from "@virta/core";
import { pipelineDefinitionToRegisteredSteps } from "@virta/registry";
import { StepRegistry } from "@virta/registry";
import type { PipelineStorage } from "./storage.js";

/**
 * Tool definitions for MCP server
 */
const toolDefinitions = [
  {
    name: "list_pipelines",
    description: "Returns available pipeline IDs and metadata",
    inputSchema: z.object({}),
  },
  {
    name: "get_pipeline_definition",
    description: "Returns PipelineDefinition as JSON for a given pipeline ID",
    inputSchema: z.object({
      pipelineId: z.string().describe("The ID of the pipeline to retrieve"),
    }),
  },
  {
    name: "run_pipeline_preview",
    description:
      "Evaluates plan (critical path, estimated times, recommended execution mode) without executing steps",
    inputSchema: z.object({
      pipelineId: z.string().describe("The ID of the pipeline to preview"),
    }),
  },
  {
    name: "run_pipeline",
    description: "Executes a pipeline for a given pipelineId and source payload",
    inputSchema: z.object({
      pipelineId: z.string().describe("The ID of the pipeline to execute"),
      source: z.any().describe("Source data for the pipeline"),
    }),
  },
  {
    name: "plan_execution",
    description:
      "Directly calls the planner to determine ExecutionMode and optional details",
    inputSchema: z.object({
      pipelineId: z.string().describe("The ID of the pipeline to plan"),
      lambdaMaxMs: z.number().optional().describe("Maximum Lambda execution time in milliseconds (default: 720000)"),
    }),
  },
  {
    name: "export_asl",
    description: "Returns ASL JSON for a pipeline",
    inputSchema: z.object({
      pipelineId: z.string().describe("The ID of the pipeline to export"),
    }),
  },
  {
    name: "export_arazzo",
    description: "Returns Arazzo scenario JSON for a pipeline",
    inputSchema: z.object({
      pipelineId: z.string().describe("The ID of the pipeline to export"),
      scenarioName: z.string().optional().describe("Optional scenario name (defaults to pipelineId)"),
    }),
  },
  {
    name: "export_bpmn",
    description: "Returns BPMN 2.0 XML for a pipeline",
    inputSchema: z.object({
      pipelineId: z.string().describe("The ID of the pipeline to export"),
    }),
  },
  {
    name: "import_asl",
    description: "Register or update a Virta pipeline from ASL JSON",
    inputSchema: z.object({
      pipelineId: z.string().describe("The ID for the new/updated pipeline"),
      aslJson: z.any().describe("ASL state machine definition"),
      metadataByNodeId: z.record(z.any()).optional().describe("Optional metadata map for nodes"),
    }),
  },
  {
    name: "import_arazzo",
    description: "Register or update a Virta pipeline from Arazzo JSON",
    inputSchema: z.object({
      pipelineId: z.string().describe("The ID for the new/updated pipeline"),
      arazzoJson: z.any().describe("Arazzo workflow document"),
      scenarioName: z.string().describe("The scenario name to import"),
      metadataByNodeId: z.record(z.any()).optional().describe("Optional metadata map for nodes"),
    }),
  },
  {
    name: "import_bpmn",
    description: "Register or update a Virta pipeline from BPMN XML",
    inputSchema: z.object({
      pipelineId: z.string().describe("The ID for the new/updated pipeline"),
      bpmnXml: z.string().describe("BPMN 2.0 XML string"),
      metadataByNodeId: z.record(z.any()).optional().describe("Optional metadata map for nodes"),
    }),
  },
];

/**
 * Registers all MCP tools for Virta pipelines
 */
export function registerTools(server: Server, storage: PipelineStorage): void {
  // Register tools list
  (server as any).setRequestHandler("tools/list", async () => {
    return {
      tools: toolDefinitions,
    };
  });

  // Handle tool calls
  (server as any).setRequestHandler("tools/call", async (request: any) => {
    const toolName = request.params.name;
    const args = (request.params.arguments || {}) as Record<string, unknown>;

      if (toolName === "list_pipelines") {
        const pipelines = storage.list();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  pipelines: pipelines.map((p) => ({
                    id: p.id,
                    name: p.name,
                    description: p.description,
                    updatedAt: p.updatedAt.toISOString(),
                  })),
                },
                null,
                2
              ),
            },
          ],
        } as CallToolResult;
      }

      if (toolName === "get_pipeline_definition") {
        const pipelineId = args.pipelineId as string;
        const pipeline = storage.get(pipelineId);

        if (!pipeline) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: `Pipeline '${pipelineId}' not found` }),
              },
            ],
            isError: true,
          } as CallToolResult;
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  id: pipeline.id,
                  name: pipeline.name,
                  description: pipeline.description,
                  definition: pipeline.definition,
                },
                null,
                2
              ),
            },
          ],
        } as CallToolResult;
      }

      if (toolName === "run_pipeline_preview") {
        const pipelineId = args.pipelineId as string;
        const pipeline = storage.get(pipelineId);

        if (!pipeline) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: `Pipeline '${pipelineId}' not found` }),
              },
            ],
            isError: true,
          } as CallToolResult;
        }

        try {
          const criticalPath = computeCriticalPath(
            pipeline.definition,
            pipeline.metadataByNodeId
          );
          const plan = planExecution(
            pipeline.definition,
            pipeline.metadataByNodeId,
            { lambdaMaxMs: 720000 }
          );

          const registry = new StepRegistry<any, any>();
          const levels = buildLevels({
            steps: pipelineDefinitionToRegisteredSteps(
              pipeline.definition,
              registry
            ),
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    pipelineId: pipeline.id,
                    criticalPath: {
                      nodeIds: criticalPath.nodeIds,
                      timing: criticalPath.timing,
                    },
                    executionPlan: {
                      mode: plan.mode,
                      reasoning: plan.reasoning,
                    },
                    executionLevels: levels.map((level, index) => ({
                      level: index + 1,
                      steps: level.map((ctor) => ctor.name),
                    })),
                  },
                  null,
                  2
                ),
              },
            ],
          } as CallToolResult;
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: error instanceof Error ? error.message : String(error),
                }),
              },
            ],
            isError: true,
          } as CallToolResult;
        }
      }

      if (toolName === "run_pipeline") {
        const pipelineId = args.pipelineId as string;
        const source = args.source;
        const pipeline = storage.get(pipelineId);

        if (!pipeline) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: `Pipeline '${pipelineId}' not found` }),
              },
            ],
            isError: true,
          } as CallToolResult;
        }

        try {
          // Note: This is a simplified version. In production, you'd need
          // to register actual step classes via StepRegistry
          const registry = new StepRegistry<any, any>();
          const coreDef = {
            steps: pipelineDefinitionToRegisteredSteps(pipeline.definition, registry),
          };

          const result = await runPipeline(coreDef, {
            source: source,
            target: {},
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    status: result.status,
                    executedSteps: result.executedSteps.map((ctor) => ctor.name),
                    errors: result.errors.map((e) => ({
                      step: e.step.name,
                      error: String(e.error),
                    })),
                    context: result.context,
                  },
                  null,
                  2
                ),
              },
            ],
          } as CallToolResult;
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: error instanceof Error ? error.message : String(error),
                }),
              },
            ],
            isError: true,
          } as CallToolResult;
        }
      }

      if (toolName === "plan_execution") {
        const pipelineId = args.pipelineId as string;
        const lambdaMaxMs = (args.lambdaMaxMs as number) || 720000;
        const pipeline = storage.get(pipelineId);

        if (!pipeline) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: `Pipeline '${pipelineId}' not found` }),
              },
            ],
            isError: true,
          } as CallToolResult;
        }

        try {
          const plan = planExecution(
            pipeline.definition,
            pipeline.metadataByNodeId,
            { lambdaMaxMs }
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(plan, null, 2),
              },
            ],
          } as CallToolResult;
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: error instanceof Error ? error.message : String(error),
                }),
              },
            ],
            isError: true,
          } as CallToolResult;
        }
      }

      if (toolName === "export_asl") {
        const pipelineId = args.pipelineId as string;
        const pipeline = storage.get(pipelineId);

        if (!pipeline) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: `Pipeline '${pipelineId}' not found` }),
              },
            ],
            isError: true,
          } as CallToolResult;
        }

        try {
          const asl = pipelineDefinitionToAsl(pipeline.definition);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(asl, null, 2),
              },
            ],
          } as CallToolResult;
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: error instanceof Error ? error.message : String(error),
                }),
              },
            ],
            isError: true,
          } as CallToolResult;
        }
      }

      if (toolName === "export_arazzo") {
        const pipelineId = args.pipelineId as string;
        const scenarioName = (args.scenarioName as string) || pipelineId;
        const pipeline = storage.get(pipelineId);

        if (!pipeline) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: `Pipeline '${pipelineId}' not found` }),
              },
            ],
            isError: true,
          } as CallToolResult;
        }

        try {
          const arazzo = pipelineDefinitionToArazzo(
            pipeline.definition,
            scenarioName
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(arazzo, null, 2),
              },
            ],
          } as CallToolResult;
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: error instanceof Error ? error.message : String(error),
                }),
              },
            ],
            isError: true,
          } as CallToolResult;
        }
      }

      if (toolName === "export_bpmn") {
        const pipelineId = args.pipelineId as string;
        const pipeline = storage.get(pipelineId);

        if (!pipeline) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: `Pipeline '${pipelineId}' not found` }),
              },
            ],
            isError: true,
          } as CallToolResult;
        }

        try {
          const bpmn = await pipelineDefinitionToBpmn(pipeline.definition);
          return {
            content: [
              {
                type: "text",
                text: bpmn,
              },
            ],
          } as CallToolResult;
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: error instanceof Error ? error.message : String(error),
                }),
              },
            ],
            isError: true,
          } as CallToolResult;
        }
      }

      if (toolName === "import_asl") {
        const pipelineId = args.pipelineId as string;
        const aslJson = args.aslJson;
        const metadataByNodeId = (args.metadataByNodeId as Record<string, StepMetadata>) || {};

        try {
          const definition = aslToPipelineDefinition(aslJson as any);
          storage.save({
            id: pipelineId,
            definition,
            metadataByNodeId,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  pipelineId,
                  nodeCount: definition.nodes.length,
                }),
              },
            ],
          } as CallToolResult;
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: error instanceof Error ? error.message : String(error),
                }),
              },
            ],
            isError: true,
          } as CallToolResult;
        }
      }

      if (toolName === "import_arazzo") {
        const pipelineId = args.pipelineId as string;
        const arazzoJson = args.arazzoJson;
        const scenarioName = args.scenarioName as string;
        const metadataByNodeId = (args.metadataByNodeId as Record<string, StepMetadata>) || {};

        try {
          const definition = arazzoToPipelineDefinition(
            arazzoJson as any,
            scenarioName
          );
          storage.save({
            id: pipelineId,
            definition,
            metadataByNodeId,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  pipelineId,
                  nodeCount: definition.nodes.length,
                }),
              },
            ],
          } as CallToolResult;
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: error instanceof Error ? error.message : String(error),
                }),
              },
            ],
            isError: true,
          } as CallToolResult;
        }
      }

      if (toolName === "import_bpmn") {
        const pipelineId = args.pipelineId as string;
        const bpmnXml = args.bpmnXml as string;
        const metadataByNodeId = (args.metadataByNodeId as Record<string, StepMetadata>) || {};

        try {
          const definition = await bpmnToPipelineDefinition(bpmnXml);
          storage.save({
            id: pipelineId,
            definition,
            metadataByNodeId,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  pipelineId,
                  nodeCount: definition.nodes.length,
                }),
              },
            ],
          } as CallToolResult;
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: error instanceof Error ? error.message : String(error),
                }),
              },
            ],
            isError: true,
          } as CallToolResult;
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: `Unknown tool: ${toolName}` }),
          },
        ],
        isError: true,
      } as CallToolResult;
  });
}
