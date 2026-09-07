import React, { useMemo, useRef, useState } from 'react'
import {
  Lightbulb, CircleDot, Volume2, Disc3, Sun, Thermometer, RotateCw,
  Radar, Waves, Hand, Move, Fan, Grid3x3, Monitor, Search, Check, Palette, X,
  LayoutGrid, Mic
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

  { id: 'oled', name: 'OLED SSD1306', category: 'Displays', icon: Monitor, accent: 'bg-slate-800' },
  { id: 'led_matrix', name: 'LED Matrix (6x6 WS2812)', category: 'Displays', icon: LayoutGrid, accent: 'bg-pink-600' },
  { id: 'onboard_mic', name: 'Microphone (I2S)', category: 'Sensors & Inputs', icon: Mic, accent: 'bg-indigo-600' }
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

/** Horizontal strip along the top of the Hardware Canvas — click or drag a
 * chip onto the board below. Was a left sidebar; moved here so the canvas
 * gets the full width instead of sharing it with a vertical parts list. */
export const ComponentPalette: React.FC = () => {
  const t = useT()
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
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
    <div className="flex items-center h-full bg-surface-50 border-b border-panel-border px-3 gap-3">
      {/* Search — collapses to an icon so it doesn't eat into the strip's
          horizontal space when not in use. */}
      <div className="shrink-0">
        {searchOpen ? (
          <div className="msl-field !h-9 w-56">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              onBlur={() => { if (!query) setSearchOpen(false) }}
              placeholder={t('searchComponents')}
              className="w-full bg-transparent border-none text-sm font-medium text-slate-100 placeholder:text-slate-400 outline-none focus:ring-0"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-200 shrink-0">
                <X size={13} />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            title={t('searchComponents')}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-panel-border bg-white text-slate-400 hover:text-primary-600 hover:border-primary-200 transition-colors"
          >
            <Search size={15} />
          </button>
        )}
      </div>

      {/* Horizontally scrolling chip strip, grouped by category with a
          subtle divider + tiny label between groups. */}
      <div className="flex-1 min-w-0 h-full flex items-center gap-1 overflow-x-auto overflow-y-hidden">
        {filtered.length === 0 && (
          <p className="text-xs text-slate-400 whitespace-nowrap px-2">{t('noComponentsMatch')} "{query}"</p>
        )}
        {filtered.map((group, groupIdx) => (
          <React.Fragment key={group.category}>
            {groupIdx > 0 && <div className="w-px h-8 bg-panel-border shrink-0 mx-1.5" />}
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-slate-400 mr-0.5">
              {t(CATEGORY_LABEL_KEY[group.category])}
            </span>
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
                  className={`group shrink-0 flex items-center gap-2 rounded-lg border pl-1.5 pr-3 py-1.5 text-left transition-all active:scale-[0.97] ${
                    added
                      ? 'border-emerald-300 bg-emerald-50 shadow-glow-emerald'
                      : 'border-panel-border bg-white shadow-soft hover:border-primary-200 hover:shadow-lift'
                  }`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${comp.accent} shadow-soft transition-transform group-hover:scale-105`}>
                    {added ? <Check size={13} className="text-white" /> : <Icon size={13} className="text-white" />}
                  </span>
                  <span className="whitespace-nowrap text-xs font-semibold text-slate-100">{comp.name}</span>
                </button>
              )
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}
