const path = require('node:path');
const fs = require('node:fs');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'plugin.js');

if (fs.existsSync(output)) throw new Error('Refusing to overwrite existing plugin.js');

esbuild.buildSync({
    entryPoints: [path.join(root, 'dist', 'plugin.js')],
    outfile: output,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'bundle',
    sourcemap: false,
});
fs.writeFileSync(path.join(root, '.pack-artifacts.json'), JSON.stringify(['plugin.js']));
