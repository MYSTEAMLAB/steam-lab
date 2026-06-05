import React from 'react'
import { ChevronDown, Cpu } from 'lucide-react'
import { useAppStore } from '@renderer/store/useAppStore'
import type { BoardSummary } from '@shared/types/board'

/**
 * BoardSelector
 * Renders a styled dropdown that lists all registered boards.
 * Selecting a board dispatches setBoard() into the Zustand store,
 * which resets placed devices and reloads the hardware canvas.
 */
export const BoardSelector: React.FC = () => {
  const { availableBoards, selectedBoard, setBoard } = useAppStore()
  const [isOpen, setIsOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Close on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (board: BoardSummary) => {
    setBoard(board.id)
    setIsOpen(false)
  }

  if (availableBoards.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-50 text-slate-500 text-sm">
        <Cpu size={14} />
        <span>Loading boards…</span>
      </div>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* ── Trigger button ──────────────────────────────────────────────── */}
      <button
        id="board-selector-trigger"
        onClick={() => setIsOpen(prev => !prev)}
        className="
          flex items-center gap-2 px-3 py-1.5 rounded-lg
          bg-surface-50 border border-panel-border
          text-slate-200 text-sm font-medium
          hover:bg-surface-100 hover:border-primary-500
          transition-colors duration-150
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 focus:ring-offset-surface-DEFAULT
        "
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <Cpu size={14} className="text-primary-400 shrink-0" />
        <span className="truncate max-w-[160px]">
          {selectedBoard?.name ?? 'Select Board'}
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* ── Dropdown panel ───────────────────────────────────────────────── */}
      {isOpen && (
        <ul
          role="listbox"
          aria-label="Select a board"
          className="
            absolute top-full left-0 mt-1.5 z-50
            w-64 rounded-xl overflow-hidden
            bg-surface-50 border border-panel-border
            shadow-2xl shadow-black/40
            animate-slide-down
          "
        >
          {availableBoards.map(board => {
            const isSelected = board.id === selectedBoard?.id
            return (
              <li
                key={board.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(board)}
                className={`
                  flex items-start gap-3 px-4 py-3 cursor-pointer
                  transition-colors duration-100
                  ${isSelected
                    ? 'bg-primary-700/40 text-primary-200'
                    : 'text-slate-300 hover:bg-surface-100'
                  }
                `}
              >
                <Cpu
                  size={16}
                  className={`mt-0.5 shrink-0 ${isSelected ? 'text-primary-400' : 'text-slate-500'}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">{board.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{board.description}</p>
                </div>
                {isSelected && (
                  <span className="shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-primary-400 self-start" />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
