# SUMANOVA

A real-time social app — camera-first, aurora-themed, installable on Android as a PWA, and built entirely on free tiers.

**Stack:** React 18 · TypeScript · Vite · Tailwind CSS · Framer Motion · Lucide · Supabase (Postgres, Auth, Realtime, Storage) · vite-plugin-pwa · Vitest

## Status

| Phase | Scope | State |
| --- | --- | --- |
| 0 | Inspection, planning | ✅ |
| 1 | Foundation: design system, navigation, auth, profiles, settings, migrations, RLS, PWA | ✅ (account deletion pending migration approval) |
| 2 | Friends + real-time chat | next |
| 3 | Voice & video calls (WebRTC) | |
| 4 | Snaps: editor, delivery, expiry | |
| 5 | 3D avatar studio | |
| 6 | Stories, streaks, friendship profiles | |
| 7 | Memories, Spotlight | |
| 8 | Map, filters, AR | |
| 9 | Push notifications, hardening | |
| 10 | Deployment & live validation | |

## Design — "Aurora Glass"

Original visual language (no third-party brand assets): midnight base, slowly drifting violet/teal/coral aurora,
frosted-glass surfaces, a floating pill dock with a glowing central camera orb, spring-based motion,
Unbounded display type + Plus Jakarta Sans text. Performance rules: transform/opacity-only animation,
pre-blurred gradients instead of live blur on large areas, code-split routes, camera released when the app is backgrounded,
`prefers-reduced-motion` + in-app "Reduce motion" respected.

## Getting started

```bash
cp .env.example .env.local   # fill in Supabase URL + publishable key
npm install
npm run dev
npm test                     # unit tests
npm run build                # typecheck + production build (PWA)
```

Database migrations live in `supabase/migrations/` and are applied in filename order.
`supabase/tests/phase1_rls.sql` verifies RLS and the sign-up trigger (rolls back, leaves no data).

## Branches

| Branch | Purpose |
| --- | --- |
| `main` | Production releases |
| `develop` | Integration branch; feature branches merge here through PRs |
| `release/1.0.0` | Stabilisation for the 1.0.0 release |
| `SUM-202601` | Current feature work (merges into `develop`) |

## Install on Android

1. Open the deployed URL in **Chrome** on your phone.
2. Tap **Install** on the in-app card, or Chrome menu ⋮ → **Add to Home screen / Install app**.
3. Launch SUMANOVA from the home screen — it opens full-screen like a native app.
4. Allow camera access when prompted (Chrome ⋮ → Settings → Site settings if you denied it earlier).

## Docs

- [Zero-cost dependency register](docs/ZERO_COST_REGISTER.md)
- [Security checklist](docs/SECURITY.md)
