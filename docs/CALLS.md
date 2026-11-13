# Voice & video calls

## How it works
- **Media:** WebRTC, directly between the two devices (peer-to-peer). Encrypted in transit with DTLS-SRTP.
  This is transport encryption between devices; the app does **not** claim app-level end-to-end encryption.
- **Signalling:** private Supabase Realtime channels `call:<call id>`. Row Level Security on `realtime.messages`
  lets only the two participants join (`public.can_use_call_topic`).
- **State & history:** `calls` + `call_participants` tables, driven by `start_call`, `answer_call`, `end_call`.
  The server prevents duplicate/simultaneous calls ("you are already in a call", callee busy → `busy`),
  respects the callee's *Who can call me* privacy setting and blocks, and expires calls that ring > 60 s.
  Every finished call drops a log line in the chat ("📞 Voice call · 3:21", "Missed video call").

## Features
Incoming/outgoing screens with original ringtone, accept/decline, end, mute, camera on/off, front/rear switch,
audio output selection where the platform exposes it, picture-in-picture (where supported), live duration,
network-quality indicator (RTT + packet loss), automatic ICE restart on drops (up to 3 tries), connect timeout,
missed-call handling, call history screen with call-back.

## Tested
`npm run test:calls` runs two real Chromium peers with fake camera/mic through the app's `CallSession`
and checks: both reach *connected*, audio/video tracks arrive, media bytes flow, mute is signalled,
hang-up propagates, resources are cleaned up. (Signalling is relayed locally in that test.)

## Honest limitations (₹0 setup)
- **TURN relay is not included.** STUN alone connects most home Wi-Fi and many mobile networks, but calls can
  fail on symmetric NAT / carrier-grade NAT / strict corporate or campus firewalls. The app shows
  "Couldn’t connect…" instead of pretending the call worked.
  - Option A (free tier, needs sign-up): a hosted TURN service with a free monthly quota. Put its URL/credentials in
    `VITE_TURN_URL`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL` (Vercel env + GitHub workflow). Check the provider's
    current free limits before relying on it; note these credentials ship inside the app.
  - Option B (self-hosted): run `coturn` on an always-on server you control.
- **Group calls are not enabled.** Mesh WebRTC degrades badly beyond 3–4 people on phones; doing it well needs an
  SFU server (e.g. self-hosted LiveKit), which needs an always-on machine. Call buttons appear in 1:1 chats only.
- **Incoming calls when the app is fully closed:** the web/PWA can't ring when terminated. The Android APK can be
  extended with native push + full-screen call notifications in the notifications phase; until then, incoming
  calls ring while SUMANOVA is open or in the background.
