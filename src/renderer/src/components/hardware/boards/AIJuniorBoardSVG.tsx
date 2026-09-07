import React from 'react'
import type { BoardConfig } from '@shared/types/board'
import logoUrl from '../../../assets/logo.jpeg'

interface AIJuniorBoardSVGProps {
  boardConfig: BoardConfig
}

// The carrier PCB only — matches the real "Navneet ESP32 MIC RGB 6x6 Matrix"
// board photo/schematic the user provided: blue PCB, I2C + UART headers and
// M1/M2 motor terminals on the left edge, three open sensor jacks on the
// right edge, GND/VIN+ pads and a bottom USB-C connector, four corner
// mounting holes. The LED matrix, mic, buttons, buzzer, and motors
// themselves are rendered as their own seeded PlacedDevices on top of this
// (see AI_JUNIOR_FIXED_DEVICES in useAppStore.ts), positioned to line up
// with where they actually sit on the real board.
export const AIJuniorBoardSVG: React.FC<AIJuniorBoardSVGProps> = ({ boardConfig }) => {
  const leftHeader1 = ['SDA', 'SCL', 'GND', '5V']
  const leftHeader2 = ['GND', 'RX1', 'TX1', '5V']

  return (
    <svg
      width={boardConfig.dimensions.width}
      height={boardConfig.dimensions.height}
      viewBox={`0 0 ${boardConfig.dimensions.width} ${boardConfig.dimensions.height}`}
      className="drop-shadow-2xl pointer-events-none"
    >
      <defs>
        <linearGradient id="ajPcbGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1d5fd6" />
          <stop offset="55%" stopColor="#1450b8" />
          <stop offset="100%" stopColor="#0c3a8c" />
        </linearGradient>
        <radialGradient id="ajHoleGradient" cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#94a3b8" />
        </radialGradient>
        <linearGradient id="ajUsbGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
      </defs>

      {/* Carrier PCB base */}
      <rect x="30" y="15" width="620" height="430" rx="20" fill="url(#ajPcbGradient)" stroke="#0b2f70" strokeWidth="2" />

      {/* Corner mounting holes */}
      {[[56, 39], [624, 39], [56, 421], [624, 421]].map(([cx, cy]) => (
        <g key={`${cx}-${cy}`}>
          <circle cx={cx} cy={cy} r="9" fill="url(#ajHoleGradient)" stroke="#334155" strokeWidth="1" />
          <circle cx={cx} cy={cy} r="4" fill="#0c3a8c" />
        </g>
      ))}

      {/* Left header 1 — OLED I2C header (SDA=GPIO21, SCL=GPIO22; GND/5V are
          cosmetic power pins). Wireable — see pinCoordinates in board-config.json. */}
      {leftHeader1.map((label, i) => (
        <g key={`h1-${label}`}>
          <circle cx="54" cy={70 + i * 20} r="3.5" fill="#fde68a" stroke="#92400e" strokeWidth="0.5" />
          <text x="66" y={70 + i * 20 + 4} fontSize="10" fill="#dbeafe" fontFamily="ui-monospace, monospace">{label}</text>
        </g>
      ))}

      {/* Left header 2 — UART */}
      {leftHeader2.map((label, i) => (
        <g key={`h2-${label}`}>
          <circle cx="54" cy={160 + i * 20} r="3.5" fill="#fde68a" stroke="#92400e" strokeWidth="0.5" />
          <text x="66" y={160 + i * 20 + 4} fontSize="10" fill="#dbeafe" fontFamily="ui-monospace, monospace">{label}</text>
        </g>
      ))}

      {/* M1 / M2 motor screw terminals */}
      <text x="42" y="256" fontSize="11" fontWeight="700" fill="#bfdbfe" fontFamily="ui-monospace, monospace">M1</text>
      <rect x="42" y="262" width="24" height="16" rx="2" fill="#15803d" stroke="#052e16" strokeWidth="1" />
      <circle cx="49" cy="270" r="2" fill="#0b1220" />
      <circle cx="59" cy="270" r="2" fill="#0b1220" />

      <text x="42" y="300" fontSize="11" fontWeight="700" fill="#bfdbfe" fontFamily="ui-monospace, monospace">M2</text>
      <rect x="42" y="306" width="24" height="16" rx="2" fill="#15803d" stroke="#052e16" strokeWidth="1" />
      <circle cx="49" cy="314" r="2" fill="#0b1220" />
      <circle cx="59" cy="314" r="2" fill="#0b1220" />

      {/* GND / VIN+ power pads, bottom-left */}
      <circle cx="54" cy="360" r="4" fill="#fde68a" stroke="#92400e" strokeWidth="0.5" />
      <text x="66" y="364" fontSize="10" fill="#dbeafe" fontFamily="ui-monospace, monospace">GND</text>
      <circle cx="54" cy="384" r="4" fill="#fde68a" stroke="#92400e" strokeWidth="0.5" />
      <text x="66" y="388" fontSize="10" fill="#dbeafe" fontFamily="ui-monospace, monospace">VIN+</text>

      {/* Right side — open analog sensor jacks J3/J4/J5 (interactive dots for
          the actual GPIO pins are overlaid generically by InteractiveBoard
          from boardConfig.pinCoordinates; these are the cosmetic flanking
          GND/3V3 pins + jack labels) */}
      {[
        { y: 90, label: 'J3' },
        { y: 190, label: 'J4' },
        { y: 290, label: 'J5' }
      ].map(({ y, label }) => (
        <g key={label}>
          <circle cx="626" cy={y - 14} r="3" fill="#fde68a" stroke="#92400e" strokeWidth="0.5" />
          <text x="560" y={y - 11} fontSize="9" fill="#93c5fd" textAnchor="end" fontFamily="ui-monospace, monospace">GND</text>
          <circle cx="626" cy={y + 14} r="3" fill="#fde68a" stroke="#92400e" strokeWidth="0.5" />
          <text x="560" y={y + 17} fontSize="9" fill="#93c5fd" textAnchor="end" fontFamily="ui-monospace, monospace">3V3</text>
          <text x="600" y={y + 5} fontSize="11" fontWeight="700" fill="#bfdbfe" textAnchor="end" fontFamily="ui-monospace, monospace">{label}</text>
        </g>
      ))}

      {/* Right side — dedicated Ultrasonic header (TX/TRIG=GPIO16, RX/ECHO=GPIO4) */}
      <circle cx="626" cy="370" r="3" fill="#fde68a" stroke="#92400e" strokeWidth="0.5" />
      <text x="560" y="373" fontSize="9" fill="#93c5fd" textAnchor="end" fontFamily="ui-monospace, monospace">TX</text>
      <circle cx="626" cy="390" r="3" fill="#fde68a" stroke="#92400e" strokeWidth="0.5" />
      <text x="560" y="393" fontSize="9" fill="#93c5fd" textAnchor="end" fontFamily="ui-monospace, monospace">RX</text>
      <text x="600" y="384" fontSize="10" fontWeight="700" fill="#bfdbfe" textAnchor="end" fontFamily="ui-monospace, monospace">ULTRASONIC</text>

      {/* USB-C connector, bottom edge */}
      <rect x="310" y="426" width="60" height="22" rx="6" fill="url(#ajUsbGradient)" stroke="#1e293b" strokeWidth="1.5" />
      <rect x="320" y="432" width="40" height="10" rx="4" fill="#1e293b" />

      {/* Board identity silkscreen */}
      <text x="340" y="40" fontSize="12" fontWeight="700" fill="#bfdbfe" textAnchor="middle" fontFamily="ui-monospace, monospace">
        AI JUNIOR — MIC RGB 6×6 MATRIX
      </text>

      {/* MY STEAM LAB logo sticker */}
      <rect x="475" y="345" width="84" height="84" rx="10" fill="#ffffff" stroke="#0b2f70" strokeWidth="1.5" />
      <image href={logoUrl} x="480" y="350" width="74" height="74" />
    </svg>
  )
}
