const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const statusEl = document.getElementById('status');
const weightEl = document.getElementById('weight');
const logEl = document.getElementById('log');
const baudEl = document.getElementById('baud');

let port;
let reader;
let keepReading = false;

function log(line) {
  logEl.textContent += line + '\n';
  logEl.scrollTop = logEl.scrollHeight;
}

// Pulls the numeric weight out of readings like "000.045", "M000.611"
function extractWeight(raw) {
  const match = raw.match(/-?\d+(\.\d+)?/);
  return match ? match[0] : null;
}

async function connect() {
  if (!('serial' in navigator)) {
    statusEl.textContent = 'Web Serial not supported. Use desktop Chrome or Edge.';
    return;
  }

  try {
    // Pair the scale in Windows Bluetooth settings FIRST — it then shows up
    // here as a serial port (e.g. "Standard Serial over Bluetooth link").
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: Number(baudEl.value) || 9600 });

    statusEl.textContent = 'Connected. Waiting for scale data...';
    connectBtn.disabled = true;
    disconnectBtn.disabled = false;
    keepReading = true;

    readLoop();
  } catch (err) {
    statusEl.textContent = 'Connection failed: ' + err.message;
    log('ERROR: ' + err.message);
  }
}

async function readLoop() {
  const textDecoder = new TextDecoderStream();
  const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
  reader = textDecoder.readable.getReader();

  let buffer = '';

  try {
    while (keepReading) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        buffer += value;
        // Scale terminates each reading with CR (\r)
        let parts = buffer.split(/\r\n?|\n/);
        buffer = parts.pop(); // keep incomplete tail for next chunk

        for (const part of parts) {
          const line = part.trim();
          if (!line) continue;
          log(line);
          const weight = extractWeight(line);
          if (weight !== null) {
            weightEl.textContent = weight + ' kg';
          }
        }
      }
    }
  } catch (err) {
    log('READ ERROR: ' + err.message);
    statusEl.textContent = 'Read error: ' + err.message;
  } finally {
    reader.releaseLock();
    await readableStreamClosed.catch(() => {});
  }
}

async function disconnect() {
  keepReading = false;
  if (reader) {
    try { await reader.cancel(); } catch (e) {}
  }
  if (port) {
    try { await port.close(); } catch (e) {}
  }
  statusEl.textContent = 'Disconnected.';
  connectBtn.disabled = false;
  disconnectBtn.disabled = true;
}

connectBtn.addEventListener('click', connect);
disconnectBtn.addEventListener('click', disconnect);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch(() => {});
}

// --- Native bridge (only present when wrapped by Capacitor as an installed app) ---
// This is the path that actually works on Android for this scale, since it
// uses a real Bluetooth socket via native code instead of navigator.serial.
const nativeSection = document.getElementById('nativeSection');
const nativeConnectBtn = document.getElementById('nativeConnectBtn');

if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
  nativeSection.style.display = 'block';

  const BluetoothSerial = window.Capacitor.Plugins.BluetoothSerial;

  BluetoothSerial.addListener('weightReading', (data) => {
    log('[native] ' + data.raw);
    if (data.weight !== undefined) {
      weightEl.textContent = data.weight + ' kg';
    }
  });

  BluetoothSerial.addListener('statusChange', (data) => {
    if (data.connected) {
      statusEl.textContent = 'Connected via native bridge. Waiting for scale data...';
    } else {
      statusEl.textContent = 'Native bridge disconnected' + (data.error ? ': ' + data.error : '.');
    }
  });

  nativeConnectBtn.addEventListener('click', async () => {
    try {
      statusEl.textContent = 'Connecting via native bridge...';
      await BluetoothSerial.connect({ deviceName: 'BT1041' });
    } catch (err) {
      statusEl.textContent = 'Native connect failed: ' + err.message;
      log('NATIVE ERROR: ' + err.message);
    }
  });
}
