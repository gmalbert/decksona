// Real web app + encrypted Sendspin server. Uses the mobile media-element audio
// path in Chromium; physical Safari lock-screen behavior requires an iPhone.
const { app, BrowserWindow } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
app.setPath('userData', path.join(root, 'output', 'web-audio-smoke-profile'));
app.disableHardwareAcceleration();
let win;
const logs = [];
const children = [];
const errors = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function spawnFixture(command, args, env) {
  const child = spawn(command, args, { windowsHide: true, env: { ...process.env, ...env } });
  children.push(child);
  child.stdout.on('data', data => logs.push(String(data)));
  child.stderr.on('data', data => logs.push(String(data)));
  child.on('error', error => logs.push(error.message));
  return child;
}
async function until(check, label, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await check()) return; await delay(100); }
  throw new Error(`Timed out: ${label}\n${logs.join('\n')}`);
}
async function main() {
  spawnFixture('python', [path.join(__dirname, 'audio-test-server.py')], { PYTHONPATH: path.join(root, 'output', 'audio-test-python') });
  spawnFixture('node', [path.join(root, 'web', 'server.js')], { DECKSONA_WEB_PORT: '18996' });
  await until(() => logs.some(line => line.includes('READY')) && logs.some(line => line.includes('http://localhost:18996')), 'fixture servers');
  await app.whenReady();
  win = new BrowserWindow({ show: false, width: 390, height: 844, webPreferences: { backgroundThrottling: false, autoplayPolicy: 'document-user-activation-required' } });
  win.webContents.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1');
  win.webContents.on('console-message', event => { logs.push(event.message); if (event.level === 'error') errors.push(event.message); });
  const js = code => win.webContents.executeJavaScript(code, true);
  await win.loadURL('http://127.0.0.1:18996');
  await js(`localStorage.clear(); location.reload()`);
  await until(() => js(`typeof phoneAudio !== 'undefined' && !!$('phoneAudioButton')`), 'web app');
  await js(`$('serverUrl').value='http://127.0.0.1:18995';$('token').value='fixture-only';connect($('serverUrl').value,$('token').value)`);
  assert.equal(await js('phoneAudio.clientId'), '', 'no audio output before a tap');
  await js(`
    window.audioEvidence={buffers:0,peak:0};
    const play=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){this.muted=true;return play.call(this)};
    const makeSource=AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource=function(){
      const source=makeSource.call(this),start=source.start.bind(source);
      source.start=(...args)=>{if(source.buffer){window.audioEvidence.buffers++;for(const sample of source.buffer.getChannelData(0))window.audioEvidence.peak=Math.max(window.audioEvidence.peak,Math.abs(sample));}return start(...args)};
      return source;
    };
    $('phoneSendspinUrl').value='ws://127.0.0.1:18927/sendspin';
    $('phoneAudioButton').click();
  `);
  await until(() => js('window.audioEvidence.buffers > 2 && window.audioEvidence.peak > 0'), 'mobile PCM audio decoded and scheduled');
  await js('refresh()');
  assert.match(await js(`$('playerSelect').selectedOptions[0].textContent`), /This phone/);
  assert.deepEqual(await js(`[...$('playerSelect').options].slice(1).map(option=>option.value)`), ['test-local','remote','remote-z','offline'], 'phone first, other available players alphabetical, offline last');
  assert.equal(await js(`[...$('playerSelect').options].filter(option=>option.textContent.includes('This phone')).length`), 1, 'one phone option without a duplicate connecting placeholder');
  await js(`$('playPause').click()`);
  await until(async () => {
    const status=await(await fetch('http://127.0.0.1:18995/status')).json();
    return status.commands.some(item=>item.command==='player_queues/play_pause'&&item.args.queue_id==='test-local');
  }, 'phone play button targets its Universal Player queue');
  assert.equal(await js(`document.querySelector('#playPause svg').getAttribute('viewBox')`), '0 0 24 24');
  assert.equal(await js(`$('playPause').getAttribute('aria-label')`), 'Play');
  await js(`state.queue={state:'playing'};renderPlayer()`);
  assert.equal(await js(`$('playPause').getAttribute('aria-label')`), 'Pause');
  assert.match(await js(`document.querySelector('#playPause svg path').getAttribute('d')`), /M5 4/);
  assert.equal(await js(`document.querySelector('audio').srcObject instanceof MediaStream`), true);
  const identity = await js('phoneAudio.clientId');
  await js(`(async()=>{
    const originalFetch=window.fetch;
    window.fetch=async(url,...args)=>String(url).startsWith('version.json')?{ok:true,json:async()=>({build:'test-new-release'})}:originalFetch(url,...args);
    await checkForUpdate();window.fetch=originalFetch;
  })()`);
  assert.equal(await js(`$('updateNotice').hidden`), false, 'updates offer an explicit reload');
  assert.equal(await js('phoneAudio.clientId'), identity, 'checking for an update must not interrupt audio');
  await js(`$('updateNotice').hidden=true`);
  const before = await js('window.audioEvidence.buffers');
  await js(`selectSessionPlayer('remote')`);
  assert.equal(await js('phoneAudio.clientId'), identity, 'viewing another player must not disconnect phone audio');
  await until(async () => await js('window.audioEvidence.buffers') > before + 1, 'audio while controlling another output');
  await js(`$('phoneAudioButton').click()`);
  assert.equal(await js('state.playerId'), 'test-local');
  await until(() => js('state.player?.available === true && !state.refreshing'), 'phone queue selected');
  await js(`playMedia({uri:'fixture://track/one'}, 'replace')`);
  const status = await (await fetch('http://127.0.0.1:18995/status')).json();
  assert.equal(status.commands.findLast(item => item.command === 'player_queues/play_media')?.args.queue_id, 'test-local');
  await fetch('http://127.0.0.1:18995/drop', { method: 'POST' });
  await until(() => logs.some(line => line.includes('Attempting to reconnect')), 'automatic Sendspin reconnect');
  assert.equal(await js('phoneAudio.clientId'), identity);
  await until(() => js(`$('phoneAudioStatus').textContent.includes('ready')`), 'reconnected phone');
  await js('stopPhoneAudio()');
  assert.equal(await js('phoneAudio.clientId'), '');
  assert.equal(await js(`document.querySelectorAll('audio').length`), 0);
  await js(`$('phoneAudioButton').click()`);
  assert.equal(await js('phoneAudio.clientId'), identity, 'stable identity after stopping and restarting');
  await js(`$('disconnect').click()`);
  assert.equal(await js('phoneAudio.clientId'), '');
  assert.equal(await js(`localStorage.getItem('decksona.token')`), null);
  // A failed socket is expected when deliberately dropping the connection.
  assert.deepEqual(errors.filter(text => !/WebSocket.*(error|closed)|connection.*lost/i.test(text)), []);
  const result = { passed: true, engine: 'Chromium with iPhone user agent and real media-element output', checks: ['tap before audio activation', 'encrypted PCM stream', 'media-element routing', 'phone first and alphabetical destinations', 'one resolved phone output', 'play/pause SVG states and button command', 'non-disruptive update notice', 'library playback targets phone', 'independent remote control', 'reconnect with stable identity', 'stop and disconnect cleanup'], evidence: await js('window.audioEvidence') };
  fs.writeFileSync(path.join(root, 'output', 'web-audio-report.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
main().then(() => { children.forEach(child => child.kill()); win?.destroy(); app.quit(); }).catch(error => { console.error(error); children.forEach(child => child.kill()); app.exit(1); });
