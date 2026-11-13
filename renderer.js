const $ = id => document.getElementById(id);
const state = { connected: false, playerId: '', players: [], queues: [], items: [], results: [], queue: null, player: null, searching: false, refreshing: false };
const layout = { compact: false, library: true, queue: true };
let selectedThemeId = 'phosphor-glass';

function applyTheme(themeId) {
  const theme = THEMES.find(item => item.id === themeId) || THEMES[0];
  selectedThemeId = theme.id;
  const root = document.documentElement;
  root.style.setProperty('--skin-background', theme.background);
  root.style.setProperty('--skin-panel', theme.panel);
  root.style.setProperty('--skin-screen', theme.screen);
  root.style.setProperty('--skin-accent', theme.accent);
  root.style.setProperty('--skin-secondary', theme.secondary);
  root.style.setProperty('--skin-border', theme.border);
  root.dataset.pattern = theme.pattern;
  document.querySelectorAll('.theme-card').forEach(card => {
    const active = card.dataset.themeId === theme.id;
    card.classList.toggle('selected', active);
    card.setAttribute('aria-pressed', String(active));
  });
  $('themeCount').textContent = `${THEMES.length} SKINS`;
}

function buildThemePicker() {
  const grid = $('themeGrid');
  const fragment = document.createDocumentFragment();
  for (const theme of THEMES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-card';
    button.dataset.themeId = theme.id;
    button.dataset.pattern = theme.pattern;
    button.title = theme.description;
    button.style.setProperty('--swatch-panel', theme.panel);
    button.style.setProperty('--swatch-screen', theme.screen);
    button.style.setProperty('--swatch-accent', theme.accent);
    button.style.setProperty('--swatch-border', theme.border);
    const swatch = document.createElement('span'); swatch.className = 'theme-swatch';
    const name = document.createElement('span'); name.className = 'theme-name'; name.textContent = theme.name;
    button.append(swatch, name);
    button.addEventListener('click', async () => {
      applyTheme(theme.id);
      try { await window.retro.selectTheme(theme.id); message(`SKIN · ${theme.name.toUpperCase()}`); }
      catch (error) { message(error.message, true); }
    });
    fragment.append(button);
  }
  grid.append(fragment);
  applyTheme(selectedThemeId);
}

function renderLayout() {
  const libraryVisible = !layout.compact && layout.library;
  const queueVisible = !layout.compact && layout.queue;
  $('libraryPanel').hidden = !libraryVisible;
  $('queuePanel').hidden = !queueVisible;
  const workspace = document.querySelector('.workspace');
  workspace.hidden = !libraryVisible && !queueVisible;
  workspace.classList.toggle('single-panel', libraryVisible !== queueVisible);
  document.querySelector('.shell').classList.toggle('compact', layout.compact);
  $('compactToggle').textContent = layout.compact ? 'EXPAND' : 'COMPACT';
  $('compactToggle').setAttribute('aria-pressed', String(layout.compact));
  for (const [id, visible] of [['libraryToggle', layout.library], ['queueToggle', layout.queue]]) {
    $(id).classList.toggle('active', visible);
    $(id).setAttribute('aria-pressed', String(visible));
  }
}

function message(text, error = false) {
  $('message').textContent = (error ? 'ERROR · ' : '') + text;
  $('message').style.color = error ? '#f1a594' : '#95cbaa';
}
function time(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const value = Math.floor(seconds);
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
function artist(item) {
  const media = item?.media_item || item;
  return (media?.artists || []).map(a => typeof a === 'string' ? a : a.name).filter(Boolean).join(', ') || media?.artist?.name || media?.album?.name || 'Unknown artist';
}
function title(item) { return item?.name || item?.media_item?.name || 'Unknown title'; }
function currentElapsed() {
  const queue = state.queue;
  if (!queue) return 0;
  const elapsed = Number(queue.elapsed_time) || 0;
  const updated = Number(queue.elapsed_time_last_updated) || 0;
  return Math.max(0, elapsed + (queue.state === 'playing' && updated ? Math.max(0, Date.now() / 1000 - updated) : 0));
}
function renderProgress() {
  const duration = Number(state.queue?.current_item?.duration) || 0;
  const elapsed = Math.min(duration || Infinity, currentElapsed());
  $('timeDisplay').textContent = time(elapsed);
  $('durationDisplay').textContent = time(duration);
  if (document.activeElement !== $('seek')) $('seek').value = duration ? Math.round(elapsed / duration * 100) : 0;
  $('seekPercent').textContent = `${$('seek').value}%`;
  $('seek').disabled = !duration || !state.queue?.active;
}
function renderPlayer() {
  const queue = state.queue;
  const current = queue?.current_item;
  $('trackTitle').textContent = current ? title(current).toUpperCase() : (state.connected ? 'NOTHING PLAYING' : 'NOT CONNECTED');
  $('trackArtist').textContent = current ? artist(current) : (state.connected ? 'Search your library and press play' : 'Connect to your Music Assistant server');
  $('trackMeta').textContent = current?.media_item?.album?.name || 'MA DIGITAL AUDIO';
  $('connectionStatus').textContent = state.connected ? '● CONNECTED' : '● OFFLINE';
  $('connectionStatus').classList.toggle('online', state.connected);
  const playing = queue?.state === 'playing';
  $('playPauseIcon').textContent = playing ? '' : '▶';
  $('playPauseIcon').classList.toggle('is-paused', playing);
  $('playPause').setAttribute('aria-label', playing ? 'Pause' : 'Play');
  for (const id of ['rewind', 'fastForward']) $(id).disabled = !queue?.active || !queue?.current_item?.duration;
  document.querySelector('.shell').classList.toggle('playing', queue?.state === 'playing');
  $('shuffle').classList.toggle('active', Boolean(queue?.shuffle_enabled));
  $('shuffle').setAttribute('aria-pressed', String(Boolean(queue?.shuffle_enabled)));
  const repeat = queue?.repeat_mode || 'off';
  $('repeat').textContent = `REPEAT ${repeat.toUpperCase()}`;
  $('repeat').classList.toggle('active', repeat !== 'off');
  const volume = state.player?.volume_level;
  if (Number.isFinite(volume) && document.activeElement !== $('volume')) $('volume').value = volume;
  $('volumeValue').textContent = $('volume').value;
  $('volume').disabled = !state.player || volume == null;
  renderProgress();
}
function renderPlayers() {
  const select = $('playerSelect');
  const previous = state.playerId;
  select.replaceChildren();
  const placeholder = new Option('Select an output', '');
  select.add(placeholder);
  for (const player of state.players.filter(p => p.enabled !== false)) {
    select.add(new Option(`${player.name}${player.available === false ? ' (offline)' : ''}`, player.player_id));
  }
  select.value = previous;
}
function makeRow(item, index, kind) {
  const row = document.createElement('div');
  row.className = 'row';
  row.tabIndex = 0;
  const number = document.createElement('span'); number.className = 'row-index'; number.textContent = String(index + 1).padStart(2, '0');
  const info = document.createElement('div'); info.className = 'row-info';
  const name = document.createElement('span'); name.className = 'row-name'; name.textContent = title(item);
  const sub = document.createElement('span'); sub.className = 'row-sub'; sub.textContent = artist(item);
  info.append(name, sub);
  const detail = document.createElement('span'); detail.className = 'row-type'; detail.textContent = kind === 'results' ? String(item.media_type || 'track').toUpperCase() : time(item.duration);
  row.append(number, info, detail);
  if (kind === 'results') {
    const add = document.createElement('button'); add.className = 'row-action'; add.textContent = '+'; add.title = 'Add to queue'; add.setAttribute('aria-label', `Add ${title(item)} to queue`);
    add.addEventListener('click', event => { event.stopPropagation(); playMedia(item, 'add'); });
    row.append(add);
    row.addEventListener('dblclick', () => playMedia(item, 'replace'));
  } else {
    if (item.queue_item_id === state.queue?.current_item?.queue_item_id) row.classList.add('current');
    row.addEventListener('dblclick', () => act('playIndex', { queue_id: state.playerId, index: item.queue_item_id || index }));
  }
  row.addEventListener('keydown', event => { if (event.key === 'Enter') row.dispatchEvent(new Event('dblclick')); });
  return row;
}
function renderList(id, items, kind, empty) {
  const target = $(id);
  target.replaceChildren();
  if (!items.length) { const node = document.createElement('div'); node.className = 'empty'; node.textContent = empty; target.append(node); return; }
  const fragment = document.createDocumentFragment();
  items.forEach((item, index) => fragment.append(makeRow(item, index, kind)));
  target.append(fragment);
}
function renderQueue() {
  $('queueCount').textContent = `${state.items.length} ITEMS`;
  renderList('queue', state.items, 'queue', state.connected ? 'The queue is empty.' : 'Your queue will appear here.');
}
async function refresh() {
  if (!state.connected || state.refreshing) return;
  state.refreshing = true;
  try {
    const [players, queues] = await Promise.all([window.retro.command('players'), window.retro.command('queues')]);
    state.players = Array.isArray(players) ? players : [];
    state.queues = Array.isArray(queues) ? queues : [];
    if (!state.playerId || !state.players.some(p => p.player_id === state.playerId)) {
      state.playerId = state.players.find(p => p.available !== false)?.player_id || state.players[0]?.player_id || '';
      if (state.playerId) await window.retro.selectPlayer(state.playerId);
    }
    state.player = state.players.find(p => p.player_id === state.playerId) || null;
    state.queue = state.queues.find(q => q.queue_id === state.playerId) || null;
    state.items = state.queue ? await window.retro.command('items', { queue_id: state.playerId, limit: 200, offset: 0 }) : [];
    if (!Array.isArray(state.items)) state.items = [];
    renderPlayers(); renderPlayer(); renderQueue();
  } catch (error) { message(error.message, true); }
  finally { state.refreshing = false; }
}
async function act(name, args = {}) {
  if (!state.playerId) { message('Select an output first.', true); return; }
  try { await window.retro.command(name, args); await refresh(); }
  catch (error) { message(error.message, true); }
}
async function playMedia(item, option) {
  if (!item.uri) { message('This item has no playable URI.', true); return; }
  await act('playMedia', { queue_id: state.playerId, media: item.uri, option });
}
async function search() {
  const query = $('searchInput').value.trim();
  if (!query) { state.results = []; renderList('results', [], 'results', 'Search for music to begin.'); return; }
  if (!state.connected) { message('Connect to Music Assistant first.', true); return; }
  message(`SEARCHING · ${query}`);
  try {
    const data = await window.retro.command('search', { search_query: query, media_types: ['track', 'album', 'playlist'], limit: 30, library_only: false });
    state.results = ['tracks', 'albums', 'playlists'].flatMap(key => Array.isArray(data?.[key]) ? data[key] : []);
    renderList('results', state.results, 'results', 'No matches found.');
    message(`${state.results.length} RESULTS`);
  } catch (error) { message(error.message, true); }
}
async function connect() {
  try {
    const saved = await window.retro.saveSettings({ serverUrl: $('serverUrl').value, token: $('token').value, playerId: state.playerId });
    state.connected = true;
    state.playerId = saved.playerId;
    $('token').value = '';
    $('settingsDialog').close();
    message(saved.tokenSaved ? 'CONNECTED · TOKEN SAVED SECURELY' : 'CONNECTED · TOKEN HELD FOR THIS SESSION');
    await refresh();
  } catch (error) { message(error.message, true); }
}

async function init() {
  const saved = await window.retro.getSettings();
  applyTheme(saved.themeId);
  state.connected = Boolean(saved.serverUrl && saved.hasToken);
  state.playerId = saved.playerId;
  $('serverUrl').value = saved.serverUrl;
  $('tokenHint').textContent = saved.hasToken ? 'A saved token is available. Leave blank to keep using it.' : 'The token is encrypted when the operating system supports secure storage.';
  if (state.connected) { message('CONNECTING…'); await refresh(); }
  else $('settingsDialog').showModal();
}

$('settingsButton').addEventListener('click', () => $('settingsDialog').showModal());
$('themesButton').addEventListener('click', () => $('themesDialog').showModal());
$('closeThemes').addEventListener('click', () => $('themesDialog').close());
$('compactToggle').addEventListener('click', async () => {
  layout.compact = !layout.compact;
  renderLayout();
  await window.retro.setCompact(layout.compact);
});
for (const [button, key] of [['libraryToggle', 'library'], ['queueToggle', 'queue']]) {
  $(button).addEventListener('click', () => { layout[key] = !layout[key]; renderLayout(); });
}
$('closeSettings').addEventListener('click', () => $('settingsDialog').close());
$('settingsForm').addEventListener('submit', event => { event.preventDefault(); connect(); });
$('searchForm').addEventListener('submit', event => { event.preventDefault(); search(); });
$('playerSelect').addEventListener('change', async event => { state.playerId = event.target.value; await window.retro.selectPlayer(state.playerId); await refresh(); });
for (const [id, name] of [['previous', 'previous'], ['playPause', 'playPause'], ['stop', 'stop'], ['next', 'next']]) {
  $(id).addEventListener('click', () => act(name, { queue_id: state.playerId }));
}
for (const [id, seconds] of [['rewind', -10], ['fastForward', 10]]) {
  $(id).addEventListener('click', () => act('skip', { queue_id: state.playerId, seconds }));
}
$('shuffle').addEventListener('click', () => act('shuffle', { queue_id: state.playerId, shuffle_enabled: !state.queue?.shuffle_enabled }));
$('repeat').addEventListener('click', () => { const next = { off: 'all', all: 'one', one: 'off' }[state.queue?.repeat_mode || 'off']; act('repeat', { queue_id: state.playerId, repeat_mode: next }); });
$('seek').addEventListener('input', () => { $('seekPercent').textContent = `${$('seek').value}%`; });
$('seek').addEventListener('change', () => { const duration = Number(state.queue?.current_item?.duration) || 0; if (duration) act('seek', { queue_id: state.playerId, position: Math.round(duration * Number($('seek').value) / 100) }); });
$('volume').addEventListener('input', () => { $('volumeValue').textContent = $('volume').value; });
$('volume').addEventListener('change', () => act('volume', { player_id: state.playerId, volume_level: Number($('volume').value) }));
document.addEventListener('keydown', event => {
  if (event.target.matches('input,select,button') || $('settingsDialog').open) return;
  if (event.code === 'Space') { event.preventDefault(); act('playPause', { queue_id: state.playerId }); }
  if (event.code === 'ArrowRight') act(event.shiftKey ? 'skip' : 'next', { queue_id: state.playerId, ...(event.shiftKey ? { seconds: 10 } : {}) });
  if (event.code === 'ArrowLeft') act(event.shiftKey ? 'skip' : 'previous', { queue_id: state.playerId, ...(event.shiftKey ? { seconds: -10 } : {}) });
});
setInterval(renderProgress, 1000);
setInterval(refresh, 5000);
buildThemePicker();
renderLayout();
init().catch(error => message(error.message, true));
