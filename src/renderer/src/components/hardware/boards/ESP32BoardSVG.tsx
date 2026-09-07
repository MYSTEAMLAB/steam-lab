import React from 'react'
import type { BoardConfig } from '@shared/types/board'
import logoUrl from '../../../assets/logo.jpeg'

interface ESP32BoardSVGProps {
  boardConfig: BoardConfig
}

export const ESP32BoardSVG: React.FC<ESP32BoardSVGProps> = ({ boardConfig }) => {
  const leftPinYs = [148, 168, 188, 208, 228, 248, 268, 288, 308, 328, 348, 388, 408, 428]
  const rightPinYs = [148, 168, 188, 208, 228, 248, 268, 288, 308, 328, 348, 368, 388, 408, 428]

  return (
    <svg
      width={boardConfig.dimensions.width}
      height={boardConfig.dimensions.height}
      viewBox={`0 0 ${boardConfig.dimensions.width} ${boardConfig.dimensions.height}`}
      className="drop-shadow-2xl pointer-events-none"
    >
      <defs>
        <linearGradient id="pcbGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="55%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>
        <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="45%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
        <linearGradient id="chipGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#64748b" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
        <linearGradient id="pinGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id="usbGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
        <radialGradient id="ledGlow" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fca5a5" />
          <stop offset="55%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#b91c1c" />
        </radialGradient>
      </defs>

      {/* Board base — subtle diagonal gradient instead of flat navy for depth */}
      <rect x="60" y="40" width="560" height="380" rx="26" fill="url(#pcbGradient)" stroke="#334155" strokeWidth="2" />
      <rect x="62" y="42" width="556" height="376" rx="24" fill="none" stroke="#1e293b" strokeWidth="1" opacity="0.6" />

      {/* Faint silkscreen grid texture, like real PCB reference marks */}
      <g opacity="0.12" stroke="#93c5fd" strokeWidth="1">
        {[100, 180, 260, 340].map(x => <line key={`v${x}`} x1={x} y1="60" x2={x} y2="440" />)}
      </g>

      {/* USB-C connector at the top edge */}
      <rect x="305" y="24" width="70" height="24" rx="6" fill="url(#usbGradient)" stroke="#1e293b" strokeWidth="1.5" />
      <rect x="315" y="30" width="50" height="12" rx="5" fill="#1e293b" />

      {/* Left pin headers */}
      <g>
        {leftPinYs.map((y, i) => (
          <g key={`l-${i}`}>
            <rect x="38" y={y - 5} width="34" height="10" rx="2.5" fill="url(#pinGradient)" stroke="#92400e" strokeWidth="0.5" />
            <rect x="38" y={y - 5} width="34" height="3" rx="1.5" fill="#fef3c7" opacity="0.5" />
          </g>
        ))}
      </g>

      {/* Right pin headers */}
      <g>
        {rightPinYs.map((y, i) => (
          <g key={`r-${i}`}>
            <rect x="608" y={y - 5} width="34" height="10" rx="2.5" fill="url(#pinGradient)" stroke="#92400e" strokeWidth="0.5" />
            <rect x="608" y={y - 5} width="34" height="3" rx="1.5" fill="#fef3c7" opacity="0.5" />
          </g>
        ))}
      </g>

      {/* ESP32-WROOM module shield can, metallic gradient */}
      <rect x="220" y="110" width="240" height="260" rx="14" fill="url(#shieldGradient)" stroke="#64748b" strokeWidth="2" />
      <rect x="228" y="118" width="224" height="8" rx="4" fill="#f8fafc" opacity="0.6" />

      {/* Antenna — meander PCB trace, closer to a real WROOM module antenna */}
      <rect x="220" y="46" width="240" height="64" rx="8" fill="#0b1220" stroke="#1e293b" strokeWidth="1" />
      <path
        d="M240 62 h190 M240 62 v14 M430 62 v14 M255 76 h160 M255 76 v14 M415 76 v14 M270 90 h130"
        fill="none"
        stroke="#fbbf24"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.9"
      />

      {/* Main chip die inside the shield */}
      <rect x="260" y="180" width="160" height="150" rx="10" fill="url(#chipGradient)" stroke="#1e293b" strokeWidth="2" />
      <rect x="270" y="190" width="140" height="4" rx="2" fill="#94a3b8" opacity="0.6" />

      {/* Text labels */}
      <text x="340" y="245" fontSize="26" fontWeight="700" fill="#f1f5f9" textAnchor="middle" fontFamily="ui-monospace, monospace">ESP32</text>
      <text x="340" y="275" fontSize="18" fill="#cbd5e1" textAnchor="middle" fontFamily="ui-monospace, monospace">WROOM-32</text>

      {/* Small secondary chip below the module */}
      <rect x="315" y="380" width="50" height="40" rx="6" fill="url(#chipGradient)" stroke="#1e293b" strokeWidth="1.5" />

      {/* EN / BOOT buttons, like a real dev board */}
      <circle cx="150" cy="380" r="11" fill="#1e293b" stroke="#475569" strokeWidth="2" />
      <circle cx="150" cy="380" r="4" fill="#64748b" />
      <text x="150" y="405" fontSize="10" fill="#64748b" textAnchor="middle" fontFamily="ui-monospace, monospace">EN</text>

      <circle cx="530" cy="380" r="11" fill="#1e293b" stroke="#475569" strokeWidth="2" />
      <circle cx="530" cy="380" r="4" fill="#64748b" />
      <text x="530" y="405" fontSize="10" fill="#64748b" textAnchor="middle" fontFamily="ui-monospace, monospace">BOOT</text>

      {/* Power/status LEDs with a soft glow instead of flat circles */}
      <circle cx="180" cy="130" r="9" fill="url(#ledGlow)" />
      <circle cx="180" cy="130" r="13" fill="#ef4444" opacity="0.18" />
      <circle cx="180" cy="160" r="9" fill="#60a5fa" />
      <circle cx="180" cy="160" r="13" fill="#3b82f6" opacity="0.18" />

      {/* MY STEAM LAB logo sticker */}
      <rect x="486" y="130" width="90" height="90" rx="10" fill="#ffffff" stroke="#334155" strokeWidth="1.5" />
      <image href={logoUrl} x="491" y="135" width="80" height="80" />
    </svg>
  )
}
