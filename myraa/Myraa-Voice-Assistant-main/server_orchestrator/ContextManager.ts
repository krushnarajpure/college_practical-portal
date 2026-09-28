/**
 * MYRAA Context Manager.
 * Maintains operational state across conversation turns to give tools contextual awareness.
 */

import { ExecutionContext } from "./types";

export class ContextManager {
  private context: ExecutionContext = {
    recentTools: [],
  };

  public getContext(): ExecutionContext {
    return { ...this.context };
  }

  public update(updates: Partial<ExecutionContext>): void {
    this.context = {
      ...this.context,
      ...updates,
      recentTools: updates.recentTools || this.context.recentTools,
    };
  }

  public recordToolExecution(
    tool: string,
    args: Record<string, unknown>,
    result?: unknown,
  ): void {
    this.context.recentTools.unshift({
      tool,
      args,
      timestamp: Date.now(),
    });
    if (this.context.recentTools.length > 30) {
      this.context.recentTools.pop();
    }

    // Auto-update context fields based on tool execution
    const resObj =
      typeof result === "object" && result !== null
        ? (result as Record<string, unknown>)
        : {};

    if (tool === "openApplication" && args.name) {
      this.context.activeApp = String(args.name);
    } else if (tool === "getActiveWindow") {
      if (resObj.title) this.context.activeWindow = String(resObj.title);
      if (resObj.process) this.context.activeApp = String(resObj.process);
      if (resObj.hwnd) this.context.activeWindowHwnd = Number(resObj.hwnd);
    } else if (
      (tool === "createFile" ||
        tool === "createPythonFile" ||
        tool === "writeCodeFile") &&
      (resObj.path || args.path)
    ) {
      this.context.lastCreatedPath = String(resObj.path || args.path);
    } else if (
      (tool === "createFolder" || tool === "openFolder") &&
      (resObj.path || args.path || args.name)
    ) {
      this.context.lastOpenedFolder = String(
        resObj.path || args.path || args.name,
      );
      this.context.workingDirectory = String(
        resObj.path || args.path || args.name,
      );
    } else if (
      (tool === "copySelected" ||
        tool === "getClipboard" ||
        tool === "setClipboard") &&
      (resObj.text || args.text)
    ) {
      this.context.lastCopiedText = String(resObj.text || args.text);
    } else if (
      (tool === "desktopBrowserOpen" ||
        tool === "desktopBrowserNavigate" ||
        tool === "openWebsite") &&
      (resObj.url || args.url)
    ) {
      this.context.lastBrowserUrl = String(resObj.url || args.url);
    }
  }

  /**
   * Resolves contextual shortcuts / omitted parameters using active session memory.
   */
  public resolveArgs(
    toolName: string,
    args: Record<string, unknown>,
  ): Record<string, unknown> {
    const resolved = { ...args };

    // Resolve omitted file targets to last created / referenced path
    if (
      ["readFile", "openFile", "renameFile", "deleteFile"].includes(toolName)
    ) {
      if (
        !resolved.path &&
        !resolved.name &&
        !resolved.file &&
        this.context.lastCreatedPath
      ) {
        resolved.path = this.context.lastCreatedPath;
      }
    }

    // Resolve omitted folder targets to last opened folder or working directory
    if (["listFiles", "searchFiles", "openFolder"].includes(toolName)) {
      if (!resolved.path && !resolved.name && !resolved.folder) {
        if (this.context.lastOpenedFolder) {
          resolved.path = this.context.lastOpenedFolder;
        } else if (this.context.workingDirectory) {
          resolved.path = this.context.workingDirectory;
        }
      }
    }

    // Resolve omitted app / window target
    if (
      [
        "closeWindow",
        "minimizeWindow",
        "maximizeWindow",
        "restoreWindow",
      ].includes(toolName)
    ) {
      if (
        !resolved.title &&
        !resolved.application &&
        this.context.activeWindow
      ) {
        resolved.title = this.context.activeWindow;
      }
    }

    // Resolve omitted clipboard content
    if (
      toolName === "pasteClipboard" &&
      !resolved.text &&
      this.context.lastCopiedText
    ) {
      resolved.text = this.context.lastCopiedText;
    }

    return resolved;
  }
}
