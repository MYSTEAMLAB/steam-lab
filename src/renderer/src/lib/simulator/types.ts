/**
 * Runtime state shape for the block simulator. Mirrors, in JS values, what the
 * generated Arduino sketch would hold on real hardware — see arduinoGenerator.ts
 * for the C++ this is standing in for.
 */
export interface OledState {
  lines: string[]
  inverted: boolean
}

export interface BluetoothState {
  began: boolean
  name: string
  /** Lines a student typed into the virtual monitor, waiting to be "received". */
  rxQueue: string[]
}

export interface WifiState {
  connected: boolean
  ip: string
}

export interface MotorVisual {
  /** -255..255. Sign is direction, magnitude is speed, for a simple spin animation. */
  power: number
}

export interface SimSnapshot {
  running: boolean
  paused: boolean
  /** Pin name (normalized, no "GPIO" prefix) -> last written/read value. */
  pins: Record<string, number>
  vars: Record<string, number | string | boolean>
  serialLog: string[]
  oled: OledState
  bluetooth: BluetoothState
  wifi: WifiState
  /** Servo pin -> angle 0-180. */
  servoAngles: Record<string, number>
  /** Motor-bearing device id -> spin visual. */
  motors: Record<string, MotorVisual>
  /** Buzzer pin -> last tone() frequency, present only while the tone is active. */
  buzzerFreq: Record<string, number>
  /**
   * Student-controlled sensor values. Keyed by device id for single-value sensors,
   * or `${deviceId}:VRX` / `${deviceId}:VRY` for the two-axis joystick.
   */
  sensorInputs: Record<string, number | boolean>
  loopCount: number
  error: string | null
}

/** Sensor kinds the simulator gives a live, student-editable control for. */
export type SensorControlKind =
  | 'button' // boolean press/hold
  | 'range' // numeric slider (LDR, potentiometer, IR analog, ultrasonic, temp, touch raw)
  | 'toggle' // boolean on/off (IR object detected, touch)
  | 'joystick' // 2D pad (vrx/vry)

export interface SensorControlSpec {
  deviceId: string
  deviceType: string
  kind: SensorControlKind
  label: string
  min?: number
  max?: number
  step?: number
  default: number | boolean
}
