# SUMANOVA — project memory

Read this first in every session. Keep it updated when decisions change.

## What this is
SUMANOVA: a real-time social app (chat, calls, snaps, stories, 3D avatar studio, streaks, memories,
Spotlight, social map, notifications). Original requirement doc: "MASTER BUILD PROMPT — PROJECT SNAPVERSE"
(28 sections, phases 0–10). Owner's goal: a complete, beautiful, smooth app they and invited friends use on
Android (APK) and iPhone.

## Non-negotiable rules from the owner
- **₹0 budget.** Free tiers / open source only. Never add a paid service, card requirement or billing without asking.
  Track every service in `docs/ZERO_COST_REGISTER.md`.
- **Original UI — never copy Snapchat** (no logos, layouts, Bitmoji assets). Must look *better* than Snapchat.
- **Smooth, never laggy**: transform/opacity animations only, no live blur on large areas, code-split routes,
  release camera/mic when backgrounded, paginate everything, respect reduce-motion.
- No fake data, no non-functional buttons, no claiming something works until tested.
- Never expose secrets; never put the Supabase service-role key in frontend; never commit signing keys.
- Ask before connecting new services. Commit logical milestones.

## Infrastructure (IDs are not secrets)
- GitHub: `PrajwalS380/Sumanova-2026` (public). Owner login `PrajwalS380`.
- Branches: `main`, `develop`, `release/1.0.0`, `SUM-202601`. **Work on `SUM-202601`**; later PR `SUM-202601 → develop`.
  Do not create PRs unless asked.
- Supabase project `sumanova`, ref `wssfbcscijpwfohhkerz`, region `ap-south-1` (Mumbai), free plan, org `wfpbjkxzutkdqtzeprsw`.
  URL `https://wssfbcscijpwfohhkerz.supabase.co`, publishable key in `.env.example`/workflow (public by design).
- Vercel: team `team_Ek6eQ7uK5m4FsWWMw9NRpZO7`, project `sumanova` (`prj_KJCcMMkZrHPOYLtGdE31p93qwJ5r`),
  production URL **https://sumanova.vercel.app**. Vercel production branch is `main`; deploy SUM-202601 to production
  manually via the Vercel MCP `create_deployment` (target production, gitSource ref SUM-202601) after each milestone.
- Mobile: Capacitor 8, appId `com.sumanova.app`. `.github/workflows/apps.yml` builds web + signed APK + unsigned IPA on
  push and publishes a GitHub pre-release `build-N`. Signing via repo secrets `ANDROID_KEYSTORE_BASE64`,
  `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (=sumanova), `ANDROID_KEY_PASSWORD` (owner adds them; key file was
  delivered privately, never commit it).
- iPhone at ₹0: Safari "Add to Home Screen" web app, or sideload unsigned IPA (SideStore, 7-day). App Store needs
  $99/yr — not approved.

## Stack & conventions
React 18 + TS + Vite 5 + Tailwind 3 + Framer Motion + Lucide + Zod, Supabase JS v2, vite-plugin-pwa (web only),
Capacitor plugins (status-bar, splash, haptics, share, filesystem, app). Path alias `@/` → `src/`.
- Design system **"Bento"** (owner-approved 2026-11-25, round 4; canvas https://claude.ai/artifact/YRvWos2boF7mhEDoAcfJqP —
  Option 3 Bento + Option 10 "ghost" layer, on Snapchat-familiar layouts): soft grey canvas `bg-noir` (#ECECEF), rounded white /
  black / colour tiles (`rounded-tile` = 26px), near-black ink, Inter (heavy, tight `font-display`), black accent by default
  (Settings → Theme colour: Ink/Pink/Blue/Green/Violet/Orange, solid), black floating bottom bar with a white rounded-square
  camera. Every list row / card gets a big faint copy of its avatar or icon behind it: `components/ui/Ghost` + `GHOST_HOST`.
  Profile: full-body avatar in the person's scene (`components/Scene`, `profiles.profile_scene`) → tap → /avatar/home → studio;
  picture = avatar face or selfie (/profile/photo; `avatar_face_url` keeps the face, `photo_mode`). Birthdays & zodiac
  (/birthdays, `friend_birthdays()` = day+month only, `privacy_settings.show_birthday`, `lib/zodiac.ts`), profile code
  (/profile/code, QR + BarcodeDetector scan), saved accounts (/accounts, `lib/savedAccounts.ts`, tokens only, never passwords),
  streak Restore pill in the chat list. Logo (owner asked for a Snapchat-level iconic mark, original): "Nova" — white four-point
  star mascot with bold black outline and a face, on a hot-pink #FF4F9A tile (`components/Logo.tsx`, `public/favicon.svg`,
  `assets/*` → Android res via `npx @capacitor/assets generate --android`). Auth/welcome pages: logo + SUMANOVA wordmark, no slogans.
  Avatar onboarding (/onboarding/avatar after sign-up/log-in, Skip remembered per account): "Make it from a selfie" (/avatar/selfie)
  or one of 11 pre-rendered starter characters (public/presets). Selfie → avatar runs fully on-device, ₹0: MediaPipe Face
  Landmarker bundled in public/mediapipe (wasm + face_landmarker.task, CDN only as fallback) → `selfie/analyze.ts` (skin/hair/
  eye/lip colour, hair length/volume, beard, face/eye/nose/mouth shape) → `selfie/generate.ts` (6 editable Looks) → studio
  (?from=selfie via sessionStorage). Live framing guide + live trait chips; upload-a-photo and pick-a-character fallbacks. Earlier design (superseded): Design system **"Pearl"** (owner-approved from 5 wireframe options; canvas
  https://claude.ai/artifact/QeBwqyGdk5sy2xz7PHFneG). Light theme: milky glass over blue/pink/mint pearl sheen, navy
  ink, indigo accent, Instrument Serif display + Manrope. Token names are legacy: `noir.*` = light surfaces,
  `ink.*` = navy text, `ember.*` = accents (`ember-flame` indigo, `ember-cream` = navy active capsule with `text-noir`),
  `bg-ember-gradient` = indigo→violet (white text). Media screens (camera, editor, story/snap viewers, call, Spotlight
  player) keep white-on-dark overlays; everything else uses `ink/…` overlays, never `white/…`.
  UI v2 (owner-approved 2026-11-25, wireframes https://claude.ai/artifact/YRvWos2boF7mhEDoAcfJqP, plan docs/UI_V2_PLAN.md;
  owner wants screens to match the wireframes EXACTLY — colours, fields, layout): camera-first home `/`, five-tab
  `BottomDock` (Map · Chat · Camera · Stories · Spotlight; dark on camera/Spotlight), `TopBar`/`MeButton` = my avatar FACE
  top-left opens /profile. Everyone's picture is their rendered 3D avatar: studio save publishes face → `profiles.avatar_url`
  and full body → `profiles.avatar_body_url`. Spotlight opens straight into the player (Following / For you).
  Signed-out landing `/auth/welcome` (pre-rendered starter figures in public/welcome). No widget dashboard, no drawer.
  Accent colour is user-selectable (Settings → Theme colour, `lib/accent.ts`): `ember-flame`/`ember-amber`/`bg-ember-gradient`
  read CSS vars `--accent`/`--accent-from`/`--accent-to` (RGB channels). Never hard-code #3D4FE0 in new UI. Familiar camera-first alignment is owner-approved, but never copy Snapchat artwork, logos, names or yellow.
- Avatar v2 (owner wants Snapchat-level depth, ~100 variants per category, all original & free, no brands):
  `features/avatar/look/` = data (`config.ts` Look v2 + v1 migration, `face.ts`/`hair.ts`/`fashion.ts`/`extras.ts`
  100-variant catalogues as families × params, `palettes.ts`, `tube.ts` tapered-strand builder);
  `render/` = `Figure` (body/poses), `Face` (eyes/lids/lashes/brows/nose/lips/ears/beard/makeup), `Hair` (scalp cap +
  hundreds of tapered locks, ombré tips), `Clothes` (lathed garments, `patterns.ts` canvas fabrics), `Accessories`
  (glasses/hats/head add-ons), `Jewelry` (piercings). Editor `AvatarStudio.tsx` (Style / Face & body / Saved tabs,
  lazy variant thumbnails via one hidden GL canvas in `editor/thumbs.tsx`, persisted in Cache Storage `snv-thumbs-vN`
  (bump the version when the renderer's look changes), colour rail, undo/redo).
  Cartoon-real style (owner refs: friendly 3D cartoon people, but original): adult proportions (`LEG`, `HEAD_SCALE`,
  `SHOE` in `Figure.tsx`), sculpted hair (smooth cap + few broad clumps, `sculpt` in `Hair.tsx`), soft three-point light.
  12 original starter characters in `look/presets.ts` (Looks tab → "Start from a character"); random = wearable outfits.
  Visual check: `npx vite --config vite.avatar-test.config.ts` (`?presets=1&n=8`) (port 5199, `?slot=hair&ids=1,2&frame=head`, `?random=8`).
  Keep ≤8 canvases per harness page (swiftshader). Python/sed multi-file edits get blocked by the sandbox classifier — use Edit.
- **Nova emoji** (owner: "don't just use prebuilt emojis"): our own SVG emoji set in `components/emoji/novaEmoji.ts`
  (squircle faces, bold #111 outline; `NovaEmoji` component, `novaEmojiImage` for canvas). Used for badges (`badgeArt`),
  streak flame/hourglass, lens tray icons, chat + editor stickers (stored as `nova:<id>`). Face lenses in
  `features/camera/lenses.ts` draw with it; visual check: `npx vite --config vite.lens-test.config.ts` then
  `?photo=/portrait.jpg` (put any frontal photo in e2e/lens-harness, git-ignored). New UI: prefer Nova emoji over system emoji.
- Features live in `src/features/<feature>`. Shared libs in `src/lib`. Auth state in `src/providers/AuthProvider.tsx`.
- Sign-up is **instant** (owner chose, 2026-11-24): Edge Function `signup` (verify_jwt=false) re-validates input, caps 30
  sign-ups/hour, and creates a confirmed user via the service role; the client then signs in with the password. The free
  built-in mailer only reaches team emails, so password reset uses 6-digit email OTP (`verifyOtp` type `recovery`) and
  only works for everyone once custom SMTP is set (owner step, optional). Owner declined adding api.supabase.com to the
  session network; don't re-propose it.
- DB: migrations in `supabase/migrations/` (timestamped). Apply via Supabase MCP `apply_migration` with the same SQL.
  RLS on every table; verify with rolled-back SQL tests in `supabase/tests/`. Statements that delete from `auth.users`
  trigger an approval prompt the owner often misses — keep such statements in separate small migrations.
- Tests: Vitest + Testing Library (`npm test`), `npm run typecheck`, `npm run build`. CI must stay green.
- Commit as `PrajwalS380 <181549311+PrajwalS380@users.noreply.github.com>`; no model names in commits.

## Feature checklist build (owner said "approve all", 2026-11-25; then "finish all batches end to end without asking")
Done: batch 1 (contacts/phone/PYMK/badges), Nova emoji + lenses, batch 2 (polls, live location, scheduled msgs,
moving + avatar stickers, chat screenshot alerts), batch 3 (group calls, mesh ≤6).
Remaining, in order: batch 4 camera (lens browser, background blur/replace + hair colour via bundled MediaPipe
segmenters in public/mediapipe, makeup, distortions, night mode, front flash, video speed/reverse/multi-clip/voice
changer, original synthesized music on snaps, snap templates) → batch 5 (group/private stories, @mentions, Places (OSM),
heat map, explored areas/travel/battery, passcode private memories, memory search, hashtags/trending sounds/creator
stats, remix) → batch 6 (snap score, trophies, TOTP 2FA, login alerts + devices, data download, birthday
notifications, closed-app Android push needs owner Firebase) → batch 7 (B1–B13). After each batch: migration +
rolled-back test, typecheck/test/build, commit, push, Vercel deploy, APK link. If an approval is blocked, record it in
`docs/PENDING_OWNER_ACTIONS.md` and keep going.

## Sandbox limits (this cloud environment)
Outbound network to supabase.co / vercel.app is blocked from the shell; use Supabase MCP (`execute_sql`) and Vercel
MCP (`web_fetch_vercel_url`) to verify. No Android SDK locally — Android builds run on GitHub Actions.

## Status (all phases built)
- Built & pushed: foundation, chat, calls, snaps/editor/filters, avatar studio, stories/streaks/friendship, memories,
  Spotlight, map, AR lenses (MediaPipe), notifications + web push (Edge Function `push`, VAPID in Vault), hardening.
- All migrations applied (incl. `20261113000300_account_deletion.sql`, `20261113000500_social_and_chat_removals.sql`, 2026-11-24).
  Never put DELETE statements in new migrations; use soft-delete columns. Avoid UPDATE without WHERE in test SQL.
- Edge Function `push` (verify_jwt=false by design; validates by id + freshness with service role).
- Cron jobs: `sumanova-housekeeping` (*/10), `sumanova-streak-reminders` (16:00 UTC).
- Owner handbook with every manual step: `docs/OWNER_HANDBOOK.txt`.
- Owner to-dos (all optional for testing): Gmail SMTP + templates (password reset for everyone), Site URL, GitHub signing secrets,
  optional Firebase for closed-app Android push, optional TURN for strict networks.
