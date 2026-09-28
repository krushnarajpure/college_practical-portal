/**
 * MYRAA Execution Engine.
 * Manages parallel and sequential tool execution, active task abort controllers,
 * timeouts, and Desktop Agent communication.
 */

import {
  TaskPlan,
  TaskStep,
  ExecutionResult,
  OrchestratorEvent,
} from "./types";
import { ContextManager } from "./ContextManager";

export type EventListener = (event: OrchestratorEvent) => void;
export type LocalToolHandler = (
  toolName: string,
  args: Record<string, unknown>,
  signal: AbortSignal,
) => Promise<ExecutionResult>;

export class ExecutionEngine {
  private activeAbortControllers: Map<string, AbortController> = new Map();
  private eventListeners: Set<EventListener> = new Set();
  private localHandler: LocalToolHandler | null = null;
  private desktopAgentUrl: string;

  constructor(
    private contextManager: ContextManager,
    desktopAgentUrl: string = "http://127.0.0.1:8765",
  ) {
    this.desktopAgentUrl = desktopAgentUrl;
  }

  public setLocalHandler(handler: LocalToolHandler): void {
    this.localHandler = handler;
  }

  public onEvent(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private emit(event: OrchestratorEvent): void {
    this.eventListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error("[ExecutionEngine] Event listener error:", err);
      }
    });
  }

  /**
   * Cancel all currently running and pending tasks across all plans (used on voice interruption).
   */
  public cancelAll(): void {
    console.log(
      `[ExecutionEngine] Cancelling all active tasks (${this.activeAbortControllers.size} running)...`,
    );
    this.activeAbortControllers.forEach((controller, id) => {
      try {
        controller.abort("User voice interruption");
      } catch {}
    });
    this.activeAbortControllers.clear();
  }

  /**
   * Cancel a specific plan by ID.
   */
  public cancelPlan(plan: TaskPlan): void {
    plan.steps.forEach((step) => {
      const controller = this.activeAbortControllers.get(step.id);
      if (controller) {
        try {
          controller.abort("Plan cancelled");
        } catch {}
        this.activeAbortControllers.delete(step.id);
      }
      if (step.status === "pending" || step.status === "running") {
        step.status = "cancelled";
        this.emit({
          type: "step:cancelled",
          planId: plan.id,
          stepId: step.id,
          toolName: step.toolName,
          title: step.description,
          status: "cancelled",
          timestamp: Date.now(),
        });
      }
    });
    plan.status = "cancelled";
    plan.completedAt = Date.now();
  }

  /**
   * Executes a single task step with timeout and AbortController.
   */
  public async executeStep(
    planId: string,
    step: TaskStep,
  ): Promise<ExecutionResult> {
    const controller = new AbortController();
    this.activeAbortControllers.set(step.id, controller);

    step.status = "running";
    step.startedAt = Date.now();

    this.emit({
      type: "step:started",
      planId,
      stepId: step.id,
      toolName: step.toolName,
      title: step.description,
      status: "running",
      timestamp: Date.now(),
    });

    // Timeout safety (25 seconds default, configurable)
    const timeoutMs =
      typeof step.args.timeout === "number"
        ? (step.args.timeout + 5) * 1000
        : 25000;
    const timeoutTimer = setTimeout(() => {
      controller.abort(`Execution timed out after ${timeoutMs / 1000}s`);
    }, timeoutMs);

    try {
      let result: ExecutionResult;

      // 1. Check if local handler exists (Node-level tools like saveCustomMemory)
      if (
        this.localHandler &&
        ["saveCustomMemory", "changeBackground"].includes(step.toolName)
      ) {
        result = await this.localHandler(
          step.toolName,
          step.args,
          controller.signal,
        );
      } else {
        // 2. Route to Desktop Python Agent
        result = await this.callDesktopAgent(
          step.toolName,
          step.args,
          controller.signal,
        );
      }

      clearTimeout(timeoutTimer);
      this.activeAbortControllers.delete(step.id);

      if (controller.signal.aborted) {
        step.status = "cancelled";
        step.completedAt = Date.now();
        this.emit({
          type: "step:cancelled",
          planId,
          stepId: step.id,
          toolName: step.toolName,
          title: step.description,
          status: "cancelled",
          timestamp: Date.now(),
        });
        return {
          ok: false,
          tool: step.toolName,
          error: "Task cancelled by user",
        };
      }

      if (result.ok) {
        step.status = "completed";
        step.result = result.result;
        step.completedAt = Date.now();

        this.contextManager.recordToolExecution(
          step.toolName,
          step.args,
          result.result,
        );

        this.emit({
          type: "step:completed",
          planId,
          stepId: step.id,
          toolName: step.toolName,
          title: step.description,
          status: "completed",
          result: result.result,
          timestamp: Date.now(),
        });
      } else {
        step.status = "failed";
        step.error = result.error;
        step.completedAt = Date.now();

        this.emit({
          type: "step:failed",
          planId,
          stepId: step.id,
          toolName: step.toolName,
          title: step.description,
          status: "failed",
          error: result.error,
          timestamp: Date.now(),
        });
      }

      return result;
    } catch (err: any) {
      clearTimeout(timeoutTimer);
      this.activeAbortControllers.delete(step.id);

      const isAborted = controller.signal.aborted || err?.name === "AbortError";
      step.status = isAborted ? "cancelled" : "failed";
      step.error = err?.message || String(err);
      step.completedAt = Date.now();

      this.emit({
        type: isAborted ? "step:cancelled" : "step:failed",
        planId,
        stepId: step.id,
        toolName: step.toolName,
        title: step.description,
        status: step.status,
        error: step.error,
        timestamp: Date.now(),
      });

      return {
        ok: false,
        tool: step.toolName,
        error: isAborted
          ? "Task cancelled"
          : `Execution failed: ${err?.message || err}`,
      };
    }
  }

  /**
   * Executes a complete plan: resolving ready steps iteratively and running independent steps in parallel.
   */
  public async executePlan(plan: TaskPlan): Promise<TaskPlan> {
    plan.status = "executing";

    this.emit({
      type: "plan:created",
      planId: plan.id,
      title: plan.intent,
      status: "executing",
      plan,
      timestamp: Date.now(),
    });

    while (true) {
      // Find all pending steps whose dependencies are met
      const completedIds = new Set(
        plan.steps.filter((s) => s.status === "completed").map((s) => s.id),
      );

      const readySteps = plan.steps.filter((step) => {
        if (step.status !== "pending") return false;
        if (!step.dependsOn || step.dependsOn.length === 0) return true;
        return step.dependsOn.every((depId) => completedIds.has(depId));
      });

      if (readySteps.length === 0) {
        break; // All steps either executed, blocked by failures, or plan is finished
      }

      // Execute all ready steps concurrently in parallel!
      console.log(
        `[ExecutionEngine] Executing batch of ${readySteps.length} parallel step(s):`,
        readySteps.map((s) => s.toolName),
      );

      const batchPromises = readySteps.map((step) =>
        this.executeStep(plan.id, step),
      );

      await Promise.allSettled(batchPromises);

      // Check if plan was cancelled during batch
      const currentPlanStatus: string = plan.status;
      if (currentPlanStatus === "cancelled") {
        break;
      }
    }

    // Determine final overall plan status
    const anyFailed = plan.steps.some((s) => s.status === "failed");
    const anyCompleted = plan.steps.some((s) => s.status === "completed");
    const allCancelled = plan.steps.every((s) => s.status === "cancelled");

    const currentPlanStatus: string = plan.status;
    if (currentPlanStatus !== "cancelled") {
      if (allCancelled) {
        plan.status = "cancelled";
      } else if (anyFailed && anyCompleted) {
        plan.status = "partial_failure";
      } else if (anyFailed) {
        plan.status = "failed";
      } else {
        plan.status = "completed";
      }
    }

    plan.completedAt = Date.now();

    this.emit({
      type: "plan:completed",
      planId: plan.id,
      title: plan.intent,
      status: plan.status,
      plan,
      timestamp: Date.now(),
    });

    return plan;
  }

  /**
   * Calls the Python FastAPI desktop agent.
   */
  private async callDesktopAgent(
    tool: string,
    args: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<ExecutionResult> {
    try {
      const res = await fetch(`${this.desktopAgentUrl}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, args }),
        signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return {
          ok: false,
          tool,
          error: `Agent HTTP ${res.status}: ${text.slice(0, 200)}`,
        };
      }

      const data = await res.json();
      return {
        ok: Boolean(data.ok),
        tool,
        result: data.result,
        error: data.error,
      };
    } catch (err: any) {
      if (signal.aborted) {
        return { ok: false, tool, error: "Task cancelled" };
      }
      return {
        ok: false,
        tool,
        error: `Desktop agent communication error: ${err?.message || err}`,
      };
    }
  }
}
