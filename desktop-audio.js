import { SendspinPlayer } from '@sendspin/sendspin-js';

// Kept separate from the Music Assistant control connection: changing the viewed
// player must never tear down audio already playing through this computer.
export function createDesktopAudio({ Player = SendspinPlayer, onStatus = () => {}, onMediaState = () => {} } = {}) {
  let player;
  let endpoint;
  let generation = 0;
  let statusTimer;
  let lastStatus = '';
  let activated = false;
  let connectionStarted = false;
  let waitingSince = 0;
  const report = (status, detail = '') => {
    const key = `${status}:${detail}`;
    if (key === lastStatus) return;
    lastStatus = key;
    onStatus({ status, detail, clientId: player?.clientId || '' });
  };
  const stop = () => {
    generation++;
    clearInterval(statusTimer);
    player?.destroy();
    player = undefined;
    endpoint = undefined;
    activated = false;
    connectionStarted = false;
    report('disabled');
  };
  return {
    get clientId() { return player?.clientId || ''; },
    unlock: () => player?.unlock(),
    sendCommand: (command, params = {}) => player?.sendCommand(command, params),
    stop,
    async start(config) {
      if (!config.enabled) { stop(); return; }
      if (player && endpoint === config.url) {
        const instance = player;
        const current = generation;
        await instance.unlock();
        if (current === generation && !connectionStarted) { connectionStarted = true; await instance.connect(); }
        return;
      }
      stop();
      const current = generation;
      waitingSince = Date.now();
      endpoint = config.url;
      player = new Player({
        url: config.url,
        clientName: config.name,
        productName: 'Decksona',
        softwareVersion: config.version,
        // Chromium decodes FLAC natively; PCM is the lossless fallback.
        codecs: config.codecs || ['flac', 'pcm'],
        audioElement: config.audioElement,
        onStateChange: state => {
          if (current !== generation) return;
          if (state.groupState?.group_id) activated = true;
          onMediaState(state);
          if (activated && !lastStatus.startsWith('pairing:')) report('ready');
        },
        onPairingCode: code => {
          if (current === generation) report(code ? 'pairing' : 'connecting', code ? `Enter code ${code} in Music Assistant’s player setup.` : '');
        },
        reconnect: { onReconnecting: () => {
          if (current === generation) { activated = false; waitingSince = Date.now(); report('reconnecting'); }
        } },
      });
      const instance = player;
      report('connecting');
      statusTimer = setInterval(() => {
        if (instance.isConnected && activated && !lastStatus.startsWith('pairing:')) report('ready');
        else if (instance.isConnected && !activated && Date.now() - waitingSince >= 15000 && !lastStatus.startsWith('pairing:')) {
          report('error', 'The audio connection is open but Music Assistant has not made this player ready. Check Decksona’s player setup in Music Assistant.');
        }
        else if (!instance.isConnected && !['pairing', 'error'].some(value => lastStatus.startsWith(`${value}:`))) report('reconnecting');
      }, 1000);
      try {
        await instance.unlock();
        if (current !== generation) return;
        connectionStarted = true;
        await instance.connect();
        if (current === generation && instance.isConnected && activated) report('ready');
      } catch {
        if (current === generation) report('error', 'Local audio cannot connect. Check the Sendspin address, server version, and firewall; Decksona will retry automatically.');
      }
    },
  };
}

window.createDesktopAudio = createDesktopAudio;
