export const COMPONENT_PIN_OFFSETS: Record<string, Record<string, { x: number, y: number }>> = {
  led: {
    'Cathode': { x: -6, y: 34 },
    'Anode': { x: 6, y: 44 }
  },
  button: {
    '1A': { x: -28, y: -11 },
    '2A': { x: -28, y: 11 },
    '1B': { x: 28, y: -11 },
    '2B': { x: 28, y: 11 }
  },
  servo: {
    'PWM': { x: -20, y: 40 },
    'VCC': { x: -20, y: 45 },
    'GND': { x: -20, y: 50 }
  },
  generic: {
    '1': { x: -8, y: 30 },
    '2': { x: 8, y: 30 }
  }
}
