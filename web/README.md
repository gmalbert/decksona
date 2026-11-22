# Decksona for iPhone and Android

This folder contains a phone-sized web version of Decksona. It can play Music Assistant audio through the phone’s speaker or headphones using its own Sendspin player, and control your other Music Assistant players. It keeps the same Decksona branding and skins and can launch from your Home Screen without an app store.

## Install on your home network

Home Assistant can serve these files from its existing web server, so no extra computer or terminal window needs to stay open.

1. In the Home Assistant configuration folder, create `www/decksona`.
2. Copy everything inside this repository's `web/` folder into `www/decksona/`, including **`radio.js`, `audio.bundle.js`**, `index.html`, `app.js`, `style.css`, `themes.js`, `themes.css`, the entire `skins/` and `skin-previews/` folders, the manifest, and both icons. The audio bundle ships with the web folder; run `npm run build:audio` when rebuilding it from source.
3. If this is the first time you created the `www` folder, restart Home Assistant once.
4. On your phone's home Wi-Fi, open `http://HOME_ASSISTANT_IP:8123/local/decksona/index.html` in its browser. Replace `HOME_ASSISTANT_IP` with Home Assistant's local network address. The explicit filename is required because Home Assistant does not serve a directory index.
5. In Decksona, enter the Music Assistant address, such as `http://MUSIC_ASSISTANT_IP:8095`, and a long-lived access token from **Music Assistant → Settings → Profile**.
6. Tap **Listen on this device** on the Player tab. This creates and selects **This phone · Decksona**. If Music Assistant marks the new Decksona player **Setup required**, approve guest/unpaired playback or pair it once in Music Assistant; Decksona displays any requested pairing code. Search the Library and play a track. Other speakers remain available in the player selector.

Phone audio uses the same server hostname on port **8927**, independently of the control API port. Under **Settings → Advanced phone audio**, enter a different Sendspin `ws://` or `wss://` address if needed. The phone and server must be on a network that allows that connection, and the Music Assistant server must support the current encrypted Sendspin protocol. Safari uses lossless PCM without WebCodecs, WASM, or an HTTPS certificate. For an HTTPS-hosted Decksona page, the audio endpoint must use reachable **wss://**; an HTTPS API URL alone does not provide it.

## Add it to the home screen

- **iPhone:** Open the address in Safari, allow local-network access if asked, tap **Share**, choose **Add to Home Screen**, and enable **Open as Web App** if Safari offers the option.
- **Android:** Open it in Chrome, open the menu, and choose **Add to Home screen**. On this local HTTP setup Chrome may add a home-screen shortcut instead of offering a full PWA install; it still opens Decksona directly.

This setup intentionally uses plain HTTP and needs no certificate. Use the local Home Assistant and Music Assistant addresses on your trusted home Wi-Fi. The Music Assistant token is stored in that browser and travels over the local network without TLS, so do not expose these addresses to the internet or use the app on public Wi-Fi. Disconnect in Settings to remove the saved token. Home Assistant serves `/local/` files without sign-in; the files in this folder contain no token or other private data.

The phone must be able to reach both Home Assistant and Music Assistant on the same network. If it cannot open the address, check that it is on the same Wi-Fi and that the router does not isolate wireless clients.

## Controls and limitations

The web version includes player selection, play/pause, stop, next/previous, ten-second skip, seeking, volume, shuffle, repeat, library search filters, genre browsing by artist or album, artist albums, album songs, add/play queue actions, upcoming-track reordering, and all 57 skins. Tap **SKINS** to browse the gallery. Switching the viewed player does not disconnect phone audio; **Move music…** explicitly transfers an existing queue between devices.

Safari requires a real tap to activate audio after opening/reloading the app; Decksona does not autoplay on launch. Use **Listen on this device** or **Resume device audio**. The player retains its identity and reconnects after network interruptions. **Settings → Phone audio → Turn off** releases the audio output. Disconnect also stops audio and removes the saved API token.

Open **Library → Radio** to see your saved Music Assistant stations. To add a station, enter a name and a direct HTTP or HTTPS stream URL that Music Assistant can reach, then tap **Add station**. Tap **Play** next to the station to listen on your selected output.

Audio uses a media element with the playback audio-session category when available, with Media Session track metadata and transport controls on supported browsers. Keep the Home Screen app open while listening. iOS may suspend web audio or networking when the screen locks, the app backgrounds, or a call interrupts playback; uninterrupted lock-screen playback has not been verified on a physical iPhone. Return to Decksona and tap **Resume device audio** if needed. Player state refreshes when you return.

The browser must be able to reach Music Assistant at the address you enter. Music Assistant's local `http://...:8095` address works with this local HTTP setup. Remote use outside your home network is not configured by this no-certificate version.

## Preview from the repository

For a quick preview on the computer, run `npm run web` from the repository folder and open `http://localhost:8797`. To create a complete deployment folder, run `npm run dist:web`; it builds the phone audio bundle and copies the full web edition into `dist/web/`. Copy that folder's contents into Home Assistant's `www/decksona/`. The preview server binds to all network interfaces and prints the computer's Wi-Fi address too, but Home Assistant hosting is the recommended way to keep the phone shortcut available without a computer terminal left open. Set `DECKSONA_WEB_PORT` to choose another preview port.

## Updating an existing installation

Copy the updated contents of `web/` over the existing `www/decksona/` files, including **`audio.bundle.js`, `local-player.js`, `version.json`, `themes.css`, and the complete `skins/` and `skin-previews/` folders**. Home Assistant caches static files for 31 days, so an ordinary close/reopen may retain old HTML. Use the app’s **Reload** update notice, or open `index.html?v=0.2.1` to bypass an older cached page. The manifest launches this fresh URL; scripts and styles also have versioned URLs. Connection and skin preferences are kept on the same origin; clearing Safari data is unnecessary.

The app checks `version.json` without caching on launch and when it becomes visible. If a newer build exists, it offers **Reload**. Checking for an update does not stop audio; choosing Reload restarts the page and requires tapping to enable phone audio again. The build synchronizes the version metadata and asset URLs from `package.json`.

For a loopback-only integration check, install `aiosendspin==10.3.0 av==19.0.2` into `output/audio-test-python` as described in the main README, then run `npm run check:web-audio`. This verifies encrypted PCM playback through the real mobile media-element path, player/queue targeting, reconnects, and cleanup in Chromium with an iPhone user agent. It does not replace physical Safari/iPhone testing. Results are in `output/web-audio-report.json`; test audio is muted.

## Player selection and moving music

Player lists pin **This phone · Decksona** first, followed by available players alphabetically and offline players alphabetically at the bottom. Turn on **Hide offline** beside the player selector to remove offline players from the list; the preference is saved on this device. **Move music…** uses the same order and excludes the source and offline players.

The **Player** selector switches which device you view and control; each device keeps its own queue. The queue shows its player name and track count. To continue the same listening session on another device, choose **Move music…**, select a destination, and press **Move music here**. This transfers the queue and current track position, replacing the destination queue. Playing music continues; paused music stays paused. Unavailable players are excluded.

## Library and listening features

The phone edition includes the shared library home, artwork grid/list browser, collection sorting, expanded search with recent queries and provider/library scopes, complete upcoming-queue selection/removal with guarded undo, explicit play-now/next/end actions, editable library playlists, queue-to-playlist saving, listening presets, Music Assistant recommendations, and reported source-stream quality details. See the main README for behavior and compatibility limits.

When updating, also copy **`listening-core.js`, `listening.js`, and `listening.css`** alongside the other files. The current web build is `0.2.1`, and `index.html?v=0.2.1` bypasses an older cached entry page.
