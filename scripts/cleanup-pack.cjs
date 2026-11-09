const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const marker = path.join(root, '.pack-artifacts.json');
if (!fs.existsSync(marker)) process.exit(0);

const artifacts = JSON.parse(fs.readFileSync(marker, 'utf8'));
for (const file of artifacts) fs.rmSync(path.join(root, file), { force: true });
fs.rmSync(marker, { force: true });
