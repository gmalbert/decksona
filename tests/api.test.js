const test = require('node:test');
const assert = require('node:assert/strict');
const { COMMANDS, normalizeServerUrl, decodeResponse, decodeHttpResponse } = require('../api');
const { THEMES, CLASSIC_THEMES } = require('../themes');

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

test('shows Music Assistant error details for HTTP failures', async () => {
  const error = Response.json({ message_id: '1', error_code: 5, details: 'Invalid stream URL' }, { status: 400 });
  await assert.rejects(decodeHttpResponse(error), { message: 'Invalid stream URL' });
  await assert.rejects(decodeHttpResponse(new Response('Bad gateway', { status: 502 })), /HTTP 502/);
  await assert.rejects(decodeHttpResponse(new Response(null, { status: 401 })), /fresh long-lived access token/);
});

test('uses Music Assistant command names', () => {
  assert.equal(COMMANDS.search, 'music/search');
  assert.equal(COMMANDS.playMedia, 'player_queues/play_media');
  assert.equal(COMMANDS.radioStations, 'music/radios/library_items');
  assert.equal(COMMANDS.addRadio, 'builtin/add_radio');
  assert.equal(COMMANDS.volume, 'players/cmd/volume_set');
  assert.equal(COMMANDS.skip, 'player_queues/skip');
  assert.equal(COMMANDS.genreTracks, 'music/genres/tracks');
  assert.equal(COMMANDS.genreAlbums, 'music/genres/albums');
  assert.equal(COMMANDS.genreArtists, 'music/artists/library_items');
});

test('preserves all 36 classic skin and overlay combinations', () => {
  assert.equal(CLASSIC_THEMES.length, 36);
  assert.equal(new Set(THEMES.map(theme => theme.id)).size, THEMES.length);
  assert.equal(new Set(CLASSIC_THEMES.map(theme => theme.pattern)).size, 6);
  assert.ok(THEMES.every(theme => /^#[0-9a-f]{6}$/i.test(theme.accent)));
});
