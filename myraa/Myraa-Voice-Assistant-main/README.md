# 🎙️ MYRAA — Autonomous AI Voice Assistant

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Gemini Live](https://img.shields.io/badge/Google%20Gemini-Live%20Audio-4285F4.svg)](https://aistudio.google.com/)
[![Electron](https://img.shields.io/badge/Electron-43-47848F.svg)](https://www.electronjs.org/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB.svg)](https://www.python.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078D6.svg)](https://microsoft.com)

**MYRAA** is a system-wide, autonomous AI voice companion powered by **Google Gemini Live Native Audio** (`gemini-2.5-flash-native-audio-latest`).

It delivers full-duplex, low-latency spoken conversations with native interruption (barge-in), long-term cognitive memory, multimodal real-time screen vision, and 52+ native Windows OS control tools.

[✨ Features](#-features) • [📸 Screenshots](#-screenshots) • [🛠️ Tech Stack](#️-tech-stack) • [🚀 Installation](#-installation) • [🔧 Build From Source](#-build-from-source) • [🔑 API Setup](#-api-configuration) • [📁 Project Structure](#-project-structure)

</div>

---

## ✨ Features

- 🎙️ **Full-Duplex Real-Time Voice**: Direct 16 kHz PCM microphone capture and 24 kHz raw PCM audio playback with <400 ms conversational latency.
- ⚡ **Instant Barge-In Interruption**: Speak at any moment while Myraa is talking — audio playback instantly halts (<10 ms) and turns over to process your new command.
- 🗣️ **Multilingual Fluency**: Native, fluent conversational support in **Marathi**, **Hindi**, and **English**.
- 🧠 **Persistent Cognitive Memory**: Automatically consolidates dialogue facts across 7 structured knowledge categories (`identity`, `preferences`, `goals`, `projects`, `relationships`, `emotional highlights`, `habits`) stored in `%APPDATA%\MYRAA\memories.json`.
- 👁️ **Multimodal Screen Vision**: Real-time screen capture streaming base64 JPEG frames into Gemini Live for live OCR, code analysis, document reading, and WhatsApp chat transcription.
- 🖥️ **52+ Windows System Automation Tools**:
  - **App & Window Control**: Launch, focus, minimize, maximize, restore, and terminate any Windows desktop software via native Win32 APIs.
  - **File & Folder Operations**: Create, read, copy, search, rename, and recycle files in user profile directories.
  - **Hardware & Diagnostics**: Monitor battery, WiFi/network status, CPU %, RAM %, GPU utilization/temperatures, and adjust system volume and screen brightness.
  - **Simulated Keyboard & Mouse**: Natural typing with Unicode clipboard support, hotkeys (`Ctrl+C`, `Alt+Tab`, `Win+D`), mouse clicks, cursor movement, and scrolling.
- 🌐 **Web & YouTube Automation**: Autonomous headless Playwright browser interaction, direct YouTube music streaming, and an in-app holographic browser console.
- 🛡️ **Safety & Confirmation Gating**: Two-step confirmation token requirement for destructive operations (shutdown, restart, permanent delete).
- 🎛️ **Resident System Tray Mode**: Minimizes to system tray on close; summoned globally using hotkeys `Ctrl+Shift+Space` or `Alt+Space`.

---

## 📸 Screenshots

|          Holographic Presence & Voice Core          |            Multimodal Screen Vision & OCR             |
| :-------------------------------------------------: | :---------------------------------------------------: |
| ![Myraa Core Visualizer](docs/screenshots/home.png) | ![Screen Vision](docs/screenshots/screen_sharing.png) |
|   _Cinematic audio-responsive holographic avatar_   |     _Real-time screen reading and transcription_      |

|           Categorized Memory Core Dashboard           |          Settings & Audio Device Config          |
| :---------------------------------------------------: | :----------------------------------------------: |
| ![Memory Dashboard](docs/screenshots/memory_core.png) | ![Settings Panel](docs/screenshots/settings.png) |
|       _Persistent recollection knowledge cards_       |  _Wake-word and hardware microphone selection_   |

> _To add your own screenshots, place PNG images inside [`docs/screenshots/`](docs/screenshots/)._

---

## 🎥 Demo

> _Video walkthrough coming soon. See [`docs/screenshots/`](docs/screenshots/) for current UI previews._

---

## 🛠️ Tech Stack

### Frontend & Visuals

- **React 19** & **TypeScript 5.8**
- **Vite 6** (Modern build pipeline & HMR)
- **Tailwind CSS 4** & **Lucide React Icons**
- **HTML5 Web Audio API** (`AudioContext`, `ScriptProcessorNode`, `AnalyserNode`)
- **HTML5 Canvas 2D** (Particle audio-reactive visualizer)

### Backend & Gateway

- **Node.js 20+** & **Express 5**
- **WebSocket (`ws`)** (Full-duplex low-latency audio stream)
- **Google GenAI SDK (`@google/genai`)**:
  - `gemini-2.5-flash-native-audio-latest` (Live bidirectional voice stream)
  - `gemini-2.0-flash` (Structured cognitive memory consolidation)
- **server_orchestrator** (Task planning, parallel execution, and interruption tracking)

### Desktop Automation (Local Python Agent)

- **Python 3.12** & **FastAPI** on `127.0.0.1:8765`
- **pywin32** & `ctypes.windll.user32` (Native Win32 window and shell APIs)
- **psutil** (Process diagnostics and system telemetry)
- **pyautogui** (Hardware input simulation)
- **Playwright** (Headless browser automation)
- **PyInstaller** (Frozen standalone agent binary `myraa-agent.exe`)

### Desktop Shell & Packaging

- **Electron 43** (Frameless transparent holographic desktop window)
- **electron-builder** (NSIS installer and standalone portable Windows packaging)

---

## 📋 Requirements

- **Operating System**: Windows 10 or Windows 11 (64-bit)
- **Node.js**: `v20.0.0` or later (for building from source)
- **Python**: `3.10` – `3.12` (64-bit)
- **API Key**: Free Google Gemini API Key from [Google AI Studio](https://aistudio.google.com/app/apikey)
- **Hardware**: Working microphone and speaker / headphones

---

## 🚀 Installation

### Option 1: Standalone Windows Executable (Recommended)

1. Download the latest release from the [Releases](https://github.com/your-username/myraa-ai-assistant/releases) section or [`releases/`](releases/):
   - **`Myraa.exe`**: Portable single-file executable (run immediately without installation).
   - **`Myraa-Setup.exe`**: Guided installer with Start Menu and Desktop shortcuts.
2. Double-click `Myraa.exe` to launch.
3. On first boot, enter your Google Gemini API Key in the onboarding dialog.
4. Allow microphone access when prompted.
5. Say _"Hey Myraa"_ or press `Alt + Space` to start talking!

### Option 2: Web / Browser Companion Mode

Run the backend on your PC and open in any modern browser:

```bash
npm run dev
```

Navigate to `http://localhost:3000` in Google Chrome or Microsoft Edge.

---

## 📱 Android APK Companion Status

MYRAA is built as a Windows desktop AI assistant. To package the client for Android:

1. The web visualizer and Gemini Live voice stream (`src/`, `public/`) run natively inside Android WebView using **Capacitor**.
2. To build an Android APK from this project:
   ```bash
   npm install @capacitor/core @capacitor/cli @capacitor/android
   npx cap init Myraa com.myraa.app
   npx cap add android
   npx cap sync
   cd android && ./gradlew assembleRelease
   ```
3. _Note_: Windows OS control tools require the Windows desktop agent running on your PC.

See [`releases/README.md`](releases/README.md) for full mobile architecture notes.

---

## 🔧 Build From Source

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/myraa-ai-assistant.git
cd myraa-ai-assistant
```

### 2. Install Node Dependencies

```bash
npm install
```

### 3. Setup Python Desktop Agent

```bash
cd desktop_agent
pip install -r requirements.txt
cd ..
```

### 4. Build Frontend & Backend Bundles

```bash
npm run build
```

### 5. Package Windows Binaries (Electron)

```bash
npx electron-builder --win nsis portable
```

The compiled executables will be output to `release/`:

- `release/Myraa.exe` (Portable executable)
- `release/Myraa-Setup.exe` (Setup installer)

---

## 🔑 API Configuration

MYRAA requires a Google Gemini API key to connect to Gemini Live audio and memory models.

1. Get a free API key at [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Copy `.env.example` to `.env`:
   ```bash
   copy .env.example .env
   ```
3. Add your key inside `.env`:
   ```env
   GEMINI_API_KEY="AIzaSy..."
   ```

Alternatively, you can paste the key directly in the UI onboarding screen. The key is securely saved locally at:
`%APPDATA%\MYRAA\gemini_api_key.txt`

---

## 🔐 Security

- **No Hardcoded Secrets**: All API keys, credentials, and tokens are strictly excluded via `.gitignore`.
- **Zero Cloud Data Leakage**: User dialogue logs, persistent memories (`memories.json`), and preferences are stored exclusively on your local machine in `%APPDATA%\MYRAA\`.
- **Constrained Filesystem Scope**: File tools are restricted to standard user directories (`Desktop`, `Documents`, `Downloads`, `Pictures`). Critical OS folders are blocked.
- **Protected Processes**: Critical Windows system processes (`csrss.exe`, `explorer.exe`, `services.exe`, `lsass.exe`) are protected against accidental termination.
- **Confirmation Tokens**: High-risk actions (shutdown, restart, sleep) require two-step vocal confirmation.

---

## 📁 Project Structure

```text
myraa-ai-assistant/
├── assets/                    # Character visual video assets (idle, thinking, talking)
├── desktop_agent/             # Python 3.12 FastAPI desktop automation microservice
│   ├── main.py                # FastAPI HTTP entrypoint (:8765)
│   ├── registry.py            # Central 52-tool dispatch table
│   ├── tools_applications.py  # Win32 application management
│   ├── tools_windows.py       # Win32 window management & focus
│   ├── tools_system_control.py# Keyboard, mouse, and clipboard injection
│   ├── tools_files.py         # Scoped filesystem operations
│   ├── tools_browser.py       # Playwright browser automation
│   ├── tools_system.py        # System hardware, battery, and telemetry
│   └── tools_pc.py            # Master volume & media key control
├── docs/                      # Documentation and visual screenshots
│   └── screenshots/           # UI preview images for GitHub
├── electron/                  # Electron main process & preload scripts
│   ├── main.cjs               # App lifecycle, tray menu, global shortcuts
│   └── preload.cjs            # Context isolation bridge
├── public/                    # Static public web assets
├── releases/                  # Release documentation & distribution info
├── server_orchestrator/       # Task planning, parallel execution, and event bus
├── server.ts                  # Express 5 gateway & Gemini Live WebSocket proxy
├── server_memory.ts           # Cognitive memory extraction & consolidation
├── server_paths.ts            # %APPDATA% directory and secret paths resolver
├── src/                       # React 19 Frontend
│   ├── components/            # Holographic UI, Visualizer, Memory Dashboard
│   ├── lib/
│   │   ├── audio.ts           # Full-duplex Web Audio PCM16 transport & VAD
│   │   ├── wakeWord.ts        # Always-listening speech keyword detector
│   │   └── settingsStore.ts   # Persistent user preferences store
│   └── App.tsx                # Primary application interface
├── .env.example               # Safe template for environment variables
├── .gitignore                 # Strict GitHub exclusion rules
├── electron-builder.yml       # Electron packaging configuration
├── package.json               # Project manifest & scripts
├── tsconfig.json              # TypeScript compiler configuration
└── vite.config.ts             # Vite bundler configuration
```

---

## 🧑‍💻 Usage

| Action                   | How To Trigger                                                           |
| :----------------------- | :----------------------------------------------------------------------- |
| **Summon / Dismiss**     | Press `Alt + Space` or `Ctrl + Shift + Space` anywhere in Windows        |
| **Start Voice Chat**     | Click the microphone button or say _"Hey Myraa"_                         |
| **Interrupt Myraa**      | Simply speak over her — she stops talking immediately                    |
| **Minimize All Windows** | Say _"सगळ्या windows minimize कर"_ or _"Show desktop"_                   |
| **Open Application**     | Say _"Chrome open karo"_, _"WhatsApp kholo"_, or _"VS Code chalao"_      |
| **Play Music**           | Say _"YouTube par Arijit Singh ke gaane sunao"_                          |
| **Screen Vision**        | Click **Share Screen** and ask _"Screen pe kya likha hai padh ke batao"_ |
| **System Status**        | Ask _"Battery kitni hai?"_ or _"WiFi connected hai kya?"_                |

---

## 🐛 Troubleshooting

| Problem                            | Cause                                  | Solution                                                                      |
| :--------------------------------- | :------------------------------------- | :---------------------------------------------------------------------------- |
| **API Key Missing / Disconnected** | First launch without configured key    | Enter your Gemini API key in the onboarding modal or `.env`.                  |
| **Agent Offline (Port 8765)**      | Port busy or agent not started         | MYRAA auto-starts the agent. Restart from the system tray menu if needed.     |
| **Microphone Muted / Not Hearing** | Browser/OS microphone permission       | Check Windows Settings > Privacy & Security > Microphone permissions.         |
| **Video Avatar Fallback Visible**  | Video file decoding delayed            | Verify that `assets/` contains `idle.mp4`, `thinking.mp4`, and `talking.mp4`. |
| **Port 3000 Already in Use**       | Previous instance still active in tray | Close existing instance from Windows System Tray or Task Manager.             |

---

## 🚧 Roadmap

- [ ] **Viseme-Based 3D Lip-Sync Avatar**: WebGL/Live2D model driven directly by speech phonemes.
- [ ] **SQLite Vector Memory (RAG)**: Semantic vector retrieval for historical conversations.
- [ ] **Google & Microsoft Workspace Integration**: Native Google Calendar, Gmail, and Outlook sync.
- [ ] **On-Device Offline Fallback**: Local Whisper.cpp STT and Piper TTS for offline voice support.
- [ ] **Proactive Scheduled Daemons**: Morning briefings, weather alerts, and meeting reminders.

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m "Add AmazingFeature"`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📄 License

This project is currently provided for personal and educational use.  
_(Add your preferred Open Source License, e.g. MIT or Apache-2.0, prior to public distribution)._

---

## ⭐ Acknowledgements

- [Google Gemini Live API](https://ai.google.dev/) — Native multimodal audio streaming
- [Electron](https://www.electronjs.org/) — Cross-platform desktop runtime
- [FastAPI](https://fastapi.tiangolo.com/) & [pywin32](https://github.com/mhammond/pywin32) — Windows desktop automation
- [Vite](https://vitejs.dev/) & [React](https://react.dev/) — Reactive frontend architecture
- [Lucide Icons](https://lucide.dev/) — Iconography

---

## 👨‍💻 Author

- **Krushna** — Creator & Lead Developer
- GitHub: [@krushnakaale](https://github.com/krushnakaale)

---

