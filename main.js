const { app, BrowserWindow, ipcMain, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { COMMANDS, normalizeServerUrl, decodeResponse } = require('./api');
const { THEMES } = require('./themes');

let settings = { serverUrl: '', playerId: '', encryptedToken: '', themeId: 'phosphor-glass' };
let sessionToken = '';
let requestId = 0;
let playerWindow;
let expandedBounds;
const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try { settings = { ...settings, ...JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) }; }
  catch (error) { if (error.code !== 'ENOENT') console.warn('Could not read settings:', error.message); }
  if (settings.encryptedToken && safeStorage.isEncryptionAvailable()) {
    try { sessionToken = safeStorage.decryptString(Buffer.from(settings.encryptedToken, 'base64')); }
    catch { sessionToken = ''; }
  }
}

function saveSettings() {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), { mode: 0o600 });
}

async function command(name, args = {}) {
  if (!COMMANDS[name]) throw new Error('Unsupported command.');
  if (!settings.serverUrl || !sessionToken) throw new Error('Connect to Music Assistant first.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${settings.serverUrl}/api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ message_id: String(++requestId), command: COMMANDS[name], args }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Music Assistant returned HTTP ${response.status}.`);
    return decodeResponse(await response.json());
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The server did not respond in time.');
    throw error;
  } finally { clearTimeout(timeout); }
}

function createWindow() {
  playerWindow = new BrowserWindow({
    width: 930, height: 690, minWidth: 530, minHeight: 320,
    backgroundColor: '#151a20', title: 'Music Assistant Retro Player',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  playerWindow.loadFile('index.html');
  playerWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

app.whenReady().then(() => {
  loadSettings();
  ipcMain.handle('settings:get', () => ({ serverUrl: settings.serverUrl, playerId: settings.playerId, themeId: settings.themeId, hasToken: Boolean(sessionToken) }));
  ipcMain.handle('settings:save', async (_event, input) => {
    const serverUrl = normalizeServerUrl(input.serverUrl);
    const token = String(input.token || '').trim() || sessionToken;
    if (!token) throw new Error('Enter a long-lived access token.');
    const old = { ...settings, sessionToken };
    settings.serverUrl = serverUrl;
    sessionToken = token;
    settings.playerId = String(input.playerId || settings.playerId || '');
    try {
      await command('players');
      settings.encryptedToken = safeStorage.isEncryptionAvailable()
        ? safeStorage.encryptString(token).toString('base64') : '';
      saveSettings();
      return { serverUrl, playerId: settings.playerId, tokenSaved: Boolean(settings.encryptedToken) };
    } catch (error) {
      settings = { serverUrl: old.serverUrl, playerId: old.playerId, encryptedToken: old.encryptedToken, themeId: old.themeId };
      sessionToken = old.sessionToken;
      throw error;
    }
  });
  ipcMain.handle('settings:player', (_event, playerId) => {
    settings.playerId = String(playerId || '');
    saveSettings();
    return settings.playerId;
  });
  ipcMain.handle('settings:theme', (_event, themeId) => {
    if (!THEMES.some(theme => theme.id === themeId)) throw new Error('Unknown skin.');
    settings.themeId = themeId;
    saveSettings();
    return themeId;
  });
  ipcMain.handle('api:command', (_event, name, args) => command(name, args));
  ipcMain.handle('layout:setCompact', (_event, compact) => {
    if (!playerWindow || playerWindow.isDestroyed()) return;
    if (compact) {
      expandedBounds = playerWindow.getBounds();
      if (playerWindow.isMaximized()) playerWindow.unmaximize();
      playerWindow.setSize(590, 350);
    } else if (expandedBounds) {
      playerWindow.setBounds(expandedBounds);
    }
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
