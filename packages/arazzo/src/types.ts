/**
 * Type definitions for Arazzo workflow specification
 * 
 * Based on Arazzo 1.0.0 specification:
 * https://spec.openapis.org/arazzo/v1.0.0
 * 
 * Arazzo defines workflows over OpenAPI operations.
 */

/**
 * Arazzo workflow document structure
 */
export interface ArazzoDocument {
  /**
   * Arazzo specification version
   */
  arazzo?: string;
  
  /**
   * OpenAPI specification reference or inline definition
   */
  openapi?: string | Record<string, unknown>;
  
  /**
   * Workflow scenarios
   */
  scenarios?: Record<string, ArazzoScenario>;
  
  /**
   * Additional metadata
   */
  info?: {
    title?: string;
    version?: string;
    description?: string;
  };
}

/**
 * Arazzo scenario (workflow definition)
 */
export interface ArazzoScenario {
  /**
   * Scenario description
   */
  description?: string;
  
  /**
   * Scenario steps
   */
  steps: ArazzoStep[];
  
  /**
   * Additional scenario metadata
   */
  [key: string]: unknown;
}

/**
 * Arazzo step types
 */
export type ArazzoStepType = 
  | "operation"
  | "parallel"
  | "switch"
  | "loop"
  | "sleep"
  | "pass";

/**
 * Base Arazzo step
 */
export interface ArazzoStep {
  /**
   * Step identifier
   */
  id: string;
  
  /**
   * Step type
   */
  type?: ArazzoStepType;
  
  /**
   * Step description
   */
  description?: string;
  
  /**
   * Steps that must complete before this step runs
   */
  runAfter?: string[];
  
  /**
   * Additional step configuration
   */
  [key: string]: unknown;
}

/**
 * Operation step - calls an OpenAPI operation
 */
export interface ArazzoOperationStep extends ArazzoStep {
  type?: "operation";
  
  /**
   * OpenAPI operation reference
   * Format: "operationId" or "path#method" or full reference
   */
  operationId?: string;
  
  /**
   * Operation path (if operationId is not provided)
   */
  path?: string;
  
  /**
   * HTTP method (if operationId is not provided)
   */
  method?: string;
  
  /**
   * Request parameters/body
   */
  inputs?: Record<string, unknown>;
  
  /**
   * Output mapping
   */
  outputs?: Record<string, unknown>;
}

/**
 * Parallel step - runs multiple steps in parallel
 */
export interface ArazzoParallelStep extends ArazzoStep {
  type: "parallel";
  
  /**
   * Steps to run in parallel
   */
  branches?: ArazzoStep[][];
}

/**
 * Switch step - conditional branching
 */
export interface ArazzoSwitchStep extends ArazzoStep {
  type: "switch";
  
  /**
   * Expression to evaluate
   */
  expression?: string;
  
  /**
   * Case branches
   */
  cases?: Array<{
    when?: string | boolean;
    steps: ArazzoStep[];
  }>;
  
  /**
   * Default case
   */
  default?: ArazzoStep[];
}

/**
 * Loop step - repeat steps
 */
export interface ArazzoLoopStep extends ArazzoStep {
  type: "loop";
  
  /**
   * Loop condition or array to iterate
   */
  while?: string | unknown[];
  
  /**
   * Steps to repeat
   */
  steps: ArazzoStep[];
}

/**
 * Sleep step - wait for a duration
 */
export interface ArazzoSleepStep extends ArazzoStep {
  type: "sleep";
  
  /**
   * Duration to sleep (in seconds or ISO 8601 duration)
   */
  duration?: number | string;
}

/**
 * Pass step - no-op step for data transformation
 */
export interface ArazzoPassStep extends ArazzoStep {
  type: "pass";
  
  /**
   * Data to pass through
   */
  data?: unknown;
}


