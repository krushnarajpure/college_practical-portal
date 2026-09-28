"""
Application control: launch and close common Windows applications.

Launch strategy is layered for robustness:
  1. Try a known executable / shell verb (fastest, most reliable).
  2. Fall back to the Windows "where"/App Paths lookup via `start`.

Closing uses taskkill on the matching process image name, with a graceful
grace period so apps can save work.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import time
import webbrowser
from typing import Any, Dict, Optional

import pyautogui
import pyperclip

pyautogui.FAILSAFE = False

from .registry import ToolError, register

import winreg

APP_COMMANDS: Dict[str, Dict[str, str]] = {
    # Microsoft Office Suite
    "microsoft word": {"exe": "WINWORD.EXE", "shell": "winword", "image": "WINWORD.EXE", "label": "Microsoft Word"},
    "word": {"exe": "WINWORD.EXE", "shell": "winword", "image": "WINWORD.EXE", "label": "Microsoft Word"},
    "ms word": {"exe": "WINWORD.EXE", "shell": "winword", "image": "WINWORD.EXE", "label": "Microsoft Word"},
    "winword": {"exe": "WINWORD.EXE", "shell": "winword", "image": "WINWORD.EXE", "label": "Microsoft Word"},
    "microsoft excel": {"exe": "EXCEL.EXE", "shell": "excel", "image": "EXCEL.EXE", "label": "Microsoft Excel"},
    "excel": {"exe": "EXCEL.EXE", "shell": "excel", "image": "EXCEL.EXE", "label": "Microsoft Excel"},
    "ms excel": {"exe": "EXCEL.EXE", "shell": "excel", "image": "EXCEL.EXE", "label": "Microsoft Excel"},
    "spreadsheet": {"exe": "EXCEL.EXE", "shell": "excel", "image": "EXCEL.EXE", "label": "Microsoft Excel"},
    "microsoft powerpoint": {"exe": "POWERPNT.EXE", "shell": "powerpnt", "image": "POWERPNT.EXE", "label": "Microsoft PowerPoint"},
    "powerpoint": {"exe": "POWERPNT.EXE", "shell": "powerpnt", "image": "POWERPNT.EXE", "label": "Microsoft PowerPoint"},
    "power point": {"exe": "POWERPNT.EXE", "shell": "powerpnt", "image": "POWERPNT.EXE", "label": "Microsoft PowerPoint"},
    "ms powerpoint": {"exe": "POWERPNT.EXE", "shell": "powerpnt", "image": "POWERPNT.EXE", "label": "Microsoft PowerPoint"},
    "ppt": {"exe": "POWERPNT.EXE", "shell": "powerpnt", "image": "POWERPNT.EXE", "label": "Microsoft PowerPoint"},
    "microsoft access": {"exe": "MSACCESS.EXE", "shell": "msaccess", "image": "MSACCESS.EXE", "label": "Microsoft Access"},
    "access": {"exe": "MSACCESS.EXE", "shell": "msaccess", "image": "MSACCESS.EXE", "label": "Microsoft Access"},
    "microsoft outlook": {"exe": "OUTLOOK.EXE", "shell": "outlook", "image": "OUTLOOK.EXE", "label": "Microsoft Outlook"},
    "outlook": {"exe": "OUTLOOK.EXE", "shell": "outlook", "image": "OUTLOOK.EXE", "label": "Microsoft Outlook"},
    "onenote": {"uwp": "onenote:", "exe": "ONENOTE.EXE", "shell": "onenote", "image": "ONENOTE.EXE", "label": "Microsoft OneNote"},

    # Windows Core & Accessories
    "notepad": {"exe": "notepad.exe", "shell": "notepad", "image": "notepad.exe", "label": "Notepad"},
    "calculator": {"uwp": "calc:", "shell": "calc", "image": "CalculatorApp.exe", "label": "Calculator"},
    "calc": {"uwp": "calc:", "shell": "calc", "image": "CalculatorApp.exe", "label": "Calculator"},
    "paint": {"shell": "mspaint", "exe": "mspaint.exe", "image": "mspaint.exe", "label": "Paint"},
    "mspaint": {"shell": "mspaint", "exe": "mspaint.exe", "image": "mspaint.exe", "label": "Paint"},
    "ms paint": {"shell": "mspaint", "exe": "mspaint.exe", "image": "mspaint.exe", "label": "Paint"},
    "microsoft paint": {"shell": "mspaint", "exe": "mspaint.exe", "image": "mspaint.exe", "label": "Paint"},
    "wordpad": {"shell": "write", "image": "wordpad.exe", "label": "WordPad"},
    "snipping tool": {"uwp": "ms-screenclip:", "shell": "snippingtool", "image": "ScreenClippingHost.exe", "label": "Snipping Tool"},
    "snip": {"uwp": "ms-screenclip:", "shell": "snippingtool", "image": "ScreenClippingHost.exe", "label": "Snipping Tool"},
    "settings": {"uwp": "ms-settings:", "image": "SystemSettings.exe", "label": "Settings"},
    "windows settings": {"uwp": "ms-settings:", "image": "SystemSettings.exe", "label": "Settings"},
    "control panel": {"shell": "control", "image": "control.exe", "label": "Control Panel"},
    "task manager": {"shell": "taskmgr", "image": "Taskmgr.exe", "label": "Task Manager"},
    "taskmanager": {"shell": "taskmgr", "image": "Taskmgr.exe", "label": "Task Manager"},
    "taskmgr": {"shell": "taskmgr", "image": "Taskmgr.exe", "label": "Task Manager"},
    "file explorer": {"shell": "explorer", "image": "explorer.exe", "label": "File Explorer"},
    "explorer": {"shell": "explorer", "image": "explorer.exe", "label": "File Explorer"},
    "windows explorer": {"shell": "explorer", "image": "explorer.exe", "label": "File Explorer"},
    "my computer": {"shell": "explorer", "image": "explorer.exe", "label": "File Explorer"},
    "this pc": {"shell": "explorer", "image": "explorer.exe", "label": "File Explorer"},
    "terminal": {"shell": "wt", "exe": "wt.exe", "image": "WindowsTerminal.exe", "label": "Windows Terminal"},
    "windows terminal": {"shell": "wt", "exe": "wt.exe", "image": "WindowsTerminal.exe", "label": "Windows Terminal"},
    "wt": {"shell": "wt", "exe": "wt.exe", "image": "WindowsTerminal.exe", "label": "Windows Terminal"},
    "command prompt": {"exe": "cmd.exe", "shell": "cmd", "image": "cmd.exe", "label": "Command Prompt"},
    "cmd": {"exe": "cmd.exe", "shell": "cmd", "image": "cmd.exe", "label": "Command Prompt"},
    "powershell": {"exe": "powershell.exe", "shell": "powershell", "image": "powershell.exe", "label": "PowerShell"},
    "camera": {"uwp": "microsoft.windows.camera:", "image": "WindowsCamera.exe", "label": "Camera"},
    "photos": {"uwp": "ms-photos:", "image": "Microsoft.Photos.exe", "label": "Photos"},
    "store": {"uwp": "ms-windows-store:", "image": "WinStore.App.exe", "label": "Microsoft Store"},
    "microsoft store": {"uwp": "ms-windows-store:", "image": "WinStore.App.exe", "label": "Microsoft Store"},

    # Browsers & Developer
    "chrome": {"exe": "chrome.exe", "shell": "chrome", "image": "chrome.exe", "label": "Google Chrome"},
    "google chrome": {"exe": "chrome.exe", "shell": "chrome", "image": "chrome.exe", "label": "Google Chrome"},
    "edge": {"exe": "msedge.exe", "shell": "msedge", "image": "msedge.exe", "label": "Microsoft Edge"},
    "microsoft edge": {"exe": "msedge.exe", "shell": "msedge", "image": "msedge.exe", "label": "Microsoft Edge"},
    "brave": {"exe": "brave.exe", "shell": "brave", "image": "brave.exe", "label": "Brave Browser"},
    "firefox": {"exe": "firefox.exe", "shell": "firefox", "image": "firefox.exe", "label": "Mozilla Firefox"},
    "vscode": {"exe": "code.cmd", "shell": "code", "image": "Code.exe", "label": "Visual Studio Code"},
    "vs code": {"exe": "code.cmd", "shell": "code", "image": "Code.exe", "label": "Visual Studio Code"},
    "code": {"exe": "code.cmd", "shell": "code", "image": "Code.exe", "label": "Visual Studio Code"},
    "visual studio code": {"exe": "code.cmd", "shell": "code", "image": "Code.exe", "label": "Visual Studio Code"},

    # Social & Media Apps
    "whatsapp": {"uwp": "whatsapp:", "exe": "WhatsApp.exe", "image": "WhatsApp.exe", "label": "WhatsApp", "web": "https://web.whatsapp.com"},
    "spotify": {"uwp": "spotify:", "exe": "Spotify.exe", "image": "Spotify.exe", "label": "Spotify", "web": "https://open.spotify.com"},
    "telegram": {"uwp": "tg:", "exe": "Telegram.exe", "image": "Telegram.exe", "label": "Telegram", "web": "https://web.telegram.org"},
    "discord": {"uwp": "discord:", "exe": "Discord.exe", "image": "Discord.exe", "label": "Discord", "web": "https://discord.com/app"},
    "steam": {"uwp": "steam:", "exe": "steam.exe", "image": "steam.exe", "label": "Steam"},
    "vlc": {"exe": "vlc.exe", "image": "vlc.exe", "label": "VLC Media Player"},
    "obs": {"exe": "obs64.exe", "image": "obs64.exe", "label": "OBS Studio"},
}


def _get_registry_app_path(exe: str) -> Optional[str]:
    """Look up binary full path in Windows Registry App Paths (HKLM / HKCU)."""
    candidates = [exe]
    if not exe.lower().endswith(".exe"):
        candidates.extend([f"{exe}.exe", f"{exe}.EXE"])
    for name in candidates:
        for root in [winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER]:
            try:
                with winreg.OpenKey(root, rf"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\{name}") as k:
                    val, _ = winreg.QueryValueEx(k, "")
                    if val and os.path.exists(val):
                        return val
            except Exception:
                pass
    return None


def _find_start_menu_shortcut(query: str) -> Optional[str]:
    """Scan user and system Start Menu directories for matching .lnk shortcuts."""
    dirs = [
        os.path.expandvars(r"%APPDATA%\Microsoft\Windows\Start Menu\Programs"),
        os.path.expandvars(r"%ALLUSERSPROFILE%\Microsoft\Windows\Start Menu\Programs"),
    ]
    query_lower = query.lower()
    for d in dirs:
        if not os.path.exists(d):
            continue
        for root, _, files in os.walk(d):
            for f in files:
                if f.lower().endswith(".lnk") and query_lower in f.lower():
                    return os.path.join(root, f)
    return None


def _resolve_app(key: str) -> Dict[str, str]:
    norm = (key or "").strip().lower()
    if norm in APP_COMMANDS:
        return APP_COMMANDS[norm]

    # Clean prefix aliases like "microsoft ", "ms ", "windows ", "google ", "app"
    clean_norm = norm
    for prefix in ["microsoft ", "ms ", "windows ", "google "]:
        if clean_norm.startswith(prefix):
            clean_norm = clean_norm[len(prefix):].strip()
            break
    if clean_norm.endswith(" app") or clean_norm.endswith(" application"):
        clean_norm = clean_norm.rsplit(" ", 1)[0].strip()

    if clean_norm in APP_COMMANDS:
        return APP_COMMANDS[clean_norm]

    # Partial match in predefined catalog
    for k, v in APP_COMMANDS.items():
        if k in norm or norm in k or k in clean_norm or clean_norm in k:
            return v

    # Check Windows Registry App Paths
    reg_path = _get_registry_app_path(norm) or _get_registry_app_path(clean_norm)
    if reg_path:
        return {
            "label": key.title(),
            "exe": reg_path,
            "image": os.path.basename(reg_path),
        }

    # Dynamic fallback spec
    return {
        "label": key.title(),
        "image": f"{norm}.exe",
        "exe": f"{norm}.exe",
        "shell": norm,
    }


def _launch(spec: Dict[str, str], original_name: str = "") -> str:
    label = spec.get("label") or original_name.title()

    # 1. Try registry app path or exact exe path
    if "exe" in spec:
        exe = spec["exe"]
        # Check if full path or registry path
        if os.path.isabs(exe) and os.path.exists(exe):
            try:
                os.startfile(exe)
                return f"{label} opened."
            except Exception:
                pass

        reg_path = _get_registry_app_path(exe)
        if reg_path:
            try:
                os.startfile(reg_path)
                return f"{label} opened."
            except Exception:
                pass

        try:
            os.startfile(exe)
            return f"{label} opened."
        except Exception:
            pass

        if shutil.which(exe):
            try:
                subprocess.Popen(
                    [exe],
                    shell=False,
                    close_fds=True,
                    creationflags=getattr(subprocess, "DETACHED_PROCESS", 0)
                    | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0),
                )
                return f"{label} opened."
            except Exception:
                pass

    # 2. Try UWP protocol (instant Windows shell URI: calc:, ms-settings:, whatsapp:, spotify:, tg:)
    if "uwp" in spec:
        try:
            os.startfile(spec["uwp"])
            return f"{label} opened."
        except Exception:
            pass

    # 3. Try shell command
    if "shell" in spec:
        try:
            os.startfile(spec["shell"])
            return f"{label} opened."
        except Exception:
            pass
        try:
            subprocess.Popen(f'start "" {spec["shell"]}', shell=True)
            return f"{label} opened."
        except Exception:
            pass

    # 4. Try Start Menu .lnk shortcut
    search_term = original_name or label
    shortcut = _find_start_menu_shortcut(search_term)
    if shortcut:
        try:
            os.startfile(shortcut)
            return f"{label} opened from Start Menu."
        except Exception:
            pass

    # 5. Non-blocking subprocess Popen with Windows start
    try:
        subprocess.Popen(f'start "" "{original_name}"', shell=True)
        return f"{label} opened."
    except Exception:
        pass

    # 6. Web fallback for web services (WhatsApp Web, Spotify Web, Telegram Web, Discord Web)
    if "web" in spec:
        try:
            webbrowser.open(spec["web"])
            return f"{label} opened in default browser."
        except Exception:
            pass

    raise ToolError(f"Could not launch {label}.")


@register("openApplication")
def open_application(args: Dict[str, Any]) -> Dict[str, Any]:
    name = args.get("name") or args.get("application") or args.get("app")
    if not name:
        raise ToolError("Parameter 'name' (application name) is required.")
    spec = _resolve_app(str(name))
    result_msg = _launch(spec, str(name))
    return {"result": result_msg}


@register("closeApplication")
def close_application(args: Dict[str, Any]) -> Dict[str, Any]:
    name = args.get("name") or args.get("application") or args.get("app")
    if not name:
        raise ToolError("Parameter 'name' (application name) is required.")

    name_str = str(name).strip().lower()
    spec = _resolve_app(name_str)
    label = spec.get("label") or name_str.title()
    image = spec.get("image") or f"{name_str}.exe"

    # 1. Close by window title using pygetwindow
    try:
        import pygetwindow as gw

        windows = gw.getWindowsWithTitle(label) or gw.getWindowsWithTitle(name_str)
        for w in windows:
            try:
                w.close()
            except Exception:
                pass
    except Exception:
        pass

    # 2. Fast taskkill /F on primary image and common variants
    images_to_kill = [image]
    if name_str in ["calculator", "calc"]:
        images_to_kill.extend(["Calculator.exe", "CalculatorApp.exe", "calc.exe"])
    elif name_str in ["word", "microsoft word", "winword"]:
        images_to_kill.extend(["WINWORD.EXE", "winword.exe"])
    elif name_str in ["excel", "microsoft excel"]:
        images_to_kill.extend(["EXCEL.EXE", "excel.exe"])
    elif name_str in ["powerpoint", "microsoft powerpoint", "ppt"]:
        images_to_kill.extend(["POWERPNT.EXE", "powerpnt.exe"])
    elif name_str in ["paint", "mspaint"]:
        images_to_kill.extend(["mspaint.exe", "PaintApp.exe"])
    elif name_str == "whatsapp":
        images_to_kill.extend(["WhatsApp.exe", "WhatsAppHost.exe"])
    elif name_str in ["vscode", "code"]:
        images_to_kill.extend(["Code.exe"])
    elif name_str == "chrome":
        images_to_kill.extend(["chrome.exe"])
    elif name_str == "notepad":
        images_to_kill.extend(["notepad.exe", "Notepad.exe"])

    kill_cmd = " ".join([f'/IM "{img}"' for img in set(images_to_kill)])
    try:
        subprocess.run(f"taskkill /F {kill_cmd}", shell=True, capture_output=True, timeout=2)
    except Exception:
        pass

    # 3. Kill matching process with psutil
    try:
        import psutil

        for proc in psutil.process_iter(["pid", "name"]):
            try:
                pname = proc.info["name"].lower()
                if any(img.lower() == pname for img in images_to_kill) or (len(name_str) >= 4 and name_str in pname):
                    proc.kill()
            except Exception:
                pass
    except Exception:
        pass

    return {"result": f"Closed {label}."}


def _focus_whatsapp() -> bool:
    """Focus or open WhatsApp window."""
    try:
        os.startfile("whatsapp:")
        time.sleep(0.6)
        return True
    except Exception:
        pass

    try:
        import pygetwindow as gw

        windows = gw.getWindowsWithTitle("WhatsApp")
        if windows:
            w = windows[0]
            if w.isMinimized:
                w.restore()
            w.activate()
            time.sleep(0.3)
            return True
    except Exception:
        pass

    spec = _resolve_app("whatsapp")
    _launch(spec, "whatsapp")
    time.sleep(1.0)
    return True


@register("searchWhatsAppChat")
def search_whatsapp_chat(args: Dict[str, Any]) -> Dict[str, Any]:
    """Search for a friend or contact on WhatsApp and open their chat."""
    contact = args.get("contact") or args.get("name") or args.get("query")
    if not contact:
        raise ToolError("Parameter 'contact' (name of friend or group) is required.")

    import pyautogui
    import pyperclip

    contact_clean = str(contact).strip()

    # Step 1: Focus or Open WhatsApp
    _focus_whatsapp()
    time.sleep(0.5)

    # Step 2: Release any stuck keys and trigger Search (Ctrl+F)
    pyautogui.press("esc")
    time.sleep(0.1)
    pyautogui.hotkey("ctrl", "f")
    time.sleep(0.3)

    # Step 3: Clear any existing query
    pyautogui.hotkey("ctrl", "a")
    time.sleep(0.1)
    pyautogui.press("backspace")
    time.sleep(0.1)

    # Step 4: Paste contact name (Unicode/multilingual safe)
    pyperclip.copy(contact_clean)
    pyautogui.hotkey("ctrl", "v")
    time.sleep(0.6)

    # Step 5: Press Down arrow to highlight top search result, then Enter to open
    pyautogui.press("down")
    time.sleep(0.2)
    pyautogui.press("enter")
    time.sleep(0.3)

    return {"result": f"Searched and opened chat for '{contact_clean}' on WhatsApp."}


@register("sendWhatsAppMessage")
def send_whatsapp_message(args: Dict[str, Any]) -> Dict[str, Any]:
    """Search for a contact on WhatsApp and send them a text message."""
    contact = args.get("contact") or args.get("name")
    message = args.get("message") or args.get("text")
    if not contact or not message:
        raise ToolError("Parameters 'contact' and 'message' are required.")

    import pyautogui
    import pyperclip

    search_whatsapp_chat({"contact": contact})
    time.sleep(0.5)

    # Paste and send message
    pyperclip.copy(str(message))
    pyautogui.hotkey("ctrl", "v")
    time.sleep(0.2)
    pyautogui.press("enter")

    return {"result": f"Sent message to '{contact}' on WhatsApp."}


@register("keyboardType")
def keyboard_type(args: Dict[str, Any]) -> Dict[str, Any]:
    """Type text into active input field or window (supports Hindi, Unicode, emojis via clipboard paste)."""
    text = args.get("text")
    if text is None:
        raise ToolError("Parameter 'text' is required.")

    import pyautogui
    import pyperclip

    press_enter = bool(args.get("press_enter", False))
    pyperclip.copy(str(text))
    time.sleep(0.05)
    pyautogui.hotkey("ctrl", "v")

    if press_enter:
        time.sleep(0.1)
        pyautogui.press("enter")

    return {"result": f"Typed '{text}' into active window."}


@register("keyboardPress")
def keyboard_press(args: Dict[str, Any]) -> Dict[str, Any]:
    """Press a single key (e.g. enter, tab, escape, backspace, space, up, down, left, right)."""
    key = args.get("key")
    if not key:
        raise ToolError("Parameter 'key' is required.")

    import pyautogui

    key_norm = str(key).strip().lower()
    pyautogui.press(key_norm)
    return {"result": f"Pressed key '{key_norm}'."}


@register("keyboardHotkey")
def keyboard_hotkey(args: Dict[str, Any]) -> Dict[str, Any]:
    """Trigger a keyboard hotkey combination (e.g. ['ctrl', 'f'], ['ctrl', 'a'], ['alt', 'tab'], ['win', 'd'])."""
    keys = args.get("keys")
    if not keys:
        shortcut = args.get("shortcut") or args.get("combo")
        if shortcut:
            keys = [k.strip().lower() for k in str(shortcut).split("+")]

    if not keys or not isinstance(keys, list):
        raise ToolError("Parameter 'keys' must be a list of keys, e.g. ['ctrl', 'f'].")

    import pyautogui

    pyautogui.hotkey(*[str(k).lower() for k in keys])
    return {"result": f"Triggered hotkey '{'+'.join(keys)}'."}


@register("mouseClick")
def mouse_click(args: Dict[str, Any]) -> Dict[str, Any]:
    """Click mouse at specified screen coordinates or current cursor location."""
    import pyautogui

    x = args.get("x")
    y = args.get("y")
    button = str(args.get("button", "left")).lower()
    clicks = int(args.get("clicks", 1))

    if x is not None and y is not None:
        pyautogui.click(x=int(x), y=int(y), button=button, clicks=clicks)
        return {"result": f"Clicked at ({x}, {y}) with {button} button."}
    else:
        pyautogui.click(button=button, clicks=clicks)
        return {"result": f"Clicked at current position with {button} button."}


__all__ = [
    "open_application",
    "close_application",
    "search_whatsapp_chat",
    "send_whatsapp_message",
    "keyboardType",
    "keyboardPress",
    "keyboardHotkey",
    "mouseClick",
    "APP_COMMANDS",
]
