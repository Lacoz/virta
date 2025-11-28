/**
 * Type definitions for Amazon States Language (ASL)
 * 
 * Based on AWS Step Functions ASL specification:
 * https://docs.aws.amazon.com/step-functions/latest/dg/concepts-amazon-states-language.html
 * 
 * Note: We maintain our own types for better control and compatibility.
 * The asl-validator package is used for validation.
 */

/**
 * ASL State Types
 */
export type AslStateType =
  | "Task"
  | "Pass"
  | "Choice"
  | "Parallel"
  | "Map"
  | "Wait"
  | "Succeed"
  | "Fail";

/**
 * Base ASL State structure
 */
export interface AslState {
  Type: AslStateType;
  Comment?: string;
  Next?: string;
  End?: boolean;
  InputPath?: string;
  OutputPath?: string;
  ResultPath?: string;
}

/**
 * Task State
 */
export interface AslTaskState extends AslState {
  Type: "Task";
  Resource: string | { [k: string]: any };
  TimeoutSeconds?: number;
  HeartbeatSeconds?: number;
  Retry?: AslRetry[];
  Catch?: AslCatch[];
  Parameters?: unknown;
}

/**
 * Pass State
 */
export interface AslPassState extends AslState {
  Type: "Pass";
  Result?: unknown;
  ResultPath?: string;
  Parameters?: unknown;
}

/**
 * Choice State
 */
export interface AslChoiceState extends AslState {
  Type: "Choice";
  Choices: AslChoiceRule[];
  Default?: string;
}

/**
 * Choice Rule
 */
export interface AslChoiceRule {
  Variable?: string;
  StringEquals?: string;
  StringGreaterThan?: string;
  StringLessThan?: string;
  NumericEquals?: number;
  NumericGreaterThan?: number;
  NumericLessThan?: number;
  BooleanEquals?: boolean;
  TimestampEquals?: string;
  TimestampGreaterThan?: string;
  TimestampLessThan?: string;
  And?: AslChoiceRule[];
  Or?: AslChoiceRule[];
  Not?: AslChoiceRule;
  Next: string;
}

/**
 * Parallel State
 */
export interface AslParallelState extends AslState {
  Type: "Parallel";
  Branches: AslStateMachine[];
}

/**
 * Map State
 */
export interface AslMapState extends AslState {
  Type: "Map";
  ItemsPath?: string;
  MaxConcurrency?: number;
  Iterator: AslStateMachine;
  ResultPath?: string;
}

/**
 * Wait State
 */
export interface AslWaitState extends AslState {
  Type: "Wait";
  Seconds?: number;
  Timestamp?: string;
  SecondsPath?: string;
  TimestampPath?: string;
}

/**
 * Succeed State
 */
export interface AslSucceedState extends AslState {
  Type: "Succeed";
}

/**
 * Fail State
 */
export interface AslFailState extends AslState {
  Type: "Fail";
  Error?: string;
  Cause?: string;
}

/**
 * Retry configuration
 */
export interface AslRetry {
  ErrorEquals: string[];
  IntervalSeconds?: number;
  MaxAttempts?: number;
  BackoffRate?: number;
}

/**
 * Catch configuration
 */
export interface AslCatch {
  ErrorEquals: string[];
  Next: string;
  ResultPath?: string;
}

/**
 * Complete ASL State Machine definition
 */
export interface AslStateMachine {
  Comment?: string;
  StartAt: string;
  States: Record<string, AslState>;
  TimeoutSeconds?: number;
  Version?: string;
}
