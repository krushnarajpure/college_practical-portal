/**
 * MYRAA Orchestrator.
 * Central coordinator for Task Planning, Parallel Execution, Context Management,
 * Result Aggregation, and Interruption Control.
 */

import { ContextManager } from "./ContextManager";
import { TaskPlanner } from "./TaskPlanner";
import { ExecutionEngine } from "./ExecutionEngine";
import { ResultAggregator } from "./ResultAggregator";
import { TaskPlan, OrchestratorEvent } from "./types";

export interface LiveSessionLike {
  sendToolResponse(response: { functionResponses: any[] }): void;
}

export interface ClientWebSocketLike {
  send(data: string): void;
  readyState: number;
}

export class MyraaOrchestrator {
  public contextManager: ContextManager;
  public taskPlanner: TaskPlanner;
  public executionEngine: ExecutionEngine;
  public resultAggregator: ResultAggregator;

  private activePlans: Map<string, TaskPlan> = new Map();
  private clientSockets: Set<ClientWebSocketLike> = new Set();

  constructor(desktopAgentUrl: string = "http://127.0.0.1:8765") {
    this.contextManager = new ContextManager();
    this.taskPlanner = new TaskPlanner(this.contextManager);
    this.executionEngine = new ExecutionEngine(
      this.contextManager,
      desktopAgentUrl,
    );
    this.resultAggregator = new ResultAggregator();

    // Broadcast all internal execution engine events to all connected clients
    this.executionEngine.onEvent((event) => {
      this.broadcastEvent(event);
    });
  }

  public registerClientSocket(ws: ClientWebSocketLike): () => void {
    this.clientSockets.add(ws);
    return () => {
      this.clientSockets.delete(ws);
    };
  }

  private broadcastEvent(event: OrchestratorEvent): void {
    const payload = JSON.stringify({
      type: "orchestratorEvent",
      event,
    });

    // Also support backward-compatible actionStatus messages for legacy UI elements
    const legacyStatusPayload = JSON.stringify({
      type: "actionStatus",
      name: event.toolName || event.title,
      status:
        event.status === "completed"
          ? "done"
          : event.status === "failed"
            ? "error"
            : "running",
      title: event.title,
      detail: event.detail,
      result: event.result || event.error,
    });

    this.clientSockets.forEach((ws) => {
      try {
        if (ws.readyState === 1 /* OPEN */) {
          ws.send(payload);
          ws.send(legacyStatusPayload);
        }
      } catch (err) {
        console.error("[Orchestrator] WebSocket broadcast error:", err);
      }
    });
  }

  /**
   * Main entrypoint: Processes tool calls received from Gemini Live API.
   * Plans actions, executes them in parallel/series, and sends responses back to Gemini.
   */
  public async handleToolCalls(
    calls: Array<{
      id?: string;
      name?: string;
      args?: Record<string, unknown>;
    }>,
    session: LiveSessionLike,
  ): Promise<TaskPlan> {
    console.log(
      `[Orchestrator] Received ${calls.length} tool call(s) from Gemini Live:`,
      calls.map((c) => c.name),
    );

    // Step 1: Plan the tasks & dependencies
    const plan = this.taskPlanner.planCalls(calls);
    this.activePlans.set(plan.id, plan);

    try {
      // Step 2: Execute plan via parallel engine
      await this.executionEngine.executePlan(plan);

      // Step 3: Aggregate results for Gemini Live
      const functionResponses = this.resultAggregator.toGeminiResponses(plan);
      console.log(
        `[Orchestrator] Sending ${functionResponses.length} function response(s) back to Gemini Live...`,
      );

      session.sendToolResponse({ functionResponses });

      return plan;
    } catch (err: any) {
      console.error("[Orchestrator] Plan execution error:", err);

      // Ensure Gemini always receives a response so the session doesn't hang!
      const fallbackResponses = calls.map((c) => ({
        name: c.name || "unknown",
        response: {
          output: {
            error: `Orchestrator execution error: ${err?.message || err}`,
          },
        },
        id: c.id,
      }));

      session.sendToolResponse({ functionResponses: fallbackResponses });
      return plan;
    } finally {
      this.activePlans.delete(plan.id);
    }
  }

  /**
   * Called on voice interruption (when user speaks over Myraa or clicks interrupt).
   * Instantly cancels all in-flight tools across active plans.
   */
  public handleInterruption(): void {
    console.log(
      "[Orchestrator] Voice interruption received. Cancelling in-flight operations...",
    );
    this.executionEngine.cancelAll();

    this.broadcastEvent({
      type: "interruption:triggered",
      planId: "all",
      title: "Voice Interruption",
      status: "cancelled",
      timestamp: Date.now(),
    });
  }
}
