const $ = id => document.getElementById(id);
const commands = {
  players: 'players/all', queues: 'player_queues/all', items: 'player_queues/items', search: 'music/search',
  playPause: 'player_queues/play_pause', stop: 'player_queues/stop', next: 'player_queues/next', previous: 'player_queues/previous',
  seek: 'player_queues/seek', skip: 'player_queues/skip', playIndex: 'player_queues/play_index', playMedia: 'player_queues/play_media',
  moveItem: 'player_queues/move_item', itemByUri: 'music/item_by_uri', artistAlbums: 'music/artists/artist_albums',
  albumTracks: 'music/albums/album_tracks', shuffle: 'player_queues/shuffle', repeat: 'player_queues/repeat', volume: 'players/cmd/volume_set'
};
const state = { base: '', token: '', socket: null, opening: null, serial: 0, pending: new Map(), playerId: '', players: [], queues: [], queue: null, player: null, items: [], results: [], filters: new Set(['track','album','playlist','artist']), history: [], browseLabel: '', refreshing: false, seeking: false, theme: 'phosphor-glass', messageTimer: 0 };

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
    const timer = setTimeout(() => { state.pending.delete(message_id); reject(new Error('Music Assistant did not respond in time.')); }, ['music/artists/artist_albums','music/albums/album_tracks'].includes(command) ? 30000 : 15000);
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
  const name = String(value.name || '').replace(/^\[unknown\]\s*-\s*/i,''); const split = name.indexOf(' - ');
  return split > 0 && knownArtist(name.slice(0,split)) ? [{name:name.slice(0,split)}] : [];
}
function artistName(item) { return artists(item).map(entry => entry.name).join(', ') || 'Unknown artist'; }
function albumName(item) { const a=media(item).album; return typeof a==='string' ? a : a?.name || media(item).album_name || ''; }
function seconds(item) { return [item?.duration,media(item)?.duration,item?.streamdetails?.duration].map(Number).find(n=>Number.isFinite(n)&&n>0)||0; }
function fmt(value) { const n=Math.max(0,Math.floor(Number(value)||0)); return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`; }
function elapsed() { const q=state.queue; const base=Number(q?.elapsed_time)||0; const at=Number(q?.elapsed_time_last_updated)||0; return Math.max(0,base+(q?.state==='playing'&&at?Date.now()/1000-at:0)); }
function renderProgress() {
  const total=seconds(state.queue?.current_item); const current=Math.min(total||Infinity,elapsed());
  $('elapsed').textContent=fmt(current); $('duration').textContent=total?fmt(total):'--:--';
  if (!state.seeking) $('seek').value=total?Math.round(current/total*1000):0;
  $('seek').disabled=!total||!state.queue?.active;
}
function applyTheme(id) {
  const theme=window.DECKSONA_THEMES?.find(entry=>entry.id===id)||window.DECKSONA_THEMES?.[0]; if(!theme)return;
  state.theme=theme.id; const root=document.documentElement;
  for(const [key,value] of Object.entries({background:theme.background,panel:theme.panel,screen:theme.screen,accent:theme.accent,secondary:theme.secondary,border:theme.border})) root.style.setProperty(`--${key}`,value);
  const patterns={glass:'linear-gradient(125deg,#fff2,transparent 35%,#fff1 75%,transparent)',scanline:'repeating-linear-gradient(0deg,transparent 0 3px,#ffffff12 3px 4px)',circuit:'repeating-linear-gradient(90deg,transparent 0 34px,#ffffff12 34px 35px),repeating-linear-gradient(0deg,transparent 0 26px,#ffffff12 26px 27px)',grid:'repeating-linear-gradient(90deg,transparent 0 14px,#ffffff10 14px 15px),repeating-linear-gradient(0deg,transparent 0 14px,#ffffff10 14px 15px)',diagonal:'repeating-linear-gradient(135deg,transparent 0 7px,#ffffff12 7px 8px,transparent 8px 15px)',carbon:'repeating-linear-gradient(45deg,transparent 0 5px,#ffffff12 5px 7px,transparent 7px 12px)'};
  root.style.setProperty('--pattern',patterns[theme.pattern]||patterns.glass); localStorage.setItem('decksona.theme',theme.id);
}
function initSkins() {
  const select=$('skinSelect'); for(const theme of window.DECKSONA_THEMES||[]) select.add(new Option(theme.name,theme.id));
  $('skinCount').textContent=`${window.DECKSONA_THEMES?.length||0} SKINS`; const saved=localStorage.getItem('decksona.theme')||'phosphor-glass'; select.value=saved; applyTheme(saved);
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
async function renderArtwork(item) {
  const img=$('cover'); const revision=String(item?.queue_item_id||item?.uri||item?.name||'');
  if(!item){img.hidden=true;img.removeAttribute('src');return;}
  if(img.dataset.item===revision)return; img.dataset.item=revision; img.hidden=true;
  const src=await artworkFor(item); if(img.dataset.item!==revision)return;
  if(src){img.onload=()=>{img.hidden=false};img.onerror=()=>{img.hidden=true};img.src=src;}
}
function renderPlayer() {
  const q=state.queue; const current=q?.current_item; $('trackTitle').textContent=current?trackName(current):'NOTHING PLAYING';
  $('trackArtist').textContent=current?artistName(current):'Search your library and press play'; $('trackAlbum').textContent=albumName(current);
  $('playerState').textContent=q?.state?String(q.state).toUpperCase():'READY'; $('playPause').textContent=q?.state==='playing'?'⏸':'▶'; $('playPause').setAttribute('aria-label',q?.state==='playing'?'Pause':'Play');
  $('shuffle').textContent=`SHUFFLE ${q?.shuffle_enabled?'ON':'OFF'}`; $('shuffle').classList.toggle('active',Boolean(q?.shuffle_enabled)); $('shuffle').setAttribute('aria-pressed',String(Boolean(q?.shuffle_enabled)));
  const repeat=q?.repeat_mode||'off'; $('repeat').textContent=`REPEAT ${repeat.toUpperCase()}`; $('repeat').classList.toggle('active',repeat!=='off');
  const vol=state.player?.volume_level; if(Number.isFinite(vol)&&document.activeElement!==$('volume'))$('volume').value=vol;
  $('volumeValue').textContent=Number.isFinite(vol)?String(vol):'--'; $('volume').disabled=!state.player||vol==null;
  renderProgress(); renderArtwork(current);
  const next=state.items.find(item=>item.queue_item_id!==current?.queue_item_id); $('nextTitle').textContent=next?`${trackName(next)} · ${artistName(next)}`:'Queue is empty';
}
function renderOutput() {
  const select=$('playerSelect'); const old=state.playerId; select.replaceChildren(new Option(state.connected?'Select an output':'Connect to Music Assistant',''));
  for(const p of state.players.filter(item=>item.enabled!==false)) select.add(new Option(`${p.name}${p.available===false?' · OFFLINE':''}`,p.player_id));
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
    if(item.media_type==='artist'||item.media_type==='album'){
      const open=document.createElement('button');open.className='browse-button';open.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h12M9 12h12M9 18h12M3 6h.01M3 12h.01M3 18h.01"/></svg>';open.setAttribute('aria-label',item.media_type==='artist'?'Show albums':'Show songs');open.title=item.media_type==='artist'?'Show albums':'Show songs';open.addEventListener('click',()=>browseItem(item));buttons.append(open);
    }
    if(item.media_type!=='artist'){
      const add=document.createElement('button');add.textContent='+';add.setAttribute('aria-label','Add to queue');add.addEventListener('click',()=>playMedia(item,'add'));
      if(item.media_type==='track'){el.addEventListener('click',event=>{if(!event.target.closest('button'))playMedia(item,'replace');});el.addEventListener('dblclick',()=>playMedia(item,'replace'));}
      buttons.append(add);
    }
    if(item.media_type==='artist'||item.media_type==='album')el.addEventListener('click',event=>{if(!event.target.closest('button'))browseItem(item)});
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
function renderQueue(){ const count=state.items.length;$('queueCount').textContent=`${count} ITEMS`;$('tabQueueCount').textContent=`(${count})`;document.querySelector('.tab[data-page="queuePage"]').setAttribute('aria-label',`Queue, ${count} ${count===1?'song':'songs'}`);renderList('queueList',state.items,'queue',state.connected?'The queue is empty.':'Connect to see the queue.'); }
async function refresh() {
  if(state.refreshing||!state.base||!state.token)return;state.refreshing=true;
  try{
    await ensureConnection(); const [players,queues]=await Promise.all([request(commands.players),request(commands.queues)]);
    state.players=Array.isArray(players)?players:[];state.queues=Array.isArray(queues)?queues:[];
    if(!state.playerId||!state.players.some(p=>p.player_id===state.playerId))state.playerId=state.players.find(p=>p.available!==false)?.player_id||state.players[0]?.player_id||'';
    state.player=state.players.find(p=>p.player_id===state.playerId)||null;state.queue=state.queues.find(q=>q.queue_id===state.playerId)||null;
    state.items=state.queue?await request(commands.items,{queue_id:state.playerId,limit:200,offset:0}):[];if(!Array.isArray(state.items))state.items=[];
    state.connected=true;localStorage.setItem('decksona.playerId',state.playerId);$('connection').textContent='CONNECTED';$('connection').classList.add('online');renderOutput();renderPlayer();renderQueue();
  }catch(error){state.connected=false;$('connection').textContent='RECONNECTING';$('connection').classList.remove('online');if(!document.hidden)say(error.message,true);}
  finally{state.refreshing=false;}
}
async function act(name,args={}) {
  if(!state.playerId){say('SELECT AN OUTPUT FIRST',true);return;}
  try{await request(commands[name],args);await refresh();}catch(error){say(error.message,true);}
}
function firstMovableIndex(q){if(Number.isInteger(q?.index_in_buffer))return Math.max(q.index_in_buffer,q.current_index??-1)+1;return Math.max(0,q?.current_index??0);}
async function moveItem(item,shift){const queues=await request(commands.queues);const q=queues.find(entry=>entry.queue_id===state.playerId);const items=await request(commands.items,{queue_id:state.playerId,limit:200,offset:0});const index=items.findIndex(entry=>entry.queue_item_id===item.queue_item_id);const first=firstMovableIndex(q);if(index<first||index+shift<first){say('ONLY UPCOMING TRACKS CAN BE REORDERED');return;}try{await request(commands.moveItem,{queue_id:state.playerId,queue_item_id:item.queue_item_id,pos_shift:shift});say('QUEUE ORDER UPDATED');}catch(error){say(error.message,true);}finally{await refresh();}}
async function playMedia(item,option){if(!item.uri){say('THIS ITEM HAS NO PLAYABLE URI',true);return;}if(!state.playerId){say('SELECT AN OUTPUT FIRST',true);return;}try{await request(commands.playMedia,{queue_id:state.playerId,media:item.uri,option});await refresh();}catch(error){say(error.message,true);}}
function browseNav(){ $('browseBar').hidden=!state.history.length;$('browseLabel').textContent=state.browseLabel; }
async function browseItem(item){
  const isArtist=item.media_type==='artist';const uri=item.uri?.match(/^([^:]+):\/\/[^/]+\/(.+)$/);const id=item.item_id||uri?.[2];const provider=item.provider||uri?.[1];if(!id||!provider){say('THIS RESULT HAS NO BROWSE REFERENCE',true);return;}
  try{const result=await request(isArtist?commands.artistAlbums:commands.albumTracks,{item_id:String(id),provider_instance_id_or_domain:provider});state.history.push({items:state.results,label:state.browseLabel});state.browseLabel=`${trackName(item)} · ${isArtist?'ALBUMS':'SONGS'}`;state.results=(Array.isArray(result)?result:[]).map(entry=>({...entry,media_type:entry.media_type||(isArtist?'album':'track')}));browseNav();renderList('results',state.results,'results',isArtist?'No albums found.':'No songs found.');$('resultCount').textContent=`${state.results.length}`;}
  catch(error){say(error.message,true);}
}
async function search(){
  const query=$('searchInput').value.trim();state.history=[];state.browseLabel='';browseNav();
  if(!state.filters.size){state.results=[];renderList('results',[],'results','Choose at least one search type.');return;}
  if(!query){state.results=[];renderList('results',[],'results','Search your Music Assistant library.');$('resultCount').textContent='';return;}
  try{const data=await request(commands.search,{search_query:query,media_types:[...state.filters],limit:30,library_only:false});const buckets={track:'tracks',album:'albums',playlist:'playlists',artist:'artists'};state.results=[...state.filters].flatMap(type=>Array.isArray(data?.[buckets[type]])?data[buckets[type]]:[]);renderList('results',state.results,'results','No matches found.');$('resultCount').textContent=`${state.results.length} RESULTS`;}
  catch(error){say(error.message,true);}
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
$('disconnect').addEventListener('click',()=>{localStorage.removeItem('decksona.server');localStorage.removeItem('decksona.token');localStorage.removeItem('decksona.playerId');state.base='';state.token='';state.playerId='';state.connected=false;if(state.socket)state.socket.close();$('settingsDialog').close();$('connection').textContent='OFFLINE';renderPlayer();renderQueue();say('DISCONNECTED · TOKEN REMOVED');});
$('skinSelect').addEventListener('change',event=>applyTheme(event.target.value));
$('searchForm').addEventListener('submit',event=>{event.preventDefault();search();});
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{const type=button.dataset.filter;if(state.filters.has(type))state.filters.delete(type);else state.filters.add(type);button.setAttribute('aria-pressed',String(state.filters.has(type)));search();}));
$('browseBack').addEventListener('click',()=>{const previous=state.history.pop();if(!previous)return;state.results=previous.items;state.browseLabel=previous.label;browseNav();renderList('results',state.results,'results','No results.');$('resultCount').textContent=`${state.results.length} RESULTS`;});
$('playerSelect').addEventListener('change',async event=>{state.playerId=event.target.value;localStorage.setItem('decksona.playerId',state.playerId);await refresh();});
for(const button of document.querySelectorAll('[data-command]'))button.addEventListener('click',()=>act(button.dataset.command,{queue_id:state.playerId}));
for(const button of document.querySelectorAll('[data-seconds]'))button.addEventListener('click',()=>act('skip',{queue_id:state.playerId,seconds:Number(button.dataset.seconds)}));
$('playPause').addEventListener('click',()=>act('playPause',{queue_id:state.playerId}));
$('shuffle').addEventListener('click',()=>act('shuffle',{queue_id:state.playerId,shuffle_enabled:!state.queue?.shuffle_enabled}));
$('repeat').addEventListener('click',()=>{const next={off:'all',all:'one',one:'off'}[state.queue?.repeat_mode||'off'];act('repeat',{queue_id:state.playerId,repeat_mode:next});});
$('seek').addEventListener('input',()=>{state.seeking=true;});$('seek').addEventListener('change',()=>{state.seeking=false;const total=seconds(state.queue?.current_item);if(total)act('seek',{queue_id:state.playerId,position:Math.round(total*Number($('seek').value)/1000)});});
$('volume').addEventListener('change',()=>act('volume',{player_id:state.playerId,volume_level:Number($('volume').value)}));

function init(){
  initSkins();const base=localStorage.getItem('decksona.server')||'';const token=localStorage.getItem('decksona.token')||'';
  if(base&&token){state.base=base;state.token=token;$('serverUrl').value=base;$('token').required=false;$('token').placeholder='Saved on this device';refresh();}
  else $('settingsDialog').showModal();
}
setInterval(renderProgress,1000);setInterval(()=>{if(!document.hidden)refresh();},5000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
init();
