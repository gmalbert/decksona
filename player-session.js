/* Shared player selection and explicit queue transfer UI. */
window.createPlayerSession = function ({state, command, select, refresh, notify, formatPlayerName = player => player.name, listPlayers = () => state.players}) {
  const doc = document, $ = id => doc.getElementById(id);
  const playerName = id => {
    const player = state.players.find(p => p.player_id === id);
    return (player && formatPlayerName(player)) || id || 'No player selected';
  };
  const tools = doc.createElement('div'); tools.className = 'session-tools';
  const move = doc.createElement('button'); move.type = 'button'; move.textContent = 'Move music…';
  move.title = 'Move this listening session to another player'; tools.append(move);
  const output = doc.querySelector('.output-row,.output-panel');
  if (doc.querySelector('.shell')) output.append(tools);
  else output.after(tools);
  const context = doc.createElement('div'); context.className = 'queue-context'; context.setAttribute('aria-live','polite');
  $('queueCount').parentElement.after(context);
  const dialog = doc.createElement('dialog'); dialog.className = 'transfer-dialog';
  dialog.setAttribute('aria-labelledby','transferTitle');
  dialog.innerHTML = '<form><h2 id="transferTitle">Move your music</h2><p id="transferSource"></p><label for="transferTarget">Destination player</label><select id="transferTarget" required></select><p>Move the queue and current track position to this player. This replaces its existing queue. Playing music will continue; paused music stays paused.</p><p id="transferError" role="alert" hidden></p><div class="transfer-actions"><button type="button" id="transferCancel">Cancel</button><button type="submit" id="transferSubmit">Move music here</button></div></form>';
  doc.body.append(dialog);
  let sourceId = '', sourceQueueId = '', busy = false;
  function update() {
    const total = Number.isInteger(state.queue?.items) ? state.queue.items : state.items.length;
    context.textContent = `${playerName(state.playerId)} · ${total} tracks`;
    move.disabled = busy || !state.playerId || !(state.queue?.current_item || state.items.length) || !listPlayers().some(p => p.player_id !== state.playerId && p.enabled !== false && p.available !== false);
    $('playerSelect').title = 'Choose a player to view and control its existing queue';
  }
  move.addEventListener('click', () => {
    sourceId = state.playerId; sourceQueueId = state.queue?.queue_id || sourceId;
    $('transferSource').textContent = `From ${playerName(sourceId)}`;
    const target = $('transferTarget'); target.replaceChildren(new Option('Choose a player',''));
    for (const p of listPlayers()) if(p.player_id !== sourceId && p.enabled !== false && p.available !== false) target.add(new Option(playerName(p.player_id),p.player_id));
    $('transferError').hidden = true; dialog.showModal();
  });
  $('transferCancel').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  dialog.querySelector('form').addEventListener('submit',async event=>{
    event.preventDefault(); if(busy)return;
    const targetId = $('transferTarget').value;
    if(!targetId || targetId===sourceId)return;
    if(state.playerId!==sourceId) { $('transferError').textContent='The selected player changed. Close this dialog and try again.'; $('transferError').hidden=false; return; }
    busy=true; $('transferSubmit').disabled=true; $('transferTarget').disabled=true; $('transferCancel').disabled=true; $('playerSelect').disabled=true; update();
    try {
      const players=await command('players',{}), queues=await command('queues',{});
      const source=queues.find(q=>q.queue_id===sourceQueueId);
      if(!players.some(p=>p.player_id===targetId&&p.available!==false&&p.enabled!==false))throw new Error('The destination player is unavailable.');
      if(!source || !(source.current_item || source.items))throw new Error('The source queue is empty.');
      await command('transfer',{source_queue_id:sourceQueueId,target_queue_id:targetId,auto_play:source.state==='playing'});
      await select(targetId); dialog.close(); notify(`Music moved to ${playerName(targetId)}`);
    } catch(error) { $('transferError').textContent=error.message; $('transferError').hidden=false; }
    finally { busy=false; $('transferSubmit').disabled=false; $('transferTarget').disabled=false; $('transferCancel').disabled=false; $('playerSelect').disabled=false; await refresh(); update(); }
  });
  return {update};
};
