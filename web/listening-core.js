/* Shared Music Assistant contracts and pure listening helpers. */
(function (root) {
  const commands = Object.freeze({
    libraryAlbums: 'music/albums/library_items', libraryArtists: 'music/artists/library_items',
    libraryTracks: 'music/tracks/library_items', libraryPlaylists: 'music/playlists/library_items',
    libraryGenres: 'music/genres/library_items', playlistTracks: 'music/playlists/playlist_tracks',
    createPlaylist: 'music/playlists/create_playlist', addPlaylistTracks: 'music/playlists/add_playlist_tracks',
    removePlaylistTracks: 'music/playlists/remove_playlist_tracks', movePlaylistTrack: 'music/playlists/move_playlist_track',
    deleteItem: 'player_queues/delete_item', recommendations: 'music/recommendations',
    recommendationItems: 'music/recommendations/items', providers: 'providers', task: 'tasks/get'
  });
  const media = item => item?.media_item || item || {};
  function reference(item) {
    const value = media(item), match = value.uri?.match(/^([^:]+):\/\/[^/]+\/(.+)$/);
    return { item_id: String(value.item_id ?? match?.[2] ?? ''), provider_instance_id_or_domain: value.provider || match?.[1] || '' };
  }
  function firstMovable(queue) {
    if (Number.isInteger(queue?.index_in_buffer)) return Math.max(queue.index_in_buffer, queue.current_index ?? -1) + 1;
    return queue?.current_item ? Math.max(0, (queue.current_index ?? 0) + 1) : 0;
  }
  function quality(item) {
    const stream = item?.streamdetails;
    const format = stream?.audio_format;
    const source = stream?.provider;
    if (!format && !source) return 'Audio quality unavailable';
    const parts = [];
    if (source) parts.push(String(source));
    if (format?.content_type && format.content_type !== '?') parts.push(String(format.content_type).toUpperCase());
    if (Number(format?.sample_rate) > 0) parts.push(`${Number(format.sample_rate) / 1000} kHz`);
    if (Number(format?.bit_depth) > 0) parts.push(`${format.bit_depth}-bit`);
    if (Number(format?.bit_rate) > 0) parts.push(`${format.bit_rate} kbps`);
    return parts.join(' · ') || 'Audio quality unavailable';
  }
  function searchArgs(query, types, limit, libraryOnly, provider) {
    const args = { search_query: query, media_types: [...types], limit, library_only: libraryOnly };
    if (libraryOnly) args.providers = ['library'];
    else if (provider) args.providers = [provider];
    return args;
  }
  const api = { commands, media, reference, firstMovable, quality, searchArgs };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DECKSONA_LISTENING = api;
})(typeof window === 'undefined' ? globalThis : window);
