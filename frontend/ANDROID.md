# Android (Capacitor) Guide

PAVILION HUB wraps the existing React/Vite frontend in a native Android shell
using Capacitor. The web version is untouched — the same `frontend/dist`
output powers both.

## Project layout

```
frontend/
  capacitor.config.ts      Capacitor configuration (appId: com.pavilionhub.app)
  dist/                    Built web app — what the Android app embeds
  android/                 Native Android project (Gradle)
  android/app/build/outputs/apk/debug/   Debug APK lands here
```

## Requirements

| Tool           | Version                                         | Notes                                                         |
| -------------- | ----------------------------------------------- | ------------------------------------------------------------- |
| Node.js        | 20+                                             | Already required for the web build                            |
| Android Studio | Ladybug (2024.2) or newer                       | Includes the Android SDK manager                              |
| JDK            | 17                                              | Bundled with recent Android Studio; Gradle needs exactly this |
| Android SDK    | Platform 36 + Build-Tools 36.x + Platform-Tools | Install via Android Studio → SDK Manager                      |

Install steps:

1. Install [Android Studio](https://developer.android.com/studio).
2. Open **Tools → SDK Manager → SDK Platforms**: check **Android 14+ (API 34+)**.
3. Under **SDK Tools**: check **Android SDK Build-Tools**, **Android SDK
   Platform-Tools**, and **Android SDK Command-line Tools**.
4. Note the SDK path shown at the top of the SDK Manager (typically
   `C:\Users\<you>\AppData\Local\Android\Sdk`). Capacitor looks for it via the
   `ANDROID_HOME` environment variable or a `local.properties` file in
   `frontend/android/` (auto-generated on first Gradle run; git-ignored).

## Workflow

After any frontend change:

```powershell
cd frontend
npm run build          # tsc + vite build → dist/
npx cap sync android   # copies dist/ into the Android project
```

Open the native project in Android Studio (recommended for first build — it
downloads the exact Gradle version and accepts SDK licenses):

```powershell
npx cap open android
```

## Building a debug APK (command line)

From the repo root:

```powershell
cd frontend\android
.\gradlew.bat assembleDebug
```

On success the APK is at:

```
frontend\android\app\build\outputs\apk\debug\app-debug.apk
```

> A debug APK is signed automatically with the auto-generated debug keystore
> (`%USERPROFILE%\.android\debug.keystore`). It is fine for testing, but is
> not for distribution.

## Installing & testing on a phone

1. Enable **Developer options** on the phone (tap Build number 7× in Settings),
   then enable **USB debugging**.
2. Connect via USB and verify:
   ```powershell
   adb devices      # should list the device
   ```
3. Install and launch:
   ```powershell
   adb install -r frontend\android\app\build\outputs\apk\debug\app-debug.apk
   adb shell am start -n com.pavilionhub.app/.MainActivity
   ```
   Or simply run `.\gradlew.bat installDebug`, or press ▶ in Android Studio
   with the device selected.

### What to check on the phone

- Hamburger menu opens the sidebar drawer and closes on selection.
- Scoring screen: run buttons (0–6), wicket/extra buttons register taps; the
  7-column run grid collapses to 4 columns on narrow screens.
- Forms/inputs are tappable and the keyboard doesn't cover active fields.
- Layout adapts at every rotation; nothing hides behind the topbar or notch.

### Emulator alternative

In Android Studio: **Device Manager → Create Device** (any Pixel, API 34+),
then press ▶. Useful if no physical device is handy; remember localhost APIs
behave differently here (see below).

## API URLs on a device

Dashboard, Matches, Tournaments, and Teams & Players use the Node API when it
is reachable, and fall back to clearly labeled demo data when it is not. The
Scoring screen is still a separate local demo: it uses fictional teams and
does not save its ball-by-ball events to the backend. Do not treat its scores
as persisted match records. **Never hardcode `localhost`** in the API URL — on
a physical phone that address means the phone itself, not your computer.

Two supported approaches:

1. **Same Wi-Fi, LAN IP (recommended for physical devices).** Create
   `frontend/.env.local` (git-ignored) with your computer's LAN IP, then
   rebuild + resync. Configure the backend's `FRONTEND_ORIGIN` to match the
   Android WebView origin allowed by its exact-origin CORS policy:
   ```
   VITE_API_URL=http://192.168.1.50:3000/api
   ```
   Find the IP with `ipconfig` (IPv4 Address under Wi-Fi). The Node backend
   must be listening and reachable. CORS allows only its configured
   `FRONTEND_ORIGIN`; configure the WebView origin explicitly instead of
   relying on the browser-development default.
2. **Same-origin reverse proxy.** Leave `VITE_API_URL` unset only when the
   WebView's origin serves or reverse-proxies `/api` to the backend. A
   `server.hostname` setting changes the WebView host name; it does not set
   the API server address.

Plain-HTTP LAN URLs work in debug builds. For release builds, use HTTPS.

## Signing / release

Debug builds need no configuration. For release builds:

1. Generate a keystore **outside the repo**:
   ```powershell
   keytool -genkey -v -keystore $env:USERPROFILE\pavilion-release.keystore `
     -alias pavilion -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Create `frontend/android/keystore.properties` (git-ignored) with the store
   path/alias/passwords, and reference it from `app/build.gradle`.
3. Build with `.\gradlew.bat assembleRelease`.

**Never commit** `*.keystore`, `*.jks`, `keystore.properties`, or any passwords
— the root `.gitignore` already excludes them, but double-check before pushing.
Losing a release keystore means you can never update the published app.

## Troubleshooting

- **Gradle can't find the SDK / licenses** → set `ANDROID_HOME` and run
  Android Studio once, or `sdkmanager --licenses`.
- **`npx cap sync` after backend URL changes** → env changes require a full
  `npm run build` before sync; the copy step does not re-evaluate `.env`.
- **App shows old content** → `npx cap sync android` (or check `dist/` was
  actually rebuilt).
- **White screen on device** → open `chrome://inspect` in desktop Chrome with
  the device connected to see WebView console errors.
