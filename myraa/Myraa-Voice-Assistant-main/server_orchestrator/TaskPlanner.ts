/**
 * MYRAA Task Planner.
 * Decomposes incoming tool calls and user intents into structured execution plans
 * with dependency graphs and parallelization metadata.
 */

import { TaskPlan, TaskStep } from "./types";
import { ContextManager } from "./ContextManager";

interface RawFunctionCall {
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
}

export class TaskPlanner {
  constructor(private contextManager: ContextManager) {}

  /**
   * Translates incoming Gemini Live function calls into a cohesive TaskPlan.
   */
  public planCalls(rawCalls: RawFunctionCall[]): TaskPlan {
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const steps: TaskStep[] = [];

    rawCalls.forEach((fc, idx) => {
      const toolName = fc.name || "unknown";
      const rawArgs = (fc.args || {}) as Record<string, unknown>;
      const resolvedArgs = this.contextManager.resolveArgs(toolName, rawArgs);
      const stepId =
        fc.id ||
        `step_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`;

      const description = this.generateStepDescription(toolName, resolvedArgs);
      const isBackground = this.isBackgroundTask(toolName, resolvedArgs);

      steps.push({
        id: stepId,
        toolName,
        args: resolvedArgs,
        description,
        status: "pending",
        isBackground,
      });
    });

    // Detect and wire sequential dependencies across steps
    this.detectDependencies(steps);

    const intent = this.synthesizeIntent(steps);

    return {
      id: planId,
      intent,
      steps,
      status: "planning",
      createdAt: Date.now(),
    };
  }

  /**
   * Determines if steps depend on previous steps (e.g. folder creation before file creation).
   */
  private detectDependencies(steps: TaskStep[]): void {
    for (let i = 1; i < steps.length; i++) {
      const current = steps[i];
      const previous = steps[i - 1];

      // Dependency patterns:
      // 1. App opening followed by keyboard typing or hotkey
      if (
        (previous.toolName === "openApplication" ||
          previous.toolName === "switchApplication") &&
        [
          "keyboardType",
          "keyboardPress",
          "keyboardHotkey",
          "searchWhatsAppChat",
          "sendWhatsAppMessage",
        ].includes(current.toolName)
      ) {
        current.dependsOn = [previous.id];
      }

      // 2. Folder creation followed by file creation or folder opening
      else if (
        previous.toolName === "createFolder" &&
        [
          "createFile",
          "createPythonFile",
          "writeCodeFile",
          "openFolder",
          "openFile",
        ].includes(current.toolName)
      ) {
        current.dependsOn = [previous.id];
      }

      // 3. File creation followed by opening or running
      else if (
        ["createFile", "createPythonFile", "writeCodeFile"].includes(
          previous.toolName,
        ) &&
        ["openFile", "runPythonScript", "readFile"].includes(current.toolName)
      ) {
        current.dependsOn = [previous.id];
      }

      // 4. Power action request followed by execute
      else if (
        previous.toolName === "requestPowerAction" &&
        current.toolName === "executePowerAction"
      ) {
        current.dependsOn = [previous.id];
      }

      // 5. Copy followed by paste or memory saving
      else if (
        previous.toolName === "copySelected" &&
        ["pasteClipboard", "setClipboard", "saveCustomMemory"].includes(
          current.toolName,
        )
      ) {
        current.dependsOn = [previous.id];
      }
    }
  }

  /**
   * Categorizes long-running tasks that can run in background if desired.
   */
  private isBackgroundTask(
    toolName: string,
    args: Record<string, unknown>,
  ): boolean {
    if (toolName === "runPythonScript" && Number(args.timeout || 0) > 10) {
      return true;
    }
    return false;
  }

  /**
   * Human-readable step label.
   */
  private generateStepDescription(
    tool: string,
    args: Record<string, unknown>,
  ): string {
    switch (tool) {
      case "openApplication":
        return `Launch ${args.name || "application"}`;
      case "closeApplication":
        return `Close ${args.name || "application"}`;
      case "getActiveWindow":
        return "Check active window";
      case "listOpenWindows":
        return "List open windows";
      case "restoreWindow":
        return `Restore ${args.title || "window"}`;
      case "createFolder":
        return `Create folder "${args.name || "New Folder"}"`;
      case "createFile":
      case "createPythonFile":
      case "writeCodeFile":
        return `Create file "${args.path || "code file"}"`;
      case "readFile":
        return `Read file "${args.path || "file"}"`;
      case "openFile":
        return `Open file "${args.path || "file"}"`;
      case "runPythonScript":
        return `Run Python script "${args.path || "script"}"`;
      case "openFolder":
        return `Open folder "${args.name || args.path || "folder"}"`;
      case "listFiles":
        return `List files in "${args.name || args.path || "folder"}"`;
      case "searchFiles":
        return `Search files matching "${args.name || args.extension || "*"}"`;
      case "volumeUp":
        return "Increase volume";
      case "volumeDown":
        return "Decrease volume";
      case "setVolume":
        return `Set volume to ${args.percent}%`;
      case "muteToggle":
        return "Toggle mute";
      case "brightnessUp":
        return "Increase brightness";
      case "brightnessDown":
        return "Decrease brightness";
      case "setBrightness":
        return `Set brightness to ${args.percent}%`;
      case "batteryInfo":
        return "Check battery level";
      case "networkStatus":
        return "Check Wi-Fi & Network";
      case "systemInfo":
        return "Gather system diagnostics";
      case "gpuInfo":
        return "Gather GPU stats";
      case "temperatureInfo":
        return "Check hardware temperatures";
      case "listProcesses":
        return "List top running processes";
      case "killProcess":
        return `Terminate process "${args.name || args.pid}"`;
      case "searchWhatsAppChat":
        return `Search WhatsApp contact "${args.contact}"`;
      case "sendWhatsAppMessage":
        return `Send WhatsApp message to "${args.contact}"`;
      case "takeScreenshot":
        return "Capture screen";
      case "analyzeScreenshot":
      case "readScreen":
        return "Analyze visible screen text (OCR)";
      case "desktopBrowserOpen":
      case "desktopBrowserNavigate":
        return `Navigate browser to ${args.url || "webpage"}`;
      case "desktopBrowserSearch":
        return `Search "${args.query}" in browser`;
      case "playYouTubeVideo":
        return `Play YouTube video "${args.query || "video"}"`;
      case "saveCustomMemory":
        return `Save memory (${args.category})`;
      case "changeBackground":
        return `Change theme to ${args.color}`;
      default:
        return `Execute ${tool}`;
    }
  }

  private synthesizeIntent(steps: TaskStep[]): string {
    if (steps.length === 0) return "Standby";
    if (steps.length === 1) return steps[0].description;
    return steps.map((s) => s.description).join(" → ");
  }

  /**
   * Returns all steps in a plan that are currently ready to execute
   * (i.e. status is 'pending' and all dependencies are 'completed').
   */
  public getExecutableSteps(plan: TaskPlan): TaskStep[] {
    const completedIds = new Set(
      plan.steps.filter((s) => s.status === "completed").map((s) => s.id),
    );

    return plan.steps.filter((step) => {
      if (step.status !== "pending") return false;
      if (!step.dependsOn || step.dependsOn.length === 0) return true;
      return step.dependsOn.every((depId) => completedIds.has(depId));
    });
  }
}
