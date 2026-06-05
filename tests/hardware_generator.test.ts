import * as Blockly from 'blockly/core';
import { generateFullArduinoCode } from '../src/renderer/src/components/blockly/generator/arduinoGenerator';
import '../src/renderer/src/components/blockly/blocks/customBlocks';
import { PlacedDevice } from '../src/shared/types/project';

console.log("=== PHASE 5 HARDWARE VALIDATION ===");

function runTest(testName: string, setupBlocks: (workspace: Blockly.Workspace, setupBlock: Blockly.Block, loopBlock: Blockly.Block) => void, devices: PlacedDevice[]) {
  console.log(`\n--- ${testName} ---`);
  const workspace = new Blockly.Workspace();
  const setupBlock = workspace.newBlock('system_setup');
  const loopBlock = workspace.newBlock('system_loop');
  setupBlock.initSvg(); setupBlock.render();
  loopBlock.initSvg(); loopBlock.render();

  setupBlocks(workspace, setupBlock, loopBlock);

  const result = generateFullArduinoCode(workspace, devices, 'esp32');
  console.log(result.code);
}

// A. Button -> Motor
runTest("Test A: Button -> Motor", (workspace, setupBlock, loopBlock) => {
  const ifBlock = workspace.newBlock('controls_if');
  const btnBlock = workspace.newBlock('input_button_pressed');
  const motorBlock = workspace.newBlock('output_dcmotor_set');

  btnBlock.setFieldValue('btn1', 'PIN');
  motorBlock.setFieldValue('motor1', 'PIN');
  motorBlock.setFieldValue('FWD', 'ACTION');

  ifBlock.getInput('IF0')!.connection!.connect(btnBlock.outputConnection!);
  ifBlock.getInput('DO0')!.connection!.connect(motorBlock.previousConnection!);
  ifBlock.previousConnection!.connect(loopBlock.getInput('STACK')!.connection!);
}, [
  { id: 'btn1', type: 'button', name: 'Btn', x: 0, y: 0, mappedPin: '35' },
  { id: 'motor1', type: 'dcmotor', name: 'Motor', x: 0, y: 0, mappedPin: { pwm: '18', in1: '19', in2: '21' } }
]);

// B. Potentiometer -> Motor Speed
runTest("Test B: Potentiometer -> Motor Speed", (workspace, setupBlock, loopBlock) => {
  const motorBlock = workspace.newBlock('output_dcmotor_speed');
  const potBlock = workspace.newBlock('input_potentiometer_read');

  potBlock.setFieldValue('pot1', 'PIN');
  motorBlock.getInput('SPEED')!.connection!.connect(potBlock.outputConnection!);
  motorBlock.previousConnection!.connect(loopBlock.getInput('STACK')!.connection!);
}, [
  { id: 'pot1', type: 'potentiometer', name: 'Pot', x: 0, y: 0, mappedPin: '34' },
  { id: 'motor1', type: 'dcmotor', name: 'Motor', x: 0, y: 0, mappedPin: { pwm: '18', in1: '19', in2: '21' } }
]);

// C. Touch Sensor -> OLED
runTest("Test C: Touch Sensor -> OLED", (workspace, setupBlock, loopBlock) => {
  const printBlock = workspace.newBlock('oled_print');
  const touchBlock = workspace.newBlock('input_touch_read');
  
  touchBlock.setFieldValue('touch1', 'PIN');
  printBlock.setFieldValue('oled1', 'PIN');
  printBlock.getInput('TEXT')!.connection!.connect(touchBlock.outputConnection!);
  printBlock.previousConnection!.connect(loopBlock.getInput('STACK')!.connection!);
}, [
  { id: 'touch1', type: 'touch', name: 'Touch', x: 0, y: 0, mappedPin: '4' },
  { id: 'oled1', type: 'oled', name: 'OLED', x: 0, y: 0, mappedPin: { sda: '21', scl: '22' } }
]);

// D. LDR -> LED
runTest("Test D: LDR -> LED", (workspace, setupBlock, loopBlock) => {
  const ledBlock = workspace.newBlock('output_digital_write');
  const ldrBlock = workspace.newBlock('input_ldr_is_dark');
  
  ledBlock.setFieldValue('led1', 'PIN');
  ldrBlock.setFieldValue('ldr1', 'PIN');
  ledBlock.getInput('STATE')!.connection!.connect(ldrBlock.outputConnection!);
  ledBlock.previousConnection!.connect(loopBlock.getInput('STACK')!.connection!);
}, [
  { id: 'ldr1', type: 'ldr', name: 'LDR', x: 0, y: 0, mappedPin: '32' },
  { id: 'led1', type: 'led', name: 'LED', x: 0, y: 0, mappedPin: '2' }
]);

// E. Servo Control
runTest("Test E: Servo Control", (workspace, setupBlock, loopBlock) => {
  const servoBlock = workspace.newBlock('output_servo_write');
  const numBlock = workspace.newBlock('math_number');
  
  servoBlock.setFieldValue('servo1', 'PIN');
  numBlock.setFieldValue('90', 'NUM');
  servoBlock.getInput('ANGLE')!.connection!.connect(numBlock.outputConnection!);
  servoBlock.previousConnection!.connect(setupBlock.getInput('STACK')!.connection!);
}, [
  { id: 'servo1', type: 'servo', name: 'Servo', x: 0, y: 0, mappedPin: '13' }
]);

// F. Bluetooth
runTest("Test F: Bluetooth", (workspace, setupBlock, loopBlock) => {
  const printBlock = workspace.newBlock('bt_print');
  const numBlock = workspace.newBlock('math_number');
  
  printBlock.setFieldValue('bt1', 'PIN');
  numBlock.setFieldValue('123', 'NUM');
  printBlock.getInput('DATA')!.connection!.connect(numBlock.outputConnection!);
  printBlock.previousConnection!.connect(loopBlock.getInput('STACK')!.connection!);
}, [
  { id: 'bt1', type: 'bluetooth', name: 'BT', x: 0, y: 0, mappedPin: { tx: '16', rx: '17' } }
]);
