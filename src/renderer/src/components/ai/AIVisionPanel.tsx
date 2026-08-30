import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Camera, Mic, Play, Square, Plus, Trash2, Radio, AlertTriangle, Hand, Scan, Shapes, Smile } from 'lucide-react'
import { GestureRecognizer, DrawingUtils } from '@mediapipe/tasks-vision'
import { useAppStore } from '@renderer/store/useAppStore'
import {
  loadMobileNet,
  addExample,
  predict,
  getClassCounts,
  hasClasses,
  clearClass,
  type Prediction
} from '@renderer/lib/ai/imageClassifier'
import { loadGestureRecognizer, recognize, type GestureResult } from '@renderer/lib/ai/gestureRecognizer'
import { loadObjectDetector, detectObjects, type DetectedObject } from '@renderer/lib/ai/objectDetector'
import { loadShapeDetector, detectShapes, type DetectedShape } from '@renderer/lib/ai/shapeDetector'
import { loadExpressionDetector, detectExpression, type DetectedExpression } from '@renderer/lib/ai/expressionDetector'
import { createMicLevelMeter, type MicLevelMeter } from '@renderer/lib/ai/micLevel'
import { sendClassPrediction, sendMicLevel, sendGesture, sendObject, sendShape, sendExpression } from '@renderer/lib/ai/aiSerialWriter'

const RECORD_INTERVAL_MS = 150
const PREDICT_INTERVAL_MS = 200
const MIC_INTERVAL_MS = 150
const GESTURE_INTERVAL_MS = 150
const OBJECT_INTERVAL_MS = 200
const SHAPE_INTERVAL_MS = 250
const EXPRESSION_INTERVAL_MS = 250

type Mode = 'training' | 'predicting'

export const AIVisionPanel: React.FC = () => {
  const isSerialConnected = useAppStore(s => s.isSerialConnected)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const objectCanvasRef = useRef<HTMLCanvasElement>(null)
  const shapeCanvasRef = useRef<HTMLCanvasElement>(null)
  const expressionCanvasRef = useRef<HTMLCanvasElement>(null)
  const expressionBusyRef = useRef(false)
  const streamRef = useRef<MediaStream | null>(null)
  const micMeterRef = useRef<MicLevelMeter | null>(null)
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const drawingUtilsRef = useRef<DrawingUtils | null>(null)

  const [cameraError, setCameraError] = useState<string | null>(null)
  const [modelReady, setModelReady] = useState(false)

  const [classes, setClasses] = useState<string[]>([])
  const [classCounts, setClassCounts] = useState<Record<string, number>>({})
  const [newClassName, setNewClassName] = useState('')
  const [recordingClass, setRecordingClass] = useState<string | null>(null)

  const [mode, setMode] = useState<Mode>('training')
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [micLevel, setMicLevel] = useState(0)
  const [isStreaming, setIsStreaming] = useState(false)

  const [gestureEnabled, setGestureEnabled] = useState(false)
  const [gestureModelReady, setGestureModelReady] = useState(false)
  const [gestureLoading, setGestureLoading] = useState(false)
  const [gestureResult, setGestureResult] = useState<GestureResult | null>(null)

  const [objectEnabled, setObjectEnabled] = useState(false)
  const [objectModelReady, setObjectModelReady] = useState(false)
  const [objectLoading, setObjectLoading] = useState(false)
  const [objects, setObjects] = useState<DetectedObject[]>([])

  const [shapeEnabled, setShapeEnabled] = useState(false)
  const [shapeModelReady, setShapeModelReady] = useState(false)
  const [shapeLoading, setShapeLoading] = useState(false)
  const [shapes, setShapes] = useState<DetectedShape[]>([])

  const [expressionEnabled, setExpressionEnabled] = useState(false)
  const [expressionModelReady, setExpressionModelReady] = useState(false)
  const [expressionLoading, setExpressionLoading] = useState(false)
  const [expression, setExpression] = useState<DetectedExpression | null>(null)

  // ── Camera + mic acquisition (one combined stream, shared by preview + mic meter) ──
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        micMeterRef.current = createMicLevelMeter(stream)
      } catch (err) {
        console.error('[AIVisionPanel] getUserMedia failed', err)
        setCameraError(
          err instanceof Error ? err.message : 'Could not access camera/microphone.'
        )
      }
    })()

    loadMobileNet()
      .then(() => setModelReady(true))
      .catch(err => console.error('[AIVisionPanel] MobileNet load failed', err))

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach(t => t.stop())
      micMeterRef.current?.stop()
    }
  }, [])

  // ── Mic level polling (always runs once the meter exists, independent of mode) ──
  useEffect(() => {
    const id = setInterval(() => {
      const meter = micMeterRef.current
      if (!meter) return
      const level = meter.getLevel()
      setMicLevel(level)
      if (isStreaming) sendMicLevel(level)
    }, MIC_INTERVAL_MS)
    return () => clearInterval(id)
  }, [isStreaming])

  // ── Predict loop ──
  useEffect(() => {
    if (mode !== 'predicting' || !modelReady) return
    let cancelled = false
    const id = setInterval(async () => {
      if (cancelled || !videoRef.current) return
      try {
        const result = await predict(videoRef.current)
        if (cancelled) return
        setPrediction(result)
        if (result && isStreaming) sendClassPrediction(result.className, result.confidence)
      } catch (err) {
        console.error('[AIVisionPanel] predict failed', err)
      }
    }, PREDICT_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [mode, modelReady, isStreaming])

  // ── Hand gesture recognition (independent toggle, off by default) ──
  useEffect(() => {
    if (!gestureEnabled || gestureModelReady || gestureLoading) return
    setGestureLoading(true)
    loadGestureRecognizer()
      .then(() => setGestureModelReady(true))
      .catch(err => console.error('[AIVisionPanel] Gesture recognizer load failed', err))
      .finally(() => setGestureLoading(false))
  }, [gestureEnabled, gestureModelReady, gestureLoading])

  useEffect(() => {
    if (!gestureEnabled || !gestureModelReady) {
      // Clear any stale skeleton overlay when turned off.
      const canvas = canvasRef.current
      if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
      return
    }
    let cancelled = false
    const id = setInterval(() => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (cancelled || !video || video.readyState < 2) return

      const result = recognize(video)
      if (cancelled) return
      setGestureResult(result)
      if (result && isStreaming) sendGesture(result.categoryName, result.confidence)

      if (!canvas) return
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (result && result.landmarks.length > 0) {
        if (!drawingUtilsRef.current) drawingUtilsRef.current = new DrawingUtils(ctx)
        drawingUtilsRef.current.drawConnectors(result.landmarks, GestureRecognizer.HAND_CONNECTIONS, {
          color: '#A855F7',
          lineWidth: 3
        })
        drawingUtilsRef.current.drawLandmarks(result.landmarks, { color: '#F0ABFC', radius: 3 })
      }
    }, GESTURE_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [gestureEnabled, gestureModelReady, isStreaming])

  // ── Object detection (independent toggle, own canvas layer, off by default) ──
  useEffect(() => {
    if (!objectEnabled || objectModelReady || objectLoading) return
    setObjectLoading(true)
    loadObjectDetector()
      .then(() => setObjectModelReady(true))
      .catch(err => console.error('[AIVisionPanel] Object detector load failed', err))
      .finally(() => setObjectLoading(false))
  }, [objectEnabled, objectModelReady, objectLoading])

  useEffect(() => {
    if (!objectEnabled || !objectModelReady) {
      // Clear any stale bounding boxes when turned off. Own canvas, so this
      // never touches the hand-gesture skeleton overlay layered beneath it.
      const canvas = objectCanvasRef.current
      if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
      return
    }
    let cancelled = false
    const id = setInterval(() => {
      const video = videoRef.current
      const canvas = objectCanvasRef.current
      if (cancelled || !video || video.readyState < 2) return

      const results = detectObjects(video)
      if (cancelled) return
      setObjects(results)
      if (results.length > 0 && isStreaming) sendObject(results[0].categoryName, results[0].confidence)

      if (!canvas) return
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = '#22C55E'
      ctx.lineWidth = 2
      ctx.font = '14px sans-serif'
      for (const obj of results) {
        const { x, y, width, height } = obj.boundingBox
        ctx.strokeRect(x, y, width, height)
        const label = `${obj.categoryName} ${obj.confidence}%`
        const labelWidth = ctx.measureText(label).width + 8
        ctx.fillStyle = '#22C55E'
        ctx.fillRect(x, Math.max(0, y - 18), labelWidth, 18)
        ctx.fillStyle = '#052E16'
        ctx.fillText(label, x + 4, Math.max(13, y - 4))
      }
    }, OBJECT_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [objectEnabled, objectModelReady, isStreaming])

  // ── Shape detection (independent toggle, own canvas layer, off by default) ──
  useEffect(() => {
    if (!shapeEnabled || shapeModelReady || shapeLoading) return
    setShapeLoading(true)
    loadShapeDetector()
      .then(() => setShapeModelReady(true))
      .catch(err => console.error('[AIVisionPanel] Shape detector load failed', err))
      .finally(() => setShapeLoading(false))
  }, [shapeEnabled, shapeModelReady, shapeLoading])

  useEffect(() => {
    if (!shapeEnabled || !shapeModelReady) {
      // Clear any stale outlines when turned off. Own canvas, so this never
      // touches the gesture-skeleton or object-box overlays layered beneath it.
      const canvas = shapeCanvasRef.current
      if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
      return
    }
    let cancelled = false
    const id = setInterval(() => {
      const video = videoRef.current
      const canvas = shapeCanvasRef.current
      if (cancelled || !video || video.readyState < 2) return

      const results = detectShapes(video)
      if (cancelled) return
      setShapes(results)
      if (results.length > 0 && isStreaming) sendShape(results[0].shapeName, results[0].confidence)

      if (!canvas) return
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = '#22D3EE'
      ctx.lineWidth = 2
      ctx.font = '14px sans-serif'
      for (const shape of results) {
        if (shape.contour.length < 2) continue
        ctx.beginPath()
        ctx.moveTo(shape.contour[0].x, shape.contour[0].y)
        for (let i = 1; i < shape.contour.length; i++) {
          ctx.lineTo(shape.contour[i].x, shape.contour[i].y)
        }
        ctx.closePath()
        ctx.stroke()
        const { x, y } = shape.boundingBox
        const label = `${shape.shapeName} ${shape.confidence}%`
        const labelWidth = ctx.measureText(label).width + 8
        ctx.fillStyle = '#22D3EE'
        ctx.fillRect(x, Math.max(0, y - 18), labelWidth, 18)
        ctx.fillStyle = '#083344'
        ctx.fillText(label, x + 4, Math.max(13, y - 4))
      }
    }, SHAPE_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [shapeEnabled, shapeModelReady, isStreaming])

  // ── Face expression recognition (independent toggle, own canvas layer, off by default) ──
  useEffect(() => {
    if (!expressionEnabled || expressionModelReady || expressionLoading) return
    setExpressionLoading(true)
    loadExpressionDetector()
      .then(() => setExpressionModelReady(true))
      .catch(err => console.error('[AIVisionPanel] Expression detector load failed', err))
      .finally(() => setExpressionLoading(false))
  }, [expressionEnabled, expressionModelReady, expressionLoading])

  useEffect(() => {
    if (!expressionEnabled || !expressionModelReady) {
      // Clear any stale overlay when turned off. Own canvas, so this never
      // touches the gesture/object/shape overlays layered beneath it.
      const canvas = expressionCanvasRef.current
      if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
      return
    }
    let cancelled = false
    const id = setInterval(async () => {
      // detectExpression() is async (unlike the other three detectors) — skip this tick if the
      // previous call hasn't resolved yet, so slow frames don't stack up overlapping requests.
      if (expressionBusyRef.current) return
      const video = videoRef.current
      const canvas = expressionCanvasRef.current
      if (cancelled || !video || video.readyState < 2) return

      expressionBusyRef.current = true
      try {
        const result = await detectExpression(video)
        if (cancelled) return
        setExpression(result)
        if (result && isStreaming) sendExpression(result.expression, result.confidence)

        if (!canvas) return
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
        }
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        if (result) {
          const { x, y, width, height } = result.boundingBox
          ctx.strokeStyle = '#FB7185'
          ctx.lineWidth = 2
          ctx.strokeRect(x, y, width, height)
          ctx.font = '14px sans-serif'
          const label = `${result.expression} ${result.confidence}%`
          const labelWidth = ctx.measureText(label).width + 8
          ctx.fillStyle = '#FB7185'
          ctx.fillRect(x, Math.max(0, y - 18), labelWidth, 18)
          ctx.fillStyle = '#4C0519'
          ctx.fillText(label, x + 4, Math.max(13, y - 4))
        }
      } catch (err) {
        console.error('[AIVisionPanel] Expression detection failed', err)
      } finally {
        expressionBusyRef.current = false
      }
    }, EXPRESSION_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [expressionEnabled, expressionModelReady, isStreaming])

  const refreshCounts = useCallback(() => setClassCounts(getClassCounts()), [])

  const handleAddClass = () => {
    const name = newClassName.trim()
    if (!name || classes.includes(name)) return
    setClasses(prev => [...prev, name])
    setNewClassName('')
  }

  const handleRemoveClass = (name: string) => {
    clearClass(name)
    setClasses(prev => prev.filter(c => c !== name))
    refreshCounts()
  }

  const startRecording = (name: string) => {
    if (!modelReady || !videoRef.current) return
    setRecordingClass(name)
    recordIntervalRef.current = setInterval(() => {
      if (!videoRef.current) return
      addExample(videoRef.current, name)
      refreshCounts()
    }, RECORD_INTERVAL_MS)
  }

  const stopRecording = () => {
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current)
      recordIntervalRef.current = null
    }
    setRecordingClass(null)
  }

  useEffect(() => {
    return () => {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current)
    }
  }, [])

  const canPredict = modelReady && hasClasses()

  return (
    <div className="flex h-full overflow-hidden bg-surface-50">
      {/* ── Left: camera preview + mic meter ─────────────────────────────── */}
      <div className="flex flex-col w-[420px] shrink-0 border-r border-panel-border p-3 gap-3 overflow-y-auto">
        <div className="relative aspect-video bg-black rounded overflow-hidden border border-panel-border">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
          <canvas ref={objectCanvasRef} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
          <canvas ref={shapeCanvasRef} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
          <canvas ref={expressionCanvasRef} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
          {!cameraError && (
            <div className="absolute top-2 left-2 right-2 flex flex-col gap-1">
              {gestureEnabled && gestureResult && (
                <div className="flex items-center justify-between bg-surface-DEFAULT/85 border border-panel-border rounded px-2 py-1">
                  <span className="text-sm font-semibold text-fuchsia-300">{gestureResult.categoryName}</span>
                  <span className="text-xs text-slate-400 font-mono">{gestureResult.confidence}%</span>
                </div>
              )}
              {objectEnabled && objects.length > 0 && (
                <div className="flex items-center justify-between bg-surface-DEFAULT/85 border border-panel-border rounded px-2 py-1">
                  <span className="text-sm font-semibold text-emerald-300">
                    {objects[0].categoryName}{objects.length > 1 ? ` (+${objects.length - 1} more)` : ''}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">{objects[0].confidence}%</span>
                </div>
              )}
              {shapeEnabled && shapes.length > 0 && (
                <div className="flex items-center justify-between bg-surface-DEFAULT/85 border border-panel-border rounded px-2 py-1">
                  <span className="text-sm font-semibold text-cyan-300">
                    {shapes[0].shapeName}{shapes.length > 1 ? ` (+${shapes.length - 1} more)` : ''}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">{shapes[0].confidence}%</span>
                </div>
              )}
              {expressionEnabled && expression && (
                <div className="flex items-center justify-between bg-surface-DEFAULT/85 border border-panel-border rounded px-2 py-1">
                  <span className="text-sm font-semibold text-rose-300">{expression.expression}</span>
                  <span className="text-xs text-slate-400 font-mono">{expression.confidence}%</span>
                </div>
              )}
            </div>
          )}
          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-DEFAULT/95 text-center px-4">
              <AlertTriangle size={20} className="text-amber-400" />
              <span className="text-xs text-slate-300">{cameraError}</span>
            </div>
          )}
          {!cameraError && mode === 'predicting' && prediction && (
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-surface-DEFAULT/85 border border-panel-border rounded px-2 py-1">
              <span className="text-sm font-semibold text-purple-300">{prediction.className}</span>
              <span className="text-xs text-slate-400 font-mono">{prediction.confidence}%</span>
            </div>
          )}
          {!modelReady && !cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-DEFAULT/70 text-xs text-slate-300">
              Loading AI model…
            </div>
          )}
        </div>

        {/* Mic level meter */}
        <div className="flex items-center gap-2">
          <Mic size={14} className="text-slate-500 shrink-0" />
          <div className="flex-1 h-2 bg-surface-200 rounded overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-[width] duration-100"
              style={{ width: `${micLevel}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-500 font-mono w-8 text-right">{micLevel}%</span>
        </div>

        {/* Hand Gestures toggle (independent of Train/Predict) */}
        <button
          onClick={() => setGestureEnabled(e => !e)}
          className={`flex items-center justify-between gap-2 h-9 px-3 rounded text-sm font-medium border transition-colors ${
            gestureEnabled
              ? 'bg-fuchsia-600/20 border-fuchsia-500/40 text-fuchsia-200'
              : 'bg-surface-200 hover:bg-surface-300 border-panel-border text-slate-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <Hand size={14} />
            Hand Gesture Recognition
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {gestureEnabled ? (gestureLoading ? 'Loading…' : 'On') : 'Off'}
          </span>
        </button>

        {/* Object Detection toggle (independent of Train/Predict and Hand Gestures) */}
        <button
          onClick={() => setObjectEnabled(e => !e)}
          className={`flex items-center justify-between gap-2 h-9 px-3 rounded text-sm font-medium border transition-colors ${
            objectEnabled
              ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-200'
              : 'bg-surface-200 hover:bg-surface-300 border-panel-border text-slate-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <Scan size={14} />
            Object Detection
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {objectEnabled ? (objectLoading ? 'Loading…' : 'On') : 'Off'}
          </span>
        </button>

        {/* Shape Detection toggle (independent of Train/Predict, Hand Gestures, Object Detection) */}
        <button
          onClick={() => setShapeEnabled(e => !e)}
          className={`flex items-center justify-between gap-2 h-9 px-3 rounded text-sm font-medium border transition-colors ${
            shapeEnabled
              ? 'bg-cyan-600/20 border-cyan-500/40 text-cyan-200'
              : 'bg-surface-200 hover:bg-surface-300 border-panel-border text-slate-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <Shapes size={14} />
            Shape Detection
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {shapeEnabled ? (shapeLoading ? 'Loading…' : 'On') : 'Off'}
          </span>
        </button>

        {/* Face Expression toggle — temporarily disabled: face-api.js bundles its own
            private tfjs-core@1.7.0, which collides with the app's tfjs-core@4.22.0 over
            the shared global engine singleton and crashes inference ("forwardFunc is not
            a function"). Needs a dependency-level fix (shared tfjs-core version or a
            switch to @vladmandic/face-api) before this can be re-enabled. */}
        <button
          disabled
          title="Temporarily unavailable"
          className="flex items-center justify-between gap-2 h-9 px-3 rounded text-sm font-medium border transition-colors bg-surface-200 border-panel-border text-slate-500 opacity-50 cursor-not-allowed"
        >
          <span className="flex items-center gap-2">
            <Smile size={14} />
            Face Expression
          </span>
          <span className="text-[10px] font-mono text-slate-500">Unavailable</span>
        </button>

        {/* Mode toggle */}
        <div className="flex items-center h-8 shrink-0 rounded overflow-hidden border border-panel-border">
          <button
            onClick={() => setMode('training')}
            className={`flex-1 h-full text-xs font-semibold uppercase tracking-wide transition-colors ${
              mode === 'training'
                ? 'bg-purple-600/20 text-purple-300'
                : 'text-slate-500 hover:text-slate-300 hover:bg-surface-100'
            }`}
          >
            Train
          </button>
          <button
            onClick={() => setMode('predicting')}
            disabled={!canPredict}
            className={`flex-1 h-full text-xs font-semibold uppercase tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              mode === 'predicting'
                ? 'bg-purple-600/20 text-purple-300'
                : 'text-slate-500 hover:text-slate-300 hover:bg-surface-100'
            }`}
            title={!canPredict ? 'Record at least one class first' : undefined}
          >
            Predict
          </button>
        </div>

        {/* Streaming control */}
        <button
          onClick={() => setIsStreaming(s => !s)}
          disabled={!isSerialConnected}
          title={!isSerialConnected ? 'Connect a board from the toolbar first' : undefined}
          className={`flex items-center justify-center gap-2 h-9 rounded text-sm font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            isStreaming
              ? 'bg-purple-600/20 border-purple-500/40 text-purple-200'
              : 'bg-surface-200 hover:bg-surface-300 border-panel-border text-slate-200'
          }`}
        >
          {isStreaming ? <Square size={14} /> : <Play size={14} />}
          {isStreaming ? 'Stop Streaming to Board' : 'Start Streaming to Board'}
          {isStreaming && <Radio size={12} className="animate-pulse text-purple-400" />}
        </button>
      </div>

      {/* ── Right: class management ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 h-8 shrink-0 border-b border-panel-border bg-surface-100/50">
          <Camera size={13} className="text-slate-500" />
          <span className="text-xs font-semibold text-slate-400 tracking-wide uppercase">
            Classes {classes.length > 0 && `(${classes.length})`}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {classes.length === 0 && (
            <div className="text-xs text-slate-500 italic">
              Add a class below, then hold "Record" while showing the camera examples of it.
            </div>
          )}
          {classes.map(name => (
            <div
              key={name}
              className="flex items-center gap-2 p-2 bg-surface-100 border border-panel-border rounded"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-200 truncate">{name}</div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {classCounts[name] ?? 0} samples
                </div>
              </div>
              <button
                onMouseDown={() => startRecording(name)}
                onMouseUp={stopRecording}
                onMouseLeave={stopRecording}
                disabled={!modelReady || mode !== 'training'}
                className={`px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  recordingClass === name
                    ? 'bg-red-600/30 text-red-300 border border-red-500/40'
                    : 'bg-surface-200 hover:bg-surface-300 text-slate-200 border border-panel-border'
                }`}
              >
                {recordingClass === name ? 'Recording…' : 'Hold to Record'}
              </button>
              <button
                onClick={() => handleRemoveClass(name)}
                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-surface-200 rounded transition-colors"
                title="Remove class"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 p-3 border-t border-panel-border bg-surface-100/50">
          <input
            type="text"
            value={newClassName}
            onChange={e => setNewClassName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddClass()}
            placeholder="New class name (e.g. thumbs_up)"
            className="flex-1 bg-surface-200 border border-panel-border rounded px-2 py-1.5 text-sm text-slate-200 focus:ring-0 outline-none"
          />
          <button
            onClick={handleAddClass}
            disabled={!newClassName.trim()}
            className="flex items-center gap-1 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 disabled:opacity-40 disabled:cursor-not-allowed text-purple-200 rounded text-sm font-medium transition-colors"
          >
            <Plus size={14} /> Add Class
          </button>
        </div>
      </div>
    </div>
  )
}
