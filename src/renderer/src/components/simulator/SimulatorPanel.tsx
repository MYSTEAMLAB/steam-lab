import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause, RotateCcw, Terminal, AlertCircle, Send, Cpu, Gauge } from 'lucide-react'
import { useAppStore } from '@renderer/store/useAppStore'
import { useSimulator } from '@renderer/lib/simulator/useSimulator'
import { buildSensorControls } from '@renderer/lib/simulator/helpers'
import { useT } from '@renderer/lib/i18n/useT'
import type { PlacedDevice } from '@shared/types/project'
import {
  LEDCard, BuzzerCard, ServoCard, MotorCard, ButtonCard, LDRCard, PotentiometerCard,
  UltrasonicCard, TempCard, IRCard, TouchCard, JoystickCard, OledCard, UnsupportedCard
} from './SimComponentRenderers'

const CARD_BY_TYPE: Record<string, React.FC<any>> = {
  led: LEDCard,
  buzzer: BuzzerCard,
  servo: ServoCard,
  dcmotor: MotorCard,
  button: ButtonCard,
  ldr: LDRCard,
  potentiometer: PotentiometerCard,
  ultrasonic: UltrasonicCard,
  temp: TempCard,
  ir: IRCard,
  touch: TouchCard,
  joystick: JoystickCard,
}

export const SimulatorPanel: React.FC = () => {
  const t = useT()
  const selectedBoard = useAppStore(s => s.selectedBoard)
  const devices = useAppStore(s =>
    s.selectedBoard ? (s.boardLayouts[s.selectedBoard.id]?.devices || []) : []
  )
  const boardId = selectedBoard?.id

  const { engine, snapshot } = useSimulator(devices, boardId)
  const controlSpecs = useMemo(() => buildSensorControls(devices, boardId || 'esp32'), [devices, boardId])
  const specByDevice = useMemo(() => new Map(controlSpecs.map(s => [s.deviceId, s])), [controlSpecs])

  // Seed each sensor control to its default the first time its device shows up,
  // so the slider position on screen always matches what the program reads —
  // never resets a value the student already adjusted this session.
  useEffect(() => {
    if (!engine) return
    for (const spec of controlSpecs) {
      if (spec.kind === 'joystick') {
        if (!(`${spec.deviceId}:VRX` in engine.sensorInputs)) engine.setSensorInput(`${spec.deviceId}:VRX`, spec.default)
        if (!(`${spec.deviceId}:VRY` in engine.sensorInputs)) engine.setSensorInput(`${spec.deviceId}:VRY`, spec.default)
      } else if (!(spec.deviceId in engine.sensorInputs)) {
        engine.setSensorInput(spec.deviceId, spec.default)
      }
    }
  }, [engine, controlSpecs])

  const logEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [snapshot.serialLog.length])

  const [incoming, setIncoming] = useState('')
  const sendIncoming = () => {
    if (!incoming.trim() || !engine) return
    engine.injectIncomingLine(incoming)
    setIncoming('')
  }

  const oledDevice = devices.find(d => d.type === 'oled')
  const knownCards = devices.filter(d => CARD_BY_TYPE[d.type])
  const unknownCards = devices.filter(d => d.type !== 'oled' && !CARD_BY_TYPE[d.type])

  const handleRun = () => {
    if (!engine) return
    if (snapshot.paused) engine.resume()
    else engine.start()
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-surface-50">
      {/* Toolbar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-panel-border bg-gradient-to-b from-white to-surface-50 px-4 shadow-soft">
        <div className="flex items-center gap-2">
          {!snapshot.running ? (
            <button onClick={handleRun} disabled={!engine} className="msl-btn msl-btn-success">
              <Play size={16} /> {t('simRun')}
            </button>
          ) : snapshot.paused ? (
            <button onClick={handleRun} className="msl-btn msl-btn-success">
              <Play size={16} /> {t('simResume')}
            </button>
          ) : (
            <button onClick={() => engine?.pause()} className="msl-btn msl-btn-ghost">
              <Pause size={16} /> {t('simPause')}
            </button>
          )}
          <button onClick={() => engine?.reset()} disabled={!engine} className="msl-btn msl-btn-ghost">
            <RotateCcw size={16} /> {t('simReset')}
          </button>

          <span className="w-px h-6 bg-panel-border mx-1" />

          <span className="msl-pill bg-surface-100 text-slate-400 ring-1 ring-panel-border">
            <Cpu size={12} /> {selectedBoard?.name ?? '—'}
          </span>
          {snapshot.running && (
            <span className="msl-pill bg-primary-50 text-primary-700 ring-1 ring-primary-200 animate-fade-in-up">
              <Gauge size={12} /> loop #{snapshot.loopCount}
            </span>
          )}
        </div>

        {snapshot.error && (
          <span className="msl-pill bg-red-50 text-red-700 ring-1 ring-red-200">
            <AlertCircle size={12} /> {snapshot.error}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Device grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {devices.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-slate-400">
              <Cpu size={32} className="opacity-30" />
              <p className="text-sm font-medium">{t('simNoHardware')}</p>
              <p className="text-xs">{t('simAddHardwareHint')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 [@media(min-width:900px)]:grid-cols-3 [@media(min-width:1300px)]:grid-cols-4">
              {oledDevice && <OledCard key={oledDevice.id} snapshot={snapshot} />}
              {knownCards.map((d: PlacedDevice) => {
                const Card = CARD_BY_TYPE[d.type]
                return (
                  <Card
                    key={d.id}
                    device={d}
                    snapshot={snapshot}
                    boardId={boardId}
                    spec={specByDevice.get(d.id)}
                    onSensorChange={(key: string, value: number | boolean) => engine?.setSensorInput(key, value)}
                  />
                )
              })}
              {unknownCards.map(d => <UnsupportedCard key={d.id} device={d} />)}
            </div>
          )}
        </div>

        {/* Virtual monitor + variables */}
        <div className="flex w-[320px] shrink-0 flex-col border-l border-panel-border bg-white">
          <div className="msl-panel-header">
            <Terminal size={13} className="text-violet-500" />
            <span>{t('simVirtualMonitor')}</span>
          </div>
          <div data-testid="sim-monitor-log" className="flex-1 min-h-0 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed">
            {snapshot.serialLog.length === 0 ? (
              <div className="italic text-slate-400">{t('simPressRunToStart')}</div>
            ) : (
              snapshot.serialLog.map((l, i) => {
                const isSys = l.startsWith('[')
                return <div key={i} className={isSys ? 'text-primary-600 font-semibold' : 'text-slate-200'}>{l}</div>
              })
            )}
            <div ref={logEndRef} />
          </div>
          <div className="flex items-center gap-2 border-t border-panel-border bg-surface-50 p-2">
            <input
              value={incoming}
              onChange={e => setIncoming(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendIncoming()}
              placeholder={t('simSimulateBluetooth')}
              className="flex-1 rounded-lg border border-panel-border bg-white px-2 py-1.5 text-xs outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
            />
            <button onClick={sendIncoming} disabled={!incoming.trim()} className="rounded-lg bg-primary-500 p-1.5 text-white hover:bg-primary-600 disabled:opacity-30 active:scale-90 transition-all">
              <Send size={14} />
            </button>
          </div>

          {Object.keys(snapshot.vars).length > 0 && (
            <div className="border-t border-panel-border">
              <div className="msl-panel-header">{t('simVariables')}</div>
              <div className="max-h-32 overflow-y-auto p-2 font-mono text-[11px]">
                {Object.entries(snapshot.vars).map(([name, val]) => (
                  <div key={name} className="flex justify-between py-0.5">
                    <span className="text-slate-400">{name}</span>
                    <span className="font-semibold text-slate-100">{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
