import * as Blockly from 'blockly/core'
import { COMPONENT_REQUIREMENTS } from '@shared/boards/wiringEngine'
import type { PlacedDevice } from '@shared/types/project'

export const arduinoGenerator = new Blockly.CodeGenerator('Arduino') as any

if (typeof window !== 'undefined') {
  ;(window as any).arduinoGenerator = arduinoGenerator
}

arduinoGenerator.INDENT = '  '

// --- Helper Functions ---
function normalizePin(pin: string | undefined | null): string {
  if (!pin) return '';
  if (pin.startsWith('GPIO')) return pin.substring(4);
  return pin;
}

function getPinFieldValue(block: Blockly.Block): string {
  return normalizePin(block.getFieldValue('PIN'));
}


function isValidPin(pin: string | undefined): boolean {
  if (!pin || pin === '0' || pin.includes('No ') || pin === 'Error') return false;
  return true;
}

function getDevicePin(deviceId: string, pinKey?: string): string {
  const devices = (arduinoGenerator as any).currentDevices_ as PlacedDevice[]
  if (!devices) return "" 
  const dev = devices.find(d => d.id === deviceId || d.mappedPin === deviceId)
  if (!dev || !dev.mappedPin) return ""
  if (typeof dev.mappedPin === 'string') return normalizePin(dev.mappedPin)
  const pins = dev.mappedPin as Record<string, string>
  const result = pinKey && pins[pinKey] ? pins[pinKey] : Object.values(pins)[0] || ""
  return normalizePin(result);
}

// Ensure global variables are declared
arduinoGenerator.init = function(workspace: Blockly.Workspace) {
  // Call Blockly's default init if it exists
  if (Object.getPrototypeOf(arduinoGenerator).init) {
    Object.getPrototypeOf(arduinoGenerator).init.call(this, workspace)
  }
  if (!arduinoGenerator.nameDB_) {
    arduinoGenerator.nameDB_ = new Blockly.Names(arduinoGenerator.RESERVED_WORDS_)
  } else {
    arduinoGenerator.nameDB_.reset()
  }
  arduinoGenerator.nameDB_.setVariableMap(workspace.getVariableMap())
  arduinoGenerator.definitions_ = Object.create(null)
  arduinoGenerator.functionNames_ = Object.create(null)

  // Declare all variables globally as integers for simplicity in this visual editor
  const variables = workspace.getVariableMap().getAllVariables()
  if (variables.length > 0) {
    variables.forEach(v => {
      const varName = arduinoGenerator.nameDB_.getName(v.getId(), Blockly.Names.NameType.VARIABLE)
      arduinoGenerator.definitions_['var_' + varName] = `int ${varName} = 0;`
    })
  }
}

arduinoGenerator.finish = function(code: string) {
  // This is handled by our custom generateCode function instead
  return code
}

arduinoGenerator.scrub_ = function(block: Blockly.Block, code: string, opt_thisOnly?: boolean) {
  let commentCode = ''
  // Only collect comments for blocks that aren't inline.
  if (!block.outputConnection || !block.outputConnection.targetConnection) {
    let comment = block.getCommentText()
    if (comment) {
      commentCode += `// ${comment.replace(/\n/g, '\n// ')}\n`
    }
  }
  const nextBlock = block.nextConnection && block.nextConnection.targetBlock()
  const nextCode = opt_thisOnly ? '' : arduinoGenerator.blockToCode(nextBlock)
  return commentCode + code + nextCode
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Block Generators
// ─────────────────────────────────────────────────────────────────────────────

arduinoGenerator.forBlock['system_setup'] = function(block: Blockly.Block) {
  const branch = arduinoGenerator.statementToCode(block, 'STACK')
  return `void setup() {\n${branch}}\n\n`
}

arduinoGenerator.forBlock['system_loop'] = function(block: Blockly.Block) {
  const branch = arduinoGenerator.statementToCode(block, 'STACK')
  return `void loop() {\n${branch}}\n\n`
}

arduinoGenerator.forBlock['system_delay'] = function(block: Blockly.Block) {
  const ms = block.getFieldValue('MS') || '1000'
  return `delay(${ms});\n`
}

arduinoGenerator.forBlock['serial_print'] = function(block: Blockly.Block) {
  const text = arduinoGenerator.valueToCode(block, 'TEXT', 0) || '""'
  return `Serial.println(${text});\n`
}

arduinoGenerator.forBlock['output_led_on'] = function(block: Blockly.Block) {
  const devId = getPinFieldValue(block) || 'LED_BUILTIN';
  const pin = getDevicePin(devId) || devId;
  
  let code = '';
  // Hardcoded mapping for M-port LEDs where 1 pin must be LOW
  const pairedGnd: Record<string, string> = { '18': '19', '17': '5', '22': '23', '16': '21' };
  if (pairedGnd[pin]) {
    code += `digitalWrite(${pairedGnd[pin]}, LOW);\n`;
  }
  
  code += `digitalWrite(${pin}, HIGH);\n`;
  return code;
}

arduinoGenerator.forBlock['output_led_off'] = function(block: Blockly.Block) {
  const devId = getPinFieldValue(block) || 'LED_BUILTIN';
  const pin = getDevicePin(devId) || devId;
  
  let code = '';
  const pairedGnd: Record<string, string> = { '18': '19', '17': '5', '22': '23', '16': '21' };
  if (pairedGnd[pin]) {
    code += `digitalWrite(${pairedGnd[pin]}, LOW);\n`;
  }
  
  code += `digitalWrite(${pin}, LOW);\n`;
  return code;
}

arduinoGenerator.forBlock['output_buzzer_on'] = function(block: Blockly.Block) {
  const pin = getPinFieldValue(block) || '0'
  return `digitalWrite(${pin}, HIGH);\n`
}

arduinoGenerator.forBlock['output_buzzer_off'] = function(block: Blockly.Block) {
  const pin = getPinFieldValue(block) || '0'
  return `digitalWrite(${pin}, LOW);\n`
}

arduinoGenerator.forBlock['output_buzzer_tone'] = function(block: Blockly.Block) {
  const pin = getPinFieldValue(block) || '0'
  if (!block.getInputTargetBlock('FREQ')) {
    block.setWarningText('Missing frequency value for Buzzer Tone.')
  } else {
    block.setWarningText(null)
  }
  const freq = arduinoGenerator.valueToCode(block, 'FREQ', 0) || '1000'
  return `tone(${pin}, ${freq});\n`
}

arduinoGenerator.forBlock['output_buzzer_notone'] = function(block: Blockly.Block) {
  const pin = getPinFieldValue(block) || '0'
  return `noTone(${pin});\n`
}

arduinoGenerator.forBlock['output_servo_write'] = function(block: Blockly.Block) {
  const pin = getPinFieldValue(block);
  if (!isValidPin(pin)) return '';
  const angle = arduinoGenerator.valueToCode(block, 'ANGLE', 0) || '90';
  const servoObj = `servo_${pin}`;
  arduinoGenerator.definitions_['include_servo'] = '#include <Servo.h>';
  arduinoGenerator.definitions_[`var_${servoObj}`] = `Servo ${servoObj};`;
  arduinoGenerator.definitions_[`setup_${servoObj}`] = `  ${servoObj}.attach(${pin});`;
  return `${servoObj}.write(${angle});\n`;
}

arduinoGenerator.forBlock['output_digital_write'] = function(block: Blockly.Block) {
  const pin = getPinFieldValue(block);
  if (!isValidPin(pin)) return '';
  const state = block.getFieldValue('STATE') || 'LOW';
  return `digitalWrite(${pin}, ${state});\n`
}

arduinoGenerator.forBlock['output_analog_write'] = function(block: Blockly.Block) {
  const pin = getPinFieldValue(block);
  if (!isValidPin(pin)) return '';
  let val = arduinoGenerator.valueToCode(block, 'NUM', 0) || '0'
  return `analogWrite(${pin}, ${val});\n`
}

arduinoGenerator.forBlock['input_digital_read'] = function(block: Blockly.Block) {
  const pin = getPinFieldValue(block);
  if (!isValidPin(pin)) return ['0', 0];
  return [`digitalRead(${pin})`, 0];
}

arduinoGenerator.forBlock['input_analog_read'] = function(block: Blockly.Block) {
  const pin = getPinFieldValue(block);
  if (!isValidPin(pin)) return ['0', 0];
  return [`analogRead(${pin})`, 0];
}

arduinoGenerator.forBlock['input_button_read'] = function(block: Blockly.Block) {
  const pin = getPinFieldValue(block);
  if (!isValidPin(pin)) return ['0', 0];
  return [`digitalRead(${pin})`, 0];
}

arduinoGenerator.forBlock['input_button_pressed'] = function(block: Blockly.Block) {
  const pin = getPinFieldValue(block);
  if (!isValidPin(pin)) return ['false', 0];
  return [`(digitalRead(${pin}) == LOW)`, 0];
}

arduinoGenerator.forBlock['input_ldr_read'] = function(block: Blockly.Block) {
  const pin = getPinFieldValue(block);
  if (!isValidPin(pin)) return ['0', 0];
  return [`analogRead(${pin})`, 0];
}

arduinoGenerator.forBlock['input_ldr_is_dark'] = function(block: Blockly.Block) {
  const pin = getPinFieldValue(block);
  if (!isValidPin(pin)) return ['false', 0];
  return [`(analogRead(${pin}) < 2000)`, 0];
}

arduinoGenerator.forBlock['input_temp_read'] = function(block: Blockly.Block) {
  const pin = getPinFieldValue(block);
  if (!isValidPin(pin)) return ['0.0', 0];
  return [`(((analogRead(${pin}) * (3.3 / 4095.0)) - 0.5) * 100)`, 0];
}

arduinoGenerator.forBlock['input_temp_is_hot'] = function(block: Blockly.Block) {
  const pin = getPinFieldValue(block);
  if (!isValidPin(pin)) return ['false', 0];
  return [`((((analogRead(${pin}) * (3.3 / 4095.0)) - 0.5) * 100) > 30.0)`, 0];
}

arduinoGenerator.forBlock['input_pot_read'] = function(block: Blockly.Block) {
  const pin = getPinFieldValue(block);
  if (!isValidPin(pin)) return ['0', 0];
  return [`analogRead(${pin})`, 0];
}

arduinoGenerator.forBlock['input_potentiometer_read'] = function(block: Blockly.Block) {
  const pin = getPinFieldValue(block);
  if (!isValidPin(pin)) return ['0', 0];
  return [`analogRead(${pin})`, 0];
}

arduinoGenerator.forBlock['wifi_connect'] = function(block: Blockly.Block) {
  if (!block.getInputTargetBlock('SSID') || !block.getInputTargetBlock('PASSWORD')) {
    block.setWarningText('Missing SSID or Password string for WiFi Connect.')
  } else {
    block.setWarningText(null)
  }
  const ssid = arduinoGenerator.valueToCode(block, 'SSID', 0) || '""'
  const password = arduinoGenerator.valueToCode(block, 'PASSWORD', 0) || '""'
  
  arduinoGenerator.definitions_['include_wifi'] = '#include <WiFi.h>'
  
  return `WiFi.begin(${ssid}, ${password});\nwhile (WiFi.status() != WL_CONNECTED) {\n  delay(500);\n}\n`
}

// ── New Phase 4 Input Blocks ──────────────────────────────────────────────

arduinoGenerator.forBlock['input_ir_read'] = function(block: Blockly.Block) {
  const pin = getPinFieldValue(block);
  if (!isValidPin(pin)) return ['0', 0];
  return [`digitalRead(${pin})`, 0];
}

arduinoGenerator.forBlock['input_touch_read'] = function(block: Blockly.Block) {
  const pin = getPinFieldValue(block);
  if (!isValidPin(pin)) return ['false', 0];
  return [`(digitalRead(${pin}) == HIGH)`, 0];
}

arduinoGenerator.forBlock['input_touch_raw'] = function(block: Blockly.Block) {
  const pin = getPinFieldValue(block);
  if (!isValidPin(pin)) return ['0', 0];
  return [`touchRead(${pin})`, 0];
}

arduinoGenerator.forBlock['input_dht_read'] = function(block: Blockly.Block) {
  const pin = getPinFieldValue(block);
  if (!isValidPin(pin)) return ['0.0', 0];
  const type = block.getFieldValue('TYPE');
  const varName = `dht_${pin}`;
  
  arduinoGenerator.definitions_['include_dht'] = '#include <DHT.h>';
  arduinoGenerator.definitions_[`var_${varName}`] = `DHT ${varName}(${pin}, DHT11);`;
  arduinoGenerator.definitions_[`setup_${varName}`] = `  ${varName}.begin();`;
  
  return type === 'TEMP' ? [`${varName}.readTemperature()`, 0] : [`${varName}.readHumidity()`, 0];
}

arduinoGenerator.forBlock['input_ultrasonic_read'] = function(block: Blockly.Block) {
  const devId = getPinFieldValue(block);
  const trig = getDevicePin(devId, 'trig');
  const echo = getDevicePin(devId, 'echo');
  if (!isValidPin(trig) || !isValidPin(echo)) return ['0.0', 0];
  const funcName = `getDistance_${trig}_${echo}`;
  
  arduinoGenerator.functionNames_[funcName] = `
float ${funcName}() {
  digitalWrite(${trig}, LOW);
  delayMicroseconds(2);
  digitalWrite(${trig}, HIGH);
  delayMicroseconds(10);
  digitalWrite(${trig}, LOW);
  long duration = pulseIn(${echo}, HIGH);
  return duration * 0.034 / 2;
}
`;
  return [`${funcName}()`, 0];
}

// ── New Phase 4 Output Blocks ─────────────────────────────────────────────

arduinoGenerator.forBlock['output_dcmotor_set'] = function(block: Blockly.Block) {
  const devId = getPinFieldValue(block);
  // Default to LOW if not found (e.g., if upgrading from old block XML)
  const state = block.getFieldValue('STATE') || 'LOW';
  
  const in1 = getDevicePin(devId, 'in1');
  const in2 = getDevicePin(devId, 'in2');
  if (!isValidPin(in1) || !isValidPin(in2)) return '';

  let code = '';
  // Pin 1 is always LOW (negative)
  code += `digitalWrite(${in1}, LOW);\n`;
  if (state === 'HIGH') {
    code += `digitalWrite(${in2}, HIGH);\n`;
  } else {
    code += `digitalWrite(${in2}, LOW);\n`;
  }
  return code;
}

arduinoGenerator.forBlock['output_motor_driver_set'] = function(block: Blockly.Block) {
  const devId = getPinFieldValue(block);
  const action = block.getFieldValue('ACTION');
  const speed = arduinoGenerator.valueToCode(block, 'SPEED', 0) || '255';
  
  const enA = getDevicePin(devId, 'enA');
  const in1 = getDevicePin(devId, 'in1');
  const in2 = getDevicePin(devId, 'in2');
  const enB = getDevicePin(devId, 'enB');
  const in3 = getDevicePin(devId, 'in3');
  const in4 = getDevicePin(devId, 'in4');
  
  if (!isValidPin(enA) || !isValidPin(in1) || !isValidPin(in2) || !isValidPin(enB) || !isValidPin(in3) || !isValidPin(in4)) return '';

  let code = `analogWrite(${enA}, ${speed});\nanalogWrite(${enB}, ${speed});\n`;
  if (action === 'FWD') {
    code += `digitalWrite(${in1}, HIGH); digitalWrite(${in2}, LOW);\ndigitalWrite(${in3}, HIGH); digitalWrite(${in4}, LOW);\n`;
  } else if (action === 'REV') {
    code += `digitalWrite(${in1}, LOW); digitalWrite(${in2}, HIGH);\ndigitalWrite(${in3}, LOW); digitalWrite(${in4}, HIGH);\n`;
  } else if (action === 'LEFT') {
    code += `digitalWrite(${in1}, LOW); digitalWrite(${in2}, HIGH);\ndigitalWrite(${in3}, HIGH); digitalWrite(${in4}, LOW);\n`;
  } else if (action === 'RIGHT') {
    code += `digitalWrite(${in1}, HIGH); digitalWrite(${in2}, LOW);\ndigitalWrite(${in3}, LOW); digitalWrite(${in4}, HIGH);\n`;
  } else {
    code += `digitalWrite(${in1}, LOW); digitalWrite(${in2}, LOW);\ndigitalWrite(${in3}, LOW); digitalWrite(${in4}, LOW);\n`;
  }
  return code;
}

// ── Communication & OLED Blocks ───────────────────────────────────────────

arduinoGenerator.forBlock['oled_init'] = function(block: Blockly.Block) {
  const devId = getPinFieldValue(block);
  const sda = getDevicePin(devId, 'sda');
  const scl = getDevicePin(devId, 'scl');
  if (!isValidPin(sda) || !isValidPin(scl)) return '';
  
  arduinoGenerator.definitions_['include_wire'] = '#include <Wire.h>';
  arduinoGenerator.definitions_['include_oled'] = '#include <Adafruit_SSD1306.h>';
  arduinoGenerator.definitions_['var_display'] = `Adafruit_SSD1306 display(128, 64, &Wire, -1);`;
  
  let setupCode = `  Wire.begin(${sda}, ${scl});\n  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);\n  display.setTextColor(WHITE);\n  display.setTextSize(1);\n  display.clearDisplay();`;
  arduinoGenerator.definitions_['setup_oled'] = setupCode;
  return '';
};

arduinoGenerator.forBlock['oled_print'] = function(block: Blockly.Block) {
  const text = arduinoGenerator.valueToCode(block, 'TEXT', 0) || '""';
  return `display.println(${text});\ndisplay.display();\n`;
};

arduinoGenerator.forBlock['oled_draw_text'] = function(block: Blockly.Block) {
  const text = arduinoGenerator.valueToCode(block, 'TEXT', 0) || '""';
  const x = arduinoGenerator.valueToCode(block, 'X', 0) || '0';
  const y = arduinoGenerator.valueToCode(block, 'Y', 0) || '0';
  return `display.setCursor(${x}, ${y});\ndisplay.println(${text});\ndisplay.display();\n`;
};

arduinoGenerator.forBlock['oled_set_cursor'] = function(block: Blockly.Block) {
  const x = arduinoGenerator.valueToCode(block, 'X', 0) || '0';
  const y = arduinoGenerator.valueToCode(block, 'Y', 0) || '0';
  return `display.setCursor(${x}, ${y});\n`;
};

arduinoGenerator.forBlock['oled_clear'] = function(block: Blockly.Block) {
  return `display.clearDisplay();\n`
}

arduinoGenerator.forBlock['bluetooth_begin'] = function(block: Blockly.Block) {
  const devId = getPinFieldValue(block);
  const tx = getDevicePin(devId, 'tx');
  const rx = getDevicePin(devId, 'rx');
  if (!isValidPin(tx) || !isValidPin(rx)) return '';
  
  arduinoGenerator.definitions_['include_hardwareserial'] = '#include <HardwareSerial.h>';
  arduinoGenerator.definitions_[`var_bt_${devId}`] = `HardwareSerial bt_${devId}(1);`; // UART1
  arduinoGenerator.definitions_[`setup_bt_${devId}`] = `  bt_${devId}.begin(9600, SERIAL_8N1, ${rx}, ${tx});`;
  return '';
};

arduinoGenerator.forBlock['bluetooth_send'] = function(block: Blockly.Block) {
  const devId = getPinFieldValue(block);
  if (!isValidPin(getDevicePin(devId, 'tx'))) return '';
  const text = arduinoGenerator.valueToCode(block, 'TEXT', 0) || '""';
  return `bt_${devId}.println(${text});\n`;
};

arduinoGenerator.forBlock['bluetooth_read'] = function(block: Blockly.Block) {
  const devId = getPinFieldValue(block);
  if (!isValidPin(getDevicePin(devId, 'rx'))) return ['""', 0];
  return [`bt_${devId}.readString()`, 0];
};

arduinoGenerator.forBlock['bluetooth_available'] = function(block: Blockly.Block) {
  const devId = getPinFieldValue(block);
  if (!isValidPin(getDevicePin(devId, 'rx'))) return ['false', 0];
  return [`(bt_${devId}.available() > 0)`, 0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Standard Block Generators (Subset required for C++)
// ─────────────────────────────────────────────────────────────────────────────

arduinoGenerator.forBlock['controls_if'] = function(block: Blockly.Block) {
  let n = 0
  let code = ''
  let branchCode, conditionCode
  if (arduinoGenerator.STATEMENT_PREFIX) {
    code += arduinoGenerator.injectId(arduinoGenerator.STATEMENT_PREFIX, block)
  }
  do {
    conditionCode = arduinoGenerator.valueToCode(block, 'IF' + n, 0) || 'false'
    branchCode = arduinoGenerator.statementToCode(block, 'DO' + n)
    if (arduinoGenerator.STATEMENT_SUFFIX) {
      branchCode = arduinoGenerator.prefixLines(arduinoGenerator.injectId(arduinoGenerator.STATEMENT_SUFFIX, block), arduinoGenerator.INDENT) + branchCode
    }
    code += (n > 0 ? ' else ' : '') + `if (${conditionCode}) {\n${branchCode}}`
    n++
  } while (block.getInput('IF' + n))

  if (block.getInput('ELSE')) {
    branchCode = arduinoGenerator.statementToCode(block, 'ELSE')
    if (arduinoGenerator.STATEMENT_SUFFIX) {
      branchCode = arduinoGenerator.prefixLines(arduinoGenerator.injectId(arduinoGenerator.STATEMENT_SUFFIX, block), arduinoGenerator.INDENT) + branchCode
    }
    code += ` else {\n${branchCode}}`
  }
  return code + '\n'
}

arduinoGenerator.forBlock['logic_compare'] = function(block: Blockly.Block) {
  const OPERATORS: Record<string, string> = {
    'EQ': '==',
    'NEQ': '!=',
    'LT': '<',
    'LTE': '<=',
    'GT': '>',
    'GTE': '>='
  }
  const operator = OPERATORS[block.getFieldValue('OP')] || '=='
  const argument0 = arduinoGenerator.valueToCode(block, 'A', 0) || '0'
  const argument1 = arduinoGenerator.valueToCode(block, 'B', 0) || '0'
  return [`${argument0} ${operator} ${argument1}`, 0]
}

arduinoGenerator.forBlock['logic_operation'] = function(block: Blockly.Block) {
  const operator = (block.getFieldValue('OP') === 'AND') ? '&&' : '||'
  const argument0 = arduinoGenerator.valueToCode(block, 'A', 0) || 'false'
  const argument1 = arduinoGenerator.valueToCode(block, 'B', 0) || 'false'
  return [`${argument0} ${operator} ${argument1}`, 0]
}

arduinoGenerator.forBlock['logic_boolean'] = function(block: Blockly.Block) {
  const code = (block.getFieldValue('BOOL') === 'TRUE') ? 'true' : 'false'
  return [code, 0]
}

arduinoGenerator.forBlock['logic_negate'] = function(block: Blockly.Block) {
  const argument0 = arduinoGenerator.valueToCode(block, 'BOOL', 0) || 'false'
  return [`!${argument0}`, 0]
}

arduinoGenerator.forBlock['math_number'] = function(block: Blockly.Block) {
  const code = Number(block.getFieldValue('NUM'))
  return [code.toString(), 0]
}

arduinoGenerator.forBlock['text'] = function(block: Blockly.Block) {
  const code = JSON.stringify(block.getFieldValue('TEXT') || "")
  return [code, 0]
}

arduinoGenerator.forBlock['variables_get'] = function(block: Blockly.Block) {
  const code = arduinoGenerator.nameDB_.getName(block.getFieldValue('VAR'), Blockly.Names.NameType.VARIABLE)
  return [code, 0]
}

arduinoGenerator.forBlock['variables_set'] = function(block: Blockly.Block) {
  const argument0 = arduinoGenerator.valueToCode(block, 'VALUE', 0) || '0'
  const varName = arduinoGenerator.nameDB_.getName(block.getFieldValue('VAR'), Blockly.Names.NameType.VARIABLE)
  return `${varName} = ${argument0};\n`
}

arduinoGenerator.forBlock['controls_repeat_ext'] = function(block: Blockly.Block) {
  const repeats = arduinoGenerator.valueToCode(block, 'TIMES', 0) || '0'
  
  // Robust explicit statement traversal to bypass any potential Blockly.CodeGenerator.prototype.statementToCode bugs
  let branch = ''
  let targetBlock = block.getInputTargetBlock('DO')
  while (targetBlock) {
    const code = arduinoGenerator.blockToCode(targetBlock, true) // opt_thisOnly = true prevents scrub_ from appending next
    if (code) {
      branch += code
    }
    targetBlock = targetBlock.getNextBlock()
  }
  if (branch) {
    branch = arduinoGenerator.prefixLines(branch, arduinoGenerator.INDENT)
  }

  const loopVar = arduinoGenerator.nameDB_.getDistinctName('count', Blockly.Names.NameType.VARIABLE)
  return `for (int ${loopVar} = 0; ${loopVar} < ${repeats}; ${loopVar}++) {\n${branch}}\n`
}

arduinoGenerator.forBlock['controls_whileUntil'] = function(block: Blockly.Block) {
  const until = block.getFieldValue('MODE') === 'UNTIL'
  const argument0 = arduinoGenerator.valueToCode(block, 'BOOL', 0) || 'false'
  const branch = arduinoGenerator.statementToCode(block, 'DO')
  if (until) {
    return `while (!(${argument0})) {\n${branch}}\n`
  }
  return `while (${argument0}) {\n${branch}}\n`
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Generator Orchestrator
// ─────────────────────────────────────────────────────────────────────────────

export interface CodeGenResult {
  code: string
  warnings: string[]
}

export function generateFullArduinoCode(
  workspace: Blockly.Workspace,
  devices: PlacedDevice[],
  boardId: string
): CodeGenResult {
  if (typeof window !== 'undefined') {
    ;(window as any).generateFullArduinoCode = generateFullArduinoCode;
  }
  const warnings: string[] = []

  // Attach devices context for our custom block generators
  ;(arduinoGenerator as any).currentDevices_ = devices

  // Run the core generator to populate definitions_ and collect setup/loop code
  arduinoGenerator.init(workspace)
  
  // We explicitly find system_setup and system_loop to ensure they are at the root
  const topBlocks = workspace.getTopBlocks(false)
  
  let setupCode = ''
  let loopCode = ''

  for (const block of topBlocks) {
    if (block.type === 'system_setup') {
      setupCode = arduinoGenerator.blockToCode(block) as string
    } else if (block.type === 'system_loop') {
      loopCode = arduinoGenerator.blockToCode(block) as string
    }
  }

  // 1. Includes
  const includes = new Set<string>()
  if (boardId === 'esp32' || boardId === 'arduino-uno') {
    includes.add('#include <Arduino.h>')
  }
  if (Object.keys(arduinoGenerator.definitions_).some(k => k.startsWith('include_'))) {
    for (const key in arduinoGenerator.definitions_) {
      if (key.startsWith('include_')) includes.add(arduinoGenerator.definitions_[key])
    }
  }

  // 2. Variables & Objects
  const globalVars: string[] = []
  const injectedSetups: string[] = []
  for (const key in arduinoGenerator.definitions_) {
    if (key.startsWith('var_')) globalVars.push(arduinoGenerator.definitions_[key])
    if (key.startsWith('setup_')) injectedSetups.push(arduinoGenerator.definitions_[key])
  }

  // 3. Hardware pinMode injection
  const pinModes: string[] = []
  for (const device of devices) {
    if (!device.mappedPin || (typeof device.mappedPin === 'object' && Object.keys(device.mappedPin).length === 0)) {
      warnings.push(`Hardware component ${device.id} (${device.type}) is unassigned.`)
      continue
    }

    const reqs = COMPONENT_REQUIREMENTS[device.type]
    if (reqs) {
      if (Array.isArray(reqs.requiredInterfaces)) {
        const pin = normalizePin(device.mappedPin as string)
        if (reqs.requiredInterfaces.includes('DIGITAL_OUT') || reqs.requiredInterfaces.includes('PWM')) {
          pinModes.push(`  pinMode(${pin}, OUTPUT); // ${device.type}`)
          pinModes.push(`  digitalWrite(${pin}, LOW); // prevent boot spin`)
            
          if (device.type === 'led') {
            const pairedGnd: Record<string, string> = { '18': '19', '17': '5', '22': '23', '16': '21' };
            if (pairedGnd[pin]) {
              pinModes.push(`  pinMode(${pairedGnd[pin]}, OUTPUT); // led paired gnd`)
              pinModes.push(`  digitalWrite(${pairedGnd[pin]}, LOW);`)
            }
          }
        } else if (reqs.requiredInterfaces.includes('DIGITAL_IN') || reqs.requiredInterfaces.includes('ANALOG_IN')) {
          if (device.type === 'button') {
            pinModes.push(`  pinMode(${pin}, INPUT_PULLUP); // ${device.type}`)
          } else {
            pinModes.push(`  pinMode(${pin}, INPUT); // ${device.type}`)
          }
        }
      
      } else {
        // Multi-pin hardware setups
        const pins = device.mappedPin as Record<string, string>
        for (const [key, interfaces] of Object.entries(reqs.requiredInterfaces)) {
          const pin = normalizePin(pins[key])
          if (!pin) continue
          if (interfaces.includes('DIGITAL_OUT') || interfaces.includes('PWM')) {
            pinModes.push(`  pinMode(${pin}, OUTPUT); // ${device.type} ${key}`)
            pinModes.push(`  digitalWrite(${pin}, LOW); // prevent boot spin`)
          } else if (interfaces.includes('DIGITAL_IN') || interfaces.includes('ANALOG_IN')) {
            pinModes.push(`  pinMode(${pin}, INPUT); // ${device.type} ${key}`)
          }
        }
      }
      
      // Auto-inject setups for modules
      if (device.type === 'oled') {
        const pins = device.mappedPin as Record<string, string>
        if (isValidPin(pins.sda) && isValidPin(pins.scl)) {
          includes.add('#include <Wire.h>')
          includes.add('#include <Adafruit_GFX.h>')
          includes.add('#include <Adafruit_SSD1306.h>')
          const varDisplay = `Adafruit_SSD1306 display(128, 64, &Wire, -1);`
          if (!globalVars.includes(varDisplay)) {
            globalVars.push(varDisplay)
            injectedSetups.push(`  Wire.begin(${normalizePin(pins.sda)}, ${normalizePin(pins.scl)});`)
            injectedSetups.push(`  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);`)
            injectedSetups.push(`  display.setTextColor(WHITE);`)
            injectedSetups.push(`  display.setTextSize(1);`)
            injectedSetups.push(`  display.clearDisplay();`)
          }
        }
            } else if (device.type === 'color_sensor') {
        const pins = device.mappedPin as Record<string, string>
        if (isValidPin(pins.sda) && isValidPin(pins.scl)) {
          includes.add('#include <Wire.h>')
          includes.add('#include <Adafruit_TCS34725.h>')
          const varTcs = `Adafruit_TCS34725 tcs = Adafruit_TCS34725(TCS34725_INTEGRATIONTIME_50MS, TCS34725_GAIN_4X);`
          if (!globalVars.includes(varTcs)) {
            globalVars.push(varTcs)
            injectedSetups.push(`  Wire.begin(${normalizePin(pins.sda)}, ${normalizePin(pins.scl)});`)
            injectedSetups.push(`  tcs.begin();`)
          }
        }
      } else if (device.type === 'bluetooth') {
        const pins = device.mappedPin as Record<string, string>
        if (isValidPin(pins.rx) && isValidPin(pins.tx)) {
          includes.add('#include <HardwareSerial.h>')
          const varBt = `HardwareSerial bt_${device.id}(1);`
          if (!globalVars.includes(varBt)) {
            globalVars.push(varBt)
            injectedSetups.push(`  bt_${device.id}.begin(9600, SERIAL_8N1, ${normalizePin(pins.rx)}, ${normalizePin(pins.tx)});`)
          }
        }
      }
    }
  }

  // Inject analogWrite polyfill for ESP32 older cores if PWM is used
  if (boardId === 'esp32') {
    const hasPwm = devices.some(d => {
      const reqs = COMPONENT_REQUIREMENTS[d.type]
      if (!reqs) return false
      if (Array.isArray(reqs.requiredInterfaces)) {
        return reqs.requiredInterfaces.includes('PWM')
      }
      return Object.values(reqs.requiredInterfaces).some(intfs => intfs.includes('PWM'))
    }) || topBlocks.some(b => {
      const descendants = b.getDescendants(false)
      return descendants.some(db => db.type === 'output_analog_write' || db.type === 'output_dcmotor_set' || db.type === 'output_motor_driver_set')
    })

    if (hasPwm) {
      // Create a global function that works as a shim if analogWrite doesn't exist.
      // We'll output it directly into the code.
      globalVars.push(`
#if defined(ESP32) && (!defined(ESP_ARDUINO_VERSION_MAJOR) || ESP_ARDUINO_VERSION_MAJOR < 3)
#warning "ESP32 Core < 3.0 detected. Using ledc wrapper for analogWrite."
int _analogWriteChannelCount = 0;
void analogWrite(uint8_t pin, uint32_t value) {
  // Very basic polyfill, in production use Core 3.0.0+
  ledcAttachPin(pin, _analogWriteChannelCount % 16);
  ledcWrite(_analogWriteChannelCount % 16, value);
  _analogWriteChannelCount++;
}
#endif
`);
    }
  }


  // Inject helper functions dynamically
  for (const key in arduinoGenerator.functionNames_) {
    globalVars.push(arduinoGenerator.functionNames_[key])
  }

  // Handle default Setup if none exists
  if (!setupCode) {
    setupCode = `void setup() {\n  Serial.begin(115200);\n${pinModes.join('\n')}\n${injectedSetups.join('\n')}\n}\n\n`
  } else {
    // Inject pinModes and injected setups into the generated setup() block
    let injections = '  Serial.begin(115200);\n'
    if (pinModes.length > 0) injections += `${pinModes.join('\n')}\n`
    if (injectedSetups.length > 0) injections += `${injectedSetups.join('\n')}\n`
    
    if (injections) {
      setupCode = setupCode.replace('void setup() {', `void setup() {\n${injections}`)
    }
  }

  // Handle default Loop if none exists
  if (!loopCode) {
    loopCode = `void loop() {\n  // Put your main code here, to run repeatedly:\n}\n`
  }

  // 5. Final Assembly
  let finalCode = ''
  
  if (includes.size > 0) {
    finalCode += Array.from(includes).join('\n') + '\n\n'
  }
  
  if (globalVars.length > 0) {
    finalCode += globalVars.join('\n') + '\n\n'
  }

  finalCode += setupCode
  finalCode += loopCode

  return { code: finalCode.trim(), warnings }
}


// ── Phase 5 Expansion Generators ──────────────────────────────────────────

// 1. Sensors
arduinoGenerator.forBlock['input_ir_analog_read'] = function(block: Blockly.Block) {
  const pin = getPinFieldValue(block);
  if (!isValidPin(pin)) return ['0', 0];
  return [`analogRead(${pin})`, 0];
};

arduinoGenerator.forBlock['input_color_read'] = function(block: Blockly.Block) {
  const color = block.getFieldValue('COLOR');
  // Initialization happens in generateFullArduinoCode
  return [`tcs.color${color}()`, 0]; // simplified API assumption
};

// 2. Motors
arduinoGenerator.forBlock['output_dcmotor_speed'] = function(block: Blockly.Block) {
  const speed = arduinoGenerator.valueToCode(block, 'SPEED', 0) || '0';
  const devices = (arduinoGenerator as any).currentDevices_ || [];
  const motor = devices.find((d: any) => d.type === 'dcmotor');
  if (!motor || !motor.mappedPin || typeof motor.mappedPin !== 'object') return '';
  const pwmPin = motor.mappedPin.pwm;
  if (!isValidPin(pwmPin)) return '';
  
  return `analogWrite(${pwmPin}, ${speed});\n`;
};

// 3. Pin I/O
arduinoGenerator.forBlock['pin_mode'] = function(block: Blockly.Block) {
  const pin = getPinFieldValue(block);
  const mode = block.getFieldValue('MODE');
  if (!isValidPin(pin)) return '';
  return `pinMode(${pin}, ${mode});\n`;
};

// 4. Joystick
arduinoGenerator.forBlock['input_joystick_read'] = function(block: Blockly.Block) {
  const axis = block.getFieldValue('AXIS');
  const devices = (arduinoGenerator as any).currentDevices_ || [];
  const joy = devices.find((d: any) => d.type === 'joystick');
  if (!joy || !joy.mappedPin || typeof joy.mappedPin !== 'object') return ['0', 0];
  const pin = axis === 'VRX' ? joy.mappedPin.vrx : joy.mappedPin.vry;
  if (!isValidPin(pin)) return ['0', 0];
  return [`analogRead(${pin})`, 0];
};

// 5. Communication (WiFi)
arduinoGenerator.forBlock['wifi_status'] = function(block: Blockly.Block) {
  return ['(WiFi.status() == WL_CONNECTED)', 0];
};

arduinoGenerator.forBlock['wifi_get_ip'] = function(block: Blockly.Block) {
  return ['WiFi.localIP().toString()', 0];
};

arduinoGenerator.forBlock['wifi_http_request'] = function(block: Blockly.Block) {
  const url = arduinoGenerator.valueToCode(block, 'URL', 0) || '""';
  const method = block.getFieldValue('METHOD');
  arduinoGenerator.definitions_['include_http'] = '#include <HTTPClient.h>';
  
  const funcName = `http_${method.toLowerCase()}_request`;
  arduinoGenerator.functionNames_[funcName] = `
String ${funcName}(String url) {
  HTTPClient http;
  http.begin(url);
  int httpCode = http.${method}();
  String payload = "";
  if (httpCode > 0) {
    payload = http.getString();
  }
  http.end();
  return payload;
}`;

  return [`${funcName}(${url})`, 0];
};

// 6. OLED Display
arduinoGenerator.forBlock['oled_show_var'] = function(block: Blockly.Block) {
  const variable = arduinoGenerator.valueToCode(block, 'VAR', 0) || '0';
  const x = arduinoGenerator.valueToCode(block, 'X', 0) || '0';
  const y = arduinoGenerator.valueToCode(block, 'Y', 0) || '0';
  return `display.setCursor(${x}, ${y});\ndisplay.print(${variable});\ndisplay.display();\n`;
};

arduinoGenerator.forBlock['oled_show_char'] = function(block: Blockly.Block) {
  const char = arduinoGenerator.valueToCode(block, 'CHAR', 0) || '""';
  const x = arduinoGenerator.valueToCode(block, 'X', 0) || '0';
  const y = arduinoGenerator.valueToCode(block, 'Y', 0) || '0';
  return `display.setCursor(${x}, ${y});\ndisplay.print(${char});\ndisplay.display();\n`;
};

arduinoGenerator.forBlock['oled_blink'] = function(block: Blockly.Block) {
  // Adafruit SSD1306 doesn't have a native software blink, usually people invert display or re-render.
  // For simplicity we map to generic blink or invert.
  const state = block.getFieldValue('STATE');
  return `display.invertDisplay(${state});\n`;
};

arduinoGenerator.forBlock['oled_scroll'] = function(block: Blockly.Block) {
  const dir = block.getFieldValue('DIR');
  if (dir === 'RIGHT') return 'display.startscrollright(0x00, 0x0F);\n';
  if (dir === 'LEFT') return 'display.startscrollleft(0x00, 0x0F);\n';
  return 'display.stopscroll();\n';
};

arduinoGenerator.forBlock['oled_color'] = function(block: Blockly.Block) {
  const color = block.getFieldValue('COLOR');
  if (color === 'WHITE') return 'display.setTextColor(WHITE);\n';
  if (color === 'BLACK') return 'display.setTextColor(BLACK);\n';
  return 'display.setTextColor(INVERSE);\n';
};

// 7. Loops
arduinoGenerator.forBlock['controls_forever'] = function(block: Blockly.Block) {
  let branch = arduinoGenerator.statementToCode(block, 'DO');
  branch = arduinoGenerator.addLoopTrap(branch, block.id) || branch;
  return `while (true) {${branch}}`;
};

arduinoGenerator.forBlock['input_joystick1_read'] = function(block: Blockly.Block) {
  const axis = block.getFieldValue('AXIS');
  const devices = (arduinoGenerator as any).currentDevices_ || [];
  const joys = devices.filter((d: any) => d.type === 'joystick');
  if (joys.length < 1 || !joys[0].mappedPin) return ['0', 0];
  const pin = axis === 'VRX' ? joys[0].mappedPin.vrx : joys[0].mappedPin.vry;
  if (!isValidPin(pin)) return ['0', 0];
  return [`analogRead(${normalizePin(pin as string)})`, 0];
};

arduinoGenerator.forBlock['input_joystick2_read'] = function(block: Blockly.Block) {
  const axis = block.getFieldValue('AXIS');
  const devices = (arduinoGenerator as any).currentDevices_ || [];
  const joys = devices.filter((d: any) => d.type === 'joystick');
  if (joys.length < 2 || !joys[1].mappedPin) return ['0', 0];
  const pin = axis === 'VRX' ? joys[1].mappedPin.vrx : joys[1].mappedPin.vry;
  if (!isValidPin(pin)) return ['0', 0];
  return [`analogRead(${normalizePin(pin as string)})`, 0];
};
arduinoGenerator.forBlock['math_constrain'] = function(block: Blockly.Block) {
  const val = arduinoGenerator.valueToCode(block, 'VALUE', 0) || '0';
  const low = arduinoGenerator.valueToCode(block, 'LOW', 0) || '0';
  const high = arduinoGenerator.valueToCode(block, 'HIGH', 0) || '0';
  return [`constrain(${val}, ${low}, ${high})`, 0];
};

arduinoGenerator.forBlock['math_round'] = function(block: Blockly.Block) {
  const op = block.getFieldValue('OP');
  const num = arduinoGenerator.valueToCode(block, 'NUM', 0) || '0';
  if (op === 'ROUNDUP') return [`ceil(${num})`, 0];
  if (op === 'ROUNDDOWN') return [`floor(${num})`, 0];
  return [`round(${num})`, 0];
};
arduinoGenerator.forBlock['logic_double_equals'] = function(block: Blockly.Block) {
  const a = arduinoGenerator.valueToCode(block, 'A', 0) || '0';
  const b = arduinoGenerator.valueToCode(block, 'B', 0) || '0';
  return [`(${a} == ${b})`, 0];
};

arduinoGenerator.forBlock['logic_and_text'] = function(block: Blockly.Block) {
  const a = arduinoGenerator.valueToCode(block, 'A', 0) || 'false';
  const b = arduinoGenerator.valueToCode(block, 'B', 0) || 'false';
  return [`(${a} && ${b})`, 0];
};

arduinoGenerator.forBlock['declare_variable'] = function(block: Blockly.Block) {
  const varName = arduinoGenerator.nameDB_.getName(block.getFieldValue('VAR'), Blockly.Names.NameType.VARIABLE);
  arduinoGenerator.definitions_['var_' + varName] = 'float ' + varName + ';';
  return '';
};

arduinoGenerator.forBlock['my_program_block'] = function(block: Blockly.Block) {
  let branch = arduinoGenerator.statementToCode(block, 'DO');
  arduinoGenerator.definitions_['my_program'] = `void my_program() {\n${branch}}\n`;
  return 'my_program();\n';
};

// ── Missing Critical Generators (crash fixes) ─────────────────────────────

arduinoGenerator.forBlock['math_arithmetic'] = function(block: Blockly.Block) {
  const OPERATORS: Record<string, string> = {
    ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/', POWER: '^'
  }
  const operator = OPERATORS[block.getFieldValue('OP')] || '+'
  const a = arduinoGenerator.valueToCode(block, 'A', 0) || '0'
  const b = arduinoGenerator.valueToCode(block, 'B', 0) || '0'
  if (block.getFieldValue('OP') === 'POWER') {
    return [`pow(${a}, ${b})`, 0]
  }
  return [`(${a} ${operator} ${b})`, 0]
}

arduinoGenerator.forBlock['math_modulo'] = function(block: Blockly.Block) {
  const a = arduinoGenerator.valueToCode(block, 'DIVIDEND', 0) || '0'
  const b = arduinoGenerator.valueToCode(block, 'DIVISOR', 0) || '1'
  return [`(${a} % ${b})`, 0]
}

arduinoGenerator.forBlock['math_random_int'] = function(block: Blockly.Block) {
  const from = arduinoGenerator.valueToCode(block, 'FROM', 0) || '0'
  const to = arduinoGenerator.valueToCode(block, 'TO', 0) || '100'
  return [`random(${from}, ${to} + 1)`, 0]
}

arduinoGenerator.forBlock['math_single'] = function(block: Blockly.Block) {
  const op = block.getFieldValue('OP')
  const num = arduinoGenerator.valueToCode(block, 'NUM', 0) || '0'
  const MAP: Record<string, string> = {
    ROOT: `sqrt(${num})`,
    ABS: `abs(${num})`,
    NEG: `-(${num})`,
    LN: `log(${num})`,
    LOG10: `log10(${num})`,
    EXP: `exp(${num})`,
    POW10: `pow(10, ${num})`
  }
  return [MAP[op] || `abs(${num})`, 0]
}

arduinoGenerator.forBlock['controls_for'] = function(block: Blockly.Block) {
  const variable = arduinoGenerator.nameDB_.getName(block.getFieldValue('VAR'), Blockly.Names.NameType.VARIABLE)
  const from = arduinoGenerator.valueToCode(block, 'FROM', 0) || '0'
  const to = arduinoGenerator.valueToCode(block, 'TO', 0) || '10'
  const by = arduinoGenerator.valueToCode(block, 'BY', 0) || '1'
  const branch = arduinoGenerator.statementToCode(block, 'DO')
  return `for (int ${variable} = ${from}; ${variable} <= ${to}; ${variable} += ${by}) {\n${branch}}\n`
}

arduinoGenerator.forBlock['text_print'] = function(block: Blockly.Block) {
  const text = arduinoGenerator.valueToCode(block, 'TEXT', 0) || '""'
  return `Serial.println(${text});\n`
}

arduinoGenerator.forBlock['text_join'] = function(block: Blockly.Block) {
  const itemCount = (block as any).itemCount_ || 2
  const parts: string[] = []
  for (let i = 0; i < itemCount; i++) {
    parts.push(arduinoGenerator.valueToCode(block, 'ADD' + i, 0) || '""')
  }
  if (parts.length === 0) return ['""', 0]
  return [`(String(${parts.join(') + String(')})`, 0]
}

arduinoGenerator.forBlock['math_change'] = function(block: Blockly.Block) {
  const varName = arduinoGenerator.nameDB_.getName(block.getFieldValue('VAR'), Blockly.Names.NameType.VARIABLE)
  const delta = arduinoGenerator.valueToCode(block, 'DELTA', 0) || '1'
  return `${varName} += ${delta};\n`
}
