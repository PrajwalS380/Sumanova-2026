# Security checklist

Status of each control. ✅ done and verified · 🟡 partial · ⏳ planned phase.

| Control | Status | Notes |
| --- | --- | --- |
| RLS on every table | ✅ | `profiles` (read: signed-in users; write: owner), `user_settings` and `privacy_settings` (owner only). Verified with `supabase/tests/phase1_rls.sql`. |
| Anonymous access | ✅ | Anon role reads **0** rows from every table. Only `is_username_available()` is callable pre-sign-up and returns a boolean only. |
| Private data separation | ✅ | Date of birth lives in `user_settings`, never in the public `profiles` row. |
| Immutable user ID | ✅ | `profiles.id` = `auth.users.id`; trigger blocks changes to `id` / `created_at`. |
| Server-side validation | ✅ | Username/name/bio limits enforced by DB CHECK constraints, mirrored client-side for UX. |
| Service-role key | ✅ | Never used in frontend. Only the publishable key is in env. |
| Storage | ✅ | `avatars` bucket: public read (profile photos), uploads limited to the user's own folder, 2 MB, image MIME types only. Images re-encoded client-side (strips EXIF/GPS). |
| Session revocation | ✅ | "Sign out of all devices" uses `signOut({ scope: 'global' })`. |
| Password reset | ✅ | PKCE flow with single-use link. |
| Security headers | ✅ | `vercel.json`: nosniff, frame-deny, strict referrer, permissions policy. |
| Account deletion | 🟡 | Migration `20261113000300_account_deletion.sql` written but **not yet applied** (needs approval). UI button will be added once applied. |
| Rate limiting / abuse prevention | ⏳ | Phase 9. Supabase Auth has built-in auth rate limits. |
| Block / report users | ⏳ | Phase 2 (with friendships). |
| Calls | ✅ | Private signalling channels gated by RLS on `realtime.messages`; server enforces privacy, blocks, one active call per user. Media is DTLS-SRTP peer-to-peer. |
| Chat | ✅ | RLS on conversations/members/messages/reactions; sender and timestamps set by triggers; system messages server-only; members can only change their own prefs (column grants); private `chat-media` bucket with signed URLs. Verified by rolled-back SQL tests. |
| Snaps | ✅ | Private `snaps` bucket; recipients can fetch the file only while unopened or within a short window after open/replay (`can_read_snap_object`); open/replay/screenshot are server RPCs with server timestamps; one replay within 5 min if allowed; expire after 30 days unopened. |
| Screenshots | 🟡 | Android app: FLAG_SECURE blocks screenshots & screen recording while a snap is open; Android 14+ also reports attempts → “took a screenshot” notice. Web/PWA and iPhone sideload: no reliable screenshot signal, so nothing is claimed. |
| End-to-end encryption | ❌ not claimed | Traffic is encrypted **in transit** (HTTPS/WSS/DTLS-SRTP). Messages are **not** end-to-end encrypted; the server can read stored data. |

## Known advisor warnings (intentional)

`is_username_available` is a `SECURITY DEFINER` function executable by `anon`/`authenticated`. This is
required so sign-up can check availability before an account exists. It returns only `true/false` and
exposes no profile data.
