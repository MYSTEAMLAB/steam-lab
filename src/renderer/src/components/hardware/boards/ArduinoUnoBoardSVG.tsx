import React from 'react'
import type { BoardConfig } from '@shared/types/board'
import logoUrl from '../../../assets/logo.jpeg'

interface ArduinoUnoBoardSVGProps {
  boardConfig: BoardConfig
}

export const ArduinoUnoBoardSVG: React.FC<ArduinoUnoBoardSVGProps> = ({ boardConfig }) => {
  return (
    <svg 
      width={boardConfig.dimensions.width} 
      height={boardConfig.dimensions.height} 
      viewBox={`0 0 ${boardConfig.dimensions.width} ${boardConfig.dimensions.height}`}
      className="drop-shadow-2xl pointer-events-none"
    >
      {/* Board Base */}
      <rect x="40" y="40" width="540" height="340" rx="20" fill="#0284c7" stroke="#0369a1" strokeWidth="4" />
      
      {/* USB Port */}
      <rect x="0" y="70" width="60" height="90" rx="4" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="3" />
      
      {/* Power Jack */}
      <rect x="0" y="280" width="50" height="80" rx="4" fill="#1e293b" />
      
      {/* Top Female Headers (Digital) */}
      <rect x="180" y="24" width="340" height="24" rx="2" fill="#1e293b" />
      <g fill="#cbd5e1">
        {[208, 228, 248, 268, 288, 308, 348, 368, 388, 408, 428, 448, 468, 488].map((x, i) => (
          <rect key={`dt-${i}`} x={x - 4} y="28" width="8" height="16" />
        ))}
      </g>
      
      {/* Bottom Female Headers (Power & Analog) */}
      <rect x="220" y="372" width="130" height="24" rx="2" fill="#1e293b" />
      <rect x="360" y="372" width="160" height="24" rx="2" fill="#1e293b" />
      <g fill="#cbd5e1">
        {/* Power pins (dummy, not in config) */}
        {[228, 248, 268, 288, 308, 328].map((x, i) => (
          <rect key={`pw-${i}`} x={x - 4} y="376" width="8" height="16" />
        ))}
        {/* Analog pins from config */}
        {[388, 408, 428, 448, 468, 488].map((x, i) => (
          <rect key={`an-${i}`} x={x - 4} y="376" width="8" height="16" />
        ))}
      </g>
      
      {/* Main Microcontroller (ATmega328P) */}
      <rect x="240" y="180" width="220" height="60" rx="6" fill="#1e293b" stroke="#334155" strokeWidth="2" />
      <g fill="#94a3b8">
        {Array.from({ length: 14 }).map((_, i) => (
          <rect key={`ic-t-${i}`} x={250 + i * 14.5} y="170" width="6" height="10" />
        ))}
        {Array.from({ length: 14 }).map((_, i) => (
          <rect key={`ic-b-${i}`} x={250 + i * 14.5} y="240" width="6" height="10" />
        ))}
      </g>
      
      {/* Text Labels */}
      <text x="350" y="140" fontSize="32" fontWeight="bold" fill="#f0f9ff" opacity="0.9" textAnchor="middle">ARDUINO</text>
      <text x="350" y="170" fontSize="20" fill="#bae6fd" opacity="0.8" textAnchor="middle">UNO</text>
      
      {/* RX/TX LEDs */}
      <circle cx="480" cy="180" r="6" fill="#22c55e" opacity="0.8" />
      <circle cx="480" cy="200" r="6" fill="#ef4444" opacity="0.8" />
      <text x="500" y="185" fontSize="12" fill="#f0f9ff">TX</text>
      <text x="500" y="205" fontSize="12" fill="#f0f9ff">RX</text>

      {/* MY STEAM LAB logo sticker */}
      <rect x="70" y="255" width="80" height="80" rx="10" fill="#ffffff" stroke="#0369a1" strokeWidth="1.5" />
      <image href={logoUrl} x="75" y="260" width="70" height="70" />
    </svg>
  )
}
