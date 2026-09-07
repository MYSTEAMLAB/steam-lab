import React from 'react'
import { ChevronDown, CircuitBoard } from 'lucide-react'
import { useAppStore } from '@renderer/store/useAppStore'

const PCB_TYPES: { id: 'AI_SENIOR' | 'AI_JUNIOR'; label: string; description: string }[] = [
  { id: 'AI_SENIOR', label: 'AI Senior', description: 'MY STEAM LAB\'s advanced kit — full sensor/AI feature set.' },
  { id: 'AI_JUNIOR', label: 'AI Junior', description: 'MY STEAM LAB\'s beginner kit — a simpler starting point.' }
]

/**
 * PcbTypeSelector
 * Picks which of MY STEAM LAB's own PCB kits a project targets. Both run on
 * the same ESP32 underneath, so this is informational/branding only for now —
 * it doesn't change the pinmap, toolbox, or generated code.
 */
export const PcbTypeSelector: React.FC = () => {
  const pcbType = useAppStore(s => s.pcbType)
  const setPcbType = useAppStore(s => s.setPcbType)
  const [isOpen, setIsOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const current = PCB_TYPES.find(p => p.id === pcbType) ?? PCB_TYPES[0]

  return (
    <div className="relative" ref={dropdownRef}>
      <button
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
        <CircuitBoard size={14} className="text-primary-400 shrink-0" />
        <span className="truncate max-w-[120px]">{current.label}</span>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <ul
          role="listbox"
          aria-label="Select PCB type"
          className="
            absolute top-full left-0 mt-1.5 z-50
            w-60 rounded-xl overflow-hidden
            bg-surface-50 border border-panel-border
            shadow-2xl shadow-black/40
            animate-slide-down
          "
        >
          {PCB_TYPES.map(pcb => {
            const isSelected = pcb.id === pcbType
            return (
              <li
                key={pcb.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => { setPcbType(pcb.id); setIsOpen(false) }}
                className={`
                  flex items-start gap-3 px-4 py-3 cursor-pointer
                  transition-colors duration-100
                  ${isSelected ? 'bg-primary-700/40 text-primary-200' : 'text-slate-300 hover:bg-surface-100'}
                `}
              >
                <CircuitBoard size={16} className={`mt-0.5 shrink-0 ${isSelected ? 'text-primary-400' : 'text-slate-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">{pcb.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{pcb.description}</p>
                </div>
                {isSelected && <span className="shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-primary-400 self-start" />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
