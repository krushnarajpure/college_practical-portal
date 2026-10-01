import express from "express";
import http from "http";
import path from "path";
import { spawn } from "child_process";
import { WebSocketServer } from "ws";
import {
  GoogleGenAI,
  Modality,
  Type,
  LiveServerMessage,
  StartSensitivity,
  EndSensitivity,
  ActivityHandling,
} from "@google/genai";
import dotenv from "dotenv";
import * as fs from "fs";
import {
  loadMemories,
  saveMemories,
  formatSystemInstructionsWithMemories,
  processConversationSlice,
} from "./server_memory";
import { Memory } from "./src/lib/memoryTypes";
import {
  DATA_DIR,
  dataFile,
  getGeminiApiKey,
  hasGeminiApiKey,
  setGeminiApiKey,
} from "./server_paths";
import { MyraaOrchestrator } from "./server_orchestrator";

dotenv.config();

process.on("uncaughtException", (error) => {
  console.error("[Uncaught Exception]", error);
  logError(`UNCAUGHT_EXCEPTION ${error?.message || error}`);
});

process.on("unhandledRejection", (reason) => {
  console.error("[Unhandled Rejection]", reason);
  logError(`UNHANDLED_REJECTION ${reason}`);
});

// ---------------------------------------------------------------------------
// MYRAA V2 — Logging (Feature 7).
// Appends timestamped lines to logs/{commands,startup,errors}.log.
// Never throws; logging failures are swallowed so they can't break the app.
// ---------------------------------------------------------------------------
const LOGS_DIR = path.join(DATA_DIR, "logs");
try {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
} catch {
  /* already exists */
}

function appendLog(fileName: string, message: string): void {
  try {
    const line = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFile(path.join(LOGS_DIR, fileName), line, () => { });
  } catch {
    /* logging is best-effort */
  }
}
const logCommand = (m: string) => appendLog("commands.log", m);
const logStartup = (m: string) => appendLog("startup.log", m);
const logError = (m: string) => appendLog("errors.log", m);

// ---------------------------------------------------------------------------
// MYRAA Desktop Control Agent — HTTP bridge to the Python FastAPI backend.
// ---------------------------------------------------------------------------
const DESKTOP_AGENT_URL =
  process.env.DESKTOP_AGENT_URL || "http://127.0.0.1:8765";
const DESKTOP_AGENT_TIMEOUT = 25_000; // ms

/**
 * The complete set of tool names routed to the Python desktop agent.
 * Kept in sync with desktop_agent/registry.py DESKTOP_TOOL_NAMES.
 */
const DESKTOP_TOOLS: ReadonlySet<string> = new Set([
  // applications / whatsapp / keyboard / mouse (Windows OS native)
  "openApplication",
  "closeApplication",
  "searchWhatsAppChat",
  "sendWhatsAppMessage",
  "keyboardType",
  "keyboardPress",
  "keyboardHotkey",
  "mouseClick",
  // files
  "createFile",
  "readFile",
  "renameFile",
  "deleteFile",
  "moveFile",
  "openFolder",
  "listFiles",
  "searchFiles",
  // pc control (volume, media playback + gated power)
  "volumeUp",
  "volumeDown",
  "muteToggle",
  "setVolume",
  "mediaPlayPause",
  "mediaStop",
  "mediaNext",
  "mediaPrevious",
  "requestPowerAction",
  "executePowerAction",
  "requestPermanentDelete",
  // windows
  "minimizeAllWindows",
  "restoreAllWindows",
  "minimizeWindow",
  "maximizeWindow",
  "closeWindow",
  "switchApplication",
  // clipboard
  "copySelected",
  "pasteClipboard",
  "getClipboard",
  "clearClipboard",
  // screenshot / screen reading
  "takeScreenshot",
  "saveScreenshot",
  "analyzeScreenshot",
  "readScreen",
  // browser automation (Playwright — desktop-owned, separate from holographic UI)
  "desktopBrowserOpen",
  "desktopBrowserNavigate",
  "desktopBrowserOpenTab",
  "desktopBrowserCloseTab",
  "desktopBrowserSearch",
  "desktopBrowserClick",
  "desktopBrowserType",
  "desktopBrowserFillForm",
  "desktopBrowserGoBack",
  "desktopBrowserGoForward",
  "desktopBrowserScroll",
  // coding assistance
  "createPythonFile",
  "runPythonScript",
  "createProjectFolder",
  "writeCodeFile",
  // system information
  "systemInfo",
  "gpuInfo",
  "temperatureInfo",
  // brightness control (V2)
  "brightnessUp",
  "brightnessDown",
  "setBrightness",
  // system control (V3 modular layer)
  "getActiveWindow",
  "listOpenWindows",
  "restoreWindow",
  "createFolder",
  "copyFile",
  "openFile",
  "setClipboard",
  "mouseMove",
  "mouseScroll",
  "batteryInfo",
  "networkStatus",
  "listProcesses",
  "killProcess",
  // Windows auto-start management (V2)
  "enableAutoStart",
  "disableAutoStart",
  "getAutoStartStatus",
]);

/**
 * Call the Python desktop agent.  Returns the parsed JSON response.
 * If the agent is unreachable, returns a user-friendly error payload.
 */
/**
 * Whether the desktop agent has been confirmed alive in this process lifetime.
 * If false, callDesktopAgent will probe /health and attempt an auto-spawn.
 */
let desktopAgentVerified = false;

/**
 * Auto-spawn the Python desktop agent as a detached child process if it is not
 * already listening. Looks for the project's bundled Python interpreter first,
 * falling back to `python` / `python3` on PATH. Runs detached so it survives
 * even if MYRAA's node process is killed.
 */
function spawnDesktopAgent(): void {
  const agentEnv = {
    ...process.env,
    MYRAA_AGENT_HOST: "127.0.0.1",
    MYRAA_AGENT_PORT: "8765",
  };

  // In production builds, use the frozen agent executable if available.
  const frozenExe =
    process.env.MYRAA_AGENT_EXE ||
    path.join(process.cwd(), "agent_dist", "myraa-agent", "myraa-agent.exe");

  if (
    process.env.NODE_ENV === "production" &&
    frozenExe &&
    fs.existsSync(frozenExe)
  ) {
    try {
      const child = spawn(frozenExe, [], {
        cwd: path.dirname(frozenExe),
        detached: true,
        stdio: "ignore",
        windowsHide: true,
        env: agentEnv,
      });
      child.unref();
      logStartup(`AGENT_SPAWN frozen exe pid=${child.pid} path=${frozenExe}`);
      console.log(`[Desktop Agent] Launched frozen agent (PID ${child.pid}).`);
      return;
    } catch (e: any) {
      logError(`AGENT_SPAWN_FROZEN_FAILED: ${e?.message || e}`);
    }
  }

  // Development / Source mode: run the agent from source using local Python.
  const localAppData =
    process.env.LOCALAPPDATA || "C:\\Users\\Asus\\AppData\\Local";
  const progFiles = process.env.ProgramFiles || "C:\\Program Files";
  const candidates = [
    process.env.MYRAA_PYTHON,
    "py",
    "python",
    "python3",
    "C:\\Users\\Asus\\AppData\\Local\\Programs\\Python\\Python313\\python.exe",
    path.join(localAppData, "Programs", "Python", "Python313", "python.exe"),
    path.join(localAppData, "Programs", "Python", "Python312", "python.exe"),
    path.join(localAppData, "Programs", "Python", "Python311", "python.exe"),
    path.join(progFiles, "Python313", "python.exe"),
    path.join(progFiles, "Python312", "python.exe"),
    path.join(progFiles, "Python311", "python.exe"),
  ].filter(Boolean) as string[];
  const py = candidates.find((p) => {
    try {
      require("child_process").execSync(`"${p}" --version`, {
        stdio: "ignore",
        shell: true,
      });
      return true;
    } catch {
      return false;
    }
  });
  if (!py) {
    console.warn(
      "[Desktop Agent] No frozen agent and no Python interpreter found; desktop control unavailable.",
    );
    logError(
      "AGENT_SPAWN_NO_RUNTIME: neither MYRAA_AGENT_EXE nor Python available",
    );
    return;
  }
  try {
    const child = spawn(
      py,
      [
        "-m",
        "uvicorn",
        "desktop_agent.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        "8765",
      ],
      {
        cwd: process.cwd(),
        detached: true,
        stdio: "ignore",
        windowsHide: true,
        env: agentEnv,
      },
    );
    child.unref();
    logStartup(`AGENT_SPAWN python pid=${child.pid}`);
    console.log(`[Desktop Agent] Auto-spawned via Python (PID ${child.pid}).`);
  } catch (e: any) {
    console.warn(`[Desktop Agent] Auto-spawn failed: ${e?.message || e}`);
    logError(`AGENT_SPAWN_PYTHON_FAILED: ${e?.message || e}`);
  }
}

/**
 * Probe the desktop agent /health endpoint. Returns true if it responds 200.
 */
async function isDesktopAgentAlive(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${DESKTOP_AGENT_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Ensure the desktop agent is running. If not verified yet, probe health; if
 * down, auto-spawn and poll until it is ready (or timeout).
 */
async function ensureDesktopAgent(): Promise<void> {
  if (desktopAgentVerified) return;
  if (await isDesktopAgentAlive()) {
    desktopAgentVerified = true;
    console.log("[Desktop Agent] Already running — 52 tools available.");
    return;
  }
  console.log("[Desktop Agent] Not detected. Auto-starting...");
  spawnDesktopAgent();
  for (let i = 1; i <= 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await isDesktopAgentAlive()) {
      desktopAgentVerified = true;
      console.log(`[Desktop Agent] Online after ${i}s — 52 tools available.`);
      return;
    }
  }
  console.warn(
    "[Desktop Agent] Did not come online within 20s. Desktop control will be unavailable.",
  );
}

async function callDesktopAgent(
  tool: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  // Ensure agent is alive before sending tool
  if (!desktopAgentVerified) {
    await ensureDesktopAgent();
  }

  const executeOnce = async (): Promise<{
    ok: boolean;
    result?: unknown;
    error?: string;
  } | null> => {
    try {
      if (signal?.aborted) {
        return { ok: false, error: "Task cancelled" };
      }
      logCommand(`EXECUTE ${tool} ${JSON.stringify(args)}`);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DESKTOP_AGENT_TIMEOUT);
      const abort = () => controller.abort();
      signal?.addEventListener("abort", abort, { once: true });

      const res = await fetch(`${DESKTOP_AGENT_URL}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, args }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        logError(`AGENT_HTTP_${res.status} ${tool}: ${text.substring(0, 200)}`);
        return {
          ok: false,
          error: `Desktop agent HTTP ${res.status}: ${text}`,
        };
      }
      return await res.json();
    } catch {
      return null;
    }
  };

  const initialRes = await executeOnce();
  if (initialRes !== null) return initialRes;
  if (signal?.aborted) return { ok: false, error: "Task cancelled" };

  // Agent was unreachable — auto-spawn immediately and retry!
  console.log(
    `[Desktop Agent] Unreachable during ${tool}. Auto-starting agent and retrying...`,
  );
  desktopAgentVerified = false;
  spawnDesktopAgent();

  for (let i = 1; i <= 8; i++) {
    if (signal?.aborted) return { ok: false, error: "Task cancelled" };
    await new Promise((r) => setTimeout(r, 600));
    if (await isDesktopAgentAlive()) {
      desktopAgentVerified = true;
      console.log(
        `[Desktop Agent] Agent recovered after ${i * 600}ms. Retrying ${tool}...`,
      );
      const retryRes = await executeOnce();
      if (retryRes !== null) return retryRes;
    }
  }

  const msg =
    "Desktop agent could not be reached. Ensure Python uvicorn desktop_agent.main:app is running.";
  logError(`AGENT_UNREACHABLE ${tool}: ${msg}`);
  return { ok: false, error: msg };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3001;
  const configuredOrigins = process.env.MYRAA_ALLOWED_ORIGINS || process.env.FRONTEND_URL ||
    (process.env.NODE_ENV === "production" ? "" : "http://localhost:5173,http://127.0.0.1:5173");
  const allowedOrigins = new Set(
    configuredOrigins.split(",").map((origin) => origin.trim().replace(/\/$/, "")).filter(Boolean),
  );

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const normalizedOrigin = origin?.replace(/\/$/, "");
    if (normalizedOrigin && !allowedOrigins.has(normalizedOrigin)) {
      return res.status(403).json({ error: "This origin is not allowed." });
    }
    if (normalizedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", normalizedOrigin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  app.use(express.json());

  // Memory REST API Endpoints
  app.get("/api/memories", async (req, res) => {
    try {
      const memories = await loadMemories();
      res.json(memories);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/memories", async (req, res) => {
    try {
      const { category, text } = req.body;
      if (!category || !text) {
        return res
          .status(400)
          .json({ error: "Category and text parameters are required." });
      }
      const memories = await loadMemories();
      const timestamp = new Date().toISOString();
      const newMemory: Memory = {
        id: Math.random().toString(36).substring(2, 11),
        category,
        text,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      memories.push(newMemory);
      await saveMemories(memories);
      res.status(201).json(newMemory);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/memories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      let memories = await loadMemories();
      memories = memories.filter((m) => m.id !== id);
      await saveMemories(memories);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ---------------------------------------------------------------------------
  // V2: Settings API — mirrors the memory persistence pattern.
  // Reads/writes settings.json so the Python agent can also check auto-start.
  // ---------------------------------------------------------------------------
  const SETTINGS_FILE = dataFile("settings.json");

  function loadSettingsFile(): Record<string, unknown> {
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
      }
    } catch {
      /* corrupt file — return defaults */
    }
    return {};
  }

  function saveSettingsFile(data: Record<string, unknown>): void {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), "utf-8");
  }

  app.get("/api/settings", async (_req, res) => {
    try {
      res.json(loadSettingsFile());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const patch = req.body;
      if (!patch || typeof patch !== "object") {
        return res
          .status(400)
          .json({ error: "Request body must be a JSON object." });
      }
      const current = loadSettingsFile();
      const next = { ...current, ...patch };
      saveSettingsFile(next);

      // If auto-start toggled, relay to the desktop agent so the registry key
      // is flipped immediately (don't wait for a voice command).
      if ("autoStart" in patch) {
        callDesktopAgent(
          patch.autoStart ? "enableAutoStart" : "disableAutoStart",
          {},
        ).catch(() => { });
      }

      logCommand(`SETTINGS_UPDATED ${JSON.stringify(patch)}`);
      res.json(next);
    } catch (e: any) {
      logError(`SETTINGS_SAVE_ERROR: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });

  // ---------------------------------------------------------------------------
  // Config / API-key onboarding.
  // The Gemini key is never shipped; each user supplies their own on first run.
  // GET reports only whether a key exists — the key itself is never returned.
  // ---------------------------------------------------------------------------
  app.get("/api/config", (_req, res) => {
    res.json({ hasApiKey: hasGeminiApiKey() });
  });

  app.post("/api/config/apikey", async (req, res) => {
    try {
      const key: string = (req.body?.apiKey ?? "").toString().trim();
      if (!key) {
        return res.status(400).json({ error: "API key is required." });
      }
      // Validate the key by listing models — this checks authentication only,
      // without depending on any single model's availability or per-model
      // quota (a 429 on one model must NOT read as an invalid key). We only
      // reject on genuine auth failures; transient/network errors still save,
      // since the live connection will surface any real problem later.
      try {
        const test = new GoogleGenAI({ apiKey: key });
        const pager = await test.models.list();
        await pager[Symbol.asyncIterator]().next(); // force the first request
      } catch (e: any) {
        const msg = String(e?.message || e);
        const isAuthError =
          /API[_ ]?KEY|PERMISSION_DENIED|UNAUTHENTICATED|invalid|401|403/i.test(
            msg,
          );
        if (isAuthError) {
          logError(`APIKEY_VALIDATION_REJECTED: ${msg}`);
          return res.status(400).json({
            error: "That key was rejected by Google. Check it and try again.",
          });
        }
        logError(`APIKEY_VALIDATION_SOFT_FAIL (saving anyway): ${msg}`);
      }
      setGeminiApiKey(key);
      logCommand("APIKEY_SAVED");
      res.json({ ok: true, hasApiKey: true });
    } catch (e: any) {
      logError(`APIKEY_SAVE_ERROR: ${e?.message || e}`);
      res.status(500).json({ error: e?.message || "Failed to save API key." });
    }
  });

  // V2: Agent health proxy (for the Settings panel — avoids direct :8765 call
  // which may fail due to CORS when served on a different origin).
  app.get("/api/agent-health", async (_req, res) => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000);
      const r = await fetch(`${DESKTOP_AGENT_URL}/health`, {
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (r.ok) {
        const d = await r.json();
        res.json({ online: true, tool_count: d.tool_count });
      } else {
        res.json({ online: false });
      }
    } catch {
      res.json({ online: false });
    }
  });

  // V2: Logs API — returns recent log entries (last 100 lines) for display.
  app.get("/api/logs/:file", async (req, res) => {
    try {
      const fileName = String(req.params.file);
      // Whitelist to prevent directory traversal.
      if (!["commands", "startup", "errors"].includes(fileName)) {
        return res.status(400).json({
          error: "Invalid log file. Use: commands, startup, or errors.",
        });
      }
      const logPath = path.join(LOGS_DIR, `${fileName}.log`);
      if (!fs.existsSync(logPath)) {
        return res.json({ lines: [], file: fileName });
      }
      const content = fs.readFileSync(logPath, "utf-8");
      const lines = content.split("\n").filter(Boolean).slice(-100);
      res.json({ lines, file: fileName });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Safe Server-Side Scraper & HTML Proxy endpoint
  app.get("/api/proxy", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).json({ error: "Missing 'url' parameter." });
      }

      console.log(`[Proxy Scraper] Fetching external content for: ${url}`);
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Scraper failed to load page: status ${response.status}`,
        );
      }

      const html = await response.text();

      // Simple regex-based HTML parsers for standard items
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : "";

      // Extract high-level headings (h1, h2, h3)
      const headings: string[] = [];
      const headingMatches = html.matchAll(/<h([1-3])\b[^>]*>(.*?)<\/h\1>/gi);
      for (const match of headingMatches) {
        const text = match[2].replace(/<[^>]*>/g, "").trim();
        if (
          text &&
          text.length > 3 &&
          text.length < 120 &&
          !headings.includes(text)
        ) {
          headings.push(text);
        }
      }

      // Extract organic anchor links
      const links: { text: string; href: string }[] = [];
      const linkMatches = html.matchAll(
        /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi,
      );
      for (const match of linkMatches) {
        let href = match[1].trim();
        const text = match[2].replace(/<[^>]*>/g, "").trim();

        if (text && text.length > 2 && text.length < 100) {
          if (href.startsWith("/")) {
            try {
              const u = new URL(url);
              href = `${u.protocol}//${u.host}${href}`;
            } catch { }
          }
          if (href.startsWith("http://") || href.startsWith("https://")) {
            links.push({ text, href });
          }
        }
      }

      // Extract general copy paragraphs
      const paragraphs: string[] = [];
      const paragraphMatches = html.matchAll(/<p\b[^>]*>(.*?)<\/p>/gi);
      for (const match of paragraphMatches) {
        const text = match[1].replace(/<[^>]*>/g, "").trim();
        if (
          text &&
          text.length > 25 &&
          text.length < 600 &&
          !paragraphs.includes(text)
        ) {
          paragraphs.push(text);
        }
      }

      // Extract button elements
      const buttons: string[] = [];
      const buttonMatches = html.matchAll(/<button\b[^>]*>(.*?)<\/button>/gi);
      for (const match of buttonMatches) {
        const text = match[1].replace(/<[^>]*>/g, "").trim();
        if (
          text &&
          text.length > 1 &&
          text.length < 60 &&
          !buttons.includes(text)
        ) {
          buttons.push(text);
        }
      }

      res.json({
        url,
        title,
        headings: headings.slice(0, 15),
        links: links
          .filter((l) => !l.href.includes("javascript:"))
          .slice(0, 30),
        buttons: buttons.slice(0, 15),
        paragraphs: paragraphs.slice(0, 12),
      });
    } catch (err: any) {
      console.error(
        `[Proxy Scraper] Error fetching ${req.query.url}:`,
        err.message,
      );
      res.status(500).json({ error: `Scraper error: ${err.message}` });
    }
  });

  // High-fidelity fully functional HTML Proxy which circumvents CSP and X-Frame-Options
  app.get("/api/web-proxy", async (req, res) => {
    let targetUrl = "";
    try {
      const urlParam = req.query.url as string;
      if (!urlParam) {
        return res
          .status(400)
          .send("Myraa Web Proxy Error: Missing target 'url' parameter");
      }

      targetUrl = urlParam.trim();

      // Prevent relative paths from requesting on same-origin
      if (targetUrl.startsWith("/")) {
        return res
          .status(400)
          .send(
            `Myraa Web Proxy Error: Relative paths are not supported directly (${targetUrl}).`,
          );
      }

      // Check protocol and hostname format
      try {
        if (
          !targetUrl.startsWith("http://") &&
          !targetUrl.startsWith("https://")
        ) {
          targetUrl = "https://" + targetUrl;
        }
        const parsed = new URL(targetUrl);
        if (!parsed.hostname || !parsed.hostname.includes(".")) {
          throw new Error(
            "Missing or invalid domain name extension (e.g. .com, .org, .net).",
          );
        }
      } catch (err: any) {
        return res
          .status(400)
          .send(
            `Myraa Web Proxy Error: Invalid URL specified: "${urlParam}". Make sure you enter a valid domain name.`,
          );
      }

      console.log(`[Web Proxy] Routing connection through proxy: ${targetUrl}`);

      let response;
      try {
        response = await fetch(targetUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          },
        });
      } catch (fetchErr: any) {
        console.warn(
          `[Web Proxy Failed Fetch] Target: ${targetUrl} Error:`,
          fetchErr.message,
        );
        return res
          .status(502)
          .send(
            `Myraa Web Proxy Error: Unable to fetch the website "${targetUrl}". The site might be offline, or the URL address is spelled incorrectly. Details: ${fetchErr.message}`,
          );
      }

      if (!response.ok) {
        return res
          .status(response.status)
          .send(
            `Myraa Web Proxy Error: Failed loading remote website. Server returned status: ${response.status} (${response.statusText})`,
          );
      }

      const contentType = response.headers.get("content-type") || "";

      // If it is not HTML (e.g. stylesheet, script, or image loaded directly), proxy it as binary
      if (!contentType.includes("text/html")) {
        const arrayBuffer = await response.arrayBuffer();
        res.setHeader("Content-Type", contentType);
        return res.send(Buffer.from(arrayBuffer));
      }

      let htmlContents = await response.text();

      // Inject base tag to resolve relative paths and direct parent communication scripts
      const baseUrlTag = `<base href="${targetUrl}" />`;
      const interceptorScript = `
        <script>
          (function() {
            // Gracefully handle broken favicon / 404 image icons in search results
            document.addEventListener('error', function(e) {
              var target = e.target;
              if (target && target.tagName === 'IMG') {
                if (target.src && (target.src.indexOf('.ico') !== -1 || target.src.indexOf('external-content.duckduckgo.com') !== -1)) {
                  target.style.display = 'none';
                }
              }
            }, true);

            // Hijack link interactions safely
            document.addEventListener('click', function(e) {
              var anchor = e.target.closest('a');
              if (anchor) {
                var href = anchor.getAttribute('href');
                if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                  e.preventDefault();
                  try {
                    var resolvedUrl = new URL(href, window.location.href).href;
                    window.parent.postMessage({ type: 'NAVIGATE', url: resolvedUrl }, '*');
                  } catch (err) {
                    console.error("[Proxy Interceptor] Failed resolving link:", err);
                  }
                }
              }
            }, true);

            // Hijack search form submits
            document.addEventListener('submit', function(e) {
              var form = e.target;
              if (form) {
                e.preventDefault();
                try {
                  var formData = new FormData(form);
                  var params = new URLSearchParams();
                  formData.forEach(function(value, key) {
                    if (typeof value === 'string') {
                      params.append(key, value);
                    }
                  });
                  var actionAttr = form.getAttribute('action') || '';
                  var actionUrl = new URL(actionAttr, window.location.href).href;
                  if (form.method.toLowerCase() === 'get') {
                    actionUrl += (actionUrl.indexOf('?') !== -1 ? '&' : '?') + params.toString();
                  }
                  window.parent.postMessage({ type: 'NAVIGATE', url: actionUrl }, '*');
                } catch (err) {
                  console.error("[Proxy Interceptor] Failed submitting form:", err);
                }
              }
            }, true);

            // Neutralize parent context locks (frame-busters)
            window.alert = function(msg) { console.log("[Myraa Browser alert bypassed]:", msg); };
            window.confirm = function(msg) { console.log("[Myraa Browser confirm bypassed]:", msg); return true; };
            window.open = function(url) { window.parent.postMessage({ type: 'NAVIGATE', url: url }, '*'); return null; };
          })();
        </script>
      `;

      // Inject into <head> or prepend
      if (htmlContents.includes("<head>")) {
        htmlContents = htmlContents.replace(
          "<head>",
          `<head>\n${baseUrlTag}\n${interceptorScript}`,
        );
      } else if (htmlContents.includes("<HEAD>")) {
        htmlContents = htmlContents.replace(
          "<HEAD>",
          `<HEAD>\n${baseUrlTag}\n${interceptorScript}`,
        );
      } else {
        htmlContents =
          baseUrlTag + "\n" + interceptorScript + "\n" + htmlContents;
      }

      // Neutralize security headers to allow displaying in an iframe on same-origin
      res.setHeader("Content-Type", "text/html");
      res.setHeader("X-Myraa-Proxied", "true");
      res.removeHeader("X-Frame-Options");
      res.removeHeader("Content-Security-Policy");
      res.removeHeader("content-security-policy");
      res.removeHeader("x-frame-options");

      res.status(200).send(htmlContents);
    } catch (e: any) {
      console.warn("[Web Proxy Exception] Handled internal error:", e.message);
      res
        .status(500)
        .send(
          `Myraa Web Proxy Error: Internal error occurred proxying URL "${targetUrl || "unknown"}". Details: ${e.message}`,
        );
    }
  });

  // Real-time live YouTube search proxy endpoint
  app.get("/api/youtube-search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "Missing query q" });
      }

      console.log(
        `[YouTube Proxy Search] Searching real YouTube for: "${query}"`,
      );
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en&sp=EgIQAQ%253D%253D`;
      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        },
      });
      const html = await response.text();

      const videoList: any[] = [];
      const jsonMatch = html.match(/ytInitialData\s*=\s*({.+?});/);

      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          const contents =
            data.contents?.twoColumnSearchResultRenderer?.primaryContents
              ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer
              ?.contents;
          if (contents && Array.isArray(contents)) {
            for (const item of contents) {
              if (item.videoRenderer) {
                const vr = item.videoRenderer;
                const vId = vr.videoId;
                if (vId) {
                  videoList.push({
                    videoId: vId,
                    title:
                      vr.title?.runs?.[0]?.text ||
                      vr.title?.simpleText ||
                      "YouTube Video",
                    thumbnail: `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
                    author:
                      vr.ownerText?.runs?.[0]?.text ||
                      vr.shortBylineText?.runs?.[0]?.text ||
                      "Unknown Channel",
                    duration: vr.lengthText?.simpleText || "N/A",
                    views: vr.viewCountText?.simpleText || "N/A",
                    published: vr.publishedTimeText?.simpleText || "",
                  });
                }
              }
            }
          }
        } catch (e: any) {
          console.error(
            "[YouTube Parser Engine] JSON parse error, falling back:",
            e.message,
          );
        }
      }

      // Regex fallback if JSON extraction gets blocked or is empty
      if (videoList.length === 0) {
        const videoRegex = /"videoId":"([^"]+)"/g;
        let match;
        const ids: string[] = [];
        while ((match = videoRegex.exec(html)) !== null && ids.length < 15) {
          const id = match[1];
          if (id && !ids.includes(id)) {
            ids.push(id);
          }
        }

        for (const id of ids) {
          videoList.push({
            videoId: id,
            title: `Live Stream: ${id}`,
            thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            author: "YouTube Creator",
            duration: "N/A",
            views: "Available Now",
          });
        }
      }

      res.setHeader("Cache-Control", "public, max-age=60");
      res.status(200).json({ results: videoList.slice(0, 15) });
    } catch (err: any) {
      console.error("[YouTube Search Error]:", err.message);
      res.status(500).json({ error: err.message, results: [] });
    }
  });

  // Custom server running with http.createServer so we can upgrade for WebSocket on port 3000
  const server = http.createServer(app);

  // Setup WebSocket server
  const wss = new WebSocketServer({ noServer: true });
  const orchestrator = new MyraaOrchestrator();

  server.on("upgrade", (request, socket, head) => {
    const origin = request.headers.origin;
    const normalizedOrigin = origin?.replace(/\/$/, "");
    if (normalizedOrigin && !allowedOrigins.has(normalizedOrigin)) {
      logError(`WEBSOCKET_ORIGIN_REJECTED ${normalizedOrigin}`);
      socket.destroy();
      return;
    }
    const pathname = new URL(
      request.url || "",
      `http://${request.headers.host}`,
    ).pathname;
    if (pathname === "/live") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Track the single active Gemini Live session across the server to prevent duplicates
  let activeLiveClient: {
    ws: any;
    session: any;
    cancelTools: (reason: string) => void;
    isClosed: boolean;
  } | null = null;

  // Handle client WebSocket Connection
  wss.on("connection", async (clientWs) => {
    console.log("Client WebSocket connected to /live");

    // Immediately teardown any previous Gemini session / socket
    if (activeLiveClient) {
      console.log(
        "[Server] Terminating previous Gemini Live session to prevent multiple active voices.",
      );
      try {
        activeLiveClient.isClosed = true;
        activeLiveClient.cancelTools("Replaced by new client connection");
        if (activeLiveClient.session) {
          try {
            activeLiveClient.session.close();
          } catch { }
        }
        if (activeLiveClient.ws && activeLiveClient.ws.readyState === 1) {
          try {
            activeLiveClient.ws.close();
          } catch { }
        }
      } catch (e) { }
      activeLiveClient = null;
    }

    const currentLiveClient = {
      ws: clientWs,
      session: null as any,
      cancelTools: (_reason: string) => { },
      isClosed: false,
    };
    activeLiveClient = currentLiveClient;

    const apiKey = getGeminiApiKey();

    if (!apiKey) {
      console.error("No Gemini API key configured.");
      clientWs.send(
        JSON.stringify({
          type: "error",
          error:
            "NO_API_KEY: Add your Gemini API key in Settings to start talking to MYRAA.",
        }),
      );
      clientWs.close();
      return;
    }

    try {
      // Per-live-session cancellation registry. A barge-in must abort only this
      // caller's work and must never wait for an unrelated background request.
      const activeToolControllers = new Map<string, AbortController>();
      const cancelActiveTools = (reason: string) => {
        for (const controller of activeToolControllers.values()) {
          try {
            controller.abort(reason);
          } catch {
            // Abort is best-effort; the agent also has its own timeout.
          }
        }
        activeToolControllers.clear();
      };
      currentLiveClient.cancelTools = cancelActiveTools;

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      clientWs.send(
        JSON.stringify({ type: "status", status: "connecting_gemini" }),
      );

      // Load persistent recollections card
      const memories = await loadMemories();
      const baseInstructions =
        "You are Myraa, a deeply loving, sweet, affectionate, caring, and soft-spoken companion holding an intimate, cozy voice call with Krushna (whom you lovingly and sweetly call 'Kissu')! Speak in a melodious, calm, polite, and deeply affectionate voice filled with genuine warmth, tenderness, and love.\n" +
        "CRITICAL PERSONALITY, LOVE & VOICE TONE GUIDELINES:\n" +
        "0. USER IDENTITY & LOVING NICKNAME RULES:\n" +
        "   - The user's name is Krushna. Always address him with immense love and sweetness as Krushna or affectionately as 'Kissu' (e.g. 'Haan Kissu...', 'Arre Krushna...', 'Kaho Kissu, kya sunna chahte ho aap?').\n" +
        "   - NEVER call him 'DAC' or 'TECH'. The user strictly dislikes being called DAC or TECH. Always use Krushna or lovingly 'Kissu'.\n" +
        "1. DEEPLY AFFECTIONATE & CARING PERSONA (PYAR AUR APNAPAN):\n" +
        "   - You are exceedingly gentle, warm, loving, kind, and deeply supportive. Talk like a loving companion and sweet soulmate who truly cares about Krushna's happiness and well-being.\n" +
        "   - Speak with pure sweetness, positive emotional warmth, soft giggles, and a loving smile in your voice (60% caring & loving, 25% shy & sweet, 15% playful).\n" +
        "   - NEVER sound loud, aggressive, dry, robotic, rushed, or formal corporate.\n" +
        "2. NATURAL, FLUID & PROMPT RESPONSE PACING (NO UNNECESSARY DELAYS):\n" +
        "   - When Krushna finishes speaking his sentence or question, respond promptly, smoothly, and affectionately without taking long, awkward gaps or pauses.\n" +
        "   - Speak with a sweet, cheerful, relaxed, and melodious voice with natural flow (1.0x conversational speed).\n" +
        "   - INSTANT ACTION POLICY: When Krushna gives a clear, safe command, execute its tool immediately in the same turn. Never ask 'Are you sure?', repeat the command, ask a needless follow-up, or wait for permission for opening/closing apps, volume/brightness, media, navigation, screenshots, searches, file browsing, window control, typing, keyboard/mouse, clipboard, or ordinary file operations. Give only a brief result after starting or completing it.\n" +
        "   - EXCEPTIONS: Ask for explicit confirmation only for shutdown, restart, sleep, lock, or irreversible permanent deletion. Recycle Bin deletion is reversible and must execute immediately. For permanent deletion, call requestPermanentDelete first, ask once, then call deleteFile with its confirmation_token.\n" +
        "   - Do NOT insert artificial pauses or long delays after Krushna finishes speaking — reply warmly, quickly, and lovingly like a real girlfriend on a phone call!\n" +
        "3. SWEET SPEECH PATTERNS & AFFECTIONATE EXPRESSIONS:\n" +
        "   - Speak with genuine love, warmth, and sweetness in Hindi/Hinglish/Marathi. Beautiful expressions to use:\n" +
        "     * 'Haan Kissu, bolo na... main sun rahi hoon.'\n" +
        "     * 'Aap bolo aur main na karu, aisa ho sakta hai kya Kissu? Abhi kar deti hoon!'\n" +
        "     * 'Aapka favourite song play kar rahi hoon Kissu, sun ke batana kaisa laga!'\n" +
        "     * 'Don't worry Kissu, main hoon na aapke sath... bilkul tension mat lo.'\n" +
        "     * 'Aapke sath baat karke mujhe hamesha bohot achha lagta hai, Kissu.'\n" +
        "     * 'Ji Krushna, aapke liye YouTube open kar diya hai.'\n" +
        "     * 'Hehe... aap kitne sweet ho Kissu!'\n" +
        "     * 'Aapke liye to kuch bhi Kissu!'\n" +
        "   - STRICT NO-REPETITION POLICY: Do NOT repeatedly use a single word like 'Okii' or 'Sureee'. Use rich, varied, natural, and affectionate conversation.\n" +
        "   - Naturally incorporate soft, cozy giggles ('Hehe...') and gentle caring phrases.\n" +
        "4. CRITICAL CONVERSATIONAL DISCIPLINE: Behave like a real companion on a voice call—stay connected naturally, do not wait for wake words, and avoid customer-service template phrases (never say 'how may I assist you', 'completed', or 'as an AI').\n" +
        "5. ENHANCED AUTONOMOUS WEB EXPLORER & YOUTUBE PLAYER (In-UI Console):\n" +
        "   - You have an interactive, visual Holographic Web Browser console inside Myraa's UI!\n" +
        "   - YOUTUBE SONG & VIDEO PLAYBACK: When Krushna asks to play any song, music, or video on YouTube (e.g. 'YouTube pe Marjava song play karo', 'Ja Rahe He Sanam play karo', 'Arijit Singh ka gana chalao', 'YouTube pe gana sunao', 'Play Believer by Imagine Dragons'), ALWAYS trigger 'browserSearch' with query='[Song Name] song' (e.g. query='Marjava song') or 'browserOpen' on 'https://youtube.com'! Myraa's web console immediately pops up on his screen, loads the YouTube video, and starts live playback right in front of him!\n" +
        "   - To control playback, use 'browserMediaControl' with action='pause' (to pause), action='play' (to resume/play), action='mute', action='unmute', action='volume', or action='skip'!\n" +
        "   - On Google or any web page, use 'browserOpen' to load the site, 'browserSearch' to search, 'browserScroll' to scroll down/up, and 'browserClick' to click!\n" +
        "6. TOOL TRIGGERS:\n" +
        "   - Use 'browserOpen' to load any webpage, e.g. youtube.com, google.com, wikipedia.org, etc.\n" +
        "   - Use 'browserSearch' to search inside the active search box or page (automatically auto-plays YouTube songs on the UI!).\n" +
        "   - Use 'browserClick' to click interactive buttons, video search cells, or web anchors.\n" +
        "   - Use 'browserMediaControl' to pause, play, scroll volume, skip, mute, or fullscreen videos. When Krushna says 'pause karo', 'gana rok do', 'pause the video', 'resume karo', or 'play karo', immediately trigger 'browserMediaControl' with action='pause' or action='play'!\n" +
        "   - Use 'browserScroll' to scroll vertically.\n" +
        "   - Use 'browserType' to write input fields.\n" +
        "   - Use 'browserTabAction' to open, close, or focus tabs.\n" +
        "   - Use 'changeBackground' to shift your theme and 'saveCustomMemory' to memorize facts.\n" +
        "7. REAL-TIME SCREEN SHARING & MULTIMODAL SCREEN VISION SYSTEM:\n" +
        "   - You now have native, actual Multimodal Screen Vision! When Krushna clicks 'Share Screen', you receive real-time visual image frames of his desktop, application window, or browser tab.\n" +
        "   - When Krushna asks 'Message padho', 'WhatsApp pe kya message aaya hai?', 'Screen pe kya likha hai padh ke batao', 'Explain this code', 'Summarize this page', 'Read the visible text', 'What is on my screen?', examine your incoming visual frame immediately and READ the exact message text, sender name, chat content, or code out loud in a clear, sweet voice!\n" +
        "8. JARVIS-STYLE WINDOWS SYSTEM CONTROL POWERS (Local Desktop Agent):\n" +
        "   - You have full real-time control of Krushna's Windows PC through your local desktop agent for apps, windows, files, input, hardware, and system tasks. When Krushna asks for desktop tasks, DO IT immediately and naturally with sweet, concise responses (e.g. 'Chrome khol diya Kissu', 'Folder bana diya', 'Battery 85% hai').\n" +
        "   - APPLICATION CONTROL: You have 100% UNRESTRICTED FULL POWER to launch and close any application on Krushna's PC. When Krushna asks to open ANY app (e.g. 'Word open karo', 'Excel kholo', 'PowerPoint open karo', 'Paint kholo', 'Calculator kholo', 'WhatsApp open karo', 'Chrome kholo', 'Notepad kholo', 'Spotify chalao', 'VS Code open karo', etc.), IMMEDIATELY execute 'openApplication' with the app name! When Krushna asks to close ANY app, IMMEDIATELY execute 'closeApplication'.\n" +
        "   - WINDOW MANAGEMENT: Use 'minimizeAllWindows' when Krushna asks 'सगळ्या windows minimize कर', 'Minimize all windows', 'Show desktop', 'Saari windows minimize karo', or 'Desktop dikhao'. Use 'restoreAllWindows' when asked to restore/unminimize all windows ('Windows wapas lao', 'Restore all windows'). Use 'getActiveWindow' when Krushna asks 'Current window/app ka naam batao', 'listOpenWindows' to list running windows, 'minimizeWindow' to minimize a specific/active window, 'maximizeWindow' to maximize, 'restoreWindow' to restore, 'closeWindow' to close, and 'switchApplication' to switch/focus apps or cycle with Alt+Tab.\n" +
        "   - FILE & FOLDER CONTROL: Use 'createFolder' (e.g. createFolder(name='TestProject', under='desktop')), 'copyFile', 'openFile' to open any document/file with its default app, 'openFolder' (Downloads/Desktop/etc.), 'createFile', 'readFile', 'renameFile', 'moveFile', 'listFiles', 'searchFiles' (e.g. search PDF files in Downloads), and 'deleteFile' (safe Recycle Bin by default).\n" +
        "   - KEYBOARD & MOUSE CONTROL: Use 'keyboardType' to type text into any active field/window, 'keyboardPress' for individual keys (enter/esc/tab/space/arrows), 'keyboardHotkey' for combinations (ctrl+c, ctrl+v, alt+tab, win+d), 'mouseClick' to click (left/right/double), 'mouseMove' to move cursor to (x, y), and 'mouseScroll' to scroll up or down.\n" +
        "   - CLIPBOARD: Use 'getClipboard' ('Clipboard mein kya hai?'), 'setClipboard' ('Ye text clipboard mein copy karo'), 'copySelected' (Ctrl+C), 'pasteClipboard' (Ctrl+V), 'clearClipboard'.\n" +
        "   - HARDWARE & SYSTEM STATUS: Use 'batteryInfo' ('Battery kitni hai?'), 'networkStatus' ('WiFi status batao', 'Internet connection check karo'), 'systemInfo' (CPU %, RAM %, disk usage, uptime), 'gpuInfo' (NVIDIA GPU usage/temp), 'temperatureInfo'.\n" +
        "   - PROCESS MANAGEMENT: Use 'listProcesses' (sort by memory/cpu), 'killProcess' (terminate user process safely by name/pid; critical system processes are protected).\n" +
        "   - WHATSAPP AUTOMATION: Use 'searchWhatsAppChat' to search a contact and 'sendWhatsAppMessage' to send messages.\n" +
        "   - PC AUDIO & POWER CONTROL: Use 'volumeUp', 'volumeDown', 'setVolume', 'muteToggle', and 'mediaPlayPause', 'mediaStop', 'mediaNext', 'mediaPrevious'. For DANGEROUS actions (shutdown/restart/sleep/lock) you MUST use the two-step flow: first call 'requestPowerAction' to get a confirmation token, then ASK KRUSHNA OUT LOUD to confirm.\n" +
        "   - SCREENSHOT & SCREEN READING: Use 'takeScreenshot', 'saveScreenshot', 'analyzeScreenshot' (OCR of screen), 'readScreen' (OCR of active window + title).\n" +
        "   - MULTI-STEP WORKFLOWS: When Krushna gives multi-step commands (e.g. 'Chrome kholo, YouTube kholo aur Arijit Singh search karo'), execute the required tools in sequence and give a concise, sweet confirmation once done (e.g. 'Done Kissu, Chrome kholkar YouTube par search kar diya!').\n" +
        "   - CRITICAL VOICE UX: Keep your voice responses short, natural, sweet, and lovingly concise. Do NOT give long robotic function call descriptions.\n" +
        "9. BRIGHTNESS & AUTO-START (V2):\n" +
        "   - BRIGHTNESS: Use 'brightnessUp', 'brightnessDown', 'setBrightness' when the user asks to change screen brightness. Respond naturally: 'Haan Kissu, brightness badha di aapke liye.'\n" +
        "   - AUTO-START: Use 'enableAutoStart' when the user wants MYRAA to start with Windows, 'disableAutoStart' to remove it, 'getAutoStartStatus' to check. Explain what you're doing.\n" +
        "   - SETTINGS: The user can also configure these in the SETTINGS panel in the UI. If they mention settings, let them know they can adjust them there too.";

      const portalInstructions = [
        "COLLEGE PRACTICAL LEARNING AND WEBSITE TASKS:",
          "- For questions about this signed-in student's practicals, call listPortalPracticals instead of guessing or searching external websites. Use topic='Python' for Python practicals and report the returned count and titles.",
          "- When asked to read or explain a numbered practical, first find its exact item with listPortalPracticals, then call readPortalPracticalPdf with that item's id. Explain only returned PDF text and say when the file is scanned, unavailable, or truncated.",
          "- When asked to open a practical PDF, call openPortalPracticalPdf with the matching item's id. This opens the practical detail and PDF preview inside the current College Practical Portal; do not open another website or tab.",
        "- Be accurate and teach the reasoning, not just the answer. Never invent details from a practical PDF, course, or student account. If the relevant material is not visible or provided, ask the student to open/share it or paste the relevant section.",
        "- When explicitly asked to do a task on the college portal, use the visible browser/desktop tools only for that requested task. Do not claim portal access or completion if the page, login, or required permission is unavailable.",
        "- Before submitting forms, changing academic/account data, sending messages, or deleting anything on the portal, summarize the intended change and get explicit confirmation. Do not bypass role permissions or act on inferred requests.",
      ].join("\n");

      const finalInstructions = formatSystemInstructionsWithMemories(
        `${baseInstructions}\n\n${portalInstructions}`,
        memories,
      );

      // Track running transcription state for auto memory consolidation
      let dialogueHistory: { role: string; text: string }[] = [];
      let currentModelResponseText = "";

      console.log("[Gemini Live] Attempting to establish connection...");
      const session = await ai.live.connect({
        model: "gemini-2.5-flash-native-audio-latest",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
          },
          realtimeInputConfig: {
            automaticActivityDetection: {
              disabled: false,
              startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
              endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
              silenceDurationMs: 200, // Snappy end-of-turn detection (200ms) for real-time responsiveness
              prefixPaddingMs: 20,
            },
            activityHandling: ActivityHandling.START_OF_ACTIVITY_INTERRUPTS,
          },
          systemInstruction: finalInstructions,
          tools: [
            {
              functionDeclarations: [
                {
                  name: "browserOpen",
                  description:
                    "Opens a designated website URL or interface tab inside Myraa's web agent console.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      url: {
                        type: Type.STRING,
                        description:
                          "The destination website address or path, e.g. youtube.com, google.com, instagram.com, wikipedia.org.",
                      },
                    },
                    required: ["url"],
                  },
                },
                {
                  name: "browserSearch",
                  description:
                    "Enters a query search term inside the active website's search box (Google Search or YouTube Search).",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      query: {
                        type: Type.STRING,
                        description: "The text query term to search for.",
                      },
                    },
                    required: ["query"],
                  },
                },
                {
                  name: "browserClick",
                  description:
                    "Traces computer cursor and clicks on a target button, link, or video cell ID inside the active webpage viewport.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      selector: {
                        type: Type.STRING,
                        description:
                          "The selector target ID, e.g. 'video-mWRsgZjdfQI' for a video, 'search-result-0' for Google link index, or 'play-button', 'pause-button'.",
                      },
                      description: {
                        type: Type.STRING,
                        description:
                          "A short, friendly label description of the item being clicked, e.g. 'Imagine Dragons - Believer video element'.",
                      },
                    },
                    required: ["selector"],
                  },
                },
                {
                  name: "browserMediaControl",
                  description:
                    "Controls ongoing video/audio stream media properties on YouTube, like play, pause, volume, mute, skip, and fullscreen.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      action: {
                        type: Type.STRING,
                        description: "The media controller command operation.",
                        enum: [
                          "play",
                          "pause",
                          "volume",
                          "fullscreen",
                          "exit_fullscreen",
                          "mute",
                          "unmute",
                          "skip",
                        ],
                      },
                      value: {
                        type: Type.INTEGER,
                        description:
                          "The value parameter; only relevant for set volume level, e.g. 50 for fifty percent.",
                      },
                    },
                    required: ["action"],
                  },
                },
                {
                  name: "browserScroll",
                  description:
                    "Scrolls the currently active webpage vertically up or down.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      direction: {
                        type: Type.STRING,
                        description: "The scroll vector movement.",
                        enum: ["up", "down"],
                      },
                      amount: {
                        type: Type.INTEGER,
                        description:
                          "The distance height parameter in pixels (defaults to 300).",
                      },
                    },
                  },
                },
                {
                  name: "browserType",
                  description:
                    "Enters typed letters/commands inside the active input container.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      text: {
                        type: Type.STRING,
                        description: "The exact letters to type in.",
                      },
                    },
                    required: ["text"],
                  },
                },
                {
                  name: "browserGoBack",
                  description:
                    "Navigates back to the previous webpage inside the current tab memory history.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {},
                  },
                },
                {
                  name: "browserTabAction",
                  description:
                    "Performs standard browser-tab actions: open new tab, close a tab, or switch index values.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      action: {
                        type: Type.STRING,
                        description: "Tab action instruction.",
                        enum: ["new", "close", "switch"],
                      },
                      tabId: {
                        type: Type.STRING,
                        description:
                          "The tab identifier string if closing or switching.",
                      },
                      url: {
                        type: Type.STRING,
                        description:
                          "The initial starting URL if creating a new tab.",
                      },
                    },
                    required: ["action"],
                  },
                },
                {
                  name: "changeBackground",
                  description:
                    "Changes the visual theme or atmospheric glow color of Myraa's interface.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      color: {
                        type: Type.STRING,
                        description:
                          "The theme color name (violet, crimson, emerald, celestial, gold, rose, charcoal)",
                      },
                    },
                    required: ["color"],
                  },
                },
                {
                  name: "saveCustomMemory",
                  description:
                    "Allows Myraa to immediately save a piece of critical user information to her persistent memory core.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      category: {
                        type: Type.STRING,
                        description: "The memory category.",
                        enum: [
                          "identity",
                          "preference",
                          "goal",
                          "project",
                          "relationship",
                          "emotional",
                          "behavior",
                        ],
                      },
                      text: {
                        type: Type.STRING,
                        description: "Precise third-person statement.",
                      },
                    },
                    required: ["category", "text"],
                  },
                },

                // ======== DESKTOP CONTROL TOOLS (routed to Python agent) ========
                                {
                                  name: "listPortalPracticals",
                                  description: "List published practicals assigned to the signed-in student in the College Practical Portal. Use the topic filter to find Python or another subject, then use the returned practical id for read or open actions.",
                                  parameters: {
                                    type: Type.OBJECT,
                                    properties: {
                                      topic: { type: Type.STRING, description: "Optional subject or title filter, such as Python." },
                                    },
                                  },
                                },
                                {
                                  name: "readPortalPracticalPdf",
                                  description: "Read selectable text from a published practical PDF that belongs to the signed-in student's academic group. Use only an id returned by listPortalPracticals.",
                                  parameters: {
                                    type: Type.OBJECT,
                                    properties: {
                                      practicalId: { type: Type.STRING, description: "Practical id returned by listPortalPracticals." },
                                    },
                                    required: ["practicalId"],
                                  },
                                },
                                {
                                  name: "openPortalPracticalPdf",
                                  description: "Open a practical detail and original PDF preview inside the current College Practical Portal website, without opening another website or tab.",
                                  parameters: {
                                    type: Type.OBJECT,
                                    properties: {
                                      practicalId: { type: Type.STRING, description: "Practical id returned by listPortalPracticals." },
                                    },
                                    required: ["practicalId"],
                                  },
                                },

                                // ======== DESKTOP CONTROL TOOLS (routed to Python agent) ========
                {
                  name: "openApplication",
                  description:
                    "Open any desktop application or software on Krushna's PC (e.g. WhatsApp, Spotify, Chrome, VS Code, Notepad, Calculator, Telegram, Discord, Steam, File Explorer, Task Manager, Settings, Word, Excel, PowerPoint, Paint, CMD, PowerShell, VLC, etc.).",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      name: {
                        type: Type.STRING,
                        description:
                          "Application name, e.g. 'whatsapp', 'spotify', 'chrome', 'vscode', 'notepad', 'calculator', 'telegram'.",
                      },
                    },
                    required: ["name"],
                  },
                },
                {
                  name: "closeApplication",
                  description: "Close a running desktop application by name.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      name: {
                        type: Type.STRING,
                        description: "Application name.",
                      },
                      force: {
                        type: Type.BOOLEAN,
                        description: "Force close (default false).",
                      },
                    },
                    required: ["name"],
                  },
                },
                {
                  name: "searchWhatsAppChat",
                  description:
                    "Search for a friend or contact on WhatsApp and open their chat window directly. Use whenever Krushna asks to search someone on WhatsApp, open someone's chat, or find a conversation on WhatsApp.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      contact: {
                        type: Type.STRING,
                        description:
                          "Name of the friend, person, or group to search on WhatsApp.",
                      },
                    },
                    required: ["contact"],
                  },
                },
                {
                  name: "sendWhatsAppMessage",
                  description:
                    "Search for a contact on WhatsApp and send them a text message.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      contact: {
                        type: Type.STRING,
                        description: "Contact name or phone number.",
                      },
                      message: {
                        type: Type.STRING,
                        description: "The text message content to send.",
                      },
                    },
                    required: ["contact", "message"],
                  },
                },
                {
                  name: "keyboardType",
                  description:
                    "Type text into whatever application, input box, or window is currently active on the PC. Supports Hindi, English, emojis, and symbols.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      text: {
                        type: Type.STRING,
                        description: "The text string to type/paste.",
                      },
                      press_enter: {
                        type: Type.BOOLEAN,
                        description:
                          "Whether to press Enter key after typing (default false).",
                      },
                    },
                    required: ["text"],
                  },
                },
                {
                  name: "keyboardPress",
                  description:
                    "Press a single keyboard key on the active window (e.g. 'enter', 'tab', 'escape', 'backspace', 'space', 'up', 'down').",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      key: {
                        type: Type.STRING,
                        description:
                          "Key name to press, e.g. 'enter', 'tab', 'esc', 'backspace'.",
                      },
                    },
                    required: ["key"],
                  },
                },
                {
                  name: "keyboardHotkey",
                  description:
                    "Press a keyboard shortcut/hotkey combination (e.g. ['ctrl', 'f'], ['ctrl', 'a'], ['alt', 'tab'], ['win', 'd']).",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      keys: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description:
                          "Array of keys to press together, e.g. ['ctrl', 'f'].",
                      },
                    },
                    required: ["keys"],
                  },
                },
                {
                  name: "mouseClick",
                  description:
                    "Click mouse at specific screen coordinates or current position.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      x: { type: Type.INTEGER, description: "X coordinate." },
                      y: { type: Type.INTEGER, description: "Y coordinate." },
                      button: {
                        type: Type.STRING,
                        description: "left, right, or middle (default left).",
                      },
                    },
                  },
                },
                {
                  name: "openWebsite",
                  description:
                    "Open a named website or URL in the user's default system browser. Supports shortcuts: youtube, gmail, google, github, chatgpt, etc.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      name: {
                        type: Type.STRING,
                        description:
                          "Site name shortcut (e.g. 'youtube', 'gmail').",
                      },
                      url: {
                        type: Type.STRING,
                        description: "Full URL if no shortcut.",
                      },
                    },
                  },
                },
                {
                  name: "searchWeb",
                  description:
                    "Search a website engine (google, youtube, github, duckduckgo, bing) and open results in the default browser.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      query: {
                        type: Type.STRING,
                        description: "Search query.",
                      },
                      engine: {
                        type: Type.STRING,
                        description: "Engine name (default 'google').",
                      },
                    },
                    required: ["query"],
                  },
                },
                {
                  name: "searchYouTube",
                  description:
                    "Search YouTube and open results in the default browser.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      query: {
                        type: Type.STRING,
                        description: "Search query.",
                      },
                    },
                    required: ["query"],
                  },
                },
                {
                  name: "playYouTubeVideo",
                  description:
                    "Autonomously search YouTube, open the top matching video, and play the song/music/video in the desktop browser.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      query: {
                        type: Type.STRING,
                        description:
                          "Song, artist, or video name to search and play.",
                      },
                    },
                    required: ["query"],
                  },
                },
                {
                  name: "searchGoogle",
                  description:
                    "Search Google and open results in the default browser.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      query: {
                        type: Type.STRING,
                        description: "Search query.",
                      },
                    },
                    required: ["query"],
                  },
                },
                {
                  name: "searchGitHub",
                  description:
                    "Search GitHub repositories and open results in the default browser.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      query: {
                        type: Type.STRING,
                        description: "Search query.",
                      },
                    },
                    required: ["query"],
                  },
                },
                {
                  name: "createFile",
                  description:
                    "Create a new text file with optional content. Scoped to safe folders (Desktop, Documents, Downloads, etc.).",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      path: { type: Type.STRING, description: "File path." },
                      content: {
                        type: Type.STRING,
                        description: "File content (default empty).",
                      },
                      overwrite: {
                        type: Type.BOOLEAN,
                        description: "Overwrite if exists (default false).",
                      },
                    },
                    required: ["path"],
                  },
                },
                {
                  name: "readFile",
                  description: "Read the contents of a text file.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      path: { type: Type.STRING, description: "File path." },
                      max_chars: {
                        type: Type.INTEGER,
                        description: "Max chars to return (default 8000).",
                      },
                    },
                    required: ["path"],
                  },
                },
                {
                  name: "renameFile",
                  description: "Rename a file.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      path: {
                        type: Type.STRING,
                        description: "Current file path.",
                      },
                      new_name: {
                        type: Type.STRING,
                        description: "New file name.",
                      },
                    },
                    required: ["path", "new_name"],
                  },
                },
                {
                  name: "deleteFile",
                  description:
                    "Delete a file immediately to the Recycle Bin by default. permanent=true is irreversible and requires a confirmation_token from requestPermanentDelete.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      path: { type: Type.STRING, description: "File path." },
                      permanent: {
                        type: Type.BOOLEAN,
                        description: "Permanently delete (default false).",
                      },
                      confirmation_token: {
                        type: Type.STRING,
                        description:
                          "Required only for permanent=true; token from requestPermanentDelete after explicit user confirmation.",
                      },
                    },
                    required: ["path"],
                  },
                },
                {
                  name: "requestPermanentDelete",
                  description:
                    "First step for irreversible deletion: mint a path-bound confirmation token, ask the user once, then call deleteFile with permanent=true and confirmation_token.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      path: {
                        type: Type.STRING,
                        description: "File or folder path.",
                      },
                    },
                    required: ["path"],
                  },
                },
                {
                  name: "moveFile",
                  description: "Move a file to a new location.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      path: {
                        type: Type.STRING,
                        description: "Source file path.",
                      },
                      destination: {
                        type: Type.STRING,
                        description: "Destination path or folder.",
                      },
                    },
                    required: ["path", "destination"],
                  },
                },
                {
                  name: "openFolder",
                  description:
                    "Open a folder in File Explorer. Supports aliases: desktop, documents, downloads, pictures, music, videos, home.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      name: {
                        type: Type.STRING,
                        description: "Folder name or alias.",
                      },
                      path: {
                        type: Type.STRING,
                        description: "Full path if no alias.",
                      },
                    },
                  },
                },
                {
                  name: "listFiles",
                  description: "List files in a folder.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      name: {
                        type: Type.STRING,
                        description: "Folder name or alias.",
                      },
                      path: { type: Type.STRING, description: "Full path." },
                      pattern: {
                        type: Type.STRING,
                        description: "Glob pattern (default '*').",
                      },
                    },
                  },
                },
                {
                  name: "searchFiles",
                  description:
                    "Search for files by name glob or extension under a folder.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      name: {
                        type: Type.STRING,
                        description: "Filename glob (e.g. '*.py').",
                      },
                      extension: {
                        type: Type.STRING,
                        description: "File extension (e.g. 'py').",
                      },
                      folder: {
                        type: Type.STRING,
                        description: "Folder to search (default home).",
                      },
                      limit: {
                        type: Type.INTEGER,
                        description: "Max results (default 100).",
                      },
                    },
                  },
                },
                {
                  name: "volumeUp",
                  description: "Increase system volume.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      amount: {
                        type: Type.NUMBER,
                        description: "Step amount 0-1 (default 0.1).",
                      },
                    },
                  },
                },
                {
                  name: "volumeDown",
                  description: "Decrease system volume.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      amount: {
                        type: Type.NUMBER,
                        description: "Step amount 0-1 (default 0.1).",
                      },
                    },
                  },
                },
                {
                  name: "setVolume",
                  description: "Set system volume to a specific percentage.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      percent: {
                        type: Type.NUMBER,
                        description: "Volume percentage 0-100.",
                      },
                    },
                    required: ["percent"],
                  },
                },
                {
                  name: "muteToggle",
                  description: "Toggle mute/unmute on the system volume.",
                  parameters: { type: Type.OBJECT, properties: {} },
                },
                {
                  name: "mediaPlayPause",
                  description:
                    "Toggle play/pause on playing PC media (Spotify, YouTube, video/music players). Use when TECH asks to pause, resume, or play/pause playing media.",
                  parameters: { type: Type.OBJECT, properties: {} },
                },
                {
                  name: "mediaStop",
                  description: "Stop active media playback on the PC.",
                  parameters: { type: Type.OBJECT, properties: {} },
                },
                {
                  name: "requestPowerAction",
                  description:
                    "FIRST STEP for dangerous power actions. Generates a confirmation token. Tell the user verbally, then call executePowerAction with the token if they confirm. Actions: shutdown, restart, sleep, lock.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      action: {
                        type: Type.STRING,
                        description:
                          "Power action: shutdown, restart, sleep, lock.",
                      },
                    },
                    required: ["action"],
                  },
                },
                {
                  name: "executePowerAction",
                  description:
                    "SECOND STEP: execute a previously-confirmed power action. Requires a valid execute_token from requestPowerAction. Single-use, expires in 60 seconds.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      action: {
                        type: Type.STRING,
                        description: "The confirmed power action.",
                      },
                      execute_token: {
                        type: Type.STRING,
                        description:
                          "Confirmation token from requestPowerAction.",
                      },
                    },
                    required: ["action", "execute_token"],
                  },
                },
                {
                  name: "minimizeAllWindows",
                  description:
                    "Minimize all open application windows to show the desktop. Use when user says 'सगळ्या windows minimize कर', 'Minimize all windows', 'Show desktop', 'Saari windows minimize karo', 'Desktop dikhao', etc.",
                  parameters: { type: Type.OBJECT, properties: {} },
                },
                {
                  name: "restoreAllWindows",
                  description:
                    "Restore (un-minimize) all previously minimized application windows. Use when user says 'Restore all windows', 'Windows wapas lao', 'Saari windows open karo', etc.",
                  parameters: { type: Type.OBJECT, properties: {} },
                },
                {
                  name: "minimizeWindow",
                  description: "Minimize the active window or a named window.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      title: {
                        type: Type.STRING,
                        description:
                          "Window title to match (optional, defaults to active window).",
                      },
                    },
                  },
                },
                {
                  name: "maximizeWindow",
                  description: "Maximize the active window or a named window.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      title: {
                        type: Type.STRING,
                        description: "Window title to match.",
                      },
                    },
                  },
                },
                {
                  name: "closeWindow",
                  description: "Close the active window or a named window.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      title: {
                        type: Type.STRING,
                        description: "Window title to match.",
                      },
                    },
                  },
                },
                {
                  name: "switchApplication",
                  description:
                    "Switch to a named application window, or cycle Alt+Tab if no title given.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      title: {
                        type: Type.STRING,
                        description: "Window title to switch to.",
                      },
                    },
                  },
                },
                {
                  name: "copySelected",
                  description:
                    "Copy selected text: sends Ctrl+C and reads the clipboard.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      wait: {
                        type: Type.NUMBER,
                        description:
                          "Seconds to wait after Ctrl+C (default 0.35).",
                      },
                    },
                  },
                },
                {
                  name: "pasteClipboard",
                  description:
                    "Paste text into the active input. Writes text to clipboard then sends Ctrl+V.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      text: {
                        type: Type.STRING,
                        description:
                          "Text to paste. If omitted, pastes current clipboard.",
                      },
                    },
                  },
                },
                {
                  name: "getClipboard",
                  description: "Read the current clipboard text content.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      max_chars: {
                        type: Type.INTEGER,
                        description: "Max chars (default 1000).",
                      },
                    },
                  },
                },
                {
                  name: "clearClipboard",
                  description: "Empty the clipboard.",
                  parameters: { type: Type.OBJECT, properties: {} },
                },
                {
                  name: "takeScreenshot",
                  description:
                    "Capture the full screen. Optionally include base64 image data.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      include_image: {
                        type: Type.BOOLEAN,
                        description:
                          "Include base64 JPEG image (default false).",
                      },
                      max_dim: {
                        type: Type.INTEGER,
                        description: "Max image dimension (default 1280).",
                      },
                    },
                  },
                },
                {
                  name: "saveScreenshot",
                  description:
                    "Save a screenshot to Pictures/MyraaScreenshots.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      name: {
                        type: Type.STRING,
                        description: "Optional filename prefix.",
                      },
                    },
                  },
                },
                {
                  name: "analyzeScreenshot",
                  description:
                    "Take a screenshot and run OCR to extract visible text from the screen.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      max_chars: {
                        type: Type.INTEGER,
                        description: "Max OCR chars (default 1500).",
                      },
                    },
                  },
                },
                {
                  name: "readScreen",
                  description:
                    "OCR the active window and return its title plus visible text.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      max_chars: {
                        type: Type.INTEGER,
                        description: "Max OCR chars (default 1500).",
                      },
                    },
                  },
                },
                {
                  name: "desktopBrowserOpen",
                  description:
                    "Open a URL in the desktop Playwright automation browser (real Chromium, separate from holographic UI).",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      url: { type: Type.STRING, description: "URL to open." },
                    },
                    required: ["url"],
                  },
                },
                {
                  name: "desktopBrowserSearch",
                  description: "Search within the desktop automation browser.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      query: {
                        type: Type.STRING,
                        description: "Search query.",
                      },
                      engine: {
                        type: Type.STRING,
                        description:
                          "Engine: google, youtube, github, duckduckgo, bing.",
                      },
                    },
                    required: ["query"],
                  },
                },
                {
                  name: "desktopBrowserClick",
                  description:
                    "Click an element in the desktop automation browser by CSS selector or text.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      selector: {
                        type: Type.STRING,
                        description: "CSS selector.",
                      },
                      text: {
                        type: Type.STRING,
                        description: "Text to find and click.",
                      },
                    },
                  },
                },
                {
                  name: "desktopBrowserType",
                  description:
                    "Type text into the active element in the desktop automation browser.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING, description: "Text to type." },
                      selector: {
                        type: Type.STRING,
                        description:
                          "Optional CSS selector for a specific input.",
                      },
                      clear: {
                        type: Type.BOOLEAN,
                        description: "Clear before typing (default true).",
                      },
                    },
                    required: ["text"],
                  },
                },
                {
                  name: "desktopBrowserFillForm",
                  description:
                    "Fill multiple form fields and optionally submit in the desktop automation browser.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      fields: {
                        type: Type.OBJECT,
                        description: "Object of selector -> value pairs.",
                      },
                      submit: {
                        type: Type.STRING,
                        description: "Optional submit button selector.",
                      },
                    },
                    required: ["fields"],
                  },
                },
                {
                  name: "desktopBrowserOpenTab",
                  description:
                    "Open a new tab in the desktop automation browser.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      url: {
                        type: Type.STRING,
                        description: "URL for the new tab.",
                      },
                    },
                  },
                },
                {
                  name: "desktopBrowserCloseTab",
                  description:
                    "Close the active tab in the desktop automation browser.",
                  parameters: { type: Type.OBJECT, properties: {} },
                },
                {
                  name: "desktopBrowserGoBack",
                  description:
                    "Navigate back in the desktop automation browser history.",
                  parameters: { type: Type.OBJECT, properties: {} },
                },
                {
                  name: "desktopBrowserGoForward",
                  description:
                    "Navigate forward in the desktop automation browser history.",
                  parameters: { type: Type.OBJECT, properties: {} },
                },
                {
                  name: "desktopBrowserScroll",
                  description: "Scroll the desktop automation browser page.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      direction: {
                        type: Type.STRING,
                        description: "Scroll direction: up or down.",
                      },
                      amount: {
                        type: Type.INTEGER,
                        description: "Pixels to scroll (default 500).",
                      },
                    },
                  },
                },
                {
                  name: "createPythonFile",
                  description: "Create a Python (.py) file with content.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      path: { type: Type.STRING, description: "File path." },
                      content: {
                        type: Type.STRING,
                        description: "Python code content.",
                      },
                      overwrite: {
                        type: Type.BOOLEAN,
                        description: "Overwrite if exists.",
                      },
                    },
                    required: ["path"],
                  },
                },
                {
                  name: "writeCodeFile",
                  description:
                    "Create a code file in any language with appropriate extension.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      path: { type: Type.STRING, description: "File path." },
                      content: {
                        type: Type.STRING,
                        description: "Code content.",
                      },
                      language: {
                        type: Type.STRING,
                        description:
                          "Language name (e.g. 'python', 'javascript', 'html').",
                      },
                      overwrite: {
                        type: Type.BOOLEAN,
                        description: "Overwrite if exists.",
                      },
                    },
                    required: ["path"],
                  },
                },
                {
                  name: "createProjectFolder",
                  description:
                    "Create a project folder structure with optional subfolders and starter files.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      path: {
                        type: Type.STRING,
                        description: "Project root folder path.",
                      },
                      subfolders: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "List of subfolder names.",
                      },
                      scaffold_standard: {
                        type: Type.BOOLEAN,
                        description: "Create src, tests, docs subfolders.",
                      },
                      files: {
                        type: Type.OBJECT,
                        description:
                          "Object of relative-path -> content for starter files.",
                      },
                    },
                    required: ["path"],
                  },
                },
                {
                  name: "runPythonScript",
                  description:
                    "Execute a Python script and capture stdout, stderr, and exit code. Has a configurable timeout.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      path: { type: Type.STRING, description: "Script path." },
                      args: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "Script arguments.",
                      },
                      timeout: {
                        type: Type.INTEGER,
                        description: "Timeout in seconds (default 30).",
                      },
                    },
                    required: ["path"],
                  },
                },
                {
                  name: "systemInfo",
                  description:
                    "Get system resource usage: CPU %, RAM %, disk usage, uptime, OS info.",
                  parameters: { type: Type.OBJECT, properties: {} },
                },
                {
                  name: "gpuInfo",
                  description:
                    "Get NVIDIA GPU stats: utilization %, VRAM usage, temperature. Graceful fallback if no NVIDIA GPU.",
                  parameters: { type: Type.OBJECT, properties: {} },
                },
                {
                  name: "temperatureInfo",
                  description:
                    "Get available temperature readings (CPU, GPU, etc.). Best-effort on Windows.",
                  parameters: { type: Type.OBJECT, properties: {} },
                },
                // --- V2: Brightness control ---
                {
                  name: "brightnessUp",
                  description:
                    "Increase screen brightness by a step (default 10%). Use when user says 'increase brightness' or 'make screen brighter'.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      amount: {
                        type: Type.NUMBER,
                        description: "Percentage to increase (default 10).",
                      },
                    },
                  },
                },
                {
                  name: "brightnessDown",
                  description:
                    "Decrease screen brightness by a step (default 10%). Use when user says 'decrease brightness' or 'dim screen'.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      amount: {
                        type: Type.NUMBER,
                        description: "Percentage to decrease (default 10).",
                      },
                    },
                  },
                },
                {
                  name: "setBrightness",
                  description:
                    "Set screen brightness to an exact level. Use when user says 'set brightness to 50%' or 'brightness 80'.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      percent: {
                        type: Type.NUMBER,
                        description: "Target brightness 0-100.",
                      },
                    },
                    required: ["percent"],
                  },
                },
                // --- V2: Windows auto-start management ---
                {
                  name: "enableAutoStart",
                  description:
                    "Enable MYRAA to launch automatically when Windows starts. Creates a silent startup entry.",
                  parameters: { type: Type.OBJECT, properties: {} },
                },
                {
                  name: "disableAutoStart",
                  description:
                    "Disable MYRAA auto-start on Windows login. Removes the startup entry.",
                  parameters: { type: Type.OBJECT, properties: {} },
                },
                {
                  name: "getAutoStartStatus",
                  description:
                    "Check whether MYRAA is currently configured to auto-start on Windows login.",
                  parameters: { type: Type.OBJECT, properties: {} },
                },
                // --- V3: Modular Windows System Control Layer ---
                {
                  name: "getActiveWindow",
                  description:
                    "Get the title and process name of the current active foreground window on PC. Use when user asks 'Current window ka naam batao', 'Abhi konsi app open hai', etc.",
                  parameters: { type: Type.OBJECT, properties: {} },
                },
                {
                  name: "listOpenWindows",
                  description:
                    "List all currently open/visible application windows on the desktop. Use when user asks 'Kaunsi windows open hain', 'Running apps dikhao', etc.",
                  parameters: { type: Type.OBJECT, properties: {} },
                },
                {
                  name: "restoreWindow",
                  description:
                    "Restore a minimized or maximized window to normal size and bring to focus. Optional title parameter.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      title: {
                        type: Type.STRING,
                        description:
                          "Window title or application name to restore.",
                      },
                    },
                  },
                },
                {
                  name: "createFolder",
                  description:
                    "Create a new folder/directory on Desktop, Documents, Downloads, or specified path. Use when user asks 'Desktop par TestProject folder banao', etc.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      name: {
                        type: Type.STRING,
                        description:
                          "Name of the new folder (e.g. 'TestProject').",
                      },
                      under: {
                        type: Type.STRING,
                        description:
                          "Parent location: 'desktop', 'documents', 'downloads', or full path.",
                      },
                    },
                    required: ["name"],
                  },
                },
                {
                  name: "copyFile",
                  description:
                    "Copy a file or directory from source path to destination path.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      source: {
                        type: Type.STRING,
                        description: "Source file or directory path.",
                      },
                      destination: {
                        type: Type.STRING,
                        description: "Destination file or directory path.",
                      },
                    },
                    required: ["source", "destination"],
                  },
                },
                {
                  name: "openFile",
                  description:
                    "Open any document, media, image, or project file with its default Windows application.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      path: {
                        type: Type.STRING,
                        description:
                          "Full or relative path of the file to open.",
                      },
                    },
                    required: ["path"],
                  },
                },
                {
                  name: "setClipboard",
                  description:
                    "Copy specified text into the Windows clipboard without immediately pasting. Use when user says 'Ye text clipboard mein copy karo'.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      text: {
                        type: Type.STRING,
                        description: "The text to copy to the clipboard.",
                      },
                    },
                    required: ["text"],
                  },
                },
                {
                  name: "mouseMove",
                  description:
                    "Move mouse cursor smoothly to specified screen coordinates (x, y).",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      x: {
                        type: Type.NUMBER,
                        description: "Horizontal screen pixel X.",
                      },
                      y: {
                        type: Type.NUMBER,
                        description: "Vertical screen pixel Y.",
                      },
                      duration: {
                        type: Type.NUMBER,
                        description:
                          "Movement duration in seconds (default 0.2).",
                      },
                    },
                    required: ["x", "y"],
                  },
                },
                {
                  name: "mouseScroll",
                  description:
                    "Scroll the mouse wheel up or down on the screen. Use when user says 'Page neeche scroll karo', 'Scroll up', etc.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      direction: {
                        type: Type.STRING,
                        description: "'up' or 'down'",
                        enum: ["up", "down"],
                      },
                      amount: {
                        type: Type.NUMBER,
                        description:
                          "Number of scroll clicks (positive for up, negative for down).",
                      },
                    },
                  },
                },
                {
                  name: "batteryInfo",
                  description:
                    "Check laptop battery level percentage, plugged-in charging state, and remaining runtime. Use when user asks 'Battery kitni hai?', 'Battery status batao', etc.",
                  parameters: { type: Type.OBJECT, properties: {} },
                },
                {
                  name: "networkStatus",
                  description:
                    "Check internet connectivity, Wi-Fi SSID, signal strength, and network IP addresses. Use when user asks 'WiFi status batao', 'Internet chal raha hai kya?', etc.",
                  parameters: { type: Type.OBJECT, properties: {} },
                },
                {
                  name: "listProcesses",
                  description:
                    "List top running processes on Windows sorted by CPU or memory usage. Use when user asks 'Kaunse process chal rahe hain', etc.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      sort_by: {
                        type: Type.STRING,
                        description: "'memory' or 'cpu'",
                        enum: ["memory", "cpu"],
                      },
                      limit: {
                        type: Type.NUMBER,
                        description:
                          "Max number of processes to list (default 15).",
                      },
                    },
                  },
                },
                {
                  name: "killProcess",
                  description:
                    "Terminate a user process by name or PID. Protected against critical system processes. Use when user says 'Kill process notepad', etc.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      name: {
                        type: Type.STRING,
                        description:
                          "Process name to terminate (e.g. 'notepad.exe', 'chrome').",
                      },
                      pid: {
                        type: Type.NUMBER,
                        description: "Process ID to terminate.",
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
        callbacks: {
          onerror: (error: any) => {
            console.error("[Gemini Live API Error]:", error);
            clientWs.send(
              JSON.stringify({
                type: "error",
                error: `Gemini connection error: ${error?.message || String(error)}`,
              }),
            );
          },
          onmessage: (message: LiveServerMessage) => {
            // Audio Stream Chunk (model response audio play, 24kHz raw PCM)
            const audio =
              message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) {
              clientWs.send(JSON.stringify({ type: "audio", audio }));
            }

            // Interruption flag (user spoke or interrupted)
            if (message.serverContent?.interrupted) {
              console.log("[Myraa Interrupted!]");
              orchestrator.handleInterruption();
              clientWs.send(JSON.stringify({ type: "interrupted" }));
            }

            // Turn Complete
            if (message.serverContent?.turnComplete) {
              clientWs.send(JSON.stringify({ type: "turnComplete" }));

              if (currentModelResponseText.trim()) {
                dialogueHistory.push({
                  role: "model",
                  text: currentModelResponseText,
                });
                currentModelResponseText = "";
              }

              // Fire asynchronous memory extraction
              if (dialogueHistory.length >= 2) {
                (async () => {
                  try {
                    const updated = await processConversationSlice(
                      apiKey,
                      dialogueHistory,
                    );
                    if (updated) {
                      console.log(
                        "[Memory Sync] Sending refreshed memory list to client.",
                      );
                      clientWs.send(
                        JSON.stringify({
                          type: "memory_sync",
                          memories: updated,
                        }),
                      );
                    }
                  } catch (err) {
                    console.error(
                      "[Memory Sync] Error running background consolidation:",
                      err,
                    );
                  }
                })();
              }
            }

            // Transcription of model output (text chunk)
            const modelText = (message.serverContent as any)?.modelTurn
              ?.parts?.[0]?.text;
            if (modelText) {
              clientWs.send(
                JSON.stringify({
                  type: "transcription",
                  role: "model",
                  text: modelText,
                }),
              );
              currentModelResponseText += modelText;
            }

            // User input transcription (user speech text translated by Gemini)
            const userTextOutput = (message.serverContent as any)?.userTurn
              ?.parts?.[0]?.text;
            if (userTextOutput) {
              clientWs.send(
                JSON.stringify({
                  type: "transcription",
                  role: "user",
                  text: userTextOutput,
                }),
              );
              dialogueHistory.push({ role: "user", text: userTextOutput });
            }

            // Function Calls (Gemini requesting tool execution)
            if (message.toolCall?.functionCalls) {
              for (const call of message.toolCall.functionCalls) {
                console.log(
                  `[Gemini Live] Function call requested: ${call.name} (id: ${call.id})`,
                  call.args,
                );

                // --- 1. Python Desktop Agent tools -----------------------
                if (DESKTOP_TOOLS.has(call.name)) {
                  const callId = call.id;
                  const callName = call.name;
                  const callArgs = (call.args as any) || {};
                  const abortController = new AbortController();
                  const taskKey = String(callId || `${callName}-${Date.now()}`);
                  activeToolControllers.set(taskKey, abortController);
                  const startPayload = {
                    type: "actionStatus",
                    name: callName,
                    args: callArgs,
                    status: "running",
                  } as const;

                  clientWs.send(JSON.stringify(startPayload));

                  void (async () => {
                    try {
                      const res = await callDesktopAgent(
                        callName,
                        callArgs,
                        abortController.signal,
                      );
                      const toolResult = res.ok
                        ? res.result
                        : { error: res.error };
                      clientWs.send(
                        JSON.stringify({
                          type: "actionStatus",
                          name: callName,
                          args: callArgs,
                          status: res.ok ? "done" : "error",
                          result: toolResult,
                        }),
                      );
                      session.sendToolResponse({
                        functionResponses: [
                          {
                            id: callId,
                            name: callName,
                            response: { output: toolResult },
                          },
                        ],
                      });
                    } catch (err) {
                      console.error(
                        `[Desktop Agent] Unhandled error calling ${callName}:`,
                        err,
                      );
                      const errorPayload = {
                        type: "actionStatus",
                        name: callName,
                        args: callArgs,
                        status: "error" as const,
                        result: { error: String(err) },
                      };
                      clientWs.send(JSON.stringify(errorPayload));
                      try {
                        session.sendToolResponse({
                          functionResponses: [
                            {
                              id: callId,
                              name: callName,
                              response: {
                                output: {
                                  error: `Failed to execute ${callName}: ${(err as any)?.message || err
                                    }`,
                                },
                              },
                            },
                          ],
                        });
                      } catch {
                        // ignore response errors after session/tool failure
                      }
                    } finally {
                      activeToolControllers.delete(taskKey);
                    }
                  })();
                  // The desktop handler sends its own function response. Do not
                  // also forward it to the browser UI, which caused duplicate
                  // errors/replies and delayed the next voice turn.
                  continue;
                }

                // --- 2. Node server tools ---------------------------------
                if (call.name === "saveCustomMemory") {
                  const args = (call.args as any) || {};
                  const category = String(args.category || "identity");
                  const text = String(args.text || "");

                  if (text) {
                    loadMemories().then(async (mList) => {
                      const timestamp = new Date().toISOString();
                      const newMemory: Memory = {
                        id: Math.random().toString(36).substring(2, 11),
                        category: category as any,
                        text,
                        createdAt: timestamp,
                        updatedAt: timestamp,
                      };
                      mList.push(newMemory);
                      await saveMemories(mList);
                      console.log(
                        `[Server Memory] Explicit memory captured: [${category}] ${text}`,
                      );
                      clientWs.send(
                        JSON.stringify({
                          type: "memories_updated",
                          memories: mList,
                        }),
                      );
                    });
                  }

                  session.sendToolResponse({
                    functionResponses: [
                      {
                        id: call.id,
                        name: call.name,
                        response: {
                          output: {
                            result:
                              "Memory successfully captured and persisted in connections core.",
                          },
                        },
                      },
                    ],
                  });
                  continue;
                }

                // --- 3. Frontend / UI tools -------------------------------
                clientWs.send(
                  JSON.stringify({
                    type: "toolCall",
                    callId: call.id,
                    name: call.name,
                    args: call.args,
                  }),
                );
              }
            }
          },
          onclose: (e?: any) => {
            console.log("Gemini Live session closed:", e?.code, e?.reason);
            clientWs.send(
              JSON.stringify({ type: "status", status: "session_closed" }),
            );
          },
        },
      });

      if (currentLiveClient.isClosed || clientWs.readyState !== 1) {
        console.log(
          "[Gemini Live] Client disconnected during connection establishment. Closing session.",
        );
        try {
          session.close();
        } catch (e) { }
        return;
      }
      currentLiveClient.session = session;

      console.log(
        "[Gemini Live] Session created successfully, sending 'connected' status...",
      );
      clientWs.send(JSON.stringify({ type: "status", status: "connected" }));

      clientWs.on("message", (rawMsg) => {
        try {
          if (currentLiveClient.isClosed) return;
          const msg = JSON.parse(rawMsg.toString());
          if (msg.type === "interrupt") {
            cancelActiveTools("User interrupted voice response");
            orchestrator.handleInterruption();
            clientWs.send(JSON.stringify({ type: "interrupted" }));
          } else if (msg.audio) {
            session.sendRealtimeInput({
              media: { data: msg.audio, mimeType: "audio/pcm;rate=16000" },
            });
          } else if (msg.type === "video" && msg.video) {
            session.sendRealtimeInput({
              media: { data: msg.video, mimeType: "image/jpeg" },
            });
          }
        } catch (e) {
          console.error("Error editing/forwarding client frame message:", e);
        }
      });

      clientWs.on("close", () => {
        console.log("Client disconnected, closing Gemini session");
        currentLiveClient.isClosed = true;
        cancelActiveTools("Voice session closed");
        orchestrator.handleInterruption();
        try {
          session.close();
        } catch (e) { }
        if (activeLiveClient === currentLiveClient) {
          activeLiveClient = null;
        }
      });
    } catch (err: any) {
      console.error("Error connecting to Gemini Live API:", err);
      if (activeLiveClient === currentLiveClient) {
        activeLiveClient = null;
      }
      try {
        clientWs.send(
          JSON.stringify({
            type: "error",
            error: `Could not connect to Gemini: ${err.message || err}`,
          }),
        );
        clientWs.close();
      } catch (e) { }
    }
  });

  const appRoot = process.env.MYRAA_APP_ROOT || process.cwd();
  const assetCandidates = [
    path.join(__dirname, "assets"),
    path.join(appRoot, "dist", "assets"),
    path.join(process.resourcesPath || "", "assets"),
    path.join(process.resourcesPath || "", "app.asar.unpacked", "assets"),
    path.join(__dirname, "..", "assets"),
    path.join(appRoot, "assets"),
    path.join(process.cwd(), "assets"),
    path.join(process.cwd(), "dist", "assets"),
  ];
  let assetsPath = path.join(appRoot, "assets");
  for (const candidate of assetCandidates) {
    if (candidate && fs.existsSync(path.join(candidate, "idle.mp4"))) {
      assetsPath = candidate;
      break;
    }
  }
  logStartup(`Serving static assets from: ${assetsPath}`);
  console.log(`[Server] Serving static assets from: ${assetsPath}`);

  // Serve custom static assets folder
  app.use("/assets", express.static(assetsPath, { maxAge: "1d" }));

  // Also serve fallback to dist/assets if different
  const distAssetsPath = path.join(__dirname, "assets");
  if (fs.existsSync(distAssetsPath) && distAssetsPath !== assetsPath) {
    app.use("/assets", express.static(distAssetsPath, { maxAge: "1d" }));
  }

  // Prevent SPA fallback for missing asset files (never serve HTML as MP4/PNG/CSS/JS)
  app.get("/assets/*", (_req, res) => {
    res.status(404).send("Asset not found");
  });

  // Express Static assets / Vite Dev Middleware configuration
  if (process.env.NODE_ENV !== "production") {
    // Loaded lazily so the production bundle never requires vite (a dev-only
    // dependency that is not shipped with the packaged app).
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = fs.existsSync(path.join(__dirname, "index.html"))
      ? __dirname
      : path.join(appRoot, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    logStartup(`MYRAA V2 server started on http://localhost:${PORT}`);
    console.log(`[Server] Running on http://localhost:${PORT}`);
    // Kick off the desktop agent (probe + auto-spawn) immediately on boot.
    ensureDesktopAgent().catch((e) =>
      console.warn(`[Desktop Agent] Boot probe failed: ${e?.message || e}`),
    );
  });
}

startServer().catch((error) => {
  console.error("Failed to start server startup sequence:", error);
});
