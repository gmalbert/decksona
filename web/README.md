# Decksona for iPhone and Android

This folder contains a phone-sized web version of Decksona. It talks directly to Music Assistant over its WebSocket API and controls the Music Assistant players you already use. It does not stream audio from the phone.

## Install on your home network

Home Assistant can serve these files from its existing web server, so no extra computer or terminal window needs to stay open.

1. In the Home Assistant configuration folder, create `www/decksona`.
2. Copy everything inside this repository's `web/` folder into `www/decksona/`, keeping `index.html`, `app.js`, `style.css`, `themes.js`, the manifest, and both icons together. Use the File Editor or your existing Home Assistant file share.
3. If this is the first time you created the `www` folder, restart Home Assistant once.
4. On your phone's home Wi-Fi, open `http://HOME_ASSISTANT_IP:8123/local/decksona/` in its browser. Replace `HOME_ASSISTANT_IP` with Home Assistant's local network address.
5. In Decksona, enter the Music Assistant address, such as `http://MUSIC_ASSISTANT_IP:8095`, and a long-lived access token from **Music Assistant → Settings → Profile**.
6. Select a player output. The Player, Library, and Queue tabs provide playback controls, search and artist → album → song browsing, and queue reordering. Connection and appearance settings are saved by the browser on that phone.

## Add it to the home screen

- **iPhone:** Open the address in Safari, allow local-network access if asked, tap **Share**, choose **Add to Home Screen**, and enable **Open as Web App** if Safari offers the option.
- **Android:** Open it in Chrome, open the menu, and choose **Add to Home screen**. On this local HTTP setup Chrome may add a home-screen shortcut instead of offering a full PWA install; it still opens Decksona directly.

This setup intentionally uses plain HTTP and needs no certificate. Use the local Home Assistant and Music Assistant addresses on your trusted home Wi-Fi. The Music Assistant token is stored in that browser and travels over the local network without TLS, so do not expose these addresses to the internet or use the app on public Wi-Fi. Disconnect in Settings to remove the saved token. Home Assistant serves `/local/` files without sign-in; the files in this folder contain no token or other private data.

The phone must be able to reach both Home Assistant and Music Assistant on the same network. If it cannot open the address, check that it is on the same Wi-Fi and that the router does not isolate wireless clients.

## Controls and limitations

The web version includes the desktop Decksona controls: player selection, play/pause, stop, next/previous, ten-second skip, seeking, volume, shuffle, repeat, library search filters, artist and album browsing, add/play queue actions, upcoming-track reordering, and all 36 skins. It is a remote control for Music Assistant outputs, just like the desktop app. Audio continues on the selected Music Assistant player; the phone browser does not become an audio output. iOS and Android can pause a backgrounded page's refresh timer, so the player state refreshes when you return to the app.

The browser must be able to reach Music Assistant at the address you enter. Music Assistant's local `http://...:8095` address works with this local HTTP setup. Remote use outside your home network is not configured by this no-certificate version.

## Preview from the repository

For a quick preview on the computer, run `npm run web` from the repository folder and open `http://localhost:8787`. The server binds to all network interfaces and prints the computer's Wi-Fi address too, but Home Assistant hosting is the recommended way to keep the phone shortcut available without a computer terminal left open. Set `DECKSONA_WEB_PORT` to choose another preview port.
