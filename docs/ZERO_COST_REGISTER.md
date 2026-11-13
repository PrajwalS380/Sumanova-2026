# Zero-Cost Dependency Register

Budget: **₹0**. Every service below is used on its free tier with **no credit card**.

| Service / tool | Purpose | Free-tier limits (as of Nov 2026, verify on provider site) | Registration | Credit card | When quota is exceeded | Open-source alternative |
| --- | --- | --- | --- | --- | --- | --- |
| Supabase (Free plan) | Postgres DB, Auth, Realtime, Storage, Edge Functions | 500 MB DB, 1 GB file storage, 5 GB egress, 50k MAU, 200 concurrent Realtime connections; **project pauses after 7 days of inactivity** | Yes | No | Requests are throttled/blocked until next cycle; paused projects resume from the dashboard | Self-hosted Supabase (Docker) |
| Supabase Auth email | Confirmation + password-reset email | Built-in sender is heavily rate-limited (a few emails/hour) and meant for development | — | No | Sign-up/reset emails stop until the hour window resets | Free SMTP tier (e.g. Brevo/Resend free) plugged into Supabase Auth SMTP settings |
| Vercel (Hobby) | Frontend hosting, HTTPS, preview deploys | Personal, non-commercial use; 100 GB bandwidth/month | Yes | No | Deployments paused until next month | Cloudflare Pages / GitHub Pages |
| GitHub + Actions | Source control, APK/IPA builds, releases | Public repo: unlimited Actions minutes (incl. macOS) | Yes | No | — | Gitea / Forgejo + self-hosted runner |
| Capacitor 8 | Native Android/iOS shell | MIT licensed | No | No | — | — |
| Gmail SMTP (dedicated account) | Auth emails (codes) | ~500 emails/day | Yes (Gmail) | No | Sending pauses ~24h | Brevo free (300/day) |
| Apple Developer Program | App Store / TestFlight for iPhone | **Paid, USD 99/yr — NOT used** | — | Yes | — | iPhone web app (Safari) or SideStore with free Apple ID (7-day signing) |
| React, Vite, Tailwind, Framer Motion, Lucide, Zod, vite-plugin-pwa | Frontend | MIT / ISC licensed | No | No | — | — |
| Plus Jakarta Sans, Unbounded (@fontsource) | Typography, self-hosted | SIL Open Font License | No | No | — | — |
| Google STUN (`stun.l.google.com`) | WebRTC peer discovery (Phase 3) | Free, no SLA | No | No | Calls fail to connect behind strict NAT | Self-hosted coturn |
| TURN relay | Calls on restrictive networks (Phase 3) | **No reliable free public TURN** — see limitations | — | — | — | Self-hosted coturn on an always-free VM (requires a VM, which may need card verification — will ask first) |
| Leaflet + OpenStreetMap data | Social map | BSD-2 library; OSM data ODbL with attribution | No | No | — | MapLibre + self-hosted tiles |
| CARTO basemaps (dark_all) | Map tiles | Free for light/non-commercial use with attribution (check CARTO terms if usage grows) | No | No | Tiles may be throttled | OSM standard tiles (light use) or self-hosted tiles |
| MediaPipe Tasks Vision | AR face lenses (on-device) | Apache-2.0; wasm via jsDelivr CDN, model via Google Cloud Storage (public, free) | No | No | Lenses can't load offline the first time | Self-host the wasm + model in /public |
| Supabase Edge Functions | Web Push sender (`push`) | Free plan: 500k invocations/month | — | No | Pushes stop until next cycle | Self-host the same Deno function |
| pg_cron + pg_net (Supabase) | Housekeeping, streak reminders, push trigger | Included in Supabase free plan | — | No | — | — |
| Supabase Vault | Stores the VAPID private key | Included | — | No | — | — |
| Google Firebase Cloud Messaging (optional) | Android push when the APK is fully closed | Free, needs a Firebase project | Yes | No | — | Keep using in-app/background notifications |
| Web Push (VAPID) | Notifications for web/PWA (incl. iPhone home-screen app, iOS 16.4+) | Free browser push services (Google/Mozilla/Apple) | No | No | — | — |
