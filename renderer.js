const $ = id => document.getElementById(id);
const state = { connected: false, serverUrl: '', playerId: '', players: [], queues: [], items: [], results: [], queue: null, player: null, searching: false, refreshing: false };
const layout = { compact: false, mini: false, library: true, queue: true };
let beforeMiniCompact = false;
let draggedQueueItem = null;
let movingQueueItem = false;
let seeking = false;
const searchTypes = new Set(['track', 'album', 'playlist', 'artist', 'genre']);
let hideOfflinePlayers = localStorage.getItem('decksona.hideOfflinePlayers') === 'true';
let selectedThemeId = 'phosphor-glass';
const artworkCache = new Map();
let localAudioState = 'connecting';
const localComputerPlayer = () => window.DECKSONA_LOCAL_PLAYER.findLocalPlayer(state.players, desktopAudio?.clientId);
const localComputerId = () => window.DECKSONA_LOCAL_PLAYER.localPlayerId(state.players, desktopAudio?.clientId);
const desktopAudio = window.createDesktopAudio?.({ onStatus: ({ status, detail }) => {
  localAudioState = status;
  const labels = { disabled: 'Local audio is off.', connecting: 'Connecting local audio…', ready: 'This computer is ready · system default speakers or headphones', reconnecting: 'Local audio is reconnecting…', pairing: detail, error: detail };
  $('localAudioStatus').textContent = labels[status] || detail;
  if (status === 'error' || status === 'pairing') message(detail, status === 'error');
  renderPlayers();
} });
async function startDesktopAudio() {
  if (!desktopAudio || !window.retro.getAudioConfig) return;
  const config = await window.retro.getAudioConfig();
  // Do not block the library or remote outputs while local audio reconnects.
  desktopAudio.start(config).catch(error => message(error.message, true));
  if (!state.playerId && config.enabled) state.playerId = desktopAudio.clientId;
}
window.addEventListener('beforeunload', () => desktopAudio?.stop());

function applyTheme(themeId) {
  const theme = THEMES.find(item => item.id === themeId) || THEMES.find(item => item.id === 'phosphor-glass');
  selectedThemeId = theme.id;
  const root = document.documentElement;
  window.DECKSONA_SKINS.apply(root, theme);
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
    if (theme === THEMES[0] || theme === CLASSIC_THEMES[0]) {
      const heading = document.createElement('h3'); heading.className = 'theme-group-label';
      heading.textContent = theme.signature ? 'LISTENING ROOMS · 21 SIGNATURE DESIGNS' : 'CLASSIC PALETTES · 36 ORIGINAL SKINS';
      fragment.append(heading);
    }
    const button = window.DECKSONA_SKINS.createCard(document, theme, async () => {
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
  document.querySelector('.shell').classList.toggle('mini', layout.mini);
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
  const settingsError = $('settingsError');
  if (settingsError) {
    settingsError.textContent = error ? text : '';
    settingsError.hidden = !error;
  }
}
function time(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const value = Math.floor(seconds);
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
function artist(item) {
  return creditedArtists(item).map(entry => entry.name).join(', ') || (isRadio(item) ? 'Live radio' : 'Unknown artist');
}
function isRadio(item) { return (item?.media_item || item)?.media_type === 'radio'; }
function creditedArtists(item) {
  const media = item?.media_item || item;
  const known = value => value && !/^\[?unknown(?: artist)?\]?$/i.test(value.trim());
  const entries = (media?.artists || []).map(entry => typeof entry === 'string' ? { name: entry } : entry).filter(entry => known(entry?.name));
  if (entries.length) return entries;
  if (known(media?.artist?.name)) return [media.artist];
  if (isRadio(item)) return [];
  // Some sources put "Artist - Track" in the title while leaving artist tags unknown.
  const name = String(media?.name || item?.name || '').replace(/^\[unknown\]\s*-\s*/i, '');
  const separator = name.indexOf(' - ');
  return separator > 0 && known(name.slice(0, separator)) ? [{ name: name.slice(0, separator), inferred: true }] : [];
}
function album(item) {
  const media = item?.media_item || item;
  return typeof media?.album === 'string' ? media.album : media?.album?.name || media?.album_name || '';
}
function artworkInfo(item) {
  const media = item?.media_item || item;
  const images = media?.metadata?.images || media?.images || [];
  const albumImages = media?.album?.metadata?.images || [];
  const candidates = [...(Array.isArray(images) ? images : []), ...(Array.isArray(albumImages) ? albumImages : [])];
  const image = candidates.find(entry => entry?.type === 'thumb' && entry.proxy_id)
    || candidates.find(entry => entry?.proxy_id || (entry?.provider && entry?.path));
  const ids = media?.album?.external_ids || [];
  const releaseGroup = ids.find(entry => entry[0] === 'musicbrainz_releasegroupid')?.[1];
  const release = ids.find(entry => entry[0] === 'musicbrainz_albumid')?.[1];
  return item?.image || image || (releaseGroup ? { releaseGroup } : release ? { release }
    : album(item) && artist(item) !== 'Unknown artist' ? { album: album(item), artist: artist(item) } : null);
}
async function loadArtwork(img, item, liveImage = '') {
  const image = artworkInfo(item);
  const artists = creditedArtists(item);
  if (!liveImage && !image && !artists.length) { img.dataset.artworkKey = ''; img.hidden = true; img.removeAttribute('src'); $('artworkCredit').hidden = true; return; }
  const key = JSON.stringify({ liveImage, image, artists });
  if (img.dataset.artworkKey !== key) { img.hidden = true; $('artworkCredit').hidden = true; }
  img.dataset.artworkKey = key;
  try {
    let pending = artworkCache.get(key);
    if (!pending) {
      pending = (async () => {
        const src = (liveImage ? await window.loadRadioArtwork(liveImage) : '') ||
          (image ? await window.retro.image(image) : null);
        if (src) return { src, alt: 'Album cover', title: 'Album cover · Toggle ultra-small player' };
        const portrait = artists.length ? await window.retro.artistImage(artists) : null;
        return portrait ? { src: portrait.src, source: portrait.source, alt: `${portrait.artist || 'Artist'} picture`, title: `Artist picture: ${portrait.artist || 'Unknown artist'} · Toggle ultra-small player` } : null;
      })();
      artworkCache.set(key, pending);
    }
    const artwork = await pending;
    if (img.isConnected && img.dataset.artworkKey === key) {
      if (artwork) { img.src = artwork.src; img.alt = artwork.alt; img.title = artwork.title; img.hidden = false; }
      else { img.hidden = true; img.removeAttribute('src'); }
      $('artworkCredit').hidden = !artwork?.source;
      $('artworkCredit').dataset.source = artwork?.source || '';
    }
  } catch { if (img.dataset.artworkKey === key) { img.hidden = true; $('artworkCredit').hidden = true; } }
}
function title(item) { return item?.name || item?.media_item?.name || 'Unknown title'; }
function duration(item) {
  if (isRadio(item)) return 0;
  return [item?.duration, item?.media_item?.duration, item?.streamdetails?.duration]
    .map(Number).find(value => Number.isFinite(value) && value > 0) || 0;
}
function currentElapsed() {
  const queue = state.queue;
  if (!queue) return 0;
  const elapsed = Number(queue.elapsed_time) || 0;
  const updated = Number(queue.elapsed_time_last_updated) || 0;
  return Math.max(0, elapsed + (queue.state === 'playing' && updated ? Math.max(0, Date.now() / 1000 - updated) : 0));
}
function renderProgress() {
  const total = duration(state.queue?.current_item);
  const elapsed = Math.min(total || Infinity, currentElapsed());
  $('timeDisplay').textContent = time(elapsed);
  $('durationDisplay').textContent = isRadio(state.queue?.current_item) ? 'LIVE' : total ? time(total) : '--:--';
  if (!seeking) $('seek').value = total ? Math.round(elapsed / total * 100) : 0;
  $('seekPercent').textContent = `${$('seek').value}%`;
  $('seek').disabled = !total || !state.queue?.active;
}
function renderPlayer() {
  const queue = state.queue;
  const current = queue?.current_item;
  const live = window.radioNowPlaying?.(current, state.player?.current_media);
  const liveImage = window.radioArtworkUrl?.(live?.imageUrl, state.serverUrl);
  loadArtwork($('nowPlayingArt'), current, liveImage);
  $('trackTitle').textContent = current ? (live?.title || title(current)).toUpperCase() : (state.connected ? 'NOTHING PLAYING' : 'NOT CONNECTED');
  $('trackArtist').textContent = current ? live?.artist || artist(current) : (state.connected ? 'Search your library and press play' : 'Connect to your Music Assistant server');
  $('trackMeta').textContent = live?.album || album(current) || 'MA DIGITAL AUDIO';
  $('connectionStatus').textContent = state.connected ? '● CONNECTED' : '● OFFLINE';
  $('connectionStatus').classList.toggle('online', state.connected);
  const playing = queue?.state === 'playing';
  $('playPauseIcon').classList.toggle('is-paused', playing);
  $('playPause').setAttribute('aria-label', playing ? 'Pause' : 'Play');
  for (const id of ['rewind', 'fastForward']) $(id).disabled = !queue?.active || !duration(current);
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
  listening.updatePlayer();
}
function renderPlayers() {
  const select = $('playerSelect');
  const previous = state.playerId;
  select.replaceChildren();
  const placeholder = new Option('Select a player', '');
  select.add(placeholder);
  const local = localComputerPlayer();
  for (const player of window.DECKSONA_LOCAL_PLAYER.orderedPlayers(state.players, desktopAudio?.clientId, hideOfflinePlayers)) {
    const name = player === local ? 'This computer · Decksona' : player.name;
    select.add(new Option(`${name}${player.needs_setup ? ' (setup required)' : player.available === false ? ' (offline)' : ''}`, player.player_id));
  }
  if (desktopAudio?.clientId && !local) {
    const label = { connecting: 'connecting…', ready: 'waiting for server…', reconnecting: 'reconnecting…', pairing: 'pairing required · see Settings', error: 'unavailable · see Settings' }[localAudioState] || 'unavailable · see Settings';
    const pending = new Option(`This computer · ${label}`, desktopAudio.clientId);
    pending.disabled = true;
    select.add(pending, 1);
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
  const sub = document.createElement('span'); sub.className = 'row-sub';
  const artistName = artist(item);
  const albumName = album(item);
  sub.textContent = item.media_type === 'artist' ? 'View albums' : albumName ? `${artistName} · ${albumName}` : artistName;
  info.append(name, sub);
  const detail = document.createElement('span'); detail.className = 'row-type'; detail.textContent = kind === 'results' ? String(item.media_type || 'track').toUpperCase() : duration(item) ? time(duration(item)) : '--:--';
  row.append(number, info, detail);
  if (kind === 'results') {
    const browse = item.media_type === 'artist' || item.media_type === 'album' || item.media_type === 'genre';
    if (item.media_type !== 'artist' && item.media_type !== 'genre') {
      const add = document.createElement('button'); add.className = 'row-action'; add.textContent = '+'; add.title = 'Add to queue'; add.setAttribute('aria-label', `Add ${title(item)} to queue`);
      add.addEventListener('click', event => { event.stopPropagation(); playMedia(item, 'add'); });
      add.addEventListener('dblclick', event => event.stopPropagation());
      row.append(add);
    }
    if (browse) {
      row.classList.add('browseable');
      const open = document.createElement('button'); open.className = 'row-action'; open.textContent = '›'; open.title = item.media_type === 'artist' ? 'View albums' : item.media_type === 'genre' ? 'Browse genre' : 'View songs'; open.setAttribute('aria-label', `${open.title}: ${title(item)}`);
      open.addEventListener('click', event => { event.stopPropagation(); browseItem(item); });
      row.append(open);
      row.addEventListener('click', event => { if (event.detail === 1) browseItem(item); });
      row.addEventListener('keydown', event => { if (event.target === row && event.key === 'Enter') { event.preventDefault(); browseItem(item); } });
    } else if (item.media_type !== 'genre') row.addEventListener('dblclick', () => playMedia(item, 'replace'));
  } else {
    const firstMovable = firstMovableQueueIndex(state.queue);
    const locked = index < firstMovable;
    row.draggable = !locked;
    row.title = locked ? 'Already played, playing, or buffered by Music Assistant; this track cannot be moved.' : 'Drag to reorder, or use the up and down buttons';
    row.addEventListener('dragstart', event => {
      if (locked) { event.preventDefault(); return; }
      draggedQueueItem = item.queue_item_id;
      event.dataTransfer.setData('text/plain', item.queue_item_id);
      event.dataTransfer.effectAllowed = 'move';
      row.classList.add('dragging');
    });
    row.addEventListener('dragover', event => {
      if (!draggedQueueItem || locked) return;
      event.preventDefault(); event.dataTransfer.dropEffect = 'move'; row.classList.add('drop-target');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
    row.addEventListener('dragend', () => {
      draggedQueueItem = null;
      document.querySelectorAll('.dragging,.drop-target').forEach(node => node.classList.remove('dragging', 'drop-target'));
    });
    row.addEventListener('drop', event => {
      event.preventDefault(); row.classList.remove('drop-target');
      if (locked) { draggedQueueItem = null; return; }
      const from = state.items.findIndex(entry => entry.queue_item_id === draggedQueueItem);
      draggedQueueItem = null;
      if (from >= 0 && from !== index) moveQueueItem(state.items[from], index - from);
    });
    const reorder = document.createElement('span'); reorder.className = 'queue-reorder';
    for (const [label, shift] of [['↑', -1], ['↓', 1]]) {
      const button = document.createElement('button'); button.className = 'row-action'; button.textContent = label;
      button.title = `Move ${shift < 0 ? 'up' : 'down'}`;
      button.setAttribute('aria-label', `${button.title}: ${title(item)}`);
      button.disabled = locked || index + shift < firstMovable || index + shift >= state.items.length;
      if (locked) button.title = row.title;
      button.addEventListener('click', event => { event.stopPropagation(); moveQueueItem(item, shift); });
      button.addEventListener('dblclick', event => event.stopPropagation());
      reorder.append(button);
    }
    row.append(reorder);
    if (item.queue_item_id === state.queue?.current_item?.queue_item_id) row.classList.add('current');
    row.addEventListener('dblclick', () => act('playIndex', { queue_id: state.playerId, index: item.queue_item_id || index }));
  }
  row.addEventListener('keydown', event => { if (event.target === row && event.key === 'Enter' && !(kind === 'results' && ['artist', 'album'].includes(item.media_type))) row.dispatchEvent(new Event('dblclick')); });
  if (kind === 'queue') listening.queueRow(row, item, index);
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
  sessions.update();
  $('queueCount').textContent = `${state.items.length} ITEMS`;
  renderList('queue', state.items, 'queue', state.connected ? 'The queue is empty.' : 'Your queue will appear here.');
  listening.updateQueue();
}
async function refresh() {
  if (!state.connected || state.refreshing || draggedQueueItem || movingQueueItem || listening.queueBusy) return;
  state.refreshing = true;
  let refreshPlayerId = state.playerId;
  try {
    const [players, queues] = await Promise.all([window.retro.command('players'), window.retro.command('queues')]);
    if (state.playerId !== refreshPlayerId) return;
    state.players = Array.isArray(players) ? players : [];
    state.queues = Array.isArray(queues) ? queues : [];
    if (state.playerId === desktopAudio?.clientId && localComputerPlayer()) {
      state.playerId = localComputerId();
      await window.retro.selectPlayer(state.playerId);
    }
    if (!state.playerId || (!state.players.some(p => p.player_id === state.playerId) && state.playerId !== desktopAudio?.clientId)) {
      state.playerId = state.players.find(p => p.available !== false)?.player_id || state.players[0]?.player_id || '';
      if (state.playerId) await window.retro.selectPlayer(state.playerId);
    }
    refreshPlayerId = state.playerId;
    const player = state.players.find(p => p.player_id === refreshPlayerId) || null;
    const queue = state.queues.find(q => q.queue_id === refreshPlayerId) || null;
    const items = queue ? await listening.queueItems(refreshPlayerId) : [];
    if (state.playerId !== refreshPlayerId) return;
    state.player = player; state.queue = queue; state.items = Array.isArray(items) ? items : [];
    renderPlayers(); renderPlayer(); renderQueue();
    listening.connected().catch(error => message(error.message, true));
    if ($('message').textContent === 'CONNECTING…') message('CONNECTED');
  } catch (error) { message(error.message, true); }
  finally { state.refreshing = false; if (state.playerId !== refreshPlayerId) await refresh(); }
}
async function act(name, args = {}) {
  if (listening.queueBusy) { message('Wait for the queue edit to finish.', true); return; }
  if (!state.playerId) { message('Select a player first.', true); return; }
  if (state.playerId === localComputerId() && (!state.player?.available || state.player?.needs_setup)) {
    message('This computer is not ready yet. Check local audio in Connection settings.', true); return;
  }
  try { await window.retro.command(name, args); await refresh(); }
  catch (error) { message(error.message, true); }
}
async function moveQueueItem(item, shift) {
  if (movingQueueItem || listening.queueBusy || !shift || !state.playerId) return;
  movingQueueItem = true;
  try {
    const queues = await window.retro.command('queues');
    const queue = queues.find(entry => entry.queue_id === state.playerId);
    const items = await listening.queueItems(state.playerId);
    const index = items.findIndex(entry => entry.queue_item_id === item.queue_item_id);
    const firstMovable = firstMovableQueueIndex(queue);
    if (index < firstMovable || index + shift < firstMovable) {
      message('Only upcoming tracks that are not buffered can be reordered.');
      return;
    }
    if (index < 0 || index + shift >= items.length) return;
    await window.retro.command('moveItem', { queue_id: state.playerId, queue_item_id: item.queue_item_id, pos_shift: shift });
    message('QUEUE ORDER UPDATED');
  } catch (error) { message(error.message, true); }
  finally { movingQueueItem = false; await refresh(); }
}
function firstMovableQueueIndex(queue) { return window.DECKSONA_LISTENING.firstMovable(queue); }
async function playMedia(item, option) {
  if (item.media_type === 'artist') { await browseItem(item); return; }
  if (!item.uri) { message('This item has no playable URI.', true); return; }
  await act('playMedia', { queue_id: state.playerId, media: item.uri, option });
}
function setSearchTypes(types) {
  searchTypes.clear();
  for (const type of types) searchTypes.add(type);
  document.querySelectorAll('[data-search-type]').forEach(button => button.setAttribute('aria-pressed', String(searchTypes.has(button.dataset.searchType))));
}
async function browseItem(item) { return listening.browse(item); }
async function search() { return listening.search(); }
async function connect() {
  try {
    const saved = await window.retro.saveSettings({ serverUrl: $('serverUrl').value, token: $('token').value, playerId: state.playerId, localAudio: $('localAudio').checked, sendspinUrl: $('sendspinUrl').value });
    state.connected = true;
    state.serverUrl = saved.serverUrl;
    state.playerId = saved.playerId;
    await startDesktopAudio();
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
  state.serverUrl = saved.serverUrl;
  state.playerId = saved.playerId;
  $('serverUrl').value = saved.serverUrl;
  $('localAudio').checked = saved.localAudio !== false;
  $('sendspinUrl').value = saved.sendspinUrl || '';
  $('tokenHint').textContent = saved.hasToken ? 'A saved token is available. Leave blank to keep using it.' : 'The token is encrypted when the operating system supports secure storage.';
  if (state.connected) { message('CONNECTING…'); await startDesktopAudio(); await refresh(); }
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
async function toggleMini() {
  if (!layout.mini) {
    beforeMiniCompact = layout.compact;
    layout.compact = true;
    layout.mini = true;
  } else {
    layout.mini = false;
    layout.compact = beforeMiniCompact;
  }
  renderLayout();
  await window.retro.setCompact(layout.mini ? 'mini' : layout.compact);
}
$('nowPlayingArt').addEventListener('click', toggleMini);
$('artworkCredit').addEventListener('click', () => window.retro.openArtworkSource($('artworkCredit').dataset.source));
$('nowPlayingArt').addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleMini(); }
});
$('miniBack').addEventListener('click', toggleMini);
for (const [button, key] of [['libraryToggle', 'library'], ['queueToggle', 'queue']]) {
  $(button).addEventListener('click', () => { layout[key] = !layout[key]; renderLayout(); });
}
$('closeSettings').addEventListener('click', () => $('settingsDialog').close());
$('settingsForm').addEventListener('submit', event => { event.preventDefault(); connect(); });
$('searchForm').addEventListener('submit', event => { event.preventDefault(); search(); });
if ($('radioOpen')) window.installRadioLibrary({
  command: (name, args) => window.retro.command(name, args),
  play: station => playMedia(station, 'replace')
});
document.querySelectorAll('[data-search-type]').forEach(button => {
  button.addEventListener('click', () => {
    const type = button.dataset.searchType;
    if (searchTypes.has(type)) searchTypes.delete(type);
    else searchTypes.add(type);
    setSearchTypes([...searchTypes]);
    search();
  });
});
$('playerSelect').addEventListener('change', async event => { await selectSessionPlayer(event.target.value); });
$('hideOfflinePlayers').checked = hideOfflinePlayers;
$('hideOfflinePlayers').addEventListener('change', async event => {
  hideOfflinePlayers = event.target.checked;
  localStorage.setItem('decksona.hideOfflinePlayers', String(hideOfflinePlayers));
  if (hideOfflinePlayers && state.players.find(player => player.player_id === state.playerId)?.available === false) await selectSessionPlayer('');
  renderPlayers();
});
for (const [id, name] of [['previous', 'previous'], ['playPause', 'playPause'], ['stop', 'stop'], ['next', 'next']]) {
  $(id).addEventListener('click', () => act(name, { queue_id: state.playerId }));
}
for (const [id, seconds] of [['rewind', -10], ['fastForward', 10]]) {
  $(id).addEventListener('click', () => act('skip', { queue_id: state.playerId, seconds }));
}
$('shuffle').addEventListener('click', () => act('shuffle', { queue_id: state.playerId, shuffle_enabled: !state.queue?.shuffle_enabled }));
$('repeat').addEventListener('click', () => { const next = { off: 'all', all: 'one', one: 'off' }[state.queue?.repeat_mode || 'off']; act('repeat', { queue_id: state.playerId, repeat_mode: next }); });
$('seek').addEventListener('input', () => { $('seekPercent').textContent = `${$('seek').value}%`; });
$('seek').addEventListener('pointerdown', () => { seeking = true; });
document.addEventListener('pointerup', () => { seeking = false; });
$('seek').addEventListener('blur', () => { seeking = false; });
$('seek').addEventListener('change', () => { seeking = false; const total = duration(state.queue?.current_item); if (total) act('seek', { queue_id: state.playerId, position: Math.round(total * Number($('seek').value) / 100) }); });
$('volume').addEventListener('input', () => { $('volumeValue').textContent = $('volume').value; });
$('volume').addEventListener('change', () => act('volume', { player_id: state.playerId, volume_level: Number($('volume').value) }));
document.addEventListener('keydown', event => {
  if (event.target.matches('input,select,button') || $('settingsDialog').open || $('radioDialog')?.open) return;
  if (event.code === 'Space') { event.preventDefault(); act('playPause', { queue_id: state.playerId }); }
  if (event.shiftKey && isRadio(state.queue?.current_item)) return;
  if (event.code === 'ArrowRight') act(event.shiftKey ? 'skip' : 'next', { queue_id: state.playerId, ...(event.shiftKey ? { seconds: 10 } : {}) });
  if (event.code === 'ArrowLeft') act(event.shiftKey ? 'skip' : 'previous', { queue_id: state.playerId, ...(event.shiftKey ? { seconds: -10 } : {}) });
});
async function selectSessionPlayer(id) { state.playerId=id; state.queue=null;state.items=[];state.player=null;renderPlayer();renderQueue();await window.retro.selectPlayer(id);await refresh(); }
const sessions = window.createPlayerSession({state,command:(name,args)=>window.retro.command(name,args),select:selectSessionPlayer,refresh,notify:message,formatPlayerName:player=>player.player_id===localComputerId()?'This computer · Decksona':player.name,listPlayers:()=>window.DECKSONA_LOCAL_PLAYER.orderedPlayers(state.players,desktopAudio?.clientId,hideOfflinePlayers)});
const listening = window.createListeningFeatures({
  state, command: (name,args) => window.retro.command(name,args), refresh, selectPlayer: selectSessionPlayer,
  notify: message, filters: () => searchTypes,
  image: item => { const info = artworkInfo(item); return info ? window.retro.image(info) : null; },
  beforePlay: async () => {
    if (state.playerId === localComputerId() && (!state.player?.available || state.player?.needs_setup)) throw new Error('This computer is not ready. Check local audio in Settings.');
  }
});
$('queue').addEventListener('decksona-render-queue', renderQueue);
setInterval(renderProgress, 1000);
setInterval(refresh, 5000);
buildThemePicker();
renderLayout();
init().catch(error => message(error.message, true));
