import React from 'react'
import type { PlacedDevice } from '@shared/types/project'

interface ComponentProps {
  device: PlacedDevice
  onPinClick: (pinName: string, x: number, y: number) => void
  activeWireSource: string | null
}

const Hitbox: React.FC<{
  x: number
  y: number
  name: string
  isActive: boolean
  onClick: (name: string, x: number, y: number) => void
}> = ({ x, y, name, isActive, onClick }) => (
  <g 
    transform={`translate(${x}, ${y})`} 
    className="cursor-pointer group"
    onClick={(e) => { e.stopPropagation(); onClick(name, x, y) }}
  >
    <circle r="12" fill="transparent" className="hover:fill-primary-500/20" />
    <circle 
      r="4" 
      className={`transition-all ${isActive ? 'fill-primary-400 scale-125' : 'fill-slate-400 group-hover:fill-white'}`} 
    />
    <rect x="10" y="-10" width={name.length * 8 + 10} height="20" rx="4" className="fill-surface-100 opacity-0 group-hover:opacity-100 pointer-events-none" />
    <text x="15" y="4" fontSize="10" className="fill-slate-200 opacity-0 group-hover:opacity-100 pointer-events-none">{name}</text>
  </g>
)

export const LEDComponent: React.FC<ComponentProps> = ({ device, onPinClick, activeWireSource }) => {
  const color = '#ef4444'
  return (
    <g>
      {/* LED Bulb */}
      <path d="M -15,0 A 15,15 0 0,1 15,0 L 15,10 L -15,10 Z" fill={color} stroke="#b91c1c" strokeWidth="2" />
      <rect x="-18" y="10" width="36" height="4" fill="#991b1b" />
      
      {/* Single Leg */}
      <rect x="-2" y="14" width="4" height="25" fill="#94a3b8" />
      
      {/* Pin Hitbox */}
      <Hitbox x={0} y={39} name="Signal" isActive={activeWireSource === `${device.id}:Anode`} onClick={(n) => onPinClick(`${device.id}:Anode`, 0, 39)} />
    </g>
  )
}

export const BuzzerComponent: React.FC<ComponentProps> = ({ device, onPinClick, activeWireSource }) => {
  return (
    <g>
      <rect x="-16" y="-16" width="32" height="32" rx="16" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
      <circle cx="0" cy="0" r="6" fill="#334155" />
      <text y="-20" fontSize="10" fill="#94a3b8" textAnchor="middle">Buzzer</text>
      
      {/* Single Leg */}
      <rect x="-2" y="16" width="4" height="15" fill="#94a3b8" />
      
      {/* Pin Hitbox */}
      <Hitbox x={0} y={31} name="Signal" isActive={activeWireSource === `${device.id}:1`} onClick={(n) => onPinClick(`${device.id}:1`, 0, 31)} />
    </g>
  )
}

export const ButtonComponent: React.FC<ComponentProps> = ({ device, onPinClick, activeWireSource }) => {
  return (
    <g>
      <rect x="-20" y="-20" width="40" height="40" rx="4" fill="#1e293b" stroke="#334155" strokeWidth="2" />
      <circle cx="0" cy="0" r="12" fill="#ef4444" stroke="#b91c1c" strokeWidth="2" />
      
      {/* Legs */}
      <rect x="-28" y="-14" width="8" height="6" fill="#94a3b8" />
      <rect x="-28" y="8" width="8" height="6" fill="#94a3b8" />
      <rect x="20" y="-14" width="8" height="6" fill="#94a3b8" />
      <rect x="20" y="8" width="8" height="6" fill="#94a3b8" />
      
      {/* Hitboxes */}
      <Hitbox x={-28} y={-11} name="Pin 1A" isActive={activeWireSource === `${device.id}:1A`} onClick={(n) => onPinClick(`${device.id}:1A`, -28, -11)} />
      <Hitbox x={-28} y={11} name="Pin 2A" isActive={activeWireSource === `${device.id}:2A`} onClick={(n) => onPinClick(`${device.id}:2A`, -28, 11)} />
      <Hitbox x={28} y={-11} name="Pin 1B" isActive={activeWireSource === `${device.id}:1B`} onClick={(n) => onPinClick(`${device.id}:1B`, 28, -11)} />
      <Hitbox x={28} y={11} name="Pin 2B" isActive={activeWireSource === `${device.id}:2B`} onClick={(n) => onPinClick(`${device.id}:2B`, 28, 11)} />
    </g>
  )
}

export const ServoComponent: React.FC<ComponentProps> = ({ device, onPinClick, activeWireSource }) => {
  return (
    <g>
      <rect x="-24" y="-30" width="48" height="60" rx="2" fill="#2563eb" stroke="#1d4ed8" strokeWidth="2" />
      <rect x="-30" y="-10" width="60" height="12" rx="1" fill="#1e3a8a" />
      <circle cx="0" cy="-14" r="14" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
      <circle cx="0" cy="-14" r="4" fill="#94a3b8" />
      
      {/* Wires */}
      <path d="M 0,30 Q 0,40 -10,40 L -20,40" fill="none" stroke="#f59e0b" strokeWidth="3" />
      <path d="M 4,30 Q 4,45 -10,45 L -20,45" fill="none" stroke="#ef4444" strokeWidth="3" />
      <path d="M 8,30 Q 8,50 -10,50 L -20,50" fill="none" stroke="#64748b" strokeWidth="3" />
      
      {/* Hitboxes */}
      <Hitbox x={-20} y={40} name="PWM" isActive={activeWireSource === `${device.id}:PWM`} onClick={(n) => onPinClick(`${device.id}:PWM`, -20, 40)} />
      <Hitbox x={-20} y={45} name="VCC" isActive={activeWireSource === `${device.id}:VCC`} onClick={(n) => onPinClick(`${device.id}:VCC`, -20, 45)} />
      <Hitbox x={-20} y={50} name="GND" isActive={activeWireSource === `${device.id}:GND`} onClick={(n) => onPinClick(`${device.id}:GND`, -20, 50)} />
    </g>
  )
}

export const GenericComponent: React.FC<ComponentProps> = ({ device, onPinClick, activeWireSource }) => {
  return (
    <g>
      <rect x="-20" y="-20" width="40" height="40" rx="4" fill="#475569" stroke="#334155" strokeWidth="2" />
      <text y="4" fontSize="10" fill="white" textAnchor="middle">{device.type}</text>
      
      <rect x="-10" y="20" width="4" height="10" fill="#94a3b8" />
      <rect x="6" y="20" width="4" height="10" fill="#94a3b8" />
      
      <Hitbox x={-8} y={30} name="Pin 1" isActive={activeWireSource === `${device.id}:1`} onClick={(n) => onPinClick(`${device.id}:1`, -8, 30)} />
      <Hitbox x={8} y={30} name="Pin 2" isActive={activeWireSource === `${device.id}:2`} onClick={(n) => onPinClick(`${device.id}:2`, 8, 30)} />
    </g>
  )
}


export const LDRComponent: React.FC<ComponentProps> = ({ device, onPinClick, activeWireSource }) => {
  return (
    <g>
      <rect x="-12" y="-12" width="24" height="24" rx="12" fill="#f59e0b" stroke="#d97706" strokeWidth="2" />
      <path d="M -8,0 Q 0,-8 8,0 T -8,8" fill="none" stroke="#78350f" strokeWidth="1.5" />
      <rect x="-6" y="12" width="4" height="15" fill="#94a3b8" />
      <rect x="2" y="12" width="4" height="15" fill="#94a3b8" />
      
      <Hitbox x={-4} y={27} name="Pin 1" isActive={activeWireSource === `${device.id}:1`} onClick={(n) => onPinClick(`${device.id}:1`, -4, 27)} />
      <Hitbox x={4} y={27} name="Pin 2" isActive={activeWireSource === `${device.id}:2`} onClick={(n) => onPinClick(`${device.id}:2`, 4, 27)} />
    </g>
  )
}


export const JoystickComponent: React.FC<ComponentProps> = ({ device, onPinClick, activeWireSource }) => {
  return (
    <g>
      <rect x="-24" y="-24" width="48" height="48" rx="4" fill="#334155" stroke="#1e293b" strokeWidth="2" />
      <circle cx="0" cy="0" r="16" fill="#10b981" stroke="#047857" strokeWidth="2" />
      
      {/* Pins */}
      <rect x="-16" y="24" width="4" height="12" fill="#94a3b8" />
      <rect x="-8" y="24" width="4" height="12" fill="#94a3b8" />
      <rect x="0" y="24" width="4" height="12" fill="#94a3b8" />
      <rect x="8" y="24" width="4" height="12" fill="#94a3b8" />
      <rect x="16" y="24" width="4" height="12" fill="#94a3b8" />
      
      <Hitbox x={-14} y={34} name="GND" isActive={activeWireSource === `${device.id}:GND`} onClick={(n) => onPinClick(`${device.id}:GND`, -14, 34)} />
      <Hitbox x={-6} y={34} name="5V" isActive={activeWireSource === `${device.id}:5V`} onClick={(n) => onPinClick(`${device.id}:5V`, -6, 34)} />
      <Hitbox x={2} y={34} name="VRx" isActive={activeWireSource === `${device.id}:vrx`} onClick={(n) => onPinClick(`${device.id}:vrx`, 2, 34)} />
      <Hitbox x={10} y={34} name="VRy" isActive={activeWireSource === `${device.id}:vry`} onClick={(n) => onPinClick(`${device.id}:vry`, 10, 34)} />
      <Hitbox x={18} y={34} name="SW" isActive={activeWireSource === `${device.id}:SW`} onClick={(n) => onPinClick(`${device.id}:SW`, 18, 34)} />
    </g>
  )
}
