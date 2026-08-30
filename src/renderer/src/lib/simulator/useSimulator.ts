import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import * as Blockly from 'blockly/core'
import type { PlacedDevice } from '@shared/types/project'
import { SimulatorEngine } from './engine'
import type { SimSnapshot } from './types'

const EMPTY_SNAPSHOT: SimSnapshot = {
  running: false, paused: false, pins: {}, vars: {}, serialLog: [],
  oled: { lines: [], inverted: false },
  bluetooth: { began: false, name: '', rxQueue: [] },
  wifi: { connected: false, ip: '' },
  servoAngles: {}, motors: {}, buzzerFreq: {}, sensorInputs: {},
  loopCount: 0, error: null,
}

const getLiveWorkspace = (): Blockly.Workspace | null => (window as any).blocklyWorkspace ?? null

/** Owns the SimulatorEngine for the Simulator tab. */
export function useSimulator(devices: PlacedDevice[], boardId: string | undefined) {
  const [engine, setEngine] = useState<SimulatorEngine | null>(null)
  const devicesRef = useRef(devices)
  devicesRef.current = devices

  useEffect(() => {
    if (!boardId) return
    // Pass a getter, not a captured workspace object: BlocklyWorkspace.tsx fully
    // disposes and re-injects a new Blockly.WorkspaceSvg instance whenever
    // `selectedBoard` changes by reference (which happens on every project/example
    // load, not just an actual board switch), so a reference grabbed once here
    // would silently go stale and point at an emptied, orphaned workspace.
    const e = new SimulatorEngine(getLiveWorkspace, devicesRef.current, boardId)
    setEngine(e)
    if (typeof window !== 'undefined') (window as any).simulatorEngine = e
    return () => { e.stop() }
  }, [boardId])

  useEffect(() => { engine?.setDevices(devices) }, [engine, devices])

  const subscribe = useCallback(
    (onChange: () => void) => (engine ? engine.subscribe(onChange) : () => {}),
    [engine]
  )
  const getSnapshot = useCallback(
    () => (engine ? engine.getSnapshot() : EMPTY_SNAPSHOT),
    [engine]
  )
  const snapshot = useSyncExternalStore(subscribe, getSnapshot)

  return { engine, snapshot }
}
