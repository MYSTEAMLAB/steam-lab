import React from 'react'
import { Cpu, Wifi, ShieldAlert, CheckCircle2, Zap } from 'lucide-react'
import type { BoardSummary } from '@shared/types/board'

interface BoardPreviewWidgetProps {
  board: BoardSummary | null
}

export const BoardPreviewWidget: React.FC<BoardPreviewWidgetProps> = ({ board }) => {
  if (!board) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center h-full text-slate-500">
        <Cpu size={32} className="text-slate-600 animate-pulse mb-2" />
        <p className="text-xs">No active board selected</p>
      </div>
    )
  }

  const isEsp32 = board.id === 'esp32'

  return (
    <div className="flex flex-col h-full overflow-y-auto select-none p-4">
      <div
        className="
          group relative flex flex-col items-center justify-center p-6 rounded-2xl
          bg-gradient-to-br from-surface-100 to-surface-200
          border border-panel-border hover:border-primary-500/50
          shadow-lg shadow-black/20 hover:shadow-primary-950/10
          transition-all duration-300 transform hover:-translate-y-1
          overflow-hidden shrink-0
        "
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:16px_16px] opacity-20 pointer-events-none" />

        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-[10px] text-emerald-700 font-bold tracking-wide">
          <CheckCircle2 size={10} className="text-emerald-600" />
          <span>Active</span>
        </div>

        <div className="w-full max-w-[200px] h-[130px] flex items-center justify-center relative z-10 transition-transform duration-300 group-hover:scale-105">
          {isEsp32 ? (
            <svg viewBox="0 0 160 110" className="w-full h-full drop-shadow-xl">
              <rect x="15" y="10" width="130" height="90" rx="6" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
              <g fill="#eab308">
                {Array.from({ length: 9 }).map((_, i) => (
                  <rect key={`l-${i}`} x="20" y={18 + i * 9} width="6" height="4" rx="0.5" />
                ))}
              </g>
              <g fill="#eab308">
                {Array.from({ length: 9 }).map((_, i) => (
                  <rect key={`r-${i}`} x="134" y={18 + i * 9} width="6" height="4" rx="0.5" />
                ))}
              </g>
              <rect x="52" y="28" width="56" height="60" rx="3" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
              <rect x="52" y="14" width="56" height="14" rx="1.5" fill="#1e293b" />
              <path d="M58 20h44v2H58zm6 4h32v2H64z" fill="#f59e0b" opacity="0.8" />
              <rect x="62" y="44" width="36" height="34" rx="2" fill="#94a3b8" />
              <text x="80" y="58" fontSize="6.5" fontWeight="bold" fill="#334155" textAnchor="middle">ESP32</text>
              <text x="80" y="68" fontSize="5.5" fill="#475569" textAnchor="middle">WROOM-32</text>
              <rect x="74" y="90" width="12" height="10" rx="1" fill="#334155" />
              <circle cx="44" cy="32" r="2" fill="#ef4444" className="animate-pulse" />
              <circle cx="44" cy="40" r="2" fill="#3b82f6" />
            </svg>
          ) : (
            <svg viewBox="0 0 160 110" className="w-full h-full drop-shadow-xl">
              <rect x="15" y="10" width="130" height="90" rx="6" fill="#0284c7" stroke="#0369a1" strokeWidth="1.5" />
              <g fill="#1e293b">
                <rect x="35" y="14" width="75" height="5" rx="1" />
                <rect x="114" y="14" width="20" height="5" rx="1" />
              </g>
              <g fill="#1e293b">
                <rect x="42" y="91" width="32" height="5" rx="1" />
                <rect x="78" y="91" width="48" height="5" rx="1" />
              </g>
              <rect x="48" y="52" width="68" height="15" rx="1" fill="#1e293b" stroke="#334155" strokeWidth="0.5" />
              <line x1="52" y1="52" x2="52" y2="50" stroke="#cbd5e1" strokeWidth="1" />
              <line x1="112" y1="52" x2="112" y2="50" stroke="#cbd5e1" strokeWidth="1" />
              {Array.from({ length: 14 }).map((_, i) => (
                <rect key={`pin-${i}`} x={52 + i * 4.5} y="51" width="1.5" height="1.5" fill="#cbd5e1" />
              ))}
              <rect x="18" y="24" width="26" height="20" rx="1.5" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
              <rect x="16" y="64" width="24" height="24" rx="2" fill="#1e293b" />
              <rect x="38" y="52" width="6" height="12" rx="2" fill="#94a3b8" />
              <circle cx="120" cy="45" r="1.5" fill="#22c55e" className="animate-pulse" />
              <circle cx="120" cy="52" r="1.5" fill="#ef4444" />
            </svg>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <div className="p-3.5 rounded-xl bg-surface-50 border border-panel-border">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Board Identity</p>
          <h3 className="text-sm font-semibold text-slate-200 mt-1">{board.name}</h3>
          <p className="text-xs font-mono text-primary-400 mt-0.5">{board.fqbn}</p>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-50 border border-panel-border">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-2">Interfaces & Support</p>
          <div className="grid grid-cols-2 gap-2">
            {board.capabilities.map(cap => {
              const capConfig = getCapabilityConfig(cap)
              return (
                <div
                  key={cap}
                  className="
                    flex items-center gap-1.5 p-1.5 rounded-lg
                    bg-surface-100 border border-panel-border/30
                    text-[11px] text-slate-400 font-medium
                  "
                >
                  <span className="text-primary-400 shrink-0">{capConfig.icon}</span>
                  <span className="truncate">{capConfig.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

interface CapConfig {
  label: string
  icon: React.ReactNode
}

function getCapabilityConfig(cap: string): CapConfig {
  switch (cap) {
    case 'DIGITAL_IO':
      return { label: 'Digital I/O', icon: <Cpu size={12} /> }
    case 'ANALOG_IN':
      return { label: 'Analog In', icon: <Zap size={12} /> }
    case 'ANALOG_OUT':
      return { label: 'DAC Out', icon: <Zap size={12} /> }
    case 'PWM':
      return { label: 'PWM Pulse', icon: <Zap size={12} /> }
    case 'I2C':
      return { label: 'I2C Bus', icon: <Cpu size={12} /> }
    case 'SPI':
      return { label: 'SPI Bus', icon: <Cpu size={12} /> }
    case 'UART':
      return { label: 'UART Serial', icon: <Cpu size={12} /> }
    case 'WIFI':
      return { label: 'WiFi (802.11)', icon: <Wifi size={12} /> }
    case 'BLUETOOTH':
      return { label: 'Bluetooth', icon: <Wifi size={12} /> }
    case 'TOUCH':
      return { label: 'Cap Touch', icon: <Cpu size={12} /> }
    default:
      return { label: cap, icon: <Cpu size={12} /> }
  }
}
