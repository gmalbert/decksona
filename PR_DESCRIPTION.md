# Genre Browsing and Cross-Edition Packaging

## Summary

Add genre-based library browsing to Decksona's desktop and web editions, and provide a repeatable packaging step for the web edition. This branch is based on the Electron security-update branch and retains its Electron 45.3.4 configuration.

## Changes

- Make genre results open to the artists associated with that genre by default.
- Add an Artists / Albums switch while viewing a genre.
- Allow browsing from a genre to artists, from an artist to albums, and from an album to its tracks, with Back navigation restoring the previous view.
- Add the same genre browsing flow to the web edition, using Music Assistant's library artist endpoint with a genre filter and the genre albums endpoint.
- Add `npm run dist:web` to build the phone audio bundle and copy the complete static web edition into `dist/web/` for deployment.
- Bump the web build/cache version and update the web deployment instructions.

## Verification

- `npm run check` — all 17 tests passed.
- `npm run dist:web` — completed and produced the deployment folder at `dist/web/`.
- Confirmed `package.json` and `package-lock.json` agree on Electron 45.3.4.

## Packaging Notes

- Deploy the web edition by copying the contents of `dist/web/` into Home Assistant's `www/decksona/` directory.
- The Mac DMG is configured with `npm run dist:mac`. Build it on macOS with `npm ci` and `npm run check` first. This Windows environment did not produce a Mac DMG.
