// ---------- Data layer (localStorage-backed, matches the blueprint's tables) ----------
const DB_KEY = 'scalehouse_db_v1';

function seedProducts() {
  return [
    { id: 'p1', name: 'Basmati Rice', sku: 'RICE-BAS' },
    { id: 'p2', name: 'Toor Dal', sku: 'DAL-TOOR' },
    { id: 'p3', name: 'Sugar', sku: 'SUGAR-01' },
    { id: 'p4', name: 'Wheat Flour', sku: 'FLOUR-WH' },
    { id: 'p5', name: 'Onions', sku: 'VEG-ONI' },
    { id: 'p6', name: 'Potatoes', sku: 'VEG-POT' },
  ];
}

function loadDB() {
  const raw = localStorage.getItem(DB_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) { /* fall through to fresh db */ }
  }
  return { sessions: [], entries: [], summaries: [], products: seedProducts() };
}

let db = loadDB();
function saveDB() { localStorage.setItem(DB_KEY, JSON.stringify(db)); }

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function productName(id) { const p = db.products.find(p => p.id === id); return p ? p.name : 'Unknown product'; }

const ICON_BLUETOOTH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"/></svg>';

// Digital scale glyph: platform + display window - reads clearly at 20px, unlike an emoji.
const ICON_SCALE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="10.5" width="18" height="8.5" rx="2"/><rect x="7.5" y="4.5" width="9" height="6" rx="1.3"/><line x1="9.8" y1="7.5" x2="14.2" y2="7.5"/></svg>';
const ICON_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
const ICON_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>';

const STORE_NAMES = ['Store 12 — MG Road', 'Store 4 — Whitefield', 'Store 27 — Indiranagar'];
let homeSearch = '';
let homeStoreFilter = 'all';

function connectionChip(conn) {
  if (conn && conn.connected) {
    return `<span class="chip ok">${ICON_BLUETOOTH}connected${conn.lastReadingAt ? ' · ' + timeAgo(conn.lastReadingAt) : ' · waiting for reading'}</span>`;
  }
  return `<span class="chip off"><span class="dot"></span>not connected</span>`;
}

function timeAgo(iso) {
  if (!iso) return null;
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return s + 's ago';
  const m = Math.round(s / 60);
  if (m < 60) return m + 'm ago';
  return Math.round(m / 60) + 'h ago';
}

function sessionTotals(sessionId) {
  const entries = db.entries.filter(e => e.sessionId === sessionId && !e.deletedAt);
  const total = entries.reduce((sum, e) => sum + e.weightKg, 0);
  return { count: entries.length, total: Math.round(total * 1000) / 1000 };
}

// ---------- End-of-day rollup ----------
function todayKey(d = new Date()) { return d.toISOString().slice(0, 10); }

function endSession(sessionId, reason) {
  const session = db.sessions.find(s => s.id === sessionId);
  if (!session || session.status === 'ended') return;
  session.status = 'ended';
  session.endedAt = new Date().toISOString();
  session.endedReason = reason;

  const entries = db.entries.filter(e => e.sessionId === sessionId && !e.deletedAt);
  const byProduct = {};
  entries.forEach(e => {
    if (!byProduct[e.productId]) byProduct[e.productId] = { count: 0, total: 0 };
    byProduct[e.productId].count++;
    byProduct[e.productId].total += e.weightKg;
  });
  Object.keys(byProduct).forEach(productId => {
    db.summaries.push({
      sessionId, productId,
      entryCount: byProduct[productId].count,
      totalWeightKg: Math.round(byProduct[productId].total * 1000) / 1000,
    });
  });
}

function runAutoRollup() {
  const today = todayKey();
  let changed = false;
  db.sessions.forEach(s => {
    if (s.status === 'pending' && todayKey(new Date(s.startedAt)) < today) {
      endSession(s.id, 'auto_eod');
      changed = true;
    }
  });
  if (changed) saveDB();
}

// ---------- Per-session UI state (just which product is selected - NOT the connection) ----------
const sessionUI = {};
function getSessionUI(sessionId) {
  if (!sessionUI[sessionId]) {
    sessionUI[sessionId] = { selectedProductId: db.products[0].id };
  }
  return sessionUI[sessionId];
}

// ---------- Global scale connection - ONE for the whole app, not per session.
// The scale itself only supports one active connection at a time, so the app
// mirrors that: connect once, and it applies no matter which session is open.
const scale = {
  connected: false, port: null, reader: null,
  lastReadingAt: null, currentReading: null, baud: 9600,
  autoReconnectAttempted: false,
};

// ---------- Router ----------
function route() {
  runAutoRollup();
  const hash = location.hash.slice(1) || '/';
  if (hash.startsWith('/session/')) renderSession(hash.split('/')[2]);
  else renderHome();
}
window.addEventListener('hashchange', route);

// Keep "time ago" and connection chips fresh without user interaction
setInterval(() => {
  const hash = location.hash.slice(1) || '/';
  if (hash === '/' || hash === '') { if (document.getElementById('pendingGrid')) updateHomeLists(); }
  else if (hash.startsWith('/session/')) {
    const id = hash.split('/')[2];
    const s = db.sessions.find(x => x.id === id);
    if (s) renderSession(id);
  }
}, 15000);

// ---------- Shared device bar (identical on every screen - Home, Pending, Ended) ----------
function deviceBarHTML() {
  const serialSupported = 'serial' in navigator;
  if (!serialSupported) {
    return `<div class="device-bar"><span class="chip off"><span class="dot"></span>Scale connection unavailable in this browser</span></div>`;
  }
  return `
    <div class="device-bar">
      ${connectionChip(scale)}
      <button class="btn ${scale.connected ? 'secondary' : 'primary'}" id="scaleToggleBtn">${scale.connected ? 'Disconnect scale' : 'Connect scale'}</button>
    </div>
  `;
}
function bindDeviceBar() {
  const btn = document.getElementById('scaleToggleBtn');
  if (btn) btn.addEventListener('click', () => { scale.connected ? disconnectScale() : connectScale(); });
}

// ---------- Home ----------
function renderHome() {
  const app = document.getElementById('app');
  const today = new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  const totalOpen = db.sessions.filter(s => s.status === 'pending').length;

  app.innerHTML = `
    <header class="top">
      <div class="bar-inner">
        <h1>
          <span class="logo-mark">${ICON_SCALE}</span>
          <span class="title-group">
            <span><span class="brand-yellow">Scale</span>house</span>
            <span class="subtitle">${today}</span>
          </span>
        </h1>
        <div class="header-actions">
          <button class="create" id="createBtn">${ICON_PLUS}New session</button>
        </div>
      </div>
    </header>

    ${deviceBarHTML()}

    <div class="toolbar">
      <div class="search-box">
        ${ICON_SEARCH}
        <input type="text" id="searchInput" placeholder="Search sessions by store..." value="${homeSearch.replace(/"/g, '&quot;')}" />
      </div>
      <div class="store-filter">
        <select id="storeFilterSelect">
          <option value="all" ${homeStoreFilter === 'all' ? 'selected' : ''}>All stores</option>
          ${STORE_NAMES.map(name => `<option value="${name}" ${homeStoreFilter === name ? 'selected' : ''}>${name}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="filter-bar">
      <span>${totalOpen} session${totalOpen === 1 ? '' : 's'} currently open</span>
      <span class="count-pill" id="resultCount"></span>
    </div>

    <main>
      <div class="section-title">Pending <span class="count" id="pendingCount">0</span></div>
      <div class="list-grid" id="pendingGrid"></div>

      <div class="section-title">Ended <span class="count" id="endedCount">0</span></div>
      <div class="list-grid" id="endedGrid"></div>
    </main>
  `;

  document.getElementById('createBtn').addEventListener('click', showCreateModal);
  document.getElementById('searchInput').addEventListener('input', (e) => { homeSearch = e.target.value; updateHomeLists(); });
  document.getElementById('storeFilterSelect').addEventListener('change', (e) => { homeStoreFilter = e.target.value; updateHomeLists(); });
  bindDeviceBar();

  updateHomeLists();
}

function matchesHomeFilters(s) {
  if (homeStoreFilter !== 'all' && s.storeName !== homeStoreFilter) return false;
  if (homeSearch.trim() && !s.storeName.toLowerCase().includes(homeSearch.trim().toLowerCase())) return false;
  return true;
}

function updateHomeLists() {
  const pending = db.sessions.filter(s => s.status === 'pending' && matchesHomeFilters(s)).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const ended = db.sessions.filter(s => s.status === 'ended' && matchesHomeFilters(s)).sort((a, b) => (b.endedAt || '').localeCompare(a.endedAt || ''));

  document.getElementById('pendingCount').textContent = pending.length;
  document.getElementById('endedCount').textContent = ended.length;
  document.getElementById('resultCount').textContent = (pending.length + ended.length) + ' shown';

  document.getElementById('pendingGrid').innerHTML = pending.length
    ? pending.map(renderPendingCard).join('')
    : `<div class="empty">${(homeSearch || homeStoreFilter !== 'all') ? 'No pending sessions match this filter.' : 'No pending sessions — tap New session to start one.'}</div>`;

  document.getElementById('endedGrid').innerHTML = ended.length
    ? ended.map(renderEndedCard).join('')
    : `<div class="empty">${(homeSearch || homeStoreFilter !== 'all') ? 'No ended sessions match this filter.' : 'Nothing ended yet.'}</div>`;

  document.querySelectorAll('[data-open]').forEach(el => {
    el.addEventListener('click', () => { location.hash = '#/session/' + el.dataset.open; });
  });
}

function renderPendingCard(s) {
  const t = sessionTotals(s.id);
  return `
    <div class="card" data-open="${s.id}">
      <div class="row">
        <div class="store">${s.storeName}</div>
        <div class="total">${t.total} kg</div>
      </div>
      <div class="row" style="margin-top:8px">
        <div class="meta">${t.count} entr${t.count === 1 ? 'y' : 'ies'} · started ${timeAgo(s.startedAt)}</div>
      </div>
    </div>
  `;
}

function renderEndedCard(s) {
  const sums = db.summaries.filter(x => x.sessionId === s.id);
  const total = Math.round(sums.reduce((a, x) => a + x.totalWeightKg, 0) * 1000) / 1000;
  return `
    <div class="card" data-open="${s.id}">
      <div class="row">
        <div class="store">${s.storeName}</div>
        <div class="total">${total} kg</div>
      </div>
      <div class="meta" style="margin-top:6px">${sums.length} product${sums.length === 1 ? '' : 's'} · ${new Date(s.startedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} – ${new Date(s.endedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} · ${s.endedReason === 'auto_eod' ? 'auto (end of day)' : 'manually closed'}</div>
    </div>
  `;
}

function showCreateModal() {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `
    <div class="modal">
      <h3>New session</h3>
      <div class="field">
        <label>Store</label>
        <select id="storeSelect">
          ${STORE_NAMES.map(name => `<option>${name}</option>`).join('')}
        </select>
      </div>
      <div class="btn-row">
        <button class="btn primary" id="confirmCreate">Start session</button>
        <button class="btn secondary" id="cancelCreate">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(back);
  back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });
  document.getElementById('cancelCreate').addEventListener('click', () => back.remove());
  document.getElementById('confirmCreate').addEventListener('click', () => {
    const storeName = document.getElementById('storeSelect').value;
    const id = uid();
    db.sessions.push({ id, storeName, status: 'pending', startedAt: new Date().toISOString(), endedAt: null, endedReason: null });
    saveDB();
    back.remove();
    location.hash = '#/session/' + id;
  });
}

// ---------- Session detail ----------
function renderSession(id) {
  const s = db.sessions.find(x => x.id === id);
  const app = document.getElementById('app');
  if (!s) { app.innerHTML = '<div class="empty">Session not found.</div>'; return; }
  if (s.status === 'ended') renderEndedSession(s);
  else renderPendingSession(s);
}

function renderEndedSession(s) {
  const app = document.getElementById('app');
  const sums = db.summaries.filter(x => x.sessionId === s.id)
    .sort((a, b) => productName(a.productId).localeCompare(productName(b.productId)));
  const total = Math.round(sums.reduce((a, x) => a + x.totalWeightKg, 0) * 1000) / 1000;

  const durationMs = new Date(s.endedAt) - new Date(s.startedAt);
  const durationMin = Math.round(durationMs / 60000);
  const durationLabel = durationMin < 60 ? durationMin + ' min' : Math.floor(durationMin / 60) + 'h ' + (durationMin % 60) + 'm';

  app.innerHTML = `
    <header class="top">
      <div class="bar-inner">
        <button class="back" id="backBtn">← Back</button>
        <h1>${s.storeName}</h1>
        <span class="spacer"></span>
      </div>
    </header>
    ${deviceBarHTML()}
    <main><div class="narrow">
      <div class="panel">
        <div class="row" style="display:flex;justify-content:space-between;align-items:center">
          <span class="chip off"><span class="dot"></span>ended</span>
          <span class="chip ${s.endedReason === 'auto_eod' ? 'warn' : 'ok'}"><span class="dot"></span>${s.endedReason === 'auto_eod' ? 'auto · end of day' : 'manually closed'}</span>
        </div>
        <div class="stat-grid">
          <div class="stat">
            <div class="label">Started</div>
            <div class="value">${new Date(s.startedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
            <div class="sub">${new Date(s.startedAt).toLocaleDateString([], {day:'numeric', month:'short'})}</div>
          </div>
          <div class="stat">
            <div class="label">Ended</div>
            <div class="value">${new Date(s.endedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
            <div class="sub">duration ${durationLabel}</div>
          </div>
        </div>
      </div>
      <div class="panel">
        <h3>Product totals</h3>
        ${sums.map(x => `
          <div class="summary-row">
            <span class="n">${productName(x.productId)}</span>
            <span class="v">${x.totalWeightKg} kg</span>
          </div>
        `).join('') || '<div class="empty">No entries were recorded.</div>'}
        <div class="summary-total"><span>Total</span><span>${total} kg</span></div>
      </div>
    </div></main>
  `;
  document.getElementById('backBtn').addEventListener('click', () => { location.hash = '#/'; });
  bindDeviceBar();
}

function renderPendingSession(s) {
  const ui = getSessionUI(s.id);
  const app = document.getElementById('app');
  const entries = db.entries.filter(e => e.sessionId === s.id && !e.deletedAt).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const grouped = {};
  entries.forEach(e => { (grouped[e.productId] = grouped[e.productId] || []).push(e); });

  app.innerHTML = `
    <header class="top">
      <div class="bar-inner">
        <button class="back" id="backBtn">← Back</button>
        <h1>${s.storeName}</h1>
        <span class="spacer"></span>
      </div>
    </header>
    ${deviceBarHTML()}
    <main><div class="narrow">
      <div class="panel">
        <h3>Add entry</h3>
        <div class="field">
          <label>Product</label>
          <select id="productSelect">
            ${db.products.map(p => `<option value="${p.id}" ${p.id === ui.selectedProductId ? 'selected' : ''}>${p.name}</option>`).join('')}
          </select>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Weight (kg)${scale.connected ? ' <span class="live-tag">' + ICON_BLUETOOTH + 'live from scale</span>' : ''}</label>
            <input type="number" id="manualWeight" step="0.001" min="0" placeholder="0.000" value="${scale.connected && scale.currentReading ? scale.currentReading : ''}" />
          </div>
          <button class="btn primary" id="addManualBtn">Add</button>
        </div>
        ${scale.connected && !scale.currentReading ? '<div class="meta" style="margin-top:8px">Waiting for the scale to send a reading...</div>' : ''}
      </div>

      <div class="section-title" id="entriesAnchor">Entries</div>
      ${Object.keys(grouped).length ? Object.keys(grouped).map(pid => renderProductGroup(pid, grouped[pid])).join('') : '<div class="empty">No entries yet.</div>'}

      <div class="btn-row" style="margin-top:20px">
        <button class="btn danger" id="endBtn">End session</button>
      </div>
    </div></main>
  `;

  document.getElementById('backBtn').addEventListener('click', () => { location.hash = '#/'; });
  document.getElementById('productSelect').addEventListener('change', (e) => { ui.selectedProductId = e.target.value; });
  bindDeviceBar();

  document.getElementById('addManualBtn').addEventListener('click', () => {
    const input = document.getElementById('manualWeight');
    const val = parseFloat(input.value);
    if (!val || val <= 0) { input.focus(); return; }
    const name = productName(ui.selectedProductId);
    const source = (scale.connected && scale.currentReading && parseFloat(scale.currentReading) === val) ? 'bluetooth' : 'manual';
    addEntry(s.id, ui.selectedProductId, val, source);
    scale.currentReading = null;
    renderSession(s.id);
    showToast(`Added ${val} kg · ${name}`);
    document.getElementById('entriesAnchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.getElementById('endBtn').addEventListener('click', () => {
    if (!confirm('End this session? This can\'t be undone.')) return;
    // The scale connection is app-wide, not tied to this one session - ending
    // this session should NOT drop it, since staff may move straight to the
    // next pending session with the scale still connected.
    endSession(s.id, 'manual');
    saveDB();
    location.hash = '#/';
  });

  app.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => softDeleteEntry(btn.dataset.del, () => renderSession(s.id)));
  });
}

function renderProductGroup(productId, rows) {
  const total = Math.round(rows.reduce((a, e) => a + e.weightKg, 0) * 1000) / 1000;
  return `
    <div class="product-group">
      <div class="phead"><span>${productName(productId)}</span><span class="sub">${total} kg</span></div>
      ${rows.map(e => `
        <div class="entry-row">
          <span>
            <span class="w">${e.weightKg} kg</span>
            <span class="t">${e.source === 'bluetooth' ? '<span class="src-icon">' + ICON_BLUETOOTH + '</span>' : '✎'} ${new Date(e.recordedAt).toLocaleTimeString()}</span>
          </span>
          <button class="del" data-del="${e.id}">Delete</button>
        </div>
      `).join('')}
    </div>
  `;
}

function addEntry(sessionId, productId, weightKg, source) {
  db.entries.push({
    id: uid(), sessionId, productId, weightKg,
    source, recordedAt: new Date().toISOString(), deletedAt: null,
  });
  saveDB();
}

function softDeleteEntry(entryId, onDone) {
  const entry = db.entries.find(e => e.id === entryId);
  if (!entry) return;
  entry.deletedAt = new Date().toISOString();
  saveDB();
  onDone();
  showUndoToast('Entry deleted', () => {
    entry.deletedAt = null;
    saveDB();
    onDone();
  });
}

function showToast(message) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>&#10003; ${message}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 2200);
}

function showUndoToast(message, onUndo) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${message}</span><button>Undo</button>`;
  toast.querySelector('button').addEventListener('click', () => { onUndo(); toast.remove(); });
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 5000);
}

// ---------- Web Serial bridge - ONE global connection for the whole app ----------

// After a refresh, the page loses the live connection (unavoidable - it only
// exists in memory) but Chrome still remembers the permission grant, so we can
// silently reopen the same port without showing the device picker again.
async function tryAutoReconnect() {
  scale.autoReconnectAttempted = true;
  if (!('serial' in navigator)) return;
  try {
    const ports = await navigator.serial.getPorts();
    if (ports.length === 0) return;
    const port = ports[0];
    await port.open({ baudRate: scale.baud || 9600 });
    scale.port = port;
    scale.connected = true;
    route();
    readLoop(port);
  } catch (e) {
    // Port may already be in use or unavailable - fall back to the manual Connect button.
  }
}

async function connectScale() {
  if (!('serial' in navigator)) return;
  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: scale.baud || 9600 });
    scale.port = port;
    scale.connected = true;
    route();
    readLoop(port);
  } catch (err) {
    alert('Connection failed: ' + err.message);
  }
}

async function readLoop(port) {
  const textDecoder = new TextDecoderStream();
  const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
  const reader = textDecoder.readable.getReader();
  scale.reader = reader;
  let buffer = '';
  try {
    while (scale.connected) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        buffer += value;
        const parts = buffer.split(/\r\n?|\n/);
        buffer = parts.pop();
        for (const part of parts) {
          const match = part.trim().match(/-?\d+(\.\d+)?/);
          if (match) {
            const weight = parseFloat(match[0]);
            // Negative/zero readings are load-cell noise (tare drift, settling
            // while something is placed or lifted) - never a real product
            // weight, so they're dropped here rather than shown and confirmed.
            if (weight > 0) {
              // Show the live reading in the weight field rather than auto-adding it -
              // staff confirm with the Add button, same as a manual entry, so nothing
              // lands in the list without the person seeing it first.
              // The scale sends zero-padded text (e.g. "000.507") - strip that to a
              // clean number before displaying it.
              scale.currentReading = weight.toFixed(3);
              scale.lastReadingAt = new Date().toISOString();
              route();
            }
          }
        }
      }
    }
  } catch (e) {
    scale.connected = false;
    route();
  } finally {
    try { reader.releaseLock(); } catch (e) {}
    await readableStreamClosed.catch(() => {});
  }
}

async function disconnectScale() {
  scale.connected = false;
  scale.currentReading = null;
  if (scale.reader) { try { await scale.reader.cancel(); } catch (e) {} }
  if (scale.port) { try { await scale.port.close(); } catch (e) {} }
  scale.port = null;
  route();
}

route();

// Try to silently restore the scale connection once, regardless of which
// page loads first - the connection is app-wide now, not tied to a session.
if (!scale.autoReconnectAttempted) tryAutoReconnect();

// Close the Bluetooth connection cleanly before the page unloads (refresh,
// navigating away, closing the tab), instead of leaving it to be cut off
// abruptly when the page's memory is torn down.
window.addEventListener('beforeunload', () => {
  if (scale.reader) { try { scale.reader.cancel(); } catch (e) {} }
  if (scale.port) { try { scale.port.close(); } catch (e) {} }
});
