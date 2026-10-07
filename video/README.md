# Auctra demo video

A 40-second product demo built with [Remotion](https://www.remotion.dev). Every frame and every sound comes from code in this folder.

```sh
cd video
npm install
npm run render   # writes out/auctra-demo-1920x1080.mp4 and out/auctra-demo-1080x1920.mp4
npm run studio   # live preview while editing
```

`remotion.config.ts` uses the Chromium at `/opt/pw-browsers`. To use another browser, set `REMOTION_BROWSER`.

## How it fits together

- `src/timeline.ts` holds the one clock: 120 BPM, so one bar is 2 seconds, and every scene starts on a bar. It also lists every tap, keystroke and message, and when each happens.
- `src/Video.tsx` draws the scenes, the camera moves and the captions from that timeline.
- `src/audio/build.ts` synthesises the score and the interface sounds from the same timeline into `public/soundtrack.wav`. Because both read the same file, picture and sound can't drift apart.
- `src/ui/` rebuilds the real screens: the Telegram chat, the setup mini app and History.

The on-screen copy is taken from the app and the bot: `lib/telegram/bot.ts`, `lib/services/automations.ts`, `lib/services/notifications.ts`, `app/onboarding/page.tsx` and `app/page.tsx`.

## Example data

Every wallet address, the transaction hash, the dates and the phone clock in `src/data.ts` are made up. No real user, wallet or key appears in the video.
