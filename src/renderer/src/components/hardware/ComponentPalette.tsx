import React, { useMemo, useRef, useState } from 'react'
import {
  Lightbulb, CircleDot, Volume2, Disc3, Sun, Thermometer, RotateCw,
  Radar, Waves, Hand, Move, Fan, Grid3x3, Monitor, Search, MousePointerClick, Check, Palette
} from 'lucide-react'
import { useAppStore } from '@renderer/store/useAppStore'
import { useT } from '@renderer/lib/i18n/useT'
import type { TranslationKey } from '@renderer/lib/i18n/translations'

interface ComponentDef {
  id: string
  name: string
  category: 'Outputs' | 'Sensors & Inputs' | 'Displays'
  icon: React.ComponentType<{ size?: number; className?: string }>
  accent: string // tailwind bg-* class for the icon chip
}

const COMPONENTS: ComponentDef[] = [
  { id: 'led', name: 'LED (Red)', category: 'Outputs', icon: Lightbulb, accent: 'bg-red-500' },
  { id: 'buzzer', name: 'Buzzer', category: 'Outputs', icon: Volume2, accent: 'bg-amber-500' },
  { id: 'servo', name: 'Servo Motor', category: 'Outputs', icon: RotateCw, accent: 'bg-blue-500' },
  { id: 'dcmotor', name: 'DC Motor', category: 'Outputs', icon: Fan, accent: 'bg-violet-500' },
  { id: 'motor_driver', name: '4 Motor Driver', category: 'Outputs', icon: Grid3x3, accent: 'bg-rose-600' },

  { id: 'button', name: 'Push Button', category: 'Sensors & Inputs', icon: CircleDot, accent: 'bg-slate-500' },
  { id: 'potentiometer', name: 'Potentiometer', category: 'Sensors & Inputs', icon: Disc3, accent: 'bg-slate-700' },
  { id: 'ldr', name: 'Photoresistor (LDR)', category: 'Sensors & Inputs', icon: Sun, accent: 'bg-amber-500' },
  { id: 'temp', name: 'Temp Sensor (DS18B20)', category: 'Sensors & Inputs', icon: Thermometer, accent: 'bg-cyan-600' },
  { id: 'dht11', name: 'DHT11 Temp/Humidity', category: 'Sensors & Inputs', icon: Thermometer, accent: 'bg-sky-500' },
  { id: 'ir', name: 'IR Sensor', category: 'Sensors & Inputs', icon: Radar, accent: 'bg-slate-700' },
  { id: 'ultrasonic', name: 'Ultrasonic (HC-SR04)', category: 'Sensors & Inputs', icon: Waves, accent: 'bg-teal-600' },
  { id: 'touch', name: 'Touch Sensor (ESP32)', category: 'Sensors & Inputs', icon: Hand, accent: 'bg-teal-500' },
  { id: 'joystick', name: 'Analog Joystick', category: 'Sensors & Inputs', icon: Move, accent: 'bg-emerald-600' },
  { id: 'color_sensor', name: 'Color Sensor (TCS34725)', category: 'Sensors & Inputs', icon: Palette, accent: 'bg-fuchsia-600' },

  { id: 'oled', name: 'OLED SSD1306', category: 'Displays', icon: Monitor, accent: 'bg-slate-800' }
]

const CATEGORY_ORDER: ComponentDef['category'][] = ['Outputs', 'Sensors & Inputs', 'Displays']
const CATEGORY_LABEL_KEY: Record<ComponentDef['category'], TranslationKey> = {
  'Outputs': 'categoryOutputs',
  'Sensors & Inputs': 'categorySensorsInputs',
  'Displays': 'categoryDisplays'
}

// Where newly-clicked components land: a loose cascading grid near the board so
// they're always visible without overlapping each other or the board itself.
const PLACEMENT_BASE = { x: 320, y: 80 }
const PLACEMENT_STEP = { x: 90, y: 90 }
const PLACEMENT_COLS = 5

export const ComponentPalette: React.FC = () => {
  const t = useT()
  const [query, setQuery] = useState('')
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const placeCounter = useRef(0)

  const addDevice = useAppStore(s => s.addDevice)
  const setSelectedItemId = useAppStore(s => s.setSelectedItemId)
  const placedCount = useAppStore(s =>
    s.selectedBoard ? (s.boardLayouts[s.selectedBoard.id]?.devices.length || 0) : 0
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? COMPONENTS.filter(c => c.name.toLowerCase().includes(q)) : COMPONENTS
    return CATEGORY_ORDER
      .map(category => ({ category, items: list.filter(c => c.category === category) }))
      .filter(g => g.items.length > 0)
  }, [query])

  const nextPosition = () => {
    // Nudge past however many devices are already on the board too, so adding
    // components across several visits doesn't start piling back onto the first spot.
    const i = placeCounter.current++ + placedCount
    return {
      canvasX: PLACEMENT_BASE.x + (i % PLACEMENT_COLS) * PLACEMENT_STEP.x,
      canvasY: PLACEMENT_BASE.y + Math.floor(i / PLACEMENT_COLS) * PLACEMENT_STEP.y
    }
  }

  const handleAdd = (compId: string) => {
    const id = `dev_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    const { canvasX, canvasY } = nextPosition()
    addDevice({ id, type: compId, mappedPin: '', canvasX, canvasY })
    setSelectedItemId(id)
    setJustAdded(compId)
    setTimeout(() => setJustAdded(curr => (curr === compId ? null : curr)), 1000)
  }

  const handleDragStart = (e: React.DragEvent, componentId: string) => {
    e.dataTransfer.setData('application/edublocks-component', componentId)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div className="flex h-full flex-col bg-surface-50">
      <div className="shrink-0 p-3 pb-2">
        <div className="msl-field mb-2">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('searchComponents')}
            className="w-full bg-transparent border-none text-sm font-medium text-slate-100 placeholder:text-slate-400 outline-none focus:ring-0"
          />
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-primary-50 px-2.5 py-1.5 text-[11px] font-semibold text-primary-700 ring-1 ring-primary-100">
          <MousePointerClick size={13} className="shrink-0" />
          {t('clickOrDragHint')}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-4">
        {filtered.length === 0 && (
          <p className="pt-6 text-center text-xs text-slate-400">{t('noComponentsMatch')} "{query}"</p>
        )}
        {filtered.map(group => (
          <div key={group.category}>
            <h3 className="mb-2 px-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {t(CATEGORY_LABEL_KEY[group.category])}
            </h3>
            <div className="space-y-1.5">
              {group.items.map(comp => {
                const Icon = comp.icon
                const added = justAdded === comp.id
                return (
                  <button
                    key={comp.id}
                    type="button"
                    draggable
                    onDragStart={e => handleDragStart(e, comp.id)}
                    onClick={() => handleAdd(comp.id)}
                    title={`Click to add ${comp.name}, or drag it onto the canvas`}
                    className={`group flex w-full cursor-pointer items-center gap-3 rounded-xl border p-2.5 text-left transition-all active:scale-[0.98] ${
                      added
                        ? 'border-emerald-300 bg-emerald-50 shadow-glow-emerald'
                        : 'border-panel-border bg-white shadow-soft hover:border-primary-200 hover:shadow-lift'
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${comp.accent} shadow-soft transition-transform group-hover:scale-105`}>
                      {added ? <Check size={16} className="text-white" /> : <Icon size={16} className="text-white" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-100">{comp.name}</span>
                      <span className="block text-[10px] font-medium text-slate-400">
                        {added ? t('addedToCanvas') : t('clickOrDrag')}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
