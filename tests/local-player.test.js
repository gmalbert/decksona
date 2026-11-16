const test = require('node:test');
const assert = require('node:assert/strict');
const { findLocalPlayer, localPlayerId, orderedPlayers } = require('../local-player');

test('resolves Sendspin identity to the Universal Player that owns its queue', () => {
  const transport = { player_id: 'audio-identity', provider: 'sendspin' };
  const device = { player_id: 'up-computer', name: 'Decksona · Computer', output_protocols: [
    { protocol_domain: 'sendspin', output_protocol_id: 'audio-identity', available: true },
  ] };
  const remote = { player_id: 'office', name: 'Office' };
  assert.equal(findLocalPlayer([remote, device], 'audio-identity'), device);
  assert.equal(localPlayerId([remote, device], 'audio-identity'), 'up-computer');
  assert.equal(findLocalPlayer([transport, device], 'audio-identity'), device, 'prefer the visible device even if the transport is also returned');
});

test('pins this device, naturally alphabetizes available players, and puts offline players last without mutating server order', () => {
  const players = [
    { player_id: 'offline-a', name: 'Attic', available: false },
    { player_id: 'room10', name: 'Room 10', available: true },
    { player_id: 'transport', name: 'Transport' },
    { player_id: 'room2', name: 'room 2', available: true },
    { player_id: 'local', name: 'Z desktop', available: false, output_protocols: [{ protocol_domain: 'sendspin', output_protocol_id: 'transport' }] },
    { player_id: 'disabled', name: 'A disabled', enabled: false },
    { player_id: 'bedroom', name: 'Bedroom' },
    { player_id: 'offline-z', name: 'Zoo', available: false },
  ];
  const before = players.map(p => p.player_id);
  assert.deepEqual(orderedPlayers(players, 'transport').map(p => p.player_id), ['local','bedroom','room2','room10','offline-a','offline-z']);
  assert.deepEqual(players.map(p => p.player_id), before);
});

test('supports direct players and keeps unresolved or offline identities stable', () => {
  const direct = { player_id: 'audio-identity' };
  assert.equal(findLocalPlayer([direct], 'audio-identity'), direct);
  assert.equal(localPlayerId([], 'audio-identity'), 'audio-identity');
  assert.equal(findLocalPlayer([{ name: 'Decksona · Computer', player_id: 'someone-else' }], 'audio-identity'), null, 'do not guess by display name');
  assert.equal(findLocalPlayer([], ''), null);
  const offline = { player_id: 'up-phone', available: false, output_protocols: [{ protocol_domain: 'sendspin', output_protocol_id: 'phone' }] };
  assert.equal(localPlayerId([offline], 'phone'), 'up-phone');
});
