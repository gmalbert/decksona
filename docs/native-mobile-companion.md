# Native mobile companion (feature 20)

Status: proposed. This document specifies future work; this release adds no native app.

## Goal

Make Decksona a dependable Music Assistant audio output on iOS and Android while retaining its listening rooms, library, playlists, queue editing, presets, and discovery. The current phone web app remains useful as a remote controller. A native companion must prove background playback on physical devices before claiming support.

## User experience

1. Connect to a direct Music Assistant server and authenticate with its token.
2. Enable this phone as an output, then complete server pairing if required.
3. Play music locally or explicitly move an existing session to the phone.
4. Lock the screen, switch apps, and control playback from the lock screen or headset.
5. Return after a phone call or network interruption and see accurate playback state, with a clear resume action when the operating system requires one.

Keep control-player selection distinct from the phone's active audio session. Switching which room is controlled must not stop phone audio or transfer another queue.

## Architecture and feasibility

Build a small transport/audio proof of concept before selecting the final UI stack. Prefer native audio services and platform controls; embedding the existing web player alone does not establish reliable background playback.

- iOS: Swift/SwiftUI shell; AVAudioSession playback category, AVAudioEngine or a suitable scheduled PCM renderer, background audio entitlement, MPNowPlayingInfoCenter and MPRemoteCommandCenter. Declare local-network access usage. Store API credentials and pairing secrets in Keychain.
- Android: Kotlin shell; foreground media playback service with MediaSession, audio focus and headset controls, a timestamp-aware renderer such as AudioTrack. Store credentials using Keystore-backed storage.
- Shared contracts: the Music Assistant API, encrypted Sendspin handshake, retained device identity, clock synchronization, buffering, codec negotiation, scheduled output, and reconnect behavior. Assess whether existing libraries can serve native clients before planning bindings or a separate implementation.
- UI reuse: preserve design tokens, skins, media models, and behavior specifications. The current plain JavaScript UI may be embedded for browsing, but native code must own the audio lifecycle.

Do not implement a separate recommendation engine or expose Music Assistant publicly as part of mobile onboarding. Remote access should use an explicitly configured reachable endpoint; API and Sendspin reachability are separate checks.

## Delivery phases

### 1. Physical-device feasibility

Demonstrate encrypted lossless Sendspin playback on one iPhone and one Android phone. Measure startup latency, timing drift, buffering, and CPU use. Prove screen-lock playback before committing to the UI architecture.

### 2. Native playback lifecycle

Add lock-screen metadata and transport, headphone removal behavior, Bluetooth route changes, interruptions, audio-focus handling, clean shutdown, pairing persistence, and reconnect with backoff. Never silently start playback or transfer another output's session on launch.

### 3. Product integration

Implement connection and device setup, the player, explicit session transfer, library/search, playlists, queue editing, presets, and discovery. Establish parity with desktop and phone web behavior. Clearly mark read-only playlists and unavailable player capabilities.

### 4. Distribution and maintenance

Provision app identifiers and signing; deliver TestFlight and Android internal-test builds; document network permissions, background behavior, battery impact, compatibility, privacy, and update policy. Store publication and signing require account access and separate release authorization.

## Acceptance criteria

- Play for 60 minutes with the physical screen locked, without audible gaps on stable Wi-Fi.
- Play for 30 minutes while another app is foregrounded; verify actual audio, not merely a running timer.
- Lock-screen and headset play/pause, previous, next, seeking where supported, artwork, and elapsed time reflect the active local session.
- Test incoming calls, alarms, other media apps, headphone unplugging, Bluetooth reconnects, and audio route changes. Resume follows platform rules and user intent.
- Recover after a server restart and a temporary Wi-Fi outage without duplicate players, stale controls, unintended autoplay, or lost identity.
- Test explicit queue transfer to and from the phone, preserving position and playing/paused state.
- Compare timing with a second compatible Sendspin player and document the supported synchronization tolerance.
- Measure battery drain, memory, temperature, and scheduling under a one-hour playback workload.
- Clear credentials on disconnect; exclude tokens and pairing secrets from logs and diagnostic exports.

## Open decisions

Validate supported Music Assistant/Sendspin versions, native library availability and licensing, codec support, minimum operating systems, and distribution ownership. Record measured results and choose the implementation stack after the feasibility phase. Offline music downloads are outside this proposal.
