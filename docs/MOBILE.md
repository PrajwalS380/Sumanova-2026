# SUMANOVA on Android and iPhone

SUMANOVA is one codebase (React + Capacitor) shipped three ways:

| Platform | How users get it | Cost |
| --- | --- | --- |
| **Android** | Real app: `SUMANOVA.apk` from the latest GitHub release | ₹0 |
| **iPhone** | Web app installed from Safari (recommended), or the native `.ipa` sideloaded | ₹0 (native via App Store/TestFlight needs Apple's $99/yr program) |
| **Any browser** | https://sumanova.vercel.app | ₹0 |

## Android — install the APK

1. On your phone open **github.com/PrajwalS380/Sumanova-2026/releases**.
2. Open the newest release and tap **SUMANOVA.apk** to download it.
3. Open the downloaded file. If Android asks, allow **Install unknown apps** for Chrome.
4. Play Protect may say the app is unknown — tap **More details → Install anyway** (it's your own app, not from the Play Store).
5. Open SUMANOVA and allow camera access when asked.

**Updates:** every push builds a new release. Install the new APK over the old one — your login stays.
Updates install in place only when every APK is signed with the same key (the `ANDROID_KEYSTORE_*` GitHub secrets).

### How the APK is built
`.github/workflows/apps.yml` runs on GitHub Actions (free for public repos):
web build → `npx cap sync android` → `./gradlew assembleRelease` → signed APK → GitHub pre-release.

The signing key is **never** in the repo. It's provided through repository secrets:
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
Without them CI falls back to a throwaway debug key (installs fine, but each build needs uninstall-then-install).

## iPhone — honest options at ₹0

Apple only lets apps onto an iPhone through the App Store, TestFlight, or a developer-signed sideload.

1. **Web app (recommended, ₹0, works today).** Open https://sumanova.vercel.app in **Safari** → Share → **Add to Home Screen**.
   It runs full-screen with its own icon, camera access, and (iOS 16.4+) push notifications.
2. **Native app via sideloading (₹0, with limits).** CI builds `SUMANOVA-unsigned.ipa`. Tools such as
   SideStore/AltStore can sign it with a free Apple ID. Apple limits free signing to **7 days** (then it must
   be refreshed) and 3 apps per device.
3. **App Store / TestFlight (not ₹0).** Requires the Apple Developer Program (USD 99/year). Not enabled
   without your approval. The Xcode project in `ios/` is ready for it.

## Building locally (optional)

```bash
npm run build && npx cap sync
npx cap open android   # Android Studio
npx cap open ios       # Xcode (macOS only)
```
