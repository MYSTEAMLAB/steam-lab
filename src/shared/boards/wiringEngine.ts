import { boardRegistry } from './index'
import type { PlacedDevice } from '../types/project'
import type { PinInterface } from '../types/board'

// ── Intentional LED / Buzzer / Motor pin sharing ─────────────────────────────
// Project-specific request: each numbered port drives its LED, buzzer and motor
// off ONE shared GPIO pin — port 1 on GPIO18, port 2 on GPIO17, port 3 on GPIO22,
// port 4 on GPIO16. (Ports 1/2/4 reach it through the motor's in1; port 3's motor
// carries GPIO22 as its in2 instead — see dcmotor_3 in the ESP32 pinmap.)
// Every other pin/component combination still goes through the normal
// one-device-per-pin safety check below — this is a narrow, explicit exception,
// not a general relaxation of it.
const SHARED_LED_BUZZER_MOTOR_PINS = new Set(['GPIO18', 'GPIO17', 'GPIO22', 'GPIO16'])
const SHARED_GROUP_TYPES = new Set(['led', 'buzzer', 'dcmotor'])

export interface ComponentPinRequirements {
  type: string
  /**
   * If an array of interfaces is provided, the component needs ONE pin that matches ALL those interfaces.
   * If a record is provided, the component needs MULTIPLE pins, each keyed by a name and matching the specified interfaces.
   */
  requiredInterfaces: PinInterface[] | Record<string, PinInterface[]>
  mustNotBeInputOnly?: boolean
  description: string
}

// Defines the board interface requirements for each type of peripheral component
export const COMPONENT_REQUIREMENTS: Record<string, ComponentPinRequirements> = {
  led: {
    type: 'LED Module',
    requiredInterfaces: ['DIGITAL_OUT'],
    description: 'Requires a digital output pin'
  },
  button: {
    type: 'Digital Input',
    requiredInterfaces: ['DIGITAL_IN'],
    description: 'Requires a digital input pin'
  },
  buzzer: {
    type: 'Digital Output / PWM',
    // It can use either DIGITAL_OUT or PWM, but let's require DIGITAL_OUT for basic on/off, PWM for tone
    requiredInterfaces: ['DIGITAL_OUT'],
    mustNotBeInputOnly: true,
    description: 'Requires a digital output or PWM pin'
  },
  potentiometer: {
    type: 'Analog Input',
    requiredInterfaces: ['ANALOG_IN'],
    description: 'Requires an analog input pin (ADC)'
  },
  ldr: {
    type: 'Analog Input',
    // The photoresistor forms a voltage divider, so its output is an analog level.
    // It must land on an ADC pin — a plain digital pin reads LOW nearly always.
    requiredInterfaces: ['ANALOG_IN'],
    description: 'Requires an analog input pin (ADC)'
  },
  temp: {
    type: 'Digital Input',
    requiredInterfaces: ['DIGITAL_IN'],
    // OneWire must both drive (write) and sense (read) the data line for reset/bit
    // pulses, so it cannot sit on an input-only GPIO (e.g. ESP32 GPIO34/35/36/39).
    mustNotBeInputOnly: true,
    description: 'Requires a digital pin (OneWire data line for DS18B20)'
  },
  servo: {
    type: 'PWM Output',
    requiredInterfaces: ['PWM'],
    mustNotBeInputOnly: true,
    description: 'Requires a PWM-capable output pin'
  },
  ir: {
    type: 'Digital Input',
    requiredInterfaces: ['DIGITAL_IN'],
    description: 'Requires a digital input pin'
  },
  touch: {
    type: 'Touch Input',
    requiredInterfaces: ['TOUCH', 'DIGITAL_IN'],
    description: 'Requires a capacitive touch-capable pin (ESP32: GPIO0, GPIO2, GPIO4, GPIO12-GPIO15, GPIO27, GPIO32, GPIO33)'
  },
  dht11: {
    type: 'Digital Sensor',
    requiredInterfaces: ['DIGITAL_IN'],
    description: 'Requires a digital pin'
  },
  ultrasonic: {
    type: 'Dual Digital Sensor',
    requiredInterfaces: {
      trig: ['DIGITAL_OUT'],
      echo: ['DIGITAL_IN']
    },
    mustNotBeInputOnly: true,
    description: 'Requires Trig (Out) and Echo (In) pins'
  },
  dcmotor: {
    type: 'DC Motor',
    requiredInterfaces: {
      in1: ['DIGITAL_OUT'],
      in2: ['DIGITAL_OUT']
    },
    mustNotBeInputOnly: true,
    description: 'Requires two digital direction/PWM pins'
  },
  motor_driver: {
    type: '4 Motor Driver',
    requiredInterfaces: {
      enA: ['PWM'],
      in1: ['DIGITAL_OUT'],
      in2: ['DIGITAL_OUT'],
      enB: ['PWM'],
      in3: ['DIGITAL_OUT'],
      in4: ['DIGITAL_OUT']
    },
    mustNotBeInputOnly: true,
    description: 'Requires two PWMs and four digital direction pins'
  },
  color_sensor: {
    type: 'I2C Color Sensor',
    requiredInterfaces: {
      sda: ['DIGITAL_OUT'], // fallback for I2C_SDA
      scl: ['DIGITAL_OUT']  // fallback for I2C_SCL
    },
    mustNotBeInputOnly: true,
    description: 'Requires I2C SDA and SCL pins'
  },
  joystick: {
    type: 'Analog Joystick',
    requiredInterfaces: {
      vrx: ['ANALOG_IN'],
      vry: ['ANALOG_IN']
    },
    description: 'Requires two analog input pins'
  },
  oled: {
    type: 'I2C Display',
    requiredInterfaces: {
      sda: ['DIGITAL_OUT'], // Using standard digital as fallback for I2C if I2C isn't explicitly defined
      scl: ['DIGITAL_OUT']
    },
    mustNotBeInputOnly: true,
    description: 'Requires I2C SDA and SCL pins'
  }
}


/**
 * Validates if a specific device assignment on a specific board is fully correct.
 */
export function validateDeviceAssignment(device: PlacedDevice, boardId: string, currentDevices: PlacedDevice[]): { valid: boolean; error?: string } {
  const reqs = COMPONENT_REQUIREMENTS[device.type]
  if (!reqs) return { valid: true }

  const pinMap = boardRegistry.getPinMap(boardId)
  
  if (!device.mappedPin || (typeof device.mappedPin === 'string' && !device.mappedPin)) {
    return { valid: false, error: 'Unassigned' }
  }

  if (typeof device.mappedPin === 'object' && Object.keys(device.mappedPin).length === 0) {
    return { valid: false, error: 'Unassigned' }
  }

  if (typeof device.mappedPin === 'object') {
    const emptyPins = Object.entries(device.mappedPin as Record<string, string>)
      .filter(([, v]) => !v)
      .map(([k]) => k)
    if (emptyPins.length > 0) {
      return { valid: false, error: `Missing pins: ${emptyPins.join(', ')}` }
    }
  }

  // Check for duplicates
  let allMapped = Array.isArray(reqs.requiredInterfaces) ? [device.mappedPin as string] : Object.values(device.mappedPin as Record<string, string>);

  for (const p of allMapped) {
    if (!p) continue;
    let count = 0;
    let allSharedGroupTypes = SHARED_GROUP_TYPES.has(device.type);
    for (const other of currentDevices) {
      const otherUsesPin = (typeof other.mappedPin === 'string' && other.mappedPin === p)
        || (typeof other.mappedPin === 'object' && other.mappedPin !== null && Object.values(other.mappedPin).includes(p));
      if (otherUsesPin) {
        count++;
        if (!SHARED_GROUP_TYPES.has(other.type)) allSharedGroupTypes = false;
      }
    }
    // LED/Buzzer/Motor are explicitly allowed to share GPIO18/17/16 (see
    // SHARED_LED_BUZZER_MOTOR_PINS above) — every other pin/component
    // combination still hits the normal duplicate-pin rejection.
    const isAllowedSharedPin = SHARED_LED_BUZZER_MOTOR_PINS.has(p) && allSharedGroupTypes;
    if (count > 1 && !isAllowedSharedPin) {
      return { valid: false, error: `Duplicate pin: ${p}` }
    }
  }

  if (Array.isArray(reqs.requiredInterfaces)) {
    const pinName = device.mappedPin as string
    const pinDef = pinMap.pins[pinName]
    if (!pinDef) return { valid: false, error: `Pin ${pinName} does not exist.` }
    if (reqs.mustNotBeInputOnly && pinDef.inputOnly) return { valid: false, error: `Pin ${pinName} is input-only.` }
    for (const reqInterface of reqs.requiredInterfaces) {
      if (!pinDef.interfaces.includes(reqInterface)) return { valid: false, error: `Pin ${pinName} lacks ${reqInterface}.` }
    }
  } else {
    const pins = device.mappedPin as Record<string, string>
    for (const [key, interfaces] of Object.entries(reqs.requiredInterfaces)) {
      const pinName = pins[key]
      if (!pinName) return { valid: false, error: `Missing pin for ${key}` }
      const pinDef = pinMap.pins[pinName]
      if (!pinDef) return { valid: false, error: `Pin ${pinName} does not exist.` }
      if (reqs.mustNotBeInputOnly && pinDef.inputOnly && !interfaces.includes('DIGITAL_IN') && !interfaces.includes('ANALOG_IN')) return { valid: false, error: `Pin ${pinName} is input-only.` }
      for (const reqInterface of interfaces) {
        if (!pinDef.interfaces.includes(reqInterface)) return { valid: false, error: `Pin ${pinName} lacks ${reqInterface}.` }
      }
    }
  }

  return { valid: true }
}

/**
 * Validates if a specific pin on a specific board can support a component type.
 * Note: This currently only validates single-pin assignments from the UI.
 */
export function validatePinAssignment(deviceType: string, pinName: string, boardId: string): { valid: boolean; error?: string } {

  const reqs = COMPONENT_REQUIREMENTS[deviceType]
  if (!reqs) return { valid: true }

  const pinMap = boardRegistry.getPinMap(boardId)
  const pinDef = pinMap.pins[pinName]

  if (!pinDef) {
    return { valid: false, error: `Pin ${pinName} does not exist on this board.` }
  }

  if (reqs.mustNotBeInputOnly && pinDef.inputOnly) {
    return { valid: false, error: `Pin ${pinName} is input-only. Cannot use for output.` }
  }

  if (Array.isArray(reqs.requiredInterfaces)) {
    for (const reqInterface of reqs.requiredInterfaces) {
      if (!pinDef.interfaces.includes(reqInterface)) {
        return { valid: false, error: `Pin ${pinName} lacks required capability: ${reqInterface}.` }
      }
    }
  }

  return { valid: true }
}

/**
 * Automatically finds the best available pin(s) for a component on a given board.
 * Returns a string for single-pin components, or a Record<string, string> for multi-pin components.
 */
export function findAvailablePin(deviceType: string, boardId: string, currentDevices: PlacedDevice[]): string | Record<string, string> {
  const pinMap = boardRegistry.getPinMap(boardId)
  const reqs = COMPONENT_REQUIREMENTS[deviceType]
  
  if (!reqs) {
    return Object.keys(pinMap.pins)[0] || ''
  }

  const assignedPins = new Set<string>()
  for (const device of currentDevices) {
    if (typeof device.mappedPin === 'string' && device.mappedPin) {
      assignedPins.add(device.mappedPin)
    } else if (typeof device.mappedPin === 'object' && device.mappedPin !== null) {
      for (const p of Object.values(device.mappedPin)) {
        if (typeof p === 'string' && p) assignedPins.add(p)
      }
    }
  }

  // A pin already in assignedPins still counts as "free" when it's one of the
  // designated LED/Buzzer/Motor shared pins and this device is one of the
  // types allowed to share it (see SHARED_LED_BUZZER_MOTOR_PINS above).
  const isPinOccupiedFor = (pinName: string): boolean => {
    if (!assignedPins.has(pinName)) return false
    return !(SHARED_LED_BUZZER_MOTOR_PINS.has(pinName) && SHARED_GROUP_TYPES.has(deviceType))
  }

  // ── LED / Buzzer / Motor: fixed ordinal assignment ────────────────────────
  // These three types intentionally reuse a small set of shared pins, so
  // "skip to the next free slot" doesn't apply (LED3/Buzzer3 deliberately
  // reuse the LED1/Buzzer1/Motor1 pin rather than getting their own) — the
  // Nth device of this type placed always maps to the Nth indexed peripheral
  // entry (led/led_2/led_3/led_4, etc.), regardless of occupancy.
  if (SHARED_GROUP_TYPES.has(deviceType)) {
    const ordinal = currentDevices.filter(d => d.type === deviceType).length + 1
    const ordinalPeripheral = pinMap.peripherals?.[ordinal === 1 ? deviceType : `${deviceType}_${ordinal}`]
    if (ordinalPeripheral?.preferredPin) {
      const preferred = ordinalPeripheral.preferredPin
      if (Array.isArray(reqs.requiredInterfaces)) {
        if (typeof preferred === 'string' && !isPinOccupiedFor(preferred) && pinMap.pins[preferred]) {
          return preferred
        }
      } else if (typeof preferred === 'object' && !Array.isArray(preferred)) {
        const allocation: Record<string, string> = {}
        const usedInThisPass = new Set<string>()
        let allFound = true
        for (const key of Object.keys(reqs.requiredInterfaces)) {
          const preferredPin = (preferred as Record<string, string>)[key]
          if (preferredPin && !isPinOccupiedFor(preferredPin) && !usedInThisPass.has(preferredPin) && pinMap.pins[preferredPin]) {
            allocation[key] = preferredPin
            usedInThisPass.add(preferredPin)
          } else {
            allFound = false
            break
          }
        }
        if (allFound) return allocation
      }
    }
    // Fall through to the generic logic below if the ordinal slot isn't
    // defined (5th+ device of this type) or its pins are unexpectedly taken.
  }

  // ── Try preferredPin from pinmap first ────────────────────────────────────
  let peripheral = pinMap.peripherals?.[deviceType]

  // If the base peripheral's preferred pins are fully occupied, check for _2, _3, etc.
  if (peripheral?.preferredPin) {
    let baseOccupied = false;
    if (typeof peripheral.preferredPin === 'string') {
      if (isPinOccupiedFor(peripheral.preferredPin)) baseOccupied = true;
    } else if (typeof peripheral.preferredPin === 'object' && !Array.isArray(peripheral.preferredPin)) {
      for (const p of Object.values(peripheral.preferredPin)) {
        if (isPinOccupiedFor(p as string)) baseOccupied = true;
      }
    }

    if (baseOccupied) {
      // Find the next available indexed peripheral (e.g., dcmotor_2)
      for (let i = 2; i <= 8; i++) {
        const nextPeriph = pinMap.peripherals?.[`${deviceType}_${i}`]
        if (nextPeriph?.preferredPin) {
          let nextOccupied = false;
          if (typeof nextPeriph.preferredPin === 'string') {
            if (isPinOccupiedFor(nextPeriph.preferredPin)) nextOccupied = true;
          } else if (typeof nextPeriph.preferredPin === 'object' && !Array.isArray(nextPeriph.preferredPin)) {
            for (const p of Object.values(nextPeriph.preferredPin)) {
              if (isPinOccupiedFor(p as string)) nextOccupied = true;
            }
          }
          if (!nextOccupied) {
            peripheral = nextPeriph;
            break;
          }
        }
      }
    }
  }

  if (peripheral?.preferredPin) {
    const preferred = peripheral.preferredPin

    if (Array.isArray(reqs.requiredInterfaces)) {
      // Single-pin component: try preferred string pin
      if (typeof preferred === 'string' && !isPinOccupiedFor(preferred)) {
        const pinDef = pinMap.pins[preferred]
        if (pinDef) return preferred
      }
    } else {
      // Multi-pin component: try preferred record
      if (typeof preferred === 'object' && !Array.isArray(preferred)) {
        const allocation: Record<string, string> = {}
        const usedInThisPass = new Set<string>()
        let allFound = true
        for (const key of Object.keys(reqs.requiredInterfaces)) {
          const preferredPin = (preferred as Record<string, string>)[key]
          if (preferredPin && !isPinOccupiedFor(preferredPin) && !usedInThisPass.has(preferredPin) && pinMap.pins[preferredPin]) {
            allocation[key] = preferredPin
            usedInThisPass.add(preferredPin)
          } else {
            allFound = false
            break
          }
        }
        if (allFound) return allocation
      }
    }
  }
  // ── End preferredPin check ─────────────────────────────────────────────────

  const availablePins = Object.entries(pinMap.pins)
    .filter(([name]) => !assignedPins.has(name))

  if (Array.isArray(reqs.requiredInterfaces)) {
    // Single pin logic
    for (const [pinName, pinDef] of availablePins) {
      if (reqs.mustNotBeInputOnly && pinDef.inputOnly) continue
      
      let hasAllInterfaces = true
      for (const reqInterface of reqs.requiredInterfaces) {
        if (!pinDef.interfaces.includes(reqInterface)) {
          hasAllInterfaces = false
          break
        }
      }
      if (hasAllInterfaces) return pinName
    }
    return ""
  } else {
    // Multi-pin logic
    const allocation: Record<string, string> = {}
    const usedInThisPass = new Set<string>()

    for (const [key, requiredInterfaces] of Object.entries(reqs.requiredInterfaces)) {
      let found = false
      for (const [pinName, pinDef] of availablePins) {
        if (usedInThisPass.has(pinName)) continue
        if (reqs.mustNotBeInputOnly && pinDef.inputOnly && !requiredInterfaces.includes('DIGITAL_IN') && !requiredInterfaces.includes('ANALOG_IN')) continue

        let hasAllInterfaces = true
        for (const reqInterface of requiredInterfaces) {
          if (!pinDef.interfaces.includes(reqInterface)) {
            hasAllInterfaces = false
            break
          }
        }
        if (hasAllInterfaces) {
          allocation[key] = pinName
          usedInThisPass.add(pinName)
          found = true
          break
        }
      }
      if (!found) {
        // Leave this role empty — will show as partial assignment
        allocation[key] = ''
      }
    }
    // Only return the record if at least one pin was found
    const hasAny = Object.values(allocation).some(p => p !== '')
    return hasAny ? allocation : ''
  }
}

