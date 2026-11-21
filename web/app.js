const $ = id => document.getElementById(id);
const WEB_BUILD = 'radio-5';
let availableBuild = '';
async function checkForUpdate() {
  try {
    const response = await fetch(`version.json?check=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return;
    const version = await response.json();
    if (typeof version.build !== 'string' || version.build === WEB_BUILD) return;
    availableBuild = version.build;
    $('updateNotice').hidden = false;
  } catch { /* A temporary network outage must not interrupt playback. */ }
}
const commands = {
  players: 'players/all', queues: 'player_queues/all', items: 'player_queues/items', search: 'music/search',
  radioStations: 'music/radios/library_items', addRadio: 'builtin/add_radio',
  playPause: 'player_queues/play_pause', stop: 'player_queues/stop', next: 'player_queues/next', previous: 'player_queues/previous',
  seek: 'player_queues/seek', skip: 'player_queues/skip', playIndex: 'player_queues/play_index', playMedia: 'player_queues/play_media',
  moveItem: 'player_queues/move_item', transfer: 'player_queues/transfer', itemByUri: 'music/item_by_uri', artistAlbums: 'music/artists/artist_albums',
  genreArtists: 'music/artists/library_items', genreAlbums: 'music/genres/albums', albumTracks: 'music/albums/album_tracks', shuffle: 'player_queues/shuffle', repeat: 'player_queues/repeat', volume: 'players/cmd/volume_set'
};
const state = { base: '', token: '', socket: null, opening: null, serial: 0, pending: new Map(), playerId: '', players: [], queues: [], queue: null, player: null, items: [], results: [], filters: new Set(['track','album','playlist','artist','genre']), history: [], browseLabel: '', refreshing: false, seeking: false, theme: 'phosphor-glass', messageTimer: 0 };
let browseRevision = 0, genreBrowseItem = null, genreBrowseMode = 'artists', genreBrowseAtRoot = false;
let hideOfflinePlayers = localStorage.getItem('decksona.hideOfflinePlayers') === 'true';
function phoneClientId() { return phoneAudio?.clientId || localStorage.getItem('decksona.phonePlayerId') || ''; }
function phonePlayerId() { return window.DECKSONA_LOCAL_PLAYER.localPlayerId(state.players, phoneClientId()); }
let phoneAudioState = 'connecting';
let phoneAudioDetail = '';
function renderPhoneAudioStatus() {
  const local = window.DECKSONA_LOCAL_PLAYER.findLocalPlayer(state.players, phoneClientId());
  const labels = { disabled: 'Phone audio is off. Tap to enable it.', connecting: 'Connecting phone audio… Approve the Decksona player in Music Assistant if setup is required.', ready: 'This phone is ready · speaker or headphones', reconnecting: 'Phone audio is reconnecting. Tap Resume if sound does not return.', pairing: phoneAudioDetail, error: phoneAudioDetail };
  let text = labels[phoneAudioState] || phoneAudioDetail;
  if (phoneAudioState === 'ready') {
    if (!local) text = 'Audio connected · waiting for Music Assistant to register this phone.';
    else if (local.needs_setup) text = 'Phone audio needs approval in Music Assistant’s player setup.';
    else if (local.available === false) text = 'Audio connected · Music Assistant currently reports this phone unavailable.';
  }
  $('phoneAudioStatus').textContent = text;
}
const phoneAudio = window.createPhoneAudio?.({
  onStatus: ({ status, detail }) => {
    phoneAudioState = status;
    phoneAudioDetail = detail;
    $('phoneAudioButton').textContent = status === 'disabled' ? 'LISTEN ON THIS DEVICE' : 'RESUME DEVICE AUDIO';
    if (status === 'error' || status === 'pairing') say(detail, status === 'error');
    renderOutput();
    if (status === 'disabled' && navigator.mediaSession) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
      for (const action of ['play','pause','stop','nexttrack','previoustrack','seekto','seekbackward','seekforward']) {
        try { navigator.mediaSession.setActionHandler(action, null); } catch {}
      }
    }
  },
  onMediaState: local => {
    if (!navigator.mediaSession) return;
    const metadata = local.serverState?.metadata;
    if (metadata && typeof MediaMetadata !== 'undefined') {
      navigator.mediaSession.metadata = new MediaMetadata({ title: metadata.title || 'Decksona', artist: metadata.artist || '', album: metadata.album || '' });
    }
    navigator.mediaSession.playbackState = local.isPlaying ? 'playing' : 'paused';
  },
});

function installPhoneMediaControls() {
  if (!navigator.mediaSession) return;
  const send = (command, params) => {
    try { phoneAudio.sendCommand(command, params); } catch (error) { say(error.message, true); }
  };
  const actions = {
    play: () => { phoneAudio.unlock()?.catch(error => say(error.message, true)); send('play'); },
    pause: () => send('pause'), stop: () => send('stop'),
    nexttrack: () => send('next'), previoustrack: () => send('previous'),
    seekto: event => send('seek', { position_ms: Math.round(event.seekTime * 1000) }),
    seekbackward: event => send('seek_relative', { offset_ms: -(event.seekOffset || 10) * 1000 }),
    seekforward: event => send('seek_relative', { offset_ms: (event.seekOffset || 10) * 1000 }),
  };
  for (const [action, handler] of Object.entries(actions)) {
    try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* unsupported control */ }
  }
}

async function listenOnPhone() {
  if (!phoneAudio) { say('Phone audio could not load. Reload Decksona.', true); return; }
  if (!state.base || !state.token) { $('settingsOpen').click(); return; }
  try {
    // start() calls unlock() synchronously from this click, before any await.
    const connecting = phoneAudio.start(state.base, $('phoneSendspinUrl').value);
    localStorage.setItem('decksona.sendspinUrl', $('phoneSendspinUrl').value.trim());
    localStorage.setItem('decksona.phonePlayerId', phoneAudio.clientId);
    state.playerId = phonePlayerId();
    localStorage.setItem('decksona.playerId', state.playerId);
    localStorage.setItem('decksona.phoneAudio', 'true');
    state.queue = null; state.player = null; state.items = [];
    renderOutput(); renderPlayer(); renderQueue();
    installPhoneMediaControls();
    await connecting;
    await refresh();
  } catch (error) { $('phoneAudioStatus').textContent = error.message; say(error.message, true); }
}

function stopPhoneAudio() {
  const id = phonePlayerId();
  phoneAudio?.stop();
  localStorage.removeItem('decksona.phoneAudio');
  if (id && state.playerId === id) {
    state.playerId = ''; state.player = null; state.queue = null; state.items = [];
    localStorage.removeItem('decksona.playerId');
  }
  renderOutput(); renderPlayer(); renderQueue();
}

function say(text, error = false) {
  const node = $('message'); node.textContent = text; node.classList.toggle('error', error); node.classList.add('visible');
  clearTimeout(state.messageTimer); state.messageTimer = setTimeout(() => node.classList.remove('visible'), error ? 6500 : 2600);
}
function normalizeBase(value) {
  const url = new URL(String(value).trim());
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Enter the Music Assistant server address, without /api or /ws.');
  return url.href.replace(/\/$/, '');
}
function request(command, args = {}) {
  if (!state.socket || state.socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error('Not connected to Music Assistant.'));
  const message_id = String(++state.serial);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { state.pending.delete(message_id); reject(new Error('Music Assistant did not respond in time.')); }, [commands.artistAlbums, commands.genreArtists, commands.genreAlbums, commands.albumTracks, commands.addRadio].includes(command) ? 30000 : 15000);
    state.pending.set(message_id, { resolve, reject, timer });
    try { state.socket.send(JSON.stringify({ message_id, command, args })); }
    catch (error) { clearTimeout(timer); state.pending.delete(message_id); reject(error); }
  });
}
function socketUrl(base) { return base.replace(/^http:/i,'ws:').replace(/^https:/i,'wss:') + '/ws'; }
function openConnection(base, token) {
  if (state.opening) return state.opening;
  state.opening = new Promise((resolve, reject) => {
    let settled = false;
    const fail = error => { if (settled) return; settled = true; state.opening = null; reject(error); };
    const socket = new WebSocket(socketUrl(base)); state.socket = socket;
    const timer = setTimeout(() => { try { socket.close(); } catch {} fail(new Error('Could not reach Music Assistant. Check the address and that this device is on your home Wi-Fi.')); }, 15000);
    socket.addEventListener('open', async () => {
      try {
        await request('auth', { token });
        clearTimeout(timer); settled = true; state.opening = null; resolve();
      } catch (error) { clearTimeout(timer); fail(error); try { socket.close(); } catch {} }
    }, { once: true });
    socket.addEventListener('message', event => {
      let msg; try { msg = JSON.parse(event.data); } catch { return; }
      if (!msg.message_id) return; // server info and player events are refreshed below
      const waiting = state.pending.get(String(msg.message_id)); if (!waiting) return;
      clearTimeout(waiting.timer); state.pending.delete(String(msg.message_id));
      if (msg.error || msg.error_code) waiting.reject(new Error(msg.details || msg.error?.message || 'Music Assistant rejected the request.'));
      else waiting.resolve(msg.result);
    });
    socket.addEventListener('error', () => { if (!settled) { clearTimeout(timer); fail(new Error('Could not reach Music Assistant. Check the server address and Wi-Fi.')); } });
    socket.addEventListener('close', () => {
      if (!settled) { clearTimeout(timer); fail(new Error('Music Assistant closed the connection. Check the address and token.')); }
      if (state.socket === socket) {
        for (const [,waiting] of state.pending) { clearTimeout(waiting.timer); waiting.reject(new Error('Connection to Music Assistant was lost.')); }
        state.pending.clear(); state.socket = null;
        $('connection').textContent = 'OFFLINE'; $('connection').classList.remove('online');
      }
    });
  });
  return state.opening;
}
async function connect(baseValue, tokenValue) {
  const base = normalizeBase(baseValue); const token = String(tokenValue || state.token).trim();
  if (!token) throw new Error('Enter a long-lived Music Assistant token.');
  if (state.base && state.base !== base) stopPhoneAudio();
  for (const [,waiting] of state.pending) { clearTimeout(waiting.timer); waiting.reject(new Error('Connection changed.')); }
  state.pending.clear(); if (state.socket) { const old=state.socket; state.socket=null; try { old.close(); } catch {} }
  state.base = base; state.token = token;
  await openConnection(base, token);
  state.playerId = localStorage.getItem('decksona.playerId') || '';
  localStorage.setItem('decksona.server', base); localStorage.setItem('decksona.token', token);
  $('token').value = ''; $('settingsDialog').close();
  $('connection').textContent = 'CONNECTED'; $('connection').classList.add('online');
  say('CONNECTED'); await refresh();
}
async function ensureConnection() {
  if (state.socket?.readyState === WebSocket.OPEN) return;
  if (!state.base || !state.token) return;
  try { await openConnection(state.base, state.token); $('connection').textContent='CONNECTED'; $('connection').classList.add('online'); }
  catch (error) { $('connection').textContent='RECONNECTING'; throw error; }
}

function media(item) { return item?.media_item || item || {}; }
function trackName(item) { return item?.name || media(item)?.name || 'Unknown title'; }
function knownArtist(value) { return value && !/^\[?unknown(?: artist)?\]?$/i.test(String(value).trim()); }
function artists(item) {
  const value = media(item); const entries = (value.artists || []).map(entry => typeof entry === 'string' ? {name:entry} : entry).filter(entry => knownArtist(entry?.name));
  if (entries.length) return entries;
  if (knownArtist(value.artist?.name)) return [value.artist];
  if (isRadio(item)) return [];
  const name = String(value.name || '').replace(/^\[unknown\]\s*-\s*/i,''); const split = name.indexOf(' - ');
  return split > 0 && knownArtist(name.slice(0,split)) ? [{name:name.slice(0,split)}] : [];
}
function artistName(item) { return artists(item).map(entry => entry.name).join(', ') || (isRadio(item) ? 'Live radio' : 'Unknown artist'); }
function isRadio(item) { return media(item).media_type === 'radio'; }
function albumName(item) { const a=media(item).album; return typeof a==='string' ? a : a?.name || media(item).album_name || ''; }
function seconds(item) { return isRadio(item) ? 0 : [item?.duration,media(item)?.duration,item?.streamdetails?.duration].map(Number).find(n=>Number.isFinite(n)&&n>0)||0; }
function fmt(value) { const n=Math.max(0,Math.floor(Number(value)||0)); return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`; }
function elapsed() { const q=state.queue; const base=Number(q?.elapsed_time)||0; const at=Number(q?.elapsed_time_last_updated)||0; return Math.max(0,base+(q?.state==='playing'&&at?Date.now()/1000-at:0)); }
function renderProgress() {
  const total=seconds(state.queue?.current_item); const current=Math.min(total||Infinity,elapsed());
  $('elapsed').textContent=fmt(current); $('duration').textContent=isRadio(state.queue?.current_item)?'LIVE':total?fmt(total):'--:--';
  if (!state.seeking) $('seek').value=total?Math.round(current/total*1000):0;
  $('seek').disabled=!total||!state.queue?.active;
  for (const button of document.querySelectorAll('[data-seconds]')) button.disabled = isRadio(state.queue?.current_item);
}
function applyTheme(id) {
  const theme=window.DECKSONA_THEMES?.find(entry=>entry.id===id)||window.DECKSONA_THEMES?.find(entry=>entry.id==='phosphor-glass'); if(!theme)return;
  state.theme=theme.id; const root=document.documentElement;
  window.DECKSONA_SKINS.apply(root,theme);
  const patterns={glass:'linear-gradient(125deg,#fff2,transparent 35%,#fff1 75%,transparent)',scanline:'repeating-linear-gradient(0deg,transparent 0 3px,#ffffff12 3px 4px)',circuit:'repeating-linear-gradient(90deg,transparent 0 34px,#ffffff12 34px 35px),repeating-linear-gradient(0deg,transparent 0 26px,#ffffff12 26px 27px)',grid:'repeating-linear-gradient(90deg,transparent 0 14px,#ffffff10 14px 15px),repeating-linear-gradient(0deg,transparent 0 14px,#ffffff10 14px 15px)',diagonal:'repeating-linear-gradient(135deg,transparent 0 7px,#ffffff12 7px 8px,transparent 8px 15px)',carbon:'repeating-linear-gradient(45deg,transparent 0 5px,#ffffff12 5px 7px,transparent 7px 12px)'};
  root.style.setProperty('--pattern',patterns[theme.pattern]||'none'); localStorage.setItem('decksona.theme',theme.id);
  $('skinSelect').value=theme.id;
  document.querySelectorAll('.theme-card').forEach(card=>{const active=card.dataset.themeId===theme.id;card.classList.toggle('selected',active);card.setAttribute('aria-pressed',String(active));});
  $('activeSkinName').textContent=theme.name;
}
function initSkins() {
  const select=$('skinSelect'),grid=$('themeGrid');
  for(const signature of [true,false]) {
    const group=document.createElement('optgroup');group.label=signature?'Listening rooms · 21 signature designs':'Classic palettes · 36 original skins';
    const heading=document.createElement('h3');heading.className='theme-group-label';heading.textContent=group.label;grid.append(heading);
    for(const theme of window.DECKSONA_THEMES||[]) if(Boolean(theme.signature)===signature) {
      group.append(new Option(theme.name,theme.id));
      grid.append(window.DECKSONA_SKINS.createCard(document,theme,()=>applyTheme(theme.id)));
    }
    select.append(group);
  }
  $('skinCount').textContent=`${window.DECKSONA_THEMES?.length||0} SKINS`;
  applyTheme(localStorage.getItem('decksona.theme')||'phosphor-glass');
}
function imageCandidates(item) {
  const value=media(item); const images=[...(value.metadata?.images||[]),...(value.images||[]),...(value.album?.metadata?.images||[])];
  const preferred=images.find(img=>img.type==='thumb'&&(img.proxy_id||img.provider&&img.path))||images.find(img=>img.proxy_id||img.provider&&img.path);
  if(preferred?.proxy_id) return [`${state.base}/imageproxy/${encodeURIComponent(preferred.proxy_id)}?size=512`];
  if(preferred?.provider&&preferred.path){const params=new URLSearchParams({provider:preferred.provider,path:preferred.path,size:'512'});return [`${state.base}/imageproxy?${params}`];}
  const ids=value.album?.external_ids||[]; const rg=ids.find(pair=>pair[0]==='musicbrainz_releasegroupid')?.[1]; const rel=ids.find(pair=>pair[0]==='musicbrainz_albumid')?.[1];
  if(rg) return [`https://coverartarchive.org/release-group/${encodeURIComponent(rg)}/front-500`];
  if(rel) return [`https://coverartarchive.org/release/${encodeURIComponent(rel)}/front-500`];
  return [];
}
async function artworkFor(item) {
  const candidates=imageCandidates(item); if(candidates.length)return candidates[0];
  for(const credit of artists(item).slice(0,4)){
    const direct=[...(credit.metadata?.images||[]),...(credit.image?[credit.image]:[])].find(image=>image?.proxy_id||image?.provider&&image?.path);
    if(direct?.proxy_id)return `${state.base}/imageproxy/${encodeURIComponent(direct.proxy_id)}?size=512`;
    if(direct?.provider&&direct.path){const params=new URLSearchParams({provider:direct.provider,path:direct.path,size:'512'});return `${state.base}/imageproxy?${params}`;}
    if(typeof credit.uri==='string'&&/^[^:]+:\/\/artist\//.test(credit.uri)){
      try{const full=await request(commands.itemByUri,{uri:credit.uri});const image=(full?.metadata?.images||[]).find(entry=>entry?.proxy_id||entry?.provider&&entry?.path);if(image?.proxy_id)return `${state.base}/imageproxy/${encodeURIComponent(image.proxy_id)}?size=512`;if(image?.provider&&image.path){const params=new URLSearchParams({provider:image.provider,path:image.path,size:'512'});return `${state.base}/imageproxy?${params}`;}}catch{}
    }
  }
  const a=albumName(item); const artist=artistName(item);
  if(a&&artist!=='Unknown artist')try {
    const params=new URLSearchParams({query:`releasegroup:"${a.slice(0,100)}" AND artist:"${artist.slice(0,100)}"`,fmt:'json',limit:'8'});
    const response=await fetch(`https://musicbrainz.org/ws/2/release-group/?${params}`);
    if(response.ok){const data=await response.json();const norm=s=>String(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
      const match=data['release-groups']?.find(entry=>entry['primary-type']==='Album'&&norm(entry.title)===norm(a)&&entry['artist-credit']?.some(c=>norm(c.artist?.name)===norm(artist.split(',')[0])));
      if(match)return `https://coverartarchive.org/release-group/${match.id}/front-500`;}
  } catch {}
  for(const credit of artists(item).slice(0,4)){const portrait=await musicBrainzPortrait(credit);if(portrait)return portrait;}
  return '';
}
async function musicBrainzPortrait(credit){
  try{
    const normalize=value=>String(value).toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
    const ext=credit.external_ids||[];let id=Array.isArray(ext)?ext.find(pair=>pair[0]==='musicbrainz_artistid')?.[1]:ext.musicbrainz_artistid;
    const getJson=async url=>{const response=await fetch(url);if(!response.ok)throw new Error('Metadata lookup failed');return response.json();};
    if(!id){const params=new URLSearchParams({query:`artist:"${credit.name.slice(0,100)}"`,fmt:'json',limit:'10'});const result=await getJson(`https://musicbrainz.org/ws/2/artist/?${params}`);const matches=(result.artists||[]).filter(entry=>Number(entry.score)===100&&normalize(entry.name)===normalize(credit.name));if(matches.length!==1)return '';id=matches[0].id;}
    const record=await getJson(`https://musicbrainz.org/ws/2/artist/${encodeURIComponent(id)}?inc=url-rels&fmt=json`);let title;
    const wiki=record.relations?.find(rel=>rel.type==='wikipedia'&&/^https?:\/\/en\.wikipedia\.org\/wiki\//.test(rel.url?.resource||''));
    if(wiki)title=decodeURIComponent(new URL(wiki.url.resource).pathname.slice('/wiki/'.length));
    if(!title){const q=record.relations?.find(rel=>rel.type==='wikidata')?.url?.resource?.match(/\/wiki\/(Q\d+)$/)?.[1];if(q){const entity=await getJson(`https://www.wikidata.org/wiki/Special:EntityData/${q}.json`);title=entity.entities?.[q]?.sitelinks?.enwiki?.title;}}
    if(!title)return '';const summary=await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g,'_'))}`);
    const image=summary.thumbnail?.source||summary.originalimage?.source;return image&&new URL(image).hostname==='upload.wikimedia.org'?image:'';
  }catch{return '';}
}
async function renderArtwork(item, liveImage) {
  const img=$('cover'); const revision=JSON.stringify([item?.queue_item_id||item?.uri||item?.name,liveImage]);
  if(!item){delete img.dataset.item;img.hidden=true;img.removeAttribute('src');return;}
  if(img.dataset.item===revision)return;
  img.dataset.item=revision;
  img.hidden=true;
  img.onload=null;
  img.onerror=null;
  img.removeAttribute('src');
  const src=await window.loadRadioArtwork(liveImage)||await artworkFor(item);
  if(img.dataset.item!==revision)return;
  if(src){img.onload=()=>{img.hidden=false};img.onerror=()=>{img.hidden=true};img.src=src;}
}
function renderPlayer() {
  const q=state.queue; const current=q?.current_item;
  const live=window.radioNowPlaying(current,state.player?.current_media);
  $('trackTitle').textContent=current?(live?.title||trackName(current)):'NOTHING PLAYING';
  $('trackArtist').textContent=current?(live?.artist||artistName(current)):'Search your library and press play'; $('trackAlbum').textContent=live?.album||albumName(current);
  $('playerState').textContent=q?.state?String(q.state).toUpperCase():'READY';
  const playing=q?.state==='playing';
  $('playPause').innerHTML=playing?'<svg class="playback-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h5v16H5zM14 4h5v16h-5z"/></svg>':'<svg class="playback-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>';
  $('playPause').setAttribute('aria-label',playing?'Pause':'Play');
  $('shuffle').textContent=`SHUFFLE ${q?.shuffle_enabled?'ON':'OFF'}`; $('shuffle').classList.toggle('active',Boolean(q?.shuffle_enabled)); $('shuffle').setAttribute('aria-pressed',String(Boolean(q?.shuffle_enabled)));
  const repeat=q?.repeat_mode||'off'; $('repeat').textContent=`REPEAT ${repeat.toUpperCase()}`; $('repeat').classList.toggle('active',repeat!=='off');
  const vol=state.player?.volume_level; if(Number.isFinite(vol)&&document.activeElement!==$('volume'))$('volume').value=vol;
  $('volumeValue').textContent=Number.isFinite(vol)?String(vol):'--'; $('volume').disabled=!state.player||vol==null;
  renderProgress(); renderArtwork(current,window.radioArtworkUrl(live?.imageUrl,state.base));
  const next=state.items.find(item=>item.queue_item_id!==current?.queue_item_id); $('nextTitle').textContent=next?`${trackName(next)} · ${artistName(next)}`:'Queue is empty';
}
function renderOutput() {
  renderPhoneAudioStatus();
  const select=$('playerSelect'); const old=state.playerId; select.replaceChildren(new Option(state.connected?'Select a player':'Connect to Music Assistant',''));
  const local=window.DECKSONA_LOCAL_PLAYER.findLocalPlayer(state.players,phoneClientId());
  for(const p of window.DECKSONA_LOCAL_PLAYER.orderedPlayers(state.players,phoneClientId(),hideOfflinePlayers)) select.add(new Option(`${p===local?'This phone · Decksona':p.name}${p.needs_setup?' · SETUP REQUIRED':p.available===false?' · OFFLINE':''}`,p.player_id));
  if(phonePlayerId() && !state.players.some(p=>p.player_id===phonePlayerId())) {
    const label={connecting:'connecting…',ready:'registering with server…',reconnecting:'reconnecting…',pairing:'pairing required · see Settings',error:'unavailable · see Settings'}[phoneAudioState]||'unavailable · see Settings';
    const pending=new Option(phoneAudio?.clientId?`This phone · ${label}`:'This phone · tap Listen to enable',phonePlayerId());pending.disabled=true;select.add(pending,1);
  }
  select.value=old;
}
function row(item,index,kind) {
  const el=document.createElement('div'); el.className='list-row';
  if(kind==='queue'&&item.queue_item_id===state.queue?.current_item?.queue_item_id)el.classList.add('current');
  const num=document.createElement('span');num.className='row-index';num.textContent=String(index+1).padStart(2,'0');
  const info=document.createElement('span');info.className='row-info';const name=document.createElement('span');name.className='row-name';name.textContent=trackName(item);const sub=document.createElement('span');sub.className='row-sub';
  sub.textContent=item.media_type==='artist'?'View albums':albumName(item)?`${artistName(item)} · ${albumName(item)}`:artistName(item);info.append(name,sub);el.append(num,info);
  const time=document.createElement('span');time.className='row-time';time.textContent=kind==='results'?String(item.media_type||'track').toUpperCase():(seconds(item)?fmt(seconds(item)):'--:--');el.append(time);
  const buttons=document.createElement('span');buttons.className='row-buttons';
  if(kind==='results'){
    if(item.media_type==='artist'||item.media_type==='album'||item.media_type==='genre'){
      const label=item.media_type==='artist'?'Show albums':item.media_type==='genre'?'Browse genre':'Show songs';
      const open=document.createElement('button');open.className='browse-button';open.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h12M9 12h12M9 18h12M3 6h.01M3 12h.01M3 18h.01"/></svg>';open.setAttribute('aria-label',label);open.title=label;open.addEventListener('click',()=>browseItem(item));buttons.append(open);
    }
    if(item.media_type!=='artist'&&item.media_type!=='genre'){
      const add=document.createElement('button');add.textContent='+';add.setAttribute('aria-label','Add to queue');add.addEventListener('click',()=>playMedia(item,'add'));
      if(item.media_type==='track'){el.addEventListener('click',event=>{if(!event.target.closest('button'))playMedia(item,'replace');});el.addEventListener('dblclick',()=>playMedia(item,'replace'));}
      buttons.append(add);
    }
    if(item.media_type==='artist'||item.media_type==='album'||item.media_type==='genre')el.addEventListener('click',event=>{if(!event.target.closest('button'))browseItem(item)});
  }else{
    const first=firstMovableIndex(state.queue); const locked=index<first;
    for(const [text,shift] of [['↑',-1],['↓',1]]){const button=document.createElement('button');button.textContent=text;button.disabled=locked||index+shift<first||index+shift>=state.items.length;button.setAttribute('aria-label',`Move ${text==='↑'?'up':'down'}`);button.addEventListener('click',()=>moveItem(item,shift));buttons.append(button);}
    el.addEventListener('dblclick',()=>act('playIndex',{queue_id:state.playerId,index:item.queue_item_id||index}));
  }
  if(buttons.childNodes.length)el.append(buttons);return el;
}
function renderList(target,items,kind,empty) {
  const node=$(target);node.replaceChildren();if(!items.length){const e=document.createElement('div');e.className='empty';e.textContent=empty;node.append(e);return;}
  const frag=document.createDocumentFragment();items.forEach((item,i)=>frag.append(row(item,i,kind)));node.append(frag);
}
function renderQueue(){ sessions.update(); const count=state.items.length;$('queueCount').textContent=`${count} ITEMS`;$('tabQueueCount').textContent=`(${count})`;document.querySelector('.tab[data-page="queuePage"]').setAttribute('aria-label',`Queue, ${count} ${count===1?'song':'songs'}`);renderList('queueList',state.items,'queue',state.connected?'The queue is empty.':'Connect to see the queue.'); }
async function refresh() {
  if(state.refreshing||!state.base||!state.token)return;state.refreshing=true;
  let refreshPlayerId=state.playerId;
  try{
    await ensureConnection(); const [players,queues]=await Promise.all([request(commands.players),request(commands.queues)]);
    if(state.playerId!==refreshPlayerId)return;
    state.players=Array.isArray(players)?players:[];state.queues=Array.isArray(queues)?queues:[];
    if(state.playerId===phoneClientId())state.playerId=phonePlayerId();
    if(!state.playerId||(!state.players.some(p=>p.player_id===state.playerId)&&state.playerId!==phonePlayerId()))state.playerId=state.players.find(p=>p.available!==false)?.player_id||state.players[0]?.player_id||'';
    refreshPlayerId=state.playerId;
    const player=state.players.find(p=>p.player_id===refreshPlayerId)||null,queue=state.queues.find(q=>q.queue_id===refreshPlayerId)||null;
    const items=queue?await request(commands.items,{queue_id:refreshPlayerId,limit:200,offset:0}):[];
    if(state.playerId!==refreshPlayerId)return;
    state.player=player;state.queue=queue;state.items=Array.isArray(items)?items:[];
    state.connected=true;localStorage.setItem('decksona.playerId',state.playerId);$('connection').textContent='CONNECTED';$('connection').classList.add('online');renderOutput();renderPlayer();renderQueue();
  }catch(error){state.connected=false;$('connection').textContent='RECONNECTING';$('connection').classList.remove('online');if(!document.hidden)say(error.message,true);}
  finally{state.refreshing=false;if(state.playerId!==refreshPlayerId)await refresh();}
}
async function act(name,args={}) {
  if(!state.playerId){say('SELECT A PLAYER FIRST',true);return;}
  if(state.playerId===phonePlayerId()&&(!phoneAudio?.clientId||!state.player?.available||state.player?.needs_setup)){say('Tap Listen on this device first. If it stays unavailable, check Music Assistant player setup.',true);return;}
  try{if(state.playerId===phoneAudio?.clientId)await phoneAudio.unlock();await ensureConnection();await request(commands[name],args);await refresh();}catch(error){say(error.message,true);}
}
function firstMovableIndex(q){if(Number.isInteger(q?.index_in_buffer))return Math.max(q.index_in_buffer,q.current_index??-1)+1;return Math.max(0,q?.current_index??0);}
async function moveItem(item,shift){const queues=await request(commands.queues);const q=queues.find(entry=>entry.queue_id===state.playerId);const items=await request(commands.items,{queue_id:state.playerId,limit:200,offset:0});const index=items.findIndex(entry=>entry.queue_item_id===item.queue_item_id);const first=firstMovableIndex(q);if(index<first||index+shift<first){say('ONLY UPCOMING TRACKS CAN BE REORDERED');return;}try{await request(commands.moveItem,{queue_id:state.playerId,queue_item_id:item.queue_item_id,pos_shift:shift});say('QUEUE ORDER UPDATED');}catch(error){say(error.message,true);}finally{await refresh();}}
async function playMedia(item,option){if(!item.uri){say('THIS ITEM HAS NO PLAYABLE URI',true);return;}await act('playMedia',{queue_id:state.playerId,media:item.uri,option});}
function setBrowseFilters(types){state.filters=new Set(types);document.querySelectorAll('[data-filter]').forEach(button=>button.setAttribute('aria-pressed',String(state.filters.has(button.dataset.filter))));}
function browseNav(){ $('browseBar').hidden=!state.history.length;$('browseLabel').textContent=state.browseLabel;$('genreBrowseModes').hidden=!(genreBrowseAtRoot&&genreBrowseItem);$('genreArtists').setAttribute('aria-pressed',String(genreBrowseMode==='artists'));$('genreAlbums').setAttribute('aria-pressed',String(genreBrowseMode==='albums')); }
function saveBrowseState(){return{items:state.results,label:state.browseLabel,filters:[...state.filters],genreBrowseItem,genreBrowseMode,genreBrowseAtRoot};}
function genreIdFor(item){const uri=item.uri?.match(/^([^:]+):\/\/[^/]+\/(.+)$/);const id=Number(item.item_id||uri?.[2]);return Number.isSafeInteger(id)?id:null;}
async function loadGenreMode(mode,item=genreBrowseItem){
  if(!item)return;const genreId=genreIdFor(item);if(genreId===null){say('THIS GENRE HAS NO LIBRARY ID',true);return;}
  const revision=++browseRevision;const isArtists=mode==='artists';
  try{const result=await request(isArtists?commands.genreArtists:commands.genreAlbums,isArtists?{genre:genreId}:{item_id:String(genreId)});if(revision!==browseRevision)return;
    if(item!==genreBrowseItem)state.history.push(saveBrowseState());genreBrowseItem=item;genreBrowseMode=mode;genreBrowseAtRoot=true;setBrowseFilters([isArtists?'artist':'album']);
    state.browseLabel=`${trackName(item)} · ${isArtists?'ARTISTS':'ALBUMS'}`;state.results=(Array.isArray(result)?result:[]).map(entry=>({...entry,media_type:entry.media_type||(isArtists?'artist':'album')}));browseNav();renderList('results',state.results,'results',isArtists?'No artists found for this genre.':'No albums found for this genre.');$('resultCount').textContent=`${state.results.length} ${isArtists?'ARTISTS':'ALBUMS'}`;
  }catch(error){if(revision===browseRevision)say(error.message,true);}
}
async function browseItem(item){
  if(item.media_type==='genre'){await loadGenreMode('artists',item);return;}
  const isArtist=item.media_type==='artist';const uri=item.uri?.match(/^([^:]+):\/\/[^/]+\/(.+)$/);const id=item.item_id||uri?.[2];const provider=item.provider||uri?.[1];if(!id||!provider){say('THIS RESULT HAS NO BROWSE REFERENCE',true);return;}
  const revision=++browseRevision;
  try{const result=await request(isArtist?commands.artistAlbums:commands.albumTracks,{item_id:String(id),provider_instance_id_or_domain:provider});if(revision!==browseRevision)return;state.history.push(saveBrowseState());genreBrowseAtRoot=false;setBrowseFilters([isArtist?'album':'track']);state.browseLabel=`${trackName(item)} · ${isArtist?'ALBUMS':'SONGS'}`;state.results=(Array.isArray(result)?result:[]).map(entry=>({...entry,media_type:entry.media_type||(isArtist?'album':'track')}));browseNav();renderList('results',state.results,'results',isArtist?'No albums found.':'No songs found.');$('resultCount').textContent=`${state.results.length}`;}
  catch(error){if(revision===browseRevision)say(error.message,true);}
}
async function search(){
  const revision=++browseRevision;const query=$('searchInput').value.trim();state.history=[];state.browseLabel='';genreBrowseItem=null;genreBrowseMode='artists';genreBrowseAtRoot=false;browseNav();
  if(!state.filters.size){state.results=[];renderList('results',[],'results','Choose at least one search type.');return;}
  if(!query){state.results=[];renderList('results',[],'results','Search your Music Assistant library.');$('resultCount').textContent='';return;}
  try{const data=await request(commands.search,{search_query:query,media_types:[...state.filters],limit:30,library_only:false});if(revision!==browseRevision)return;const buckets={track:'tracks',album:'albums',playlist:'playlists',artist:'artists',genre:'genres'};state.results=[...state.filters].flatMap(type=>Array.isArray(data?.[buckets[type]])?data[buckets[type]]:[]);renderList('results',state.results,'results','No matches found.');$('resultCount').textContent=`${state.results.length} RESULTS`;}
  catch(error){if(revision===browseRevision)say(error.message,true);}
}

function showPage(id){document.querySelectorAll('.page').forEach(page=>page.classList.toggle('active',page.id===id));document.querySelectorAll('.tab').forEach(tab=>tab.classList.toggle('active',tab.dataset.page===id));if(id==='queuePage')refresh();}
document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>showPage(tab.dataset.page)));
$('openQueue').addEventListener('click',()=>showPage('queuePage'));
$('settingsOpen').addEventListener('click',()=>{if(state.base)$('serverUrl').value=state.base;$('token').required=!state.token;$('token').placeholder=state.token?'Saved on this device · leave blank to keep it':'Paste token';$('settingsDialog').showModal();});
$('settingsClose').addEventListener('click',()=>$('settingsDialog').close());
$('settingsForm').addEventListener('submit',async event=>{
  event.preventDefault();const button=$('connectButton');const errorNode=$('connectError');
  button.disabled=true;button.textContent='CONNECTING…';errorNode.hidden=true;
  try{await connect($('serverUrl').value,$('token').value);}
  catch(error){errorNode.textContent=error.message;errorNode.hidden=false;say(error.message,true);}
  finally{button.disabled=false;button.textContent='CONNECT';}
});
$('disconnect').addEventListener('click',()=>{stopPhoneAudio();localStorage.removeItem('decksona.server');localStorage.removeItem('decksona.token');localStorage.removeItem('decksona.playerId');state.base='';state.token='';state.playerId='';state.connected=false;if(state.socket)state.socket.close();$('settingsDialog').close();$('connection').textContent='OFFLINE';renderOutput();renderPlayer();renderQueue();say('DISCONNECTED · TOKEN REMOVED');});
$('phoneAudioButton').addEventListener('click',listenOnPhone);
$('stopPhoneAudio').addEventListener('click',stopPhoneAudio);
$('skinSelect').addEventListener('change',event=>applyTheme(event.target.value));
$('skinsOpen').addEventListener('click',()=>$('themesDialog').showModal());
$('skinsClose').addEventListener('click',()=>$('themesDialog').close());
$('searchForm').addEventListener('submit',event=>{event.preventDefault();search();});
window.installRadioLibrary({
  command: async (name, args) => {
    await ensureConnection();
    return request(commands[name], args);
  },
  play: station => playMedia(station, 'replace')
});
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{const type=button.dataset.filter;if(state.filters.has(type))state.filters.delete(type);else state.filters.add(type);button.setAttribute('aria-pressed',String(state.filters.has(type)));search();}));
$('browseBack').addEventListener('click',()=>{++browseRevision;const previous=state.history.pop();if(!previous)return;state.results=previous.items;state.browseLabel=previous.label;genreBrowseItem=previous.genreBrowseItem||null;genreBrowseMode=previous.genreBrowseMode||'artists';genreBrowseAtRoot=Boolean(previous.genreBrowseAtRoot);setBrowseFilters(previous.filters||[...state.filters]);browseNav();renderList('results',state.results,'results','No results.');$('resultCount').textContent=`${state.results.length} RESULTS`;});
$('genreArtists').addEventListener('click',()=>loadGenreMode('artists'));
$('genreAlbums').addEventListener('click',()=>loadGenreMode('albums'));
$('playerSelect').addEventListener('change',async event=>{await selectSessionPlayer(event.target.value);});
$('hideOfflinePlayers').checked=hideOfflinePlayers;
$('hideOfflinePlayers').addEventListener('change',async event=>{hideOfflinePlayers=event.target.checked;localStorage.setItem('decksona.hideOfflinePlayers',String(hideOfflinePlayers));if(hideOfflinePlayers&&state.players.find(player=>player.player_id===state.playerId)?.available===false)await selectSessionPlayer('');renderOutput();});
for(const button of document.querySelectorAll('[data-command]'))button.addEventListener('click',()=>act(button.dataset.command,{queue_id:state.playerId}));
for(const button of document.querySelectorAll('[data-seconds]'))button.addEventListener('click',()=>act('skip',{queue_id:state.playerId,seconds:Number(button.dataset.seconds)}));
$('playPause').addEventListener('click',()=>act('playPause',{queue_id:state.playerId}));
$('shuffle').addEventListener('click',()=>act('shuffle',{queue_id:state.playerId,shuffle_enabled:!state.queue?.shuffle_enabled}));
$('repeat').addEventListener('click',()=>{const next={off:'all',all:'one',one:'off'}[state.queue?.repeat_mode||'off'];act('repeat',{queue_id:state.playerId,repeat_mode:next});});
$('seek').addEventListener('input',()=>{state.seeking=true;});$('seek').addEventListener('change',()=>{state.seeking=false;const total=seconds(state.queue?.current_item);if(total)act('seek',{queue_id:state.playerId,position:Math.round(total*Number($('seek').value)/1000)});});
$('volume').addEventListener('change',()=>act('volume',{player_id:state.playerId,volume_level:Number($('volume').value)}));

function init(){
  initSkins();$('hideOfflinePlayers').checked=hideOfflinePlayers;const base=localStorage.getItem('decksona.server')||'';const token=localStorage.getItem('decksona.token')||'';
  $('phoneSendspinUrl').value=localStorage.getItem('decksona.sendspinUrl')||'';
  if(localStorage.getItem('decksona.phoneAudio'))$('phoneAudioStatus').textContent='Tap Listen on this device to enable audio again. Safari requires a tap after reopening.';
  state.playerId=localStorage.getItem('decksona.playerId')||'';
  if(base&&token){state.base=base;state.token=token;$('serverUrl').value=base;$('token').required=false;$('token').placeholder='Saved on this device';refresh();}
  else $('settingsDialog').showModal();
}
async function selectSessionPlayer(id){state.playerId=id;state.queue=null;state.items=[];state.player=null;renderPlayer();renderQueue();localStorage.setItem('decksona.playerId',id);await refresh();}
const sessions=window.createPlayerSession({state,command:(name,args)=>request(commands[name],args),select:selectSessionPlayer,refresh,notify:say,formatPlayerName:player=>player.player_id===phonePlayerId()?'This phone · Decksona':player.name,listPlayers:()=>window.DECKSONA_LOCAL_PLAYER.orderedPlayers(state.players,phoneClientId(),hideOfflinePlayers)});
setInterval(renderProgress,1000);setInterval(()=>{if(!document.hidden)refresh();},5000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkForUpdate();});
window.addEventListener('pageshow',checkForUpdate);
$('reloadApp').addEventListener('click',()=>{
  const url=new URL(location.href);url.searchParams.set('v',availableBuild||WEB_BUILD);location.replace(url.href);
});
window.addEventListener('pagehide',event=>{if(!event.persisted)phoneAudio?.stop();});
init();
