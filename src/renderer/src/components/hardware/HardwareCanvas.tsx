// Interactive Hardware Canvas component for wiring and board rendering
import React, { useState, useRef, useEffect } from 'react'
import { useAppStore } from '@renderer/store/useAppStore'
import { InteractiveBoard } from './InteractiveBoard'
import { boardRegistry } from '@shared/boards'
import { LEDComponent, ButtonComponent, ServoComponent, GenericComponent, LDRComponent, JoystickComponent, BuzzerComponent } from './components/ComponentRenderers'
import { COMPONENT_PIN_OFFSETS } from './components/pinOffsets'
import { PropertiesPanel } from './PropertiesPanel'

export const HardwareCanvas: React.FC = () => {
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  
  // Component Dragging State
  const [draggingDevice, setDraggingDevice] = useState<string | null>(null)

  const lastMouse = useRef({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const el = svgRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      
      const zoomSensitivity = 0.001
      const delta = -e.deltaY * zoomSensitivity
      let newScale = scale * Math.exp(delta)
      newScale = Math.max(0.2, Math.min(newScale, 5)) // clamp between 0.2x and 5x

      // Zoom towards cursor
      const rect = el.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      // Calculate new offsets to keep the mouse point stationary
      const newOffsetX = mouseX - (mouseX - offset.x) * (newScale / scale)
      const newOffsetY = mouseY - (mouseY - offset.y) * (newScale / scale)

      setScale(newScale)
      setOffset({ x: newOffsetX, y: newOffsetY })
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [scale, offset])

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only pan on middle click or if target is the background SVG itself (not a component)
    if (e.button === 1 || (e.target as Element).tagName === 'svg') {
      setIsDragging(true)
      setSelectedItemId(null)
      lastMouse.current = { x: e.clientX, y: e.clientY }
      if (svgRef.current) svgRef.current.setPointerCapture(e.pointerId)
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect()
      const dropX = e.clientX - rect.left
      const dropY = e.clientY - rect.top
      
      // Handle component dragging
      if (draggingDevice) {
        updateDevicePosition(
          draggingDevice,
          (dropX - offset.x) / scale,
          (dropY - offset.y) / scale
        )
        return
      }
    }

    if (!isDragging) return
    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y
    lastMouse.current = { x: e.clientX, y: e.clientY }
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }))
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false)
    setDraggingDevice(null)
    if (svgRef.current) svgRef.current.releasePointerCapture(e.pointerId)
  }

  // Calculate grid pattern scaling
  const gridSize = 40 * scale
  const gridOffsetX = offset.x % gridSize
  const gridOffsetY = offset.y % gridSize

  const selectedBoard = useAppStore(s => s.selectedBoard)
  const fullBoardConfig = selectedBoard ? boardRegistry.getConfig(selectedBoard.id) : null
  const pinMap = selectedBoard ? boardRegistry.getPinMap(selectedBoard.id) : null
  const addDevice = useAppStore(s => s.addDevice)
  const placedDevices = useAppStore(s => s.selectedBoard ? (s.boardLayouts[s.selectedBoard.id]?.devices || []) : [])
  const updateDevicePosition = useAppStore(s => s.updateDevicePosition)
  const setSelectedItemId = useAppStore(s => s.setSelectedItemId)
  const autoWireUnassignedDevices = useAppStore(s => s.autoWireUnassignedDevices)

  useEffect(() => {
    // Run auto-wiring on mount to catch any legacy or unassigned components
    autoWireUnassignedDevices()
  }, [autoWireUnassignedDevices])

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const compType = e.dataTransfer.getData('application/edublocks-component')
    if (!compType || !svgRef.current) return

    const rect = svgRef.current.getBoundingClientRect()
    const dropX = e.clientX - rect.left
    const dropY = e.clientY - rect.top
    const svgX = (dropX - offset.x) / scale
    const svgY = (dropY - offset.y) / scale

    addDevice({
      id: `dev_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: compType,
      mappedPin: '',
      canvasX: svgX,
      canvasY: svgY
    })
  }

  return (
    <div className="absolute inset-0 w-full h-full bg-surface-DEFAULT overflow-hidden select-none">
      <svg
        ref={svgRef}
        className="w-full h-full touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={handleContextMenu}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <defs>
          <pattern
            id="canvas-grid"
            width={gridSize}
            height={gridSize}
            patternUnits="userSpaceOnUse"
            x={gridOffsetX}
            y={gridOffsetY}
          >
            <circle cx="2" cy="2" r="1" fill="#334155" opacity={0.5} />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#canvas-grid)" />

        <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}>
          {/* Board will render here, centered or offset */}
          <g transform="translate(100, 100)">
            <InteractiveBoard 
              boardConfig={fullBoardConfig}
              onPinClick={() => {}}
              activeWireSource={null}
            />
          </g>
          
          {/* Auto Wires */}
          {placedDevices.flatMap(device => {
            const mappedPins: string[] = []
            if (typeof device.mappedPin === 'string' && device.mappedPin) {
              mappedPins.push(device.mappedPin)
            } else if (typeof device.mappedPin === 'object' && device.mappedPin) {
              Object.values(device.mappedPin).forEach(p => { if (typeof p === 'string' && p) mappedPins.push(p) })
            }
            
            if (mappedPins.length === 0 || !fullBoardConfig) return []

            return mappedPins.map((pinStr, idx) => {
              // 1. Board Pin Coordinate
              const boardPinCoord = fullBoardConfig.pinCoordinates[pinStr]
              if (!boardPinCoord) return null
              const p1 = { x: boardPinCoord.x + 100, y: boardPinCoord.y + 100 }

              // 2. Component Pin Coordinate
              const getPrimaryPinName = (type: string) => {
                if (type === 'led') return 'Anode'
                if (type === 'button') return '1A'
                if (type === 'servo') return 'PWM'
                return '1'
              }
              const pinName = getPrimaryPinName(device.type)
              const offsetCoord = COMPONENT_PIN_OFFSETS[device.type]?.[pinName] || COMPONENT_PIN_OFFSETS.generic['1'] || { x: 0, y: 0 }
              const p2 = { x: device.canvasX + offsetCoord.x + (idx * 5), y: device.canvasY + offsetCoord.y + (idx * 5) }

              // 3. Bezier curve control points
              const dx = Math.abs(p2.x - p1.x)
              const dy = Math.abs(p2.y - p1.y)
              const tension = Math.max(dx, dy) * 0.4
              const cx1 = p1.x
              const cy1 = p1.y + tension
              const cx2 = p2.x
              const cy2 = p2.y - tension

              return (
                <path 
                  key={`wire_${device.id}_${pinStr}`}
                  d={`M ${p1.x},${p1.y} C ${cx1},${cy1} ${cx2},${cy2} ${p2.x},${p2.y}`} 
                  fill="none" 
                  stroke="#38bdf8" 
                  strokeWidth="3" 
                  className="drop-shadow-md opacity-80"
                />
              )
            })
          })}
          
          {/* Components will render here */}
          {placedDevices.map(device => {
            let Renderer = GenericComponent
            if (device.type === 'led') Renderer = LEDComponent
            if (device.type === 'button') Renderer = ButtonComponent
            if (device.type === 'servo') Renderer = ServoComponent
            if (device.type === 'ldr') Renderer = LDRComponent
            if (device.type === 'joystick') Renderer = JoystickComponent
            if (device.type === 'buzzer') Renderer = BuzzerComponent

            const mappedPins: string[] = []
            if (typeof device.mappedPin === 'string' && device.mappedPin) {
              mappedPins.push(device.mappedPin)
            } else if (typeof device.mappedPin === 'object' && device.mappedPin) {
              Object.values(device.mappedPin).forEach(p => { if (typeof p === 'string' && p) mappedPins.push(p) })
            }
            const displayPinText = mappedPins.join(' | ')
            
            return (
              <g 
                key={device.id} 
                transform={`translate(${device.canvasX}, ${device.canvasY})`}
                onClick={(e) => { e.stopPropagation(); setSelectedItemId(device.id) }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  setSelectedItemId(device.id)
                  setDraggingDevice(device.id)
                  if (svgRef.current) svgRef.current.setPointerCapture(e.pointerId)
                }}
                className={`cursor-grab active:cursor-grabbing hover:drop-shadow-[0_0_12px_rgba(56,189,248,0.5)] transition-all ${draggingDevice === device.id ? 'opacity-80' : ''}`}
              >
                <Renderer 
                  device={device} 
                  onPinClick={() => {}}
                  activeWireSource={null}
                />
                
                {/* Floating Pin Badge */}
                {displayPinText && (
                  <g transform="translate(-35, -40)" className="pointer-events-none">
                    <rect 
                      x="0" y="0" 
                      width={displayPinText.length * 7 + 16} 
                      height="22" 
                      rx="11" 
                      fill="rgba(15, 23, 42, 0.7)" 
                      stroke="rgba(56, 189, 248, 0.4)" 
                      strokeWidth="1"
                      className="backdrop-blur-sm shadow-xl"
                    />
                    <text 
                      x="8" y="15" 
                      fontSize="10" 
                      fontWeight="bold"
                      className="fill-primary-400 font-mono tracking-wide"
                    >
                      {displayPinText}
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </g>
      </svg>
      
      <PropertiesPanel />
      
      {/* Zoom controls UI overlay */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2">
        <button
          onClick={() => setScale(s => Math.min(5, s * 1.2))}
          className="w-8 h-8 rounded-lg bg-surface-100 border border-panel-border flex items-center justify-center text-slate-300 hover:bg-surface-200"
        >
          +
        </button>
        <button
          onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }) }}
          className="w-8 h-8 rounded-lg bg-surface-100 border border-panel-border flex items-center justify-center text-slate-300 hover:bg-surface-200"
        >
          •
        </button>
        <button
          onClick={() => setScale(s => Math.max(0.2, s / 1.2))}
          className="w-8 h-8 rounded-lg bg-surface-100 border border-panel-border flex items-center justify-center text-slate-300 hover:bg-surface-200"
        >
          -
        </button>
      </div>
    </div>
  )
}
