import type { StepCtor, PipelineStep } from "@virta/core";

/**
 * Registry for mapping string IDs to step constructors.
 * 
 * External formats (ASL, Arazzo, JSON configs) refer to steps via string IDs.
 * StepRegistry resolves these string IDs to actual TypeScript step classes.
 * 
 * Multiple modules/packages can contribute step registrations to the same registry.
 * 
 * @example
 * ```ts
 * const registry = new StepRegistry<SourceData, TargetData>();
 * registry.register("validate", ValidateStep);
 * registry.register("transform", TransformStep);
 * 
 * const step = registry.resolve("validate");
 * ```
 */
export class StepRegistry<S, T> {
  private map = new Map<string, StepCtor<S, T>>();

  /**
   * Register a step constructor with a string ID.
   * 
   * @param id - String identifier for the step
   * @param ctor - Step constructor class
   * @throws Error if the ID is already registered
   * 
   * @example
   * ```ts
   * registry.register("validate", ValidateStep);
   * ```
   */
  register(id: string, ctor: StepCtor<S, T>): void {
    if (this.map.has(id)) {
      throw new Error(`Step ID "${id}" is already registered`);
    }
    this.map.set(id, ctor);
  }

  /**
   * Resolve a string ID to a step constructor.
   * 
   * @param id - String identifier for the step
   * @returns The step constructor
   * @throws Error if the ID is not registered
   * 
   * @example
   * ```ts
   * const ValidateStep = registry.resolve("validate");
   * ```
   */
  resolve(id: string): StepCtor<S, T> {
    const ctor = this.map.get(id);
    if (!ctor) {
      throw new Error(`Unknown stepRef: ${id}`);
    }
    return ctor;
  }

  /**
   * Check if a step ID is registered.
   * 
   * @param id - String identifier to check
   * @returns True if the ID is registered
   */
  has(id: string): boolean {
    return this.map.has(id);
  }

  /**
   * Get all registered step IDs.
   * 
   * @returns Array of registered step IDs
   */
  getRegisteredIds(): string[] {
    return Array.from(this.map.keys());
  }

  /**
   * Clear all registrations.
   */
  clear(): void {
    this.map.clear();
  }

  /**
   * Register multiple steps at once.
   * 
   * @param registrations - Object mapping IDs to constructors
   * 
   * @example
   * ```ts
   * registry.registerAll({
   *   "validate": ValidateStep,
   *   "transform": TransformStep,
   * });
   * ```
   */
  registerAll(registrations: Record<string, StepCtor<S, T>>): void {
    for (const [id, ctor] of Object.entries(registrations)) {
      this.register(id, ctor);
    }
  }
}


