const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.addInitScript(() => {
    window.api = {
      getBoards: async () => ([{ id: 'esp32', name: 'ESP32', fqbn: 'esp32:esp32', capabilities: ['WIFI', 'BLUETOOTH'] }]),
      onCompilerLog: () => {},
    };
  });

  page.on('console', msg => {
    console.log(msg.text());
  });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  
  await page.evaluate(() => {
    // Inject the tests into the browser context where Blockly is fully loaded
    const workspace = window.blocklyWorkspace;
    if (!workspace) {
      console.log('No workspace found!');
      return;
    }
    const generateFullArduinoCode = window.generateFullArduinoCode;
    
    function runTest(testName, setupBlocks, devices) {
      console.log(`\n--- ${testName} ---`);
      
      // Inject devices into Zustand store so dropdown validation and pin fetch logic succeeds!
      window.useAppStore.setState({
        boardLayouts: {
          'esp32': { devices: devices, wires: [] }
        },
        selectedBoard: { id: 'esp32' }
      });
      
      workspace.clear();
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
      motorBlock.setFieldValue('HIGH', 'STATE');
    
      ifBlock.getInput('IF0').connection.connect(btnBlock.outputConnection);
      ifBlock.getInput('DO0').connection.connect(motorBlock.previousConnection);
      ifBlock.previousConnection.connect(loopBlock.getInput('STACK').connection);
    }, [
      { id: 'btn1', type: 'button', name: 'Btn', mappedPin: '35' },
      { id: 'motor1', type: 'dcmotor', name: 'Motor', mappedPin: { pwm: '18', in1: '19', in2: '21' } }
    ]);
    
    // B. Potentiometer -> Motor Speed
    runTest("Test B: Potentiometer -> Motor Speed", (workspace, setupBlock, loopBlock) => {
      const motorBlock = workspace.newBlock('output_dcmotor_speed');
      const potBlock = workspace.newBlock('input_potentiometer_read');
    
      potBlock.setFieldValue('pot1', 'PIN');
      motorBlock.getInput('SPEED').connection.connect(potBlock.outputConnection);
      motorBlock.previousConnection.connect(loopBlock.getInput('STACK').connection);
    }, [
      { id: 'pot1', type: 'potentiometer', name: 'Pot', mappedPin: '34' },
      { id: 'motor1', type: 'dcmotor', name: 'Motor', mappedPin: { pwm: '18', in1: '19', in2: '21' } }
    ]);

    // C. Touch Sensor -> OLED
    runTest("Test C: Touch Sensor -> OLED", (workspace, setupBlock, loopBlock) => {
      const printBlock = workspace.newBlock('oled_print');
      const touchBlock = workspace.newBlock('input_touch_read');
      const textBlock = workspace.newBlock('text');
      
      touchBlock.setFieldValue('touch1', 'PIN');
      textBlock.setFieldValue('Touched!', 'TEXT');
      printBlock.setFieldValue('oled1', 'PIN');
      
      printBlock.getInput('TEXT').connection.connect(textBlock.outputConnection);
      
      const compareBlock = workspace.newBlock('logic_compare');
      const numBlock = workspace.newBlock('math_number');
      compareBlock.setFieldValue('LT', 'OP');
      numBlock.setFieldValue('20', 'NUM');
      compareBlock.getInput('A').connection.connect(touchBlock.outputConnection);
      compareBlock.getInput('B').connection.connect(numBlock.outputConnection);
      
      const ifBlock = workspace.newBlock('controls_if');
      ifBlock.getInput('IF0').connection.connect(compareBlock.outputConnection);
      ifBlock.getInput('DO0').connection.connect(printBlock.previousConnection);
      ifBlock.previousConnection.connect(loopBlock.getInput('STACK').connection);
    }, [
      { id: 'touch1', type: 'touch', name: 'Touch', mappedPin: '4' },
      { id: 'oled1', type: 'oled', name: 'OLED', mappedPin: { sda: '21', scl: '22' } }
    ]);

    // D. LDR -> LED
    runTest("Test D: LDR -> LED", (workspace, setupBlock, loopBlock) => {
      const ifBlock = workspace.newBlock('controls_if');
      const ledBlock = workspace.newBlock('output_led_on');
      const ldrBlock = workspace.newBlock('input_ldr_is_dark');
      
      ledBlock.setFieldValue('led1', 'PIN');
      ldrBlock.setFieldValue('ldr1', 'PIN');
      
      ifBlock.getInput('IF0').connection.connect(ldrBlock.outputConnection);
      ifBlock.getInput('DO0').connection.connect(ledBlock.previousConnection);
      ifBlock.previousConnection.connect(loopBlock.getInput('STACK').connection);
    }, [
      { id: 'ldr1', type: 'ldr', name: 'LDR', mappedPin: '32' },
      { id: 'led1', type: 'led', name: 'LED', mappedPin: '2' }
    ]);

    // E. Servo Control
    runTest("Test E: Servo Control", (workspace, setupBlock, loopBlock) => {
      const servoBlock = workspace.newBlock('output_servo_write');
      const numBlock = workspace.newBlock('math_number');
      
      servoBlock.setFieldValue('servo1', 'PIN');
      numBlock.setFieldValue('90', 'NUM');
      servoBlock.getInput('ANGLE').connection.connect(numBlock.outputConnection);
      servoBlock.previousConnection.connect(loopBlock.getInput('STACK').connection);
    }, [
      { id: 'servo1', type: 'servo', name: 'Servo', mappedPin: '13' }
    ]);

    // F. Bluetooth
    runTest("Test F: Bluetooth", (workspace, setupBlock, loopBlock) => {
      const printBlock = workspace.newBlock('bluetooth_send');
      const textBlock = workspace.newBlock('text');
      textBlock.setFieldValue('Hello', 'TEXT');
      
      printBlock.setFieldValue('bt1', 'PIN');
      printBlock.getInput('DATA').connection.connect(textBlock.outputConnection);
      printBlock.previousConnection.connect(setupBlock.getInput('STACK').connection);
    }, [
      { id: 'bt1', type: 'bluetooth', name: 'BT', mappedPin: { tx: '16', rx: '17' } }
    ]);

    console.log('END_TESTS');
  });

  setTimeout(() => browser.close(), 2000);
})();
