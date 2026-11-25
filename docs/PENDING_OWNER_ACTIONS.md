# Pending owner actions (kept up to date while building unattended)

The owner asked (2026-11-25) for batches 4–7 to be finished end to end without stopping. Anything that
could not be applied or pushed automatically is listed here with the exact file to apply, so it can be
done later in one go. Empty sections mean everything was applied.

## Database migrations not yet applied
(none)

## Commits not yet pushed
(none)

## Edge Functions not yet deployed
(none)

## Needs the owner (cannot be done for you)
- **Closed-app Android notifications (checklist A31).** Android only delivers notifications to a fully
  closed app through Firebase Cloud Messaging, which needs a free Firebase project created with your Google
  account (no card). Until then the app notifies while it's open or in the background, and web/PWA push
  works. Steps are in docs/OWNER_HANDBOOK.txt ("Optional: Firebase for closed-app Android push"). After you
  add `google-services.json` to the repo secrets, say "enable Firebase push" and the sender + app hook can be
  switched on and tested.

## Optional owner steps (unchanged)
See docs/OWNER_HANDBOOK.txt (SMTP, signing secrets, Firebase for closed-app Android push, TURN).
