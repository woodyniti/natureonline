const fs = require('fs');
const path = require('path');
const vm = require('vm');

const htmlPath = 'd:/Nature Online/Sealthai AI Ecosystem V1/Shop Dashboard/index.html';
const content = fs.readFileSync(htmlPath, 'utf8');

const regex = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;
let errors = 0;

while ((match = regex.exec(content)) !== null) {
  count++;
  const scriptContent = match[1];
  try {
    new vm.Script(scriptContent, { filename: `script_${count}.js` });
    console.log(`Script ${count}: Syntax OK (${scriptContent.length} chars)`);
  } catch (err) {
    errors++;
    console.error(`Script ${count} ERROR:`, err.message);
  }
}

console.log(`\nDone. Checked ${count} inline scripts. Errors: ${errors}`);
if (errors > 0) process.exit(1);
