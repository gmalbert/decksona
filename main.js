const { app, BrowserWindow, ipcMain, safeStorage, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { COMMANDS, normalizeServerUrl, decodeResponse } = require('./api');
const { THEMES } = require('./themes');

let settings = { serverUrl: '', playerId: '', encryptedToken: '', themeId: 'phosphor-glass' };
let sessionToken = '';
let requestId = 0;
let playerWindow;
let expandedBounds;
let windowMode = 'full';
const portraitCache = new Map();
async function fetchPortrait(artist) {
  const name = artist.name;
  try {
    const json = async url => {
      const options = () => ({ headers: { 'User-Agent': 'Decksona/0.1 (desktop music player)' }, signal: AbortSignal.timeout(12000) });
      let response = await fetch(url, options());
      if (response.status === 429 || response.status === 503) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        response = await fetch(url, options());
      }
      if (!response.ok) throw new Error('Artist lookup unavailable');
      return response.json();
    };
    const normalize = value => String(value).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    let mbid = artist.external_ids?.find(entry => entry[0] === 'musicbrainz_artistid')?.[1];
    if (!mbid) {
      const escaped = name.slice(0, 200).replace(/["\\]/g, ' ');
      const query = new URLSearchParams({ query: `artist:"${escaped}"`, fmt: 'json', limit: '10' });
      const search = await json(`https://musicbrainz.org/ws/2/artist/?${query}`);
      const matches = (search.artists || []).filter(entry => Number(entry.score) === 100 && normalize(entry.name) === normalize(name));
      // An ambiguous name should not select another artist's portrait.
      if (matches.length !== 1) return null;
      mbid = matches[0].id;
      await new Promise(resolve => setTimeout(resolve, 1100));
    }
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(mbid)) return null;
    const record = await json(`https://musicbrainz.org/ws/2/artist/${mbid}?inc=url-rels&fmt=json`);
    let pageTitle;
    const wikipedia = record.relations?.find(rel => rel.type === 'wikipedia' && /^https?:\/\/en\.wikipedia\.org\/wiki\//.test(rel.url?.resource || ''));
    if (wikipedia) pageTitle = decodeURIComponent(new URL(wikipedia.url.resource).pathname.slice('/wiki/'.length));
    if (!pageTitle) {
      const wikidata = record.relations?.find(rel => rel.type === 'wikidata');
      const entityId = wikidata?.url?.resource?.match(/\/wiki\/(Q\d+)$/)?.[1];
      if (!entityId) return null;
      const entity = await json(`https://www.wikidata.org/wiki/Special:EntityData/${entityId}.json`);
      pageTitle = entity.entities?.[entityId]?.sitelinks?.enwiki?.title;
    }
    if (!pageTitle) return null;
    const data = await json(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`);
    const imageUrl = new URL(data.thumbnail?.source || data.originalimage?.source);
    if (imageUrl.protocol !== 'https:' || imageUrl.hostname !== 'upload.wikimedia.org') return null;
    const image = await fetch(imageUrl, { signal: AbortSignal.timeout(12000) });
    const type = image.headers.get('content-type') || '';
    if (!image.ok || !type.startsWith('image/')) return null;
    const bytes = Buffer.from(await image.arrayBuffer());
    if (bytes.length > 5_000_000) return null;
    return { src: `data:${type};base64,${bytes.toString('base64')}`, artist: data.title, source: data.content_urls?.desktop?.page };
  } catch { return null; }
}
const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try { settings = { ...settings, ...JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) }; }
  catch (error) { if (error.code !== 'ENOENT') console.warn('Could not read settings:', error.message); }
  if (settings.encryptedToken && safeStorage.isEncryptionAvailable()) {
    try { sessionToken = safeStorage.decryptString(Buffer.from(settings.encryptedToken, 'base64')); }
    catch { sessionToken = ''; }
  }
}

function saveSettings() {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), { mode: 0o600 });
}

async function command(name, args = {}) {
  if (!COMMANDS[name]) throw new Error('Unsupported command.');
  if (!settings.serverUrl || !sessionToken) throw new Error('Connect to Music Assistant first.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ['artistAlbums', 'albumTracks'].includes(name) ? 30000 : 12000);
  try {
    const response = await fetch(`${settings.serverUrl}/api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ message_id: String(++requestId), command: COMMANDS[name], args }),
      signal: controller.signal
    });
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Music Assistant rejected this token (HTTP 401). Create a fresh long-lived access token in Music Assistant → Settings → Profile, then paste the token only, without “Bearer”.');
      }
      throw new Error(`Music Assistant returned HTTP ${response.status}.`);
    }
    return decodeResponse(await response.json());
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The server did not respond in time.');
    throw error;
  } finally { clearTimeout(timeout); }
}

function createWindow() {
  playerWindow = new BrowserWindow({
    width: 930, height: 690, minWidth: 530, minHeight: 320,
    backgroundColor: '#151a20', title: 'Decksona', icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  playerWindow.loadFile('index.html');
  playerWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

app.setName('Decksona');

app.whenReady().then(() => {
  loadSettings();
  ipcMain.handle('settings:get', () => ({ serverUrl: settings.serverUrl, playerId: settings.playerId, themeId: settings.themeId, hasToken: Boolean(sessionToken) }));
  ipcMain.handle('settings:save', async (_event, input) => {
    const serverUrl = normalizeServerUrl(input.serverUrl);
    const token = String(input.token || '').trim() || sessionToken;
    if (!token) throw new Error('Enter a long-lived access token.');
    const old = { ...settings, sessionToken };
    settings.serverUrl = serverUrl;
    sessionToken = token;
    settings.playerId = String(input.playerId || settings.playerId || '');
    try {
      await command('players');
      settings.encryptedToken = safeStorage.isEncryptionAvailable()
        ? safeStorage.encryptString(token).toString('base64') : '';
      saveSettings();
      return { serverUrl, playerId: settings.playerId, tokenSaved: Boolean(settings.encryptedToken) };
    } catch (error) {
      settings = { serverUrl: old.serverUrl, playerId: old.playerId, encryptedToken: old.encryptedToken, themeId: old.themeId };
      sessionToken = old.sessionToken;
      throw error;
    }
  });
  ipcMain.handle('settings:player', (_event, playerId) => {
    settings.playerId = String(playerId || '');
    saveSettings();
    return settings.playerId;
  });
  ipcMain.handle('settings:theme', (_event, themeId) => {
    if (!THEMES.some(theme => theme.id === themeId)) throw new Error('Unknown skin.');
    settings.themeId = themeId;
    saveSettings();
    return themeId;
  });
  ipcMain.handle('api:command', (_event, name, args) => command(name, args));
  const loadImage = async image => {
    if (image?.album && image?.artist && !image.proxy_id && !image.path && !image.releaseGroup && !image.release) {
      try {
        const escape = value => String(value).slice(0, 200).replace(/["\\]/g, ' ');
        const query = new URLSearchParams({ query: `releasegroup:"${escape(image.album)}" AND artist:"${escape(image.artist)}"`, fmt: 'json', limit: '10' });
        const response = await fetch(`https://musicbrainz.org/ws/2/release-group/?${query}`, {
          headers: { 'User-Agent': 'Decksona/0.1 (desktop music player)' }, signal: AbortSignal.timeout(12000)
        });
        if (!response.ok) return null;
        const data = await response.json();
        const normalize = value => String(value).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
        const match = data['release-groups']?.find(group => group['primary-type'] === 'Album'
          && normalize(group.title) === normalize(image.album)
          && group['artist-credit']?.some(credit => normalize(credit.artist?.name) === normalize(image.artist)));
        if (!match) return null;
        image = { releaseGroup: match.id };
      } catch { return null; }
    }
    const proxyId = String(image?.proxy_id || '');
    const provider = String(image?.provider || '');
    const imagePath = String(image?.path || '');
    const mbid = String(image?.releaseGroup || image?.release || '');
    const archiveImage = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(mbid);
    let imageUrl;
    if (archiveImage) {
      imageUrl = `https://coverartarchive.org/${image.releaseGroup ? 'release-group' : 'release'}/${mbid}/front-250`;
    } else if (/^[a-f0-9]{64}$/i.test(proxyId)) {
      imageUrl = `${settings.serverUrl}/imageproxy/${proxyId}`;
    } else if (provider && provider.length < 200 && imagePath && imagePath.length < 4096) {
      const query = new URLSearchParams({ provider, path: imagePath, size: '512' });
      imageUrl = `${settings.serverUrl}/imageproxy?${query}`;
    } else {
      return null;
    }
    try {
      const response = await fetch(imageUrl, { headers: archiveImage ? {} : { Authorization: `Bearer ${sessionToken}` }, signal: AbortSignal.timeout(12000) });
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.startsWith('image/')) {
        return null;
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 5_000_000) return null;
      return `data:${contentType};base64,${bytes.toString('base64')}`;
    } catch (error) {
      return null;
    }
  };
  ipcMain.handle('api:image', (_event, image) => loadImage(image));
  ipcMain.handle('api:artistImage', async (_event, artists) => {
    if (!Array.isArray(artists)) return null;
    for (const artist of artists.slice(0, 5)) {
      try {
        let full = artist;
        const initial = [...(artist.metadata?.images || []), ...(artist.image ? [artist.image] : [])];
        for (const image of initial.filter(Boolean).sort((a, b) => Number(b.type === 'thumb') - Number(a.type === 'thumb'))) {
          const src = await loadImage(image);
          if (src) return { src, artist: artist.name };
        }
        if (typeof artist.uri === 'string' && /^[^:]+:\/\/artist\//.test(artist.uri)) {
          full = await command('itemByUri', { uri: artist.uri });
          for (const image of (full.metadata?.images || []).filter(Boolean).sort((a, b) => Number(b.type === 'thumb') - Number(a.type === 'thumb'))) {
            const src = await loadImage(image);
            if (src) return { src, artist: full.name || artist.name };
          }
        }
      } catch { /* Try the next credited artist. */ }
    }
    for (const artist of artists.slice(0, 5)) {
      if (typeof artist?.name !== 'string' || !artist.name.trim() || /unknown/i.test(artist.name)) continue;
      const key = JSON.stringify([artist.name.trim().toLowerCase(), artist.external_ids || []]);
      if (!portraitCache.has(key)) portraitCache.set(key, fetchPortrait(artist));
      const portrait = await portraitCache.get(key);
      if (portrait) return portrait;
    }
    return null;
  });
  ipcMain.handle('artwork:source', (_event, url) => {
    if (typeof url === 'string' && url.startsWith('https://en.wikipedia.org/wiki/')) return shell.openExternal(url);
  });
  ipcMain.handle('layout:setCompact', (_event, compact) => {
    if (!playerWindow || playerWindow.isDestroyed()) return;
    const mode = compact === 'mini' ? 'mini' : compact ? 'compact' : 'full';
    if (windowMode === 'full' && mode !== 'full') expandedBounds = playerWindow.getBounds();
    if (playerWindow.isMaximized()) playerWindow.unmaximize();
    playerWindow.setMenuBarVisibility(mode !== 'mini');
    playerWindow.setMinimumSize(mode === 'mini' ? 316 : 530, mode === 'mini' ? 500 : 320);
    if (mode === 'mini') playerWindow.setBounds({ width: 316, height: 519 });
    else if (mode === 'compact') playerWindow.setContentSize(590, 340);
    else if (expandedBounds) playerWindow.setBounds(expandedBounds);
    windowMode = mode;
    return { mode, bounds: playerWindow.getBounds() };
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
