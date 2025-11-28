import { describe, expect, test } from "vitest";
import { PipelineStorage, type PipelineMetadata } from "../src/storage.js";
import type { PipelineDefinition } from "@virta/registry";

describe("PipelineStorage", () => {
  test("saves and retrieves pipelines", () => {
    const storage = new PipelineStorage();
    const metadata: PipelineMetadata = {
      id: "test-pipeline",
      name: "Test Pipeline",
      description: "A test pipeline",
      definition: {
        nodes: [
          { id: "task1", type: "task", dependsOn: [] },
        ],
      },
      metadataByNodeId: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    storage.save(metadata);
    const retrieved = storage.get("test-pipeline");

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe("test-pipeline");
    expect(retrieved?.name).toBe("Test Pipeline");
  });

  test("lists all pipelines", () => {
    const storage = new PipelineStorage();
    
    storage.save({
      id: "pipeline1",
      definition: { nodes: [] },
      metadataByNodeId: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    storage.save({
      id: "pipeline2",
      name: "Pipeline 2",
      definition: { nodes: [] },
      metadataByNodeId: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const list = storage.list();
    expect(list).toHaveLength(2);
    expect(list.map((p) => p.id)).toEqual(["pipeline1", "pipeline2"]);
  });

  test("deletes pipelines", () => {
    const storage = new PipelineStorage();
    
    storage.save({
      id: "pipeline1",
      definition: { nodes: [] },
      metadataByNodeId: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(storage.has("pipeline1")).toBe(true);
    storage.delete("pipeline1");
    expect(storage.has("pipeline1")).toBe(false);
  });

  test("preserves createdAt on update", async () => {
    const storage = new PipelineStorage();
    
    // First save
    storage.save({
      id: "pipeline1",
      definition: { nodes: [] },
      metadataByNodeId: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const firstRetrieved = storage.get("pipeline1");
    const actualCreatedAt = firstRetrieved?.createdAt;
    const firstUpdatedAt = firstRetrieved?.updatedAt;

    // Wait a bit to ensure updatedAt changes
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Second save (update)
    storage.save({
      id: "pipeline1",
      definition: { nodes: [] },
      metadataByNodeId: {},
      createdAt: actualCreatedAt!,
      updatedAt: new Date(),
    });

    const retrieved = storage.get("pipeline1");
    expect(retrieved?.createdAt).toEqual(actualCreatedAt);
    expect(retrieved?.updatedAt.getTime()).toBeGreaterThan(firstUpdatedAt!.getTime());
  });
});

