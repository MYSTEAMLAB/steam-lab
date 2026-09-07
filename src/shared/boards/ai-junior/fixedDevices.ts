import type { PlacedDevice } from '../../types/project'

// AI Junior's fixed onboard hardware — the LED matrix, mic, 2 motors, 4
// buttons, and buzzer are physically pre-wired on the PCB (not optional
// drag-in parts), so they're seeded onto the canvas automatically whenever
// this board is selected (see useAppStore.ts's setBoard) and are also
// embedded verbatim into every AI-Junior-targeted example project below
// (see examples/index.ts's aiJuniorDevices helper) so opening an example
// doesn't wipe them off the canvas — loadProject() replaces a board's whole
// device list rather than merging into it.
//
// Framework-free (no Zustand/React imports) so both the renderer store and
// the shared examples module — which is also imported by the main process
// menu — can use it without pulling renderer-only code into main.
export const AI_JUNIOR_FIXED_DEVICES: PlacedDevice[] = [
  { id: 'led_matrix', type: 'led_matrix', name: 'led_matrix', mappedPin: 'GPIO15', canvasX: 390, canvasY: 150 } as PlacedDevice,
  { id: 'onboard_mic', type: 'onboard_mic', name: 'onboard_mic', mappedPin: { sd: 'GPIO25', ws: 'GPIO26', sck: 'GPIO27' }, canvasX: 130, canvasY: 130 } as PlacedDevice,
  { id: 'sw1', type: 'button', name: 'sw1', mappedPin: 'GPIO32', canvasX: 320, canvasY: 290 } as PlacedDevice,
  { id: 'sw2', type: 'button', name: 'sw2', mappedPin: 'GPIO33', canvasX: 365, canvasY: 290 } as PlacedDevice,
  { id: 'sw3', type: 'button', name: 'sw3', mappedPin: 'GPIO14', canvasX: 410, canvasY: 290 } as PlacedDevice,
  { id: 'sw4', type: 'button', name: 'sw4', mappedPin: 'GPIO13', canvasX: 455, canvasY: 290 } as PlacedDevice,
  { id: 'buzzer1', type: 'buzzer', name: 'buzzer1', mappedPin: 'GPIO12', canvasX: 390, canvasY: 360 } as PlacedDevice,
  { id: 'motor1', type: 'dcmotor', name: 'motor1', mappedPin: { in1: 'GPIO18', in2: 'GPIO19' }, canvasX: 170, canvasY: 272 } as PlacedDevice,
  { id: 'motor2', type: 'dcmotor', name: 'motor2', mappedPin: { in1: 'GPIO5', in2: 'GPIO17' }, canvasX: 170, canvasY: 316 } as PlacedDevice
]
