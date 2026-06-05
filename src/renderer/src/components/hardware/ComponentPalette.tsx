import React from 'react'

const AVAILABLE_COMPONENTS = [
  { id: 'led', name: 'LED (Red)', type: 'output', color: '#ef4444' },
  { id: 'button', name: 'Push Button', type: 'input', color: '#3b82f6' },
  { id: 'buzzer', name: 'Buzzer', type: 'output', color: '#000000' },
  { id: 'potentiometer', name: 'Potentiometer', type: 'input', color: '#1e293b' },
  { id: 'ldr', name: 'Photoresistor (LDR)', type: 'input', color: '#f59e0b' },
  { id: 'temp', name: 'Temp Sensor (TMP36)', type: 'input', color: '#64748b' },
  { id: 'servo', name: 'Servo Motor', type: 'output', color: '#2563eb' },
  { id: 'ir', name: 'IR Sensor', type: 'input', color: '#1e293b' },
  { id: 'touch', name: 'Touch Sensor (ESP32)', type: 'input', color: '#64748b' },
  { id: 'dht11', name: 'DHT11 Temp/Humidity', type: 'input', color: '#38bdf8' },
  { id: 'ultrasonic', name: 'Ultrasonic (HC-SR04)', type: 'input', color: '#94a3b8' },
  { id: 'joystick', name: 'Analog Joystick', type: 'input', color: '#10b981' },
  { id: 'dcmotor', name: 'DC Motor', type: 'output', color: '#eab308' },
  { id: 'motor_driver', name: '4 Motor Driver', type: 'output', color: '#dc2626' },
  { id: 'bluetooth', name: 'Bluetooth (HC-05)', type: 'communication', color: '#2563eb' },
  { id: 'oled', name: 'OLED SSD1306', type: 'display', color: '#0f172a' }
]

export const ComponentPalette: React.FC = () => {
  const handleDragStart = (e: React.DragEvent, componentId: string) => {
    e.dataTransfer.setData('application/edublocks-component', componentId)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div className="flex flex-col h-full bg-surface-50 p-4">
      <h3 className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-4">
        Component Library
      </h3>
      <div className="flex-1 overflow-y-auto space-y-2">
        {AVAILABLE_COMPONENTS.map(comp => (
          <div
            key={comp.id}
            draggable
            onDragStart={(e) => handleDragStart(e, comp.id)}
            className="
              flex items-center gap-3 p-3 rounded-xl 
              bg-surface-100 border border-panel-border
              cursor-grab hover:bg-surface-200 transition-colors
              active:cursor-grabbing
            "
          >
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-white/10"
              style={{ backgroundColor: comp.color }}
            >
              <div className="w-4 h-4 bg-white/20 rounded-sm" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-300">{comp.name}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">{comp.type}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 p-3 bg-primary-500/10 border border-primary-500/20 rounded-xl">
        <p className="text-[10px] text-primary-400 font-medium leading-relaxed">
          Drag components onto the hardware canvas to place them.
        </p>
      </div>
    </div>
  )
}
