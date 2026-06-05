import { IpcMain } from 'electron'
import { boardRegistry } from '../../shared/boards'
import type { IpcChannels } from '../../shared/types/ipc'

/**
 * Registers all Board Abstraction Layer IPC handlers on the main process.
 * Called once from src/main/index.ts before the window is created.
 *
 * Channels registered:
 *   boards:list  → Returns the full list of registered boards (id, name, capabilities)
 *   app:version  → Returns the current application version
 */
export function registerBoardHandlers(ipcMain: IpcMain): void {

  // ── boards:list ───────────────────────────────────────────────────────────
  // Returns a serializable summary of every registered board for the renderer.
  const boardsListChannel: IpcChannels['boards:list'] = 'boards:list'
  ipcMain.handle(boardsListChannel, async () => {
    try {
      return boardRegistry.getAll().map(board => ({
        id: board.id,
        name: board.name,
        fqbn: board.fqbn,
        capabilities: board.capabilities,
        description: board.description ?? ''
      }))
    } catch (err) {
      console.error('[IPC] boards:list handler threw:', err)
      throw err
    }
  })

  // ── app:version ───────────────────────────────────────────────────────────
  const versionChannel: IpcChannels['app:version'] = 'app:version'
  ipcMain.handle(versionChannel, async () => {
    return process.env['npm_package_version'] ?? '1.0.0'
  })
}
