import * as Blockly from 'blockly/core'
import { useAppStore } from '../../../store/useAppStore'
import { boardRegistry } from '@shared/boards'
import { COMPONENT_REQUIREMENTS } from '@shared/boards/wiringEngine'

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic Pin Dropdown Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns list of digital input pins currently assigned on the Hardware Canvas */
function getDigitalInputPins(): [string, string][] {
  const state = useAppStore.getState()
  const selectedBoard = state.selectedBoard
  if (!selectedBoard) return [['No Board', '']]
  try {
    const layout = state.boardLayouts[selectedBoard.id]
    if (!layout || !layout.devices) return [['No Digital Inputs Connected', '']]
    
    const options: [string, string][] = []
    const counts: Record<string, number> = {}
    for (const d of layout.devices) {
      if (!d.mappedPin) continue
      const reqs = COMPONENT_REQUIREMENTS[d.type]
      if (reqs && Array.isArray(reqs.requiredInterfaces) && reqs.requiredInterfaces.includes('DIGITAL_IN')) {
        if (typeof d.mappedPin === 'string') {
          counts[d.type] = (counts[d.type] || 0) + 1
          options.push([`${d.type.toUpperCase()} #${counts[d.type]} (GPIO${d.mappedPin})`, d.mappedPin])
        }
      }
    }
    return options.length > 0 ? options : [['No Digital Inputs Connected', '']]
  } catch (err) {
    console.error('[Blocks] getDigitalInputPins error:', err)
    return [['Error', '']]
  }
}

/** Returns list of digital output pins currently assigned on the Hardware Canvas */
function getDigitalOutputPins(): [string, string][] {
  const state = useAppStore.getState()
  const selectedBoard = state.selectedBoard
  if (!selectedBoard) return [['No Board', '']]
  try {
    const layout = state.boardLayouts[selectedBoard.id]
    if (!layout || !layout.devices) return [['No Digital Outputs Connected', '']]
    
    const options: [string, string][] = []
    const counts: Record<string, number> = {}
    layout.devices.forEach((d: any) => {
      if (!d.mappedPin) return
      if (d.type === 'led' || d.type === 'relay' || d.type === 'buzzer') {
        counts[d.type] = (counts[d.type] || 0) + 1
        options.push([`${d.type.toUpperCase()} #${counts[d.type]} (GPIO${d.mappedPin})`, d.mappedPin])
      }
    })
    return options.length > 0 ? options : [['No Digital Outputs Connected', '']]
  } catch (err) {
    console.error('[Blocks] getDigitalOutputPins error:', err)
    return [['Error', '']]
  }
}

/** Returns list of analog input pins currently assigned on the Hardware Canvas */
function getAnalogInputPins(): [string, string][] {
  const state = useAppStore.getState()
  const selectedBoard = state.selectedBoard
  if (!selectedBoard) return [['No Board', '']]
  try {
    const layout = state.boardLayouts[selectedBoard.id]
    if (!layout || !layout.devices) return [['No Analog Inputs Connected', '']]
    
    const options: [string, string][] = []
    const counts: Record<string, number> = {}
    for (const d of layout.devices) {
      if (!d.mappedPin) continue
      const reqs = COMPONENT_REQUIREMENTS[d.type]
      if (reqs && Array.isArray(reqs.requiredInterfaces) && reqs.requiredInterfaces.includes('ANALOG_IN')) {
        if (typeof d.mappedPin === 'string') {
          counts[d.type] = (counts[d.type] || 0) + 1
          options.push([`${d.type.toUpperCase()} #${counts[d.type]} (GPIO${d.mappedPin})`, d.mappedPin])
        }
      }
    }
    return options.length > 0 ? options : [['No Analog Inputs Connected', '']]
  } catch (err) {
    console.error('[Blocks] getAnalogInputPins error:', err)
    return [['Error', '']]
  }
}

/** Returns list of pins assigned to a specific component type */
function getComponentPins(type: string): [string, string][] {
  const state = useAppStore.getState()
  const selectedBoard = state.selectedBoard
  if (!selectedBoard) return [['No Board', 'LED_BUILTIN']]
  try {
    const layout = state.boardLayouts[selectedBoard.id]
    if (!layout || !layout.devices) return [[`No ${type.toUpperCase()} Connected`, 'LED_BUILTIN']]
    
    const options: [string, string][] = []
    let index = 1
    for (const d of layout.devices) {
      if (d.type === type && d.mappedPin) {
        if (typeof d.mappedPin === 'string') {
          options.push([`${type.toUpperCase()} #${index} (GPIO${d.mappedPin})`, d.mappedPin])
        } else {
          // If it's an object with multiple pins (like motor or LED on M-ports)
          const pinVals = Object.values(d.mappedPin).join(', GPIO')
          options.push([`${type.toUpperCase()} #${index} (Pins: GPIO${pinVals})`, d.id])
        }
        index++
      }
    }
    return options.length > 0 ? options : [[`No ${type.toUpperCase()} Connected`, 'LED_BUILTIN']]
  } catch (err) {
    console.error(`[Blocks] getComponentPins(${type}) error:`, err)
    return [['Error', 'LED_BUILTIN']]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Blockly Custom Blocks Definitions
// ─────────────────────────────────────────────────────────────────────────────

export function registerCustomBlocks(): void {
  // ── Input Blocks ──────────────────────────────────────────────────────────

  // Digital Read Pin
  Blockly.Blocks['input_digital_read'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('Digital Read Pin')
        .appendField(new Blockly.FieldDropdown(() => getDigitalInputPins()), 'PIN')
      this.setOutput(true, 'Number')
      this.setStyle('input_blocks')
      this.setTooltip('Reads the digital state (HIGH or LOW) from a physical pin.')
      this.setHelpUrl('')
    }
  }

  // Analog Read Pin
  Blockly.Blocks['input_analog_read'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('Analog Read Pin')
        .appendField(new Blockly.FieldDropdown(() => getAnalogInputPins()), 'PIN')
      this.setOutput(true, 'Number')
      this.setStyle('input_blocks')
      this.setTooltip('Reads the raw analog voltage value from a physical pin.')
      this.setHelpUrl('')
    }
  }

  // Push Button Read (Raw State)
  Blockly.Blocks['input_button_read'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('Button')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('button')), 'PIN')
        .appendField('Raw State')
      this.setOutput(true, 'Number')
      this.setStyle('input_blocks')
      this.setTooltip('Reads the raw digital state (HIGH/LOW) of the button pin.')
      this.setHelpUrl('')
    }
  }

  // Push Button Pressed (Boolean)
  Blockly.Blocks['input_button_pressed'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('Button')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('button')), 'PIN')
        .appendField('is Pressed?')
      this.setOutput(true, 'Boolean')
      this.setStyle('input_blocks')
      this.setTooltip('Returns true if the button is pressed (LOW due to INPUT_PULLUP).')
      this.setHelpUrl('')
    }
  }

  // Potentiometer Read
  Blockly.Blocks['input_potentiometer_read'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('Read Potentiometer')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('potentiometer')), 'PIN')
      this.setOutput(true, 'Number')
      this.setStyle('input_blocks')
      this.setTooltip('Reads the raw analog value from the potentiometer (0-4095 on ESP32, 0-1023 on Uno).')
      this.setHelpUrl('')
    }
  }

  // LDR Read
  Blockly.Blocks['input_ldr_read'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('LDR')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('ldr')), 'PIN')
        .appendField('Value')
      this.setOutput(true, 'Number')
      this.setStyle('input_blocks')
      this.setTooltip('Reads the raw analog light value.')
      this.setHelpUrl('')
    }
  }

  // LDR is Dark
  Blockly.Blocks['input_ldr_is_dark'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('LDR')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('ldr')), 'PIN')
        .appendField('is Dark?')
      this.setOutput(true, 'Boolean')
      this.setStyle('input_blocks')
      this.setTooltip('Returns true if it is dark (LDR analog value < 2000).')
      this.setHelpUrl('')
    }
  }

  // Temp Sensor Read
  Blockly.Blocks['input_temp_read'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('Temp Sensor')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('temp')), 'PIN')
        .appendField('°C')
      this.setOutput(true, 'Number')
      this.setStyle('input_blocks')
      this.setTooltip('Reads the TMP36 sensor and converts to Celsius.')
      this.setHelpUrl('')
    }
  }

  // Temp is Hot
  Blockly.Blocks['input_temp_is_hot'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('Temp Sensor')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('temp')), 'PIN')
        .appendField('is Hot (> 30°C)?')
      this.setOutput(true, 'Boolean')
      this.setStyle('input_blocks')
      this.setTooltip('Returns true if the temperature exceeds 30°C.')
      this.setHelpUrl('')
    }
  }

  // Potentiometer Read
  Blockly.Blocks['input_pot_read'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('Potentiometer')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('potentiometer')), 'PIN')
        .appendField('Value')
      this.setOutput(true, 'Number')
      this.setStyle('input_blocks')
      this.setTooltip('Reads the raw analog dial position.')
      this.setHelpUrl('')
    }
  }

  // ── Output Blocks ─────────────────────────────────────────────────────────

  // LED ON
  Blockly.Blocks['output_led_on'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('LED')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('led')), 'PIN')
        .appendField('ON')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setStyle('output_blocks')
      this.setTooltip('Turns the selected LED HIGH.')
      this.setHelpUrl('')
    }
  }

  // LED OFF
  Blockly.Blocks['output_led_off'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('LED')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('led')), 'PIN')
        .appendField('OFF')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setStyle('output_blocks')
      this.setTooltip('Turns the selected LED LOW.')
      this.setHelpUrl('')
    }
  }

  // Buzzer ON
  Blockly.Blocks['output_buzzer_on'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('Buzzer')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('buzzer')), 'PIN')
        .appendField('ON')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setStyle('output_blocks')
      this.setTooltip('Turns the selected buzzer HIGH (for active buzzers).')
      this.setHelpUrl('')
    }
  }

  // Buzzer OFF
  Blockly.Blocks['output_buzzer_off'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('Buzzer')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('buzzer')), 'PIN')
        .appendField('OFF')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setStyle('output_blocks')
      this.setTooltip('Turns the selected buzzer LOW (for active buzzers).')
      this.setHelpUrl('')
    }
  }

  // Buzzer Tone
  Blockly.Blocks['output_buzzer_tone'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('Buzzer')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('buzzer')), 'PIN')
        .appendField('Tone (Hz)')
      this.appendValueInput('FREQ')
        .setCheck('Number')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setStyle('output_blocks')
      this.setTooltip('Plays a tone on the selected buzzer.')
      this.setHelpUrl('')
    }
  }

  // Buzzer No Tone
  Blockly.Blocks['output_buzzer_notone'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('Buzzer')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('buzzer')), 'PIN')
        .appendField('Stop Tone')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setStyle('output_blocks')
      this.setTooltip('Stops playing a tone on the selected buzzer.')
      this.setHelpUrl('')
    }
  }

  // Servo Write
  Blockly.Blocks['output_servo_write'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('Servo')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('servo')), 'PIN')
        .appendField('Angle (0-180)')
      this.appendValueInput('ANGLE')
        .setCheck('Number')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setStyle('output_blocks')
      this.setTooltip('Sets the angle of the selected servo.')
      this.setHelpUrl('')
    }
  }

  // Digital Write
  Blockly.Blocks['output_digital_write'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('Digital Write Pin')
        .appendField(new Blockly.FieldDropdown(() => getDigitalOutputPins()), 'PIN')
        .appendField('state')
        .appendField(new Blockly.FieldDropdown([['HIGH', 'HIGH'], ['LOW', 'LOW']]), 'STATE')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setStyle('output_blocks')
      this.setTooltip('Sets a digital pin value to either HIGH or LOW.')
      this.setHelpUrl('')
    }
  }

  // ── System Blocks ─────────────────────────────────────────────────────────

  // Setup Entry
  Blockly.Blocks['system_setup'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('Setup')
      this.appendStatementInput('STACK')
        .setCheck(null)
      this.setStyle('system_blocks')
      this.setTooltip('Initialize parameters, pin modes, and libraries. Runs once at startup.')
      this.setHelpUrl('')
    }
  }

  // Loop Entry
  Blockly.Blocks['system_loop'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('Loop')
      this.appendStatementInput('STACK')
        .setCheck(null)
      this.setStyle('system_blocks')
      this.setTooltip('Executes blocks inside repeatedly. This is the main application thread.')
      this.setHelpUrl('')
    }
  }

  // Delay
  Blockly.Blocks['system_delay'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('Delay')
        .appendField(new Blockly.FieldNumber(1000, 0), 'MS')
        .appendField('ms')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setStyle('system_blocks')
      this.setTooltip('Pause program execution for the specified milliseconds.')
      this.setHelpUrl('')
    }
  }

  // ── WiFi Blocks (ESP32 Specific) ──────────────────────────────────────────

  // WiFi Connect
  Blockly.Blocks['wifi_connect'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('WiFi Connect')
      this.appendValueInput('SSID')
        .setCheck('String')
        .appendField('SSID')
      this.appendValueInput('PASSWORD')
        .setCheck('String')
        .appendField('Password')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setStyle('wifi_blocks')
      this.setTooltip('Connects the ESP32 chip to a standard 2.4GHz WiFi Access Point.')
      this.setHelpUrl('')
    }
  }

  // ── New Phase 4 Input Blocks ──────────────────────────────────────────────

  // IR Sensor
  Blockly.Blocks['input_ir_read'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('IR Sensor')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('ir')), 'PIN')
        .appendField('Detected?')
      this.setOutput(true, 'Boolean')
      this.setStyle('input_blocks')
      this.setTooltip('Returns true if an object is detected.')
    }
  }

  // Touch Sensor - Boolean (Touched?)
  Blockly.Blocks['input_touch_read'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('Touch Sensor')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('touch')), 'PIN')
        .appendField('is Pressed?')
      this.setOutput(true, 'Boolean')
      this.setStyle('input_blocks')
      this.setTooltip('Returns true if the digital touch pad is pressed.')
    }
  }

  // Touch Sensor - Raw Value (for calibration)
  Blockly.Blocks['input_touch_raw'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('Touch Raw Value')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('touch')), 'PIN')
      this.setOutput(true, 'Number')
      this.setStyle('input_blocks')
      this.setTooltip('Returns the raw capacitive value from touchRead(). Lower values mean touch is detected. Use this to calibrate your threshold.')
    }
  }

  // DHT11 Temp & Hum
  Blockly.Blocks['input_dht_read'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('DHT11')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('dht11')), 'PIN')
        .appendField('Read')
        .appendField(new Blockly.FieldDropdown([['Temperature', 'TEMP'], ['Humidity', 'HUM']]), 'TYPE')
      this.setOutput(true, 'Number')
      this.setStyle('input_blocks')
      this.setTooltip('Reads temperature or humidity from DHT11.')
    }
  }

  // Ultrasonic Distance
  Blockly.Blocks['input_ultrasonic_read'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('Ultrasonic')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('ultrasonic')), 'PIN')
        .appendField('Distance (cm)')
      this.setOutput(true, 'Number')
      this.setStyle('input_blocks')
      this.setTooltip('Reads the distance in cm.')
    }
  }

  // ── New Phase 4 Output Blocks ─────────────────────────────────────────────

  // DC Motor Control
  Blockly.Blocks['output_dcmotor_set'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('Set Motor')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('dcmotor')), 'PIN')
        .appendField('State')
        .appendField(new Blockly.FieldDropdown([['HIGH', 'HIGH'], ['LOW', 'LOW']]), 'STATE')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setStyle('output_blocks')
    }
  }

  // 4 Motor Driver (L298N)
  Blockly.Blocks['output_motor_driver_set'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('Motor Driver')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('motor_driver')), 'PIN')
        .appendField('Drive')
        .appendField(new Blockly.FieldDropdown([['Forward', 'FWD'], ['Backward', 'REV'], ['Left', 'LEFT'], ['Right', 'RIGHT'], ['Stop', 'STOP']]), 'ACTION')
      this.appendValueInput('SPEED')
        .setCheck('Number')
        .appendField('Speed (0-255)')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setStyle('output_blocks')
    }
  }

  Blockly.Blocks['serial_print'] = {
    init: function (this: Blockly.Block) {
      this.appendValueInput('TEXT')
        .setCheck(null)
        .appendField('Serial Print')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setStyle('system_blocks')
      this.setTooltip('Prints data to the Serial Monitor. Make sure to open the Monitor after uploading!')
    }
  }

  // ── Communication & OLED Blocks ───────────────────────────────────────────

  Blockly.Blocks['oled_init'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('OLED Initialize')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('oled')), 'PIN')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setStyle('system_blocks')
    }
  }

  Blockly.Blocks['oled_draw_text'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('OLED Draw Text')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('oled')), 'PIN')
      this.appendValueInput('TEXT')
        .setCheck(null)
        .appendField('Text')
      this.appendValueInput('X')
        .setCheck('Number')
        .appendField('X')
      this.appendValueInput('Y')
        .setCheck('Number')
        .appendField('Y')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setStyle('system_blocks')
    }
  }

  Blockly.Blocks['oled_set_cursor'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('OLED Set Cursor')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('oled')), 'PIN')
      this.appendValueInput('X')
        .setCheck('Number')
        .appendField('X')
      this.appendValueInput('Y')
        .setCheck('Number')
        .appendField('Y')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setStyle('system_blocks')
    }
  }

  Blockly.Blocks['oled_print'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('OLED Display')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('oled')), 'PIN')
      this.appendValueInput('TEXT')
        .setCheck(null)
        .appendField('Print')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setStyle('system_blocks')
    }
  }
  
  Blockly.Blocks['oled_clear'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('OLED Display')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('oled')), 'PIN')
        .appendField('Clear')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setStyle('system_blocks')
    }
  }

  Blockly.Blocks['bluetooth_begin'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('Bluetooth Initialize')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('bluetooth')), 'PIN')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setStyle('wifi_blocks')
    }
  }

  Blockly.Blocks['bluetooth_available'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('Bluetooth Available')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('bluetooth')), 'PIN')
      this.setOutput(true, 'Boolean')
      this.setStyle('wifi_blocks')
    }
  }

  Blockly.Blocks['bluetooth_send'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('Bluetooth')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('bluetooth')), 'PIN')
      this.appendValueInput('TEXT')
        .setCheck('String')
        .appendField('Send')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setStyle('wifi_blocks')
    }
  }
  
  Blockly.Blocks['bluetooth_read'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('Bluetooth')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('bluetooth')), 'PIN')
        .appendField('Read String')
      this.setOutput(true, 'String')
      this.setStyle('wifi_blocks')
    }
  }
}


// ── Phase 5 Expansion Blocks ──────────────────────────────────────────────

// 1. Sensors
Blockly.Blocks['input_ir_analog_read'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Read IR Analog on")
      .appendField(new Blockly.FieldDropdown(getAnalogInputPins), "PIN");
    this.setOutput(true, "Number");
    this.setColour('#5B67C4');
    this.setTooltip("Read raw analog value from IR sensor.");
  }
};

Blockly.Blocks['input_color_read'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Read Color Sensor")
      .appendField(new Blockly.FieldDropdown([
        ["Red", "R"],
        ["Green", "G"],
        ["Blue", "B"]
      ]), "COLOR");
    this.setOutput(true, "Number");
    this.setColour('#5B67C4');
    this.setTooltip("Read RGB value from the Color Sensor (TCS34725).");
  }
};

// 2. Motors
Blockly.Blocks['output_dcmotor_speed'] = {
  init: function() {
    this.appendValueInput("SPEED")
      .setCheck("Number")
      .appendField("Set DC Motor speed");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#E46759');
    this.setTooltip("Set the speed of the DC Motor (0-255).");
  }
};

// 3. Pin I/O
Blockly.Blocks['pin_mode'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Set Pin")
      .appendField(new Blockly.FieldDropdown(getDigitalInputPins), "PIN") // Shows all pins as fallback
      .appendField("mode to")
      .appendField(new Blockly.FieldDropdown([
        ["INPUT", "INPUT"],
        ["OUTPUT", "OUTPUT"],
        ["INPUT_PULLUP", "INPUT_PULLUP"]
      ]), "MODE");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#399066');
    this.setTooltip("Manually configure the hardware pin mode.");
  }
};

// 4. Joystick
Blockly.Blocks['input_joystick_read'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Read Joystick")
      .appendField(new Blockly.FieldDropdown([
        ["X-Axis (Horizontal)", "VRX"],
        ["Y-Axis (Vertical)", "VRY"]
      ]), "AXIS");
    this.setOutput(true, "Number");
    this.setColour('#5B67C4');
    this.setTooltip("Read Joystick axis value (0-4095).");
  }
};

// 5. Communication
Blockly.Blocks['wifi_status'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("WiFi is Connected");
    this.setOutput(true, "Boolean");
    this.setColour('#3b82f6');
  }
};

Blockly.Blocks['wifi_get_ip'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("WiFi Get IP Address");
    this.setOutput(true, "String");
    this.setColour('#3b82f6');
  }
};

Blockly.Blocks['wifi_http_request'] = {
  init: function() {
    this.appendValueInput("URL")
      .setCheck("String")
      .appendField("Send HTTP")
      .appendField(new Blockly.FieldDropdown([
        ["GET", "GET"],
        ["POST", "POST"]
      ]), "METHOD")
      .appendField("request to");
    this.setOutput(true, "String");
    this.setColour('#3b82f6');
    this.setTooltip("Sends an HTTP request and returns the response.");
  }
};

// 6. OLED Display
Blockly.Blocks['oled_show_var'] = {
  init: function() {
    this.appendValueInput("VAR")
      .appendField("OLED Show Variable");
    this.appendValueInput("X")
      .setCheck("Number")
      .appendField("at X");
    this.appendValueInput("Y")
      .setCheck("Number")
      .appendField("Y");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#8B5CF6');
    this.setInputsInline(true);
  }
};

Blockly.Blocks['oled_show_char'] = {
  init: function() {
    this.appendValueInput("CHAR")
      .setCheck("String")
      .appendField("OLED Show Character");
    this.appendValueInput("X")
      .setCheck("Number")
      .appendField("at X");
    this.appendValueInput("Y")
      .setCheck("Number")
      .appendField("Y");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#8B5CF6');
    this.setInputsInline(true);
  }
};

Blockly.Blocks['oled_blink'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("OLED Blink Text")
      .appendField(new Blockly.FieldDropdown([
        ["ON", "true"],
        ["OFF", "false"]
      ]), "STATE");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#8B5CF6');
  }
};

Blockly.Blocks['oled_scroll'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("OLED Scroll")
      .appendField(new Blockly.FieldDropdown([
        ["Right", "RIGHT"],
        ["Left", "LEFT"],
        ["Stop", "STOP"]
      ]), "DIR");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#8B5CF6');
  }
};

Blockly.Blocks['oled_color'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("OLED Text Color")
      .appendField(new Blockly.FieldDropdown([
        ["White", "WHITE"],
        ["Black", "BLACK"],
        ["Inverse", "INVERSE"]
      ]), "COLOR");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#8B5CF6');
  }
};

// 7. Loops
Blockly.Blocks['controls_forever'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("forever");
    this.appendStatementInput("DO")
      .setCheck(null);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#F2B148');
    this.setTooltip("Repeat operations forever.");
  }
};
Blockly.Blocks['output_analog_write'] = {
  init: function() {
    this.appendValueInput("NUM")
      .setCheck("Number")
      .appendField("Analog Write Pin")
      .appendField(new Blockly.FieldDropdown(getDigitalOutputPins), "PIN")
      .appendField("value");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#399066');
    this.setTooltip("Write an analog PWM value (0-255) to a pin.");
  }
};
Blockly.Blocks['input_joystick1_read'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Read Joystick 1")
      .appendField(new Blockly.FieldDropdown([
        ["Vertical", "VRY"],
        ["Horizontal", "VRX"]
      ]), "AXIS");
    this.setOutput(true, "Number");
    this.setColour('#5B67C4');
  }
};

Blockly.Blocks['input_joystick2_read'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Read Joystick 2")
      .appendField(new Blockly.FieldDropdown([
        ["Vertical", "VRY"],
        ["Horizontal", "VRX"]
      ]), "AXIS");
    this.setOutput(true, "Number");
    this.setColour('#5B67C4');
  }
};
// ── Explicit Requested Blocks ───────────────────────────────────────────────────
Blockly.Blocks['logic_double_equals'] = {
  init: function() {
    this.appendValueInput("A");
    this.appendDummyInput().appendField("==");
    this.appendValueInput("B");
    this.setInputsInline(true);
    this.setOutput(true, "Boolean");
    this.setColour('#59C059');
  }
};

Blockly.Blocks['logic_and_text'] = {
  init: function() {
    this.appendValueInput("A");
    this.appendDummyInput().appendField("&&");
    this.appendValueInput("B");
    this.setInputsInline(true);
    this.setOutput(true, "Boolean");
    this.setColour('#59C059');
  }
};

Blockly.Blocks['my_program_block'] = {
  init: function() {
    this.appendDummyInput().appendField("My Program");
    this.appendStatementInput("DO").setCheck(null);
    this.setColour('#FFBF00');
  }
};

Blockly.Blocks['declare_variable'] = {
  init: function() {
    this.appendDummyInput().appendField("Declare Variable")
        .appendField(new Blockly.FieldVariable("item"), "VAR");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#A55B80');
  }
};
