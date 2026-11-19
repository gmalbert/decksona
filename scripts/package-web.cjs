const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'web');
const output = path.join(root, 'dist', 'web');

async function main() {
  if (output !== path.join(root, 'dist', 'web')) {
    throw new Error('Refusing to package web files outside dist/web.');
  }

  await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.cp(source, output, { recursive: true });
  console.log(`Web edition packaged at ${output}`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
