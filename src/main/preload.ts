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
    upload: (code: string, fqbn: string, port: string) => ipcRenderer.invoke('compiler:upload', code, fqbn, port),
    onLog: (callback: (log: string) => void) => {
      ipcRenderer.on('compiler:log', (_event, log) => callback(log))
      return () => { ipcRenderer.removeAllListeners('compiler:log') }
    }
  },

  serial: {
    getPorts: () => ipcRenderer.invoke('serial:getPorts'),
    open: (path: string, baudRate: number) => ipcRenderer.invoke('serial:open', path, baudRate),
    close: () => ipcRenderer.invoke('serial:close'),
    write: (data: string) => ipcRenderer.invoke('serial:write', data),
    onData: (callback: (data: string) => void) => {
      ipcRenderer.on('serial:data', (_event, data) => callback(data))
      return () => { ipcRenderer.removeAllListeners('serial:data') }
    },
    onError: (callback: (error: string) => void) => {
      ipcRenderer.on('serial:error', (_event, error) => callback(error))
      return () => { ipcRenderer.removeAllListeners('serial:error') }
    },
    onClosed: (callback: () => void) => {
      ipcRenderer.on('serial:closed', () => callback())
      return () => { ipcRenderer.removeAllListeners('serial:closed') }
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
    ipcRenderer.on('menu:action', (_event, action) => callback(action))
    return () => { ipcRenderer.removeAllListeners('menu:action') }
  }
}

contextBridge.exposeInMainWorld('api', api)

// ─────────────────────────────────────────────────────────────────────────────
// TypeScript global augmentation — consumed by the renderer's tsconfig.
// This ensures window.api is typed throughout the React codebase.
// ─────────────────────────────────────────────────────────────────────────────
export type ElectronApi = typeof api
