import type { BoardSummary } from './board'

/**
 * Maps every IPC channel name to its handler return type.
 * Used in:
 *  - src/main/ipc/*.ts  to strongly type ipcMain.handle() calls
 *  - src/main/preload.ts to strongly type ipcRenderer.invoke() calls
 *
 * Pattern: channel name as key → return type of the handler Promise.
 */
export interface IpcChannels {
  /** Returns the full board list for the BoardSelector UI */
  'boards:list': string

  /** Returns the running app version string */
  'app:version': string

  // ── Phase 2+ channels (stubs only — not implemented yet) ─────────────────
  /** Compile and upload a sketch to the connected board */
  'upload:run': string

  /** List available COM/serial ports */
  'ports:list': string

  /** Open/close a serial port for the terminal */
  'serial:connect': string
  'serial:disconnect': string
  'serial:send': string

  /** Project file operations */
  'project:save': string
  'project:open': string
}

/**
 * Response types for each IPC channel.
 * Keeping these as a separate interface makes it easy to add payload shapes
 * as each phase is implemented.
 */
export interface IpcResponses {
  'boards:list': BoardSummary[]
  'app:version': string
  'upload:run': { success: boolean; log: string }
  'ports:list': string[]
  'serial:connect': boolean
  'serial:disconnect': void
  'serial:send': void
  'project:save': boolean
  'project:open': { path: string; data: string } | null
}

/**
 * Utility type that extracts the invoke return type for a given channel.
 * Usage: IpcResult<'boards:list'> → BoardSummary[]
 */
export type IpcResult<T extends keyof IpcResponses> = IpcResponses[T]
