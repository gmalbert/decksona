require('./sync-version.cjs');
for (const file of ['listening-core.js', 'listening.js', 'listening.css']) require('node:fs').copyFileSync(file, `web/${file}`);
const { buildSync } = require('esbuild');
require('node:fs').copyFileSync('local-player.js', 'web/local-player.js');
require('node:fs').copyFileSync('player-session.js', 'web/player-session.js');
buildSync({
  entryPoints: ['desktop-audio.js'],
  outfile: 'desktop-audio.bundle.js',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'chrome142',
  // These optional Opus fallbacks use Emscripten. Desktop playback deliberately
  // advertises FLAC/PCM only; Chromium's native decoder handles lossless audio.
  external: ['opus-encdec/*'],
});
buildSync({
  entryPoints: ['web-audio.js'],
  outfile: 'web/audio.bundle.js',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['safari16', 'chrome110'],
  external: ['opus-encdec/*'],
});
