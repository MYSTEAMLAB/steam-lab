import React, { useEffect, useRef, useState } from 'react'
import { Bluetooth, Trash2, Send, Loader2, CheckCircle2, XCircle, Settings2 } from 'lucide-react'
import {
  DEFAULT_CALIBRATION,
  pathToCommands,
  commandToWireLine,
  type Point,
  type TracerCalibration,
  type TracerCommand
} from '@renderer/lib/tracer/pathToCommands'

type ConnectionState = 'connecting' | 'connected' | 'not-found' | 'failed'

// Draw a path, the board retraces it. Pairs with the tracer_listen firmware
// block (arduinoGenerator.ts) via the "Robot Tracer: Path Follower" example —
// the board must already be running that firmware over Bluetooth before this
// tab can do anything useful.
export const TracerRunPanel: React.FC = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')
  const [connectedDeviceName, setConnectedDeviceName] = useState<string>('')
  const [isDrawing, setIsDrawing] = useState(false)
  const [points, setPoints] = useState<Point[]>([])
  const [isSending, setIsSending] = useState(false)
  const [sendProgress, setSendProgress] = useState<{ step: number; total: number; label: string } | null>(null)
  const [showCalibration, setShowCalibration] = useState(false)
  const [calibration, setCalibration] = useState<TracerCalibration>(DEFAULT_CALIBRATION)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sendCancelRef = useRef(false)

  // ── Auto-connect over Bluetooth on entering this tab ──────────────────────
  useEffect(() => {
    let cancelled = false

    const connect = async () => {
      setConnectionState('connecting')
      try {
        const devices = await (window as any).api.bluetooth.listDevices()
        const outgoing = (devices || []).filter((d: any) => d.outgoing)
        if (outgoing.length === 0) {
          if (!cancelled) setConnectionState('not-found')
          return
        }
        // Every board now advertises as "MSL_<chip id>" by default — prefer
        // one of those if several devices are paired, but fall back to
        // whatever's paired so this still works with older custom names.
        const preferred = outgoing.find((d: any) => (d.deviceName || '').startsWith('MSL_')) || outgoing[0]

        const result = await (window as any).api.serial.open(preferred.path, 115200, { skipReset: true })
        if (cancelled) return
        if (result?.success) {
          setConnectionState('connected')
          setConnectedDeviceName(preferred.deviceName || preferred.path)
        } else {
          setConnectionState('failed')
        }
      } catch {
        if (!cancelled) setConnectionState('failed')
      }
    }

    connect()
    return () => { cancelled = true }
  }, [])

  // ── Canvas drawing ─────────────────────────────────────────────────────────
  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const redraw = (allPoints: Point[]) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (allPoints.length < 2) return
    ctx.strokeStyle = '#2563eb'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(allPoints[0].x, allPoints[0].y)
    for (const p of allPoints.slice(1)) ctx.lineTo(p.x, p.y)
    ctx.stroke()
    // start/end markers
    ctx.fillStyle = '#16a34a'
    ctx.beginPath()
    ctx.arc(allPoints[0].x, allPoints[0].y, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#dc2626'
    const last = allPoints[allPoints.length - 1]
    ctx.beginPath()
    ctx.arc(last.x, last.y, 5, 0, Math.PI * 2)
    ctx.fill()
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isSending) return
    canvasRef.current?.setPointerCapture(e.pointerId)
    const p = getCanvasPoint(e)
    setPoints([p])
    setIsDrawing(true)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || isSending) return
    const p = getCanvasPoint(e)
    setPoints(prev => {
      const next = [...prev, p]
      redraw(next)
      return next
    })
  }

  const handlePointerUp = () => setIsDrawing(false)

  const handleClear = () => {
    setPoints([])
    setSendProgress(null)
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
  }

  useEffect(() => { redraw(points) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Send the drawn path as timed drive commands ────────────────────────────
  const handleSend = async () => {
    if (points.length < 2 || connectionState !== 'connected') return
    const commands: TracerCommand[] = pathToCommands(points, calibration)
    if (commands.length === 0) return

    setIsSending(true)
    sendCancelRef.current = false

    for (let i = 0; i < commands.length; i++) {
      if (sendCancelRef.current) break
      const cmd = commands[i]
      setSendProgress({ step: i + 1, total: commands.length, label: cmd.label })
      await (window as any).api.serial.write(commandToWireLine(cmd) + '\n')
      // The board blocks for the command's own duration (delay(ms) in
      // firmware) before it can read the next line — pace sending to match
      // so commands don't pile up in the Bluetooth buffer ahead of when the
      // board can actually act on them.
      await new Promise(resolve => setTimeout(resolve, Math.abs(cmd.ms) + 120))
    }
    if (!sendCancelRef.current) {
      await (window as any).api.serial.write('X\n')
    }
    setIsSending(false)
    setSendProgress(null)
  }

  const handleStop = () => {
    sendCancelRef.current = true
    ;(window as any).api.serial.write('X\n')
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col p-4 gap-3 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <ConnectionBadge state={connectionState} deviceName={connectedDeviceName} />

          <button
            onClick={handleClear}
            disabled={isSending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-100 border border-panel-border text-sm font-medium text-slate-300 hover:bg-surface-200 transition-colors disabled:opacity-50"
          >
            <Trash2 size={14} /> Clear
          </button>

          {!isSending ? (
            <button
              onClick={handleSend}
              disabled={points.length < 2 || connectionState !== 'connected'}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send size={14} /> Send Path to Robot
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-500 transition-colors"
            >
              <Loader2 size={14} className="animate-spin" /> Stop
            </button>
          )}

          <button
            onClick={() => setShowCalibration(v => !v)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-100 border border-panel-border text-sm font-medium text-slate-300 hover:bg-surface-200 transition-colors"
          >
            <Settings2 size={14} /> Calibration
          </button>
        </div>

        {sendProgress && (
          <div className="text-xs text-slate-400">
            Step {sendProgress.step} / {sendProgress.total} — {sendProgress.label}
          </div>
        )}

        {showCalibration && (
          <div className="flex items-center gap-4 p-3 rounded-lg bg-surface-100 border border-panel-border text-xs text-slate-300">
            <p className="text-slate-400 max-w-xs">
              No wheel encoders on this hardware — distance/angle are approximated purely by how long the motors run. Tune these to match your specific robot.
            </p>
            <label className="flex items-center gap-2">
              ms per pixel
              <input
                type="number"
                value={calibration.msPerPixel}
                onChange={e => setCalibration(c => ({ ...c, msPerPixel: Number(e.target.value) || 0 }))}
                className="w-16 px-2 py-1 rounded bg-surface-50 border border-panel-border text-slate-100"
              />
            </label>
            <label className="flex items-center gap-2">
              ms per degree
              <input
                type="number"
                value={calibration.msPerDegree}
                onChange={e => setCalibration(c => ({ ...c, msPerDegree: Number(e.target.value) || 0 }))}
                className="w-16 px-2 py-1 rounded bg-surface-50 border border-panel-border text-slate-100"
              />
            </label>
          </div>
        )}

        <div className="flex-1 min-h-0 rounded-xl overflow-hidden border border-panel-border bg-white">
          <canvas
            ref={canvasRef}
            width={1000}
            height={640}
            className="w-full h-full touch-none cursor-crosshair"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </div>
        <p className="text-xs text-slate-500">
          Draw a path with your mouse, starting from where the robot is sitting. The board must already be running the "Robot Tracer: Path Follower" example, connected once over USB first.
        </p>
      </div>
    </div>
  )
}

const ConnectionBadge: React.FC<{ state: ConnectionState; deviceName: string }> = ({ state, deviceName }) => {
  if (state === 'connecting') {
    return (
      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-100 border border-panel-border text-sm text-slate-400">
        <Loader2 size={14} className="animate-spin" /> Connecting over Bluetooth…
      </span>
    )
  }
  if (state === 'connected') {
    return (
      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
        <CheckCircle2 size={14} /> Connected to {deviceName}
      </span>
    )
  }
  if (state === 'not-found') {
    return (
      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
        <Bluetooth size={14} /> No paired board found — pair it in Windows Bluetooth settings first.
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
      <XCircle size={14} /> Couldn't connect — is the board powered on and already running the Tracer firmware?
    </span>
  )
}
