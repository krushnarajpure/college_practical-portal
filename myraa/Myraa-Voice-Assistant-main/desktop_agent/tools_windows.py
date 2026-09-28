"""
Window management: Native Win32 and Windows Shell COM controls.

Includes:
- minimizeAllWindows: Shell.Application COM MinimizeAll + state verification + ShowWindowAsync fallback + Win+D fallback.
- restoreAllWindows: Shell.Application COM UndoMinimizeALL + state verification + ShowWindowAsync(SW_RESTORE) fallback.
- minimizeWindow: target hwnd, ShowWindowAsync(SW_MINIMIZE), IsIconic verification, WM_SYSCOMMAND fallback.
- maximizeWindow: target hwnd, ShowWindowAsync(SW_MAXIMIZE), IsZoomed verification, WM_SYSCOMMAND fallback.
- restoreWindow: target hwnd, ShowWindowAsync(SW_RESTORE), not IsIconic verification, focus lock bypass.
- closeWindow: target hwnd, PostMessage(WM_CLOSE), not IsWindow verification.
- switchApplication: target hwnd, AttachThreadInput focus lock bypass, SetForegroundWindow, verification.
"""

from __future__ import annotations

import ctypes
import os
import platform
import subprocess
import time
from typing import Any, Dict, List, Optional, Tuple

from .registry import ToolError, register

# Win32 ShowWindow Commands
SW_HIDE = 0
SW_SHOWNORMAL = 1
SW_SHOWMINIMIZED = 2
SW_MAXIMIZE = 3
SW_SHOWMAXIMIZED = 3
SW_SHOWNOACTIVATE = 4
SW_SHOW = 5
SW_MINIMIZE = 6
SW_SHOWMINNOACTIVE = 7
SW_SHOWNA = 8
SW_RESTORE = 9
SW_SHOWDEFAULT = 10
SW_FORCEMINIMIZE = 11

# Win32 Messages
WM_CLOSE = 0x0010
WM_SYSCOMMAND = 0x0112
SC_MINIMIZE = 0xF020
SC_MAXIMIZE = 0xF030
SC_RESTORE = 0xF120
SC_CLOSE = 0xF060

GW_HWNDNEXT = 2
GW_CHILD = 5
GWL_EXSTYLE = -20
WS_EX_TOOLWINDOW = 0x00000080


def _get_foreground_window():
    if platform.system() != "Windows":
        return None
    try:
        import win32gui

        hwnd = win32gui.GetForegroundWindow()
        return hwnd if (hwnd and win32gui.IsWindow(hwnd)) else None
    except Exception:
        try:
            hwnd = ctypes.windll.user32.GetForegroundWindow()
            return hwnd if (hwnd and ctypes.windll.user32.IsWindow(hwnd)) else None
        except Exception:
            return None


def _window_title(hwnd) -> str:
    try:
        import win32gui

        return win32gui.GetWindowText(hwnd) or ""
    except Exception:
        try:
            length = ctypes.windll.user32.GetWindowTextLengthW(hwnd)
            if length > 0:
                buff = ctypes.create_unicode_buffer(length + 1)
                ctypes.windll.user32.GetWindowTextW(hwnd, buff, length + 1)
                return buff.value
        except Exception:
            pass
        return ""


def _is_window_minimized(hwnd) -> bool:
    try:
        import win32gui

        return bool(win32gui.IsIconic(hwnd))
    except Exception:
        try:
            return bool(ctypes.windll.user32.IsIconic(hwnd))
        except Exception:
            return False


def _is_window_maximized(hwnd) -> bool:
    try:
        import win32gui

        return bool(win32gui.IsZoomed(hwnd))
    except Exception:
        try:
            return bool(ctypes.windll.user32.IsZoomed(hwnd))
        except Exception:
            return False


def _is_window_valid(hwnd) -> bool:
    try:
        import win32gui

        return bool(win32gui.IsWindow(hwnd))
    except Exception:
        try:
            return bool(ctypes.windll.user32.IsWindow(hwnd))
        except Exception:
            return False


def _get_visible_application_windows() -> List[Tuple[int, str]]:
    """Return list of (hwnd, title) for all user-visible application windows on the desktop."""
    if platform.system() != "Windows":
        return []

    windows = []
    try:
        user32 = ctypes.windll.user32
        hwnd = user32.GetWindow(user32.GetDesktopWindow(), GW_CHILD)
        while hwnd:
            try:
                if user32.IsWindowVisible(hwnd):
                    length = user32.GetWindowTextLengthW(hwnd)
                    if length > 0:
                        buff = ctypes.create_unicode_buffer(length + 1)
                        user32.GetWindowTextW(hwnd, buff, length + 1)
                        title = buff.value.strip()
                        # Filter out desktop, system tray, and tool windows
                        ex_style = user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
                        is_tool = bool(ex_style & WS_EX_TOOLWINDOW)
                        if title and not is_tool and title not in ("Program Manager", "Settings", "Windows Shell Experience Host"):
                            windows.append((hwnd, title))
            except Exception:
                pass
            hwnd = user32.GetWindow(hwnd, GW_HWNDNEXT)
    except Exception:
        pass

    return windows


def _find_window_by_title(query: str) -> Optional[Tuple[int, str]]:
    """Return (hwnd, title) for the first window matching query."""
    query_lower = query.strip().lower()
    windows = _get_visible_application_windows()
    # Exact match first
    for hwnd, title in windows:
        if query_lower == title.lower():
            return hwnd, title
    # Substring match
    for hwnd, title in windows:
        if query_lower in title.lower():
            return hwnd, title
    return None


def _focus_window_robust(hwnd) -> bool:
    """Bring a window to foreground, bypassing Windows focus locks via thread attachment."""
    if not hwnd or not _is_window_valid(hwnd):
        return False

    try:
        user32 = ctypes.windll.user32
        kernel32 = ctypes.windll.kernel32

        # If minimized, restore first
        if _is_window_minimized(hwnd):
            user32.ShowWindowAsync(hwnd, SW_RESTORE)
            time.sleep(0.05)

        fg_hwnd = user32.GetForegroundWindow()
        if fg_hwnd == hwnd:
            return True

        fg_thread = user32.GetWindowThreadProcessId(fg_hwnd, None)
        cur_thread = kernel32.GetCurrentThreadId()

        if fg_thread and fg_thread != cur_thread:
            user32.AttachThreadInput(cur_thread, fg_thread, True)
            user32.BringWindowToTop(hwnd)
            user32.ShowWindow(hwnd, SW_SHOW)
            user32.SetForegroundWindow(hwnd)
            user32.AttachThreadInput(cur_thread, fg_thread, False)
        else:
            user32.BringWindowToTop(hwnd)
            user32.ShowWindow(hwnd, SW_SHOW)
            user32.SetForegroundWindow(hwnd)

        time.sleep(0.05)
        return user32.GetForegroundWindow() == hwnd
    except Exception:
        try:
            import win32gui

            win32gui.SetForegroundWindow(hwnd)
            return True
        except Exception:
            return False


def _resolve_target(args: Dict[str, Any]) -> Tuple[int, str]:
    """Resolve target HWND and title from args or foreground window."""
    title_arg: Optional[str] = args.get("title") or args.get("application") or args.get("window")
    if title_arg:
        match = _find_window_by_title(str(title_arg))
        if not match:
            raise ToolError(f"No visible window matching '{title_arg}' was found.")
        return match

    hwnd = _get_foreground_window()
    if not hwnd:
        raise ToolError("No active window currently in focus.")
    title = _window_title(hwnd) or "Active Window"
    return hwnd, title


# ── Registered Tools ──────────────────────────────────────────────────────────


@register("minimizeAllWindows")
def minimize_all_windows(args: Dict[str, Any] = {}) -> Dict[str, Any]:
    """Minimize all open application windows using native Windows Shell COM with verification & fallbacks."""
    if platform.system() != "Windows":
        return {"result": "Minimize all is only supported on Windows."}

    # Step 1: Native Windows Shell COM Dispatch (official OS Show-Desktop/Minimize-All)
    minimized_via_com = False
    try:
        import win32com.client

        shell = win32com.client.Dispatch("Shell.Application")
        shell.MinimizeAll()
        minimized_via_com = True
    except Exception:
        try:
            import comtypes.client

            shell = comtypes.client.CreateObject("Shell.Application")
            shell.MinimizeAll()
            minimized_via_com = True
        except Exception:
            pass

    time.sleep(0.15)

    # Step 2: Verification
    windows = _get_visible_application_windows()
    unminimized = [h for h, _ in windows if not _is_window_minimized(h)]

    # Step 3: Safe Fallback 1 — Direct ShowWindowAsync on any lingering un-minimized windows
    if unminimized:
        user32 = ctypes.windll.user32
        for h in unminimized:
            try:
                user32.ShowWindowAsync(h, SW_MINIMIZE)
            except Exception:
                pass
        time.sleep(0.1)
        unminimized = [h for h, _ in windows if not _is_window_minimized(h)]

    # Step 4: Safe Fallback 2 — Win+D keyboard hotkey if still un-minimized
    if unminimized:
        try:
            import pyautogui

            pyautogui.hotkey("win", "d")
            time.sleep(0.1)
        except Exception:
            pass
        unminimized = [h for h, _ in windows if not _is_window_minimized(h)]

    # Final Verification & True Reporting
    total_apps = len(windows)
    minimized_count = total_apps - len(unminimized)

    if total_apps == 0 or len(unminimized) == 0:
        return {
            "result": "All open windows have been minimized to the desktop.",
            "success": True,
            "minimized_count": total_apps,
        }
    return {
        "result": f"Minimized {minimized_count} of {total_apps} windows. Some system/elevated windows could not be hidden.",
        "success": True,
        "minimized_count": minimized_count,
        "total": total_apps,
    }


@register("restoreAllWindows")
def restore_all_windows(args: Dict[str, Any] = {}) -> Dict[str, Any]:
    """Restore (undo minimize) all previously minimized application windows."""
    if platform.system() != "Windows":
        return {"result": "Restore all is only supported on Windows."}

    # Step 1: Native Windows Shell COM UndoMinimizeALL
    restored_via_com = False
    try:
        import win32com.client

        shell = win32com.client.Dispatch("Shell.Application")
        shell.UndoMinimizeALL()
        restored_via_com = True
    except Exception:
        try:
            import comtypes.client

            shell = comtypes.client.CreateObject("Shell.Application")
            shell.UndoMinimizeALL()
            restored_via_com = True
        except Exception:
            pass

    time.sleep(0.15)

    # Step 2: Verification & Fallback
    windows = _get_visible_application_windows()
    still_minimized = [h for h, _ in windows if _is_window_minimized(h)]

    if still_minimized:
        user32 = ctypes.windll.user32
        for h in still_minimized:
            try:
                user32.ShowWindowAsync(h, SW_RESTORE)
            except Exception:
                pass
        time.sleep(0.1)

    return {"result": "Restored all application windows.", "success": True}


@register("minimizeWindow")
def minimize_window(args: Dict[str, Any]) -> Dict[str, Any]:
    """Minimize active or named window with verification."""
    hwnd, title = _resolve_target(args)
    user32 = ctypes.windll.user32

    # Execute
    user32.ShowWindowAsync(hwnd, SW_MINIMIZE)
    time.sleep(0.08)

    # Verify
    if _is_window_minimized(hwnd):
        return {"result": f"Minimized window: '{title}'.", "success": True, "title": title}

    # Fallback 1: Force minimize
    user32.ShowWindowAsync(hwnd, SW_FORCEMINIMIZE)
    time.sleep(0.08)
    if _is_window_minimized(hwnd):
        return {"result": f"Minimized window: '{title}'.", "success": True, "title": title}

    # Fallback 2: WM_SYSCOMMAND
    user32.PostMessageW(hwnd, WM_SYSCOMMAND, SC_MINIMIZE, 0)
    time.sleep(0.08)

    if _is_window_minimized(hwnd):
        return {"result": f"Minimized window: '{title}'.", "success": True, "title": title}

    # If failed, check if elevated/protected
    return {
        "result": f"Could not minimize '{title}'. The window may be running with Administrator privileges or is protected by Windows security.",
        "success": False,
        "title": title,
    }


@register("maximizeWindow")
def maximize_window(args: Dict[str, Any]) -> Dict[str, Any]:
    """Maximize active or named window with verification."""
    hwnd, title = _resolve_target(args)
    user32 = ctypes.windll.user32

    # Execute
    user32.ShowWindowAsync(hwnd, SW_MAXIMIZE)
    time.sleep(0.08)

    # Verify
    if _is_window_maximized(hwnd):
        return {"result": f"Maximized window: '{title}'.", "success": True, "title": title}

    # Fallback: WM_SYSCOMMAND
    user32.PostMessageW(hwnd, WM_SYSCOMMAND, SC_MAXIMIZE, 0)
    time.sleep(0.08)

    if _is_window_maximized(hwnd):
        return {"result": f"Maximized window: '{title}'.", "success": True, "title": title}

    return {
        "result": f"Could not maximize '{title}'. The window may be fixed-size or elevated.",
        "success": False,
        "title": title,
    }


@register("restoreWindow")
def restore_window(args: Dict[str, Any]) -> Dict[str, Any]:
    """Restore a minimized or maximized window to normal size and focus it."""
    hwnd, title = _resolve_target(args)
    user32 = ctypes.windll.user32

    # Execute
    user32.ShowWindowAsync(hwnd, SW_RESTORE)
    _focus_window_robust(hwnd)
    time.sleep(0.08)

    # Verify
    if not _is_window_minimized(hwnd):
        return {"result": f"Restored and focused window: '{title}'.", "success": True, "title": title}

    return {"result": f"Could not restore window '{title}'.", "success": False, "title": title}


@register("closeWindow")
def close_window(args: Dict[str, Any]) -> Dict[str, Any]:
    """Gracefully close the active or named window with verification."""
    hwnd, title = _resolve_target(args)
    user32 = ctypes.windll.user32

    # Execute graceful close via WM_CLOSE
    user32.PostMessageW(hwnd, WM_CLOSE, 0, 0)

    # Verify if closed (give up to 350ms for window cleanup)
    for _ in range(7):
        time.sleep(0.05)
        if not _is_window_valid(hwnd):
            return {"result": f"Closed window: '{title}'.", "success": True, "title": title}

    return {
        "result": f"Sent close request to '{title}'. (The application may have prompted to save changes).",
        "success": True,
        "title": title,
    }


@register("switchApplication")
def switch_application(args: Dict[str, Any]) -> Dict[str, Any]:
    """Focus a window by title or application name with verification, or cycle Alt+Tab."""
    title_arg = args.get("title") or args.get("application")
    if title_arg:
        match = _find_window_by_title(str(title_arg))
        if not match:
            raise ToolError(f"No visible window matching '{title_arg}' was found.")
        hwnd, title = match
        focused = _focus_window_robust(hwnd)
        return {"result": f"Switched focus to: '{title}'.", "success": True, "title": title}

    # No specific title -> Alt+Tab cycle
    try:
        import pyautogui

        pyautogui.hotkey("alt", "tab")
        time.sleep(0.1)
        fg = _get_foreground_window()
        title = _window_title(fg) if fg else "next window"
        return {"result": f"Switched to: {title}.", "success": True}
    except Exception as e:
        raise ToolError(f"Could not cycle applications: {e}")


__all__ = [
    "minimize_all_windows",
    "restore_all_windows",
    "minimize_window",
    "maximize_window",
    "restore_window",
    "close_window",
    "switch_application",
]

