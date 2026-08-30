export const COMPONENT_PIN_OFFSETS: Record<string, Record<string, { x: number, y: number }>> = {
  led: {
    'Anode': { x: 0, y: 39 }
  },
  buzzer: {
    '1': { x: 0, y: 31 }
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
  potentiometer: {
    '1': { x: 0, y: 26 }
  },
  temp: {
    '1': { x: 0, y: 28 }
  },
  dht11: {
    '1': { x: 0, y: 22 }
  },
  ir: {
    '1': { x: 0, y: 20 }
  },
  touch: {
    '1': { x: -4, y: 24 }
  },
  ultrasonic: {
    '1': { x: -6, y: 24 },
    'trig': { x: -6, y: 24 },
    'echo': { x: 6, y: 24 }
  },
  dcmotor: {
    '1': { x: -22, y: 26 },
    'in1': { x: -22, y: 26 },
    'in2': { x: -22, y: 30 }
  },
  motor_driver: {
    '1': { x: -30, y: 22 }
  },
  oled: {
    '1': { x: -4, y: 26 },
    'sda': { x: -4, y: 26 },
    'scl': { x: 4, y: 26 }
  },
  joystick: {
    '1': { x: 2, y: 34 }
  },
  generic: {
    '1': { x: -8, y: 30 },
    '2': { x: 8, y: 30 }
  }
}
