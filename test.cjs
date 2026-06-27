const fs = require('fs');
const config = JSON.parse(fs.readFileSync('src/shared/boards/esp32/board-config.json'));
const pinmap = JSON.parse(fs.readFileSync('src/shared/boards/esp32/pinmap.json'));
const reqs = { requiredInterfaces: { in1: ['DIGITAL_OUT'], in2: ['DIGITAL_OUT'] } };
const currentDevices = [
  { mappedPin: { in1: 'GPIO19', in2: 'GPIO18' } },
  { mappedPin: { in1: 'GPIO5', in2: 'GPIO17' } },
  { mappedPin: { in1: 'GPIO23', in2: 'GPIO22' } }
];
const assignedPins = new Set();
currentDevices.forEach(d => Object.values(d.mappedPin).forEach(p => assignedPins.add(p)));

let peripheral = pinmap.peripherals.dcmotor;
let baseOccupied = true;
let nextOccupied = false;
for (let i = 2; i <= 8; i++) {
  const nextPeriph = pinmap.peripherals['dcmotor_' + i];
  if (nextPeriph && nextPeriph.preferredPin) {
    nextOccupied = false;
    Object.values(nextPeriph.preferredPin).forEach(p => {
      if (assignedPins.has(p)) nextOccupied = true;
    });
    if (!nextOccupied) {
      peripheral = nextPeriph;
      break;
    }
  }
}
console.log('Chosen peripheral:', peripheral);

let allocation = {};
let usedInThisPass = new Set();
let allFound = true;
Object.keys(reqs.requiredInterfaces).forEach(key => {
  const preferredPin = peripheral.preferredPin[key];
  if (preferredPin && !assignedPins.has(preferredPin) && !usedInThisPass.has(preferredPin) && pinmap.pins[preferredPin]) {
    allocation[key] = preferredPin;
    usedInThisPass.add(preferredPin);
  } else {
    allFound = false;
  }
});
console.log('All found:', allFound, 'Allocation:', allocation);
