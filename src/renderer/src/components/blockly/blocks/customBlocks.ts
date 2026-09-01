import * as Blockly from 'blockly/core'
import { useAppStore } from '../../../store/useAppStore'
import { boardRegistry } from '@shared/boards'
import { COMPONENT_REQUIREMENTS } from '@shared/boards/wiringEngine'
import { getTrainedClassNames } from '@renderer/lib/ai/imageClassifier'
import { COCO_LABELS } from '@renderer/lib/ai/objectDetector'
import { SHAPE_LABELS } from '@renderer/lib/ai/shapeDetector'
import { EXPRESSION_LABELS } from '@renderer/lib/ai/expressionDetector'

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
          options.push([`${d.type.toUpperCase()} #${counts[d.type]} (${d.mappedPin})`, d.mappedPin])
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
        options.push([`${d.type.toUpperCase()} #${counts[d.type]} (${d.mappedPin})`, d.mappedPin])
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
          options.push([`${d.type.toUpperCase()} #${counts[d.type]} (${d.mappedPin})`, d.mappedPin])
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
          options.push([`${type.toUpperCase()} #${index} (${d.mappedPin})`, d.mappedPin])
        } else {
          // If it's an object with multiple pins (like motor or LED on M-ports)
          const pinVals = Object.values(d.mappedPin).join(', ')
          options.push([`${type.toUpperCase()} #${index} (Pins: ${pinVals})`, d.id])
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

  // LDR Light Level (analog)
  // The LDR sits in a voltage divider on an ADC pin (ESP32 GPIO34 / Uno A0), so its
  // output is a continuous voltage. digitalRead() on that divider almost never crosses
  // the logic-HIGH threshold, which is why it used to read 0 all the time — always
  // read it with analogRead(). 'input_ldr_read_digital' stays registered (as the same
  // analog block) so older saved projects still load.
  const ldrReadBlock = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('LDR')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('ldr')), 'PIN')
        .appendField('Light Value')
      this.setOutput(true, 'Number')
      this.setStyle('input_blocks')
      this.setTooltip('Reads the raw light level from the LDR (0-4095 on ESP32, 0-1023 on Uno). Brighter light = higher value.')
      this.setHelpUrl('')
    }
  }
  Blockly.Blocks['input_ldr_read_analog'] = ldrReadBlock
  Blockly.Blocks['input_ldr_read_digital'] = ldrReadBlock

  // LDR is Dark
  Blockly.Blocks['input_ldr_is_dark'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('LDR')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('ldr')), 'PIN')
        .appendField('is Dark? (below')
        .appendField(new Blockly.FieldNumber(1000, 0), 'THRESHOLD')
        .appendField(')')
      this.setOutput(true, 'Boolean')
      this.setStyle('input_blocks')
      this.setTooltip('Returns true when the LDR light value drops below the threshold. Tune the threshold using the "LDR Light Value" block on the Serial Monitor.')
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
      this.setTooltip('Reads the DS18B20 sensor temperature in Celsius.')
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

  // ── ESP-NOW Blocks (direct ESP32-to-ESP32 wireless, no router needed) ─────
  // Broadcast-only: every board that calls "ESP-NOW Start" both sends to and
  // listens for every other nearby board on the same WiFi channel, so
  // students never have to look up or hardcode a peer's MAC address to pair
  // a sender/receiver pair.

  Blockly.Blocks['espnow_init'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('ESP-NOW Start')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setStyle('wifi_blocks')
      this.setTooltip('Starts direct wireless ESP32-to-ESP32 communication (ESP-NOW). No WiFi router needed — every nearby board running this also receives what is sent.')
      this.setHelpUrl('')
    }
  }

  Blockly.Blocks['espnow_send_message'] = {
    init: function (this: Blockly.Block) {
      this.appendValueInput('MESSAGE')
        .setCheck(null)
        .appendField('ESP-NOW Send')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setStyle('wifi_blocks')
      this.setTooltip('Wirelessly sends text or a number to every other nearby board running ESP-NOW.')
      this.setHelpUrl('')
    }
  }

  Blockly.Blocks['espnow_message_received'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('ESP-NOW Message Received?')
      this.setOutput(true, 'Boolean')
      this.setStyle('wifi_blocks')
      this.setTooltip('True once this board has received at least one ESP-NOW message from another board.')
      this.setHelpUrl('')
    }
  }

  Blockly.Blocks['espnow_received_message'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('ESP-NOW Received Message')
      this.setOutput(true, 'String')
      this.setStyle('wifi_blocks')
      this.setTooltip('The most recent text received over ESP-NOW from another board.')
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
          .appendField('to')
          .appendField(new Blockly.FieldDropdown([
            ['Forward', 'FWD'],
            ['Backward', 'REV'],
            ['Stop', 'STOP']
          ]), 'STATE')
      this.appendValueInput('SPEED')
        .setCheck('Number')
        .appendField('Speed (0-255)')
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
      this.appendDummyInput()
        .appendField('Style')
        .appendField(new Blockly.FieldDropdown([['Normal', 'NORMAL'], ['Bold', 'BOLD']]), 'STYLE')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setStyle('system_blocks')
      this.setTooltip('Prints text to the OLED. Bold prints the text twice, one pixel over, for a heavier look.')
    }
  }

  // Persists for the rest of the sketch (like the real display.setTextSize call it
  // wraps) — set it once in Setup, or change it mid-Loop to switch sizes on the fly.
  Blockly.Blocks['oled_text_size'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('OLED Display')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('oled')), 'PIN')
        .appendField('Text Size')
        .appendField(new Blockly.FieldDropdown([['1 (Small)', '1'], ['2 (Medium)', '2'], ['3 (Large)', '3'], ['4 (X-Large)', '4']]), 'SIZE')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setStyle('system_blocks')
      this.setTooltip('Sets how large the OLED text is drawn from this point on.')
      this.setHelpUrl('')
    }
  }

  const OLED_ICON_OPTIONS: [string, string][] = [
    ['↑ Up Arrow', 'ARROW_UP'],
    ['↓ Down Arrow', 'ARROW_DOWN'],
    ['← Left Arrow', 'ARROW_LEFT'],
    ['→ Right Arrow', 'ARROW_RIGHT'],
    ['● Dot', 'DOT'],
    ['■ Square', 'SQUARE'],
    ['♥ Heart', 'HEART'],
    ['★ Star', 'STAR'],
    ['✓ Check', 'CHECK'],
    ['✗ Cross', 'CROSS']
  ]

  Blockly.Blocks['oled_icon'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('OLED Display')
        .appendField(new Blockly.FieldDropdown(() => getComponentPins('oled')), 'PIN')
        .appendField('Icon')
        .appendField(new Blockly.FieldDropdown(OLED_ICON_OPTIONS), 'ICON')
      this.appendValueInput('X').setCheck('Number').appendField('at X')
      this.appendValueInput('Y').setCheck('Number').appendField('Y')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setStyle('system_blocks')
      this.setTooltip('Draws a small 8x8 pixel icon on the OLED — arrows and a few simple shapes/symbols. The screen is monochrome, so these are pixel-art icons, not full-color emoji.')
      this.setHelpUrl('')
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

  // ESP32 WROOM has a built-in Bluetooth radio (Classic BT), so these blocks
  // drive it directly via the Arduino core's BluetoothSerial library — no
  // external module (e.g. HC-05) or GPIO wiring required, unlike every other
  // block above that reads from a placed hardware component's mapped pin.
  Blockly.Blocks['bluetooth_begin'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('Bluetooth Initialize')
        .appendField('Name')
        .appendField(new Blockly.FieldTextInput('MY_STEAM_LAB'), 'NAME')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setStyle('wifi_blocks')
      this.setTooltip("Every ESP32 board already starts Bluetooth automatically under a fixed name like \"MSL_A1B2C3\" tied to that specific board's hardware — this keeps the same board pairable under the same name no matter what program is flashed to it. This block is kept for older projects; the Name field here no longer changes what the board actually broadcasts.")
    }
  }

  Blockly.Blocks['bluetooth_available'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('Bluetooth Available')
      this.setOutput(true, 'Boolean')
      this.setStyle('wifi_blocks')
      this.setTooltip('True if the connected Bluetooth device has sent data waiting to be read.')
    }
  }

  Blockly.Blocks['bluetooth_send'] = {
    init: function (this: Blockly.Block) {
      this.appendValueInput('TEXT')
        // Unchecked like serial_print: SerialBT.println() takes numbers as happily
        // as text, and restricting this to String blocked the common case of
        // streaming a sensor reading to a phone.
        .setCheck(null)
        .appendField('Bluetooth Send')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setStyle('wifi_blocks')
      this.setTooltip('Sends text or a number over Bluetooth to the connected device.')
    }
  }

  Blockly.Blocks['bluetooth_read'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('Bluetooth Read String')
      this.setOutput(true, 'String')
      this.setStyle('wifi_blocks')
      this.setTooltip('Reads a line of text sent from the connected Bluetooth device.')
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
    this.setTooltip("Read the raw Red/Green/Blue channel value (0-65535) from the Color Sensor (TCS34725).");
  }
};

Blockly.Blocks['input_color_clear'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Read Color Sensor Clear/Ambient Light");
    this.setOutput(true, "Number");
    this.setColour('#5B67C4');
    this.setTooltip("Read the raw Clear (ambient light) channel value (0-65535) from the Color Sensor (TCS34725).");
  }
};

Blockly.Blocks['input_color_lux'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Read Color Sensor Light Level (Lux)");
    this.setOutput(true, "Number");
    this.setColour('#5B67C4');
    this.setTooltip("Read the estimated light intensity in lux from the Color Sensor (TCS34725).");
  }
};

Blockly.Blocks['input_color_temperature'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Read Color Sensor Temperature (K)");
    this.setOutput(true, "Number");
    this.setColour('#5B67C4');
    this.setTooltip("Read the estimated color temperature in Kelvin from the Color Sensor (TCS34725).");
  }
};

Blockly.Blocks['input_color_is'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Detected Color Is")
      .appendField(new Blockly.FieldDropdown([
        ["Red", "Red"],
        ["Green", "Green"],
        ["Blue", "Blue"],
        ["Yellow", "Yellow"],
        ["White", "White"],
        ["Black", "Black"]
      ]), "COLOR_NAME");
    this.setOutput(true, "Boolean");
    this.setColour('#5B67C4');
    this.setTooltip("True if the Color Sensor's simple color classifier currently matches this color. A basic heuristic — may need different lighting/distance to classify reliably.");
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

// ── AI Vision Blocks ────────────────────────────────────────────────────────
// Read the latest trained-classifier prediction / mic level streamed over
// serial from the AI Vision panel (see src/renderer/src/lib/ai/aiSerialWriter.ts).

Blockly.Blocks['ai_predicted_class'] = {
  init: function (this: Blockly.Block) {
    this.appendDummyInput()
      .appendField('AI: Predicted Class')
    this.setOutput(true, 'String')
    this.setStyle('ai_blocks')
    this.setTooltip('The most recent class name predicted by the AI Vision panel.')
  }
}

Blockly.Blocks['ai_prediction_confidence'] = {
  init: function (this: Blockly.Block) {
    this.appendDummyInput()
      .appendField('AI: Confidence (%)')
    this.setOutput(true, 'Number')
    this.setStyle('ai_blocks')
    this.setTooltip('Confidence (0-100) of the most recent AI prediction.')
  }
}

Blockly.Blocks['ai_is_class'] = {
  init: function (this: Blockly.Block) {
    this.appendDummyInput()
      .appendField('AI: Predicted Class =')
      .appendField(new Blockly.FieldDropdown(() => getTrainedClassNames()), 'CLASS')
    this.setOutput(true, 'Boolean')
    this.setStyle('ai_blocks')
    this.setTooltip('True if the most recent AI prediction matches the selected class.')
  }
}

Blockly.Blocks['ai_mic_level'] = {
  init: function (this: Blockly.Block) {
    this.appendDummyInput()
      .appendField('AI: Mic Level (%)')
    this.setOutput(true, 'Number')
    this.setStyle('ai_blocks')
    this.setTooltip('Live microphone loudness (0-100) from the AI Vision panel.')
  }
}

// ── Hand Gesture Blocks ─────────────────────────────────────────────────────
// Built-in hand-landmark gesture recognition (MediaPipe Gesture Recognizer) —
// no training needed, unlike the trainable classifier blocks above.

const AI_GESTURE_OPTIONS: [string, string][] = [
  ['Closed Fist', 'Closed_Fist'],
  ['Open Palm', 'Open_Palm'],
  ['Pointing Up', 'Pointing_Up'],
  ['Thumb Down', 'Thumb_Down'],
  ['Thumb Up', 'Thumb_Up'],
  ['Victory', 'Victory'],
  ['I Love You', 'ILoveYou']
]

Blockly.Blocks['ai_hand_gesture'] = {
  init: function (this: Blockly.Block) {
    this.appendDummyInput()
      .appendField('AI: Hand Gesture')
    this.setOutput(true, 'String')
    this.setStyle('ai_blocks')
    this.setTooltip('The most recently recognized built-in hand gesture ("None" if no hand is visible).')
  }
}

Blockly.Blocks['ai_gesture_confidence'] = {
  init: function (this: Blockly.Block) {
    this.appendDummyInput()
      .appendField('AI: Gesture Confidence (%)')
    this.setOutput(true, 'Number')
    this.setStyle('ai_blocks')
    this.setTooltip('Confidence (0-100) of the most recent hand gesture recognition.')
  }
}

Blockly.Blocks['ai_is_gesture'] = {
  init: function (this: Blockly.Block) {
    this.appendDummyInput()
      .appendField('AI: Gesture =')
      .appendField(new Blockly.FieldDropdown(AI_GESTURE_OPTIONS), 'GESTURE')
    this.setOutput(true, 'Boolean')
    this.setStyle('ai_blocks')
    this.setTooltip('True if the most recent hand gesture matches the selected built-in gesture.')
  }
}

Blockly.Blocks['ai_hand_detected'] = {
  init: function (this: Blockly.Block) {
    this.appendDummyInput()
      .appendField('AI: Hand Detected?')
    this.setOutput(true, 'Boolean')
    this.setStyle('ai_blocks')
    this.setTooltip('True if a hand is currently visible to the camera.')
  }
}

// ── Object Detection Blocks ──────────────────────────────────────────────────
// Built-in general object detection (MediaPipe Object Detector, EfficientDet-Lite0)
// — 80 fixed COCO categories, no training needed, same shape as the gesture blocks above.

const AI_OBJECT_OPTIONS: [string, string][] = COCO_LABELS.map(label => [label, label])

Blockly.Blocks['ai_detected_object'] = {
  init: function (this: Blockly.Block) {
    this.appendDummyInput()
      .appendField('AI: Detected Object')
    this.setOutput(true, 'String')
    this.setStyle('ai_blocks')
    this.setTooltip('The most confident object detected by the camera ("None" if nothing is detected).')
  }
}

Blockly.Blocks['ai_object_confidence'] = {
  init: function (this: Blockly.Block) {
    this.appendDummyInput()
      .appendField('AI: Object Confidence (%)')
    this.setOutput(true, 'Number')
    this.setStyle('ai_blocks')
    this.setTooltip('Confidence (0-100) of the most recent object detection.')
  }
}

Blockly.Blocks['ai_is_object'] = {
  init: function (this: Blockly.Block) {
    this.appendDummyInput()
      .appendField('AI: Object =')
      .appendField(new Blockly.FieldDropdown(AI_OBJECT_OPTIONS), 'OBJECT')
    this.setOutput(true, 'Boolean')
    this.setStyle('ai_blocks')
    this.setTooltip('True if the most confident detected object matches the selected category.')
  }
}

Blockly.Blocks['ai_object_detected'] = {
  init: function (this: Blockly.Block) {
    this.appendDummyInput()
      .appendField('AI: Object Detected?')
    this.setOutput(true, 'Boolean')
    this.setStyle('ai_blocks')
    this.setTooltip('True if any object is currently detected by the camera.')
  }
}

// ── Shape Detection Blocks ───────────────────────────────────────────────────
// Basic 2D geometric shapes (circle, square, rectangle, triangle, pentagon, star)
// classified via OpenCV.js contour analysis — no training needed, same shape as
// the gesture/object blocks above, but classical CV rather than a neural model.

const AI_SHAPE_OPTIONS: [string, string][] = SHAPE_LABELS.map(label => [label, label])

Blockly.Blocks['ai_detected_shape'] = {
  init: function (this: Blockly.Block) {
    this.appendDummyInput()
      .appendField('AI: Detected Shape')
    this.setOutput(true, 'String')
    this.setStyle('ai_blocks')
    this.setTooltip('The most recently recognized 2D shape ("None" if no shape is visible).')
  }
}

Blockly.Blocks['ai_shape_confidence'] = {
  init: function (this: Blockly.Block) {
    this.appendDummyInput()
      .appendField('AI: Shape Confidence (%)')
    this.setOutput(true, 'Number')
    this.setStyle('ai_blocks')
    this.setTooltip('Confidence (0-100) of the most recent shape detection.')
  }
}

Blockly.Blocks['ai_is_shape'] = {
  init: function (this: Blockly.Block) {
    this.appendDummyInput()
      .appendField('AI: Shape =')
      .appendField(new Blockly.FieldDropdown(AI_SHAPE_OPTIONS), 'SHAPE')
    this.setOutput(true, 'Boolean')
    this.setStyle('ai_blocks')
    this.setTooltip('True if the most recently detected shape matches the selected category.')
  }
}

Blockly.Blocks['ai_shape_detected'] = {
  init: function (this: Blockly.Block) {
    this.appendDummyInput()
      .appendField('AI: Shape Detected?')
    this.setOutput(true, 'Boolean')
    this.setStyle('ai_blocks')
    this.setTooltip('True if a recognizable shape is currently visible to the camera.')
  }
}

// ── Face Expression Blocks ───────────────────────────────────────────────────
// Facial expression classification via face-api.js (TinyFaceDetector + FaceExpressionNet) —
// a real model trained on expressions, no training needed, same shape as the blocks above.

const AI_EXPRESSION_OPTIONS: [string, string][] = EXPRESSION_LABELS.map(label => [label, label])

Blockly.Blocks['ai_detected_expression'] = {
  init: function (this: Blockly.Block) {
    this.appendDummyInput()
      .appendField('AI: Detected Expression')
    this.setOutput(true, 'String')
    this.setStyle('ai_blocks')
    this.setTooltip('The most recently recognized facial expression ("None" if no face is visible).')
  }
}

Blockly.Blocks['ai_expression_confidence'] = {
  init: function (this: Blockly.Block) {
    this.appendDummyInput()
      .appendField('AI: Expression Confidence (%)')
    this.setOutput(true, 'Number')
    this.setStyle('ai_blocks')
    this.setTooltip('Confidence (0-100) of the most recent expression classification.')
  }
}

Blockly.Blocks['ai_is_expression'] = {
  init: function (this: Blockly.Block) {
    this.appendDummyInput()
      .appendField('AI: Expression =')
      .appendField(new Blockly.FieldDropdown(AI_EXPRESSION_OPTIONS), 'EXPRESSION')
    this.setOutput(true, 'Boolean')
    this.setStyle('ai_blocks')
    this.setTooltip('True if the most recently detected expression matches the selected category.')
  }
}

Blockly.Blocks['ai_face_detected'] = {
  init: function (this: Blockly.Block) {
    this.appendDummyInput()
      .appendField('AI: Face Detected?')
    this.setOutput(true, 'Boolean')
    this.setStyle('ai_blocks')
    this.setTooltip('True if a face is currently visible to the camera.')
  }
}
