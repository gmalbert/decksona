// Music Assistant can wrap a Sendspin output in a Universal Player. Commands
// and queues belong to the wrapper, while the SDK retains its transport ID.
function findLocalPlayer(players, clientId) {
  if (!clientId || !Array.isArray(players)) return null;
  return players.find(player => player.player_id !== clientId && player.output_protocols?.some(
    protocol => protocol.protocol_domain === 'sendspin' && protocol.output_protocol_id === clientId
  )) || players.find(player => player.player_id === clientId) || null;
}
function localPlayerId(players, clientId) {
  return findLocalPlayer(players, clientId)?.player_id || clientId || '';
}
// Pin the local device, then show available players A–Z and offline players A–Z.
// Copy before sorting so server state and the selected queue are not reordered.
function orderedPlayers(players, clientId, hideOffline = false) {
  const local = findLocalPlayer(players, clientId);
  const names = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  return (players || []).filter(player => player.enabled !== false && !(hideOffline && player.available === false) && !(
    local && local.player_id !== clientId && player.player_id === clientId
  )).sort((a, b) => Number(b === local) - Number(a === local)
    || Number(a.available === false) - Number(b.available === false)
    || names.compare(a.name || a.player_id, b.name || b.player_id)
    || names.compare(a.player_id, b.player_id));
}
const localPlayerHelpers = { findLocalPlayer, localPlayerId, orderedPlayers };
if (typeof module !== 'undefined') module.exports = localPlayerHelpers;
if (typeof window !== 'undefined') window.DECKSONA_LOCAL_PLAYER = localPlayerHelpers;
