# Decksona

![Decksona wordmark](assets/wordmark.svg)

Decksona is its own interface, not a window around the Music Assistant frontend. It controls Music Assistant players on your network, with a main deck, queue editor, library search, transport controls, seek, shuffle, repeat, volume, and output selection. **Library** and **Queue** buttons show or hide either panel. **Compact** hides both panels and shrinks the window; **Expand** restores the full layout. **Skins** opens a visual picker with **21 signature listening rooms** and the original 36 palette/overlay combinations (57 skins total); the selection is saved locally. Signature skins include Vinyl Lounge, Liquid Chrome, Moss & Mist, Cosmic Drift, Jellybean, Porcelain, Tape Archive, Space Age Stereo, Jazz After Hours, Tidepool, Art Nouveau, Kyoto Listening Room, Stained Glass, Midnight Diner, Field Notes, Obsidian & Gold, Aurora Glass, Arcade Candy, Saddle & Sound, Clockwork, and Desert Modern. Each has its own decorative surface, artwork shape, typography, and controls. All 21 are included in both desktop and web versions.

## Run on Windows or macOS

Check the [GitHub Releases page](https://github.com/gmalbert/decksona/releases) for a prebuilt download when one is available. Or build your own copy from source. First install Node.js 22.12 or newer using the [official Node.js download and installation instructions](https://nodejs.org/en/download), then run these commands from this folder:

```sh
npm install
npm start
```

For a standalone Windows executable that does not need installation, run `npm run dist:win` on Windows. Copy the generated `Decksona.exe` from `dist/` anywhere and launch it; each build overwrites that filename. To build the optional Windows installer, run `npm run dist:win:installer`. For a macOS DMG to test on your Mac, run `npm run dist:mac:local`. Local DMGs use ad hoc signing and are written to `dist/local/`.

### Install the macOS download

New GitHub releases use Developer ID signing and Apple notarization. If you upgrade from an ad hoc build with a saved token, macOS may ask once to grant the signed app access to **Decksona Safe Storage**.

1. Download the DMG from [Decksona’s GitHub Releases](https://github.com/gmalbert/decksona/releases), open it, and drag **Decksona** into **Applications**.
2. Open **Decksona** from **Applications** once. If macOS blocks it, dismiss the alert.
3. Open **System Settings → Privacy & Security**, scroll to **Security**, and click **Open Anyway** for Decksona. Confirm when prompted. Use this option for a download you trust. [Apple’s instructions](https://support.apple.com/en-us/102445)

The v0.1.0 Mac download has an invalid bundle signature. If you have that build, use a newer DMG or run from source using the commands above. If your Mac doesn’t offer **Open Anyway**, you can run from source or use the web edition.

## iPhone and Android web app

The repository's [`web/`](web/README.md) folder contains a phone-sized version that can be added to an iPhone or Android home screen. It uses the same player, search, queue, and skin features, with no native app install or HTTPS certificate. Copy its files to Home Assistant's `www/decksona` folder, then open `http://HOME_ASSISTANT_IP:8123/local/decksona/index.html` on your phone. Home Assistant serves the files, so no extra computer has to stay open.

## Connect

1. Open Music Assistant directly at `http://YOUR_SERVER_IP:8095` (port **8095** by default), or use its HTTPS URL. This must be the Music Assistant server address; a Home Assistant ingress URL is not a direct API address.
2. In **Music Assistant**, open **Settings → Profile** and create a long-lived access token. This is a Music Assistant token, not a Home Assistant token.
3. Start Decksona and enter the direct Music Assistant server URL and its token.
4. Pick an output in the top player deck. Use **Play now** to replace the queue and play, **Next** to insert next, or **+** to add to the end.

Search filters toggle Tracks, Albums, Playlists, Artists, and Genres. Click an artist to browse albums, an album to see its songs, or a genre to browse its artists and albums. Choose Artists or Albums in the genre view; selecting an artist opens their albums, and selecting an album opens its songs. Back returns to the previous list. Use a song’s play button to start playback, **Next** to insert next, or **+** to add a song, album, or playlist to the queue. Artist and genre rows browse their contents instead of starting playback.

The app stores the token encrypted through Electron's operating-system secure storage when available. Otherwise it keeps the token only until the app closes.

## Radio stations

In **Library → Radio**, enter a station name and its direct HTTP or HTTPS audio stream URL, then choose **Add station**. For a record player streamed through Icecast, use its mount URL, such as `http://192.168.1.50:8000/vinyl`. Music Assistant must be able to reach the URL. It saves the station in its radio library, where both Decksona editions can find it. Select your output and choose **Play** next to the station to start the live stream.

While a station plays, Decksona shows the current track, artist, album, and cover art supplied by Music Assistant.

## Local computer audio

Decksona includes its own Sendspin audio player on Windows and macOS. In Connection settings, leave **Play audio on this computer** enabled, then select **This computer · Decksona** in the player selector. Audio plays through the operating system’s default speakers or headphones. No browser or separate companion app is needed; all Decksona skins, queue controls, and library features remain available. Your Music Assistant server must stay running.

The audio connection uses `ws://YOUR_SERVER_IP:8927/sendspin` by default, separately from the authenticated control API on port 8095. Keep that port reachable on your local network. Under **Advanced audio connection**, supply a custom `ws://` or `wss://` Sendspin URL if needed. A remote web/API URL alone does not expose local Sendspin audio. This client uses the current encrypted Sendspin protocol; update Music Assistant if it cannot connect. Connection status appears in Connection settings, and the player automatically retries interrupted connections. If Music Assistant requests pairing, Decksona displays the code to enter in the server’s player setup. The computer retains its Sendspin identity across restarts.

On servers that require approval, complete **Setup required** for the new Decksona player once in Music Assistant, choosing guest/unpaired playback or pairing. After setup, the desktop app works independently of that page.

Closing the desktop window keeps Decksona and its audio running in the system tray (menu bar on macOS). Click the Decksona tray icon to reopen it, or choose **Quit Decksona** to stop playback and exit. If your system cannot create a tray icon, closing the window exits normally on Windows. Switching the player selector to another output changes which queue you control; use **Move music…** to transfer an existing session to this computer.

`npm start` and desktop packaging commands build the bundled audio libraries automatically. The phone/web edition also includes an independent player: tap **Listen on this device**, then play music through **This phone · Decksona**. See the [phone setup and browser limitations](web/README.md).

### Listen on this device

**Listen on this device** turns the phone running Decksona into a Music Assistant audio output, using its speaker, headphones, or connected Bluetooth audio device. Tap it once after opening the web app to enable phone audio and register/select **This phone · Decksona**. Then choose music in Library and play it, or use **Move music…** to transfer the current session to the phone. The button only prepares the phone as a player; it does not start a song. Browsers require a user tap to activate audio, especially on iPhone, so the same control can resume audio after reopening or interruption. See [phone setup and browser limitations](web/README.md).

For the optional desktop audio integration check, install its isolated Python fixtures with `python -m pip install --target output/audio-test-python aiosendspin==10.3.0 av==19.0.2`, then run `npm run check:audio`. It starts loopback-only servers, uses a separate Electron profile, and verifies encrypted lossless audio decoding/scheduling, local output selection, background playback, identity persistence, and cleanup. Test audio is not connected to physical speakers. Results are written to `output/audio-report.json`.

## Keyboard

Click the player’s album cover to switch to an ultra-small vertical player with full-width album art, song details, seeking, transport controls, and an output selector. Click the cover again or the arrow in its top corner to return to the previous size. Compact mode includes the output and volume controls without scrolling.

Drag rows in the queue editor to reorder playback, or use the up/down buttons beside each track. Moves are saved to the active Music Assistant queue. Music Assistant locks tracks that have played, are playing, or are buffered; their move buttons are disabled. Upcoming tracks can be reordered after that boundary.

Player artwork uses Music Assistant images first, then Cover Art Archive using the album’s MusicBrainz ID. If that ID is missing, Decksona looks up an exact artist and album match on MusicBrainz. These lookups send the album and artist names to MusicBrainz; artwork is loaded from Cover Art Archive.

If no album cover loads, Decksona requests the credited artist’s picture from Music Assistant, including the artist’s full metadata when the track only contains an artist reference. When the artist tag is unknown but the title contains “Artist - Track”, Decksona uses that artist name as a fallback. If Music Assistant has no artist picture, Decksona uses the artist’s MusicBrainz ID, or a unique exact-name match from MusicBrainz, to find its linked Wikidata/Wikipedia page and retrieve a Wikimedia portrait with a Photo source link. This lookup sends the artist name to MusicBrainz and follows its linked pages. Ambiguous artist names do not select a portrait. If neither the album nor the artist has artwork, no image is shown.

With focus outside a text field: Space plays/pauses, Left selects the previous track, and Right selects the next track. Shift+Left rewinds ten seconds; Shift+Right fast-forwards ten seconds. All six transport actions have icon buttons in the player deck.

## API

The app calls Music Assistant's authenticated `POST /api` endpoint. See the [Music Assistant API documentation](https://www.music-assistant.io/api/) and your server's `/api-docs/commands` for its exact command version. It polls for player and queue state every five seconds.

## Project

Decksona is a standalone Electron project for Windows and macOS. It does not depend on the Home Assistant configuration repository. The source code and branding assets live together in this repository.

## Theme development

`themes.js`, `themes.css`, and `skins/` define the shared theme catalog, styling, and local decorative SVG surfaces. After editing these, run `npm run sync:skins` to regenerate the surfaces and synchronize the standalone `web/` copy. No external fonts, image services, or build step are needed to use the skins. Existing saved skins are preserved.

Run `npm run check` for syntax, theme parity, palette contrast, and API checks. Run `npm run check:skins` for Chromium rendering and interaction checks using a simulated Music Assistant connection; no real output devices are changed. This checks all 21 skins at four web widths (320, 390, 820, and 1100 pixels), desktop full/compact/mini modes, gallery selection and reload persistence, playback command dispatch, Library/Queue, and missing artwork. Screenshots and a report are written to `output/skin-previews/`.

The skin gallery uses screenshots of the actual player, including sample album art, track details, transport, and output controls. Run `npm run preview:skins` after changing player styling to regenerate all 57 desktop and web previews. These are bundled in `skin-previews/` and `web/skin-previews/`. Each gallery includes an expandable selected-theme preview.

## Player selection and moving music

Player lists pin **This computer · Decksona** first, followed by available players alphabetically and offline players alphabetically at the bottom. Turn on **Hide offline** beside the player selector to remove offline players from the list; the preference is saved on this device. The **Move music…** destination list uses the same order and excludes the source and offline players. Sorting changes only the displayed list; it does not change the selected queue or playback.

The **Player** selector switches which device you view and control; each device keeps its own queue. The queue shows its player name and track count. To continue the same listening session on another device, choose **Move music…**, select a destination, and press **Move music here**. This transfers the queue and current track position, replacing the destination queue. Playing music continues; paused music stays paused. Unavailable players are excluded.

## Library, playlists, and listening presets

The Library now opens on **Home**, with recently added albums and your playlists. Browse **Albums**, **Artists**, **Tracks**, **Playlists**, and **Genres** without searching; switch between grid and list layouts, sort by name or date added, and load additional library items. Genre pages offer both artists and albums.

Search updates as you type. Recent searches are saved on this device per server; **Clear history** removes them. **Library only** restricts results to your library, and the provider selector restricts a wider search to one music source. **Load more** expands results per selected media type. Explicit **Play now**, **Next**, and **+** actions replace/start playback, insert next, and append respectively. The **•••** menu also offers playlist and preset actions.

The queue supports selecting and removing upcoming tracks, **Clear upcoming**, and **Undo removal**. Played, playing, and buffered tracks remain locked. Removal rechecks the server's buffer before each change. Undo is limited to the most recent removal in this app session and refuses to restore when the queue or playback has changed; it does not restart the current track. Large queues load in pages rather than stopping at 200 tracks.

Browse playlist songs, create a new Music Assistant playlist, add songs or albums to an editable library playlist, and save the queue as a new playlist. Editable, nondynamic library playlists offer removal and reordering using provider positions. Other playlists remain read-only and offer **Save a copy**. Playlist permissions, supported operations, and command availability depend on the connected Music Assistant version and provider; failed operations are shown rather than reported as successful. Some servers perform playlist updates as background tasks, whose completion Decksona checks before reporting success.

Save a **listening preset** from a track, album, or playlist's **•••** menu. Give it a name and choose its output, volume, and shuffle setting, then launch it from **Presets**. Playing a preset replaces the destination queue. Presets stay on this device and are separated by server; unavailable outputs produce an error instead of playing elsewhere.

**Discover** browses Music Assistant's recommendation rows, including enabled library and provider recommendations. Open a row to load its items; no separate recommendation service is used. Enable a recommendations provider in Music Assistant if none are available.

Expand **Audio quality** in the player to see the current item's reported stream provider, codec, sample rate, bit depth, and bitrate when supplied by the server. These describe the source stream; they do not establish the final device output format after transcoding or operating-system processing. Unknown values remain unavailable rather than being inferred from other versions of the track.

Both desktop and phone editions share these features. Run `npm run check:listening` for simulated desktop/phone integration checks covering browsing, queue removal and guarded undo, playlist edits/export, presets, search races and scopes, recommendations, audio metadata, and responsive layouts. It does not contact real players. Screenshots are written to `output/listening-previews/`.

The proposed native iOS/Android companion is specified in [docs/native-mobile-companion.md](docs/native-mobile-companion.md).

## Release versions

`package.json` is the source of the release version. The desktop header, desktop connection settings, phone connection settings, and macOS DMG filename include the full version (currently **0.2.1**). Web assets, the home-screen launch URL, and update detection use that same version so releases also refresh cached files.

Use `npm version patch --no-git-tag-version` for a small fix or `npm version minor --no-git-tag-version` for a feature release. The version lifecycle script synchronizes the app labels and web files. `npm run build:audio` also synchronizes them before launching or packaging. Bump the version when distributing a new release.

Pushing a `v*` tag runs the GitHub Actions release workflow. It builds the Windows executable, signs and notarizes the macOS DMG, then attaches both to the GitHub release. You can also run **Build and publish release** manually in GitHub Actions to verify the build without creating a release.

### One-time GitHub signing setup

Export the **Developer ID Application** signing identity with its private key as a password-protected `.p12` from Keychain Access. Create a dedicated [app-specific password](https://support.apple.com/en-us/102654) for the Apple Account used for notarization. Find its Team ID on the [Apple Developer account page](https://developer.apple.com/account/).

Add these repository secrets under **Settings → Secrets and variables → Actions**.

| Secret | Value |
| --- | --- |
| `MAC_CSC_LINK` | Base64 of the `.p12` file |
| `MAC_CSC_KEY_PASSWORD` | Password used to export the `.p12` |
| `APPLE_ID` | Apple Account email used for notarization |
| `APPLE_TEAM_ID` | Developer Team ID for the signing certificate |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password generated for the release workflow |

On macOS, pipe `base64 -i path/to/certificate.p12` directly to `gh secret set MAC_CSC_LINK`. To enter a password, run `gh secret set SECRET_NAME` and use its prompt. After the initial setup, the same secrets are reused on each version tag.

To build a notarized DMG, use `npm run dist:mac:notarized`. This requires a Developer ID Application signing identity and a [notarytool keychain profile](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow) named `decksona-notary`. Set `APPLE_KEYCHAIN_PROFILE` if your profile has a different name. The verified DMG appears in `dist/` after Apple accepts it.
