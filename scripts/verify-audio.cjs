// Exercise the real main/preload/renderer and encrypted Sendspin library against
// a loopback-only Python server. Test buffers are scheduled but not connected to
// physical speakers, so this check never changes the user's music or makes noise.
const { app, BrowserWindow } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const profile = path.join(root, 'output', 'audio-smoke-profile');
fs.mkdirSync(profile, { recursive: true });
const settingsFile = path.join(profile, 'settings.json');
if (fs.existsSync(settingsFile)) fs.unlinkSync(settingsFile);
app.setPath('userData', profile);
app.disableHardwareAcceleration();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const server = spawn('python', [path.join(__dirname, 'audio-test-server.py')], {
  env: { ...process.env, PYTHONPATH: path.join(root, 'output', 'audio-test-python') },
  windowsHide: true,
});
let serverLog = '';
server.stdout.on('data', data => { serverLog += data; });
server.stderr.on('data', data => { serverLog += data; });
let win;
const errors = [];
const rendererLog = [];
async function until(check, label, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await check()) return; await delay(100); }
  throw new Error(`Timed out: ${label}\n${serverLog}\n${rendererLog.join('\n')}`);
}
async function main() {
  await until(() => serverLog.includes('READY'), 'test server');
  require('../main');
  await app.whenReady();
  await until(() => BrowserWindow.getAllWindows().length, 'desktop window');
  win = BrowserWindow.getAllWindows()[0];
  win.hide();
  win.webContents.on('console-message', event => {
    rendererLog.push(event.message);
    if (event.level === 'error') errors.push(event.message);
  });
  await until(() => win.webContents.executeJavaScript(`typeof desktopAudio !== 'undefined' && typeof state !== 'undefined'`), 'renderer');
  const js = code => win.webContents.executeJavaScript(code);
  await js(`
    window.audioEvidence = { buffers: 0, scheduled: 0, peak: 0 };
    const createSource = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function() {
      const source = createSource.call(this);
      const start = source.start.bind(source);
      source.connect = destination => destination;
      source.start = (...args) => {
        window.audioEvidence.scheduled++;
        if (source.buffer) {
          window.audioEvidence.buffers++;
          for (const value of source.buffer.getChannelData(0)) window.audioEvidence.peak = Math.max(window.audioEvidence.peak, Math.abs(value));
        }
        return start(...args);
      };
      return source;
    };
    $('serverUrl').value = 'http://127.0.0.1:18995';
    $('token').value = 'fixture-only';
    $('sendspinUrl').value = 'ws://127.0.0.1:18927/sendspin';
    $('localAudio').checked = true;
    connect();
  `);
  await until(() => js(`window.audioEvidence.buffers > 2 && window.audioEvidence.peak > 0`), 'encrypted audio decoded and scheduled');
  await js('refresh()');
  assert.match(await js(`$('playerSelect').selectedOptions[0]?.textContent || ''`), /This computer/);
  assert.equal(await js('state.playerId'), 'test-local', 'select the Universal Player queue instead of the Sendspin transport ID');
  assert.equal(await js(`[...$('playerSelect').options].filter(option=>option.textContent.includes('This computer')).length`), 1, 'no duplicate connecting placeholder');
  assert.equal(await js(`$('playerSelect').options[1].value`), 'test-local', 'this computer is first after the placeholder');
  await js(`state.playerId='remote';state.queue={queue_id:'remote',current_item:{name:'Fixture track'}};sessions.update();document.querySelector('.session-tools button').click()`);
  assert.equal(await js(`[...$('transferTarget').options].find(option=>option.value==='test-local')?.textContent`), 'This computer · Decksona', 'transfer destinations use the same local label');
  assert.equal(await js(`$('transferTarget').options[1].value`), 'test-local', 'this computer is the first move destination');
  await js(`$('transferCancel').click();state.playerId='test-local';refresh()`);
  const identity = await js('desktopAudio.clientId');
  assert.equal(identity.length, 43);
  const before = await js('window.audioEvidence.buffers');
  win.close();
  assert.equal(win.isDestroyed(), false, 'closing should hide to the tray');
  assert.equal(win.isVisible(), false);
  await until(async () => await js('window.audioEvidence.buffers') > before + 2, 'background audio');
  await js('desktopAudio.stop()');
  await js('startDesktopAudio()');
  assert.equal(await js('desktopAudio.clientId'), identity, 'identity survives recreation');
  await js(`$('localAudio').checked = false; connect()`);
  await until(() => js(`desktopAudio.clientId === ''`), 'disable local audio');
  assert.equal(errors.length, 0, errors.join('\n'));
  const evidence = await js('window.audioEvidence');
  const result = { passed: true, checks: ['real desktop IPC and settings', 'encrypted Sendspin handshake', 'lossless decoding and scheduling', 'This computer selection', 'audio with window closed', 'persistent identity', 'disable cleanup'], evidence };
  fs.writeFileSync(path.join(root, 'output', 'audio-report.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
main().then(() => { server.kill(); app.quit(); }).catch(async error => {
  console.error(error);
  if (win && !win.isDestroyed()) console.error(await win.webContents.executeJavaScript(`JSON.stringify({status: $('localAudioStatus')?.textContent, message: $('message')?.textContent, id: desktopAudio?.clientId, state})`).catch(() => 'renderer unavailable'));
  server.kill(); app.exit(1);
});
