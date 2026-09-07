import type { PlacedDevice } from '../types/project'
import { AI_JUNIOR_FIXED_DEVICES } from '../boards/ai-junior/fixedDevices'

// ─────────────────────────────────────────────────────────────────────────────
// Built-in example projects (File ▸ Examples)
//
// Each example is a complete project: the blocks AND the hardware components they
// refer to. Loading one drops both onto the canvas, so a student can hit Verify
// straight away instead of first working out which parts to place.
//
// Pin values below are the ones the wiring engine hands out by default for the
// first component of each type on an ESP32 (see esp32/pinmap.json), so the block
// dropdowns resolve to real entries the moment the example loads. Types with no
// pinmap default (dht11, button, potentiometer, motor_driver) get a sensible
// free pin picked by hand instead.
// ─────────────────────────────────────────────────────────────────────────────

export interface ExampleProject {
  id: string
  name: string
  /** Grouping shown as a submenu under File ▸ Examples. */
  category:
    | 'Getting Started'
    | 'Sensors'
    | 'Motors & Outputs'
    | 'Displays'
    | 'Mini Projects'
    | 'Programming Concepts'
    | 'Bluetooth'
    | 'WiFi & AI'
    | 'AI Junior'
  description: string
  devices: PlacedDevice[]
  blocklyWorkspaceJson: any
  /** Board this example targets. Omit for ESP32 (the default) — the loader
   *  switches to this board before placing devices, so e.g. an AI Junior
   *  example opens correctly even if the user currently has ESP32 selected. */
  board?: 'esp32' | 'ai-junior'
}

/** AI Junior's onboard fixed hardware plus whatever else this example plugs
 *  in (an ultrasonic/OLED on their dedicated headers, a sensor on J3/J4/J5).
 *  Examples replace a board's whole device list on load (not merge), so
 *  every AI-Junior-targeted example must include the fixed set explicitly
 *  or opening it would wipe the mic/matrix/motors/buttons/buzzer off the
 *  canvas. */
const aiJuniorDevices = (...extra: PlacedDevice[]): PlacedDevice[] => [...AI_JUNIOR_FIXED_DEVICES, ...extra]

// ── Small helpers so the workspace JSON below stays readable ─────────────────

interface VarDecl { id: string; name: string }

/** A top-level Setup/Loop pair holding the given statement stacks. */
function program(setupStack: any | null, loopStack: any | null, variables: VarDecl[] = []) {
  const blocks: any[] = [
    { type: 'system_setup', x: 40, y: 40, ...(setupStack ? { inputs: { STACK: { block: setupStack } } } : {}) },
    { type: 'system_loop', x: 40, y: 260, ...(loopStack ? { inputs: { STACK: { block: loopStack } } } : {}) }
  ]
  const out: any = { blocks: { languageVersion: 0, blocks } }
  if (variables.length) out.variables = variables.map(v => ({ name: v.name, id: v.id }))
  return out
}

/** Chains statement blocks together via their next connections. */
function stack(...blocks: any[]): any | null {
  const flat = blocks.filter(Boolean)
  if (flat.length === 0) return null
  for (let i = 0; i < flat.length - 1; i++) {
    flat[i].next = { block: flat[i + 1] }
  }
  return flat[0]
}

const num = (n: number) => ({ type: 'math_number', fields: { NUM: n } })
const str = (s: string) => ({ type: 'text', fields: { TEXT: s } })
const bool = (b: boolean) => ({ type: 'logic_boolean', fields: { BOOL: b ? 'TRUE' : 'FALSE' } })
const delay = (ms: number) => ({ type: 'system_delay', fields: { MS: ms } })
const digitalWrite = (pin: string, state: 'HIGH' | 'LOW') => ({
  type: 'output_digital_write',
  fields: { PIN: pin, STATE: state }
})
const analogWrite = (pin: string, valueBlock: any) => ({
  type: 'output_analog_write',
  fields: { PIN: pin },
  inputs: { NUM: { block: valueBlock } }
})
const serialPrint = (value: any) => ({ type: 'serial_print', inputs: { TEXT: { block: value } } })

/** controls_if with an optional else branch (Blockly needs the extraState to build it). */
function ifElse(condition: any, thenStack: any, elseStack?: any) {
  return {
    type: 'controls_if',
    ...(elseStack ? { extraState: { hasElse: true } } : {}),
    inputs: {
      IF0: { block: condition },
      DO0: { block: thenStack },
      ...(elseStack ? { ELSE: { block: elseStack } } : {})
    }
  }
}

const device = (id: string, type: string, mappedPin: any, x: number, y: number): PlacedDevice =>
  ({ id, type, name: id, mappedPin, canvasX: x, canvasY: y } as PlacedDevice)

// ── Logic / math / loop helpers ───────────────────────────────────────────────
const compare = (op: 'EQ' | 'NEQ' | 'LT' | 'LTE' | 'GT' | 'GTE', a: any, b: any) => ({
  type: 'logic_compare', fields: { OP: op }, inputs: { A: { block: a }, B: { block: b } }
})
const andOr = (op: 'AND' | 'OR', a: any, b: any) => ({
  type: 'logic_operation', fields: { OP: op }, inputs: { A: { block: a }, B: { block: b } }
})
const notBlk = (a: any) => ({ type: 'logic_negate', inputs: { BOOL: { block: a } } })
const mathArith = (op: 'ADD' | 'MINUS' | 'MULTIPLY' | 'DIVIDE' | 'POWER', a: any, b: any) => ({
  type: 'math_arithmetic', fields: { OP: op }, inputs: { A: { block: a }, B: { block: b } }
})
const mathRandom = (from: any, to: any) => ({ type: 'math_random_int', inputs: { FROM: { block: from }, TO: { block: to } } })
const repeatN = (times: any, doStack: any) => ({ type: 'controls_repeat_ext', inputs: { TIMES: { block: times }, DO: { block: doStack } } })
const whileLoop = (mode: 'WHILE' | 'UNTIL', cond: any, doStack: any) => ({
  type: 'controls_whileUntil', fields: { MODE: mode }, inputs: { BOOL: { block: cond }, DO: { block: doStack } }
})

// Blockly serializes every variable-holding field (variables_get/set, math_change,
// controls_for) as { id } rather than a bare string — confirmed by round-tripping
// a hand-built workspace through the real Blockly.serialization API, not guessed.
const V = (id: string) => ({ id })
const varSet = (id: string, valueBlock: any) => ({ type: 'variables_set', fields: { VAR: V(id) }, inputs: { VALUE: { block: valueBlock } } })
const varGet = (id: string) => ({ type: 'variables_get', fields: { VAR: V(id) } })
const varChange = (id: string, deltaBlock: any) => ({ type: 'math_change', fields: { VAR: V(id) }, inputs: { DELTA: { block: deltaBlock } } })
const forLoop = (id: string, from: any, to: any, by: any, doStack: any) => ({
  type: 'controls_for',
  fields: { VAR: V(id) },
  inputs: { FROM: { block: from }, TO: { block: to }, BY: { block: by }, DO: { block: doStack } }
})

// ── Output helpers (real component blocks, not just generic digitalWrite) ────
const buzzerOn = (pin: string) => ({ type: 'output_buzzer_on', fields: { PIN: pin } })
const buzzerOff = (pin: string) => ({ type: 'output_buzzer_off', fields: { PIN: pin } })
const buzzerTone = (pin: string, freq: any) => ({ type: 'output_buzzer_tone', fields: { PIN: pin }, inputs: { FREQ: { block: freq } } })
const buzzerNoTone = (pin: string) => ({ type: 'output_buzzer_notone', fields: { PIN: pin } })
const servoWrite = (pin: string, angle: any) => ({ type: 'output_servo_write', fields: { PIN: pin }, inputs: { ANGLE: { block: angle } } })
const dcmotorSet = (devId: string, state: 'FWD' | 'REV' | 'STOP', speed: any) => ({
  type: 'output_dcmotor_set', fields: { PIN: devId, STATE: state }, inputs: { SPEED: { block: speed } }
})
const motorDriverSet = (devId: string, action: 'FWD' | 'REV' | 'LEFT' | 'RIGHT' | 'STOP', speed: any) => ({
  type: 'output_motor_driver_set', fields: { PIN: devId, ACTION: action }, inputs: { SPEED: { block: speed } }
})
const oledInit = (devId: string) => ({ type: 'oled_init', fields: { PIN: devId } })
const oledPrint = (devId: string, text: any, style: 'NORMAL' | 'BOLD' = 'NORMAL') => ({
  type: 'oled_print', fields: { PIN: devId, STYLE: style }, inputs: { TEXT: { block: text } }
})
const oledClear = (devId: string) => ({ type: 'oled_clear', fields: { PIN: devId } })
const oledTextSize = (devId: string, size: 1 | 2 | 3 | 4) => ({ type: 'oled_text_size', fields: { PIN: devId, SIZE: String(size) } })
const oledIcon = (devId: string, icon: string, x: any, y: any) => ({
  type: 'oled_icon', fields: { PIN: devId, ICON: icon }, inputs: { X: { block: x }, Y: { block: y } }
})

// ── LED Matrix (AI Junior's fixed onboard 6x6 display) ────────────────────
const LED_MATRIX = 'GPIO15'
const ledMatrixSetPixel = (x: any, y: any, state: 'ON' | 'OFF', color: string) => ({
  type: 'led_matrix_set_pixel', fields: { PIN: LED_MATRIX, STATE: state, COLOR: color }, inputs: { X: { block: x }, Y: { block: y } }
})
const ledMatrixFill = (color: string) => ({ type: 'led_matrix_fill', fields: { PIN: LED_MATRIX, COLOR: color } })
const ledMatrixClear = () => ({ type: 'led_matrix_clear', fields: { PIN: LED_MATRIX } })
const ledMatrixSetBrightness = (level: any) => ({ type: 'led_matrix_set_brightness', fields: { PIN: LED_MATRIX }, inputs: { LEVEL: { block: level } } })
const ledMatrixShowChar = (ch: any, color: string, brightness: any) => ({
  type: 'led_matrix_show_char', fields: { PIN: LED_MATRIX, COLOR: color }, inputs: { CHAR: { block: ch }, BRIGHTNESS: { block: brightness } }
})
const ledMatrixShowText = (text: any, color: string, brightness: any, speed: any) => ({
  type: 'led_matrix_show_text', fields: { PIN: LED_MATRIX, COLOR: color }, inputs: { TEXT: { block: text }, BRIGHTNESS: { block: brightness }, SPEED: { block: speed } }
})
const ledMatrixShowLeds = (pixels: string, color: string, brightness: any) => ({
  type: 'led_matrix_show_leds', fields: { PIN: LED_MATRIX, COLOR: color, PIXELS: pixels }, inputs: { BRIGHTNESS: { block: brightness } }
})
const ledMatrixShowPattern = (pattern: string, color: string) => ({ type: 'led_matrix_show_pattern', fields: { PIN: LED_MATRIX, PATTERN: pattern, COLOR: color } })
const ledMatrixShowAnimation = (anim: string, color: string) => ({ type: 'led_matrix_show_animation', fields: { PIN: LED_MATRIX, ANIMATION: anim, COLOR: color } })
const ledMatrixRotate = (degrees: '0' | '90' | '180' | '270') => ({ type: 'led_matrix_rotate', fields: { PIN: LED_MATRIX, DEGREES: degrees } })

// ── Buzzer melodies (RTTTL) ────────────────────────────────────────────────
const buzzerPlayToneDuration = (devId: string, freq: any, duration: any) => ({
  type: 'buzzer_play_tone_duration', fields: { PIN: devId }, inputs: { FREQ: { block: freq }, DURATION: { block: duration } }
})
const buzzerPlayMelody = (devId: string, melody: string, tempo: any) => ({
  type: 'buzzer_play_melody', fields: { PIN: devId, MELODY: melody }, inputs: { TEMPO: { block: tempo } }
})
const buzzerPlayCustomMelody = (devId: string, rtttl: string, tempo: any) => ({
  type: 'buzzer_play_custom_melody', fields: { PIN: devId, MELODY: rtttl }, inputs: { TEMPO: { block: tempo } }
})

// ── Sensor read/condition helpers ─────────────────────────────────────────────
const readLdr = (pin: string) => ({ type: 'input_ldr_read_analog', fields: { PIN: pin } })
const isDark = (pin: string, threshold = 1000) => ({ type: 'input_ldr_is_dark', fields: { PIN: pin, THRESHOLD: threshold } })
const readPot = (pin: string) => ({ type: 'input_potentiometer_read', fields: { PIN: pin } })
const readTemp = (pin: string) => ({ type: 'input_temp_read', fields: { PIN: pin } })
const isHot = (pin: string) => ({ type: 'input_temp_is_hot', fields: { PIN: pin } })
const readDht = (pin: string, kind: 'TEMP' | 'HUM') => ({ type: 'input_dht_read', fields: { PIN: pin, TYPE: kind } })
const irDetected = (pin: string) => ({ type: 'input_ir_read', fields: { PIN: pin } })
const readIrAnalog = (pin: string) => ({ type: 'input_ir_analog_read', fields: { PIN: pin } })
const touchDetected = (pin: string) => ({ type: 'input_touch_read', fields: { PIN: pin } })
const readTouchRaw = (pin: string) => ({ type: 'input_touch_raw', fields: { PIN: pin } })
const readUltrasonic = (devId: string) => ({ type: 'input_ultrasonic_read', fields: { PIN: devId } })
const readColor = (channel: 'R' | 'G' | 'B') => ({ type: 'input_color_read', fields: { COLOR: channel } })
const readColorClear = () => ({ type: 'input_color_clear' })
const readColorLux = () => ({ type: 'input_color_lux' })
const readColorTemperature = () => ({ type: 'input_color_temperature' })
const colorIs = (name: 'Red' | 'Green' | 'Blue' | 'Yellow' | 'White' | 'Black') => ({ type: 'input_color_is', fields: { COLOR_NAME: name } })
const colorName = () => ({ type: 'input_color_name' })
const buttonPressed = (pin: string) => ({ type: 'input_button_pressed', fields: { PIN: pin } })
const buttonRaw = (pin: string) => ({ type: 'input_button_read', fields: { PIN: pin } })
const readJoy1 = (axis: 'VRX' | 'VRY') => ({ type: 'input_joystick1_read', fields: { AXIS: axis } })
const readJoy2 = (axis: 'VRX' | 'VRY') => ({ type: 'input_joystick2_read', fields: { AXIS: axis } })

// ── Bluetooth / WiFi / AI helpers ─────────────────────────────────────────────
const btBegin = (name: string) => ({ type: 'bluetooth_begin', fields: { NAME: name } })
const tracerListen = () => ({ type: 'tracer_listen' })
const btSend = (text: any) => ({ type: 'bluetooth_send', inputs: { TEXT: { block: text } } })
const btRead = () => ({ type: 'bluetooth_read' })
const btAvailable = () => ({ type: 'bluetooth_available' })
const wifiConnect = (ssid: string, pass: string) => ({
  type: 'wifi_connect', inputs: { SSID: { block: str(ssid) }, PASSWORD: { block: str(pass) } }
})
const wifiGetIp = () => ({ type: 'wifi_get_ip' })
const espnowInit = () => ({ type: 'espnow_init' })
const espnowSend = (message: any) => ({ type: 'espnow_send_message', inputs: { MESSAGE: { block: message } } })
const espnowReceivedMessage = () => ({ type: 'espnow_received_message' })
const aiIsGesture = (g: string) => ({ type: 'ai_is_gesture', fields: { GESTURE: g } })
const aiIsObject = (o: string) => ({ type: 'ai_is_object', fields: { OBJECT: o } })
const aiIsShape = (s: string) => ({ type: 'ai_is_shape', fields: { SHAPE: s } })
const aiIsExpression = (e: string) => ({ type: 'ai_is_expression', fields: { EXPRESSION: e } })
const aiDetectedExpression = () => ({ type: 'ai_detected_expression' })
const aiMicLevel = () => ({ type: 'ai_mic_level' })

// ─────────────────────────────────────────────────────────────────────────────
// Sensor / Output tables — the source of the "X Controls Y" combination
// examples below. Each sensor pairs with each output except where the exact
// same pairing already exists as a hand-written example elsewhere in this file
// (see SKIP_COMBOS), to avoid two examples teaching the identical thing.
// ─────────────────────────────────────────────────────────────────────────────

interface SensorDef {
  id: string
  label: string
  devType: string
  pin: string | Record<string, string>
  /** deviceId to reference in blocks — equals `${id}1` for single-pin sensors, or the multi-pin device's own id. */
  devId: string
  condition: () => any
  readValue: () => any
}

interface OutputDef {
  id: string
  label: string
  devType: string
  pin: string | Record<string, string>
  devId: string
  on: () => any
  off: () => any
}

const SENSORS: SensorDef[] = [
  { id: 'button', label: 'Button', devType: 'button', pin: '4', devId: 'button1',
    condition: () => buttonPressed('4'), readValue: () => buttonRaw('4') },
  { id: 'potentiometer', label: 'Potentiometer', devType: 'potentiometer', pin: '34', devId: 'potentiometer1',
    condition: () => compare('GT', readPot('34'), num(2048)), readValue: () => readPot('34') },
  { id: 'ldr', label: 'LDR', devType: 'ldr', pin: '35', devId: 'ldr1',
    condition: () => isDark('35', 1000), readValue: () => readLdr('35') },
  { id: 'temp', label: 'Temp Sensor', devType: 'temp', pin: '32', devId: 'temp1',
    condition: () => isHot('32'), readValue: () => readTemp('32') },
  { id: 'dht11', label: 'DHT11', devType: 'dht11', pin: '27', devId: 'dht111',
    condition: () => compare('GT', readDht('27', 'TEMP'), num(30)), readValue: () => readDht('27', 'TEMP') },
  { id: 'ir', label: 'IR Sensor', devType: 'ir', pin: '35', devId: 'ir1',
    condition: () => irDetected('35'), readValue: () => irDetected('35') },
  { id: 'touch', label: 'Touch Sensor', devType: 'touch', pin: '12', devId: 'touch1',
    condition: () => touchDetected('12'), readValue: () => readTouchRaw('12') },
  { id: 'ultrasonic', label: 'Ultrasonic', devType: 'ultrasonic', pin: { trig: '33', echo: '32' }, devId: 'us1',
    condition: () => compare('LT', readUltrasonic('us1'), num(20)), readValue: () => readUltrasonic('us1') },
  { id: 'joystick', label: 'Joystick', devType: 'joystick', pin: { vrx: '4', vry: '2' }, devId: 'joy1',
    condition: () => compare('GT', readJoy1('VRX'), num(3000)), readValue: () => readJoy1('VRX') }
]

const OUTPUTS: OutputDef[] = [
  { id: 'led', label: 'LED', devType: 'led', pin: '18', devId: 'led1',
    on: () => digitalWrite('18', 'HIGH'), off: () => digitalWrite('18', 'LOW') },
  { id: 'buzzer', label: 'Buzzer', devType: 'buzzer', pin: '18', devId: 'buzzer1',
    on: () => buzzerOn('18'), off: () => buzzerOff('18') },
  { id: 'servo', label: 'Servo', devType: 'servo', pin: '23', devId: 'servo1',
    on: () => servoWrite('23', num(180)), off: () => servoWrite('23', num(0)) },
  { id: 'dcmotor', label: 'DC Motor', devType: 'dcmotor', pin: { in1: '18', in2: '19' }, devId: 'motor1',
    on: () => dcmotorSet('motor1', 'FWD', num(200)), off: () => dcmotorSet('motor1', 'STOP', num(0)) }
]

// Already covered by a dedicated, hand-written example elsewhere in this file —
// skip so the combo grid doesn't duplicate it.
const SKIP_COMBOS = new Set(['button:led', 'ldr:led', 'temp:buzzer', 'ultrasonic:buzzer', 'potentiometer:dcmotor'])

function buildComboExamples(): ExampleProject[] {
  const out: ExampleProject[] = []
  for (const sensor of SENSORS) {
    for (const output of OUTPUTS) {
      if (SKIP_COMBOS.has(`${sensor.id}:${output.id}`)) continue
      out.push({
        id: `${sensor.id}-controls-${output.id}`,
        name: `${sensor.label} Controls ${output.label}`,
        category: 'Sensors',
        description: `Reads the ${sensor.label.toLowerCase()} every loop and switches the ${output.label.toLowerCase()} accordingly. A ready-made pairing you can pull apart and remix.`,
        devices: [
          device(sensor.devId, sensor.devType, sensor.pin, 120, 120),
          device(output.devId, output.devType, output.pin, 340, 120)
        ],
        blocklyWorkspaceJson: program(
          null,
          stack(
            serialPrint(sensor.readValue()),
            ifElse(sensor.condition(), output.on(), output.off()),
            delay(250)
          )
        )
      })
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────

export const EXAMPLES: ExampleProject[] = [
  // ── Getting Started ────────────────────────────────────────────────────────
  {
    id: 'blink',
    name: 'Blink an LED',
    category: 'Getting Started',
    description: 'Turns an LED on and off once a second — the classic first program.',
    devices: [device('led1', 'led', '18', 120, 120)],
    blocklyWorkspaceJson: program(
      null,
      stack(digitalWrite('18', 'HIGH'), delay(500), digitalWrite('18', 'LOW'), delay(500))
    )
  },
  {
    id: 'button-led',
    name: 'Button Controls LED',
    category: 'Getting Started',
    description: 'Holds the LED on while the push button is pressed.',
    devices: [device('btn1', 'button', '35', 120, 120), device('led1', 'led', '18', 300, 120)],
    blocklyWorkspaceJson: program(
      null,
      stack(ifElse(buttonPressed('35'), digitalWrite('18', 'HIGH'), digitalWrite('18', 'LOW')))
    )
  },

  // ── Sensors (originals) ────────────────────────────────────────────────────
  {
    id: 'ldr-night-light',
    name: 'LDR Night Light',
    category: 'Sensors',
    description:
      'Prints the light level to the Serial Monitor and switches the LED on when it gets dark. Watch the numbers first, then tune the threshold on the "is Dark" block.',
    devices: [device('ldr1', 'ldr', '34', 120, 120), device('led1', 'led', '18', 300, 120)],
    blocklyWorkspaceJson: program(
      null,
      stack(
        serialPrint(readLdr('34')),
        ifElse(isDark('34', 1000), digitalWrite('18', 'HIGH'), digitalWrite('18', 'LOW')),
        delay(500)
      )
    )
  },
  {
    id: 'temperature-alarm',
    name: 'Temperature Alarm',
    category: 'Sensors',
    description: 'Reads the DS18B20 temperature sensor and sounds the buzzer when it gets too hot.',
    devices: [device('temp1', 'temp', '32', 120, 120), device('buzzer1', 'buzzer', '18', 300, 120)],
    blocklyWorkspaceJson: program(
      null,
      stack(serialPrint(readTemp('32')), ifElse(isHot('32'), digitalWrite('18', 'HIGH'), digitalWrite('18', 'LOW')), delay(1000))
    )
  },
  {
    id: 'ultrasonic-parking',
    name: 'Ultrasonic Parking Sensor',
    category: 'Sensors',
    description: 'Prints the distance in cm and beeps once anything comes closer than 20 cm.',
    devices: [device('us1', 'ultrasonic', { trig: '33', echo: '32' }, 120, 120), device('buzzer1', 'buzzer', '18', 320, 120)],
    blocklyWorkspaceJson: program(
      null,
      stack(
        serialPrint(readUltrasonic('us1')),
        ifElse(compare('LT', readUltrasonic('us1'), num(20)), digitalWrite('18', 'HIGH'), digitalWrite('18', 'LOW')),
        delay(300)
      )
    )
  },

  {
    id: 'color-sensor-report',
    name: 'Color Sensor: Name Report',
    category: 'Sensors',
    description: 'Prints the detected color\'s name (Red, Green, Blue, Yellow, White, Black or Unknown) to the Serial Monitor every half second — hold different colored objects up to the sensor and watch the name change.',
    devices: [device('color1', 'color_sensor', { sda: '13', scl: '15' }, 120, 120)],
    blocklyWorkspaceJson: program(null, stack(serialPrint(colorName()), delay(500)))
  },
  {
    id: 'color-sensor-raw-values',
    name: 'Color Sensor: Raw RGB Values',
    category: 'Sensors',
    description: 'Prints the raw Red, Green and Blue channel numbers from the TCS34725 — useful for understanding what the sensor actually measures before trusting the Name Report / Is Color blocks.',
    devices: [device('color1', 'color_sensor', { sda: '13', scl: '15' }, 120, 120)],
    blocklyWorkspaceJson: program(
      null,
      stack(serialPrint(readColor('R')), serialPrint(readColor('G')), serialPrint(readColor('B')), delay(500))
    )
  },
  {
    id: 'color-sorting-buzzer',
    name: 'Color Sensor: Red Alert Buzzer',
    category: 'Mini Projects',
    description: 'Sounds the buzzer whenever the color sensor sees something red — the building block for a color-sorting machine.',
    devices: [device('color1', 'color_sensor', { sda: '13', scl: '15' }, 120, 60), device('buzzer1', 'buzzer', '18', 320, 120)],
    blocklyWorkspaceJson: program(null, stack(ifElse(colorIs('Red'), buzzerOn('18'), buzzerOff('18')), delay(200)))
  },
  {
    id: 'color-name-oled',
    name: 'Color Sensor: Name on OLED',
    category: 'Displays',
    description: 'Classifies whatever the color sensor is pointed at (Red, Green, Blue, Yellow, White or Black) and shows the name on the OLED screen.',
    devices: [
      device('color1', 'color_sensor', { sda: '13', scl: '15' }, 100, 60),
      device('oled1', 'oled', { sda: '13', scl: '15' }, 320, 60)
    ],
    blocklyWorkspaceJson: program(
      oledInit('oled1'),
      stack(oledClear('oled1'), oledPrint('oled1', colorName()), delay(400))
    )
  },
  {
    id: 'color-traffic-light',
    name: 'Color Sensor: Traffic Light Match',
    category: 'Mini Projects',
    description: 'Lights the matching LED — red, green or blue — for whatever color the sensor is pointed at, and turns all three off otherwise.',
    devices: [
      device('color1', 'color_sensor', { sda: '13', scl: '15' }, 100, 60),
      device('ledR', 'led', '18', 300, 40),
      device('ledG', 'led', '17', 300, 140),
      device('ledB', 'led', '16', 300, 240)
    ],
    blocklyWorkspaceJson: program(
      null,
      stack(
        digitalWrite('18', 'LOW'), digitalWrite('17', 'LOW'), digitalWrite('16', 'LOW'),
        ifElse(colorIs('Red'), digitalWrite('18', 'HIGH'),
          ifElse(colorIs('Green'), digitalWrite('17', 'HIGH'),
            ifElse(colorIs('Blue'), digitalWrite('16', 'HIGH'))
          )
        ),
        delay(200)
      )
    )
  },
  {
    id: 'color-sorting-servo',
    name: 'Color Sensor: Sorting Servo',
    category: 'Mini Projects',
    description: 'Swings a servo arm to a different position for Red, Green or Blue objects — the core mechanism of a color-sorting machine. Centers when nothing matches.',
    devices: [
      device('color1', 'color_sensor', { sda: '13', scl: '15' }, 100, 60),
      device('servo1', 'servo', '23', 320, 120)
    ],
    blocklyWorkspaceJson: program(
      null,
      stack(
        ifElse(colorIs('Red'), servoWrite('23', num(0)),
          ifElse(colorIs('Green'), servoWrite('23', num(90)),
            ifElse(colorIs('Blue'), servoWrite('23', num(180)), servoWrite('23', num(45)))
          )
        ),
        delay(300)
      )
    )
  },

  // ── Motors & Outputs (originals) ───────────────────────────────────────────
  {
    id: 'servo-sweep',
    name: 'Servo Sweep',
    category: 'Motors & Outputs',
    description: 'Swings the servo between 0° and 180° so you can see its full travel.',
    devices: [device('servo1', 'servo', '23', 120, 120)],
    blocklyWorkspaceJson: program(null, stack(servoWrite('23', num(0)), delay(1000), servoWrite('23', num(180)), delay(1000)))
  },
  {
    id: 'pot-motor-speed',
    name: 'Potentiometer Drives Motor Speed',
    category: 'Motors & Outputs',
    description: 'Turns the potentiometer into a throttle for the DC motor.',
    devices: [device('pot1', 'potentiometer', '34', 120, 120), device('motor1', 'dcmotor', { in1: '18', in2: '19' }, 320, 120)],
    blocklyWorkspaceJson: program(
      null,
      stack(
        serialPrint(readPot('34')),
        dcmotorSet('motor1', 'FWD', mathArith('DIVIDE', readPot('34'), num(16))),
        delay(100)
      )
    )
  },

  // ── Motors & Outputs (new standalones) ─────────────────────────────────────
  {
    id: 'buzzer-beep',
    name: 'Buzzer Beep',
    category: 'Motors & Outputs',
    description: 'Turns the buzzer on and off once a second, using the dedicated Buzzer blocks.',
    devices: [device('buzzer1', 'buzzer', '18', 120, 120)],
    blocklyWorkspaceJson: program(null, stack(buzzerOn('18'), delay(300), buzzerOff('18'), delay(300)))
  },
  {
    id: 'buzzer-tone-scale',
    name: 'Buzzer Plays a Scale',
    category: 'Motors & Outputs',
    description: 'Plays four rising tones on the buzzer, then stops — a first taste of making music with code.',
    devices: [device('buzzer1', 'buzzer', '18', 120, 120)],
    blocklyWorkspaceJson: program(
      null,
      stack(
        buzzerTone('18', num(262)), delay(300),
        buzzerTone('18', num(330)), delay(300),
        buzzerTone('18', num(392)), delay(300),
        buzzerTone('18', num(523)), delay(300),
        buzzerNoTone('18'), delay(500)
      )
    )
  },
  {
    id: 'dcmotor-spin',
    name: 'DC Motor Forward / Reverse',
    category: 'Motors & Outputs',
    description: 'Spins the DC motor forward, then reverse, then stops — the motor equivalent of Blink.',
    devices: [device('motor1', 'dcmotor', { in1: '18', in2: '19' }, 120, 120)],
    blocklyWorkspaceJson: program(
      null,
      stack(
        dcmotorSet('motor1', 'FWD', num(200)), delay(2000),
        dcmotorSet('motor1', 'REV', num(200)), delay(2000),
        dcmotorSet('motor1', 'STOP', num(0)), delay(1000)
      )
    )
  },
  {
    id: 'motor-driver-square',
    name: '4-Motor Driver Test Pattern',
    category: 'Motors & Outputs',
    description: 'Drives a 4-motor (L298N-style) driver through forward, left, right and reverse — a quick wiring test for a 2/4-wheel robot base.',
    devices: [device('driver1', 'motor_driver', { enA: '26', in1: '25', in2: '33', enB: '14', in3: '4', in4: '2' }, 120, 120)],
    blocklyWorkspaceJson: program(
      null,
      stack(
        motorDriverSet('driver1', 'FWD', num(200)), delay(1000),
        motorDriverSet('driver1', 'LEFT', num(200)), delay(1000),
        motorDriverSet('driver1', 'RIGHT', num(200)), delay(1000),
        motorDriverSet('driver1', 'REV', num(200)), delay(1000),
        motorDriverSet('driver1', 'STOP', num(0)), delay(1000)
      )
    )
  },
  {
    id: 'led-brightness-breathing',
    name: 'Breathing LED (PWM Fade)',
    category: 'Motors & Outputs',
    description: 'Fades the LED smoothly up and down using analogWrite inside two For loops — a classic "breathing light" effect.',
    devices: [device('led1', 'led', '18', 120, 120)],
    blocklyWorkspaceJson: program(
      null,
      stack(
        forLoop('i', num(0), num(255), num(5), stack(analogWrite('18', varGet('i')), delay(10))),
        forLoop('i', num(255), num(0), num(-5), stack(analogWrite('18', varGet('i')), delay(10)))
      ),
      [{ id: 'i', name: 'i' }]
    )
  },
  {
    id: 'led-chase-pattern',
    name: 'Three-LED Chase',
    category: 'Motors & Outputs',
    description: 'Lights three LEDs one at a time back and forth, Knight-Rider style.',
    devices: [device('led1', 'led', '18', 100, 120), device('led2', 'led', '17', 220, 120), device('led3', 'led', '16', 340, 120)],
    blocklyWorkspaceJson: program(
      null,
      stack(
        digitalWrite('18', 'HIGH'), delay(150), digitalWrite('18', 'LOW'),
        digitalWrite('17', 'HIGH'), delay(150), digitalWrite('17', 'LOW'),
        digitalWrite('16', 'HIGH'), delay(150), digitalWrite('16', 'LOW'),
        digitalWrite('17', 'HIGH'), delay(150), digitalWrite('17', 'LOW')
      )
    )
  },

  // ── Sensors (new standalones) ──────────────────────────────────────────────
  {
    id: 'dht11-weather',
    name: 'DHT11 Temperature & Humidity',
    category: 'Sensors',
    description: 'Prints both temperature and humidity from a DHT11 sensor once a second.',
    devices: [device('dht111', 'dht11', '27', 120, 120)],
    blocklyWorkspaceJson: program(null, stack(serialPrint(readDht('27', 'TEMP')), serialPrint(readDht('27', 'HUM')), delay(1000)))
  },
  {
    id: 'ir-object-detect',
    name: 'IR Sensor Object Detect',
    category: 'Sensors',
    description: 'Prints "Object detected!" or "Clear" depending on what the IR sensor sees.',
    devices: [device('ir1', 'ir', '35', 120, 120)],
    blocklyWorkspaceJson: program(
      null,
      stack(ifElse(irDetected('35'), serialPrint(str('Object detected!')), serialPrint(str('Clear'))), delay(300))
    )
  },
  {
    id: 'touch-counter',
    name: 'Touch Sensor Counter',
    category: 'Sensors',
    description: 'Counts how many times the touch sensor has been touched and prints the running total.',
    devices: [device('touch1', 'touch', '12', 120, 120)],
    blocklyWorkspaceJson: program(
      varSet('count', num(0)),
      stack(ifElse(touchDetected('12'), stack(varChange('count', num(1)), serialPrint(varGet('count')), delay(250)))),
      [{ id: 'count', name: 'count' }]
    )
  },
  {
    id: 'button-counter',
    name: 'Button Press Counter',
    category: 'Sensors',
    description: 'Counts button presses in a variable and prints the total every time it changes.',
    devices: [device('btn1', 'button', '35', 120, 120)],
    blocklyWorkspaceJson: program(
      varSet('count', num(0)),
      stack(ifElse(buttonPressed('35'), stack(varChange('count', num(1)), serialPrint(varGet('count')), delay(250)))),
      [{ id: 'count', name: 'count' }]
    )
  },
  {
    id: 'joystick-position',
    name: 'Joystick Position Reader',
    category: 'Sensors',
    description: 'Prints the joystick\'s X and Y readings so you can see the raw range before using them.',
    devices: [device('joy1', 'joystick', { vrx: '4', vry: '2' }, 120, 120)],
    blocklyWorkspaceJson: program(null, stack(serialPrint(readJoy1('VRX')), serialPrint(readJoy1('VRY')), delay(300)))
  },
  {
    id: 'potentiometer-dimmer',
    name: 'Potentiometer Dimmer',
    category: 'Sensors',
    description: 'Turns the potentiometer knob into a smooth LED brightness dimmer using analogWrite.',
    devices: [device('pot1', 'potentiometer', '34', 120, 120), device('led1', 'led', '18', 320, 120)],
    blocklyWorkspaceJson: program(null, stack(analogWrite('18', mathArith('DIVIDE', readPot('34'), num(16))), delay(100)))
  },
  {
    id: 'ultrasonic-radar',
    name: 'Ultrasonic Distance Monitor',
    category: 'Sensors',
    description: 'Just prints the measured distance continuously — handy for calibrating a project before adding logic.',
    devices: [device('us1', 'ultrasonic', { trig: '33', echo: '32' }, 120, 120)],
    blocklyWorkspaceJson: program(null, stack(serialPrint(readUltrasonic('us1')), delay(200)))
  },
  {
    id: 'dual-ir-line-sensors',
    name: 'Two IR Sensors (Left + Right)',
    category: 'Sensors',
    description: 'Reads both IR sensor slots side by side — the two-sensor setup a line-following robot starts from.',
    devices: [device('ir1', 'ir', '35', 120, 120), device('ir2', 'ir', '34', 300, 120)],
    blocklyWorkspaceJson: program(
      null,
      stack(serialPrint(irDetected('35')), serialPrint(irDetected('34')), delay(200))
    )
  },
  {
    id: 'dual-ldr-comparison',
    name: 'Two LDRs Compared',
    category: 'Sensors',
    description: 'Reads both LDR slots and prints which side is brighter — the building block of a light-tracking project.',
    devices: [device('ldr1', 'ldr', '35', 120, 120), device('ldr2', 'ldr', '34', 300, 120)],
    blocklyWorkspaceJson: program(
      null,
      stack(
        ifElse(compare('GT', readLdr('35'), readLdr('34')), serialPrint(str('Left is brighter')), serialPrint(str('Right is brighter'))),
        delay(300)
      )
    )
  },

  // ── Displays ────────────────────────────────────────────────────────────────
  {
    id: 'oled-hello',
    name: 'OLED Hello World',
    category: 'Displays',
    description: 'Prints a message to the OLED screen once a second.',
    devices: [device('oled1', 'oled', { sda: '13', scl: '15' }, 120, 120)],
    blocklyWorkspaceJson: program(oledInit('oled1'), stack(oledClear('oled1'), oledPrint('oled1', str('Hello, World!')), delay(1000)))
  },
  {
    id: 'oled-icons-and-styles',
    name: 'OLED Icons & Text Styles',
    category: 'Displays',
    description:
      'Shows off the OLED Icon block (arrows, dot, square, heart, star, check, cross), plus bold text and a bigger text size. The screen is monochrome, so icons are simple pixel-art shapes, not color emoji.',
    devices: [device('oled1', 'oled', { sda: '13', scl: '15' }, 120, 120)],
    blocklyWorkspaceJson: program(
      oledInit('oled1'),
      stack(
        oledClear('oled1'),
        oledTextSize('oled1', 2),
        oledPrint('oled1', str('Weather'), 'BOLD'),
        oledTextSize('oled1', 1),
        oledIcon('oled1', 'ARROW_UP', num(0), num(40)),
        oledIcon('oled1', 'ARROW_DOWN', num(16), num(40)),
        oledIcon('oled1', 'HEART', num(40), num(40)),
        oledIcon('oled1', 'STAR', num(56), num(40)),
        oledIcon('oled1', 'CHECK', num(72), num(40)),
        delay(2000)
      )
    )
  },
  {
    id: 'oled-shows-ldr',
    name: 'OLED Shows Light Level',
    category: 'Displays',
    description: 'Displays the LDR reading live on the OLED screen instead of just the Serial Monitor.',
    devices: [device('ldr1', 'ldr', '35', 120, 120), device('oled1', 'oled', { sda: '13', scl: '15' }, 320, 120)],
    blocklyWorkspaceJson: program(oledInit('oled1'), stack(oledClear('oled1'), oledPrint('oled1', readLdr('35')), delay(500)))
  },
  {
    id: 'oled-shows-temp',
    name: 'OLED Shows Temperature',
    category: 'Displays',
    description: 'Displays the DS18B20 temperature reading on the OLED screen.',
    devices: [device('temp1', 'temp', '32', 120, 120), device('oled1', 'oled', { sda: '13', scl: '15' }, 320, 120)],
    blocklyWorkspaceJson: program(oledInit('oled1'), stack(oledClear('oled1'), oledPrint('oled1', readTemp('32')), delay(1000)))
  },
  {
    id: 'oled-shows-distance',
    name: 'OLED Shows Distance',
    category: 'Displays',
    description: 'Displays the live ultrasonic distance reading on the OLED screen.',
    devices: [device('us1', 'ultrasonic', { trig: '33', echo: '32' }, 120, 120), device('oled1', 'oled', { sda: '13', scl: '15' }, 320, 120)],
    blocklyWorkspaceJson: program(oledInit('oled1'), stack(oledClear('oled1'), oledPrint('oled1', readUltrasonic('us1')), delay(500)))
  },
  {
    id: 'oled-shows-button-count',
    name: 'OLED Shows Press Count',
    category: 'Displays',
    description: 'Counts button presses and shows the running total on the OLED screen.',
    devices: [device('btn1', 'button', '35', 120, 120), device('oled1', 'oled', { sda: '13', scl: '15' }, 320, 120)],
    blocklyWorkspaceJson: program(
      stack(oledInit('oled1'), varSet('count', num(0))),
      stack(ifElse(buttonPressed('35'), stack(varChange('count', num(1)), oledClear('oled1'), oledPrint('oled1', varGet('count')), delay(250)))),
      [{ id: 'count', name: 'count' }]
    )
  },

  // ── Mini Projects ───────────────────────────────────────────────────────────
  {
    id: 'smart-night-light',
    name: 'Smart Night Light',
    category: 'Mini Projects',
    description: 'The LED turns on only when it\'s dark AND the IR sensor detects someone nearby — combines two sensors with an AND.',
    devices: [device('ldr1', 'ldr', '35', 100, 100), device('ir1', 'ir', '34', 100, 220), device('led1', 'led', '18', 320, 160)],
    blocklyWorkspaceJson: program(
      null,
      stack(ifElse(andOr('AND', isDark('35', 1000), irDetected('34')), digitalWrite('18', 'HIGH'), digitalWrite('18', 'LOW')), delay(300))
    )
  },
  {
    id: 'weather-station',
    name: 'Mini Weather Station',
    category: 'Mini Projects',
    description: 'Reads temperature and humidity from the DHT11 and shows both on the OLED screen.',
    devices: [device('dht111', 'dht11', '27', 100, 100), device('oled1', 'oled', { sda: '13', scl: '15' }, 320, 100)],
    blocklyWorkspaceJson: program(
      oledInit('oled1'),
      stack(
        oledClear('oled1'),
        oledPrint('oled1', readDht('27', 'TEMP')),
        oledPrint('oled1', readDht('27', 'HUM')),
        delay(1500)
      )
    )
  },
  {
    id: 'automatic-door',
    name: 'Automatic Door',
    category: 'Mini Projects',
    description: 'The servo "opens" (90°) when something is within 15 cm, and closes (0°) again once the way is clear.',
    devices: [device('us1', 'ultrasonic', { trig: '33', echo: '32' }, 100, 100), device('servo1', 'servo', '23', 320, 100)],
    blocklyWorkspaceJson: program(
      null,
      stack(ifElse(compare('LT', readUltrasonic('us1'), num(15)), servoWrite('23', num(90)), servoWrite('23', num(0))), delay(200))
    )
  },
  {
    id: 'security-alarm',
    name: 'Security Alarm',
    category: 'Mini Projects',
    description: 'Sounds the buzzer and lights the LED if EITHER the touch sensor or the IR sensor triggers — an OR condition.',
    devices: [
      device('touch1', 'touch', '12', 100, 100),
      device('ir1', 'ir', '35', 100, 220),
      device('buzzer1', 'buzzer', '18', 320, 100),
      device('led1', 'led', '17', 320, 220)
    ],
    blocklyWorkspaceJson: program(
      null,
      stack(
        ifElse(
          andOr('OR', touchDetected('12'), irDetected('35')),
          stack(buzzerOn('18'), digitalWrite('17', 'HIGH')),
          stack(buzzerOff('18'), digitalWrite('17', 'LOW'))
        ),
        delay(200)
      )
    )
  },
  {
    id: 'rc-car-joystick',
    name: 'Joystick RC Car',
    category: 'Mini Projects',
    description: 'A simple tank-drive: pushing the joystick forward or back drives both motors together.',
    devices: [
      device('joy1', 'joystick', { vrx: '4', vry: '2' }, 100, 100),
      device('motor1', 'dcmotor', { in1: '18', in2: '19' }, 320, 60),
      device('motor2', 'dcmotor', { in1: '17', in2: '5' }, 320, 180)
    ],
    blocklyWorkspaceJson: program(
      null,
      stack(
        ifElse(
          compare('GT', readJoy1('VRY'), num(3000)),
          stack(dcmotorSet('motor1', 'FWD', num(200)), dcmotorSet('motor2', 'FWD', num(200))),
          ifElse(
            compare('LT', readJoy1('VRY'), num(1000)),
            stack(dcmotorSet('motor1', 'REV', num(200)), dcmotorSet('motor2', 'REV', num(200))),
            stack(dcmotorSet('motor1', 'STOP', num(0)), dcmotorSet('motor2', 'STOP', num(0)))
          )
        ),
        delay(100)
      )
    )
  },
  {
    id: 'tracer-path-follower',
    name: 'Robot Tracer: Path Follower',
    category: 'Bluetooth',
    description:
      'Upload this once, then open the Tracer Run tab on the desktop app, draw a path on screen, and the board retraces it. Requires two DC motors — motor1 as the left wheel, motor2 as the right.',
    devices: [
      device('motor1', 'dcmotor', { in1: '18', in2: '19' }, 120, 60),
      device('motor2', 'dcmotor', { in1: '17', in2: '5' }, 120, 200)
    ],
    blocklyWorkspaceJson: program(null, stack(tracerListen()))
  },
  {
    id: 'rc-car-full-steering',
    name: 'Joystick RC Car: Full Steering',
    category: 'Mini Projects',
    description:
      'A more complete remote control car: push the joystick forward or back to drive, and left or right to turn while moving — one joystick, two motors, full directional control.',
    devices: [
      device('joy1', 'joystick', { vrx: '4', vry: '2' }, 100, 100),
      device('motor1', 'dcmotor', { in1: '18', in2: '19' }, 320, 60),
      device('motor2', 'dcmotor', { in1: '17', in2: '5' }, 320, 180)
    ],
    blocklyWorkspaceJson: program(
      null,
      stack(
        ifElse(
          compare('GT', readJoy1('VRY'), num(3000)),
          ifElse(
            compare('LT', readJoy1('VRX'), num(1000)),
            stack(dcmotorSet('motor1', 'STOP', num(0)), dcmotorSet('motor2', 'FWD', num(200))),
            ifElse(
              compare('GT', readJoy1('VRX'), num(3000)),
              stack(dcmotorSet('motor1', 'FWD', num(200)), dcmotorSet('motor2', 'STOP', num(0))),
              stack(dcmotorSet('motor1', 'FWD', num(200)), dcmotorSet('motor2', 'FWD', num(200)))
            )
          ),
          ifElse(
            compare('LT', readJoy1('VRY'), num(1000)),
            stack(dcmotorSet('motor1', 'REV', num(200)), dcmotorSet('motor2', 'REV', num(200))),
            stack(dcmotorSet('motor1', 'STOP', num(0)), dcmotorSet('motor2', 'STOP', num(0)))
          )
        ),
        delay(100)
      )
    )
  },
  {
    id: 'crane-joystick-control',
    name: 'Joystick-Controlled Crane (3 Motors)',
    category: 'Mini Projects',
    description:
      'Two joysticks run a 3-motor crane: the first joystick\'s X-axis rotates the base and Y-axis raises or lowers the arm; the second joystick\'s Y-axis reels the winch hook in and out.',
    devices: [
      device('joy1', 'joystick', { vrx: '4', vry: '2' }, 80, 60),
      device('joy2', 'joystick', { vrx: '26', vry: '25' }, 80, 260),
      device('motor1', 'dcmotor', { in1: '18', in2: '19' }, 320, 40),
      device('motor2', 'dcmotor', { in1: '17', in2: '5' }, 320, 160),
      device('motor3', 'dcmotor', { in1: '23', in2: '22' }, 320, 280)
    ],
    blocklyWorkspaceJson: program(
      null,
      stack(
        ifElse(
          compare('GT', readJoy1('VRX'), num(3000)), dcmotorSet('motor1', 'FWD', num(200)),
          ifElse(compare('LT', readJoy1('VRX'), num(1000)), dcmotorSet('motor1', 'REV', num(200)), dcmotorSet('motor1', 'STOP', num(0)))
        ),
        ifElse(
          compare('GT', readJoy1('VRY'), num(3000)), dcmotorSet('motor2', 'FWD', num(200)),
          ifElse(compare('LT', readJoy1('VRY'), num(1000)), dcmotorSet('motor2', 'REV', num(200)), dcmotorSet('motor2', 'STOP', num(0)))
        ),
        ifElse(
          compare('GT', readJoy2('VRY'), num(3000)), dcmotorSet('motor3', 'FWD', num(200)),
          ifElse(compare('LT', readJoy2('VRY'), num(1000)), dcmotorSet('motor3', 'REV', num(200)), dcmotorSet('motor3', 'STOP', num(0)))
        ),
        delay(100)
      )
    )
  },
  {
    id: 'joystick-dual-led-brightness',
    name: 'Joystick Controls Two LED Brightnesses',
    category: 'Mini Projects',
    description: 'X-axis fades one LED, Y-axis fades the other — a simple way to see how joystick readings map onto PWM output.',
    devices: [
      device('joy1', 'joystick', { vrx: '4', vry: '2' }, 100, 100),
      device('led1', 'led', '18', 300, 60),
      device('led2', 'led', '17', 300, 180)
    ],
    blocklyWorkspaceJson: program(
      null,
      stack(
        analogWrite('18', mathArith('DIVIDE', readJoy1('VRX'), num(16))),
        analogWrite('17', mathArith('DIVIDE', readJoy1('VRY'), num(16))),
        delay(30)
      )
    )
  },
  {
    id: 'joystick-corner-alarm',
    name: 'Joystick Corner Alarm',
    category: 'Mini Projects',
    description: 'Sounds the buzzer only when the joystick is pushed into the top-right corner — a simple demo of combining two conditions with AND.',
    devices: [device('joy1', 'joystick', { vrx: '4', vry: '2' }, 100, 100), device('buzzer1', 'buzzer', '18', 320, 100)],
    blocklyWorkspaceJson: program(
      null,
      stack(
        ifElse(
          andOr('AND', compare('GT', readJoy1('VRX'), num(3500)), compare('GT', readJoy1('VRY'), num(3500))),
          buzzerOn('18'),
          buzzerOff('18')
        ),
        delay(100)
      )
    )
  },
  {
    id: 'theremin',
    name: 'Ultrasonic Theremin',
    category: 'Mini Projects',
    description: 'Turns hand distance into musical pitch — wave your hand over the ultrasonic sensor to play the buzzer like a theremin.',
    devices: [device('us1', 'ultrasonic', { trig: '33', echo: '32' }, 100, 100), device('buzzer1', 'buzzer', '18', 320, 100)],
    blocklyWorkspaceJson: program(
      null,
      stack(buzzerTone('18', mathArith('MULTIPLY', readUltrasonic('us1'), num(15))), delay(100))
    )
  },
  {
    id: 'reaction-timer-game',
    name: 'Reaction Timer Game',
    category: 'Mini Projects',
    description: 'Lights the LED after a random pause, then counts loop cycles until you press the button — a rough reaction-speed score.',
    devices: [device('led1', 'led', '18', 100, 100), device('btn1', 'button', '35', 320, 100)],
    blocklyWorkspaceJson: program(
      null,
      stack(
        digitalWrite('18', 'LOW'),
        delay(1500),
        varSet('score', num(0)),
        digitalWrite('18', 'HIGH'),
        whileLoop('UNTIL', buttonPressed('35'), stack(varChange('score', num(1)), delay(10))),
        digitalWrite('18', 'LOW'),
        serialPrint(str('Your score (lower is faster):')),
        serialPrint(varGet('score')),
        delay(2000)
      ),
      [{ id: 'score', name: 'score' }]
    )
  },
  {
    id: 'traffic-light-sequencer',
    name: 'Traffic Light Sequencer',
    category: 'Mini Projects',
    description: 'Cycles three LEDs through a red → green → yellow → red traffic-light pattern.',
    devices: [device('red', 'led', '18', 100, 100), device('yellow', 'led', '17', 220, 100), device('green', 'led', '16', 340, 100)],
    blocklyWorkspaceJson: program(
      null,
      stack(
        digitalWrite('18', 'HIGH'), delay(3000), digitalWrite('18', 'LOW'),
        digitalWrite('16', 'HIGH'), delay(3000), digitalWrite('16', 'LOW'),
        digitalWrite('17', 'HIGH'), delay(1000), digitalWrite('17', 'LOW')
      )
    )
  },
  {
    id: 'two-player-reaction-race',
    name: 'Two-Player Reaction Race',
    category: 'Mini Projects',
    description: 'Each player has their own button and LED — press yours and it lights up, completely independent of the other player.',
    devices: [
      device('btn1', 'button', '4', 100, 100), device('led1', 'led', '18', 220, 100),
      device('btn2', 'button', '2', 100, 220), device('led2', 'led', '17', 220, 220)
    ],
    blocklyWorkspaceJson: program(
      null,
      stack(
        ifElse(buttonPressed('4'), digitalWrite('18', 'HIGH'), digitalWrite('18', 'LOW')),
        ifElse(buttonPressed('2'), digitalWrite('17', 'HIGH'), digitalWrite('17', 'LOW'))
      )
    )
  },
  {
    id: 'light-meter-brightness',
    name: 'Light Meter Brightness Gauge',
    category: 'Mini Projects',
    description: 'The LED gets brighter the darker it is — a continuous light-meter readout instead of a simple on/off night light.',
    devices: [device('ldr1', 'ldr', '35', 100, 100), device('led1', 'led', '18', 320, 100)],
    blocklyWorkspaceJson: program(
      null,
      stack(analogWrite('18', mathArith('DIVIDE', mathArith('MINUS', num(4095), readLdr('35')), num(16))), delay(100))
    )
  },
  {
    id: 'plant-care-alert',
    name: 'Plant Care Alert',
    category: 'Mini Projects',
    description: 'Sounds the buzzer if it\'s both dark AND hot — two conditions a plant would not enjoy at once.',
    devices: [device('ldr1', 'ldr', '35', 100, 100), device('temp1', 'temp', '32', 100, 220), device('buzzer1', 'buzzer', '18', 320, 160)],
    blocklyWorkspaceJson: program(
      null,
      stack(ifElse(andOr('AND', isDark('35', 1000), isHot('32')), buzzerOn('18'), buzzerOff('18')), delay(500))
    )
  },
  {
    id: 'touch-piano-note',
    name: 'Touch Piano Key',
    category: 'Mini Projects',
    description: 'Touching the sensor plays a note on the buzzer for as long as you hold it — a single "piano key".',
    devices: [device('touch1', 'touch', '12', 100, 100), device('buzzer1', 'buzzer', '18', 320, 100)],
    blocklyWorkspaceJson: program(null, stack(ifElse(touchDetected('12'), buzzerTone('18', num(440)), buzzerNoTone('18')), delay(50)))
  },
  {
    id: 'home-security-arm-disarm',
    name: 'Arm / Disarm Security System',
    category: 'Mini Projects',
    description: 'Tap the touch sensor once to arm the system; while armed, the IR sensor detecting motion sounds the alarm.',
    devices: [device('touch1', 'touch', '12', 100, 100), device('ir1', 'ir', '35', 100, 220), device('buzzer1', 'buzzer', '18', 320, 160)],
    blocklyWorkspaceJson: program(
      varSet('armed', bool(false)),
      stack(
        ifElse(touchDetected('12'), stack(varSet('armed', notBlk(varGet('armed'))), delay(400))),
        ifElse(andOr('AND', varGet('armed'), irDetected('35')), buzzerOn('18'), buzzerOff('18')),
        delay(200)
      ),
      [{ id: 'armed', name: 'armed' }]
    )
  },
  {
    id: 'greenhouse-fan-control',
    name: 'Greenhouse Fan & Alert',
    category: 'Mini Projects',
    description: 'When it gets too hot, the DC motor (acting as a fan) switches on AND the buzzer gives a short alert.',
    devices: [device('temp1', 'temp', '32', 100, 100), device('motor1', 'dcmotor', { in1: '18', in2: '19' }, 320, 60), device('buzzer1', 'buzzer', '17', 320, 200)],
    blocklyWorkspaceJson: program(
      null,
      stack(
        ifElse(
          isHot('32'),
          stack(dcmotorSet('motor1', 'FWD', num(255)), buzzerOn('17')),
          stack(dcmotorSet('motor1', 'STOP', num(0)), buzzerOff('17'))
        ),
        delay(500)
      )
    )
  },
  {
    id: 'pedestrian-crossing',
    name: 'Pedestrian Crossing Simulator',
    category: 'Mini Projects',
    description: 'Press the button to call a crossing: the light goes green → yellow → red, and the buzzer beeps during the walk phase.',
    devices: [
      device('btn1', 'button', '4', 100, 260),
      device('red', 'led', '18', 260, 100), device('yellow', 'led', '17', 260, 180), device('green', 'led', '16', 260, 260),
      device('buzzer1', 'buzzer', '22', 420, 180)
    ],
    blocklyWorkspaceJson: program(
      null,
      stack(
        digitalWrite('16', 'HIGH'),
        ifElse(
          buttonPressed('4'),
          stack(
            digitalWrite('16', 'LOW'), digitalWrite('17', 'HIGH'), delay(1000), digitalWrite('17', 'LOW'),
            digitalWrite('18', 'HIGH'), buzzerOn('22'), delay(3000), buzzerOff('22'), digitalWrite('18', 'LOW'),
            digitalWrite('16', 'HIGH')
          )
        ),
        delay(100)
      )
    )
  },
  {
    id: 'gesture-controlled-car',
    name: 'Gesture-Controlled Car',
    category: 'Mini Projects',
    description: 'Show the webcam an open palm to drive forward, a closed fist to stop — AI Vision driving two motors.',
    devices: [device('motor1', 'dcmotor', { in1: '18', in2: '19' }, 120, 60), device('motor2', 'dcmotor', { in1: '17', in2: '5' }, 120, 200)],
    blocklyWorkspaceJson: program(
      null,
      stack(
        ifElse(
          aiIsGesture('Open_Palm'),
          stack(dcmotorSet('motor1', 'FWD', num(200)), dcmotorSet('motor2', 'FWD', num(200))),
          stack(dcmotorSet('motor1', 'STOP', num(0)), dcmotorSet('motor2', 'STOP', num(0)))
        )
      )
    )
  },
  {
    id: 'voice-clap-alarm',
    name: 'Clap-Activated Alarm',
    category: 'Mini Projects',
    description: 'A loud clap (via the AI mic level block) triggers the buzzer and LED; touch the sensor to silence it.',
    devices: [device('touch1', 'touch', '12', 100, 100), device('buzzer1', 'buzzer', '18', 320, 60), device('led1', 'led', '17', 320, 180)],
    blocklyWorkspaceJson: program(
      varSet('triggered', bool(false)),
      stack(
        ifElse(compare('GT', aiMicLevel(), num(50)), varSet('triggered', bool(true))),
        ifElse(touchDetected('12'), varSet('triggered', bool(false))),
        ifElse(varGet('triggered'), stack(buzzerOn('18'), digitalWrite('17', 'HIGH')), stack(buzzerOff('18'), digitalWrite('17', 'LOW'))),
        delay(150)
      ),
      [{ id: 'triggered', name: 'triggered' }]
    )
  },
  {
    id: 'plant-monitor-dashboard',
    name: 'Plant Monitor Dashboard',
    category: 'Mini Projects',
    description: 'Shows both temperature and light level on the OLED — a two-sensor environment dashboard.',
    devices: [
      device('temp1', 'temp', '32', 100, 100), device('ldr1', 'ldr', '35', 100, 220),
      device('oled1', 'oled', { sda: '13', scl: '15' }, 320, 160)
    ],
    blocklyWorkspaceJson: program(
      oledInit('oled1'),
      stack(oledClear('oled1'), oledPrint('oled1', readTemp('32')), oledPrint('oled1', readLdr('35')), delay(1500))
    )
  },
  {
    id: 'ir-line-follower-basic',
    name: 'Basic Line-Follower Logic',
    category: 'Mini Projects',
    description: 'Uses both IR sensor slots as left/right line sensors: each detecting the line drives its own-side motor forward.',
    devices: [
      device('ir1', 'ir', '35', 100, 60), device('ir2', 'ir', '34', 100, 200),
      device('motor1', 'dcmotor', { in1: '18', in2: '19' }, 320, 60), device('motor2', 'dcmotor', { in1: '17', in2: '5' }, 320, 200)
    ],
    blocklyWorkspaceJson: program(
      null,
      stack(
        ifElse(irDetected('35'), dcmotorSet('motor2', 'FWD', num(180)), dcmotorSet('motor2', 'STOP', num(0))),
        ifElse(irDetected('34'), dcmotorSet('motor1', 'FWD', num(180)), dcmotorSet('motor1', 'STOP', num(0))),
        delay(100)
      )
    )
  },
  {
    id: 'dual-ldr-light-tracker',
    name: 'Dual-LDR Light Tracker',
    category: 'Mini Projects',
    description: 'A servo turns toward whichever LDR is brighter — the same idea a solar panel tracker uses.',
    devices: [device('ldr1', 'ldr', '35', 100, 100), device('ldr2', 'ldr', '34', 100, 220), device('servo1', 'servo', '23', 320, 160)],
    blocklyWorkspaceJson: program(
      null,
      stack(ifElse(compare('GT', readLdr('35'), readLdr('34')), servoWrite('23', num(180)), servoWrite('23', num(0))), delay(200))
    )
  },
  {
    id: 'tug-of-war-score',
    name: 'Two-Button Tug of War',
    category: 'Mini Projects',
    description: 'Two players push a shared score up or down with their own button — first to a target number wins.',
    devices: [device('btn1', 'button', '4', 100, 100), device('btn2', 'button', '2', 320, 100)],
    blocklyWorkspaceJson: program(
      varSet('score', num(0)),
      stack(
        ifElse(buttonPressed('4'), stack(varChange('score', num(1)), delay(200))),
        ifElse(buttonPressed('2'), stack(varChange('score', num(-1)), delay(200))),
        serialPrint(varGet('score')),
        delay(100)
      ),
      [{ id: 'score', name: 'score' }]
    )
  },
  {
    id: 'countdown-launch-buzzer',
    name: 'Countdown Launch Buzzer',
    category: 'Mini Projects',
    description: 'Counts down from 5 to 0 on the Serial Monitor, then gives a long buzzer "liftoff" tone.',
    devices: [device('buzzer1', 'buzzer', '18', 120, 120)],
    blocklyWorkspaceJson: program(
      varSet('count', num(5)),
      stack(
        whileLoop('WHILE', compare('GT', varGet('count'), num(0)), stack(serialPrint(varGet('count')), varChange('count', num(-1)), delay(1000))),
        serialPrint(str('Liftoff!')),
        buzzerTone('18', num(880)), delay(1000), buzzerNoTone('18'),
        varSet('count', num(5)), delay(3000)
      ),
      [{ id: 'count', name: 'count' }]
    )
  },
  {
    id: 'servo-pan-tilt-joystick',
    name: 'Joystick Pan-Tilt Mount',
    category: 'Mini Projects',
    description: 'One joystick smoothly aims two servos — X axis pans, Y axis tilts, like a small camera mount.',
    devices: [device('joy1', 'joystick', { vrx: '4', vry: '2' }, 100, 100), device('pan', 'servo', '23', 320, 60), device('tilt', 'servo', '19', 320, 200)],
    blocklyWorkspaceJson: program(
      null,
      stack(servoWrite('23', mathArith('DIVIDE', readJoy1('VRX'), num(23))), servoWrite('19', mathArith('DIVIDE', readJoy1('VRY'), num(23))), delay(50))
    )
  },

  // ── Programming Concepts ────────────────────────────────────────────────────
  {
    id: 'counting-with-variables',
    name: 'Counting with a Variable',
    category: 'Programming Concepts',
    description: 'The simplest possible variable demo: count up by one and print it, forever.',
    devices: [],
    blocklyWorkspaceJson: program(
      varSet('count', num(0)),
      stack(varChange('count', num(1)), serialPrint(varGet('count')), delay(500)),
      [{ id: 'count', name: 'count' }]
    )
  },
  {
    id: 'for-loop-led-pattern',
    name: 'For Loop LED Burst',
    category: 'Programming Concepts',
    description: 'Uses a For loop to blink the LED five times quickly, then pauses — loops repeating a fixed number of times.',
    devices: [device('led1', 'led', '18', 120, 120)],
    blocklyWorkspaceJson: program(
      null,
      stack(forLoop('i', num(0), num(4), num(1), stack(digitalWrite('18', 'HIGH'), delay(100), digitalWrite('18', 'LOW'), delay(100))), delay(1000)),
      [{ id: 'i', name: 'i' }]
    )
  },
  {
    id: 'while-loop-countdown',
    name: 'While Loop Countdown',
    category: 'Programming Concepts',
    description: 'Counts a variable down to zero with a While loop, then repeats — the difference between While and For.',
    devices: [],
    blocklyWorkspaceJson: program(
      varSet('count', num(5)),
      stack(
        whileLoop('WHILE', compare('GT', varGet('count'), num(0)), stack(serialPrint(varGet('count')), varChange('count', num(-1)), delay(1000))),
        ifElse(compare('EQ', varGet('count'), num(0)), stack(serialPrint(str('Liftoff!')), varSet('count', num(5)), delay(3000)))
      ),
      [{ id: 'count', name: 'count' }]
    )
  },
  {
    id: 'random-dice-roller',
    name: 'Random Dice Roller',
    category: 'Programming Concepts',
    description: 'Rolls a virtual six-sided die and blinks the LED that many times — random numbers plus a Repeat loop.',
    devices: [device('led1', 'led', '18', 120, 120)],
    blocklyWorkspaceJson: program(
      varSet('roll', mathRandom(num(1), num(6))),
      stack(
        serialPrint(str('You rolled:')),
        serialPrint(varGet('roll')),
        repeatN(varGet('roll'), stack(digitalWrite('18', 'HIGH'), delay(200), digitalWrite('18', 'LOW'), delay(200))),
        delay(1000),
        varSet('roll', mathRandom(num(1), num(6)))
      ),
      [{ id: 'roll', name: 'roll' }]
    )
  },
  {
    id: 'math-operations-demo',
    name: 'Math Operations Demo',
    category: 'Programming Concepts',
    description: 'Prints the result of add, subtract, multiply and divide on two numbers — no hardware needed.',
    devices: [],
    blocklyWorkspaceJson: program(
      null,
      stack(
        serialPrint(mathArith('ADD', num(7), num(3))),
        serialPrint(mathArith('MINUS', num(7), num(3))),
        serialPrint(mathArith('MULTIPLY', num(7), num(3))),
        serialPrint(mathArith('DIVIDE', num(7), num(3))),
        delay(2000)
      )
    )
  },
  {
    id: 'nested-if-grade-checker',
    name: 'Nested If Grade Checker',
    category: 'Programming Concepts',
    description: 'Classifies a score variable into a letter grade using nested If/Else blocks — no hardware needed.',
    devices: [],
    blocklyWorkspaceJson: program(
      varSet('score', num(85)),
      stack(
        ifElse(
          compare('GTE', varGet('score'), num(90)), serialPrint(str('Grade: A')),
          ifElse(compare('GTE', varGet('score'), num(75)), serialPrint(str('Grade: B')), serialPrint(str('Grade: C')))
        ),
        delay(2000)
      ),
      [{ id: 'score', name: 'score' }]
    )
  },

  // ── Bluetooth ───────────────────────────────────────────────────────────────
  {
    id: 'bluetooth-hello',
    name: 'Bluetooth: Say Hello',
    category: 'Bluetooth',
    description:
      'Sends a message every second over Bluetooth, which every board starts automatically under a name like "MSL_A1B2C3". Pair the board in Windows, then pick it in BT mode and press Connect.',
    devices: [],
    blocklyWorkspaceJson: program(btBegin('MY_STEAM_LAB'), stack(btSend(str('Hello from the board!')), delay(1000)))
  },
  {
    id: 'bluetooth-led-control',
    name: 'Bluetooth: Remote Control an LED',
    category: 'Bluetooth',
    description:
      'Send "on" or "off" from your phone or the Monitor send box to switch the LED. Upload once over USB, after that you can upload over Bluetooth.',
    devices: [device('led1', 'led', '18', 120, 120)],
    blocklyWorkspaceJson: program(
      btBegin('MY_STEAM_LAB'),
      stack(
        ifElse(
          btAvailable(),
          ifElse(
            compare('EQ', btRead(), str('on')),
            stack(digitalWrite('18', 'HIGH'), btSend(str('LED is ON'))),
            stack(digitalWrite('18', 'LOW'), btSend(str('LED is OFF')))
          )
        )
      )
    )
  },
  {
    id: 'bluetooth-sensor-stream',
    name: 'Bluetooth: Stream Sensor Readings',
    category: 'Bluetooth',
    description: 'Broadcasts the LDR light level over Bluetooth twice a second — a wireless data logger.',
    devices: [device('ldr1', 'ldr', '34', 120, 120)],
    blocklyWorkspaceJson: program(btBegin('MY_STEAM_LAB'), stack(btSend(readLdr('34')), delay(500)))
  },
  {
    id: 'bluetooth-servo-control',
    name: 'Bluetooth: Steer a Servo',
    category: 'Bluetooth',
    description: 'Send "left", "right" or "center" over Bluetooth to move a servo — stores the command in a variable so it can be checked more than once.',
    devices: [device('servo1', 'servo', '23', 120, 120)],
    blocklyWorkspaceJson: program(
      btBegin('MY_STEAM_LAB'),
      stack(
        ifElse(
          btAvailable(),
          stack(
            varSet('cmd', btRead()),
            ifElse(
              compare('EQ', varGet('cmd'), str('left')), servoWrite('23', num(0)),
              ifElse(compare('EQ', varGet('cmd'), str('right')), servoWrite('23', num(180)), servoWrite('23', num(90)))
            )
          )
        )
      ),
      [{ id: 'cmd', name: 'cmd' }]
    )
  },
  {
    id: 'bluetooth-motor-control',
    name: 'Bluetooth: Drive a Motor',
    category: 'Bluetooth',
    description: 'Send "fwd", "rev" or "stop" over Bluetooth to control a DC motor remotely.',
    devices: [device('motor1', 'dcmotor', { in1: '18', in2: '19' }, 120, 120)],
    blocklyWorkspaceJson: program(
      btBegin('MY_STEAM_LAB'),
      stack(
        ifElse(
          btAvailable(),
          stack(
            varSet('cmd', btRead()),
            ifElse(
              compare('EQ', varGet('cmd'), str('fwd')), dcmotorSet('motor1', 'FWD', num(200)),
              ifElse(compare('EQ', varGet('cmd'), str('rev')), dcmotorSet('motor1', 'REV', num(200)), dcmotorSet('motor1', 'STOP', num(0)))
            )
          )
        )
      ),
      [{ id: 'cmd', name: 'cmd' }]
    )
  },
  {
    id: 'bluetooth-ai-gesture-car',
    name: 'Bluetooth: AI Gesture Car',
    category: 'Bluetooth',
    description:
      'Pair the board over Bluetooth (Port Selection), then show the webcam a gesture in the AI Vision tab to drive a 2-motor car — no USB cable needed once paired. Open Palm forward, Closed Fist stop, Thumb Up turns right, Thumb Down turns left.',
    devices: [
      device('motor1', 'dcmotor', { in1: '18', in2: '19' }, 120, 60),
      device('motor2', 'dcmotor', { in1: '17', in2: '5' }, 120, 200)
    ],
    blocklyWorkspaceJson: program(
      btBegin('MY_STEAM_LAB_CAR'),
      stack(
        ifElse(
          aiIsGesture('Open_Palm'),
          stack(dcmotorSet('motor1', 'FWD', num(200)), dcmotorSet('motor2', 'FWD', num(200))),
          ifElse(
            aiIsGesture('Thumb_Up'),
            stack(dcmotorSet('motor1', 'FWD', num(200)), dcmotorSet('motor2', 'STOP', num(0))),
            ifElse(
              aiIsGesture('Thumb_Down'),
              stack(dcmotorSet('motor1', 'STOP', num(0)), dcmotorSet('motor2', 'FWD', num(200))),
              ifElse(
                aiIsGesture('Closed_Fist'),
                stack(dcmotorSet('motor1', 'STOP', num(0)), dcmotorSet('motor2', 'STOP', num(0)))
              )
            )
          )
        )
      )
    )
  },
  {
    id: 'bluetooth-temp-report',
    name: 'Bluetooth: Temperature Reporter',
    category: 'Bluetooth',
    description: 'Sends the current temperature over Bluetooth every second — read it live on your phone.',
    devices: [device('temp1', 'temp', '32', 120, 120)],
    blocklyWorkspaceJson: program(btBegin('MY_STEAM_LAB'), stack(btSend(readTemp('32')), delay(1000)))
  },
  {
    id: 'bluetooth-distance-report',
    name: 'Bluetooth: Distance Reporter',
    category: 'Bluetooth',
    description: 'Sends the ultrasonic distance reading over Bluetooth every half second.',
    devices: [device('us1', 'ultrasonic', { trig: '33', echo: '32' }, 120, 120)],
    blocklyWorkspaceJson: program(btBegin('MY_STEAM_LAB'), stack(btSend(readUltrasonic('us1')), delay(500)))
  },

  // ── WiFi & AI ──────────────────────────────────────────────────────────────
  {
    id: 'wifi-connect',
    name: 'WiFi: Connect and Report IP',
    category: 'WiFi & AI',
    description:
      'Joins your WiFi and prints the board IP to the Serial Monitor. Put that IP into WIFI upload mode to re-upload wirelessly. Edit the SSID and password blocks first.',
    devices: [],
    blocklyWorkspaceJson: program(wifiConnect('YOUR_WIFI_NAME', 'YOUR_PASSWORD'), stack(serialPrint(wifiGetIp()), delay(5000)))
  },
  {
    id: 'wifi-led-status',
    name: 'WiFi Connected Indicator',
    category: 'WiFi & AI',
    description: 'Lights an LED once the board has joined WiFi — a simple visual "online" indicator. Edit the SSID and password blocks first.',
    devices: [device('led1', 'led', '18', 120, 120)],
    blocklyWorkspaceJson: program(
      stack(wifiConnect('YOUR_WIFI_NAME', 'YOUR_PASSWORD'), digitalWrite('18', 'HIGH')),
      stack(delay(1000))
    )
  },
  {
    id: 'wifi-oled-ip',
    name: 'WiFi Shows IP on OLED',
    category: 'WiFi & AI',
    description: 'Connects to WiFi and displays the board\'s IP address on the OLED screen. Edit the SSID and password blocks first.',
    devices: [device('oled1', 'oled', { sda: '13', scl: '15' }, 120, 120)],
    blocklyWorkspaceJson: program(
      stack(oledInit('oled1'), wifiConnect('YOUR_WIFI_NAME', 'YOUR_PASSWORD'), oledPrint('oled1', wifiGetIp())),
      stack(delay(5000))
    )
  },
  {
    id: 'espnow-sender',
    name: 'ESP-NOW: Wireless Sender',
    category: 'WiFi & AI',
    description:
      'Broadcasts a "PING" message directly to another nearby ESP32 every second — no WiFi router needed. Flash this to one board and pair it with the "ESP-NOW: Wireless Receiver" example on a second board.',
    devices: [device('led1', 'led', '18', 120, 120)],
    blocklyWorkspaceJson: program(
      espnowInit(),
      stack(espnowSend(str('PING')), digitalWrite('18', 'HIGH'), delay(100), digitalWrite('18', 'LOW'), delay(900))
    )
  },
  {
    id: 'espnow-receiver',
    name: 'ESP-NOW: Wireless Receiver',
    category: 'WiFi & AI',
    description:
      'Flashes an LED each time it wirelessly receives a "PING" from another nearby ESP32 — no wires between the two boards, just power both on. Pair with the "ESP-NOW: Wireless Sender" example on a second board.',
    devices: [device('led1', 'led', '18', 120, 120)],
    blocklyWorkspaceJson: program(
      espnowInit(),
      stack(
        ifElse(
          compare('EQ', espnowReceivedMessage(), str('PING')),
          stack(digitalWrite('18', 'HIGH'), delay(150), digitalWrite('18', 'LOW'))
        ),
        delay(50)
      )
    )
  },
  {
    id: 'ai-gesture-led',
    name: 'AI Vision: Gesture Controls LED',
    category: 'WiFi & AI',
    description:
      'Open the AI Vision tab and show the webcam an open palm to switch the LED on, a closed fist to switch it off.',
    devices: [device('led1', 'led', '18', 120, 120)],
    blocklyWorkspaceJson: program(
      null,
      stack(ifElse(aiIsGesture('Open_Palm'), digitalWrite('18', 'HIGH'), ifElse(aiIsGesture('Closed_Fist'), digitalWrite('18', 'LOW'))))
    )
  },
  {
    id: 'ai-object-alert',
    name: 'AI Vision: Person Detected Alert',
    category: 'WiFi & AI',
    description: 'Sounds the buzzer whenever the AI Vision object detector sees a person in frame.',
    devices: [device('buzzer1', 'buzzer', '18', 120, 120)],
    blocklyWorkspaceJson: program(null, stack(ifElse(aiIsObject('person'), buzzerOn('18'), buzzerOff('18')), delay(200)))
  },
  {
    id: 'ai-expression-oled',
    name: 'AI Vision: Expression on OLED',
    category: 'WiFi & AI',
    description: 'Shows your detected facial expression (Happy, Sad, Surprised...) live on the OLED screen.',
    devices: [device('oled1', 'oled', { sda: '13', scl: '15' }, 120, 120)],
    blocklyWorkspaceJson: program(oledInit('oled1'), stack(oledClear('oled1'), oledPrint('oled1', aiDetectedExpression()), delay(500)))
  },
  {
    id: 'ai-shape-servo-sort',
    name: 'AI Vision: Shape Sorts Servo',
    category: 'WiFi & AI',
    description: 'Show the webcam a circle, square or triangle drawing and the servo moves to a different angle for each.',
    devices: [device('servo1', 'servo', '23', 120, 120)],
    blocklyWorkspaceJson: program(
      null,
      stack(
        ifElse(
          aiIsShape('Circle'), servoWrite('23', num(0)),
          ifElse(aiIsShape('Square'), servoWrite('23', num(90)), ifElse(aiIsShape('Triangle'), servoWrite('23', num(180))))
        ),
        delay(200)
      )
    )
  },

  // ── AI Junior: LED Matrix showcase ─────────────────────────────────────────
  {
    id: 'matrix-show-letter',
    name: 'LED Matrix: Show a Letter',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Displays a single character filling the whole 6x6 matrix. Try changing the letter or color.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(null, stack(ledMatrixShowChar(str('A'), '#00ff00', num(80))))
  },
  {
    id: 'matrix-scrolling-name',
    name: 'LED Matrix: Scrolling Banner',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Scrolls "HELLO" across the matrix, one column at a time — swap in your own name or message.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(null, stack(ledMatrixShowText(str('HELLO'), '#ffff00', num(60), num(80))))
  },
  {
    id: 'matrix-custom-face',
    name: 'LED Matrix: Custom Pixel Face',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Draws a hand-picked pixel-art winking face using the "show LEDs" block — click cells on the block itself to design your own picture.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(null, stack(ledMatrixShowLeds('011110101101111111110111101111011110', '#facc15', num(100))))
  },
  {
    id: 'matrix-heart',
    name: 'LED Matrix: Heart',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Shows the built-in heart icon in red.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(null, stack(ledMatrixShowPattern('HEART', '#ff0055')))
  },
  {
    id: 'matrix-pattern-slideshow',
    name: 'LED Matrix: Icon Slideshow',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Cycles through several of the built-in matrix icons, pausing on each one.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(
      null,
      stack(
        ledMatrixShowPattern('HEART', '#ff0055'), delay(1000),
        ledMatrixShowPattern('SMILEY', '#ffcc00'), delay(1000),
        ledMatrixShowPattern('STAR', '#00ffff'), delay(1000),
        ledMatrixShowPattern('CHECK', '#00ff00'), delay(1000),
        ledMatrixShowPattern('ARROW_UP', '#ff8800'), delay(1000)
      )
    )
  },
  {
    id: 'matrix-spinner',
    name: 'LED Matrix: Spinner Animation',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Plays the built-in spinner animation — a single pixel chasing around the border.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(null, stack(ledMatrixShowAnimation('SPINNER', '#00ffff')))
  },
  {
    id: 'matrix-pulse-heart',
    name: 'LED Matrix: Pulsing Heart',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Plays the built-in pulsing-heart animation — brightness fades up and down like a heartbeat.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(null, stack(ledMatrixShowAnimation('PULSE_HEART', '#ff0055')))
  },
  {
    id: 'matrix-blink-alert',
    name: 'LED Matrix: Blink Alert',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Flashes the whole matrix a few times — handy as a visual alarm.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(null, stack(ledMatrixShowAnimation('BLINK_ALL', '#ff0000'), delay(500)))
  },
  {
    id: 'matrix-rotate-demo',
    name: 'LED Matrix: Rotate Demo',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Draws the same up-arrow icon four times, rotating the matrix 90° each time, so the arrow visibly spins to point in every direction.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(
      null,
      stack(
        ledMatrixRotate('0'), ledMatrixShowPattern('ARROW_UP', '#00ffff'), delay(1000),
        ledMatrixRotate('90'), ledMatrixShowPattern('ARROW_UP', '#00ffff'), delay(1000),
        ledMatrixRotate('180'), ledMatrixShowPattern('ARROW_UP', '#00ffff'), delay(1000),
        ledMatrixRotate('270'), ledMatrixShowPattern('ARROW_UP', '#00ffff'), delay(1000)
      )
    )
  },
  {
    id: 'matrix-countdown',
    name: 'LED Matrix: Countdown Timer',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Counts down 5-4-3-2-1 on the matrix, one digit per second, then flashes a checkmark.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(
      null,
      stack(
        ledMatrixShowChar(str('5'), '#ffffff', num(80)), delay(1000),
        ledMatrixShowChar(str('4'), '#ffffff', num(80)), delay(1000),
        ledMatrixShowChar(str('3'), '#ffff00', num(80)), delay(1000),
        ledMatrixShowChar(str('2'), '#ff8800', num(80)), delay(1000),
        ledMatrixShowChar(str('1'), '#ff0000', num(80)), delay(1000),
        ledMatrixShowPattern('CHECK', '#00ff00'), delay(1500)
      )
    )
  },
  {
    id: 'matrix-button-color-picker',
    name: 'LED Matrix: Button Color Picker',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Each of the 4 onboard buttons fills the matrix with a different color — a quick way to try out the LED Matrix Fill block.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(
      null,
      stack(
        ifElse(
          buttonPressed('32'), ledMatrixFill('#ff0000'),
          ifElse(
            buttonPressed('33'), ledMatrixFill('#00ff00'),
            ifElse(
              buttonPressed('14'), ledMatrixFill('#0000ff'),
              ifElse(buttonPressed('13'), ledMatrixFill('#ffff00'), ledMatrixClear())
            )
          )
        ),
        delay(100)
      )
    )
  },
  {
    id: 'matrix-score-counter',
    name: 'LED Matrix: Score Counter',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Button 1 (SW1) adds a point, shown as a single digit 0-9 on the matrix; button 2 (SW2) resets it back to 0.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(
      { type: 'variables_set', fields: { VAR: V('score') }, inputs: { VALUE: { block: num(0) } } },
      stack(
        ifElse(buttonPressed('32'), stack(varChange('score', num(1)), delay(250))),
        ifElse(buttonPressed('33'), stack(varSet('score', num(0)), delay(250))),
        ifElse(
          compare('GT', varGet('score'), num(9)),
          varSet('score', num(0))
        ),
        ledMatrixShowChar(varGet('score'), '#00ffff', num(90))
      ),
      [{ id: 'score', name: 'score' }]
    )
  },
  {
    id: 'matrix-brightness-fade',
    name: 'LED Matrix: Brightness Fade',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Fills the matrix blue and sweeps the brightness from dim to full and back, showing off the Set Brightness block.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(
      null,
      stack(
        ledMatrixFill('#0066ff'),
        ledMatrixSetBrightness(num(10)), delay(150),
        ledMatrixSetBrightness(num(60)), delay(150),
        ledMatrixSetBrightness(num(120)), delay(150),
        ledMatrixSetBrightness(num(200)), delay(150),
        ledMatrixSetBrightness(num(255)), delay(300),
        ledMatrixSetBrightness(num(120)), delay(150),
        ledMatrixSetBrightness(num(30)), delay(300)
      )
    )
  },
  {
    id: 'matrix-random-twinkle',
    name: 'LED Matrix: Random Twinkle',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Lights up a random pixel in a random-ish color spot every loop, building up a twinkling starfield. Clears occasionally so it does not just fill solid.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(
      null,
      stack(
        ledMatrixSetPixel(mathRandom(num(0), num(5)), mathRandom(num(0), num(5)), 'ON', '#66ccff'),
        delay(150)
      )
    )
  },
  {
    id: 'matrix-rainbow-fill-cycle',
    name: 'LED Matrix: Rainbow Fill Cycle',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Fills the whole matrix with one solid color at a time, cycling through the rainbow.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(
      null,
      stack(
        ledMatrixFill('#ff0000'), delay(400),
        ledMatrixFill('#ff8800'), delay(400),
        ledMatrixFill('#ffff00'), delay(400),
        ledMatrixFill('#00ff00'), delay(400),
        ledMatrixFill('#00ffff'), delay(400),
        ledMatrixFill('#0000ff'), delay(400),
        ledMatrixFill('#ff00ff'), delay(400)
      )
    )
  },

  // ── AI Junior: Buzzer melody showcase ──────────────────────────────────────
  {
    id: 'buzzer-mario',
    name: 'Buzzer: Play Mario Theme',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Plays the classic Super Mario Bros. theme opening on the onboard buzzer.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(null, stack(buzzerPlayMelody('buzzer1', 'MARIO', num(0)), delay(500)))
  },
  {
    id: 'buzzer-happy-birthday',
    name: 'Buzzer: Play Happy Birthday',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Plays "Happy Birthday" on the onboard buzzer — good for a birthday-reminder gadget.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(null, stack(buzzerPlayMelody('buzzer1', 'HAPPY_BIRTHDAY', num(0)), delay(500)))
  },
  {
    id: 'buzzer-twinkle',
    name: 'Buzzer: Play Twinkle Twinkle',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Plays "Twinkle Twinkle Little Star" on the onboard buzzer.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(null, stack(buzzerPlayMelody('buzzer1', 'TWINKLE', num(0)), delay(500)))
  },
  {
    id: 'buzzer-jingle-bells',
    name: 'Buzzer: Play Jingle Bells',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Plays "Jingle Bells" on the onboard buzzer.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(null, stack(buzzerPlayMelody('buzzer1', 'JINGLE_BELLS', num(0)), delay(500)))
  },
  {
    id: 'buzzer-alarm-siren',
    name: 'Buzzer: Alarm Siren',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Alternates between two frequencies to make a simple wailing siren sound, using the Play Tone block directly.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(
      null,
      stack(buzzerPlayToneDuration('buzzer1', num(600), num(300)), buzzerPlayToneDuration('buzzer1', num(1000), num(300)))
    )
  },
  {
    id: 'buzzer-om-chant',
    name: 'Buzzer: Om Chant Tone',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'A long, low, sustained tone for a peaceful "Om" feel. A piezo buzzer can\'t chant, so this is a simple drone tone, not a recording of the real chant.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(null, stack(buzzerPlayMelody('buzzer1', 'OM', num(0)), delay(2000)))
  },
  {
    id: 'buzzer-aarti-bell',
    name: 'Buzzer: Aarti Bell Tone',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'A bright, quick ringing pattern like a temple bell (ghanti) for an aarti-style notification tone.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(null, stack(buzzerPlayMelody('buzzer1', 'AARTI_BELL', num(0)), delay(1000)))
  },
  {
    id: 'buzzer-gayatri-mantra-tone',
    name: 'Buzzer: Gayatri Mantra Tone',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'A gentle devotional bell tone inspired by the Gayatri Mantra\'s name — a simple melody for a piezo buzzer, not a transcription of the actual chanted mantra.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(null, stack(buzzerPlayMelody('buzzer1', 'GAYATRI_MANTRA', num(0)), delay(1500)))
  },
  {
    id: 'buzzer-om-jai-jagdish-hare-tone',
    name: 'Buzzer: Om Jai Jagdish Hare Tone',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'A simple bell-tone melody inspired by the well-known aarti "Om Jai Jagdish Hare" — a simplified buzzer tune, not the real sung aarti.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(null, stack(buzzerPlayMelody('buzzer1', 'OM_JAI_JAGDISH_HARE', num(0)), delay(1500)))
  },
  {
    id: 'buzzer-hanuman-chalisa-tone',
    name: 'Buzzer: Hanuman Chalisa Tone',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'A simple devotional bell tone inspired by the Hanuman Chalisa\'s name — a simplified buzzer tune, not a transcription of the actual chant.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(null, stack(buzzerPlayMelody('buzzer1', 'HANUMAN_CHALISA', num(0)), delay(1500)))
  },
  {
    id: 'buzzer-mahamrityunjaya-tone',
    name: 'Buzzer: Mahamrityunjaya Tone',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'A slow, calm devotional bell tone inspired by the Mahamrityunjaya Mantra\'s name — a simplified buzzer tune, not a transcription of the actual chant.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(null, stack(buzzerPlayMelody('buzzer1', 'MAHAMRITYUNJAYA', num(0)), delay(2000)))
  },
  {
    id: 'buzzer-ganesh-vandana-tone',
    name: 'Buzzer: Ganesh Vandana Tone',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'A short devotional bell tone inspired by a Ganesh Vandana invocation — a simplified buzzer tune, not a transcription of the actual chant.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(null, stack(buzzerPlayMelody('buzzer1', 'GANESH_VANDANA', num(0)), delay(1500)))
  },
  {
    id: 'buzzer-devotional-medley',
    name: 'Buzzer: Devotional Bell Medley',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Plays through several of the devotional bell tones back to back — Om, Aarti Bell, then Gayatri — with a short pause between each.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(
      null,
      stack(
        buzzerPlayMelody('buzzer1', 'OM', num(0)), delay(800),
        buzzerPlayMelody('buzzer1', 'AARTI_BELL', num(0)), delay(800),
        buzzerPlayMelody('buzzer1', 'GAYATRI_MANTRA', num(0)), delay(2000)
      )
    )
  },

  // ── AI Junior: mini projects (combining matrix, buzzer, motors, buttons, headers) ──
  {
    id: 'ai-junior-piano',
    name: 'AI Junior: 4-Button Piano',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Each of the 4 onboard buttons plays a different musical note — a tiny piano using the Play Tone block.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(
      null,
      stack(
        ifElse(buttonPressed('32'), buzzerPlayToneDuration('buzzer1', num(262), num(200))),
        ifElse(buttonPressed('33'), buzzerPlayToneDuration('buzzer1', num(330), num(200))),
        ifElse(buttonPressed('14'), buzzerPlayToneDuration('buzzer1', num(392), num(200))),
        ifElse(buttonPressed('13'), buzzerPlayToneDuration('buzzer1', num(523), num(200)))
      )
    )
  },
  {
    id: 'ai-junior-doorbell',
    name: 'AI Junior: Smart Doorbell',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Pressing SW1 rings an aarti-bell-style tone and flashes a heart on the matrix — a friendly doorbell.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(
      null,
      stack(
        ifElse(
          buttonPressed('32'),
          stack(ledMatrixShowPattern('HEART', '#ff0055'), buzzerPlayMelody('buzzer1', 'AARTI_BELL', num(0)), delay(600), ledMatrixClear())
        ),
        delay(100)
      )
    )
  },
  {
    id: 'ai-junior-ultrasonic-alert',
    name: 'AI Junior: Ultrasonic Proximity Alert',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Reads the ultrasonic sensor on the dedicated header (TX=GPIO16, RX=GPIO4) and shows a warning icon plus a beep when something gets within 20cm.',
    devices: aiJuniorDevices(device('us1', 'ultrasonic', { trig: 'GPIO16', echo: 'GPIO4' }, 600, 60)),
    blocklyWorkspaceJson: program(
      null,
      stack(
        serialPrint(readUltrasonic('us1')),
        ifElse(
          compare('LT', readUltrasonic('us1'), num(20)),
          stack(ledMatrixShowPattern('CROSS', '#ff0000'), buzzerPlayToneDuration('buzzer1', num(1500), num(150))),
          ledMatrixClear()
        ),
        delay(200)
      )
    )
  },
  {
    id: 'ai-junior-security-alarm',
    name: 'AI Junior: Security Alarm',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Sounds a siren and flashes the matrix red whenever the ultrasonic sensor detects something closer than 15cm — a simple motion-ish alarm.',
    devices: aiJuniorDevices(device('us1', 'ultrasonic', { trig: 'GPIO16', echo: 'GPIO4' }, 600, 60)),
    blocklyWorkspaceJson: program(
      null,
      stack(
        ifElse(
          compare('LT', readUltrasonic('us1'), num(15)),
          stack(ledMatrixShowAnimation('BLINK_ALL', '#ff0000'), buzzerPlayToneDuration('buzzer1', num(1800), num(200))),
          delay(200)
        )
      )
    )
  },
  {
    id: 'ai-junior-oled-hello',
    name: 'AI Junior: OLED Hello World',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Prints a greeting on an OLED screen plugged into the dedicated header (SDA=GPIO21, SCL=GPIO22).',
    devices: aiJuniorDevices(device('oled1', 'oled', { sda: 'GPIO21', scl: 'GPIO22' }, 60, 250)),
    blocklyWorkspaceJson: program(
      stack(oledInit('oled1'), oledTextSize('oled1', 1)),
      stack(oledClear('oled1'), oledPrint('oled1', str('Hello, AI Junior!')), delay(1000))
    )
  },
  {
    id: 'ai-junior-oled-ultrasonic-distance',
    name: 'AI Junior: OLED Distance Display',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Shows the live ultrasonic distance reading on the OLED screen, updating every half second.',
    devices: aiJuniorDevices(
      device('oled1', 'oled', { sda: 'GPIO21', scl: 'GPIO22' }, 60, 250),
      device('us1', 'ultrasonic', { trig: 'GPIO16', echo: 'GPIO4' }, 600, 60)
    ),
    blocklyWorkspaceJson: program(
      stack(oledInit('oled1'), oledTextSize('oled1', 2)),
      stack(oledClear('oled1'), oledPrint('oled1', readUltrasonic('us1')), delay(500))
    )
  },
  {
    id: 'ai-junior-motors-forward-back',
    name: 'AI Junior: Drive Forward / Backward',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'SW1 drives both onboard motors forward, SW2 drives them backward, otherwise they stop.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(
      null,
      stack(
        ifElse(
          buttonPressed('32'),
          stack(dcmotorSet('motor1', 'FWD', num(200)), dcmotorSet('motor2', 'FWD', num(200))),
          ifElse(
            buttonPressed('33'),
            stack(dcmotorSet('motor1', 'REV', num(200)), dcmotorSet('motor2', 'REV', num(200))),
            stack(dcmotorSet('motor1', 'STOP', num(0)), dcmotorSet('motor2', 'STOP', num(0)))
          )
        )
      )
    )
  },
  {
    id: 'ai-junior-obstacle-avoider',
    name: 'AI Junior: Obstacle Avoider Robot',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Drives forward until the ultrasonic sensor sees something closer than 20cm, then stops, beeps, and reverses briefly.',
    devices: aiJuniorDevices(device('us1', 'ultrasonic', { trig: 'GPIO16', echo: 'GPIO4' }, 600, 60)),
    blocklyWorkspaceJson: program(
      null,
      stack(
        ifElse(
          compare('LT', readUltrasonic('us1'), num(20)),
          stack(
            dcmotorSet('motor1', 'STOP', num(0)), dcmotorSet('motor2', 'STOP', num(0)),
            buzzerPlayToneDuration('buzzer1', num(1200), num(150)),
            dcmotorSet('motor1', 'REV', num(180)), dcmotorSet('motor2', 'REV', num(180)),
            delay(400),
            dcmotorSet('motor1', 'STOP', num(0)), dcmotorSet('motor2', 'STOP', num(0))
          ),
          stack(dcmotorSet('motor1', 'FWD', num(180)), dcmotorSet('motor2', 'FWD', num(180)))
        ),
        delay(100)
      )
    )
  },
  {
    id: 'ai-junior-note-sequencer',
    name: 'AI Junior: 4-Note Sequencer',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Press SW1 to step through a 4-note sequence one note at a time, shown as a number on the matrix and played on the buzzer.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(
      { type: 'variables_set', fields: { VAR: V('step') }, inputs: { VALUE: { block: num(0) } } },
      stack(
        ifElse(
          buttonPressed('32'),
          stack(
            varChange('step', num(1)),
            ifElse(compare('GT', varGet('step'), num(3)), varSet('step', num(0))),
            ledMatrixShowChar(varGet('step'), '#00ffff', num(100)),
            ifElse(
              compare('EQ', varGet('step'), num(0)), buzzerPlayToneDuration('buzzer1', num(262), num(200)),
              ifElse(
                compare('EQ', varGet('step'), num(1)), buzzerPlayToneDuration('buzzer1', num(330), num(200)),
                ifElse(
                  compare('EQ', varGet('step'), num(2)), buzzerPlayToneDuration('buzzer1', num(392), num(200)),
                  buzzerPlayToneDuration('buzzer1', num(523), num(200))
                )
              )
            ),
            delay(250)
          )
        )
      ),
      [{ id: 'step', name: 'step' }]
    )
  },
  {
    id: 'ai-junior-morning-alarm',
    name: 'AI Junior: Peaceful Morning Alarm',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'A gentle wake-up routine: shows a pulsing heart on the matrix while playing the Om chant tone.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(
      null,
      stack(ledMatrixShowAnimation('PULSE_HEART', '#ff8800'), buzzerPlayMelody('buzzer1', 'OM', num(0)))
    )
  },
  {
    id: 'ai-junior-light-show',
    name: 'AI Junior: Button Light & Sound Show',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Press SW1 to trigger a spinner animation on the matrix together with the Mario tune — a simple combined light-and-sound effect.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(
      null,
      stack(ifElse(buttonPressed('32'), stack(ledMatrixShowAnimation('SPINNER', '#ff00ff'), buzzerPlayMelody('buzzer1', 'MARIO', num(0)))), delay(100))
    )
  },

  // ── AI Junior: sensor-driven combos on the open jacks & ultrasonic header ──
  {
    id: 'ai-junior-potentiometer-matrix-mood',
    name: 'AI Junior: Potentiometer Sets Matrix Color',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Turn the potentiometer (plugged into sensor jack J4/GPIO34) past halfway to turn the matrix green; otherwise it stays red.',
    devices: aiJuniorDevices(device('potentiometer1', 'potentiometer', 'GPIO34', 600, 200)),
    blocklyWorkspaceJson: program(
      null,
      stack(
        serialPrint(readPot('34')),
        ifElse(compare('GT', readPot('34'), num(2048)), ledMatrixFill('#00ff00'), ledMatrixFill('#ff0000')),
        delay(200)
      )
    )
  },
  {
    id: 'ai-junior-potentiometer-buzzer-pitch',
    name: 'AI Junior: Potentiometer Controls Buzzer Pitch',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Turning the potentiometer (J4/GPIO34) smoothly changes the buzzer\'s tone frequency.',
    devices: aiJuniorDevices(device('potentiometer1', 'potentiometer', 'GPIO34', 600, 200)),
    blocklyWorkspaceJson: program(
      null,
      stack(buzzerTone('12', mathArith('ADD', num(200), readPot('34'))), delay(50))
    )
  },
  {
    id: 'ai-junior-ldr-matrix-nightlight',
    name: 'AI Junior: LDR Matrix Night Light',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'When the LDR (sensor jack J5/GPIO35) detects darkness, the matrix fills warm white like a little night light.',
    devices: aiJuniorDevices(device('ldr1', 'ldr', 'GPIO35', 600, 200)),
    blocklyWorkspaceJson: program(
      null,
      stack(serialPrint(readLdr('35')), ifElse(isDark('35', 1000), ledMatrixFill('#fff2cc'), ledMatrixClear()), delay(300))
    )
  },
  {
    id: 'ai-junior-ldr-buzzer-alert',
    name: 'AI Junior: LDR Darkness Beep',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Beeps once when the LDR (J5/GPIO35) senses it just got dark.',
    devices: aiJuniorDevices(device('ldr1', 'ldr', 'GPIO35', 600, 200)),
    blocklyWorkspaceJson: program(
      null,
      stack(ifElse(isDark('35', 1000), buzzerPlayToneDuration('buzzer1', num(1000), num(150))), delay(400))
    )
  },
  {
    id: 'ai-junior-ir-matrix-cross',
    name: 'AI Junior: IR Sensor Shows Cross',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Shows a cross icon on the matrix whenever the IR sensor (open jack J3/GPIO39) detects an obstacle.',
    devices: aiJuniorDevices(device('ir1', 'ir', 'GPIO39', 600, 200)),
    blocklyWorkspaceJson: program(
      null,
      stack(ifElse(irDetected('39'), ledMatrixShowPattern('CROSS', '#ff0000'), ledMatrixClear()), delay(150))
    )
  },
  {
    id: 'ai-junior-ir-buzzer-beep',
    name: 'AI Junior: IR Sensor Beep',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Beeps whenever the IR sensor (J3/GPIO39) detects an obstacle in front of it.',
    devices: aiJuniorDevices(device('ir1', 'ir', 'GPIO39', 600, 200)),
    blocklyWorkspaceJson: program(
      null,
      stack(ifElse(irDetected('39'), buzzerPlayToneDuration('buzzer1', num(800), num(120))), delay(150))
    )
  },
  {
    id: 'ai-junior-ultrasonic-matrix-bar',
    name: 'AI Junior: Ultrasonic Distance on Matrix',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Shows a heart when something is close, a check icon when it is far, using the ultrasonic sensor on its dedicated header.',
    devices: aiJuniorDevices(device('us1', 'ultrasonic', { trig: 'GPIO16', echo: 'GPIO4' }, 600, 60)),
    blocklyWorkspaceJson: program(
      null,
      stack(
        serialPrint(readUltrasonic('us1')),
        ifElse(compare('LT', readUltrasonic('us1'), num(15)), ledMatrixShowPattern('HEART', '#ff0055'), ledMatrixShowPattern('CHECK', '#00ff00')),
        delay(200)
      )
    )
  },
  {
    id: 'ai-junior-ultrasonic-buzzer-tone',
    name: 'AI Junior: Ultrasonic Controls Buzzer Pitch',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'A theremin-style effect — the closer an object is to the ultrasonic sensor, the higher the buzzer\'s pitch.',
    devices: aiJuniorDevices(device('us1', 'ultrasonic', { trig: 'GPIO16', echo: 'GPIO4' }, 600, 60)),
    blocklyWorkspaceJson: program(
      null,
      stack(buzzerTone('12', mathArith('MULTIPLY', mathArith('MINUS', num(100), readUltrasonic('us1')), num(20))), delay(50))
    )
  },
  {
    id: 'matrix-diamond-pulse',
    name: 'LED Matrix: Pulsing Diamond',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Shows the built-in diamond icon and sweeps the brightness up and down for a gentle pulsing effect.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(
      null,
      stack(
        ledMatrixShowPattern('DIAMOND', '#00ffff'),
        ledMatrixSetBrightness(num(20)), delay(200),
        ledMatrixSetBrightness(num(150)), delay(200),
        ledMatrixSetBrightness(num(255)), delay(400),
        ledMatrixSetBrightness(num(150)), delay(200),
        ledMatrixSetBrightness(num(20)), delay(400)
      )
    )
  },
  {
    id: 'buzzer-tone-scale',
    name: 'Buzzer: Musical Scale',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Plays a simple rising musical scale (C D E F G A B C) on the buzzer using the Play Tone block.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(
      null,
      stack(
        buzzerPlayToneDuration('buzzer1', num(262), num(200)),
        buzzerPlayToneDuration('buzzer1', num(294), num(200)),
        buzzerPlayToneDuration('buzzer1', num(330), num(200)),
        buzzerPlayToneDuration('buzzer1', num(349), num(200)),
        buzzerPlayToneDuration('buzzer1', num(392), num(200)),
        buzzerPlayToneDuration('buzzer1', num(440), num(200)),
        buzzerPlayToneDuration('buzzer1', num(494), num(200)),
        buzzerPlayToneDuration('buzzer1', num(523), num(400)),
        delay(800)
      )
    )
  },
  {
    id: 'ai-junior-good-morning',
    name: 'AI Junior: Good Morning Greeting',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'Shows "HI" scrolling on the matrix and plays a cheerful little tune — a simple good-morning greeting routine.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(
      null,
      stack(ledMatrixShowText(str('GOOD MORNING'), '#ffcc00', num(90), num(70)), buzzerPlayMelody('buzzer1', 'TWINKLE', num(0)))
    )
  },
  {
    id: 'ai-junior-square-toggle',
    name: 'AI Junior: Square/Diamond Toggle',
    category: 'AI Junior',
    board: 'ai-junior',
    description: 'SW3 shows a square on the matrix, SW4 shows a diamond — a simple two-button icon toggle to experiment with.',
    devices: aiJuniorDevices(),
    blocklyWorkspaceJson: program(
      null,
      stack(
        ifElse(
          buttonPressed('14'), ledMatrixShowPattern('SQUARE', '#00ff88'),
          ifElse(buttonPressed('13'), ledMatrixShowPattern('DIAMOND', '#ff8800'))
        ),
        delay(150)
      )
    )
  }
]

EXAMPLES.push(...buildComboExamples())

// This module is imported by both the renderer and the main process (menu.ts);
// `window` only exists in the former.
if (typeof window !== 'undefined') (window as any).EXAMPLES = EXAMPLES

export function getExample(id: string): ExampleProject | undefined {
  return EXAMPLES.find(e => e.id === id)
}

/** Example ids grouped by category, in menu order. */
export function getExampleMenuTree(): Array<{ category: string; items: Array<{ id: string; name: string }> }> {
  const order: ExampleProject['category'][] = [
    'Getting Started',
    'Sensors',
    'Motors & Outputs',
    'Displays',
    'AI Junior',
    'Mini Projects',
    'Programming Concepts',
    'Bluetooth',
    'WiFi & AI'
  ]
  return order
    .map(category => ({
      category,
      items: EXAMPLES.filter(e => e.category === category).map(e => ({ id: e.id, name: e.name }))
    }))
    .filter(group => group.items.length > 0)
}
