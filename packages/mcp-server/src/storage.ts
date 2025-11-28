import type { PipelineDefinition } from "@virta/registry";
import type { StepMetadata } from "@virta/core";

/**
 * Pipeline metadata stored in the registry
 */
export interface PipelineMetadata {
  id: string;
  name?: string;
  description?: string;
  definition: PipelineDefinition;
  metadataByNodeId: Record<string, StepMetadata>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Simple in-memory pipeline storage.
 * 
 * In production, this could be replaced with:
 * - File-based storage
 * - Database (PostgreSQL, MongoDB, etc.)
 * - Cloud storage (S3, DynamoDB, etc.)
 */
export class PipelineStorage {
  private pipelines = new Map<string, PipelineMetadata>();

  /**
   * Stores or updates a pipeline
   */
  save(metadata: PipelineMetadata): void {
    const existing = this.pipelines.get(metadata.id);
    const now = new Date();
    
    this.pipelines.set(metadata.id, {
      ...metadata,
      updatedAt: now,
      createdAt: existing?.createdAt ?? now,
    });
  }

  /**
   * Retrieves a pipeline by ID
   */
  get(id: string): PipelineMetadata | undefined {
    return this.pipelines.get(id);
  }

  /**
   * Lists all pipeline IDs and basic metadata
   */
  list(): Array<{ id: string; name?: string; description?: string; updatedAt: Date }> {
    return Array.from(this.pipelines.values()).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      updatedAt: p.updatedAt,
    }));
  }

  /**
   * Deletes a pipeline
   */
  delete(id: string): boolean {
    return this.pipelines.delete(id);
  }

  /**
   * Checks if a pipeline exists
   */
  has(id: string): boolean {
    return this.pipelines.has(id);
  }

  /**
   * Clears all pipelines
   */
  clear(): void {
    this.pipelines.clear();
  }
}

