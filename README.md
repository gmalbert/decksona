# Music Assistant Retro Player

A Winamp-inspired desktop interface for Music Assistant. This is its own UI, not a window around the Music Assistant frontend. It controls Music Assistant players on your network, with a main deck, queue editor, library search, transport controls, seek, shuffle, repeat, volume, and output selection. **Library** and **Queue** buttons show or hide either panel. **Compact** hides both panels and shrinks the window; **Expand** restores the full layout. **Skins** opens a picker with 36 combinations of six color palettes and six surface overlays; the selection is saved locally.

## Run on Windows or macOS

Install Node.js 20 or newer, then from this folder:

```sh
npm install
npm start
```

On Windows, copy the project to a local folder or map the network share to a drive letter before running npm. Windows `cmd.exe`, which npm uses for scripts, does not run correctly with a UNC working directory.

For a Windows installer, run `npm run dist:win` on Windows. For a macOS DMG, run `npm run dist:mac` on a Mac. Builds are written to `dist/`. macOS distribution to other users requires Apple code signing and notarization; local development does not.

## Connect

1. Open Music Assistant directly at `http://YOUR_SERVER_IP:8095` (or its HTTPS URL). The Home Assistant ingress URL is not a direct API address.
2. Create a long-lived access token in **Settings → Profile**.
3. Start this app and enter the direct server URL and token.
4. Pick an output in the top player deck. Double-click search results to replace the queue and play, or click **+** to add one.

The app stores the token encrypted through Electron's operating-system secure storage when available. Otherwise it keeps the token only until the app closes.

## Local computer audio

This release controls Music Assistant output devices. To play through the Windows or Mac computer itself, install the [official Music Assistant desktop companion](https://github.com/music-assistant/desktop-app) as a background Sendspin output, then select that output in Retro Player. The companion's window does not need to be your music interface. Direct Sendspin output inside Retro Player is planned for a later release.

## Keyboard

With focus outside a text field: Space plays/pauses, Left selects the previous track, and Right selects the next track. Shift+Left rewinds ten seconds; Shift+Right fast-forwards ten seconds. All six transport actions have icon buttons in the player deck.

## API

The app calls Music Assistant's authenticated `POST /api` endpoint. See the [Music Assistant API documentation](https://www.music-assistant.io/api/) and your server's `/api-docs/commands` for its exact command version. It polls for player and queue state every five seconds.
