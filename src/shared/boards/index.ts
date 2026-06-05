import type { BoardConfig, PinMap, RegisteredBoard } from '../types/board'

// ─────────────────────────────────────────────────────────────────────────────
// Static board imports
// JSON imports are compiled at build time. When adding a new board:
//   1. Create src/shared/boards/<board-id>/board-config.json
//   2. Create src/shared/boards/<board-id>/pinmap.json
//   3. Import and register below — no other file changes needed.
// ─────────────────────────────────────────────────────────────────────────────
import esp32Config from './esp32/board-config.json'
import esp32Pinmap from './esp32/pinmap.json'
import unoConfig from './arduino-uno/board-config.json'
import unoPinmap from './arduino-uno/pinmap.json'

// ─────────────────────────────────────────────────────────────────────────────
// Internal Board Registry
// ─────────────────────────────────────────────────────────────────────────────
interface BoardEntry {
  config: BoardConfig
  pinmap: PinMap
}

class BoardRegistryManager {
  private readonly _boards = new Map<string, BoardEntry>()

  constructor(entries: BoardEntry[]) {
    for (const entry of entries) {
      this._boards.set(entry.config.id, entry)
    }
  }

  /** Returns all registered boards as a flat array of configs */
  getAll(): RegisteredBoard[] {
    return Array.from(this._boards.values()).map(e => e.config)
  }

  /** Returns a single board config by id. Throws if not found. */
  getConfig(id: string): BoardConfig {
    const entry = this._boards.get(id)
    if (!entry) throw new Error(`[BAL] Board not found: "${id}"`)
    return entry.config
  }

  /** Returns the pinmap for a given board id. Throws if not found. */
  getPinMap(id: string): PinMap {
    const entry = this._boards.get(id)
    if (!entry) throw new Error(`[BAL] Pinmap not found for board: "${id}"`)
    return entry.pinmap
  }

  /** True if the board id is registered */
  has(id: string): boolean {
    return this._boards.has(id)
  }

  /** Returns the default board id (first registered board) */
  getDefaultId(): string {
    const first = this._boards.keys().next().value
    if (!first) throw new Error('[BAL] No boards registered')
    return first
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export singleton — used in main process IPC handlers and renderer store
// ─────────────────────────────────────────────────────────────────────────────
export const boardRegistry = new BoardRegistryManager([
  { config: esp32Config as BoardConfig, pinmap: esp32Pinmap as PinMap },
  { config: unoConfig as BoardConfig,   pinmap: unoPinmap  as PinMap },
])

/** Convenience re-export of all board ids for type-safe usage */
export const BOARD_IDS = {
  ESP32: 'esp32',
  ARDUINO_UNO: 'arduino-uno',
} as const

export type BoardId = (typeof BOARD_IDS)[keyof typeof BOARD_IDS]
