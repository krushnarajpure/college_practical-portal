/* ===========================================================================
 * MYRAA — Electron Main Process (Production Desktop Shell)
 * ---------------------------------------------------------------------------
 * Responsibilities:
 *   1. Single running instance guard.
 *   2. Automatic silent boot of Node backend (server.ts / dist/server.cjs)
 *      with ELECTRON_RUN_AS_NODE and writable user data directories.
 *   3. Splash screen during startup -> loads UI on localhost:3000.
 *   4. System Tray integration with Resident Background operation.
 *   5. Close-to-tray & minimize-to-tray mechanics.
 *   6. Global shortcut (Ctrl+Shift+Space / Alt+Space) to summon MYRAA system-wide.
 *   7. Non-throttled background audio (backgroundThrottling: false).
 *   8. Clean process tree termination on exit to prevent orphan processes.
 * ========================================================================= */

"use strict";

const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");

// Unified User Data Directory (%APPDATA%\MYRAA)
const dataDir = path.join(
  process.env.APPDATA || path.join(process.env.USERPROFILE || "", "AppData", "Roaming"),
  "MYRAA"
);
const logsDir = path.join(dataDir, "logs");
try {
  fs.mkdirSync(logsDir, { recursive: true });
} catch {}

const mainLogPath = path.join(logsDir, "main.log");
function logMain(msg) {
  try {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(mainLogPath, line, "utf8");
    console.log(msg);
  } catch {}
}

logMain("=== Electron Main Script Initialized ===");
logMain(`process.execPath: ${process.execPath}`);
logMain(`process.versions: ${JSON.stringify(process.versions || {})}`);

const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  shell,
  dialog,
  globalShortcut,
  ipcMain,
  nativeImage,
} = require("electron");

try {
  if (app && app.setPath) {
    app.setPath("userData", dataDir);
  }
} catch {}

const SERVER_PORT = 3000;
const SERVER_ORIGIN = `http://localhost:${SERVER_PORT}`;
const SERVER_READY_TIMEOUT_MS = 45_000;

function getAppRoot() {
  if (app && app.isPackaged) {
    const unpacked = path.join(process.resourcesPath, "app.asar.unpacked");
    if (fs.existsSync(unpacked)) return unpacked;
    const appDir = path.join(process.resourcesPath, "app");
    if (fs.existsSync(appDir)) return appDir;
  }
  return path.join(__dirname, "..");
}

function getServerEntry(appRoot) {
  const candidates = [
    path.join(appRoot, "dist", "server.cjs"),
    path.join(process.resourcesPath || "", "app.asar.unpacked", "dist", "server.cjs"),
    path.join(process.resourcesPath || "", "app", "dist", "server.cjs"),
    path.join(__dirname, "..", "dist", "server.cjs"),
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return path.join(appRoot, "dist", "server.cjs");
}

logMain("--- MYRAA Electron Launching ---");
logMain(`dataDir: ${dataDir}`);
logMain(`process.execPath: ${process.execPath}`);

/** @type {import('child_process').ChildProcess | null} */
let serverProcess = null;
/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {BrowserWindow | null} */
let splashWindow = null;
/** @type {Tray | null} */
let tray = null;
let isQuitting = false;
let isListening = true;

// ---------------------------------------------------------------------------
// Single-instance guard
// ---------------------------------------------------------------------------
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  logMain("Secondary instance detected — exiting and focusing primary.");
  app.quit();
} else {
  app.on("second-instance", () => {
    logMain("Second instance launched — restoring mainWindow.");
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
  app.whenReady().then(bootstrap).catch((err) => {
    logMain(`Fatal bootstrap error: ${err?.stack || err}`);
  });
}

// ---------------------------------------------------------------------------
// Backend lifecycle
// ---------------------------------------------------------------------------
function startBackend() {
  const appRoot = getAppRoot();
  const serverEntry = getServerEntry(appRoot);
  logMain(`Starting backend process...`);
  logMain(`appRoot: ${appRoot}`);
  logMain(`serverEntry: ${serverEntry}`);

  if (!fs.existsSync(serverEntry)) {
    const err = `Backend bundle not found at ${serverEntry}. Run "npm run build" first.`;
    logMain(`ERROR: ${err}`);
    throw new Error(err);
  }

  const agentExe = fs.existsSync(path.join(process.resourcesPath, "agent", "myraa-agent.exe"))
    ? path.join(process.resourcesPath, "agent", "myraa-agent.exe")
    : path.join(appRoot, "agent_dist", "myraa-agent", "myraa-agent.exe");

  const env = {
    ...process.env,
    NODE_ENV: "production",
    ELECTRON_RUN_AS_NODE: "1",
    MYRAA_LAUNCHED_BY: "electron",
    MYRAA_DATA_DIR: dataDir,
    MYRAA_APP_ROOT: appRoot,
  };
  if (fs.existsSync(agentExe)) {
    env.MYRAA_AGENT_EXE = agentExe;
    logMain(`Found Python Desktop Agent at: ${agentExe}`);
  } else {
    logMain(`Python Desktop Agent not found at ${agentExe} — will use system python if available.`);
  }

  serverProcess = spawn(process.execPath, [serverEntry], {
    cwd: appRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  const backendLogFile = path.join(logsDir, "backend.log");
  const logStream = fs.createWriteStream(backendLogFile, { flags: "a" });

  serverProcess.stdout?.pipe(logStream);
  serverProcess.stderr?.pipe(logStream);

  serverProcess.stdout?.on("data", (d) =>
    process.stdout.write(`[server] ${d}`),
  );
  serverProcess.stderr?.on("data", (d) =>
    process.stderr.write(`[server] ${d}`),
  );
  serverProcess.on("exit", (code, signal) => {
    logMain(`Backend process exited with code ${code}, signal ${signal}`);
    if (!isQuitting) {
      dialog.showErrorBox(
        "MYRAA backend stopped",
        `The MYRAA backend process exited unexpectedly (code ${code}, signal ${signal}).`,
      );
      app.quit();
    }
  });
}

function stopBackend() {
  if (serverProcess && !serverProcess.killed) {
    try {
      if (process.platform === "win32") {
        // Force-kill the full process tree to eliminate orphan Python / Node agents
        spawn("taskkill", ["/pid", String(serverProcess.pid), "/T", "/F"]);
      } else {
        serverProcess.kill("SIGTERM");
      }
    } catch {
      /* best-effort */
    }
  }
  serverProcess = null;
}

/** Poll the backend until it answers, or reject on timeout. */
function waitForBackend(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(SERVER_ORIGIN, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) {
          reject(new Error("Backend did not become ready in time."));
        } else {
          setTimeout(tryOnce, 400);
        }
      });
      req.setTimeout(2000, () => req.destroy());
    };
    tryOnce();
  });
}

// ---------------------------------------------------------------------------
// Tray Icon Creation (Dynamic fallback if icon file not present)
// ---------------------------------------------------------------------------
function createTrayIcon() {
  // Create a 16x16 circular cyan tray icon
  const size = 16;
  const canvas = nativeImage.createEmpty();
  const buffer = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - size / 2;
      const dy = y - size / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= size / 2 - 1) {
        buffer[idx] = 99; // R
        buffer[idx + 1] = 102; // G
        buffer[idx + 2] = 241; // B
        buffer[idx + 3] = 255; // A
      } else {
        buffer[idx + 3] = 0; // Transparent
      }
    }
  }

  return nativeImage.createFromBuffer(buffer, { width: size, height: size });
}

function createTray() {
  const icon = createTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip("MYRAA — AI Voice Assistant (Online)");

  const updateMenu = () => {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Open MYRAA",
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      {
        label: isListening ? "Pause Listening" : "Start / Resume Listening",
        click: () => {
          isListening = !isListening;
          if (mainWindow) {
            mainWindow.webContents.send(
              "myraa:tray-action",
              isListening ? "resume" : "pause",
            );
          }
          updateMenu();
        },
      },
      { type: "separator" },
      { label: "Status: Online", enabled: false },
      {
        label: "Settings",
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send("myraa:tray-action", "open-settings");
          }
        },
      },
      {
        label: "Restart MYRAA",
        click: () => {
          if (mainWindow) {
            mainWindow.webContents.reload();
          }
        },
      },
      { type: "separator" },
      {
        label: "Exit MYRAA",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);
    tray?.setContextMenu(contextMenu);
  };

  updateMenu();

  tray.on("double-click", () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    center: true,
    show: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#00000000",
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  splashWindow.loadFile(path.join(__dirname, "splash.html"));
  splashWindow.on("closed", () => (splashWindow = null));
}

function toggleMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.restore();
    mainWindow.focus();
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    show: false,
    backgroundColor: "#0a0a0f",
    autoHideMenuBar: true,
    title: "MYRAA",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
      backgroundThrottling: false, // Ensures audio & WebSocket never sleep in background!
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http") && !url.startsWith(SERVER_ORIGIN)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.once("ready-to-show", () => {
    if (splashWindow) splashWindow.close();
    mainWindow?.show();
    mainWindow?.focus();
  });

  // Close to tray behavior
  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => (mainWindow = null));

  mainWindow.loadURL(SERVER_ORIGIN);
}

// ---------------------------------------------------------------------------
// IPC Handlers
// ---------------------------------------------------------------------------
ipcMain.on("myraa:minimize", () => {
  mainWindow?.minimize();
});

ipcMain.on("myraa:hide", () => {
  mainWindow?.hide();
});

ipcMain.on("myraa:show", () => {
  mainWindow?.show();
  mainWindow?.focus();
});

ipcMain.on("myraa:toggle-listening", (_e, active) => {
  isListening = Boolean(active);
});

// ---------------------------------------------------------------------------
// Bootstrap sequence
// ---------------------------------------------------------------------------
async function bootstrap() {
  logMain("Bootstrap started.");
  app.setAppUserModelId("com.myraa.desktop");
  createSplashWindow();
  logMain("Splash window created.");

  // Register Global Shortcuts (Summon MYRAA from anywhere)
  try {
    globalShortcut.register("CommandOrControl+Shift+Space", toggleMainWindow);
    globalShortcut.register("Alt+Space", toggleMainWindow);
    logMain("Global shortcuts registered.");
  } catch (err) {
    logMain(`Global shortcut registration error: ${err}`);
  }

  try {
    startBackend();
    logMain(`Waiting up to ${SERVER_READY_TIMEOUT_MS}ms for backend to answer...`);
    await waitForBackend(SERVER_READY_TIMEOUT_MS);
    logMain("Backend responded successfully. Creating main window and system tray...");
    createMainWindow();
    createTray();
    logMain("MYRAA startup complete.");
  } catch (err) {
    logMain(`Bootstrap failure: ${err?.stack || err}`);
    if (splashWindow) splashWindow.close();
    dialog.showErrorBox(
      "MYRAA failed to start",
      `${err instanceof Error ? err.message : String(err)}`,
    );
    app.quit();
  }
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

app.on("window-all-closed", () => {
  // Keep running in system tray on Windows
  if (isQuitting && process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
  stopBackend();
});

process.on("exit", stopBackend);
