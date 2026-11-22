/* One library, queue editor, presets and discovery experience for both editions. */
window.createListeningFeatures = function ({ state, command, refresh, selectPlayer, notify, filters, image, beforePlay = async () => {}, invalidateBrowse = () => {} }) {
  const core = window.DECKSONA_LISTENING;
  const $ = id => document.getElementById(id);
  const media = core.media;
  const name = item => media(item).name || item?.name || 'Untitled';
  const uri = item => media(item).uri || item?.uri;
  const subtitle = item => (media(item).artists || []).map(a => a.name).join(', ') || media(item).owner || '';
  const list = value => Array.isArray(value) ? value : value?.items || [];
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const store = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const scope = () => (state.base || state.serverUrl || $('serverUrl').value || '').replace(/\/$/, '');
  const key = type => `decksona.${type}.${scope()}`;
  const node = (tag, text, cls) => { const el = document.createElement(tag); if (text != null) el.textContent = text; if (cls) el.className = cls; return el; };
  function button(text, handler, title = text) {
    const el = node('button', text); el.type = 'button'; el.title = title; el.setAttribute('aria-label', title);
    el.addEventListener('click', event => { event.stopPropagation(); try { Promise.resolve(handler()).catch(error => notify(error.message, true)); } catch (error) { notify(error.message, true); } });
    return el;
  }
  function option(select, label, value) { select.add(new Option(label, value)); }
  function label(text, control) { const el = node('label', text); el.append(control); return el; }
  let revision = 0, view = { kind: 'home' }, history = [], more = null, busy = false, queueBusy = false;
  let selection = new Set(), selectionQueue = '', undo = null, initialized = '', searchTimer;
  let providerGeneration = 0;
  const library = $('results').closest('.library-panel');
  library.classList.add('listening-library');
  const nav = node('nav', null, 'listening-nav'); nav.setAttribute('aria-label', 'Library views');
  for (const [title, kind] of [['Home','home'],['Albums','album'],['Artists','artist'],['Tracks','track'],['Playlists','playlist'],['Genres','genre'],['Discover','discover'],['Presets','presets']]) {
    const b = button(title, () => { $('searchInput').value = ''; return open({kind}, false); }); b.dataset.view = kind; nav.append(b);
  }
  library.insertBefore(nav, $('searchForm'));
  const options = node('div', null, 'listening-options');
  const onlyLibrary = node('input'); onlyLibrary.type = 'checkbox'; onlyLibrary.id = 'libraryOnly';
  const provider = node('select'); provider.id = 'searchProvider'; provider.setAttribute('aria-label', 'Search provider'); option(provider, 'All providers', '');
  const sort = node('select'); sort.id = 'librarySort'; sort.setAttribute('aria-label', 'Library order');
  option(sort, 'Name A–Z', 'sort_name'); option(sort, 'Recently added', 'timestamp_added DESC'); option(sort, 'Name Z–A', 'sort_name DESC');
  const grid = button('Grid', () => { const value = grid.getAttribute('aria-pressed') !== 'true'; grid.setAttribute('aria-pressed', String(value)); store('decksona.libraryGrid', value); return reload(); });
  grid.id = 'libraryGrid'; grid.setAttribute('aria-pressed', String(read('decksona.libraryGrid', true)));
  options.append(label('Library only ', onlyLibrary), provider, sort, grid); $('searchForm').after(options);
  const recents = node('div', null, 'recent-searches'); recents.id = 'recentSearches'; options.after(recents);
  const bar = node('div', null, 'listening-context'); bar.id = 'listeningContext'; recents.after(bar);
  const moreButton = button('Load more', () => more?.()); moreButton.id = 'libraryMore'; moreButton.hidden = true; $('results').after(moreButton);
  const status = node('p', '', 'listening-status'); status.id = 'libraryStatus'; status.setAttribute('role','status'); bar.after(status);
  // The shared browser owns its own history, including paginated search snapshots.
  const oldBrowse = $('browseNavigation') || $('browseBar'); oldBrowse.hidden = true;
  const dialog = node('dialog', null, 'listening-dialog'); dialog.id = 'listeningDialog'; document.body.append(dialog);
  function modal(title, build) {
    if (dialog.open) dialog.close(); dialog.replaceChildren();
    const heading = node('div', null, 'listening-dialog-heading'); heading.append(node('h2', title), button('×', () => dialog.close(), 'Close'));
    dialog.append(heading); const content = node('div', null, 'listening-dialog-content'); dialog.append(content); build(content); dialog.showModal();
  }
  function ask(title, submit, build = () => {}) {
    modal(title, content => {
      const form = node('form'); const input = node('input'); input.required = true; input.maxLength = 120; input.setAttribute('aria-label','Name'); input.placeholder = 'Name';
      form.append(label('Name ', input)); build(form); const error = node('p'); error.setAttribute('role','alert');
      const save = button('Save', () => form.requestSubmit()); form.append(error,save); content.append(form);
      form.addEventListener('submit', async event => { event.preventDefault(); if (!input.value.trim()) return; save.disabled = true;
        try { await submit(input.value.trim(),form); dialog.close(); } catch (e) { error.textContent = e.message; } finally { save.disabled = false; }
      }); input.focus();
    });
  }
  function recentSearches() {
    recents.replaceChildren();
    for (const query of read(key('searches'), []).slice(0,6)) recents.append(button(query, () => { $('searchInput').value = query; return search(); }));
    if (recents.childNodes.length) recents.append(button('Clear history', () => { store(key('searches'),[]); recentSearches(); }));
  }
  function remember(query) { store(key('searches'), [query,...read(key('searches'),[]).filter(q=>q!==query)].slice(0,10)); recentSearches(); }
  function renderContext() {
    bar.replaceChildren();
    if (history.length) bar.append(button('← Back', () => { const previous = history.pop(); if (previous) return open(previous, false, true); }));
    bar.append(node('strong', view.label || ({home:'Your library', discover:'Discover', presets:'Listening presets', search:'Search results'}[view.kind]) || `${view.kind[0].toUpperCase()}${view.kind.slice(1)}s`));
    bar.append(button('Refresh', () => reload()));
    if (view.kind === 'playlist') bar.append(button('New playlist', createPlaylist));
    if (view.kind === 'detail' && view.item.media_type === 'playlist') {
      const editable = editablePlaylist(view.item);
      bar.append(node('small', editable ? 'Editable playlist' : 'Read-only playlist · save a copy to edit'));
      bar.append(button('Save a copy', () => savePlaylistCopy(view.item)));
    }
    if (view.kind === 'detail' && view.item.media_type === 'genre') {
      bar.append(button('Artists', () => open({...view, genreMode:'artists'}, false, true)), button('Albums', () => open({...view, genreMode:'albums'}, false, true)));
    }
    nav.querySelectorAll('button').forEach(b => b.setAttribute('aria-current', b.dataset.view === view.kind ? 'page' : 'false'));
    library.dataset.listeningView = view.kind;
    recents.hidden = view.kind !== 'search';
    onlyLibrary.parentElement.hidden = provider.hidden = view.kind !== 'search';
    const isLibrary = ['album','artist','track','playlist','genre'].includes(view.kind);
    sort.hidden = !isLibrary; grid.hidden = !(isLibrary || view.kind === 'home');
  }
  function editablePlaylist(item) { return item?.provider === 'library' && item.is_editable === true && !item.is_dynamic; }
  function card(item, index) {
    const el = node('article', null, 'music-card'); el.dataset.uri = uri(item) || '';
    const type = media(item).media_type || item.media_type || 'track';
    const browseable = ['album','artist','playlist','genre'].includes(type);
    const content = button('', () => browseable ? browse(item) : actions(item), `${browseable ? 'Browse' : 'Actions for'} ${name(item)}`); content.className = 'music-card-content';
    if (image && ['album','artist','playlist'].includes(type)) {
      const art = node('img'); art.alt = ''; art.loading = 'lazy'; art.hidden = true; content.append(art);
      Promise.resolve(image(item)).then(src=> { if(src && el.isConnected) { art.src = src; art.hidden = false; art.addEventListener('error',()=>{art.hidden=true;},{once:true}); } }).catch(()=>{});
    }
    const text = node('span', null, 'music-card-copy'); text.append(node('strong', name(item)),node('small', subtitle(item) || type)); content.append(text); el.append(content);
    const controls = node('div', null, 'music-card-actions');
    if (type !== 'genre' && type !== 'artist') { controls.append(button('▶',()=>play(item,'replace'),`Play now: ${name(item)}`),button('Next',()=>play(item,'next'),`Play next: ${name(item)}`),button('+',()=>play(item,'add'),`Add to end: ${name(item)}`)); }
    controls.append(button('•••',()=>actions(item),`More actions: ${name(item)}`));
    if (view.kind === 'detail' && editablePlaylist(view.item) && Number.isInteger(item.position)) {
      controls.append(button('Remove',()=>editPlaylist('remove',item)));
      if (index > 0) controls.append(button('↑',()=>editPlaylist('move',item,view.items[index-1].position),'Move up in playlist'));
      if (index < view.items.length-1) controls.append(button('↓',()=>editPlaylist('move',item,view.items[index+1].position),'Move down in playlist'));
    }
    el.append(controls); return el;
  }
  function renderItems(items, empty = 'No music found.') {
    state.results = items; const results = $('results'); results.replaceChildren();
    results.classList.toggle('music-grid',grid.getAttribute('aria-pressed') === 'true' && ['home','album','artist','playlist'].includes(view.kind));
    if (!items.length) results.append(node('div',empty,'empty')); else items.forEach((item,i)=>results.append(card(item,i)));
    if ($('resultCount')) $('resultCount').textContent = `${items.length} ITEMS`;
  }
  function showMore(handler) { more = handler; moreButton.hidden = !handler; }
  const collectionCommands = {album:'libraryAlbums',artist:'libraryArtists',track:'libraryTracks',playlist:'libraryPlaylists',genre:'libraryGenres'};
  async function open(next, push = true, back = false) {
    clearTimeout(searchTimer); invalidateBrowse(); const turn = ++revision;
    if (push) history.push({...view}); else if (!back) history = [];
    view = {...next}; renderContext(); recentSearches(); renderItems([], 'Loading…'); showMore(null); status.textContent = 'Loading…'; $('results').setAttribute('aria-busy','true');
    try {
      if (next.kind === 'home') await home(turn);
      else if (next.kind === 'discover') await discover(turn);
      else if (next.kind === 'presets') renderPresets();
      else if (next.kind === 'search') await loadSearch(turn);
      else if (next.kind === 'detail') await loadDetail(turn);
      else await loadCollection(turn);
      if (turn === revision) status.textContent = '';
    } catch (error) {
      if (turn === revision) { renderItems([], 'This view is unavailable.'); status.textContent = error.message; notify(error.message,true); }
    } finally { if (turn === revision) $('results').setAttribute('aria-busy','false'); }
  }
  async function loadCollection(turn) {
    const items = list(await command(collectionCommands[view.kind],{limit:view.limit || 60,offset:0,sort_field:sort.value.split(' ')[0],sort_direction:sort.value.endsWith('DESC')?'desc':'asc'}));
    if (turn !== revision) return; view.items = items; renderItems(items);
    showMore(items.length >= (view.limit || 60) ? () => open({...view,limit:(view.limit || 60)+60},false,true) : null);
  }
  async function home(turn) {
    const results = await Promise.allSettled([
      command('libraryAlbums',{limit:12,sort_field:'timestamp_added',sort_direction:'desc'}),
      command('libraryPlaylists',{limit:12,sort_field:'sort_name',sort_direction:'asc'})
    ]);
    if (turn !== revision) return; const target = $('results'); target.classList.remove('music-grid'); target.replaceChildren(); state.results=[];
    for (const [i,result] of results.entries()) {
      const section = node('section',null,'music-section'); section.append(node('h3',i===0?'Recently added albums':'Your playlists'));
      if (result.status === 'fulfilled') { const items = list(result.value); state.results.push(...items); const row = node('div',null,grid.getAttribute('aria-pressed')==='true'?'music-grid':'music-rows'); items.forEach((item,index)=>row.append(card(item,index))); section.append(items.length?row:node('p','Your library has no items here yet.')); }
      else section.append(node('p',`Unavailable: ${result.reason.message}`)); target.append(section);
    }
    if ($('resultCount')) $('resultCount').textContent = `${state.results.length} ITEMS`;
  }
  async function search(limit = 30) {
    const query = $('searchInput').value.trim(); if (!query) return open({kind:'home'},false);
    remember(query); return open({kind:'search',query,limit,types:[...filters()],libraryOnly:onlyLibrary.checked,provider:provider.value},false);
  }
  async function loadSearch(turn) {
    if (!view.types.length) { renderItems([],'Choose at least one search type.'); return; }
    const data = await command('search',core.searchArgs(view.query,view.types,view.limit,view.libraryOnly,view.provider));
    if (turn !== revision) return;
    const buckets={track:'tracks',album:'albums',artist:'artists',playlist:'playlists',genre:'genres'};
    const items = view.types.flatMap(type=>list(data?.[buckets[type]]).map(item=>({...item,media_type:item.media_type||type})));
    renderItems(items); showMore(view.types.some(type=>list(data?.[buckets[type]]).length >= view.limit)?()=>open({...view,limit:view.limit+30},false,true):null);
  }
  async function browse(item) {
    const turn = ++revision;
    if (item.media_type === 'playlist' && uri(item)) item = {...item,...await command('itemByUri',{uri:uri(item)})};
    if (turn !== revision) return;
    return open({kind:'detail',item,label:name(item),limit:100});
  }
  async function loadDetail(turn) {
    const item = view.item, type = item.media_type, ref = core.reference(item);
    let response;
    if (type === 'genre') response = await command(view.genreMode === 'albums' ? 'genreAlbums' : 'genreArtists', view.genreMode === 'albums' ? {item_id:ref.item_id} : {genre:Number(ref.item_id)});
    else if (type === 'recommendation') response = item.items?.length ? item.items : await command('recommendationItems',{provider:item.provider,item_id:String(item.item_id)});
    else response = await command(type==='artist'?'artistAlbums':type==='playlist'?'playlistTracks':'albumTracks',{...ref,...(type==='playlist'?{limit:view.limit,offset:0}: {})});
    if (turn !== revision) return;
    const items = list(response).map(entry=>({...entry,media_type:entry.media_type || (type==='genre' && view.genreMode !== 'albums' ? 'artist' : type==='artist'||type==='genre'?'album':'track')}));
    view.items = items; renderItems(items); renderContext();
    showMore(type==='playlist' && items.length>=view.limit ? ()=>open({...view,limit:view.limit+100},false,true):null);
  }
  async function discover(turn) {
    const folders = list(await command('recommendations'));
    if (turn !== revision) return;
    const items = folders.map(folder=>({...folder,media_type:'recommendation'}));
    renderItems(items,'No recommendations yet. Enable a recommendations provider in Music Assistant.');
    // Recommendation folders are opened on demand, so slow providers do not block all discovery.
    $('results').querySelectorAll('.music-card').forEach((el,i)=>{
      el.replaceChildren(button(name(items[i]),()=>open({kind:'detail',item:items[i],label:name(items[i])})));
    });
  }
  function reload() { return open({...view},false,true); }
  async function play(item, mode) {
    if (queueBusy) throw new Error('Wait for the queue edit to finish.');
    const queueId = state.playerId; if (!queueId) throw new Error('Choose a player first.');
    if (!uri(item)) throw new Error('This item has no playable URI.');
    await beforePlay(); await command('playMedia',{queue_id:queueId,media:uri(item),option:mode}); await refresh();
    notify(mode==='next'?'Added to play next':mode==='add'?'Added to end':'Playing now');
  }
  function actions(item) {
    modal(name(item), content => {
      const type = media(item).media_type;
      if (!['genre','artist','recommendation'].includes(type)) {
        content.append(button('Play now',async()=>{await play(item,'replace');dialog.close();}),button('Play next',async()=>{await play(item,'next');dialog.close();}),button('Add to end',async()=>{await play(item,'add');dialog.close();}));
        content.append(button('Save listening preset',()=>savePreset(item)));
        if (['track','album'].includes(type)) content.append(button('Add to playlist',()=>choosePlaylist([uri(item)])));
      }
      if (['album','artist','playlist','genre'].includes(type)) content.append(button('Browse',async()=>{dialog.close();await browse(item);}));
    });
  }
  async function waitTask(result) {
    if (!result?.task_id || !result.status) return;
    const terminal = ['completed','success','failed','cancelled','partial_success'];
    let task = result;
    for (let i=0;i<40&&!terminal.includes(task.status);i++) { await new Promise(resolve=>setTimeout(resolve,500)); task=await command('task',{task_id:result.task_id}); }
    if (!['completed','success'].includes(task.status)) throw new Error(task.error || task.error_message || 'Playlist update is still running or failed. Refresh the playlist to check its current contents.');
  }
  function createPlaylist() {
    ask('Create playlist', async title => { await command('createPlaylist',{name:title}); await open({kind:'playlist'},false); notify('Playlist created'); });
  }
  async function choosePlaylist(uris) {
    const playlists = list(await command('libraryPlaylists',{limit:500,offset:0})).filter(editablePlaylist);
    modal('Add to playlist',content=> {
      content.append(node('p','Choose an editable library playlist.'));
      for (const playlist of playlists) content.append(button(name(playlist),async()=>{ await waitTask(await command('addPlaylistTracks',{db_playlist_id:playlist.item_id,uris}));dialog.close();notify('Playlist updated'); }));
      content.append(button('New playlist…',()=>ask('New playlist',async title=>{const p=await command('createPlaylist',{name:title});await waitTask(await command('addPlaylistTracks',{db_playlist_id:p.item_id,uris}));notify('Playlist saved');})));
    });
  }
  async function allPlaylistTracks(item) {
    const tracks=[]; let page;
    do { page=list(await command('playlistTracks',{...core.reference(item),limit:200,offset:tracks.length})); tracks.push(...page); } while(page.length===200);
    return tracks;
  }
  function savePlaylistCopy(item) { ask('Save playlist copy',async title=>{ const tracks=await allPlaylistTracks(item); const p=await command('createPlaylist',{name:title}); if(tracks.length)await waitTask(await command('addPlaylistTracks',{db_playlist_id:p.item_id,uris:tracks.map(uri).filter(Boolean)})); await open({kind:'playlist'},false); }); }
  async function editPlaylist(kind,item,to) {
    if (busy) throw new Error('Wait for the current playlist edit.');
    const playlist=view.item; if(!editablePlaylist(playlist)) throw new Error('This playlist is read-only.');
    busy=true;
    try {
      if(kind==='remove') await waitTask(await command('removePlaylistTracks',{db_playlist_id:playlist.item_id,positions_to_remove:[item.position],uris:[uri(item)]}));
      else await command('movePlaylistTrack',{db_playlist_id:playlist.item_id,from_position:item.position,to_position:to,uri:uri(item)});
      if(view.item===playlist)await reload(); notify('Playlist updated');
    } finally {busy=false;}
  }
  function savePreset(item) {
    if(!state.playerId)throw new Error('Choose an output before saving a preset.');
    ask('Save listening preset',async (title,form)=>{
      const presets=read(key('presets'),[]); presets.push({id:globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,name:title,uri:uri(item),mediaName:name(item),playerId:form.elements.output.value,volume:Number(form.elements.level.value),shuffle:form.elements.randomize.checked}); store(key('presets'),presets);notify('Preset saved');
    },form=>{
      const output=node('select');output.name='output';output.required=true;output.setAttribute('aria-label','Preset output');
      for(const player of state.players.filter(p=>p.available!==false))option(output,player.name,player.player_id);output.value=state.playerId;
      const level=node('input');level.type='number';level.min=0;level.max=100;level.required=true;level.name='level';level.value=String(state.player?.volume_level ?? 25);
      const randomize=node('input');randomize.type='checkbox';randomize.name='randomize';randomize.checked=Boolean(state.queue?.shuffle_enabled);
      form.append(label('Output ',output),label('Volume (0–100) ',level),label('Shuffle ',randomize));
    });
  }
  async function runPreset(preset) {
    if (queueBusy) throw new Error('Wait for the queue edit to finish.');
    const players=list(await command('players'));
    if(!players.some(p=>p.player_id===preset.playerId&&p.available!==false&&!p.needs_setup))throw new Error('The preset output is unavailable.');
    await selectPlayer(preset.playerId); await beforePlay();
    await command('volume',{player_id:preset.playerId,volume_level:preset.volume});
    await command('shuffle',{queue_id:preset.playerId,shuffle_enabled:preset.shuffle});
    await command('playMedia',{queue_id:preset.playerId,media:preset.uri,option:'replace',shuffle:preset.shuffle});
    await refresh();notify(`Playing ${preset.name}`);
  }
  function renderPresets() {
    const target=$('results');target.replaceChildren();target.classList.remove('music-grid');
    const presets=read(key('presets'),[]);
    if(!presets.length)target.append(node('p','Save a preset from an album, playlist, or track’s ••• menu.','empty'));
    for(const preset of presets){ const el=node('article',null,'preset-card');el.append(node('strong',preset.name),node('small',`${preset.mediaName} · ${state.players.find(p=>p.player_id===preset.playerId)?.name || preset.playerId} · ${preset.volume}%${preset.shuffle?' · Shuffle':''}`),button('Play',()=>runPreset(preset)),button('Delete',()=>{store(key('presets'),presets.filter(p=>p.id!==preset.id));renderPresets();}));target.append(el); }
  }
  async function queueItems(queueId) {
    const items=[];let page;
    do { page=list(await command('items',{queue_id:queueId,limit:200,offset:items.length}));items.push(...page); } while(page.length===200);
    return items;
  }
  const toolbar=node('div',null,'queue-tools');toolbar.id='queueTools';
  const queueNode=$('queue') || $('queueList');queueNode.before(toolbar);
  const selectAll=button('Select upcoming',()=>{selection=new Set(state.items.slice(core.firstMovable(state.queue)).map(i=>i.queue_item_id));renderQueue();});
  const remove=button('Remove selected',()=>removeQueue([...selection]));remove.id='removeSelected';
  const clear=button('Clear upcoming',()=>removeQueue(state.items.slice(core.firstMovable(state.queue)).map(i=>i.queue_item_id)));clear.id='clearUpcoming';
  const undoButton=button('Undo removal',undoQueue);undoButton.id='undoQueue';
  const saveQueue=button('Save as playlist',()=>ask('Save queue as playlist',async title=>{
    const queueId=state.playerId;const tracks=await queueItems(queueId);const uris=tracks.map(uri).filter(Boolean);if(!uris.length)throw new Error('The queue is empty.');
    const p=await command('createPlaylist',{name:title});await waitTask(await command('addPlaylistTracks',{db_playlist_id:p.item_id,uris}));notify('Queue saved as playlist');
  }));saveQueue.id='saveQueuePlaylist';toolbar.append(selectAll,remove,clear,undoButton,saveQueue);
  function renderQueue() { // Reuse the edition's transport/reordering rows.
    queueNode.dispatchEvent(new Event('decksona-render-queue'));
  }
  function updateQueue() {
    if(selectionQueue!==state.playerId){selectionQueue=state.playerId;selection.clear();}
    const available=new Set(state.items.slice(core.firstMovable(state.queue)).map(i=>i.queue_item_id));selection=new Set([...selection].filter(id=>available.has(id)));
    remove.textContent=`Remove selected (${selection.size})`;remove.disabled=queueBusy||!selection.size;clear.disabled=selectAll.disabled=queueBusy||!available.size;saveQueue.disabled=queueBusy||!state.items.length;
    undoButton.disabled=queueBusy||!undo||undo.queueId!==state.playerId;
  }
  function queueRow(row,item,index) {
    const locked=index<core.firstMovable(state.queue), check=node('input');check.type='checkbox';check.checked=selection.has(item.queue_item_id);check.disabled=locked||queueBusy;check.className='queue-select';check.setAttribute('aria-label',`Select ${name(item)}`);
    check.addEventListener('click',e=>e.stopPropagation());check.addEventListener('change',()=>{if(check.checked)selection.add(item.queue_item_id);else selection.delete(item.queue_item_id);updateQueue();});row.prepend(check);row.classList.add('editable-queue-row');
    const del=button('×',()=>removeQueue([item.queue_item_id]),locked?'Playing or buffered track cannot be removed':`Remove ${name(item)}`);del.className='queue-remove';del.disabled=locked||queueBusy;row.append(del);
  }
  async function freshQueue(queueId) {
    const queues=list(await command('queues'));const queue=queues.find(q=>q.queue_id===queueId);if(!queue)throw new Error('Queue is unavailable.');return {queue,items:await queueItems(queueId)};
  }
  function lockQueue(locked) { $('playerSelect').disabled=locked; queueNode.classList.toggle('queue-editing',locked); }
  function fingerprint(items){return items.map(i=>i.queue_item_id).join('\n');}
  async function removeQueue(ids) {
    if(queueBusy)return;queueBusy=true;lockQueue(true);updateQueue();const queueId=state.playerId;let snapshot,removed=[];
    try {
      snapshot=await freshQueue(queueId);const wanted=new Set(ids);
      const pending=snapshot.items.map((item,index)=>({item,index})).filter(x=>wanted.has(x.item.queue_item_id)&&x.index>=core.firstMovable(snapshot.queue));
      for(const entry of pending.reverse()){
        // Recheck the buffer before each mutation; the server may have advanced.
        const live=await freshQueue(queueId);const index=live.items.findIndex(i=>i.queue_item_id===entry.item.queue_item_id);
        if(index<core.firstMovable(live.queue))continue;
        await command('deleteItem',{queue_id:queueId,item_id_or_index:entry.item.queue_item_id});
        const after=await queueItems(queueId);if(!after.some(i=>i.queue_item_id===entry.item.queue_item_id))removed.push(entry);
      }
      notify(`Removed ${removed.length} upcoming tracks`);
    } finally {
      try {
        if(removed.length){
          const live=await freshQueue(queueId);
          const removedIds=new Set(removed.map(e=>e.item.queue_item_id));
          const expected=snapshot.items.filter(item=>!removedIds.has(item.queue_item_id));
          undo=fingerprint(live.items)===fingerprint(expected) ? {queueId,currentId:snapshot.queue.current_item?.queue_item_id,remaining:fingerprint(live.items),removed:removed.sort((a,b)=>a.index-b.index)} : null;
        }
      } finally { selection.clear();queueBusy=false;lockQueue(false);await refresh();renderQueue();updateQueue(); }
    }
  }
  async function undoQueue() {
    if(queueBusy||!undo||undo.queueId!==state.playerId)return;
    queueBusy=true;lockQueue(true);updateQueue();const saved=undo;
    try {
      const live=await freshQueue(saved.queueId);
      if(fingerprint(live.items)!==saved.remaining||live.queue.current_item?.queue_item_id!==saved.currentId||saved.removed.some(e=>e.index<core.firstMovable(live.queue)))throw new Error('The queue or playback changed. Undo is no longer safe.');
      // Consume before mutating so a partial network failure cannot duplicate restored tracks.
      undo=null;
      for(const {item,index} of saved.removed){
        const liveStep=await freshQueue(saved.queueId);
        if(liveStep.queue.current_item?.queue_item_id!==saved.currentId || index<core.firstMovable(liveStep.queue))throw new Error('Playback advanced during restore. Check the queue before continuing.');
        const before=liveStep.items;const known=new Set(before.map(i=>i.queue_item_id));
        if(!uri(item))throw new Error('This track has no URI to restore.');
        await command('playMedia',{queue_id:saved.queueId,media:uri(item),option:'add'});
        const after=await queueItems(saved.queueId);const additions=after.filter(i=>!known.has(i.queue_item_id));
        if(additions.length!==1)throw new Error('The queue changed during restore. Check its current contents.');
        const pos=after.findIndex(i=>i.queue_item_id===additions[0].queue_item_id);
        if(pos!==index)await command('moveItem',{queue_id:saved.queueId,queue_item_id:additions[0].queue_item_id,pos_shift:index-pos});
      }notify('Removed tracks restored');
    } finally {queueBusy=false;lockQueue(false);await refresh();renderQueue();updateQueue();}
  }
  const quality=node('details',null,'audio-quality'); quality.id='audioQuality';quality.append(node('summary','Audio quality'));const qualityText=node('p');qualityText.id='audioQualityDetails';quality.append(qualityText);
  (document.querySelector('.player-card') || document.querySelector('.deck')).append(quality);
  function updatePlayer(){qualityText.textContent=`Source stream · ${core.quality(state.queue?.current_item)}`;}
  async function connected() {
    if(initialized===scope())return;initialized=scope();const generation=++providerGeneration;
    recentSearches();await open({kind:'home'},false);
    try {const providers=list(await command('providers'));if(generation!==providerGeneration)return;provider.replaceChildren();option(provider,'All providers','');for(const p of providers.filter(p=>p.type==='music'&&p.available!==false))option(provider,p.name||p.domain,p.instance_id);}catch{/* Search across all providers remains available. */}
  }
  onlyLibrary.addEventListener('change',()=>{provider.disabled=onlyLibrary.checked;search();});provider.addEventListener('change',()=>search());sort.addEventListener('change',()=>reload());
  $('searchInput').addEventListener('focus',()=>{recents.hidden=false;});
  $('searchInput').addEventListener('input',()=>{++revision;clearTimeout(searchTimer);searchTimer=setTimeout(()=>search().catch(e=>notify(e.message,true)),300);});
  return {search,browse,connected,queueRow,updateQueue,updatePlayer,queueItems,get queueBusy(){return queueBusy;},get view(){return view;}};
};
