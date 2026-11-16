const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const { sendspinUrl } = require('../local-audio-config');

test('derives a separate local Sendspin endpoint without leaking API credentials', () => {
  assert.equal(sendspinUrl('http://192.168.1.10:8095'), 'ws://192.168.1.10:8927/sendspin');
  assert.equal(sendspinUrl('https://ma.example.com'), 'ws://ma.example.com:8927/sendspin');
  assert.equal(sendspinUrl('http://[::1]:8095'), 'ws://[::1]:8927/sendspin');
  assert.equal(sendspinUrl('http://ma:8095', 'wss://audio.example.com/sendspin'), 'wss://audio.example.com/sendspin');
  for (const endpoint of ['https://ma:8927/sendspin', 'ws://user:secret@ma/sendspin', 'ws://ma/sendspin?token=secret', 'file:///tmp/audio']) {
    assert.throws(() => sendspinUrl('http://ma:8095', endpoint));
  }
});

function harness() {
  const timers = new Map();
  const clock = { time: 0 };
  const context = { window: {}, console, TextEncoder, TextDecoder, btoa, atob, Date: class extends Date { static now() { return clock.time; } }, setInterval: fn => { const id = Symbol(); timers.set(id, fn); return id; }, clearInterval: id => timers.delete(id) };
  vm.runInNewContext(buildSync({ entryPoints: ['desktop-audio.js'], bundle: true, write: false, format: 'iife', platform: 'browser', external: ['opus-encdec/*'] }).outputFiles[0].text, context);
  const instances = [];
  class Player {
    constructor(config) { this.config = config; this.clientId = 'stable-id'; instances.push(this); }
    async unlock() { if (this.unlockPromise) await this.unlockPromise; }
    async connect() { this.connected = true; this.isConnected = true; }
    destroy() { this.destroyed = true; this.isConnected = false; }
  }
  const statuses = [];
  return { audio: context.window.createDesktopAudio({ Player, onStatus: state => statuses.push(state) }), instances, statuses, timers, clock };
}

test('keeps one output across repeated starts and destroys it when endpoint changes or audio is disabled', async () => {
  const { audio, instances, timers, statuses } = harness();
  const config = { enabled: true, url: 'ws://one:8927/sendspin', name: 'Decksona' };
  await audio.start(config);
  assert.equal(audio.clientId, 'stable-id');
  assert.equal(instances[0].connected, true);
  await audio.start(config);
  assert.equal(instances.length, 1);
  await audio.start({ ...config, url: 'ws://two:8927/sendspin' });
  assert.equal(instances[0].destroyed, true);
  assert.equal(instances.length, 2);
  assert.equal(timers.size, 1);
  instances[0].config.onPairingCode('123456');
  assert.notEqual(statuses.at(-1).status, 'pairing', 'obsolete callbacks must not replace the new player status');
  await audio.start({ enabled: false });
  assert.equal(instances[1].destroyed, true);
  assert.equal(audio.clientId, '');
  assert.equal(timers.size, 0);
});

test('reports failures without blocking remote control and surfaces pairing codes', async () => {
  const { audio, instances, statuses } = harness();
  const pending = audio.start({ enabled: true, url: 'ws://offline:8927/sendspin' });
  instances[0].connect = async () => { throw new Error('offline'); };
  await pending;
  assert.equal(statuses.at(-1).status, 'error');
  instances[0].config.onPairingCode('123456');
  assert.match(statuses.at(-1).detail, /123456/);
  audio.stop();
});

test('does not connect a disposed player when stopped during audio initialization', async () => {
  const { audio, instances } = harness();
  const pending = audio.start({ enabled: true, url: 'ws://one:8927/sendspin' });
  audio.stop();
  await pending;
  assert.equal(instances[0].destroyed, true);
  assert.equal(instances[0].connected, undefined);
});

test('keeps the pairing code visible until pairing ends', async () => {
  const { audio, instances, statuses, timers } = harness();
  await audio.start({ enabled: true, url: 'ws://one:8927/sendspin' });
  instances[0].config.onStateChange({ groupState: { group_id: 'test-group' } });
  assert.equal(statuses.at(-1).status, 'ready');
  instances[0].config.onPairingCode('654321');
  for (const tick of timers.values()) tick();
  assert.equal(statuses.at(-1).status, 'pairing');
  instances[0].config.onPairingCode(null);
  for (const tick of timers.values()) tick();
  assert.equal(statuses.at(-1).status, 'ready');
  audio.stop();
});

test('reports a stalled activation instead of claiming to connect indefinitely, and recovers', async () => {
  const { audio, instances, statuses, timers, clock } = harness();
  await audio.start({ enabled: true, url: 'ws://one:8927/sendspin' });
  clock.time = 15001;
  for (const tick of timers.values()) tick();
  assert.equal(statuses.at(-1).status, 'error');
  assert.match(statuses.at(-1).detail, /player setup/);
  instances[0].config.onStateChange({ groupState: { group_id: 'ready' } });
  assert.equal(statuses.at(-1).status, 'ready');
  audio.stop();
});
