import React from 'react'
import { useAppStore } from '@renderer/store/useAppStore'
import { Link2 } from 'lucide-react'

export const ActiveConnectionsPanel: React.FC = () => {
  const placedDevices = useAppStore(s => s.selectedBoard ? (s.boardLayouts[s.selectedBoard.id]?.devices || []) : [])

  return (
    <div className="flex flex-col h-full bg-surface-50">
      <div className="flex items-center gap-1.5 px-3 h-8 shrink-0 border-b border-panel-border bg-surface-100/50">
        <span className="text-slate-500"><Link2 size={13} /></span>
        <span className="text-xs font-semibold text-slate-400 tracking-wide uppercase">Active Connections</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {placedDevices.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-slate-500 italic text-center">No components placed.</p>
          </div>
        )}
        {placedDevices.map(device => {
          const mappedPinStr = typeof device.mappedPin === 'string' ? device.mappedPin :
            (typeof device.mappedPin === 'object' && device.mappedPin !== null) ?
            Object.values(device.mappedPin).filter(Boolean).join(', ') : ''
          return (
            <div key={`conn_${device.id}`} className="flex items-center justify-between p-2 rounded-lg bg-surface-100 border border-panel-border text-xs">
              <span className="text-slate-300 font-medium capitalize">{device.type}</span>
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${mappedPinStr ? 'bg-emerald-400' : 'bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
                <span className="text-slate-400 font-mono">{mappedPinStr || 'Unassigned'}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
