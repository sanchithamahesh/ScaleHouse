# WeighBridge — User Guide

For store staff and whoever supports them. Covers what the app does, how to get it
installed, how to pair it to the scale, and how to use it day to day.

## What WeighBridge does

WeighBridge logs **culling weight sessions** — produce or stock being pulled from the
shelf and weighed before write-off, so the business has a record of what and how much
was removed, by store.

You:
1. Start a session for a store.
2. Weigh each item on the scale, pick the product, and add the reading to the session.
3. End the session when you're done — WeighBridge totals everything by product.

Anything not manually ended gets automatically closed out at the end of the day, so
nothing is left "open" indefinitely.

## Two ways to run it

| | Where it runs | Scale connection |
|---|---|---|
| **Android app (recommended for phones)** | Installed app on an Android phone/tablet | Real Bluetooth, via the phone's own Bluetooth stack |
| **Browser (desktop only)** | Chrome or Edge on a laptop | Web Serial — the scale's Bluetooth port, opened as if it were a COM port |

If you're on a phone, use the Android app — the browser path (Web Serial) does not
work on phones at all, only on desktop Chrome/Edge. If you don't have the scale
nearby and just need to log manual weights, either option works with manual entry.

## Installing the Android app

There is no Play Store listing (yet) — this is a sideloaded app, installed from a
direct download link, the same way you'd install any APK a store manager sends you.

1. Get the download link from the Team (it changes each time a new version is
   built — always use the latest link they give you, not an old one).
2. Open the link in your phone's browser and download the `.apk` file.
3. Tap the downloaded file to install it. If Android blocks it with **"Install
   blocked"** or asks about installing from an unknown source, tap **Settings** in
   that prompt and allow installs from the browser you used — this is a one-time
   permission per browser, not a real security warning about this specific app.
4. Open **WeighBridge** from your app drawer once it's installed.

No cable connection to a computer is ever needed to install or update it — always a
direct download + tap-to-install, the same as any file you'd download and open.

## Pairing the scale (do this once per phone)

The app connects to a scale that's **already paired** at the Android system level —
it doesn't do the Bluetooth pairing itself. Pair it once, the same way you'd pair any
Bluetooth headphones or speaker:

1. Turn the scale on.
2. On the phone: **Settings → Connected devices → Pair new device** (wording varies
   slightly by phone).
3. Look for a device named **BT1041** and tap it to pair. No PIN is normally required;
   if one is asked for, try `0000` or `1234`.
4. Once it shows as paired in Android's Bluetooth settings, you're done — you won't
   need to repeat this unless you unpair it or set up a new phone.

## Connecting inside the app

1. Open WeighBridge.
2. At the top of any screen there's a connection bar showing **"not connected"** or
   **"connected"**. Tap **Connect scale**.
3. The app looks for the paired **BT1041** and opens a connection to it. This takes a
   couple of seconds — you'll see the bar switch to **connected** once it's ready.
4. If it fails: make sure the scale is powered on and still paired (re-check step
   above), then try Connect again. The connection is shared across the whole app —
   once connected, it stays connected as you move between sessions; you don't need to
   reconnect for each new session.
5. **Disconnect scale** on the same bar closes the connection when you're done for
   the day (not required — just tidy).

**## Running a weighing session⚠️ Negative readings get logged too.
If the scale shows a minus number (like -0.045) when you press MR, the app adds it anyway — it does not check if the number is negative.
Fix: Check the scale screen before pressing MR.**
1. From the home screen, tap **New session**, choose the store, and tap **Start
   session**.
2. Pick the **product** from the dropdown.
3. Place the item on the scale. Once it's steady, the reading appears in the
   **Weight** field automatically (marked "live from scale") — you don't need to type
   it in.
   - If the scale isn't connected, or you just need to log a number by hand, type
     the weight directly into that same field instead.
4. Tap **Add**. The entry is logged under that product, and the field clears for the
   next item.
5. Repeat for every item. Entries are grouped by product on screen as you go, so you
   can see a running total per product without leaving the session.
6. Made a mistake? Tap **Delete** next to an entry — you get an **Undo** for a few
   seconds afterward in case that was wrong too.
7. When the session is done, tap **End session** and confirm. This locks the totals
   in and can't be undone — double check before confirming.

Sessions left open overnight are automatically ended at the end of the day so they
don't sit open indefinitely; you'll see them show up as "ended" the next day with
whatever was logged up to that point.

## Reading the numbers

- **Pending** sessions are still open — you can keep adding to them.
- **Ended** sessions show a **product totals** breakdown: how much of each product
  was logged, and the grand total for that session.
- Every ended session shows how it was closed: **manually closed** (someone tapped
  End session) or **auto (end of day)** (left open and closed automatically).

## Troubleshooting

| Problem | What to try |
|---|---|
| Scale won't connect | Check it's powered on and still paired in Android Bluetooth settings (re-pair if it's disappeared from the list). |
| Connected, but no reading shows up | Make sure something is actually on the scale platform and it's settled (not mid-weigh/jumping). Try placing and removing the item once to "wake" the reading. |
| Weight shown looks wrong (e.g. 0 or negative) | The app deliberately ignores 0/negative readings — these are scale noise (settling/tare drift), not real weights. Wait a moment for a steady reading. |
| App won't install / Android blocks it | This is the standard "unknown source" warning for any sideloaded app, not an error specific to WeighBridge — allow installs from your browser in the prompt Android shows, then retry. |
| Need to reinstall on a new phone | Re-download the latest link from your manager and repeat the pairing steps above — sessions from the old phone don't transfer (see note below). |

## One thing to know: data lives on the device

Session and entry data is stored **on the phone or laptop you're using**, not in a
shared company system. That means:
- Switching devices starts you with a clean slate — nothing carries over automatically.
- Uninstalling the app, or clearing its storage, deletes the session history on that
  device.

If your store needs the numbers preserved centrally (e.g. for reporting across
devices), talk to your manager about how ended-session totals should be recorded
outside the app for now — this is a known limitation of the current version, not
something you're doing wrong.
