# MYRAA Releases

This directory contains release documentation, distribution instructions, and checksums for **MYRAA**.

## 📦 Production Artifacts

| Platform             | Target Binary                 | Build Command                                          | Description                                                   |
| :------------------- | :---------------------------- | :----------------------------------------------------- | :------------------------------------------------------------ |
| **Windows Desktop**  | `Myraa.exe` (Standalone)      | `npm run build && npx electron-builder --win portable` | Portable zero-install executable for Windows 10/11 x64        |
| **Windows Desktop**  | `Myraa-Setup.exe` (Installer) | `npm run build && npx electron-builder --win nsis`     | Full NSIS Windows setup installer with Start Menu integration |
| **Android (Mobile)** | `Myraa-v1.0.0-release.apk`    | _See Android Porting Guide below_                      | Android APK companion package                                 |

> **Note on Large File Distribution**:  
> Compiled Windows executables (~139 MB - 141 MB) exceed GitHub's single-file tracking threshold (100 MB). Releases are distributed via [GitHub Releases](https://github.com/your-username/myraa-ai-assistant/releases) as attached release assets with SHA-256 verification.

---

## 📱 Android APK Packaging Status & Architecture

MYRAA is architected as an Electron + Node.js + Python Windows assistant. The voice interaction and holographic visualizer are powered by a standard React 19 + Vite web frontend.

To build an Android APK from this project:

1. **Frontend Packaging**: The web client (`src/`, `public/`) runs seamlessly inside Android WebView / Capacitor.
2. **Backend Requirement**: Because the Gemini Live gateway (`server.ts`) and Python Windows control tools (`desktop_agent/`) require Node.js and Win32 APIs, the Android client connects to the running MYRAA server over WebSocket/HTTP or directly via Gemini Live Web SDK.
3. **Building the APK via Capacitor**:
   ```bash
   npm install @capacitor/core @capacitor/cli @capacitor/android
   npx cap init Myraa com.myraa.app
   npx cap add android
   npx cap sync
   cd android && ./gradlew assembleRelease
   ```
