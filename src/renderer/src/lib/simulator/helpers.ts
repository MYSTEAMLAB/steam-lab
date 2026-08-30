import type { PlacedDevice } from '@shared/types/project'
import type { SensorControlSpec } from './types'

/** Mirrors normalizePin() in arduinoGenerator.ts — strips the "GPIO" prefix. */
export function normalizePin(pin: string | undefined | null): string {
  if (!pin) return ''
  if (pin.startsWith('GPIO')) return pin.substring(4)
  return pin
}

export function isValidPin(pin: string | undefined | null): boolean {
  if (!pin || pin === '0' || pin.includes('No ') || pin === 'Error') return false
  return true
}

/** Mirrors findDevice-by-id-or-pin used throughout the generator's getDevicePin(). */
export function findDevice(devices: PlacedDevice[], idOrPin: string): PlacedDevice | undefined {
  return devices.find(d => d.id === idOrPin || d.mappedPin === idOrPin)
}

/** Mirrors getDevicePin() in arduinoGenerator.ts. */
export function devicePin(devices: PlacedDevice[], idOrPin: string, key?: string): string {
  const dev = findDevice(devices, idOrPin)
  if (!dev || !dev.mappedPin) return ''
  if (typeof dev.mappedPin === 'string') return normalizePin(dev.mappedPin)
  const pins = dev.mappedPin as Record<string, string>
  const result = key && pins[key] ? pins[key] : Object.values(pins)[0] || ''
  return normalizePin(result)
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

// Same paired-ground table as the LED generator/pinMode injection — an LED wired
// to a shared M-port pin needs its ground leg held LOW whenever the LED is driven.
export const LED_PAIRED_GND: Record<string, string> = { '18': '19', '17': '5', '22': '23', '16': '21' }

/**
 * Every sensor-ish device the simulator gives the student a live control for,
 * derived from the placed devices list. One entry per device, regardless of how
 * many blocks reference it — the control panel and the interpreter both key off
 * device.id, matching how getDevicePin() resolves pins.
 */
export function buildSensorControls(devices: PlacedDevice[], boardId: string): SensorControlSpec[] {
  const analogMax = boardId === 'esp32' ? 4095 : 1023
  const specs: SensorControlSpec[] = []

  for (const d of devices) {
    switch (d.type) {
      case 'button':
        specs.push({ deviceId: d.id, deviceType: d.type, kind: 'button', label: 'Button', default: false })
        break
      case 'ldr':
        specs.push({
          deviceId: d.id, deviceType: d.type, kind: 'range', label: 'Light level',
          min: 0, max: analogMax, step: 1, default: Math.round(analogMax * 0.5)
        })
        break
      case 'potentiometer':
        specs.push({
          deviceId: d.id, deviceType: d.type, kind: 'range', label: 'Knob',
          min: 0, max: analogMax, step: 1, default: Math.round(analogMax * 0.5)
        })
        break
      case 'ir':
        specs.push({ deviceId: d.id, deviceType: d.type, kind: 'toggle', label: 'Object detected', default: false })
        break
      case 'touch':
        specs.push({ deviceId: d.id, deviceType: d.type, kind: 'toggle', label: 'Touched', default: false })
        break
      case 'temp':
        specs.push({
          deviceId: d.id, deviceType: d.type, kind: 'range', label: 'Temperature °C',
          min: -10, max: 60, step: 0.5, default: 25
        })
        break
      case 'ultrasonic':
        specs.push({
          deviceId: d.id, deviceType: d.type, kind: 'range', label: 'Distance cm',
          min: 2, max: 400, step: 1, default: 50
        })
        break
      case 'joystick':
        specs.push({
          deviceId: d.id, deviceType: d.type, kind: 'joystick', label: 'Joystick',
          min: 0, max: analogMax, step: 1, default: Math.round(analogMax * 0.5)
        })
        break
    }
  }
  return specs
}
