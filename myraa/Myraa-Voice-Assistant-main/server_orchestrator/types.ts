/**
 * MYRAA Orchestrator Core Types.
 * Defines schemas for plans, task steps, execution contexts, and lifecycle events.
 */

export type StepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type PlanStatus =
  | "planning"
  | "executing"
  | "completed"
  | "partial_failure"
  | "failed"
  | "cancelled";

export interface TaskStep {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  description: string;
  status: StepStatus;
  dependsOn?: string[]; // IDs of prerequisite steps
  result?: unknown;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  isBackground?: boolean;
}

export interface TaskPlan {
  id: string;
  intent: string;
  steps: TaskStep[];
  status: PlanStatus;
  createdAt: number;
  completedAt?: number;
}

export interface ExecutionContext {
  activeWindow?: string;
  activeApp?: string;
  activeWindowHwnd?: number;
  lastCreatedPath?: string;
  lastOpenedFolder?: string;
  lastCopiedText?: string;
  lastBrowserUrl?: string;
  workingDirectory?: string;
  recentTools: Array<{
    tool: string;
    args: Record<string, unknown>;
    timestamp: number;
  }>;
}

export interface ExecutionResult {
  ok: boolean;
  tool: string;
  result?: unknown;
  error?: string;
  contextUpdates?: Partial<ExecutionContext>;
  isBackground?: boolean;
}

export type OrchestratorEventType =
  | "plan:created"
  | "plan:updated"
  | "step:started"
  | "step:progress"
  | "step:completed"
  | "step:failed"
  | "step:cancelled"
  | "plan:completed"
  | "interruption:triggered";

export interface OrchestratorEvent {
  type: OrchestratorEventType;
  planId: string;
  stepId?: string;
  toolName?: string;
  title: string;
  detail?: string;
  status: StepStatus | PlanStatus;
  result?: unknown;
  error?: string;
  plan?: TaskPlan;
  timestamp: number;
}
