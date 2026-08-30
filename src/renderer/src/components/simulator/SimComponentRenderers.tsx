import React from 'react'
import {
  Lightbulb, Volume2, VolumeX, RotateCw, CircleDot, Sun, Disc3, Fan,
  Thermometer, Radar, Hand, Move, Monitor, HelpCircle
} from 'lucide-react'
import type { PlacedDevice } from '@shared/types/project'
import type { SensorControlSpec, SimSnapshot } from '@renderer/lib/simulator/types'
import { normalizePin, devicePin } from '@renderer/lib/simulator/helpers'

interface CardProps {
  device: PlacedDevice
  snapshot: SimSnapshot
  boardId: string
  spec?: SensorControlSpec
  onSensorChange: (key: string, value: number | boolean) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared shell every device card sits inside — icon, label, pin badge.
// ─────────────────────────────────────────────────────────────────────────────
const CardShell: React.FC<{
  icon: React.ReactNode
  label: string
  pinText: string
  accent: string
  children: React.ReactNode
}> = ({ icon, label, pinText, accent, children }) => (
  <div className="flex flex-col gap-3 rounded-xl border border-panel-border bg-white p-4 shadow-soft transition-shadow hover:shadow-lift">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${accent}`}>{icon}</span>
        <span className="text-sm font-semibold text-slate-100">{label}</span>
      </div>
      {pinText && (
        <span className="rounded-full bg-surface-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-400 ring-1 ring-panel-border">
          {pinText}
        </span>
      )}
    </div>
    {children}
  </div>
)

function pinLabel(device: PlacedDevice): string {
  if (typeof device.mappedPin === 'string') return device.mappedPin ? `GPIO${normalizePin(device.mappedPin)}` : ''
  if (device.mappedPin && typeof device.mappedPin === 'object') {
    return Object.values(device.mappedPin).filter(Boolean).map(p => `GPIO${normalizePin(p as string)}`).join(' / ')
  }
  return ''
}

// ── Slider used by LDR / potentiometer / ultrasonic / temp / IR-analog ──────
const RangeControl: React.FC<{
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (v: number) => void
}> = ({ value, min, max, step, unit, onChange }) => (
  <div className="flex flex-col gap-1.5">
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full accent-primary-500"
    />
    <div className="text-center font-mono text-xs font-bold text-primary-600">
      {Number.isInteger(step) ? Math.round(value) : value.toFixed(1)}{unit}
      <span className="text-slate-400 font-normal"> / {max}{unit}</span>
    </div>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────

export const LEDCard: React.FC<CardProps> = ({ device, snapshot, boardId }) => {
  const pin = devicePin([device], device.id) || (typeof device.mappedPin === 'string' ? normalizePin(device.mappedPin) : '')
  const on = !!snapshot.pins[pin]
  return (
    <CardShell icon={<Lightbulb size={15} className="text-white" />} label="LED" pinText={pinLabel(device)} accent="bg-red-500">
      <div className="flex items-center justify-center py-3">
        <div
          className={`h-14 w-14 rounded-full border-4 transition-all duration-150 ${
            on
              ? 'border-red-300 bg-red-500 shadow-[0_0_28px_8px_rgba(239,68,68,0.55)]'
              : 'border-slate-700 bg-slate-800'
          }`}
        />
      </div>
      <div className="text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {on ? 'ON' : 'OFF'}
      </div>
    </CardShell>
  )
}

export const BuzzerCard: React.FC<CardProps> = ({ device, snapshot }) => {
  const pin = devicePin([device], device.id) || (typeof device.mappedPin === 'string' ? normalizePin(device.mappedPin) : '')
  const on = !!snapshot.pins[pin]
  const freq = snapshot.buzzerFreq[pin]
  return (
    <CardShell icon={on ? <Volume2 size={15} className="text-white" /> : <VolumeX size={15} className="text-white" />} label="Buzzer" pinText={pinLabel(device)} accent={on ? 'bg-amber-500' : 'bg-slate-500'}>
      <div className="flex items-center justify-center gap-1 py-3">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className={`w-1.5 rounded-full bg-amber-500 transition-all ${on ? 'animate-pulse-soft' : 'opacity-20'}`}
            style={{ height: on ? 10 + i * 8 : 8, animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
      <div className="text-center text-[11px] font-semibold text-slate-400">
        {on ? (freq ? `♪ ${freq} Hz` : 'Buzzing') : 'Silent'}
      </div>
    </CardShell>
  )
}

export const ServoCard: React.FC<CardProps> = ({ device, snapshot }) => {
  const pin = devicePin([device], device.id) || (typeof device.mappedPin === 'string' ? normalizePin(device.mappedPin) : '')
  const angle = snapshot.servoAngles[pin] ?? 90
  return (
    <CardShell icon={<RotateCw size={15} className="text-white" />} label="Servo" pinText={pinLabel(device)} accent="bg-blue-500">
      <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-slate-700 bg-slate-900">
        <div
          className="absolute h-8 w-1 rounded-full bg-primary-400 origin-bottom transition-transform duration-200 ease-out"
          style={{ transform: `rotate(${angle - 90}deg)`, bottom: '50%' }}
        />
        <div className="h-2 w-2 rounded-full bg-primary-300" />
      </div>
      <div className="text-center font-mono text-xs font-bold text-primary-600">{Math.round(angle)}°</div>
    </CardShell>
  )
}

export const MotorCard: React.FC<CardProps> = ({ device, snapshot }) => {
  const power = snapshot.motors[device.id]?.power ?? 0
  const speed = Math.abs(power)
  const spinning = speed > 2
  const durationS = spinning ? Math.max(0.15, 1.4 - (speed / 255) * 1.2) : 0
  return (
    <CardShell icon={<Fan size={15} className="text-white" />} label="DC Motor" pinText={pinLabel(device)} accent="bg-violet-500">
      <div className="flex items-center justify-center py-2">
        <Fan
          size={40}
          className="text-violet-500"
          style={{
            animation: spinning ? `spin ${durationS}s linear infinite` : undefined,
            animationDirection: power < 0 ? 'reverse' : 'normal'
          }}
        />
      </div>
      <div className="text-center text-[11px] font-semibold text-slate-400">
        {speed <= 2 ? 'Stopped' : `${power > 0 ? 'Forward' : 'Reverse'} · ${Math.round((speed / 255) * 100)}%`}
      </div>
    </CardShell>
  )
}

export const ButtonCard: React.FC<CardProps> = ({ device, spec, onSensorChange }) => {
  const [pressed, setPressed] = React.useState(false)
  const press = (v: boolean) => { setPressed(v); onSensorChange(device.id, v) }
  return (
    <CardShell icon={<CircleDot size={15} className="text-white" />} label="Button" pinText={pinLabel(device)} accent="bg-slate-500">
      <button
        onPointerDown={() => press(true)}
        onPointerUp={() => press(false)}
        onPointerLeave={() => pressed && press(false)}
        className={`mx-auto flex h-14 w-14 select-none items-center justify-center rounded-full border-4 font-bold text-white transition-all active:scale-95 ${
          pressed ? 'border-red-300 bg-red-500 scale-90 shadow-inner' : 'border-red-700 bg-red-600 shadow-lift'
        }`}
        title="Press and hold"
      >
        {pressed ? 'ON' : ''}
      </button>
      <div className="text-center text-[11px] font-semibold text-slate-400">Press and hold</div>
    </CardShell>
  )
}

export const LDRCard: React.FC<CardProps> = ({ device, spec, snapshot, onSensorChange }) => {
  const val = Number(snapshot.sensorInputs[device.id] ?? spec?.default ?? 0)
  return (
    <CardShell icon={<Sun size={15} className="text-white" />} label="LDR (Light)" pinText={pinLabel(device)} accent="bg-amber-500">
      <RangeControl
        value={val} min={spec?.min ?? 0} max={spec?.max ?? 4095} step={spec?.step ?? 1}
        onChange={v => onSensorChange(device.id, v)}
      />
      <div className="text-center text-[11px] text-slate-400">Drag left = darker, right = brighter</div>
    </CardShell>
  )
}

export const PotentiometerCard: React.FC<CardProps> = ({ device, spec, snapshot, onSensorChange }) => {
  const max = spec?.max ?? 4095
  const val = Number(snapshot.sensorInputs[device.id] ?? spec?.default ?? 0)
  const pct = max ? val / max : 0
  return (
    <CardShell icon={<Disc3 size={15} className="text-white" />} label="Potentiometer" pinText={pinLabel(device)} accent="bg-slate-700">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-slate-700 bg-slate-900">
        <div
          className="h-6 w-1 rounded-full bg-primary-400 origin-bottom transition-transform"
          style={{ transform: `rotate(${pct * 270 - 135}deg)`, marginBottom: 14 }}
        />
      </div>
      <RangeControl value={val} min={spec?.min ?? 0} max={max} step={spec?.step ?? 1} onChange={v => onSensorChange(device.id, v)} />
    </CardShell>
  )
}

export const UltrasonicCard: React.FC<CardProps> = ({ device, spec, snapshot, onSensorChange }) => {
  const val = Number(snapshot.sensorInputs[device.id] ?? spec?.default ?? 50)
  return (
    <CardShell icon={<Radar size={15} className="text-white" />} label="Ultrasonic" pinText={pinLabel(device)} accent="bg-cyan-600">
      <div className="flex items-center justify-center py-1">
        <Radar size={28} className={`text-cyan-500 ${snapshot.running ? 'animate-pulse-soft' : ''}`} />
      </div>
      <RangeControl value={val} min={spec?.min ?? 2} max={spec?.max ?? 400} step={spec?.step ?? 1} unit=" cm" onChange={v => onSensorChange(device.id, v)} />
    </CardShell>
  )
}

export const TempCard: React.FC<CardProps> = ({ device, spec, snapshot, onSensorChange }) => {
  const val = Number(snapshot.sensorInputs[device.id] ?? spec?.default ?? 25)
  const hot = val > 30
  return (
    <CardShell icon={<Thermometer size={15} className="text-white" />} label="Temp Sensor" pinText={pinLabel(device)} accent={hot ? 'bg-red-500' : 'bg-blue-500'}>
      <RangeControl value={val} min={spec?.min ?? -10} max={spec?.max ?? 60} step={spec?.step ?? 0.5} unit="°C" onChange={v => onSensorChange(device.id, v)} />
      <div className={`text-center text-[11px] font-semibold ${hot ? 'text-red-500' : 'text-slate-400'}`}>{hot ? 'Hot (> 30°C)' : 'Normal'}</div>
    </CardShell>
  )
}

export const IRCard: React.FC<CardProps> = ({ device, snapshot, onSensorChange }) => {
  const detected = !!snapshot.sensorInputs[device.id]
  return (
    <CardShell icon={<Radar size={15} className="text-white" />} label="IR Sensor" pinText={pinLabel(device)} accent="bg-slate-700">
      <button
        onClick={() => onSensorChange(device.id, !detected)}
        className={`mx-auto flex h-10 w-32 items-center justify-center rounded-full text-xs font-bold transition-all ${
          detected ? 'bg-emerald-500 text-white shadow-glow-emerald' : 'bg-surface-200 text-slate-400 ring-1 ring-panel-border'
        }`}
      >
        {detected ? 'Object Detected' : 'Nothing Detected'}
      </button>
      <div className="text-center text-[11px] text-slate-400">Click to toggle</div>
    </CardShell>
  )
}

export const TouchCard: React.FC<CardProps> = ({ device, onSensorChange }) => {
  const [touched, setTouched] = React.useState(false)
  const press = (v: boolean) => { setTouched(v); onSensorChange(device.id, v) }
  return (
    <CardShell icon={<Hand size={15} className="text-white" />} label="Touch Sensor" pinText={pinLabel(device)} accent="bg-teal-600">
      <button
        onPointerDown={() => press(true)}
        onPointerUp={() => press(false)}
        onPointerLeave={() => touched && press(false)}
        className={`mx-auto flex h-14 w-14 select-none items-center justify-center rounded-full border-4 transition-all active:scale-95 ${
          touched ? 'border-teal-300 bg-teal-500 shadow-glow-emerald' : 'border-slate-700 bg-slate-800'
        }`}
      >
        <Hand size={20} className="text-white" />
      </button>
      <div className="text-center text-[11px] font-semibold text-slate-400">Press and hold</div>
    </CardShell>
  )
}

export const JoystickCard: React.FC<CardProps> = ({ device, spec, snapshot, onSensorChange }) => {
  const max = spec?.max ?? 4095
  const padRef = React.useRef<HTMLDivElement>(null)
  const vrx = Number(snapshot.sensorInputs[`${device.id}:VRX`] ?? max / 2)
  const vry = Number(snapshot.sensorInputs[`${device.id}:VRY`] ?? max / 2)
  const nx = max ? vrx / max : 0.5 // 0..1
  const ny = max ? vry / max : 0.5

  const setFromPointer = (e: React.PointerEvent) => {
    const el = padRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const py = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    onSensorChange(`${device.id}:VRX`, Math.round(px * max))
    onSensorChange(`${device.id}:VRY`, Math.round(py * max))
  }

  const recenter = () => {
    onSensorChange(`${device.id}:VRX`, Math.round(max / 2))
    onSensorChange(`${device.id}:VRY`, Math.round(max / 2))
  }

  return (
    <CardShell icon={<Move size={15} className="text-white" />} label="Joystick" pinText={pinLabel(device)} accent="bg-emerald-600">
      <div
        ref={padRef}
        className="relative mx-auto h-24 w-24 cursor-crosshair touch-none rounded-lg border-2 border-panel-border bg-surface-100"
        onPointerDown={e => { (e.target as Element).setPointerCapture(e.pointerId); setFromPointer(e) }}
        onPointerMove={e => { if (e.buttons === 1) setFromPointer(e) }}
        onPointerUp={recenter}
        onPointerLeave={e => { if (e.buttons === 1) recenter() }}
      >
        <div className="absolute inset-0 m-auto h-px w-full bg-panel-border" />
        <div className="absolute inset-0 m-auto h-full w-px bg-panel-border" />
        <div
          className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500 shadow-glow-emerald"
          style={{ left: `${nx * 100}%`, top: `${ny * 100}%` }}
        />
      </div>
      <div className="text-center font-mono text-[11px] text-slate-400">X:{Math.round(vrx)} Y:{Math.round(vry)}</div>
    </CardShell>
  )
}

export const OledCard: React.FC<{ snapshot: SimSnapshot }> = ({ snapshot }) => (
  <CardShell icon={<Monitor size={15} className="text-white" />} label="OLED Display" pinText="" accent="bg-slate-700">
    <div className={`h-24 overflow-hidden rounded-md p-2 font-mono text-[10px] leading-tight ${snapshot.oled.inverted ? 'bg-slate-100 text-slate-900' : 'bg-black text-emerald-400'}`}>
      {snapshot.oled.lines.length === 0
        ? <span className="opacity-40">display is blank</span>
        : snapshot.oled.lines.map((l, i) => <div key={i}>{l || ' '}</div>)}
    </div>
  </CardShell>
)

export const UnsupportedCard: React.FC<{ device: PlacedDevice }> = ({ device }) => (
  <CardShell icon={<HelpCircle size={15} className="text-white" />} label={device.type} pinText={pinLabel(device)} accent="bg-slate-500">
    <div className="py-3 text-center text-[11px] text-slate-400">Not simulated yet</div>
  </CardShell>
)
