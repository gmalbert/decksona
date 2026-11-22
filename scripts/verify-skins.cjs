// Render and exercise the actual web app in Electron's Chromium at phone/desktop sizes.
// Music Assistant is a deterministic in-page WebSocket fixture; no real player is changed.
const { app, BrowserWindow } = require('electron');
app.disableHardwareAcceleration();
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { SIGNATURE_THEMES, THEMES } = require('../themes');
const generatePreviews = process.argv.includes('--generate-previews');
const root = path.resolve(__dirname,'..');
const out = path.join(root,'output','skin-previews');
fs.mkdirSync(out,{recursive:true});
const log = text=>fs.appendFileSync(path.join(out,'runner.log'),`${new Date().toISOString()} ${text}\n`);
log('runner loaded');
const port = 18787;
let server;
const fixture = `
  window.fixtureCommands=[];
  const savedStations=[];
  window.fixtureRadioCommand=(command,args)=>{
    if(command==='music/radios/library_items')return savedStations;
    if(command==='builtin/add_radio'){
      if(args.url.endsWith('/offline'))throw new Error('Stream unavailable');
      const station={name:args.name,uri:'builtin://radio/vinyl',media_type:'radio',available:true};
      savedStations.splice(0,savedStations.length,{...station,uri:'library://radio/1'});
      return station;
    }
  };
  const track={queue_item_id:'one',name:'Night Bloom',duration:276,uri:'demo://track/one',media_type:'track',artists:[{name:'Luna Vale'}],album:{name:'After the Last Light'},metadata:{images:[{proxy_id:'fixture'}]}};
  const second={...track,queue_item_id:'two',name:'Midnight Grove',uri:'demo://track/two'};
  window.fixtureQueue={queue_id:'living-room',state:'playing',active:true,current_item:track,current_index:0,index_in_buffer:0,elapsed_time:134,shuffle_enabled:false,repeat_mode:'off'};
  window.fixturePlayer={player_id:'living-room',name:'Living Room',enabled:true,available:true,volume_level:42};
  window.WebSocket=class extends EventTarget {
    static OPEN=1;
    constructor(){super();this.readyState=0;setTimeout(()=>{this.readyState=1;this.dispatchEvent(new Event('open'));},10);}
    close(){this.readyState=3;this.dispatchEvent(new Event('close'));}
    send(raw){const msg=JSON.parse(raw);window.fixtureCommands.push(msg);
      let result=null;
      if(msg.command==='players/all')result=[window.fixturePlayer,{player_id:'mr-plow',name:'Mr Plow',available:true,enabled:true,volume_level:50}];
      if(msg.command==='player_queues/transfer'){if(window.failTransfer){setTimeout(()=>this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({message_id:msg.message_id,error:{message:'Transfer failed'}})})),5);return;}window.fixtureQueue.queue_id=msg.args.target_queue_id;}
      if(msg.command==='player_queues/all')result=[window.fixtureQueue];
      if(msg.command==='player_queues/items')result=[track,second];
      if(msg.command==='player_queues/play_pause')window.fixtureQueue.state=window.fixtureQueue.state==='playing'?'paused':'playing';
      if(msg.command==='player_queues/shuffle')window.fixtureQueue.shuffle_enabled=msg.args.shuffle_enabled;
      if(msg.command==='player_queues/repeat')window.fixtureQueue.repeat_mode=msg.args.repeat_mode;
      if(msg.command==='player_queues/seek')window.fixtureQueue.elapsed_time=msg.args.position;
      if(msg.command==='players/cmd/volume_set')window.fixturePlayer.volume_level=msg.args.volume_level;
      if(msg.command==='music/search')result={tracks:[track],albums:[],artists:[],playlists:[]};
      try{result=window.fixtureRadioCommand(msg.command,msg.args)??result;}
      catch(error){setTimeout(()=>this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({message_id:msg.message_id,error:{message:error.message}})})),5);return;}
      setTimeout(()=>this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({message_id:msg.message_id,result})})),5);
    }
  };
`;
const cover = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><defs><linearGradient id="a" x2="1" y2="1"><stop stop-color="#171d34"/><stop offset="1" stop-color="#663d4a"/></linearGradient></defs><path fill="url(#a)" d="M0 0h600v600H0z"/><circle cx="390" cy="170" r="100" fill="#f3be7c"/><path d="M0 380Q160 120 340 400T650 270V650H0" fill="#ba745d"/><path d="M0 540Q250 230 600 490V650H0" fill="#e4ab7e"/><path d="M0 600Q140 390 390 600" fill="#753b45"/></svg>`;
const delay = ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
  log('app ready; starting preview server');
  fs.mkdirSync(out,{recursive:true});
  server=spawn('node',[path.join(root,'web/server.js')],{env:{...process.env,DECKSONA_WEB_PORT:String(port)},stdio:'pipe',windowsHide:true});
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Preview server startup timed out')),10000);
    server.stdout.once('data',()=>{log('server ready');clearTimeout(timer);resolve();});
    server.stderr.on('data',data=>console.error(String(data)));
    server.once('error',reject);server.once('exit',code=>reject(new Error(`Preview server exited ${code}`)));
  });
  const win=new BrowserWindow({show:false,width:1100,height:900,webPreferences:{contextIsolation:true,sandbox:false,backgroundThrottling:false,offscreen:true}});
  log('browser created');
  const errors=[];
  win.webContents.on('console-message',event=>{if(event.level==='error'&&!/favicon/.test(event.message)){errors.push(event.message);log(`browser: ${event.message}`);}});
  await win.loadURL('about:blank');
  win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Page.enable');
  await win.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument',{source:fixture});
  await win.webContents.debugger.sendCommand('Fetch.enable',{patterns:[{urlPattern:'*/imageproxy/fixture*'}]});
  win.webContents.debugger.on('message',(_event,method,params)=>{
    if(method==='Fetch.requestPaused') win.webContents.debugger.sendCommand('Fetch.fulfillRequest',{requestId:params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'image/svg+xml'}],body:Buffer.from(cover).toString('base64')}).catch(e=>errors.push(e.message));
  });
  const js=source=>win.webContents.executeJavaScript(/\bawait\s/.test(source)?`(async()=>{${source}})()`:source,true);
  async function verifyRadio(commands, durationId, edition) {
    const station = { name: 'Record player', url: 'http://192.168.1.50:8000/vinyl' };
    const pending = async condition => {
      for (let attempt = 0; attempt < 50; attempt++) {
        if (await js(condition)) return;
        await delay(20);
      }
      assert.fail(`${edition}: radio UI did not reach ${condition}`);
    };
    await js(`$('radioOpen').click()`);
    await pending(`$('radioDialog').open && !$('radioSave').disabled`);
    assert.match(await js(`$('radioStatus').textContent`), /No saved radio stations/);
    await js(`$('radioName').value='Record player';$('radioUrl').value='ftp://host/vinyl';$('radioForm').requestSubmit();`);
    assert.match(await js(`$('radioError').textContent`), /https/);
    await js(`$('radioUrl').value='http://192.168.1.50:8000/offline';$('radioForm').requestSubmit();`);
    await pending(`$('radioError').textContent==='Stream unavailable' && !$('radioSave').disabled`);
    assert.equal(await js(`$('radioName').value`), station.name);
    await js(`$('radioUrl').value=${JSON.stringify(station.url)};$('radioForm').requestSubmit();`);
    await pending(`$('radioStatus').textContent==='Record player added.'`);
    assert.deepEqual(await js(`window.fixtureCommands.filter(msg=>msg.command===${JSON.stringify(commands.add)}).at(-1).args`), station);
    await js(`$('radioClose').click();$('radioOpen').click();`);
    await pending(`$('radioStations').querySelector('button')?.getAttribute('aria-label')==='Play Record player'`);
    const clipped = await js(`[...$('radioForm').querySelectorAll('button,input')].some(node=>{const rect=node.getBoundingClientRect();return rect.left<0||rect.right>innerWidth;})`);
    assert.equal(clipped, false, `${edition}: clipped radio controls`);
    await js(`$('radioStations').querySelector('button').click();`);
    await pending(`window.fixtureCommands.some(msg=>msg.command===${JSON.stringify(commands.play)}&&msg.args.media==='library://radio/1')`);
    assert.deepEqual(await js(`window.fixtureCommands.find(msg=>msg.command===${JSON.stringify(commands.play)}&&msg.args.media==='library://radio/1').args`), {
      queue_id: 'living-room', media: 'library://radio/1', option: 'replace'
    });
    assert.deepEqual(await js(`(()=>{const original=state.queue;state.queue={active:true,current_item:{media_item:{media_type:'radio',duration:86400}}};renderProgress();const live=$('${durationId}').textContent;const disabled=$('seek').disabled;state.queue=original;renderProgress();return {live,disabled};})()`), { live: 'LIVE', disabled: true });

    const albumId = edition === 'web' ? 'trackAlbum' : 'trackMeta';
    const updates = await js(`(()=>{
      const originalQueue=state.queue, originalPlayer=state.player;
      const item={queue_item_id:'vinyl',name:'Vinyl - Now Playing',media_item:{media_type:'radio',name:'Vinyl - Now Playing'}};
      state.queue={active:true,state:'playing',current_item:item};
      const read=()=>{renderPlayer();return [$('trackTitle').textContent,$('trackArtist').textContent,$('${albumId}').textContent];};
      const fallback=read();
      item.streamdetails={stream_title:'Roy Haynes Quartet - Snap Crackle'};
      const legacy=read();
      item.streamdetails={stream_metadata:{title:'Moon Dance - Live',artist:'The Quartet',album:'Live Sessions'}};
      const structured=read();
      item.streamdetails={stream_metadata:{title:'Snap Crackle',artist:'Roy Haynes Quartet'}};
      state.player={...state.player,current_media:{queue_item_id:'vinyl',title:'Snap Crackle',artist:'Roy Haynes Quartet',album:'Out of the Afternoon'}};
      const enriched=read();
      item.streamdetails={stream_metadata:{title:'Another Song',artist:'Another Artist'}};
      const nextTrack=read();
      item.streamdetails={};
      state.player={...state.player,current_media:{queue_item_id:'vinyl',title:'Another Song',artist:'Another Artist',album:'Another Album'}};
      const fromPlayer=read();
      item.queue_item_id='other-station';
      const afterSwitch=read();
      state.queue=originalQueue;state.player=originalPlayer;renderPlayer();
      return {fallback,legacy,structured,enriched,nextTrack,fromPlayer,afterSwitch};
    })()`);
    const title = value => edition === 'web' ? value : value.toUpperCase();
    const missingAlbum = edition === 'web' ? '' : 'MA DIGITAL AUDIO';
    const stationOnly = [title('Vinyl - Now Playing'), 'Live radio', missingAlbum];
    assert.deepEqual(updates, {
      fallback: stationOnly,
      legacy: [title('Snap Crackle'), 'Roy Haynes Quartet', missingAlbum],
      structured: [title('Moon Dance - Live'), 'The Quartet', 'Live Sessions'],
      enriched: [title('Snap Crackle'), 'Roy Haynes Quartet', 'Out of the Afternoon'],
      nextTrack: [title('Another Song'), 'Another Artist', missingAlbum],
      fromPlayer: [title('Another Song'), 'Another Artist', 'Another Album'],
      afterSwitch: stationOnly
    });

    const coverId = edition === 'web' ? 'cover' : 'nowPlayingArt';
    await delay(60);
    await pending('!state.refreshing');
    const artUpdates = await js(`return await (async ()=>{
      const savedQueue=state.queue, savedPlayer=state.player;
      const base='http://127.0.0.1:${port}';
      const img=$('${coverId}');
      const item={queue_item_id:'vinyl',name:'Vinyl - Now Playing',media_item:{media_type:'radio'}};
      state.refreshing=true;
      state.queue={active:true,state:'playing',current_item:item};
      state.player=null;
      try {
        item.streamdetails={stream_metadata:{title:'Gentle Flower',artist:'Marco Biondo',album:'Dream of Love, Vol. 2',image_url:'/imageproxy/fixture-vinyl-one'}};
        const read=async expected=>{
          renderPlayer();
          for(let i=0;i<50;i++){
            if(!img.hidden && img.complete && img.naturalWidth && img.src===base+expected) return img.src;
            await new Promise(resolve=>setTimeout(resolve,20));
          }
          return img.hidden ? '' : img.src;
        };
        const first=await read('/imageproxy/fixture-vinyl-one');
        item.streamdetails={stream_metadata:{title:'Next Song',artist:'Other Artist'}};
        state.player={current_media:{queue_item_id:'vinyl',title:'Next Song',artist:'Other Artist',image_url:base+'/imageproxy/fixture-vinyl-two'}};
        const next=await read('/imageproxy/fixture-vinyl-two');
        item.streamdetails={stream_metadata:{title:'Track without art'}};
        renderPlayer();
        const cleared=img.hidden && !img.hasAttribute('src');
        return {first,next,cleared};
      } finally {
        state.queue=savedQueue;state.player=savedPlayer;state.refreshing=false;renderPlayer();
      }
    })()`);
    assert.deepEqual(artUpdates, {
      first: `http://127.0.0.1:${port}/imageproxy/fixture-vinyl-one`,
      next: `http://127.0.0.1:${port}/imageproxy/fixture-vinyl-two`,
      cleared: true
    }, `${edition}: update artwork within one radio queue item`);
  }
  async function savePreview(edition,theme) {
    await delay(160);
    const rect = await js(`(()=>{const first=document.querySelector(${JSON.stringify(edition==='web'?'.player-card':'.deck')}).getBoundingClientRect();const last=document.querySelector(${JSON.stringify(edition==='web'?'.output-panel':'.deck')}).getBoundingClientRect();return {x:Math.floor(first.x),y:Math.floor(first.y),width:Math.ceil(first.width),height:Math.ceil(last.bottom-first.y)};})()`);
    const dir=path.join(root,edition==='web'?'web':'','skin-previews',edition);
    fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,`${theme.id}.jpg`),(await win.webContents.capturePage(rect)).toJPEG(91));
  }
  await Promise.race([win.loadURL(`http://127.0.0.1:${port}`),delay(20000).then(()=>{throw new Error('Browser page load timed out');})]);
  log('web app loaded');
  await js(`$('serverUrl').value='http://127.0.0.1:${port}';$('token').value='fixture-only';$('settingsForm').requestSubmit();`);
  for(let i=0;i<30;i++){if(await js(`$('connection').textContent==='CONNECTED'&&!$('cover').hidden`))break;await delay(100);}
  log(JSON.stringify(await js(`({title:$('trackTitle').textContent,error:$('connectError').textContent,commands:window.fixtureCommands,skin:document.documentElement.dataset.skin})`)));
  assert.equal(await js(`$('trackTitle').textContent`),'Night Bloom');
  assert.equal(await js(`document.querySelectorAll('.theme-card').length`),57);
  // Selection only reads the other queue; transfer must be explicit.
  await js(`selectSessionPlayer('mr-plow')`);
  assert.equal(await js(`window.fixtureCommands.filter(m=>m.command==='player_queues/transfer').length`),0);
  await js(`selectSessionPlayer('living-room')`);
  await js(`document.querySelector('.session-tools button').click();document.getElementById('transferCancel').click()`);
  assert.equal(await js(`window.fixtureCommands.filter(m=>m.command==='player_queues/transfer').length`),0);
  for(const playing of [true,false]) {
    await js(`window.fixtureQueue.state=${JSON.stringify('PLACEHOLDER')};window.failTransfer=false;` .replace('"PLACEHOLDER"',JSON.stringify(playing?'playing':'paused')));
    await js(`document.querySelector('.session-tools button').click();$('transferTarget').value='mr-plow';document.querySelector('.transfer-dialog form').requestSubmit();`);
    await delay(180);
    assert.equal(await js(`state.playerId`),'mr-plow');
    const sent=await js(`window.fixtureCommands.filter(m=>m.command==='player_queues/transfer').at(-1).args`);
    assert.deepEqual(sent,{source_queue_id:'living-room',target_queue_id:'mr-plow',auto_play:playing});
    await js(`window.fixtureQueue.queue_id='living-room';selectSessionPlayer('living-room')`);
  }
  await js(`window.failTransfer=true;document.querySelector('.session-tools button').click();$('transferTarget').value='mr-plow';document.querySelector('.transfer-dialog form').requestSubmit();`);
  await delay(180);
  assert.equal(await js(`state.playerId`),'living-room');
  assert.equal(await js(`$('transferError').hidden`),false);
  await js(`$('transferCancel').click();window.failTransfer=false;window.fixtureQueue.state='playing';refresh()`);
  for(let i=0;i<30 && await js(`$('cover').hidden`);i++)await delay(100);
  const report=[];
  for(const width of [320,390,820,1100]) {
    win.setContentSize(width,950);
    for(const theme of generatePreviews&&width===1100?THEMES:SIGNATURE_THEMES) {
      const result=await js(`(()=>{
        applyTheme(${JSON.stringify(theme.id)});
        const nodes=[...document.querySelectorAll('.player-card button,.player-card input,.output-panel select,.output-panel input,.phone-audio-panel button,.tabbar button')];
        const failures=nodes.filter(n=>{const r=n.getBoundingClientRect();return r.width<=0||r.left < -1||r.right>innerWidth+1;}).map(n=>n.id||n.outerHTML.slice(0,80));
        return {skin:document.documentElement.dataset.skin,overflow:document.documentElement.scrollWidth>innerWidth,failures,artVisible:!$('cover').hidden,background:getComputedStyle(document.querySelector('.player-card')).backgroundImage};
      })()`);
      assert.equal(result.skin,theme.signature?theme.id:''); assert.equal(result.overflow,false,`${width} ${theme.id} page overflow`);
      assert.deepEqual(result.failures,[],`${width} ${theme.id} clipped controls`);assert.equal(result.artVisible,true);
      if(theme.signature) assert.ok(result.background.includes(`${theme.id}.svg`));
      if(generatePreviews&&width===1100) await savePreview('web',theme);
      if(width===390||width===1100) {
        await delay(80);
        fs.writeFileSync(path.join(out,`${theme.id}-${width}.png`),(await win.webContents.capturePage()).toPNG());
      }
      report.push({theme:theme.id,width,status:'pass'});
    }
  }
  // Actual picker click → application → storage → reload, then restore an old skin.
  await js(`$('skinsOpen').click();document.querySelector('[data-theme-id="vinyl-lounge"]').click();$('skinsClose').click();`);
  if(!generatePreviews) await js(`Promise.all([...document.querySelectorAll('.theme-player-preview')].map(img=>{img.loading='eager';return img.decode()}))`);
  assert.equal(await js(`localStorage.getItem('decksona.theme')`),'vinyl-lounge');
  await win.reload(); await delay(350);
  assert.equal(await js(`document.documentElement.dataset.skin`),'vinyl-lounge');
  for(const action of [
    `$('playPause').click()`, `$('shuffle').click()`, `$('repeat').click()`,
    `$('seek').value=500;$('seek').dispatchEvent(new Event('change'))`,
    `$('volume').value=61;$('volume').dispatchEvent(new Event('change'))`
  ]) { await js(action); await delay(100); }
  const sent=await js(`window.fixtureCommands.map(m=>m.command)`);
  for(const command of ['player_queues/play_pause','player_queues/shuffle','player_queues/repeat','player_queues/seek','players/cmd/volume_set'])assert.ok(sent.includes(command),command);
  await js(`document.querySelector('[data-page="libraryPage"]').click();$('searchInput').value='Night';$('searchForm').requestSubmit();`);await delay(100);
  assert.equal(await js(`$('results').querySelector('.music-card-copy strong').textContent`),'Night Bloom');
  // The library has different intrinsic-width constraints than the player.
  // Exercise it explicitly with long metadata and both one- and two-button rows.
  await js(`
    state.results=[
      {name:'Coming Home — a deliberately long track title to exercise truncation',artists:[{name:'Leon Bridges'}],album:{name:'Coming Home — extended album title'},media_type:'track',uri:'demo://track/one'},
      {name:'Coming Home — Deluxe Edition with bonus recordings',artists:[{name:'Leon Bridges'}],media_type:'album',uri:'demo://album/one'},
      {name:'Leon Bridges and the extended artist name for a narrow screen',media_type:'artist',uri:'demo://artist/one'}
    ];
    window.responsiveLibraryItems=state.results;
    window.responsiveSearch=request;request=async(command,args)=>command==='music/search'?{tracks:window.responsiveLibraryItems}:window.responsiveSearch(command,args);
    $('searchInput').value='Coming Home';await search();
  `);
  let libraryChecks=0;
  for(const width of [320,360,375,390,414,430,480,820,1100]) {
    win.setContentSize(width,950);
    for(const theme of [...SIGNATURE_THEMES,THEMES.find(theme=>theme.id==='ocean-grid')]) {
      const result=await js(`(()=>{
        applyTheme(${JSON.stringify(theme.id)});showPage('libraryPage');
        const controls=[...document.querySelectorAll('.topbar button,.search-form input,.search-form button,.filters button,.listening-options input,.listening-options select:not([hidden]),.listening-context button,#results .music-card-actions button')];
        const clipped=controls.filter(node=>{if(node.closest('[hidden]'))return false;const r=node.getBoundingClientRect(),panel=node.closest('.panel')?.getBoundingClientRect();return !r.width||r.left < -1||r.right>innerWidth+1||(panel&&r.right>panel.right);}).map(node=>node.id||node.getAttribute('aria-label')||node.textContent);
        return {overflow:document.documentElement.scrollWidth>innerWidth,clipped,inputSize:parseFloat(getComputedStyle($('searchInput')).fontSize)};
      })()`);
      assert.equal(result.overflow,false,`library ${width} ${theme.id}: horizontal page overflow`);
      assert.deepEqual(result.clipped,[],`library ${width} ${theme.id}: clipped controls`);
      assert.ok(result.inputSize>=16,`library ${width}: search must not trigger Safari input zoom`);
      libraryChecks++;
    }
    if(width===390) {
      await js(`applyTheme('ocean-grid')`);
      await delay(100);
      fs.writeFileSync(path.join(out,'library-mobile-390.png'),(await win.webContents.capturePage()).toPNG());
    }
  }
  const beforeAdd=await js(`window.fixtureCommands.filter(message=>message.command==='player_queues/play_media').length`);
  await js(`document.querySelector('#results .music-card-actions button[title^="Add to end"]').click()`);await delay(100);
  assert.equal(await js(`window.fixtureCommands.filter(message=>message.command==='player_queues/play_media').length`),beforeAdd+1,'visible Add button still queues music');
  win.setContentSize(320, 740);
  await verifyRadio({ add: 'builtin/add_radio', play: 'player_queues/play_media' }, 'duration', 'web');
  win.setContentSize(1100, 950);
  await js(`document.querySelector('[data-page="queuePage"]').click()`);await delay(100);
  assert.equal(await js(`$('queueList').children.length`),2);
  await js(`showPage('playerPage');$('cover').hidden=true;applyTheme('moss-mist')`);
  assert.equal(await js(`getComputedStyle(document.querySelector('.art-empty')).display`),'flex');
  await js(`applyTheme('ocean-grid')`);
  assert.equal(await js(`document.documentElement.dataset.skin`),'');
  assert.equal(await js(`getComputedStyle(document.querySelector('.art-empty')).display`),'none');
  // Exercise the actual desktop renderer too, with a minimal IPC boundary fixture.
  await win.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument',{source:`window.retro={getSettings:async()=>({themeId:'vinyl-lounge',serverUrl:'',hasToken:false,playerId:''}),selectTheme:async id=>id,setCompact:async()=>{},command:async()=>[],image:async()=>null,artistImage:async()=>null};`});
  await win.loadFile(path.join(root,'index.html'));
  await delay(100);
  await js(`$('settingsDialog').close();$('trackTitle').textContent='Night Bloom';$('trackArtist').textContent='Luna Vale';$('nowPlayingArt').src=${JSON.stringify('data:image/svg+xml;base64,'+Buffer.from(cover).toString('base64'))};$('nowPlayingArt').hidden=false;`);
  await js(`state.serverUrl='http://127.0.0.1:${port}';state.playerId='living-room';window.retro.command=async(command,args)=>{
    window.fixtureCommands.push({command,args});
    return window.fixtureRadioCommand({radioStations:'music/radios/library_items',addRadio:'builtin/add_radio'}[command],args)??[];
  };void 0;`);
  await verifyRadio({ add: 'addRadio', play: 'playMedia' }, 'durationDisplay', 'desktop');
  await js(`state.queue={active:true,state:'paused',elapsed_time:134,current_item:{duration:276}};renderProgress();$('trackMeta').textContent='After the Last Light';$('playerSelect').replaceChildren(new Option('Living Room','demo'));$('volume').disabled=false;$('volume').value=42;$('volumeValue').textContent='42';$('connectionStatus').textContent='● PREVIEW';`);
  assert.equal(await js(`document.querySelectorAll('.theme-card').length`),57);
  if(!generatePreviews) await js(`Promise.all([...document.querySelectorAll('.theme-player-preview')].map(img=>{img.loading='eager';return img.decode()}))`);
  for(const mode of ['full','compact','mini']) {
    win.setContentSize(mode==='mini'?316:mode==='compact'?660:930,mode==='mini'?620:mode==='compact'?360:740);
    for(const theme of THEMES) {
      const result=await js(`(()=>{
        applyTheme(${JSON.stringify(theme.id)});layout.compact=${mode!=='full'};layout.mini=${mode==='mini'};renderLayout();
        return [...document.querySelectorAll('.transport button,.output-row select')].filter(n=>{const r=n.getBoundingClientRect();return !r.width||r.left<0||r.right>innerWidth;}).map(n=>n.id);
      })()`);
      assert.deepEqual(result,[],`desktop ${mode} ${theme.id}`);
      if(mode!=='full'){const overflow=await js(`(()=>{const shell=document.querySelector('.shell'),deck=document.querySelector('.deck');return {shell:shell.scrollHeight>shell.clientHeight+1,deck:deck.scrollHeight>deck.clientHeight+1}})()`);assert.deepEqual(overflow,{shell:false,deck:false},`default ${mode} scroll ${theme.id}`);}
      assert.equal(await js(`document.querySelector('.shell').classList.contains('compact')`),mode!=='full');
      if(generatePreviews&&mode==='full') await savePreview('desktop',theme);
      if(theme.id==='vinyl-lounge') {await delay(200);fs.writeFileSync(path.join(out,`desktop-${mode}.png`),(await win.webContents.capturePage()).toPNG());}
    }
  }
  if(!generatePreviews) assert.equal(errors.length,0,errors.join('\n'));
  if(generatePreviews) {
    await win.reload();await delay(200);
    await js(`$('settingsDialog').close();layout.compact=false;layout.mini=false;renderLayout();applyTheme('vinyl-lounge');$('themesDialog').showModal();`);
    win.setContentSize(1100,950);
    await delay(400);
    assert.equal(await js(`document.querySelector('.theme-player-preview').naturalWidth>0`),true);
    fs.writeFileSync(path.join(out,'desktop-gallery.png'),(await win.webContents.capturePage()).toPNG());
    console.log('Generated 57 desktop and 57 web previews from the actual player interfaces.');
  }
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks:report,libraryChecks,interactions:'picker, persistence, play/pause, shuffle, repeat, seek, volume, library search/add button and responsive widths, radio creation and playback, queue, missing art, classic reset',errors},null,2));
  console.log(`PASS: ${report.length} web theme/viewport combinations, ${libraryChecks} library layouts, desktop theme/mode combinations, and radio creation and playback in both editions. Screenshots: ${out}`);
  win.destroy();
}
app.whenReady().then(main).then(()=>{log('complete');server?.kill();app.quit();}).catch(error=>{log(error.stack);console.error(error);server?.kill();app.exit(1);});
