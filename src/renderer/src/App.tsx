import React from 'react'
import { AppLayout } from '@renderer/views/AppLayout'
import { useAppStore } from '@renderer/store/useAppStore'
import type { AppState, AppActions } from '@renderer/store/useAppStore'

/**
 * App root component.
 * Responsibilities:
 *  1. On mount: call window.api.getBoards() via the preload bridge and
 *     populate the Zustand store with the registered board list.
 *  2. Render the AppLayout IDE shell.
 */
export const App: React.FC = () => {
  const setAvailableBoards = useAppStore((s: AppState & AppActions) => s.setAvailableBoards)
  const [isReady, setIsReady] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function loadBoards(): Promise<void> {
      try {
        const boards = await window.api.getBoards()
        setAvailableBoards(boards)
      } catch (err) {
        console.error('[App] Failed to load boards:', err)
        setError('Could not load board definitions. Please restart the application.')
      } finally {
        setIsReady(true)
      }
    }
    loadBoards()
  }, [setAvailableBoards])

  // ── Loading splash ─────────────────────────────────────────────────────
  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-surface-DEFAULT">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-900/50">
            <svg viewBox="0 0 24 24" className="w-9 h-9 text-white fill-current">
              <path d="M12 2a2 2 0 0 1 2 2v1h1a2 2 0 0 1 2 2v1h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1V7a2 2 0 0 1 2-2h1V4a2 2 0 0 1 2-2z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">EduBlocks Studio</h1>
          <p className="text-sm text-slate-500 mt-1">Starting up…</p>
        </div>
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-surface-DEFAULT">
        <div className="text-center max-w-sm px-6 animate-fade-in">
          <div className="w-12 h-12 rounded-xl bg-red-900/30 border border-red-800/50 flex items-center justify-center mx-auto mb-4">
            <span className="text-red-400 text-2xl">!</span>
          </div>
          <h2 className="text-lg font-semibold text-slate-100">Startup Error</h2>
          <p className="text-sm text-slate-400 mt-2">{error}</p>
        </div>
      </div>
    )
  }

  return <AppLayout />
}
