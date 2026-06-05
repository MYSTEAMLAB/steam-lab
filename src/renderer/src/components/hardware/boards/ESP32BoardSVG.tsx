import React from 'react'
import type { BoardConfig } from '@shared/types/board'

interface ESP32BoardSVGProps {
  boardConfig: BoardConfig
}

export const ESP32BoardSVG: React.FC<ESP32BoardSVGProps> = ({ boardConfig }) => {
  return (
    <svg 
      width={boardConfig.dimensions.width} 
      height={boardConfig.dimensions.height} 
      viewBox={`0 0 ${boardConfig.dimensions.width} ${boardConfig.dimensions.height}`}
      className="drop-shadow-2xl pointer-events-none"
    >
      {/* Board Base */}
      <rect x="60" y="40" width="560" height="380" rx="24" fill="#0f172a" stroke="#334155" strokeWidth="4" />
      
      {/* Left Pins (Gold contacts) */}
      <g fill="#eab308">
        {[148, 168, 188, 208, 228, 248, 268, 288, 308, 328, 348, 388, 408, 428].map((y, i) => (
          <rect key={`l-${i}`} x="40" y={y - 4} width="32" height="8" rx="2" />
        ))}
      </g>
      
      {/* Right Pins (Gold contacts) */}
      <g fill="#eab308">
        {[148, 168, 188, 208, 228, 248, 268, 288, 308, 328, 348, 368, 388, 408, 428].map((y, i) => (
          <rect key={`r-${i}`} x="608" y={y - 4} width="32" height="8" rx="2" />
        ))}
      </g>
      
      {/* ESP32 WROOM Module Shield */}
      <rect x="220" y="110" width="240" height="260" rx="12" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="3" />
      
      {/* Antenna Trace Area */}
      <rect x="220" y="50" width="240" height="60" rx="6" fill="#1e293b" />
      <path d="M245 75h190v8H245zm25 16h140v8H270z" fill="#f59e0b" opacity="0.8" />
      
      {/* Main Chip inside Shield */}
      <rect x="260" y="180" width="160" height="150" rx="8" fill="#94a3b8" />
      
      {/* Text Labels */}
      <text x="340" y="240" fontSize="28" fontWeight="bold" fill="#334155" textAnchor="middle">ESP32</text>
      <text x="340" y="280" fontSize="24" fill="#475569" textAnchor="middle">WROOM-32</text>
      
      {/* ESP Logo / Misc Chips */}
      <rect x="315" y="380" width="50" height="40" rx="4" fill="#334155" />
      <circle cx="180" cy="130" r="8" fill="#ef4444" opacity="0.8" />
      <circle cx="180" cy="160" r="8" fill="#3b82f6" opacity="0.8" />
    </svg>
  )
}
