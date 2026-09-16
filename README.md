# WeighBridge

A login-gated PWA for tracking store wastage-weighing sessions, with an
optional Bluetooth scale connection. No backend — all data lives in the
browser's `localStorage`.

Open `weigh-app.html` (served, not `file://` — see below) to use it.
`index.html`/`app.js` are the original Phase 1 feasibility test and are
kept only as background (see the last section).

## What it does

- **Login**: Admin or GU (General User) role. GU is locked to one store;
  Admin can switch between stores via the header chip.
- **Sessions**: a 3-step flow per store visit — **Entry** (search a
  product, log a weight) → **Review** (read-only check of everything
  entered) → **Done** (submitted, locked totals).
- **Product search**: debounced, mimics Product Lens's real search
  pattern (name/SKU, 500ms debounce, search-icon trigger).
- **Bluetooth scale capture**: see below.

## Running locally

```
npx serve .
```

Then open the printed URL + `/weigh-app` in **Chrome or Edge** (Web
Serial, used for the scale connection, isn't available in Safari or on
phones — see Background).

## Connecting the scale

Click **Connect** on a session's Entry page. This uses the Web Serial
API, so it only works on desktop Chrome/Edge, and the scale must already
be paired at the OS level first (Windows: Settings → Bluetooth & devices
→ Add device → select the scale's Bluetooth name).

**Capture behavior — read this before expecting it to "just work":**

- A weight is *never* logged automatically just because an item is
  sitting on the scale and the reading has settled. Every capture
  requires: **press Clear/Tare on the scale (reading goes to 0) → place
  the item → let it settle** — for every single weighing, including the
  first one in a session.
- Nothing is read from the scale at all until a product is selected in
  the app first.
- The scale's serial output carries **only the numeric reading** — no
  event marker for which button was pressed. That means the app can't
  tell "Clear was pressed" apart from "MR was pressed" apart from "the
  number just happened to change" — the *only* thing it can reliably
  detect is the reading crossing to zero, which is what the whole
  clear-then-settle flow is built on. If you're expecting a specific
  physical button (e.g. MR) to trigger a capture on its own, that's not
  achievable over this connection — see Background below for why.

## Background: Bluetooth feasibility investigation (Phase 1)

The original question this repo started from: can the Alfa Digital
Weighing Scale (BT1041 Bluetooth module) send weight readings straight
into a PWA, on a phone?

**Short answer: not on a phone, only on desktop.** Chrome/Edge on
desktop support the **Web Serial API**, which can read a Bluetooth
device once it's paired as a serial (COM) port at the OS level. Web
Serial has no phone equivalent — Web Bluetooth (BLE-only) doesn't apply
here since this module uses classic Bluetooth SPP, and Safari doesn't
implement Web Serial at all, on any platform.

Other things confirmed during that investigation, which is why
WeighBridge's own scale logic is built the way it is:

- The module streams continuously (~1 line/sec) whether or not any
  button was pressed — there's no "send on demand" mode and no
  event marker of any kind in the data.
- The scale never transmits a minus sign — a negative reading and its
  positive equivalent produce identical bytes. Negative values are
  therefore not meaningful and aren't read.
- The module can only hold one active connection at a time, and its SDP
  (service discovery) response is inconsistent enough that connections
  fail unpredictably even with nothing else connected.

`index.html`/`app.js`/`diagnostics.html` are the raw testing tools from
that phase, kept for reference. `weigh-app.html`/`weigh-app.js` are the
actual product.
