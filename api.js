const COMMANDS = Object.freeze({
  players: 'players/all', queues: 'player_queues/all', items: 'player_queues/items',
  search: 'music/search', playPause: 'player_queues/play_pause',
  stop: 'player_queues/stop', next: 'player_queues/next',
  previous: 'player_queues/previous', seek: 'player_queues/seek',
  skip: 'player_queues/skip',
  playIndex: 'player_queues/play_index', playMedia: 'player_queues/play_media',
  moveItem: 'player_queues/move_item',
  itemByUri: 'music/item_by_uri',
  artistAlbums: 'music/artists/artist_albums', albumTracks: 'music/albums/album_tracks',
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
  if (body && typeof body === 'object' && body.error) {
    throw new Error(typeof body.error === 'string' ? body.error : body.error.message || 'Music Assistant rejected the request.');
  }
  return body && typeof body === 'object' && 'result' in body ? body.result : body;
}

module.exports = { COMMANDS, normalizeServerUrl, decodeResponse };
