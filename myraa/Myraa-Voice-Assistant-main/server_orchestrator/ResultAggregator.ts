/**
 * MYRAA Result Aggregator.
 * Synthesizes multi-tool outputs into structured responses for Gemini Live and user-facing summaries.
 */

import { TaskPlan, TaskStep } from "./types";

export interface GeminiFunctionResponse {
  name: string;
  response: {
    output: Record<string, unknown>;
  };
  id?: string;
}

export class ResultAggregator {
  /**
   * Formats a completed TaskPlan into the functionResponses array expected by Gemini Live session.sendToolResponse.
   */
  public toGeminiResponses(plan: TaskPlan): GeminiFunctionResponse[] {
    return plan.steps.map((step) => {
      let output: Record<string, unknown>;

      if (step.status === "completed") {
        if (typeof step.result === "object" && step.result !== null) {
          output = step.result as Record<string, unknown>;
        } else {
          output = { result: step.result || "Done." };
        }
      } else if (step.status === "cancelled") {
        output = { result: "Action was cancelled by user.", cancelled: true };
      } else {
        output = {
          error: step.error || "Action failed.",
          failed: true,
        };
      }

      return {
        name: step.toolName,
        response: { output },
        id: step.id,
      };
    });
  }

  /**
   * Generates a concise, affectionate voice summary of all executed actions.
   */
  public toVoiceSummary(plan: TaskPlan): string {
    const successful = plan.steps.filter((s) => s.status === "completed");
    const failed = plan.steps.filter((s) => s.status === "failed");
    const cancelled = plan.steps.filter((s) => s.status === "cancelled");

    if (cancelled.length > 0 && successful.length === 0) {
      return "Task cancelled.";
    }

    if (failed.length > 0 && successful.length === 0) {
      return `Failed to execute: ${failed.map((f) => f.description).join(", ")}.`;
    }

    if (successful.length === 1) {
      const s = successful[0];
      if (
        typeof s.result === "object" &&
        s.result !== null &&
        (s.result as any).result
      ) {
        return String((s.result as any).result);
      }
      return `${s.description} completed.`;
    }

    const completedLabels = successful.map((s) => s.description).join(", ");
    if (failed.length > 0) {
      return `Done: ${completedLabels}, but ${failed.length} step(s) failed.`;
    }

    return `All ${successful.length} actions completed successfully: ${completedLabels}.`;
  }
}
