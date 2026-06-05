const fs = require('fs');

const blocksPath = 'src/renderer/src/components/blockly/blocks/customBlocks.ts';
const genPath = 'src/renderer/src/components/blockly/generator/arduinoGenerator.ts';

const blocksContent = fs.readFileSync(blocksPath, 'utf8');
const genContent = fs.readFileSync(genPath, 'utf8');

const blockMatches = [...blocksContent.matchAll(/Blockly\.Blocks\['([^']+)'\]/g)];
const definedBlocks = blockMatches.map(m => m[1]);

const genMatches = [...genContent.matchAll(/arduinoGenerator\.forBlock\['([^']+)'\]/g)];
const definedGenerators = genMatches.map(m => m[1]);

const standardBlocks = ['text', 'math_number', 'logic_boolean', 'logic_compare', 'controls_if', 'controls_repeat_ext', 'controls_whileUntil', 'variables_get', 'variables_set', 'math_arithmetic', 'math_single', 'math_modulo', 'math_random_int', 'controls_for', 'text_print', 'text_join', 'math_change'];

const allGenerators = [...definedGenerators, ...standardBlocks];

let missing = 0;
console.log("=== GENERATOR AUDIT REPORT ===\n");
definedBlocks.forEach(b => {
  if (!definedGenerators.includes(b)) {
    console.log(`[MISSING] No generator found for: ${b}`);
    missing++;
  } else {
    console.log(`[OK] Generator exists for: ${b}`);
  }
});

if (missing === 0) {
  console.log("\n✅ PASS: 100% of custom blocks have matching generators.");
} else {
  console.log(`\n❌ FAIL: ${missing} blocks are missing generators.`);
}
