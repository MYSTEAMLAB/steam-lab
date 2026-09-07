import React from 'react'
import { ESP32BoardSVG } from './boards/ESP32BoardSVG'
import { ArduinoUnoBoardSVG } from './boards/ArduinoUnoBoardSVG'
import { AIJuniorBoardSVG } from './boards/AIJuniorBoardSVG'
import type { BoardConfig, PinCoordinate } from '@shared/types/board'

interface InteractiveBoardProps {
  boardConfig: BoardConfig | null
  onPinClick: (pinName: string, coordinate: PinCoordinate) => void
  activeWireSource: string | null
  /** Starts a board-drag when the user grabs the PCB itself (not a pin or a
   *  placed component). Omit to render the board fixed in place. */
  onBoardPointerDown?: (e: React.PointerEvent) => void
}

export const InteractiveBoard: React.FC<InteractiveBoardProps> = ({
  boardConfig,
  onPinClick,
  activeWireSource,
  onBoardPointerDown
}) => {
  if (!boardConfig) return null

  const isEsp32 = boardConfig.id === 'esp32'
  const isAiJunior = boardConfig.id === 'ai-junior'

  return (
    <g className="board-group" transform="translate(0, 0)">
      {/* 0. Drag handle — a transparent hit-area the exact size of the board.
          Sits underneath the board art (which is pointer-events-none) and
          below the pin hitboxes (rendered after, so on top), so grabbing the
          PCB body moves it while pins/components remain independently
          clickable. */}
      {onBoardPointerDown && (
        <rect
          x="0"
          y="0"
          width={boardConfig.dimensions.width}
          height={boardConfig.dimensions.height}
          fill="transparent"
          className="cursor-grab active:cursor-grabbing"
          onPointerDown={onBoardPointerDown}
        />
      )}

      {/* 1. Render the static Board SVG Background */}
      {isAiJunior ? (
        <AIJuniorBoardSVG boardConfig={boardConfig} />
      ) : isEsp32 ? (
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
