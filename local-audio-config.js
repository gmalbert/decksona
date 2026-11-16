// Shared validation for the desktop audio endpoint. API credentials never go here.
function sendspinUrl(serverUrl, override = '') {
  const custom = String(override || '').trim();
  const url = new URL(custom || serverUrl);
  if (!custom) {
    url.protocol = 'ws:';
    url.port = '8927';
    url.pathname = '/sendspin';
  }
  if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Enter a Sendspin address such as ws://192.168.1.100:8927/sendspin, without credentials or query parameters.');
  }
  return url.href;
}
if (typeof module !== 'undefined') module.exports = { sendspinUrl };
