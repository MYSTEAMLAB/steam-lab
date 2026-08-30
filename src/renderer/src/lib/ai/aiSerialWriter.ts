import { useAppStore } from '@renderer/store/useAppStore'

// Throttled, single-in-flight writer onto the SAME serial port Toolbar/
// SerialMonitor already own — this module never opens/closes a port itself.
// A beginner Blockly program's loop() will often contain delay(...), so the
// ESP32 only drains its RX buffer sporadically; always sending the LATEST
// state (never queuing deltas) at a bounded rate is the correct tradeoff —
// slightly stale data beats an unbounded write backlog.

const MIN_INTERVAL_MS = 220 // ~4-5 Hz

let inFlight = false
let lastSendTime = 0

function sendLine(line: string): void {
  if (!useAppStore.getState().isSerialConnected) return
  if (inFlight) return
  const now = Date.now()
  if (now - lastSendTime < MIN_INTERVAL_MS) return

  inFlight = true
  lastSendTime = now
  window.api.serial
    .write(line)
    .catch((err: unknown) => console.error('[aiSerialWriter] write failed', err))
    .finally(() => {
      inFlight = false
    })
}

/** Sanitize a user-typed class name so it can't break the wire protocol. */
function safeToken(value: string): string {
  return value.replace(/[:\r\n]/g, '_')
}

export function sendClassPrediction(className: string, confidencePct: number): void {
  sendLine(`AI:CLASS:${safeToken(className)}:${Math.round(confidencePct)}\n`)
}

export function sendMicLevel(levelPct: number): void {
  sendLine(`AI:MIC:${Math.round(levelPct)}\n`)
}

export function sendGesture(categoryName: string, confidencePct: number): void {
  sendLine(`AI:GESTURE:${safeToken(categoryName)}:${Math.round(confidencePct)}\n`)
}

export function sendObject(categoryName: string, confidencePct: number): void {
  sendLine(`AI:OBJECT:${safeToken(categoryName)}:${Math.round(confidencePct)}\n`)
}

export function sendShape(shapeName: string, confidencePct: number): void {
  sendLine(`AI:SHAPE:${safeToken(shapeName)}:${Math.round(confidencePct)}\n`)
}

export function sendExpression(expression: string, confidencePct: number): void {
  sendLine(`AI:EXPRESSION:${safeToken(expression)}:${Math.round(confidencePct)}\n`)
}
