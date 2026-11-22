// package.json is the release version for packaging, visible labels and web cache keys.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { version } = require(path.join(root, 'package.json'));
function update(file, transform) {
  const location = path.join(root, file);
  const before = fs.readFileSync(location, 'utf8');
  const after = transform(before);
  if (after !== before) fs.writeFileSync(location, after);
}
for (const file of ['index.html', 'web/index.html']) {
  update(file, text => text
    .replace(/(<span data-app-version>)[^<]*(<\/span>)/g, `$1${version}$2`)
    .replace(/<title>[^<]*<\/title>/, `<title>Decksona ${version}</title>`)
    .replace(/((?:src|href)="[^"?#]+\.(?:js|css|webmanifest))(?:\?[^"#]*)?"/g, `$1?v=${version}"`));
}
update('web/app.js', text => text.replace(/const WEB_BUILD = '[^']+';/, `const WEB_BUILD = '${version}';`));
update('web/version.json', () => `${JSON.stringify({ build: version, version })}\n`);
update('web/manifest.webmanifest', text => {
  const manifest = JSON.parse(text);
  manifest.start_url = `./index.html?v=${version}`;
  return `${JSON.stringify(manifest, null, 2)}\n`;
});
