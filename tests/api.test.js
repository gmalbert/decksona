const test = require('node:test');
const assert = require('node:assert/strict');
const { COMMANDS, normalizeServerUrl, decodeResponse } = require('../api');
const { THEMES } = require('../themes');

test('normalizes a direct Music Assistant server URL', () => {
  assert.equal(normalizeServerUrl(' http://192.168.1.10:8095/ '), 'http://192.168.1.10:8095');
  for (const value of ['file:///etc/passwd', 'http://user:pass@host:8095', 'http://host:8095/other', 'https://host?x=1']) {
    assert.throws(() => normalizeServerUrl(value));
  }
});

test('unpacks API results and reports server errors', () => {
  assert.deepEqual(decodeResponse({ message_id: '1', result: [{ player_id: 'desk' }] }), [{ player_id: 'desk' }]);
  assert.throws(() => decodeResponse({ error: { message: 'Access denied' } }), /Access denied/);
});

test('uses Music Assistant command names', () => {
  assert.equal(COMMANDS.search, 'music/search');
  assert.equal(COMMANDS.playMedia, 'player_queues/play_media');
  assert.equal(COMMANDS.volume, 'players/cmd/volume_set');
  assert.equal(COMMANDS.skip, 'player_queues/skip');
});

test('ships at least 30 distinct skin and overlay combinations', () => {
  assert.equal(THEMES.length, 36);
  assert.equal(new Set(THEMES.map(theme => theme.id)).size, THEMES.length);
  assert.equal(new Set(THEMES.map(theme => theme.pattern)).size, 6);
  assert.ok(THEMES.every(theme => /^#[0-9a-f]{6}$/i.test(theme.accent)));
});
