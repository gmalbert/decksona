const COMMANDS = Object.freeze({
  ...require('./listening-core').commands,
  players: 'players/all', queues: 'player_queues/all', items: 'player_queues/items',
  search: 'music/search', playPause: 'player_queues/play_pause',
  radioStations: 'music/radios/library_items', addRadio: 'builtin/add_radio',
  stop: 'player_queues/stop', next: 'player_queues/next',
  previous: 'player_queues/previous', seek: 'player_queues/seek',
  skip: 'player_queues/skip',
  playIndex: 'player_queues/play_index', playMedia: 'player_queues/play_media',
  moveItem: 'player_queues/move_item', transfer: 'player_queues/transfer',
  itemByUri: 'music/item_by_uri',
  artistAlbums: 'music/artists/artist_albums', albumTracks: 'music/albums/album_tracks',
  genreTracks: 'music/genres/tracks', genreAlbums: 'music/genres/albums',
  genreArtists: 'music/artists/library_items',
  shuffle: 'player_queues/shuffle', repeat: 'player_queues/repeat',
  volume: 'players/cmd/volume_set'
});

function normalizeServerUrl(input) {
  const value = String(input || '').trim().replace(/\/+$/, '');
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Enter a plain http:// or https:// Music Assistant server URL.');
  }
  return url.toString().replace(/\/+$/, '');
}

function decodeResponse(body) {
  if (body && typeof body === 'object' && (body.error || 'error_code' in body)) {
    const message = typeof body.error === 'string' ? body.error : body.error?.message;
    throw new Error(body.details || message || 'Music Assistant rejected the request.');
  }
  return body && typeof body === 'object' && 'result' in body ? body.result : body;
}

async function decodeHttpResponse(response) {
  if (response.ok) return decodeResponse(await response.json());
  if (response.status === 401) {
    throw new Error('Music Assistant rejected this token (HTTP 401). Create a fresh long-lived access token in Music Assistant → Settings → Profile, then paste the token only, without “Bearer”.');
  }
  decodeResponse(await response.json().catch(() => null));
  throw new Error(`Music Assistant returned HTTP ${response.status}.`);
}

module.exports = { COMMANDS, normalizeServerUrl, decodeResponse, decodeHttpResponse };
