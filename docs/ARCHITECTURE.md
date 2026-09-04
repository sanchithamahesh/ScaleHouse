# Scalehouse — Architecture & Design Decisions

This document covers everything in this repository, across both branches: what each
piece is, why it exists, and the reasoning behind the choices made. It's meant for
whoever picks this project up next — a new developer, or future-you six months from
now.

## The problem this repo solves

Store staff run "culling" sessions: weighing produce/stock that's being pulled from
the shelf (damaged, expired, shrink) and logging it by product, so the business can
see what's being written off. The scale is an **Alfa digital weighing scale** fitted
with a **Bluetooth module (BT1041)**. It talks Bluetooth **Classic (SPP — Serial Port
Profile)**, not Bluetooth Low Energy, and it streams plain ASCII text at 9600 baud:

```
000.507\r\n
000.512\r\n
```
(zero-padded decimal kilograms, one line per reading, `\r`/`\n` terminated)

Everything in this repo is built around getting that text stream into a usable app
for store staff, on the devices they actually have (phones, mostly).

## Branch layout

| Branch | What it is | Runs where |
|---|---|---|
| `main` | The original PWA. Plain HTML/CSS/JS, reads the scale via the **Web Serial API**. | Desktop Chrome/Edge only |
| `Capacitor` | Everything in `main`, plus a native Android wrapper with a custom Bluetooth plugin. | Android phones (sideloaded APK), and still works as a plain PWA in desktop Chrome |

`Capacitor` is a superset of `main` — nothing was removed, only added. `www/index.html`
and `www/weigh-app.js` are `weigh-app.html`/`weigh-app.js` with the native bridge layered
in (see "The dual-path bridge" below), so the same codebase serves both a browser tab
and a native app from one source of truth.

## Why two connection paths exist at all

The core constraint driving this whole repo: **Web Serial (`navigator.serial`) is a
desktop-Chrome-only API.** It doesn't exist in mobile Chrome, and it can't exist in any
Android WebView (Capacitor's included) — Android's WebView doesn't expose it, full stop.
So a Capacitor app cannot simply "run the PWA" and get scale access on a phone; the
webview has no route to the Bluetooth stack.

Two options were considered for phones:
1. Swap the scale's Bluetooth module for a BLE one → use Web Bluetooth (works in
   mobile Chrome and WebViews). Rejected: requires hardware changes across every
   store's scale, not something this project can mandate.
2. Wrap the same web app in **Capacitor**, and write a small **native Android plugin**
   that opens a real Bluetooth Classic/SPP socket and hands the data to the JS layer.
   This is what the `Capacitor` branch does.

### The dual-path bridge (`www/weigh-app.js`)

Rather than fork the app logic, one `scale` state object and one `route()` re-render
function serve both connection methods:

```js
function isNativePlatform() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}
```

- **In a browser tab** (`isNativePlatform()` is false): `connectScale()` calls
  `navigator.serial.requestPort(...)`, `readLoop()` parses the incoming text stream.
- **In the native app** (`isNativePlatform()` is true): `connectScale()` calls
  `window.Capacitor.Plugins.BluetoothSerial.connect({ deviceName: 'BT1041' })`. The
  native plugin does its own reading in Java and pushes parsed lines back to JS via
  `weightReading` / `statusChange` events, which `initNativeBridge()` listens for and
  writes into the exact same `scale.currentReading` field the Web Serial path uses.

Nothing downstream — the entry form, the "live from scale" tag, the session screens —
knows or cares which bridge is active. That's deliberate: it means the UI code never
needs an `if (native) ... else ...` branch, and a bug fix to how a reading is parsed
only has to be made once per bridge, not once per screen.

One small but real bug this caught: the device bar used to hide the Connect button
entirely with `'serial' in navigator` as the only check, which would have shown
"Scale connection unavailable in this browser" even inside the native app (where
`navigator.serial` correctly doesn't exist, but the native plugin does). Fixed to
`('serial' in navigator) || isNativePlatform()`.

### Why the scale needs two different connection strategies, not one

The scale's own Bluetooth SDP (Service Discovery Protocol) record has been observed
to be **inconsistent between sessions** — sometimes it advertises under the standard
SPP UUID (`00001101-...`), sometimes only under a vendor-specific UUID
(`0000ffe0-...`), with no reliable way to predict which ahead of time. This matters
differently to each bridge:

- **Web Serial** needs to know the UUID *in advance*, because it's used to filter
  Chrome's device picker (`allowedBluetoothServiceClassIds` / `filters`). That's why
  `connectScale()`'s browser path hardcodes `SCALE_CUSTOM_UUID` — without it, the
  scale sometimes doesn't show up in the picker at all.
- **The native plugin** doesn't have this problem the same way: it opens a raw RFCOMM
  socket directly, and if the standard SPP UUID connect fails, it falls back to a
  **reflection-based `createRfcommSocket(1)` call** — connecting on RFCOMM channel 1
  directly, bypassing SDP lookup entirely (the same trick generic serial-terminal
  Android apps use for hardware with incomplete SDP records). This is more robust
  than the browser path for this specific scale, and is the main reason the native
  route was worth building instead of just accepting Web Serial's flakiness.

## The native Android plugin (`android/.../BluetoothSerialPlugin.java`)

A **from-scratch custom Capacitor plugin**, not a third-party one. `cordova-plugin-bluetooth-serial`
was tried first and found to crash natively (not just reject a promise) on real
connect/list calls on Android 12+. Every native call in this plugin is wrapped in
try/catch specifically so a Bluetooth failure surfaces to JS as a normal rejected
promise or `statusChange` event, never a native crash that takes the whole app down.

Shape of the plugin, matching the interface `weigh-app.js` expects:

```java
@CapacitorPlugin(
    name = "BluetoothSerial",
    permissions = { @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT }, alias = "bluetooth") }
)
public class BluetoothSerialPlugin extends Plugin {
    connect(PluginCall)     // finds a bonded device matching deviceName, opens RFCOMM, starts read loop
    disconnect(PluginCall)  // closes the socket, stops the read loop
    // emits "weightReading" and "statusChange" via notifyListeners()
}
```

Key decisions inside it:
- **Only searches already-bonded (paired) devices**, not a live discovery scan. The
  scale must be paired in Android's Bluetooth settings first — this keeps the plugin
  simple and avoids the extra `BLUETOOTH_SCAN` permission and discovery-callback
  plumbing a live scan would need.
- **Runs connect and the read loop on background threads**, never the main/UI thread —
  `socket.connect()` and blocking `InputStream.read()` calls would freeze the UI
  (and the read loop, by design, blocks until data arrives or the socket closes).
- **Line parsing mirrors the Web Serial path exactly**: split on `\r`/`\n`, regex out
  the numeric value, and drop zero/negative readings as load-cell noise rather than
  showing them — this rule lives in both places (`weigh-app.js`'s `readLoop()` and
  the plugin's `emitReading()`) so the two bridges can never disagree about what
  counts as a real weight.
- **Android 12+ (API 31+) runtime permission handling**: `BLUETOOTH_CONNECT` is a
  dangerous permission from API 31 onward and must be requested at runtime, not just
  declared in the manifest. `needsPermission()` checks it, `requestPermissionForAlias`
  triggers the OS prompt, and `@PermissionCallback` re-invokes `connect()` once the
  user answers — so the caller in JS doesn't need to know permission handling
  happened at all; it just gets a resolved or rejected promise either way.

### Manifest permissions (`AndroidManifest.xml`)

```xml
<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="30" />
```
Split by SDK version because Android's Bluetooth permission model changed at API 31:
older devices (≤ Android 11) need the legacy `BLUETOOTH`/`BLUETOOTH_ADMIN`/location
permissions (location was historically required because Bluetooth scanning could be
used to infer physical location); API 31+ replaces that with the more precise
`BLUETOOTH_CONNECT`, which is what the plugin actually requests at runtime.

## Branding: logo, colors, and the app identity

- Palette (`--purple: #782B90`, `--yellow: #FFF200`) and the "Scalehouse" wordmark
  were already established in `weigh-app.html`'s CSS and carried through unchanged.
- The launcher icon and in-app header mark both use the same source artwork
  (`logo-source.png`), generated two different ways because Android's adaptive icon
  system and a plain `<img>` tag have different requirements:
  - **In-app header mark** (`.logo-mark img`, `object-fit: cover`): just needs a
    square crop — the CSS clips it to a rounded square regardless.
  - **Android launcher icon** (`android/app/src/main/res/mipmap-*/`): needs both a
    full-bleed legacy PNG (`ic_launcher.png`) *and* a separate adaptive-icon
    **foreground** layer (`ic_launcher_foreground.png`) scaled to roughly 66% of the
    canvas and centered on transparency. Skipping that safe-zone scaling is a common
    mistake — different phone launchers mask the icon into a circle, squircle, or
    rounded square, and artwork that fills the whole canvas gets clipped unpredictably
    depending on the launcher. The background color layer (`ic_launcher_background.xml`)
    is a flat `#782B90` fill behind it.

## Build & distribution

- `package.json` scripts: `npm run sync` (`cap sync` — copies `www/` into the native
  project and updates native dependencies) and `npm run build-apk` (`gradlew.bat
  assembleDebug`, from `android/`).
- **The built APK is intentionally not committed** (`www/*.apk` is git-ignored) —
  it's a build artifact, not source; anyone with this repo can regenerate it with
  `npm run sync && npm run build-apk`.
- **Debug build, sideloaded, not USB/ADB installed.** Store devices are not put into
  developer/USB-debugging mode. The APK is served over a plain HTTPS link (a local
  `python -m http.server` plus a Cloudflare quick tunnel, in the absence of a proper
  distribution channel) and installed via Android's "Install unknown apps" flow —
  the same as sideloading any APK from a browser download. This is a deliberate
  distribution choice, not a technical limitation of Capacitor; see the companion
  Capacitor deep-dive artifact for what a production distribution path (Play Store,
  or a signed release build via MDM) would look like instead.

## What's deliberately *not* in this repo

- No backend / server-side database. `loadDB()`/`saveDB()` persist everything to
  `localStorage` under `scalehouse_db_v1` — sessions, entries, product summaries all
  live on-device only. Fine for a single-device POC; a real multi-store rollout would
  need this replaced with a real backend (see the companion artifact's notes on data
  persistence being one of the things a "PWA vs. native" decision actually affects).
- No BLE / Web Bluetooth code path — ruled out early because the scale's module is
  Bluetooth Classic, not BLE, and Web Bluetooth cannot speak SPP at all.
- No iOS anything. This scale/module combination, and the whole reason a native
  wrapper was needed, is Android-specific (`BluetoothAdapter`, RFCOMM sockets are
  Android APIs). iOS's Bluetooth Classic story is different and out of scope here.

## See also

- `blueprint.html` (this repo, `main` and `Capacitor`) — the original data-model and
  screen-flow design doc: sessions/entries/products/summaries schema, screen wireframes,
  and the product-level decisions behind the app (why a session model, why soft-delete
  entries, why auto end-of-day rollup).
- `docs/USER_GUIDE.md` (this folder) — for store staff and whoever supports them:
  how to pair the scale, install the app, and use it day to day.
- The companion "Capacitor deep-dive" artifact — how Capacitor actually works under
  the hood, compared against staying a pure PWA, and what a PWA gives up (or has to
  do differently) to gain native access like this.
