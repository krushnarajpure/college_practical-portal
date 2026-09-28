/* ===========================================================================
 * MYRAA — Electron preload (System-Wide Desktop Shell)
 * ---------------------------------------------------------------------------
 * Runs in an isolated context and exposes a secure desktop API surface to
 * the renderer via contextBridge.
 * ========================================================================= */

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('myraa', {
  isDesktop: true,
  platform: process.platform,
  version: process.versions.electron,
  minimize: () => ipcRenderer.send('myraa:minimize'),
  hide: () => ipcRenderer.send('myraa:hide'),
  show: () => ipcRenderer.send('myraa:show'),
  toggleListening: (active) => ipcRenderer.send('myraa:toggle-listening', active),
  onTrayAction: (callback) => {
    const handler = (_event, action) => callback(action);
    ipcRenderer.on('myraa:tray-action', handler);
    return () => ipcRenderer.removeListener('myraa:tray-action', handler);
  },
});
