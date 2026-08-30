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
  arduinoGenerator.definitions_['include_servo'] = `#if defined(ESP32)
class Servo {
  public:
    int _pin = -1;
    void attach(int pin) {
      _pin = pin;
#if !defined(ESP_ARDUINO_VERSION_MAJOR) || ESP_ARDUINO_VERSION_MAJOR < 3
      int channel = pin % 16;
      ledcSetup(channel, 50, 16);
      ledcAttachPin(_pin, channel);
#else
      ledcAttach(_pin, 50, 16);
#endif
    }
    void write(int angle) {
      if (_pin == -1) return;
      if (angle < 0) angle = 0;
      if (angle > 180) angle = 180;
      uint32_t duty = 3276 + ((angle * (6553 - 3276)) / 180);
#if !defined(ESP_ARDUINO_VERSION_MAJOR) || ESP_ARDUINO_VERSION_MAJOR < 3
      ledcWrite(_pin % 16, duty);
#else
      ledcWrite(_pin, duty);
#endif
    }
};
#else
#include <Servo.h>
#endif`;
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

// The LDR is a voltage divider on an ADC pin, so it must be read with analogRead().
// digitalRead() only flips above ~0.75*Vcc, which the divider rarely reaches — that
// made the block report 0 permanently. 'input_ldr_read_digital' is the legacy block id
// kept for older saved projects; it now generates the same analog read.
const ldrAnalogRead = function(block: Blockly.Block) {
  const pin = getPinFieldValue(block);
  if (!isValidPin(pin)) return ['0', 0];
  return [`analogRead(${pin})`, 0];
}
arduinoGenerator.forBlock['input_ldr_read_analog'] = ldrAnalogRead
arduinoGenerator.forBlock['input_ldr_read_digital'] = ldrAnalogRead

arduinoGenerator.forBlock['input_ldr_is_dark'] = function(block: Blockly.Block) {
  const pin = getPinFieldValue(block);
  if (!isValidPin(pin)) return ['false', 0];
  const threshold = block.getFieldValue('THRESHOLD') ?? 1000;
  return [`(analogRead(${pin}) < ${threshold})`, 0];
}

function ensureDs18b20(pin: string): string {
  const oneWireVar = `oneWire_${pin}`;
  const sensorVar = `ds18b20_${pin}`;

  arduinoGenerator.definitions_['include_onewire'] = '#include <OneWire.h>';
  arduinoGenerator.definitions_['include_dallastemperature'] = '#include <DallasTemperature.h>';
  arduinoGenerator.definitions_[`var_${oneWireVar}`] = `OneWire ${oneWireVar}(${pin});`;
  arduinoGenerator.definitions_[`var_${sensorVar}`] = `DallasTemperature ${sensorVar}(&${oneWireVar});`;
  arduinoGenerator.definitions_[`setup_${sensorVar}`] = `  ${sensorVar}.begin();`;

  const funcName = `readDs18b20_${pin}`;
  arduinoGenerator.functionNames_[funcName] = `
float ${funcName}() {
  ${sensorVar}.requestTemperatures();
  return ${sensorVar}.getTempCByIndex(0);
}
`;
  return `${funcName}()`;
}

arduinoGenerator.forBlock['input_temp_read'] = function(block: Blockly.Block) {
  const pin = getPinFieldValue(block);
  if (!isValidPin(pin)) return ['0.0', 0];
  return [ensureDs18b20(pin), 0];
}

arduinoGenerator.forBlock['input_temp_is_hot'] = function(block: Blockly.Block) {
  const pin = getPinFieldValue(block);
  if (!isValidPin(pin)) return ['false', 0];
  return [`(${ensureDs18b20(pin)} > 30.0)`, 0];
}

// ── AI Vision runtime ────────────────────────────────────────────────────
// Globals updated once per loop() from lines the desktop AI Vision panel
// streams over the SAME serial connection used for programming (see
// src/renderer/src/lib/ai/aiSerialWriter.ts for the AI:CLASS:/AI:MIC: wire
// format). Idempotent — safe to call from every ai_* block generator.
function ensureAIRuntime(): void {
  if (arduinoGenerator.definitions_['var_ai_predicted_class']) return;

  arduinoGenerator.definitions_['var_ai_predicted_class'] = 'String aiPredictedClass = "";';
  arduinoGenerator.definitions_['var_ai_confidence'] = 'int aiConfidence = 0;';
  arduinoGenerator.definitions_['var_ai_mic_level'] = 'int aiMicLevel = 0;';
  arduinoGenerator.definitions_['var_ai_gesture'] = 'String aiGesture = "None";';
  arduinoGenerator.definitions_['var_ai_gesture_confidence'] = 'int aiGestureConfidence = 0;';
  arduinoGenerator.definitions_['var_ai_object'] = 'String aiObject = "None";';
  arduinoGenerator.definitions_['var_ai_object_confidence'] = 'int aiObjectConfidence = 0;';
  arduinoGenerator.definitions_['var_ai_shape'] = 'String aiShape = "None";';
  arduinoGenerator.definitions_['var_ai_shape_confidence'] = 'int aiShapeConfidence = 0;';
  arduinoGenerator.definitions_['var_ai_expression'] = 'String aiExpression = "None";';
  arduinoGenerator.definitions_['var_ai_expression_confidence'] = 'int aiExpressionConfidence = 0;';

  arduinoGenerator.functionNames_['parseAISerial'] = `
void parseAISerial() {
  while (Serial.available()) {
    String line = Serial.readStringUntil('\\n');
    line.trim();
    if (line.startsWith("AI:CLASS:")) {
      String rest = line.substring(9);
      int sep = rest.lastIndexOf(':');
      if (sep > 0) {
        aiPredictedClass = rest.substring(0, sep);
        aiConfidence = rest.substring(sep + 1).toInt();
      }
    } else if (line.startsWith("AI:GESTURE:")) {
      String rest = line.substring(11);
      int sep = rest.lastIndexOf(':');
      if (sep > 0) {
        aiGesture = rest.substring(0, sep);
        aiGestureConfidence = rest.substring(sep + 1).toInt();
      }
    } else if (line.startsWith("AI:OBJECT:")) {
      String rest = line.substring(10);
      int sep = rest.lastIndexOf(':');
      if (sep > 0) {
        aiObject = rest.substring(0, sep);
        aiObjectConfidence = rest.substring(sep + 1).toInt();
      }
    } else if (line.startsWith("AI:SHAPE:")) {
      String rest = line.substring(9);
      int sep = rest.lastIndexOf(':');
      if (sep > 0) {
        aiShape = rest.substring(0, sep);
        aiShapeConfidence = rest.substring(sep + 1).toInt();
      }
    } else if (line.startsWith("AI:EXPRESSION:")) {
      String rest = line.substring(14);
      int sep = rest.lastIndexOf(':');
      if (sep > 0) {
        aiExpression = rest.substring(0, sep);
        aiExpressionConfidence = rest.substring(sep + 1).toInt();
      }
    } else if (line.startsWith("AI:MIC:")) {
      aiMicLevel = line.substring(7).toInt();
    }
  }
}
`;

  arduinoGenerator.definitions_['loop_ai_poll'] = '  parseAISerial();\n';
}

arduinoGenerator.forBlock['ai_predicted_class'] = function(_block: Blockly.Block) {
  ensureAIRuntime();
  return ['aiPredictedClass', 0];
}

arduinoGenerator.forBlock['ai_prediction_confidence'] = function(_block: Blockly.Block) {
  ensureAIRuntime();
  return ['aiConfidence', 0];
}

arduinoGenerator.forBlock['ai_is_class'] = function(block: Blockly.Block) {
  ensureAIRuntime();
  const className = block.getFieldValue('CLASS') || '';
  const escaped = className.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return [`(aiPredictedClass == "${escaped}")`, 0];
}

arduinoGenerator.forBlock['ai_mic_level'] = function(_block: Blockly.Block) {
  ensureAIRuntime();
  return ['aiMicLevel', 0];
}

arduinoGenerator.forBlock['ai_hand_gesture'] = function(_block: Blockly.Block) {
  ensureAIRuntime();
  return ['aiGesture', 0];
}

arduinoGenerator.forBlock['ai_gesture_confidence'] = function(_block: Blockly.Block) {
  ensureAIRuntime();
  return ['aiGestureConfidence', 0];
}

arduinoGenerator.forBlock['ai_is_gesture'] = function(block: Blockly.Block) {
  ensureAIRuntime();
  const gesture = block.getFieldValue('GESTURE') || 'None';
  return [`(aiGesture == "${gesture}")`, 0];
}

arduinoGenerator.forBlock['ai_hand_detected'] = function(_block: Blockly.Block) {
  ensureAIRuntime();
  return ['(aiGesture != "None")', 0];
}

arduinoGenerator.forBlock['ai_detected_object'] = function(_block: Blockly.Block) {
  ensureAIRuntime();
  return ['aiObject', 0];
}

arduinoGenerator.forBlock['ai_object_confidence'] = function(_block: Blockly.Block) {
  ensureAIRuntime();
  return ['aiObjectConfidence', 0];
}

arduinoGenerator.forBlock['ai_is_object'] = function(block: Blockly.Block) {
  ensureAIRuntime();
  const object = block.getFieldValue('OBJECT') || 'None';
  return [`(aiObject == "${object}")`, 0];
}

arduinoGenerator.forBlock['ai_object_detected'] = function(_block: Blockly.Block) {
  ensureAIRuntime();
  return ['(aiObject != "None")', 0];
}

arduinoGenerator.forBlock['ai_detected_shape'] = function(_block: Blockly.Block) {
  ensureAIRuntime();
  return ['aiShape', 0];
}

arduinoGenerator.forBlock['ai_shape_confidence'] = function(_block: Blockly.Block) {
  ensureAIRuntime();
  return ['aiShapeConfidence', 0];
}

arduinoGenerator.forBlock['ai_is_shape'] = function(block: Blockly.Block) {
  ensureAIRuntime();
  const shape = block.getFieldValue('SHAPE') || 'None';
  return [`(aiShape == "${shape}")`, 0];
}

arduinoGenerator.forBlock['ai_shape_detected'] = function(_block: Blockly.Block) {
  ensureAIRuntime();
  return ['(aiShape != "None")', 0];
}

arduinoGenerator.forBlock['ai_detected_expression'] = function(_block: Blockly.Block) {
  ensureAIRuntime();
  return ['aiExpression', 0];
}

arduinoGenerator.forBlock['ai_expression_confidence'] = function(_block: Blockly.Block) {
  ensureAIRuntime();
  return ['aiExpressionConfidence', 0];
}

arduinoGenerator.forBlock['ai_is_expression'] = function(block: Blockly.Block) {
  ensureAIRuntime();
  const expression = block.getFieldValue('EXPRESSION') || 'None';
  return [`(aiExpression == "${expression}")`, 0];
}

arduinoGenerator.forBlock['ai_face_detected'] = function(_block: Blockly.Block) {
  ensureAIRuntime();
  return ['(aiExpression != "None")', 0];
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

  // Wireless re-upload (OTA): any project that connects to WiFi automatically
  // gets ArduinoOTA started too, so future uploads can go over the network
  // instead of needing USB every time. The very first upload still has to be
  // over USB — the board needs to already be running this OTA-enabled code
  // before it can accept a wireless one — so the IP is printed to Serial
  // (viewable over that same first USB connection) for the student to use.
  arduinoGenerator.definitions_['include_ota'] = '#include <ArduinoOTA.h>'
  arduinoGenerator.definitions_['loop_ota'] = '  ArduinoOTA.handle();\n'

  return `WiFi.begin(${ssid}, ${password});\n` +
    `while (WiFi.status() != WL_CONNECTED) {\n  delay(500);\n}\n` +
    `Serial.print("WiFi connected. IP address for wireless upload: ");\n` +
    `Serial.println(WiFi.localIP());\n` +
    `ArduinoOTA.begin();\n`
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
  delay(50);
  return duration * 0.034 / 2;
}
`;
  return [`${funcName}()`, 0];
}

// ── New Phase 4 Output Blocks ─────────────────────────────────────────────

arduinoGenerator.forBlock['output_dcmotor_set'] = function(block: Blockly.Block) {
  const devId = getPinFieldValue(block);
  // Default to STOP if not found
  const state = block.getFieldValue('STATE') || 'STOP';
  const speed = arduinoGenerator.valueToCode(block, 'SPEED', 0) || '255';
  
  const in1 = getDevicePin(devId, 'in1');
  const in2 = getDevicePin(devId, 'in2');
  if (!isValidPin(in1) || !isValidPin(in2)) return '';

  let code = '';
  if (state === 'FWD') {
    code += `analogWrite(${in1}, ${speed});\n`;
    code += `analogWrite(${in2}, 0);\n`;
  } else if (state === 'REV') {
    code += `analogWrite(${in1}, 0);\n`;
    code += `analogWrite(${in2}, ${speed});\n`;
  } else if (state === 'HIGH') {
    // Legacy support for user's previous code
    code += `analogWrite(${in1}, 0);\n`;
    code += `analogWrite(${in2}, ${speed});\n`;
  } else {
    // STOP or LOW
    code += `analogWrite(${in1}, 0);\n`;
    code += `analogWrite(${in2}, 0);\n`;
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
  const style = block.getFieldValue('STYLE') || 'NORMAL';
  if (style === 'BOLD') {
    // Adafruit_GFX has no native bold weight for the built-in font, so this
    // draws the same text twice, one pixel to the right, which reads as bold
    // at small sizes. Scoped to this call only — reads the cursor position
    // Adafruit_GFX is already tracking rather than any block-to-block state.
    return `{\n` +
      `  int16_t _bx = display.getCursorX(), _by = display.getCursorY();\n` +
      `  display.print(${text});\n` +
      `  display.setCursor(_bx + 1, _by);\n` +
      `  display.println(${text});\n` +
      `}\n` +
      `display.display();\n`;
  }
  return `display.println(${text});\ndisplay.display();\n`;
};

arduinoGenerator.forBlock['oled_text_size'] = function(block: Blockly.Block) {
  const size = block.getFieldValue('SIZE') || '1';
  return `display.setTextSize(${size});\n`;
};

// ── OLED icons ────────────────────────────────────────────────────────────
// Small monochrome 8x8 bitmaps for Adafruit_GFX's drawBitmap(). The SSD1306 is
// 1-bit-per-pixel, so these are pixel-art glyphs rather than full-color emoji —
// each byte is one row, MSB (0x80) = leftmost pixel, matching drawBitmap's format.
const OLED_ICON_BITMAPS: Record<string, string[]> = {
  ARROW_UP:    ['0x18', '0x3C', '0x7E', '0x18', '0x18', '0x18', '0x18', '0x00'],
  ARROW_DOWN:  ['0x00', '0x18', '0x18', '0x18', '0x18', '0x7E', '0x3C', '0x18'],
  ARROW_LEFT:  ['0x0E', '0x1E', '0x3E', '0xFE', '0xFE', '0x3E', '0x1E', '0x0E'],
  ARROW_RIGHT: ['0x70', '0x78', '0x7C', '0x7F', '0x7F', '0x7C', '0x78', '0x70'],
  DOT:         ['0x3C', '0x7E', '0xFF', '0xFF', '0xFF', '0xFF', '0x7E', '0x3C'],
  SQUARE:      ['0x00', '0x7E', '0x7E', '0x7E', '0x7E', '0x7E', '0x7E', '0x00'],
  HEART:       ['0x6C', '0xFE', '0xFE', '0xFE', '0x7C', '0x38', '0x10', '0x00'],
  STAR:        ['0x18', '0x18', '0xFF', '0x7E', '0x3C', '0x66', '0xC3', '0x81'],
  CHECK:       ['0x00', '0x01', '0x02', '0x02', '0x44', '0x28', '0x10', '0x00'],
  CROSS:       ['0x81', '0x42', '0x24', '0x18', '0x18', '0x24', '0x42', '0x81']
};

function ensureOledIcons(): void {
  if (arduinoGenerator.definitions_['var_oled_icons']) return;
  const entries = Object.entries(OLED_ICON_BITMAPS)
    .map(([name, bytes]) => `const uint8_t ICON_${name}[] PROGMEM = { ${bytes.join(', ')} };`)
    .join('\n');
  arduinoGenerator.definitions_['var_oled_icons'] = entries;
}

arduinoGenerator.forBlock['oled_icon'] = function(block: Blockly.Block) {
  ensureOledIcons();
  const icon = block.getFieldValue('ICON') || 'DOT';
  const x = arduinoGenerator.valueToCode(block, 'X', 0) || '0';
  const y = arduinoGenerator.valueToCode(block, 'Y', 0) || '0';
  return `display.drawBitmap(${x}, ${y}, ICON_${icon}, 8, 8, WHITE);\ndisplay.display();\n`;
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

// ESP32 WROOM's built-in Bluetooth radio (Classic BT), driven via the Arduino
// core's own BluetoothSerial library — no external module or GPIO pins
// involved, unlike the wired-serial approach this used to generate. The
// #if/#error guard is the standard boilerplate from Espressif's own
// BluetoothSerial examples: it fails the build early with a clear message
// on core configurations where Bluetooth support was compiled out, instead
// of a confusing "SerialBT was not declared" error.
function ensureBluetoothIncludes(): void {
  arduinoGenerator.definitions_['include_bluetooth'] =
    '#include "BluetoothSerial.h"\n' +
    '#if !defined(CONFIG_BT_ENABLED) || !defined(CONFIG_BLUEDROID_ENABLED)\n' +
    '#error Bluetooth is not enabled! Select a board/partition scheme with Bluetooth support.\n' +
    '#endif';
  arduinoGenerator.definitions_['var_bluetooth'] = 'BluetoothSerial SerialBT;';
  ensureBluetoothOta();
}

// Wireless re-upload over Bluetooth. Any project that uses Bluetooth also gets this
// firmware-update agent, exactly like the WiFi Connect block enables ArduinoOTA.
//
// The ESP32's ROM bootloader only speaks UART, and a Bluetooth serial port carries
// no DTR/RTS lines to pull EN/BOOT — so a .bin can never be flashed over Bluetooth
// the way esptool does it over USB. The running sketch has to receive the image
// itself and write it to the spare OTA partition. Consequence: the first upload of
// a project still has to go over USB; after that the board accepts Bluetooth
// uploads for as long as its sketch keeps using Bluetooth blocks.
//
// The agent only reacts to a frame starting with ESC (0x1B), so it can never
// swallow ordinary text the student sends to the Bluetooth Read blocks.
function ensureBluetoothOta(): void {
  arduinoGenerator.definitions_['include_bt_update'] = '#include <Update.h>';
  arduinoGenerator.definitions_['var_bt_ota'] = `
// ── StreamLab wireless upload agent ──────────────────────────────────────────
// Frame from the StreamLab app: 0x1B "SLOTA" <byte count> '\\n', then the raw .bin.
void slBtOtaPoll() {
  if (SerialBT.peek() != 0x1B) return;

  String header = SerialBT.readStringUntil('\\n');
  if (!header.startsWith("\\x1BSLOTA")) return;

  size_t total = (size_t) header.substring(6).toInt();
  if (total == 0 || !Update.begin(total)) {
    SerialBT.println("SLOTA_FAIL begin");
    return;
  }
  SerialBT.println("SLOTA_READY");

  uint8_t buf[512];
  size_t received = 0;
  unsigned long lastByte = millis();
  while (received < total) {
    int avail = SerialBT.available();
    if (avail > 0) {
      int want = avail > (int) sizeof(buf) ? (int) sizeof(buf) : avail;
      int n = SerialBT.readBytes(buf, want);
      if (n > 0) {
        Update.write(buf, n);
        received += n;
        lastByte = millis();
      }
    } else if (millis() - lastByte > 20000) {
      Update.abort();
      SerialBT.println("SLOTA_FAIL timeout");
      return;
    }
  }

  if (Update.end(true)) {
    SerialBT.println("SLOTA_OK");
    delay(400);
    ESP.restart();
  } else {
    SerialBT.println("SLOTA_FAIL write");
  }
}
`;
  arduinoGenerator.definitions_['loop_bt_ota'] = '  slBtOtaPoll();\n';
}

arduinoGenerator.forBlock['bluetooth_begin'] = function(block: Blockly.Block) {
  ensureBluetoothIncludes();
  const name = block.getFieldValue('NAME') || 'MY_STEAM_LAB';
  arduinoGenerator.definitions_['setup_bluetooth'] = `  SerialBT.begin("${name}");`;
  return '';
};

arduinoGenerator.forBlock['bluetooth_send'] = function(block: Blockly.Block) {
  ensureBluetoothIncludes();
  const text = arduinoGenerator.valueToCode(block, 'TEXT', 0) || '""';
  return `SerialBT.println(${text});\n`;
};

arduinoGenerator.forBlock['bluetooth_read'] = function(block: Blockly.Block) {
  ensureBluetoothIncludes();
  return ['SerialBT.readString()', 0];
};

arduinoGenerator.forBlock['bluetooth_available'] = function(block: Blockly.Block) {
  ensureBluetoothIncludes();
  return ['(SerialBT.available() > 0)', 0];
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
  const loopInjections: string[] = []
  for (const key in arduinoGenerator.definitions_) {
    if (key.startsWith('var_')) globalVars.push(arduinoGenerator.definitions_[key])
    if (key.startsWith('setup_')) injectedSetups.push(arduinoGenerator.definitions_[key])
    if (key.startsWith('loop_')) loopInjections.push(arduinoGenerator.definitions_[key])
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
          if (device.type === 'button' || device.type === 'temp') {
            // temp (DS18B20) needs a pull-up on the OneWire data line; the external
            // 4.7k resistor is preferred, but the internal pull-up avoids floating-line
            // noise (garbage/random readings) when no resistor is wired.
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
      }
    }
  }

  // Pin the ESP32 ADC to 12-bit whenever an analog sensor is on the board. 12-bit is
  // the core default, but stating it makes the 0-4095 range the blocks/thresholds
  // assume explicit, and immune to anything else changing the resolution.
  if (boardId === 'esp32') {
    const hasAnalogIn = devices.some(d => {
      const reqs = COMPONENT_REQUIREMENTS[d.type]
      if (!reqs) return false
      if (Array.isArray(reqs.requiredInterfaces)) {
        return reqs.requiredInterfaces.includes('ANALOG_IN')
      }
      return Object.values(reqs.requiredInterfaces).some(intfs => intfs.includes('ANALOG_IN'))
    })
    if (hasAnalogIn) injectedSetups.push(`  analogReadResolution(12); // 0-4095 ADC range`)
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

  // Splice loop-level injections (e.g. AI serial polling) so they run first,
  // every iteration, regardless of what user blocks are in the loop.
  if (loopInjections.length > 0) {
    loopCode = loopCode.replace('void loop() {', `void loop() {\n${loopInjections.join('')}`)
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

// 5. Communication (WiFi) — every block here ensures WiFi.h itself is
// included, not just the ones that also need HTTPClient.h, so e.g. WiFi
// Status still compiles even when used without a WiFi Connect block.
arduinoGenerator.forBlock['wifi_status'] = function(block: Blockly.Block) {
  arduinoGenerator.definitions_['include_wifi'] = '#include <WiFi.h>';
  return ['(WiFi.status() == WL_CONNECTED)', 0];
};

arduinoGenerator.forBlock['wifi_get_ip'] = function(block: Blockly.Block) {
  arduinoGenerator.definitions_['include_wifi'] = '#include <WiFi.h>';
  return ['WiFi.localIP().toString()', 0];
};

arduinoGenerator.forBlock['wifi_http_request'] = function(block: Blockly.Block) {
  const url = arduinoGenerator.valueToCode(block, 'URL', 0) || '""';
  const method = block.getFieldValue('METHOD');
  arduinoGenerator.definitions_['include_wifi'] = '#include <WiFi.h>';
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
