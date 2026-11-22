// Real desktop and phone UI against a deterministic Music Assistant fixture.
// No server credentials or physical players are used.
const {app,BrowserWindow}=require('electron');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {COMMANDS}=require('../api');
app.disableHardwareAcceleration();
app.setPath('userData',path.join(app.getPath('temp'),'decksona-listening-check'));
const root=path.resolve(__dirname,'..');
const out=path.join(root,'output','listening-previews');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fixture=`
localStorage.clear();window.sent=[];window.failDelete=false;window.failLibrary=false;
window.fetch=async()=>({ok:true,json:async()=>({build:${JSON.stringify(require('../package.json').version)}})});
const track=(id)=>({name:'Track '+id,item_id:String(id),provider:'library',media_type:'track',uri:'library://track/'+id,artists:[{name:'Fixture artist'}],position:Number(id)});
window.makeTrack=track;
window.fixtureAlbum={name:'Fixture album',item_id:'1',provider:'library',media_type:'album',uri:'library://album/1'};
window.playlist={name:'Editable mix',item_id:'7',provider:'library',media_type:'playlist',uri:'library://playlist/7',is_editable:true};
window.songs=[track(1),track(2),track(3)];window.playlists=[playlist];
window.queueItems=[1,2,3,4].map(i=>({...track(i),queue_item_id:'q'+i}));
window.queue={queue_id:'desk',state:'playing',active:true,current_index:0,index_in_buffer:1,current_item:queueItems[0],shuffle_enabled:false};
queue.current_item.streamdetails={provider:'Local files',audio_format:{content_type:'flac',sample_rate:96000,bit_depth:24}};
window.players=[{player_id:'desk',name:'Office',available:true,volume_level:25},{player_id:'kitchen',name:'Kitchen',available:true,volume_level:30}];
window.dispatch=async(command,args={})=>{
  sent.push({command,args:JSON.parse(JSON.stringify(args))});
  if(command==='players/all')return players;
  if(command==='player_queues/all')return [queue];
  if(command==='player_queues/items')return queueItems.slice(args.offset,args.offset+args.limit);
  if(command==='player_queues/delete_item'){if(failDelete)throw Error('Deletion failed');queueItems=queueItems.filter(i=>i.queue_item_id!==args.item_id_or_index);return;}
  if(command==='player_queues/move_item'){const from=queueItems.findIndex(i=>i.queue_item_id===args.queue_item_id);const [item]=queueItems.splice(from,1);queueItems.splice(from+args.pos_shift,0,item);return;}
  if(command==='player_queues/play_media'){if(args.option==='add'){queueItems.push({...track(args.media.split('/').at(-1)),queue_item_id:'new'+sent.length});}return;}
  if(command==='music/search'){if(args.search_query==='slow')await new Promise(r=>setTimeout(r,650));return {tracks:Array.from({length:args.limit},(_,i)=>({...track(i+1),name:args.search_query+' '+(i+1)})),albums:[fixtureAlbum],playlists:[playlist]};}
  if(command==='music/albums/library_items'){if(failLibrary)throw Error('Library permission denied');return [fixtureAlbum];}
  if(command==='music/artists/library_items')return [{name:'Fixture artist',item_id:'1',provider:'library',uri:'library://artist/1',media_type:'artist'}];
  if(command==='music/genres/library_items')return [{name:'Jazz',item_id:'1',provider:'library',media_type:'genre'}];
  if(command==='music/genres/albums')return [fixtureAlbum];
  if(command==='music/tracks/library_items')return [track(1)];
  if(command==='music/playlists/library_items')return playlists;
  if(command==='music/item_by_uri')return args.uri.includes('/playlist/')?playlists.find(p=>p.uri===args.uri):fixtureAlbum;
  if(command==='music/albums/album_tracks')return [track(1),track(2)];
  if(command==='music/artists/artist_albums')return [fixtureAlbum];
  if(command==='music/playlists/playlist_tracks')return songs.slice(args.offset||0,(args.offset||0)+(args.limit||500));
  if(command==='music/playlists/create_playlist'){const p={...playlist,name:args.name,item_id:String(playlists.length+10),uri:'library://playlist/'+(playlists.length+10)};playlists.push(p);return p;}
  if(command==='music/playlists/add_playlist_tracks')return {task_id:'edit',status:'pending'};
  if(command==='tasks/get')return {task_id:'edit',status:'completed'};
  if(command==='music/playlists/remove_playlist_tracks'){songs=songs.filter(s=>!args.positions_to_remove.includes(s.position));return;}
  if(command==='music/playlists/move_playlist_track'){const from=songs.findIndex(s=>s.position===args.from_position),to=songs.findIndex(s=>s.position===args.to_position);const [s]=songs.splice(from,1);songs.splice(to,0,s);songs=songs.map((s,i)=>({...s,position:i+1}));return;}
  if(command==='music/recommendations')return [{name:'Forgotten favorites',provider:'recommendations',item_id:'forgotten',items:[]}];
  if(command==='music/recommendations/items')return [track(88)];
  if(command==='providers')return [{instance_id:'files',name:'Local files',type:'music',available:true}];
  return null;
};
window.WebSocket=class extends EventTarget{
 static OPEN=1;
 constructor(){super();this.readyState=0;setTimeout(()=>{this.readyState=1;this.dispatchEvent(new Event('open'));},5);}
 close(){this.readyState=3;this.dispatchEvent(new Event('close'));}
 async send(raw){const msg=JSON.parse(raw);try{const result=await dispatch(msg.command,msg.args);this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({message_id:msg.message_id,result})}));}catch(e){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({message_id:msg.message_id,error:{message:e.message}})}));}}
};
window.retro={getSettings:async()=>({serverUrl:'http://fixture:8095',hasToken:true,themeId:'vinyl-lounge',playerId:'desk',localAudio:false}),getAudioConfig:async()=>({enabled:false}),selectPlayer:async()=>{},selectTheme:async()=>{},setCompact:async()=>{},image:async()=>null,artistImage:async()=>null,command:(name,args)=>dispatch(${JSON.stringify(COMMANDS)}[name],args)};
`;
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const win=new BrowserWindow({show:false,width:1000,height:950,webPreferences:{contextIsolation:true,sandbox:false,backgroundThrottling:false,offscreen:true}});
 const errors=[];win.webContents.on('console-message',event=>{if(event.level==='error'){errors.push(event.message);console.error('Renderer:',event.message);}});
 await win.loadURL('about:blank');win.webContents.debugger.attach('1.3');await win.webContents.debugger.sendCommand('Page.enable');await win.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument',{source:fixture});
 const js=async source=>{try{return await win.webContents.executeJavaScript(/\bawait\s/.test(source)?`(async()=>{${source}})()`:source,true);}catch(error){console.error('Failed script:',source);throw error;}};
 async function until(source){for(let i=0;i<80;i++){if(await js(source))return;await sleep(50);}console.error(await js(`({ready:document.readyState,connected:state.connected,message:$('message').textContent,results:$('results').textContent,commands:window.sent})`));throw Error('Timed out: '+source);}
 for(const edition of ['web','desktop']){
  await win.loadFile(path.join(root,edition==='web'?'web/index.html':'index.html'));
  if(edition==='web')await js(`$('serverUrl').value='http://fixture:8095';$('token').value='fixture';$('settingsForm').requestSubmit();`);
  await until(`state.connected && $('results').textContent.includes('Fixture album')`);
  assert.ok(await js(`$('audioQualityDetails').textContent.includes('96 kHz') && $('audioQualityDetails').textContent.includes('24-bit')`));
  await js(`document.querySelector('[data-view="album"]').click()`);await until(`listening.view.kind==='album' && document.querySelector('.music-card')`);
  await js(`document.querySelector('.music-card-content').click()`);await until(`listening.view.kind==='detail' && $('results').textContent.includes('Track 1')`);
  for(const [title,mode] of [['Play next','next'],['Play now','replace'],['Add to end','add']]){
    await js(`document.querySelector('.music-card-actions button[title^=${JSON.stringify(title)}]').click()`);
    await until(`sent.some(m=>m.command==='player_queues/play_media'&&m.args.option===${JSON.stringify(mode)})`);
  }
  // Reinitialize queue so the enqueue action above doesn't affect removal assertions.
  await js(`queueItems=[1,2,3,4].map(i=>({...makeTrack(i),queue_item_id:'q'+i}));await refresh();`);
  assert.equal(await js(`document.querySelectorAll('.queue-select:disabled').length`),2,'buffered and playing rows locked');
  await js(`$('clearUpcoming').click()`);await until(`!listening.queueBusy && queueItems.length===2`);
  assert.deepEqual(await js(`queueItems.map(i=>i.uri)`),['library://track/1','library://track/2']);
  await js(`$('undoQueue').click()`);await until(`!listening.queueBusy && queueItems.length===4`);
  assert.deepEqual(await js(`queueItems.map(i=>i.uri)`),[1,2,3,4].map(i=>'library://track/'+i));
  await js(`$('clearUpcoming').click()`);await until(`!listening.queueBusy && queueItems.length===2`);
  await js(`queueItems.push({...makeTrack(9),queue_item_id:'external'});$('undoQueue').click()`);await sleep(200);
  assert.equal(await js(`queueItems.length`),3,'stale undo must not mutate the queue');
  await js(`failDelete=true;$('clearUpcoming').click()`);await sleep(180);assert.equal(await js(`listening.queueBusy`),false,'failure releases queue controls');await js(`failDelete=false`);
  // Queue paging includes entries beyond the first server page.
  await js(`window.savedQueueItems=queueItems;queueItems=Array.from({length:205},(_,i)=>({...makeTrack(i+1),queue_item_id:'paged'+i}));`);
  assert.equal(await js(`listening.queueItems('desk').then(items=>items.length)`),205);
  await js(`queueItems=savedQueueItems;await refresh();`);
  // Search: provider scope, library-only, expanding results, and stale response suppression.
  await js(`$('searchInput').value='piano';await search();`);assert.equal(await js(`document.querySelectorAll('.music-card').length`),32);
  await js(`$('libraryMore').click()`);await until(`document.querySelectorAll('.music-card').length===62`);
  await js(`$('libraryOnly').checked=true;$('libraryOnly').dispatchEvent(new Event('change'))`);await sleep(100);
  assert.deepEqual(await js(`sent.filter(m=>m.command==='music/search').at(-1).args.providers`),['library']);
  await js(`$('libraryOnly').checked=false;$('searchProvider').value='files';$('searchProvider').dispatchEvent(new Event('change'))`);await sleep(100);
  assert.deepEqual(await js(`sent.filter(m=>m.command==='music/search').at(-1).args.providers`),['files']);
  await js(`$('searchInput').value='slow';search();$('searchInput').value='latest';$('searchInput').dispatchEvent(new Event('input'));`);await sleep(1000);
  assert.ok(await js(`$('results').textContent.includes('latest 1')&&!$('results').textContent.includes('slow 1')`));
  assert.ok(await js(`$('recentSearches').textContent.includes('piano')`));
  // Playlist browsing, provider-position edits, creation, and queue export.
  await js(`document.querySelector('[data-view="playlist"]').click()`);await until(`listening.view.kind==='playlist' && $('results').textContent.includes('Editable mix')`);
  await js(`document.querySelector('.music-card-content').click()`);await until(`listening.view.kind==='detail' && $('results').textContent.includes('Track 3')`);
  await js(`document.querySelector('.music-card-actions button[title="Move down in playlist"]').click()`);await until(`sent.some(m=>m.command==='music/playlists/move_playlist_track')`);
  await sleep(100);assert.equal(await js(`songs[0].item_id`),'2');
  await js(`document.querySelector('.music-card-actions button[title="Remove"]').click()`);await until(`songs.length===2`);
  await js(`document.querySelector('[data-view="playlist"]').click()`);await sleep(100);await js(`document.querySelector('#listeningContext button[title="New playlist"]').click();document.querySelector('#listeningDialog input').value='New mix';document.querySelector('#listeningDialog form').requestSubmit()`);await until(`playlists.some(p=>p.name==='New mix')`);
  await js(`$('saveQueuePlaylist').click();document.querySelector('#listeningDialog input').value='Queue snapshot';document.querySelector('#listeningDialog form').requestSubmit()`);await until(`sent.some(m=>m.command==='music/playlists/add_playlist_tracks') && !$('listeningDialog').open`);
  assert.deepEqual(await js(`sent.filter(m=>m.command==='music/playlists/add_playlist_tracks').at(-1).args.uris`),['library://track/1','library://track/2','library://track/9']);
  // A track can be added to an existing editable playlist from its actions menu.
  await js(`await listening.browse(playlist);document.querySelector('.music-card-actions button[title^="More actions"]').click();[...document.querySelectorAll('#listeningDialog button')].find(b=>b.textContent==='Add to playlist').click();`);
  await until(`[...document.querySelectorAll('#listeningDialog button')].some(b=>b.textContent==='Editable mix')`);
  await js(`[...document.querySelectorAll('#listeningDialog button')].find(b=>b.textContent==='Editable mix').click()`);
  await until(`!$('listeningDialog').open`);
  assert.equal(await js(`sent.filter(m=>m.command==='music/playlists/add_playlist_tracks').at(-1).args.db_playlist_id`),'7');
  // Read-only playlists cannot mutate their source.
  await js(`playlist.is_editable=false;await listening.browse(playlist)`);
  assert.equal(await js(`document.querySelectorAll('.music-card-actions button[title="Remove"]').length`),0);
  // Presets retain media, selected output, volume and shuffle.
  await js(`document.querySelector('.music-card-actions button[title^="More actions"]').click();[...document.querySelectorAll('#listeningDialog button')].find(b=>b.textContent==='Save listening preset').click();`);
  await js(`document.querySelector('#listeningDialog input').value='Focus';document.querySelector('#listeningDialog [name="output"]').value='kitchen';document.querySelector('#listeningDialog [name="level"]').value=18;document.querySelector('#listeningDialog [name="randomize"]').checked=true;document.querySelector('#listeningDialog form').requestSubmit()`);await sleep(100);
  await js(`document.querySelector('[data-view="presets"]').click()`);await until(`$('results').textContent.includes('Focus')`);await js(`document.querySelector('.preset-card button').click()`);await until(`state.playerId==='kitchen' && sent.some(m=>m.command==='players/cmd/volume_set'&&m.args.volume_level===18)`);
  assert.ok(await js(`sent.some(m=>m.command==='player_queues/play_media'&&m.args.queue_id==='kitchen'&&m.args.shuffle===true)`));
  await js(`document.querySelector('[data-view="discover"]').click()`);await until(`$('results').textContent.includes('Forgotten favorites')`);await js(`document.querySelector('.music-card button').click()`);await until(`$('results').textContent.includes('Track 88')`);
  // A capability/permission error remains visible and another view is still usable.
  await js(`failLibrary=true;document.querySelector('[data-view="album"]').click()`);await until(`$('libraryStatus').textContent.includes('Library permission denied')`);
  await js(`failLibrary=false;document.querySelector('[data-view="home"]').click()`);await until(`$('results').textContent.includes('Fixture album')`);
  if(edition==='web')await js(`showPage('libraryPage')`);
  for(const width of edition==='web'?[320,390,820]:[930]){
    win.setContentSize(width,950);await sleep(100);
    assert.equal(await js(`document.documentElement.scrollWidth>innerWidth`),false,edition+' horizontal overflow '+width);
    fs.writeFileSync(path.join(out,edition+'-library-'+width+'.png'),(await win.webContents.capturePage()).toPNG());
  }
  console.log('PASS '+edition+': library, queue lock/removal/undo/failure, enqueue modes, search races/scopes/more, playlists, presets, discovery, audio details, responsive layouts');
 }
 assert.deepEqual(errors,[],'renderer errors');win.destroy();
}
app.whenReady().then(main).then(()=>app.quit()).catch(e=>{console.error(e);app.exit(1);});
