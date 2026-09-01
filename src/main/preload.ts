import { contextBridge, ipcRenderer } from 'electron'
import type { BoardSummary } from '../shared/types/board'

/**
 * Preload script — the ONLY code that runs with Node.js context AND renderer
 * context simultaneously. All Node/Electron APIs must be explicitly whitelisted
 * here via contextBridge. The renderer NEVER sees ipcRenderer directly.
 *
 * Exposed as: window.api
 */

const api = {
  /**
   * Fetch the list of all registered boards from the main process.
   * Returns a lightweight summary array safe for JSON serialization.
   */
  getBoards: (): Promise<BoardSummary[]> =>
    ipcRenderer.invoke('boards:list'),

  /**
   * Fetch the running application version string.
   */
  getVersion: (): Promise<string> =>
    ipcRenderer.invoke('app:version'),

  compiler: {
    check: () => ipcRenderer.invoke('compiler:check'),
    install: () => ipcRenderer.invoke('compiler:install'),
    compile: (code: string, fqbn: string) => ipcRenderer.invoke('compiler:compile', code, fqbn),
    upload: (
      code: string,
      fqbn: string,
      port: string,
      wifiTarget?: { ip: string; password?: string },
      btTarget?: { port: string }
    ) => ipcRenderer.invoke('compiler:upload', code, fqbn, port, wifiTarget, btTarget),
    onLog: (callback: (log: string) => void) => {
      const listener = (_event: any, log: string) => callback(log)
      ipcRenderer.on('compiler:log', listener)
      return () => { ipcRenderer.removeListener('compiler:log', listener) }
    }
  },

  bluetooth: {
    /** Paired Bluetooth serial devices, resolved to their real names. */
    listDevices: () => ipcRenderer.invoke('bluetooth:listDevices')
  },

  system: {
    openBluetoothSettings: (): Promise<void> => ipcRenderer.invoke('system:openBluetoothSettings')
  },

  mobileServer: {
    start: (): Promise<{ port: number; pin: string; lanIp: string | null }> =>
      ipcRenderer.invoke('mobileServer:start'),
    stop: (): Promise<void> => ipcRenderer.invoke('mobileServer:stop'),
    status: (): Promise<{ running: boolean; port: number; pin: string; lanIp: string | null }> =>
      ipcRenderer.invoke('mobileServer:status')
  },

  serial: {
    getPorts: () => ipcRenderer.invoke('serial:getPorts'),
    open: (path: string, baudRate: number, options?: { skipReset?: boolean }) =>
      ipcRenderer.invoke('serial:open', path, baudRate, options),
    close: () => ipcRenderer.invoke('serial:close'),
    write: (data: string) => ipcRenderer.invoke('serial:write', data),
    onData: (callback: (data: string) => void) => {
      const listener = (_event: any, data: string) => callback(data)
      ipcRenderer.on('serial:data', listener)
      return () => { ipcRenderer.removeListener('serial:data', listener) }
    },
    onError: (callback: (error: string) => void) => {
      const listener = (_event: any, error: string) => callback(error)
      ipcRenderer.on('serial:error', listener)
      return () => { ipcRenderer.removeListener('serial:error', listener) }
    },
    onClosed: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('serial:closed', listener)
      return () => { ipcRenderer.removeListener('serial:closed', listener) }
    }
  },

  project: {
    open: (filePath?: string) => ipcRenderer.invoke('project:open', filePath),
    save: (path: string, data: any) => ipcRenderer.invoke('project:save', { path, data }),
    saveAs: (data: any) => ipcRenderer.invoke('project:saveAs', data),
    exportIno: (code: string, defaultName: string) => ipcRenderer.invoke('project:exportIno', { code, defaultName }),
    getRecents: () => ipcRenderer.invoke('project:getRecents'),
    autoSave: (data: any) => ipcRenderer.invoke('project:autoSave', data),
    checkRecovery: () => ipcRenderer.invoke('project:checkRecovery'),
    clearRecovery: () => ipcRenderer.invoke('project:clearRecovery'),
  },

  onMenuAction: (callback: (action: string) => void) => {
    const listener = (_event: any, action: string) => callback(action)
    ipcRenderer.on('menu:action', listener)
    return () => { ipcRenderer.removeListener('menu:action', listener) }
  }
}

contextBridge.exposeInMainWorld('api', api)

// ─────────────────────────────────────────────────────────────────────────────
// TypeScript global augmentation — consumed by the renderer's tsconfig.
// This ensures window.api is typed throughout the React codebase.
// ─────────────────────────────────────────────────────────────────────────────
export type ElectronApi = typeof api
