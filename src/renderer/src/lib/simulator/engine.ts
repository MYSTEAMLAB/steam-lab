import * as Blockly from 'blockly/core'
import type { PlacedDevice } from '@shared/types/project'
import type { SimSnapshot } from './types'
import { normalizePin, isValidPin, devicePin, findDevice, clamp, LED_PAIRED_GND } from './helpers'

// ─────────────────────────────────────────────────────────────────────────────
// Block simulator engine
//
// Interprets the LIVE Blockly workspace directly — the same block tree the
// student sees on the Blocks tab — rather than parsing the generated C++. Each
// block type below is a hand port of its matching arduinoGenerator.ts codegen
// entry: instead of emitting a code string, it mutates engine state (pins,
// variables, the OLED buffer, ...) so the Simulator tab's device renderers can
// show what the real board would be doing.
//
// Execution is a single JS generator (`program()`) that yields control back to
// the browser at every `delay()` call and at least once per loop() pass, so a
// long delay or an infinite loop can't freeze the UI. A per-statement budget
// (STMT_BUDGET) forces an extra yield inside tight loops that never call delay,
// so e.g. `forever { }` with no delay still keeps the tab responsive.
// ─────────────────────────────────────────────────────────────────────────────

type Block = Blockly.Block

type Yielded = { kind: 'delay'; ms: number } | { kind: 'tick' }
type StmtGen = Generator<Yielded, void, void>
type ValGen = Generator<Yielded, unknown, void>
type StmtHandler = (e: SimulatorEngine, b: Block) => StmtGen
type ValueHandler = (e: SimulatorEngine, b: Block) => ValGen

const STMT_BUDGET = 400
const WHILE_GUARD = 200000

function pinOf(b: Block): string {
  return normalizePin(b.getFieldValue('PIN'))
}

function compare(op: string, a: unknown, b: unknown): boolean {
  const an = Number(a)
  const bn = Number(b)
  const bothNumeric = typeof a !== 'boolean' && typeof b !== 'boolean' && !Number.isNaN(an) && !Number.isNaN(bn)
  const av = bothNumeric ? an : a
  const bv = bothNumeric ? bn : b
  switch (op) {
    case 'EQ': return av === bv
    case 'NEQ': return av !== bv
    case 'LT': return (av as any) < (bv as any)
    case 'LTE': return (av as any) <= (bv as any)
    case 'GT': return (av as any) > (bv as any)
    case 'GTE': return (av as any) >= (bv as any)
    default: return false
  }
}

// ── Sensor-aware pin reads ────────────────────────────────────────────────────
// A pin driven by a placed sensor device reflects that device's live control
// (the slider/button the student is holding) instead of whatever was last
// written to the pin — mirrors a real sensor's voltage divider overriding
// nothing was ever "written" to that pin in the first place.
function readDigital(e: SimulatorEngine, pinOrDevId: string, activeLowWhenTrue: boolean): number {
  const dev = findDevice(e.devices, pinOrDevId)
  if (dev && dev.id in e.sensorInputs) {
    const truthy = !!e.sensorInputs[dev.id]
    return activeLowWhenTrue ? (truthy ? 0 : 1) : (truthy ? 1 : 0)
  }
  const pin = devicePin(e.devices, pinOrDevId) || pinOrDevId
  return e.pins[pin] ?? 0
}

function readAnalog(e: SimulatorEngine, pinOrDevId: string): number {
  const dev = findDevice(e.devices, pinOrDevId)
  if (dev && dev.id in e.sensorInputs) return Number(e.sensorInputs[dev.id]) || 0
  const pin = devicePin(e.devices, pinOrDevId) || pinOrDevId
  return e.pins[pin] ?? 0
}

function readFloat(e: SimulatorEngine, pinOrDevId: string, fallback: number): number {
  const dev = findDevice(e.devices, pinOrDevId)
  if (dev && dev.id in e.sensorInputs) return Number(e.sensorInputs[dev.id])
  return fallback
}

function readBool(e: SimulatorEngine, pinOrDevId: string): boolean {
  const dev = findDevice(e.devices, pinOrDevId)
  if (dev && dev.id in e.sensorInputs) return !!e.sensorInputs[dev.id]
  return false
}

function readJoystickAxis(e: SimulatorEngine, index: number, axis: string): number {
  const joys = e.devices.filter(d => d.type === 'joystick')
  const dev = joys[index]
  if (!dev) return 0
  const key = `${dev.id}:${axis}`
  return key in e.sensorInputs ? Number(e.sensorInputs[key]) || 0 : 2048
}

function oledWrite(e: SimulatorEngine, text: string): void {
  e.oledLines.push(text)
  if (e.oledLines.length > 8) e.oledLines.shift()
}

// Matches the OLED_ICON_OPTIONS labels in customBlocks.ts, so the simulator's text
// buffer shows the same glyph the block dropdown does instead of a bare ID.
const OLED_ICON_GLYPHS: Record<string, string> = {
  ARROW_UP: '↑', ARROW_DOWN: '↓', ARROW_LEFT: '←', ARROW_RIGHT: '→',
  DOT: '●', SQUARE: '■', HEART: '♥', STAR: '★', CHECK: '✓', CROSS: '✗'
}

// ─────────────────────────────────────────────────────────────────────────────
// Statement handlers — one per block.type with a previousStatement/nextStatement
// ─────────────────────────────────────────────────────────────────────────────

const STATEMENT_HANDLERS: Record<string, StmtHandler> = {
  system_delay: function* (e, b) {
    const ms = Number(b.getFieldValue('MS')) || 1000
    yield { kind: 'delay', ms }
  },

  serial_print: function* (e, b) { e.pushSerial(String(yield* e.evalInput(b, 'TEXT', ''))) },
  text_print: function* (e, b) { e.pushSerial(String(yield* e.evalInput(b, 'TEXT', ''))) },

  output_led_on: function* (e, b) {
    const devIdOrPin = pinOf(b) || 'LED_BUILTIN'
    const pin = devicePin(e.devices, devIdOrPin) || devIdOrPin
    const gnd = LED_PAIRED_GND[pin]
    if (gnd) e.pins[gnd] = 0
    e.pins[pin] = 1
  },
  output_led_off: function* (e, b) {
    const devIdOrPin = pinOf(b) || 'LED_BUILTIN'
    const pin = devicePin(e.devices, devIdOrPin) || devIdOrPin
    const gnd = LED_PAIRED_GND[pin]
    if (gnd) e.pins[gnd] = 0
    e.pins[pin] = 0
  },

  output_buzzer_on: function* (e, b) { e.pins[pinOf(b)] = 1 },
  output_buzzer_off: function* (e, b) { const p = pinOf(b); e.pins[p] = 0; delete e.buzzerFreq[p] },
  output_buzzer_tone: function* (e, b) {
    const pin = pinOf(b)
    const freq = Number(yield* e.evalInput(b, 'FREQ', 1000)) || 1000
    e.pins[pin] = 1
    e.buzzerFreq[pin] = freq
  },
  output_buzzer_notone: function* (e, b) { const p = pinOf(b); e.pins[p] = 0; delete e.buzzerFreq[p] },

  output_servo_write: function* (e, b) {
    const pin = pinOf(b)
    if (!isValidPin(pin)) return
    const angle = Number(yield* e.evalInput(b, 'ANGLE', 90)) || 0
    e.servoAngles[pin] = clamp(angle, 0, 180)
  },

  output_digital_write: function* (e, b) {
    const pin = pinOf(b)
    if (!isValidPin(pin)) return
    e.pins[pin] = (b.getFieldValue('STATE') || 'LOW') === 'HIGH' ? 1 : 0
  },

  output_analog_write: function* (e, b) {
    const pin = pinOf(b)
    if (!isValidPin(pin)) return
    e.pins[pin] = clamp(Number(yield* e.evalInput(b, 'NUM', 0)) || 0, 0, 255)
  },

  pin_mode: function* (e, b) {
    const pin = pinOf(b)
    if (!isValidPin(pin)) return
    e.pinModes[pin] = b.getFieldValue('MODE')
  },

  output_dcmotor_set: function* (e, b) {
    const devId = pinOf(b)
    const state = b.getFieldValue('STATE') || 'STOP'
    const speed = clamp(Number(yield* e.evalInput(b, 'SPEED', 255)) || 0, 0, 255)
    const in1 = devicePin(e.devices, devId, 'in1')
    const in2 = devicePin(e.devices, devId, 'in2')
    if (!isValidPin(in1) || !isValidPin(in2)) return
    let power = 0
    if (state === 'FWD') { e.pins[in1] = speed; e.pins[in2] = 0; power = speed }
    else if (state === 'REV' || state === 'HIGH') { e.pins[in1] = 0; e.pins[in2] = speed; power = -speed }
    else { e.pins[in1] = 0; e.pins[in2] = 0; power = 0 }
    const dev = findDevice(e.devices, devId)
    if (dev) e.motors[dev.id] = { power }
  },

  output_dcmotor_speed: function* (e, b) {
    const speed = clamp(Number(yield* e.evalInput(b, 'SPEED', 0)) || 0, 0, 255)
    const motor = e.devices.find(d => d.type === 'dcmotor')
    if (!motor || typeof motor.mappedPin !== 'object') return
    const pwmPin = normalizePin((motor.mappedPin as Record<string, string>).pwm)
    if (!isValidPin(pwmPin)) return
    e.pins[pwmPin] = speed
    const prevSign = Math.sign(e.motors[motor.id]?.power ?? 1) || 1
    e.motors[motor.id] = { power: prevSign * speed }
  },

  output_motor_driver_set: function* (e, b) {
    const devId = pinOf(b)
    const action = b.getFieldValue('ACTION')
    const speed = clamp(Number(yield* e.evalInput(b, 'SPEED', 255)) || 0, 0, 255)
    const enA = devicePin(e.devices, devId, 'enA')
    const in1 = devicePin(e.devices, devId, 'in1')
    const in2 = devicePin(e.devices, devId, 'in2')
    const enB = devicePin(e.devices, devId, 'enB')
    const in3 = devicePin(e.devices, devId, 'in3')
    const in4 = devicePin(e.devices, devId, 'in4')
    if (![enA, in1, in2, enB, in3, in4].every(isValidPin)) return
    e.pins[enA] = speed
    e.pins[enB] = speed
    const set = (a: number, bb: number, c: number, d: number) => {
      e.pins[in1] = a; e.pins[in2] = bb; e.pins[in3] = c; e.pins[in4] = d
    }
    let power = 0
    if (action === 'FWD') { set(1, 0, 1, 0); power = speed }
    else if (action === 'REV') { set(0, 1, 0, 1); power = -speed }
    else if (action === 'LEFT') { set(0, 1, 1, 0); power = speed * 0.5 }
    else if (action === 'RIGHT') { set(1, 0, 0, 1); power = -speed * 0.5 }
    else set(0, 0, 0, 0)
    const dev = findDevice(e.devices, devId)
    if (dev) e.motors[dev.id] = { power }
  },

  variables_set: function* (e, b) {
    e.setVar(b.getFieldValue('VAR'), yield* e.evalInput(b, 'VALUE', 0))
  },
  math_change: function* (e, b) {
    const varId = b.getFieldValue('VAR')
    const delta = Number(yield* e.evalInput(b, 'DELTA', 1)) || 0
    e.setVar(varId, (Number(e.getVar(varId)) || 0) + delta)
  },
  declare_variable: function* (e, b) {
    const varId = b.getFieldValue('VAR')
    if (e.vars[varId] === undefined) e.setVar(varId, 0)
  },

  controls_if: function* (e, b) {
    let n = 0
    for (;;) {
      const cond = yield* e.evalValue(b.getInputTargetBlock('IF' + n), false)
      if (cond) { yield* e.runStack(b.getInputTargetBlock('DO' + n)); return }
      n++
      if (!b.getInput('IF' + n)) break
    }
    if (b.getInput('ELSE')) yield* e.runStack(b.getInputTargetBlock('ELSE'))
  },

  controls_repeat_ext: function* (e, b) {
    const times = Math.max(0, Math.floor(Number(yield* e.evalInput(b, 'TIMES', 0)) || 0))
    for (let i = 0; i < times; i++) yield* e.runStack(b.getInputTargetBlock('DO'))
  },

  controls_whileUntil: function* (e, b) {
    const until = b.getFieldValue('MODE') === 'UNTIL'
    let guard = 0
    for (;;) {
      const raw = yield* e.evalValue(b.getInputTargetBlock('BOOL'), false)
      const cond = until ? !raw : !!raw
      if (!cond) break
      yield* e.runStack(b.getInputTargetBlock('DO'))
      if (++guard > WHILE_GUARD) {
        e.warnOnce(b.id, '[Sim] A while-loop ran for a very long time and was stopped.')
        break
      }
    }
  },

  controls_forever: function* (e, b) {
    for (;;) {
      yield* e.runStack(b.getInputTargetBlock('DO'))
      yield { kind: 'tick' }
    }
  },

  controls_for: function* (e, b) {
    const varId = b.getFieldValue('VAR')
    const from = Number(yield* e.evalInput(b, 'FROM', 0)) || 0
    const to = Number(yield* e.evalInput(b, 'TO', 10)) || 0
    const byRaw = Number(yield* e.evalInput(b, 'BY', 1)) || 1
    const step = byRaw === 0 ? 1 : byRaw
    if (step > 0) {
      for (let i = from; i <= to; i += step) { e.setVar(varId, i); yield* e.runStack(b.getInputTargetBlock('DO')) }
    } else {
      for (let i = from; i >= to; i += step) { e.setVar(varId, i); yield* e.runStack(b.getInputTargetBlock('DO')) }
    }
  },

  my_program_block: function* (e, b) { yield* e.runStack(b.getInputTargetBlock('DO')) },

  oled_init: function* () {},
  oled_print: function* (e, b) { oledWrite(e, String(yield* e.evalInput(b, 'TEXT', ''))) },
  oled_draw_text: function* (e, b) { oledWrite(e, String(yield* e.evalInput(b, 'TEXT', ''))) },
  oled_show_var: function* (e, b) { oledWrite(e, String(yield* e.evalInput(b, 'VAR', ''))) },
  oled_show_char: function* (e, b) { oledWrite(e, String(yield* e.evalInput(b, 'CHAR', ''))) },
  oled_set_cursor: function* () {},
  oled_clear: function* (e) { e.oledLines.length = 0 },
  oled_text_size: function* () {},
  oled_icon: function* (e, b) {
    const icon = b.getFieldValue('ICON') || 'DOT'
    oledWrite(e, `[${OLED_ICON_GLYPHS[icon] || icon}]`)
  },
  oled_blink: function* (e, b) {
    const v = b.getFieldValue('STATE')
    e.oledInverted = v === '1' || v === 'true' || v === true
  },
  oled_scroll: function* () {},
  oled_color: function* () {},

  bluetooth_begin: function* (e, b) {
    const name = b.getFieldValue('NAME') || 'MY_STEAM_LAB'
    e.bt.began = true
    e.bt.name = name
    e.pushSerial(`[Bluetooth] Radio started as "${name}"`)
  },
  bluetooth_send: function* (e, b) {
    e.pushSerial(`[BT TX] ${yield* e.evalInput(b, 'TEXT', '')}`)
  },

  wifi_connect: function* (e, b) {
    const ssid = yield* e.evalInput(b, 'SSID', '')
    yield { kind: 'delay', ms: 300 } // a beat, matching the real connect delay loop
    e.wifi.connected = true
    e.wifi.ip = '192.168.1.50'
    e.pushSerial(`[WiFi] Connected to "${ssid}". IP address: ${e.wifi.ip}`)
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Value handlers — one per block.type with an output connection
// ─────────────────────────────────────────────────────────────────────────────

const VALUE_HANDLERS: Record<string, ValueHandler> = {
  math_number: function* (_e, b) { return Number(b.getFieldValue('NUM')) || 0 },
  text: function* (_e, b) { return b.getFieldValue('TEXT') || '' },
  logic_boolean: function* (_e, b) { return b.getFieldValue('BOOL') === 'TRUE' },
  logic_negate: function* (e, b) { return !(yield* e.evalInput(b, 'BOOL', false)) },
  logic_compare: function* (e, b) {
    return compare(b.getFieldValue('OP'), yield* e.evalInput(b, 'A', 0), yield* e.evalInput(b, 'B', 0))
  },
  logic_double_equals: function* (e, b) {
    return compare('EQ', yield* e.evalInput(b, 'A', 0), yield* e.evalInput(b, 'B', 0))
  },
  logic_operation: function* (e, b) {
    const op = b.getFieldValue('OP')
    const a = yield* e.evalInput(b, 'A', false)
    const bb = yield* e.evalInput(b, 'B', false)
    return op === 'AND' ? (!!a && !!bb) : (!!a || !!bb)
  },
  logic_and_text: function* (e, b) {
    return !!(yield* e.evalInput(b, 'A', false)) && !!(yield* e.evalInput(b, 'B', false))
  },

  math_arithmetic: function* (e, b) {
    const op = b.getFieldValue('OP')
    const a = Number(yield* e.evalInput(b, 'A', 0)) || 0
    const bb = Number(yield* e.evalInput(b, 'B', 0)) || 0
    switch (op) {
      case 'ADD': return a + bb
      case 'MINUS': return a - bb
      case 'MULTIPLY': return a * bb
      case 'DIVIDE': return bb === 0 ? 0 : a / bb
      case 'POWER': return Math.pow(a, bb)
      default: return a + bb
    }
  },
  math_modulo: function* (e, b) {
    const a = Number(yield* e.evalInput(b, 'DIVIDEND', 0)) || 0
    const bb = Number(yield* e.evalInput(b, 'DIVISOR', 1)) || 1
    return a % bb
  },
  math_random_int: function* (e, b) {
    const from = Math.floor(Number(yield* e.evalInput(b, 'FROM', 0)) || 0)
    const to = Math.floor(Number(yield* e.evalInput(b, 'TO', 100)) || 100)
    const lo = Math.min(from, to)
    const hi = Math.max(from, to)
    return lo + Math.floor(Math.random() * (hi - lo + 1))
  },
  math_single: function* (e, b) {
    const op = b.getFieldValue('OP')
    const n = Number(yield* e.evalInput(b, 'NUM', 0)) || 0
    switch (op) {
      case 'ROOT': return Math.sqrt(n)
      case 'ABS': return Math.abs(n)
      case 'NEG': return -n
      case 'LN': return Math.log(n)
      case 'LOG10': return Math.log10(n)
      case 'EXP': return Math.exp(n)
      case 'POW10': return Math.pow(10, n)
      default: return Math.abs(n)
    }
  },
  math_constrain: function* (e, b) {
    const val = Number(yield* e.evalInput(b, 'VALUE', 0)) || 0
    const lo = Number(yield* e.evalInput(b, 'LOW', 0)) || 0
    const hi = Number(yield* e.evalInput(b, 'HIGH', 0)) || 0
    return clamp(val, lo, hi)
  },
  math_round: function* (e, b) {
    const op = b.getFieldValue('OP')
    const n = Number(yield* e.evalInput(b, 'NUM', 0)) || 0
    if (op === 'ROUNDUP') return Math.ceil(n)
    if (op === 'ROUNDDOWN') return Math.floor(n)
    return Math.round(n)
  },

  text_join: function* (e, b) {
    const count = (b as any).itemCount_ ?? 2
    let out = ''
    for (let i = 0; i < count; i++) out += String(yield* e.evalInput(b, 'ADD' + i, ''))
    return out
  },

  variables_get: function* (e, b) { return e.getVar(b.getFieldValue('VAR')) },

  input_digital_read: function* (e, b) { const p = pinOf(b); return isValidPin(p) ? readDigital(e, p, false) : 0 },
  input_analog_read: function* (e, b) { const p = pinOf(b); return isValidPin(p) ? readAnalog(e, p) : 0 },
  input_button_read: function* (e, b) { const p = pinOf(b); return isValidPin(p) ? readDigital(e, p, true) : 0 },
  input_button_pressed: function* (e, b) { const p = pinOf(b); return isValidPin(p) && readDigital(e, p, true) === 0 },

  input_ldr_read_analog: function* (e, b) { const p = pinOf(b); return isValidPin(p) ? readAnalog(e, p) : 0 },
  input_ldr_read_digital: function* (e, b) { const p = pinOf(b); return isValidPin(p) ? readAnalog(e, p) : 0 },
  input_ldr_is_dark: function* (e, b) {
    const p = pinOf(b)
    if (!isValidPin(p)) return false
    const threshold = Number(b.getFieldValue('THRESHOLD')) || 1000
    return readAnalog(e, p) < threshold
  },

  input_pot_read: function* (e, b) { const p = pinOf(b); return isValidPin(p) ? readAnalog(e, p) : 0 },
  input_potentiometer_read: function* (e, b) { const p = pinOf(b); return isValidPin(p) ? readAnalog(e, p) : 0 },

  input_ir_read: function* (e, b) { const p = pinOf(b); return isValidPin(p) ? readDigital(e, p, true) : 0 },
  input_ir_analog_read: function* (e, b) { const p = pinOf(b); return isValidPin(p) ? readAnalog(e, p) : 0 },

  input_temp_read: function* (e, b) { const p = pinOf(b); return isValidPin(p) ? readFloat(e, p, 25) : 0 },
  input_temp_is_hot: function* (e, b) { const p = pinOf(b); return isValidPin(p) && readFloat(e, p, 25) > 30 },
  input_dht_read: function* (_e, b) { return b.getFieldValue('TYPE') === 'TEMP' ? 25 : 50 },

  input_touch_read: function* (e, b) { const p = pinOf(b); return isValidPin(p) && readBool(e, p) },
  input_touch_raw: function* (e, b) { const p = pinOf(b); return isValidPin(p) ? (readBool(e, p) ? 12 : 80) : 80 },

  input_ultrasonic_read: function* (e, b) {
    const devId = pinOf(b)
    yield { kind: 'delay', ms: 50 } // matches the real sketch's blocking pulseIn()+delay(50)
    const dev = findDevice(e.devices, devId)
    if (dev && dev.id in e.sensorInputs) return Number(e.sensorInputs[dev.id]) || 0
    return 50
  },

  input_color_read: function* (e) {
    e.warnOnce('color', '[Sim] Color sensor readings are a fixed placeholder in the simulator.')
    return 128
  },

  input_joystick_read: function* (e, b) { return readJoystickAxis(e, 0, b.getFieldValue('AXIS')) },
  input_joystick1_read: function* (e, b) { return readJoystickAxis(e, 0, b.getFieldValue('AXIS')) },
  input_joystick2_read: function* (e, b) { return readJoystickAxis(e, 1, b.getFieldValue('AXIS')) },

  wifi_status: function* (e) { return e.wifi.connected },
  wifi_get_ip: function* (e) { return e.wifi.ip || '0.0.0.0' },
  wifi_http_request: function* (e) {
    e.warnOnce('wifi_http', "[Sim] WiFi HTTP requests aren't simulated — returning an empty response.")
    return ''
  },

  bluetooth_read: function* (e) { return e.bt.rxQueue.shift() ?? '' },
  bluetooth_available: function* (e) { return e.bt.rxQueue.length > 0 },
}

const AI_TEXT_DEFAULTS: Record<string, unknown> = {
  ai_predicted_class: '', ai_prediction_confidence: 0, ai_mic_level: 0,
  ai_hand_gesture: 'None', ai_gesture_confidence: 0, ai_hand_detected: false,
  ai_detected_object: 'None', ai_object_confidence: 0, ai_object_detected: false,
  ai_detected_shape: 'None', ai_shape_confidence: 0, ai_shape_detected: false,
  ai_detected_expression: 'None', ai_expression_confidence: 0, ai_face_detected: false,
  ai_is_class: false, ai_is_gesture: false, ai_is_object: false, ai_is_shape: false, ai_is_expression: false,
}
for (const aiType of Object.keys(AI_TEXT_DEFAULTS)) {
  const defaultValue = AI_TEXT_DEFAULTS[aiType]
  VALUE_HANDLERS[aiType] = function* (e: SimulatorEngine): ValGen {
    e.warnOnce('ai', '[Sim] AI Vision needs the real webcam — these blocks return neutral values in the simulator.')
    return defaultValue
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────────────────────────

export class SimulatorEngine {
  devices: PlacedDevice[]
  boardId: string

  pins: Record<string, number> = {}
  pinModes: Record<string, string> = {}
  vars: Record<string, number | string | boolean> = {}
  varNames: Record<string, string> = {}
  serialLog: string[] = []
  oledLines: string[] = []
  oledInverted = false
  bt: { began: boolean; name: string; rxQueue: string[] } = { began: false, name: '', rxQueue: [] }
  wifi: { connected: boolean; ip: string } = { connected: false, ip: '' }
  servoAngles: Record<string, number> = {}
  motors: Record<string, { power: number }> = {}
  buzzerFreq: Record<string, number> = {}
  sensorInputs: Record<string, number | boolean> = {}
  loopCount = 0
  error: string | null = null
  running = false
  paused = false

  // Fetched live rather than captured once: BlocklyWorkspace.tsx fully disposes
  // and re-injects a NEW Blockly.WorkspaceSvg (a new object, not just new content)
  // whenever `selectedBoard` changes by reference — which happens the moment a
  // project or example loads, since the rehydrated `selectedBoard` isn't `===`
  // the freshly-fetched `availableBoards` entry it gets swapped for. Caching the
  // workspace object at construction time meant the engine could end up pointed
  // at an orphaned, empty workspace with zero top blocks, silently doing nothing.
  private getWorkspace: () => Blockly.Workspace | null
  private listeners = new Set<() => void>()
  private rafHandle: number | null = null
  private timerHandle: ReturnType<typeof setTimeout> | null = null
  private gen: Generator<Yielded, void, void> | null = null
  private stmtBudget = STMT_BUDGET
  private warnedOnce = new Set<string>()

  constructor(getWorkspace: () => Blockly.Workspace | null, devices: PlacedDevice[], boardId: string) {
    this.getWorkspace = getWorkspace
    this.devices = devices
    this.boardId = boardId
  }

  // ── Subscription ──────────────────────────────────────────────────────────
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }
  // React's useSyncExternalStore requires getSnapshot() to return a stable
  // reference between notifications (it compares via Object.is to decide
  // whether to re-render). So the snapshot is computed once here, cached, and
  // handed out as-is until the next mutation — never rebuilt inside getSnapshot.
  private cachedSnapshot: SimSnapshot | null = null
  private notify(): void {
    this.cachedSnapshot = this.computeSnapshot()
    for (const l of this.listeners) l()
  }

  // ── External inputs ─────────────────────────────────────────────────────
  setDevices(devices: PlacedDevice[]): void { this.devices = devices }

  setSensorInput(key: string, value: number | boolean): void {
    this.sensorInputs[key] = value
    this.notify()
  }

  /** Feeds a line to Bluetooth Read/Available, as if received over the radio. */
  injectIncomingLine(line: string): void {
    if (!line) return
    this.bt.rxQueue.push(line)
    this.pushSerial(`[BT RX] ${line}`)
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────
  start(): void {
    if (this.running) return
    this.resetState()
    this.running = true
    this.paused = false
    try {
      this.gen = this.program()
    } catch (e: any) {
      this.error = e?.message || String(e)
      this.running = false
      this.notify()
      return
    }
    this.notify()
    this.pump()
  }

  pause(): void {
    if (!this.running) return
    this.paused = true
    this.clearTimers()
    this.notify()
  }

  resume(): void {
    if (!this.running || !this.paused) return
    this.paused = false
    this.notify()
    this.pump()
  }

  stop(): void {
    this.running = false
    this.paused = false
    this.gen = null
    this.clearTimers()
    this.notify()
  }

  reset(): void {
    this.stop()
    this.resetState()
    this.notify()
  }

  private resetState(): void {
    this.pins = {}
    this.pinModes = {}
    this.vars = {}
    this.varNames = {}
    this.serialLog = []
    this.oledLines = []
    this.oledInverted = false
    this.bt = { began: false, name: '', rxQueue: [] }
    this.wifi = { connected: false, ip: '' }
    this.servoAngles = {}
    this.motors = {}
    this.buzzerFreq = {}
    this.loopCount = 0
    this.error = null
    this.warnedOnce.clear()
    this.stmtBudget = STMT_BUDGET
    // sensorInputs intentionally preserved — Reset shouldn't snap the student's
    // slider/button positions back to their defaults.
  }

  private clearTimers(): void {
    if (this.rafHandle != null) { cancelAnimationFrame(this.rafHandle); this.rafHandle = null }
    if (this.timerHandle != null) { clearTimeout(this.timerHandle); this.timerHandle = null }
  }

  getSnapshot(): SimSnapshot {
    if (!this.cachedSnapshot) this.cachedSnapshot = this.computeSnapshot()
    return this.cachedSnapshot
  }

  private computeSnapshot(): SimSnapshot {
    return {
      running: this.running,
      paused: this.paused,
      pins: { ...this.pins },
      vars: this.namedVars(),
      serialLog: [...this.serialLog],
      oled: { lines: [...this.oledLines], inverted: this.oledInverted },
      bluetooth: { began: this.bt.began, name: this.bt.name, rxQueue: [...this.bt.rxQueue] },
      wifi: { ...this.wifi },
      servoAngles: { ...this.servoAngles },
      motors: { ...this.motors },
      buzzerFreq: { ...this.buzzerFreq },
      sensorInputs: { ...this.sensorInputs },
      loopCount: this.loopCount,
      error: this.error,
    }
  }

  private namedVars(): Record<string, number | string | boolean> {
    const out: Record<string, number | string | boolean> = {}
    for (const [id, val] of Object.entries(this.vars)) out[this.varNames[id] || id] = val
    return out
  }

  // ── Pump loop ────────────────────────────────────────────────────────────
  private pump = (): void => {
    if (!this.running || this.paused || !this.gen) return
    try {
      const { value, done } = this.gen.next()
      if (done) { this.running = false; this.notify(); return }
      this.notify()
      if (value.kind === 'delay') {
        this.timerHandle = setTimeout(this.pump, Math.max(0, value.ms))
      } else {
        this.rafHandle = requestAnimationFrame(this.pump)
      }
    } catch (e: any) {
      this.error = e?.message || String(e)
      this.running = false
      this.notify()
    }
  }

  // ── Program driver ──────────────────────────────────────────────────────
  private *program(): Generator<Yielded, void, void> {
    const workspace = this.getWorkspace()
    if (!workspace) {
      this.error = 'No Blockly workspace found. Open the Blocks tab once, then try Run again.'
      return
    }
    const top = workspace.getTopBlocks(false)
    const setupBlock = top.find(b => b.type === 'system_setup')
    const loopBlock = top.find(b => b.type === 'system_loop')

    if (setupBlock) yield* this.runStack(setupBlock.getInputTargetBlock('STACK'))
    if (!loopBlock) return

    for (;;) {
      yield* this.runStack(loopBlock.getInputTargetBlock('STACK'))
      this.loopCount++
      yield { kind: 'tick' }
    }
  }

  runStack(block: Block | null): StmtGen {
    return this._runStack(block)
  }
  private *_runStack(block: Block | null): StmtGen {
    let b = block
    while (b) {
      yield* this.execStatement(b)
      b = b.getNextBlock()
    }
  }

  private *execStatement(block: Block): StmtGen {
    if (--this.stmtBudget <= 0) {
      this.stmtBudget = STMT_BUDGET
      yield { kind: 'tick' }
    }
    const handler = STATEMENT_HANDLERS[block.type]
    if (!handler) {
      this.warnOnce(block.type, `[Sim] "${block.type}" isn't supported by the simulator yet — skipped.`)
      return
    }
    yield* handler(this, block)
  }

  evalValue(block: Block | null, fallback: unknown): ValGen {
    return this._evalValue(block, fallback)
  }
  private *_evalValue(block: Block | null, fallback: unknown): ValGen {
    if (!block) return fallback
    const handler = VALUE_HANDLERS[block.type]
    if (!handler) {
      this.warnOnce(block.type, `[Sim] "${block.type}" isn't supported by the simulator yet — using a default value.`)
      return fallback
    }
    return yield* handler(this, block)
  }

  evalInput(block: Block, inputName: string, fallback: unknown): ValGen {
    return this._evalValue(block.getInputTargetBlock(inputName), fallback)
  }

  setVar(varId: string, value: unknown): void {
    this.vars[varId] = value as any
    if (!this.varNames[varId]) {
      const v = this.getWorkspace()?.getVariableMap().getVariableById(varId)
      this.varNames[varId] = v ? v.name : varId
    }
  }
  getVar(varId: string): number | string | boolean {
    return this.vars[varId] ?? 0
  }

  pushSerial(line: string): void {
    this.serialLog.push(line)
    if (this.serialLog.length > 400) this.serialLog.shift()
  }

  warnOnce(key: string, msg: string): void {
    if (this.warnedOnce.has(key)) return
    this.warnedOnce.add(key)
    this.pushSerial(msg)
  }
}
