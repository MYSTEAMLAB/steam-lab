import React from 'react'
import { ESP32BoardSVG } from './boards/ESP32BoardSVG'
import { ArduinoUnoBoardSVG } from './boards/ArduinoUnoBoardSVG'
import type { BoardConfig, PinCoordinate } from '@shared/types/board'

interface InteractiveBoardProps {
  boardConfig: BoardConfig | null
  onPinClick: (pinName: string, coordinate: PinCoordinate) => void
  activeWireSource: string | null
}

export const InteractiveBoard: React.FC<InteractiveBoardProps> = ({ 
  boardConfig,
  onPinClick,
  activeWireSource
}) => {
  if (!boardConfig) return null

  const isEsp32 = boardConfig.id === 'esp32'
  
  return (
    <g className="board-group" transform="translate(0, 0)">
      {/* 1. Render the static Board SVG Background */}
      {isEsp32 ? (
        <ESP32BoardSVG boardConfig={boardConfig} />
      ) : (
        <ArduinoUnoBoardSVG boardConfig={boardConfig} />
      )}

      {/* 2. Overlay Interactive Pin Hitboxes */}
      {Object.entries(boardConfig.pinCoordinates).map(([pinName, coord]) => {
        const isActive = activeWireSource === pinName
        
        return (
          <g 
            key={pinName}
            transform={`translate(${coord.x}, ${coord.y})`}
            className="cursor-pointer group"
            onClick={(e) => {
              e.stopPropagation()
              onPinClick(pinName, coord)
            }}
          >
            {/* Hitbox circle - larger for easy clicking */}
            <circle 
              r="12" 
              fill="transparent" 
              className="hover:fill-primary-500/20 transition-colors"
            />
            {/* Visual Pin Center */}
            <circle 
              r="4" 
              className={`
                transition-all duration-200
                ${isActive ? 'fill-primary-400 scale-125 shadow-[0_0_8px_#38bdf8]' : 'fill-slate-300 group-hover:fill-white group-hover:scale-110'}
              `} 
            />
            
            {/* Tooltip Label */}
            <rect 
              x="16" 
              y="-10" 
              width={pinName.length * 8 + 12} 
              height="20" 
              rx="4"
              className="fill-surface-100 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
            />
            <text 
              x="22" 
              y="4" 
              fontSize="12" 
              className="fill-slate-200 font-mono opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
            >
              {pinName}
            </text>
          </g>
        )
      })}
    </g>
  )
}
