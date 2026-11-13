const previewTracks = [
  { queue_item_id: 'a', name: 'Midnight City', duration: 245, media_item: { name: 'Midnight City', artists: [{ name: 'M83' }], album: { name: 'Hurry Up, We’re Dreaming' } } },
  { queue_item_id: 'b', name: 'Electric Feel', duration: 230, media_item: { name: 'Electric Feel', artists: [{ name: 'MGMT' }] } },
  { queue_item_id: 'c', name: 'Get Lucky', duration: 369, media_item: { name: 'Get Lucky', artists: [{ name: 'Daft Punk' }] } },
  { queue_item_id: 'd', name: 'A Real Hero', duration: 267, media_item: { name: 'A Real Hero', artists: [{ name: 'College & Electric Youth' }] } }
];
const previewResults = [
  { uri: 'library://track/1', name: 'Midnight City', media_type: 'track', artists: [{ name: 'M83' }] },
  { uri: 'library://track/2', name: 'Wait', media_type: 'track', artists: [{ name: 'M83' }] },
  { uri: 'library://album/3', name: 'Hurry Up, We’re Dreaming', media_type: 'album', artists: [{ name: 'M83' }] },
  { uri: 'library://playlist/4', name: 'Night Drive', media_type: 'playlist', artists: [] }
];
window.retro = {
  getSettings: async () => ({ serverUrl: 'http://music-assistant.local:8095', playerId: 'desk', themeId: 'phosphor-glass', hasToken: true }),
  selectPlayer: async () => {},
  selectTheme: async () => {},
  setCompact: async () => {},
  command: async name => {
    if (name === 'players') return [
      { player_id: 'desk', name: 'Desktop Speakers', available: true, enabled: true, volume_level: 68 },
      { player_id: 'lounge', name: 'Living Room', available: true, enabled: true, volume_level: 45 }
    ];
    if (name === 'queues') return [{ queue_id: 'desk', active: true, state: 'playing', current_item: previewTracks[0], elapsed_time: 72, elapsed_time_last_updated: Date.now() / 1000, shuffle_enabled: true, repeat_mode: 'all' }];
    if (name === 'items') return previewTracks;
    if (name === 'search') return { tracks: previewResults.slice(0, 2), albums: [previewResults[2]], playlists: [previewResults[3]] };
    return null;
  }
};
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('searchInput').value = 'M83';
  setTimeout(() => document.getElementById('searchForm').requestSubmit(), 100);
});
