import * as Blockly from 'blockly/core';
import { generateFullArduinoCode } from './src/renderer/src/components/blockly/generator/arduinoGenerator.js';
import './src/renderer/src/components/blockly/blocks/customBlocks.js';

// Setup workspace
const workspace = new Blockly.Workspace();
const setupBlock = workspace.newBlock('system_setup');
const loopBlock = workspace.newBlock('system_loop');

// Test A
const pot = workspace.newBlock('input_potentiometer_read');
pot.setFieldValue('pot1', 'PIN');
const motor = workspace.newBlock('output_dcmotor_speed');
motor.getInput('SPEED').connection.connect(pot.outputConnection);
motor.previousConnection.connect(loopBlock.getInput('STACK').connection);

console.log(generateFullArduinoCode(workspace, [{ id: 'pot1', type: 'potentiometer', mappedPin: '34' }], 'esp32'));
