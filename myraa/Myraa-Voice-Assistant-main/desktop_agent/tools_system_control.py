"""
MYRAA Modular Windows System Control Layer.

Extends the desktop agent with complete Windows system control capabilities:
  * Window Control: getActiveWindow, listOpenWindows, restoreWindow
  * File System: createFolder, copyFile, openFile
  * Input & Control: setClipboard, mouseMove, mouseScroll
  * Hardware & System: batteryInfo, networkStatus
  * Process Management: listProcesses, killProcess
"""

from __future__ import annotations

import os
import platform
import shutil
import socket
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from .registry import ToolError, register
from .tools_files import SAFE_ROOTS, _ensure_safe, _resolve_file, _resolve_folder

# Protected OS processes that must never be terminated by voice commands
PROTECTED_PROCESSES = {
    "system",
    "system idle process",
    "registry",
    "smss.exe",
    "csrss.exe",
    "wininit.exe",
    "services.exe",
    "lsass.exe",
    "svchost.exe",
    "fontdrvhost.exe",
    "winlogon.exe",
    "dwm.exe",
    "explorer.exe",
    "spoolsv.exe",
    "ntoskrnl.exe",
}


# ── 1. Window Control ──────────────────────────────────────────────────────────


@register("getActiveWindow")
def get_active_window(args: Dict[str, Any]) -> Dict[str, Any]:
    """Get the title and process name of the current active foreground window."""
    if platform.system() != "Windows":
        return {"result": "Active window inspection is only supported on Windows.", "title": "", "process": ""}

    try:
        import ctypes
        import psutil
        from .tools_windows import _get_foreground_window, _window_title, _is_window_minimized, _is_window_maximized

        hwnd = _get_foreground_window()
        if not hwnd:
            return {"result": "No active window currently in focus.", "title": "", "process": ""}

        title = _window_title(hwnd) or "(Untitled Window)"
        pid = ctypes.c_ulong()
        ctypes.windll.user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        pid_val = pid.value

        proc_name = ""
        try:
            if pid_val > 0:
                proc = psutil.Process(pid_val)
                proc_name = proc.name()
        except Exception:
            pass

        state = "Minimized" if _is_window_minimized(hwnd) else ("Maximized" if _is_window_maximized(hwnd) else "Normal")

        return {
            "result": f"Active window: '{title}'" + (f" ({proc_name})" if proc_name else "") + f" [State: {state}].",
            "title": title,
            "process": proc_name,
            "pid": pid_val,
            "hwnd": hwnd,
            "state": state,
        }
    except Exception as e:
        return {"result": f"Could not determine active window: {e}", "title": "", "process": ""}


@register("listOpenWindows")
def list_open_windows(args: Dict[str, Any] = {}) -> Dict[str, Any]:
    """List all open and visible application windows on the desktop."""
    if platform.system() != "Windows":
        return {"result": "Window listing is only supported on Windows.", "windows": []}

    try:
        import ctypes
        import psutil
        from .tools_windows import _get_visible_application_windows, _is_window_minimized, _is_window_maximized

        app_windows = _get_visible_application_windows()
        windows: List[Dict[str, Any]] = []

        for hwnd, title in app_windows:
            pid = ctypes.c_ulong()
            ctypes.windll.user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
            pid_val = pid.value
            proc_name = ""
            try:
                if pid_val > 0:
                    proc_name = psutil.Process(pid_val).name()
            except Exception:
                pass
            state = "minimized" if _is_window_minimized(hwnd) else ("maximized" if _is_window_maximized(hwnd) else "normal")
            windows.append({
                "hwnd": hwnd,
                "title": title,
                "process": proc_name,
                "pid": pid_val,
                "state": state,
            })

        # Deduplicate
        seen = set()
        deduped = []
        for w in windows:
            key = (w["title"], w["process"])
            if key not in seen:
                seen.add(key)
                deduped.append(w)

        summary = ", ".join(f"'{w['title']}' ({w['state']})" for w in deduped[:10])
        return {
            "result": f"Found {len(deduped)} open window(s): {summary}" + ("..." if len(deduped) > 10 else "."),
            "windows": deduped,
            "count": len(deduped),
        }
    except Exception as e:
        raise ToolError(f"Could not list open windows: {e}")


# ── 2. File System Control ────────────────────────────────────────────────────


@register("createFolder")
def create_folder(args: Dict[str, Any]) -> Dict[str, Any]:
    """Create a new folder/directory on Desktop, Documents, Downloads, or custom path."""
    name_or_path = args.get("name") or args.get("path") or args.get("folder")
    if not name_or_path:
        raise ToolError("Parameter 'name' or 'path' is required to create a folder.")

    parent = args.get("under") or args.get("location")
    if parent:
        parent_path = _resolve_folder(str(parent))
        target = (parent_path / str(name_or_path)).resolve()
    else:
        # Check if name_or_path is already a full/relative path or alias
        p = Path(os.path.expandvars(os.path.expanduser(str(name_or_path))))
        if not p.is_absolute() and len(p.parts) == 1:
            # Default single name to Desktop if no location specified
            target = (Path(os.path.expanduser("~")) / "Desktop" / str(name_or_path)).resolve()
        else:
            target = p.resolve()

    _ensure_safe(target)
    if target.exists():
        return {"result": f"Folder already exists: {target}", "path": str(target), "already_existed": True}

    target.mkdir(parents=True, exist_ok=True)
    return {"result": f"Created folder: {target}", "path": str(target)}


@register("copyFile")
def copy_file(args: Dict[str, Any]) -> Dict[str, Any]:
    """Copy a file or directory from source to destination."""
    source_str = args.get("source") or args.get("path")
    dest_str = args.get("destination") or args.get("target") or args.get("dest")
    if not source_str or not dest_str:
        raise ToolError("Both 'source' and 'destination' parameters are required.")

    src = _resolve_file(str(source_str), must_exist=True)
    _ensure_safe(src)

    dest = Path(os.path.expandvars(os.path.expanduser(str(dest_str)))).resolve()
    if dest.is_dir():
        dest = dest / src.name
    _ensure_safe(dest)

    try:
        if src.is_dir():
            shutil.copytree(str(src), str(dest), dirs_exist_ok=True)
        else:
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(str(src), str(dest))
        return {"result": f"Copied {src.name} to {dest}", "source": str(src), "destination": str(dest)}
    except Exception as e:
        raise ToolError(f"Could not copy file: {e}")


@register("openFile")
def open_file(args: Dict[str, Any]) -> Dict[str, Any]:
    """Open any document, image, media, or project file with its default Windows application."""
    path_str = args.get("path") or args.get("name") or args.get("file")
    p = _resolve_file(str(path_str), must_exist=True)
    _ensure_safe(p)

    try:
        if platform.system() == "Windows":
            os.startfile(str(p))
        elif platform.system() == "Darwin":
            subprocess.Popen(["open", str(p)], close_fds=True)
        else:
            subprocess.Popen(["xdg-open", str(p)], close_fds=True)
        return {"result": f"Opened file: {p.name}", "path": str(p)}
    except Exception as e:
        raise ToolError(f"Could not open file '{p}': {e}")


# ── 3. Input & Clipboard Control ──────────────────────────────────────────────


@register("setClipboard")
def set_clipboard(args: Dict[str, Any]) -> Dict[str, Any]:
    """Write text directly to the Windows clipboard without immediately pasting."""
    text = args.get("text")
    if text is None:
        raise ToolError("Parameter 'text' is required.")

    import pyperclip

    pyperclip.copy(str(text))
    preview = str(text) if len(str(text)) <= 150 else str(text)[:150] + "…"
    return {"result": f"Copied to clipboard: '{preview}'", "length": len(str(text))}


@register("mouseMove")
def mouse_move(args: Dict[str, Any]) -> Dict[str, Any]:
    """Move the mouse cursor smoothly to specified screen coordinates (x, y)."""
    x = args.get("x")
    y = args.get("y")
    if x is None or y is None:
        raise ToolError("Both 'x' and 'y' coordinates are required.")

    import pyautogui

    duration = float(args.get("duration", 0.2))
    pyautogui.moveTo(int(x), int(y), duration=duration)
    return {"result": f"Moved mouse to ({x}, {y}).", "x": int(x), "y": int(y)}


@register("mouseScroll")
def mouse_scroll(args: Dict[str, Any]) -> Dict[str, Any]:
    """Scroll the mouse wheel up (positive) or down (negative)."""
    amount = args.get("amount") or args.get("clicks")
    if amount is None:
        direction = str(args.get("direction", "down")).lower()
        amount = -5 if direction == "down" else 5
    else:
        amount = int(amount)

    import pyautogui

    pyautogui.scroll(amount)
    dir_str = "down" if amount < 0 else "up"
    return {"result": f"Scrolled {dir_str} ({abs(amount)} clicks)."}


# ── 4. Hardware & System Info ─────────────────────────────────────────────────


@register("batteryInfo")
def battery_info(args: Dict[str, Any]) -> Dict[str, Any]:
    """Check laptop battery level, charging status, and remaining power runtime."""
    import psutil

    battery = psutil.sensors_battery()
    if not battery:
        return {
            "result": "No battery detected (this device is running on direct AC power / Desktop PC).",
            "has_battery": False,
        }

    pct = int(battery.percent)
    plugged = bool(battery.power_plugged)
    secsleft = battery.secsleft

    status_str = "Plugged in (Charging)" if plugged else "Discharging (On Battery)"
    time_str = ""
    if not plugged and secsleft > 0 and secsleft != psutil.POWER_TIME_UNLIMITED:
        hours = secsleft // 3600
        mins = (secsleft % 3600) // 60
        time_str = f", approx {hours}h {mins}m remaining"

    return {
        "result": f"Battery is at {pct}%. Status: {status_str}{time_str}.",
        "percent": pct,
        "plugged_in": plugged,
        "seconds_left": secsleft if secsleft > 0 else None,
        "has_battery": True,
    }


@register("networkStatus")
def network_status(args: Dict[str, Any]) -> Dict[str, Any]:
    """Check internet connectivity, Wi-Fi SSID, signal strength, and network IP addresses."""
    import psutil

    # Check live internet reachability
    online = False
    try:
        s = socket.create_connection(("8.8.8.8", 53), timeout=2.0)
        s.close()
        online = True
    except Exception:
        online = False

    wifi_info: Dict[str, Any] = {}
    if platform.system() == "Windows":
        try:
            out = subprocess.check_output(
                ["netsh", "wlan", "show", "interfaces"],
                text=True,
                stderr=subprocess.DEVNULL,
                timeout=4,
            )
            for line in out.splitlines():
                if " SSID" in line and "BSSID" not in line:
                    parts = line.split(":", 1)
                    if len(parts) > 1:
                        wifi_info["ssid"] = parts[1].strip()
                elif " Signal" in line:
                    parts = line.split(":", 1)
                    if len(parts) > 1:
                        wifi_info["signal"] = parts[1].strip()
                elif " State" in line:
                    parts = line.split(":", 1)
                    if len(parts) > 1:
                        wifi_info["state"] = parts[1].strip()
        except Exception:
            pass

    # Gather local active IP addresses
    ips: List[str] = []
    try:
        for iface_name, addrs in psutil.net_if_addrs().items():
            for addr in addrs:
                if addr.family == socket.AF_INET and not addr.address.startswith("127."):
                    ips.append(f"{iface_name}: {addr.address}")
    except Exception:
        pass

    summary = "Online (Connected to Internet)" if online else "Offline (No Internet Connection)"
    if "ssid" in wifi_info:
        summary += f" via Wi-Fi '{wifi_info['ssid']}'"
        if "signal" in wifi_info:
            summary += f" ({wifi_info['signal']} signal)"

    return {
        "result": f"Network Status: {summary}.",
        "online": online,
        "wifi": wifi_info,
        "ip_addresses": ips[:5],
    }


# ── 5. Process Management ─────────────────────────────────────────────────────


@register("listProcesses")
def list_processes(args: Dict[str, Any]) -> Dict[str, Any]:
    """List top running processes sorted by memory or CPU usage."""
    import psutil

    sort_by = str(args.get("sort_by", "memory")).lower()
    limit = int(args.get("limit", 15))

    procs = []
    for p in psutil.process_iter(["pid", "name", "memory_percent", "cpu_percent"]):
        try:
            info = p.info
            procs.append({
                "pid": info["pid"],
                "name": info["name"] or "Unknown",
                "memory_percent": round(info.get("memory_percent") or 0.0, 1),
                "cpu_percent": round(info.get("cpu_percent") or 0.0, 1),
            })
        except Exception:
            continue

    if sort_by == "cpu":
        procs.sort(key=lambda x: x["cpu_percent"], reverse=True)
    else:
        procs.sort(key=lambda x: x["memory_percent"], reverse=True)

    top = procs[:limit]
    summary = ", ".join(f"{p['name']} (PID {p['pid']}, {p['memory_percent']}% RAM)" for p in top[:5])
    return {
        "result": f"Top running processes: {summary}...",
        "processes": top,
        "count": len(procs),
    }


@register("killProcess")
def kill_process(args: Dict[str, Any]) -> Dict[str, Any]:
    """Terminate a user application process safely by name or PID."""
    import psutil

    target_pid = args.get("pid")
    target_name = args.get("name") or args.get("process")

    if target_pid is None and not target_name:
        raise ToolError("Provide either 'pid' or process 'name' to terminate.")

    # PID termination
    if target_pid is not None:
        pid = int(target_pid)
        try:
            proc = psutil.Process(pid)
            name = proc.name().lower()
            if name in PROTECTED_PROCESSES or pid in (0, 4):
                raise ToolError(f"Cannot terminate critical system process '{proc.name()}' (PID {pid}).")
            proc.terminate()
            proc.wait(timeout=3)
            return {"result": f"Terminated process '{proc.name()}' (PID {pid})."}
        except psutil.NoSuchProcess:
            raise ToolError(f"No running process with PID {pid}.")
        except Exception as e:
            raise ToolError(f"Failed to terminate PID {pid}: {e}")

    # Name termination
    name_query = str(target_name).strip().lower()
    if not name_query.endswith(".exe"):
        name_query_exe = name_query + ".exe"
    else:
        name_query_exe = name_query

    if name_query in PROTECTED_PROCESSES or name_query_exe in PROTECTED_PROCESSES:
        raise ToolError(f"Cannot terminate critical Windows system process '{target_name}'.")

    killed = 0
    for p in psutil.process_iter(["pid", "name"]):
        try:
            p_name = (p.info["name"] or "").lower()
            if p_name == name_query or p_name == name_query_exe or name_query in p_name:
                p.terminate()
                killed += 1
        except Exception:
            continue

    if killed == 0:
        return {"result": f"No running process matching '{target_name}' was found."}
    return {"result": f"Terminated {killed} process instance(s) matching '{target_name}'."}

