import { createDesktopAudio } from './desktop-audio';
import { sendspinUrl } from './local-audio-config';

// The web player is deliberately opt-in: Safari must unlock its output during
// a real tap, before authentication or any other asynchronous network work.
window.createPhoneAudio = ({ onStatus, onMediaState } = {}) => {
  let element;
  const output = createDesktopAudio({ onStatus, onMediaState });
  return {
    get clientId() { return output.clientId; },
    unlock: () => output.unlock(),
    sendCommand: (command, params) => output.sendCommand(command, params),
    start(server, override = '') {
      const url = sendspinUrl(server, override);
      if (location.protocol === 'https:' && url.startsWith('ws:')) {
        throw new Error('This HTTPS page needs a secure wss:// Sendspin address. Enter it in Advanced phone audio, or open Decksona using your local HTTP address on home Wi-Fi.');
      }
      if (!globalThis.crypto?.getRandomValues) throw new Error('This browser cannot create a phone player. Open Decksona in an up-to-date Safari or Chrome.');
      if (!element) {
        element = document.createElement('audio');
        element.autoplay = true;
        element.setAttribute('playsinline', '');
        element.hidden = true;
        document.body.append(element);
      }
      if (navigator.audioSession) {
        try { navigator.audioSession.type = 'playback'; } catch { /* optional API */ }
      }
      return output.start({ enabled: true, url, name: 'Decksona · Phone', version: '0.1.0',
        // PCM needs neither WebCodecs nor WASM and works on Safari over local HTTP.
        codecs: ['pcm'], audioElement: element });
    },
    stop() {
      output.stop();
      element?.remove();
      element = undefined;
      if (navigator.audioSession) {
        try { navigator.audioSession.type = 'auto'; } catch { /* optional API */ }
      }
    },
  };
};
