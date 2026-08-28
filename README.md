# Scale Bluetooth POC

Tests whether the Alfa Digital Weighing Scale (BT1041 Bluetooth module) can
send weight readings straight into a browser page on a **laptop/desktop**.

This works on desktop because Chrome/Edge support the **Web Serial API**,
which can read a Bluetooth device once it's paired as a serial (COM) port
at the OS level. This is different from Web Bluetooth API (which only
works with BLE) and is **not available on phones** — desktop only.

## Steps

1. **Pair the scale in Windows first** (not in this app):
   Settings → Bluetooth & devices → Add device → select `BT1041` → pair.
   Windows will create a serial port for it (Device Manager → Ports (COM & LPT) →
   something like "Standard Serial over Bluetooth link (COMx)").

2. **Serve this folder** (Web Serial needs a real server, not a `file://` page):
   ```
   npx serve .
   ```
   or
   ```
   python -m http.server 8000
   ```
   Then open the printed `http://localhost:...` URL in **Chrome or Edge**.

3. Click **Connect to Scale**. A browser popup will list available ports —
   choose the Bluetooth serial port for BT1041.

4. Press the **MR** button on the scale. The weight should appear on the page,
   and raw incoming lines will show in the log box below it.

5. If the log shows garbled/random characters instead of readable numbers,
   change the **baud rate** field (try 9600, 19200, 38400, 115200) and
   reconnect — this is the one setting that has to match the module.

## What a successful test proves

If this works, it confirms the weight data *can* reach a browser directly —
just only on desktop, not on phones (that's the Web Serial API limitation).
That validates "Option A" from the earlier analysis: laptops/tablets work
today with zero hardware changes; phones still need either a module swap
or a small bridge app.
