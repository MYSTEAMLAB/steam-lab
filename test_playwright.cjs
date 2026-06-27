const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.addInitScript(() => {
    window.api = {
      getBoards: async () => ([{ id: 'esp32', name: 'ESP32 (Default)' }]),
      onCompilerLog: () => {},
      compileCode: async () => {},
      uploadCode: async () => {},
      listSerialPorts: async () => []
    };
  });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  console.log('Page loaded');
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

  // We need to wait for blockly to be ready.
  await page.waitForFunction(() => window.blocklyWorkspace);
  console.log('Blockly is ready');

  // Helper to run a test
  async function runTest(testName, setupCodeFn, devices) {
    console.log(`\n--- Running Test: ${testName} ---`);
    const code = await page.evaluate(async ({ setupCodeStr, devices }) => {
      const workspace = window.blocklyWorkspace;
      workspace.clear();
      
      const setupBlock = workspace.newBlock('system_setup');
      const loopBlock = workspace.newBlock('system_loop');
      setupBlock.initSvg(); setupBlock.render();
      loopBlock.initSvg(); loopBlock.render();
      
      // Execute the test-specific setup
      eval(setupCodeStr);
      
      // We must call generateFullArduinoCode because we injected it
      if (window.generateFullArduinoCode) {
        // Trigger dummy generation to make sure function exists
        window.generateFullArduinoCode(workspace, devices, 'esp32');
        return window.generateFullArduinoCode(workspace, devices, 'esp32').code;
      } else {
        return "generateFullArduinoCode not found on window";
      }
    }, { setupCodeStr: setupCodeFn.toString(), devices });
    
    console.log(code);
    return code;
  }

  // Test A: Potentiometer -> DC Motor Speed
  await runTest('Test A: Potentiometer -> DC Motor Speed', `
    const motorBlock = workspace.newBlock('output_dcmotor_speed');
    const potBlock = workspace.newBlock('input_potentiometer_read');
    motorBlock.initSvg(); potBlock.initSvg();
    motorBlock.render(); potBlock.render();
    
    potBlock.setFieldValue('pot1', 'PIN');
    motorBlock.getInput('SPEED').connection.connect(potBlock.outputConnection);
    motorBlock.previousConnection.connect(loopBlock.getInput('STACK').connection);
  `, [
    { id: 'pot1', type: 'potentiometer', mappedPin: '34' },
    { id: 'motor1', type: 'dcmotor', mappedPin: { pwm: '18', in1: '19', in2: '21' } }
  ]);

  // Test B: Button -> Motor Forward
  await runTest('Test B: Button -> Motor Forward', `
    const ifBlock = workspace.newBlock('controls_if');
    const btnBlock = workspace.newBlock('input_button_pressed');
    const motorBlock = workspace.newBlock('output_dcmotor_set');
    
    ifBlock.initSvg(); btnBlock.initSvg(); motorBlock.initSvg();
    ifBlock.render(); btnBlock.render(); motorBlock.render();
    
    btnBlock.setFieldValue('btn1', 'PIN');
    motorBlock.setFieldValue('motor1', 'PIN');
    motorBlock.setFieldValue('HIGH', 'STATE');
    
    ifBlock.getInput('IF0').connection.connect(btnBlock.outputConnection);
    ifBlock.getInput('DO0').connection.connect(motorBlock.previousConnection);
    ifBlock.previousConnection.connect(loopBlock.getInput('STACK').connection);
  `, [
    { id: 'btn1', type: 'button', mappedPin: '35' },
    { id: 'motor1', type: 'dcmotor', mappedPin: { pwm: '18', in1: '19', in2: '21' } }
  ]);

  // Test C: LDR -> LED
  await runTest('Test C: LDR -> LED', `
    const ifBlock = workspace.newBlock('controls_if');
    const ldrBlock = workspace.newBlock('input_ldr_is_dark');
    const ledOnBlock = workspace.newBlock('output_digital_write');
    const ledOffBlock = workspace.newBlock('output_digital_write');
    
    ifBlock.initSvg(); ldrBlock.initSvg(); ledOnBlock.initSvg(); ledOffBlock.initSvg();
    ifBlock.render(); ldrBlock.render(); ledOnBlock.render(); ledOffBlock.render();
    
    // Convert to IF-ELSE
    ifBlock.updateShape_ && ifBlock.updateShape_({hasElse: true, ifCount: 1}); // or just simple if-else manipulation, 
    // Wait, blockly mutation for IF is complex. Let's just do an IF and another IF with NOT for simplicity, or just set LED state to logic negation.
    // Better: digitalWrite(LED, LDR is Dark)
    
    const writeBlock = workspace.newBlock('output_digital_write');
    writeBlock.initSvg(); writeBlock.render();
    writeBlock.setFieldValue('led1', 'PIN');
    writeBlock.getInput('STATE').connection.connect(ldrBlock.outputConnection);
    
    writeBlock.previousConnection.connect(loopBlock.getInput('STACK').connection);
  `, [
    { id: 'ldr1', type: 'ldr', mappedPin: '32' },
    { id: 'led1', type: 'led', mappedPin: '2' }
  ]);

  // Test D: Touch Sensor -> OLED
  await runTest('Test D: Touch Sensor -> OLED', `
    const ifBlock = workspace.newBlock('controls_if');
    const touchBlock = workspace.newBlock('input_touch_read');
    const printBlock = workspace.newBlock('oled_print');
    const textBlock = workspace.newBlock('text');
    
    ifBlock.initSvg(); touchBlock.initSvg(); printBlock.initSvg(); textBlock.initSvg();
    ifBlock.render(); touchBlock.render(); printBlock.render(); textBlock.render();
    
    touchBlock.setFieldValue('touch1', 'PIN');
    textBlock.setFieldValue('Touched!', 'TEXT');
    printBlock.setFieldValue('oled1', 'PIN');
    
    printBlock.getInput('TEXT').connection.connect(textBlock.outputConnection);
    
    // We want IF (Touch Read < 20)
    const compareBlock = workspace.newBlock('logic_compare');
    const numBlock = workspace.newBlock('math_number');
    compareBlock.initSvg(); numBlock.initSvg();
    compareBlock.render(); numBlock.render();
    
    compareBlock.setFieldValue('LT', 'OP');
    numBlock.setFieldValue('20', 'NUM');
    compareBlock.getInput('A').connection.connect(touchBlock.outputConnection);
    compareBlock.getInput('B').connection.connect(numBlock.outputConnection);
    
    ifBlock.getInput('IF0').connection.connect(compareBlock.outputConnection);
    ifBlock.getInput('DO0').connection.connect(printBlock.previousConnection);
    ifBlock.previousConnection.connect(loopBlock.getInput('STACK').connection);
  `, [
    { id: 'touch1', type: 'touch', mappedPin: '4' },
    { id: 'oled1', type: 'oled', mappedPin: { sda: '21', scl: '22' } }
  ]);

  await browser.close();
})();
