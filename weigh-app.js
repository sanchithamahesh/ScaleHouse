// ---------- Data layer (localStorage-backed) ----------
const DB_KEY = 'scalehouse_db_v2';

function seedProducts() {
  return [
    { id: 'p1', name: 'Basmati Rice', sku: 'RICE-BAS' },
    { id: 'p2', name: 'Toor Dal', sku: 'DAL-TOOR' },
    { id: 'p3', name: 'Sugar', sku: 'SUGAR-01' },
    { id: 'p4', name: 'Wheat Flour', sku: 'FLOUR-WH' },
    { id: 'p5', name: 'Onions', sku: 'VEG-ONI' },
    { id: 'p6', name: 'Potatoes', sku: 'VEG-POT' },
    { id: 'p7', name: 'Tomatoes', sku: 'VEG-TOM' },
    { id: 'p8', name: 'Bananas', sku: 'FRT-BAN' },
    { id: 'p9', name: 'Apples', sku: 'FRT-APP' },
    { id: 'p10', name: 'Milk (1L)', sku: 'DAIRY-MLK' },
  ];
}

function loadDB() {
  const raw = localStorage.getItem(DB_KEY);
  let db;
  if (raw) {
    try { db = JSON.parse(raw); } catch (e) { db = null; }
  }
  if (!db) db = { sessions: [], entries: [], summaries: [], products: seedProducts(), currentUser: null };
  if (!db.currentUser) db.currentUser = null;
  if (db.currentUser && db.currentUser.role === 'admin' && !db.currentUser.viewStore) db.currentUser.viewStore = 'all';
  // Migrate any older status values - "pending" predates the in_progress
  // rename, and "review" predates review becoming a UI-only step instead of
  // a persisted status (STAGE_LABEL has no entry for it, so leftover
  // sessions with this status rendered an "undefined" chip).
  db.sessions.forEach(s => {
    if (s.status === 'pending' || s.status === 'review') s.status = 'in_progress';
    if (!s.createdBy) s.createdBy = 'Unknown';
  });
  return db;
}

let db = loadDB();
function saveDB() { localStorage.setItem(DB_KEY, JSON.stringify(db)); }

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function productName(id) { const p = db.products.find(p => p.id === id); return p ? p.name : 'Unknown product'; }

// ---------- Icons ----------
const ICON_BLUETOOTH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"/></svg>';
const ICON_SCALE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="10.5" width="18" height="8.5" rx="2"/><rect x="7.5" y="4.5" width="9" height="6" rx="1.3"/><line x1="9.8" y1="7.5" x2="14.2" y2="7.5"/></svg>';
const ICON_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
const ICON_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>';
const ICON_MENU = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>';
const ICON_PROFILE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>';
const ICON_CLEAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
const ICON_CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
const ICON_LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>';
const ICON_STORE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10 L4 20 L20 20 L20 10"/><path d="M3 10 L5 4 L19 4 L21 10 Z"/><line x1="9" y1="20" x2="9" y2="14"/><line x1="15" y1="20" x2="15" y2="14"/></svg>';

// Filter field with the label sitting above a plain bordered box, matching
// Market Pulse's filter bar exactly. isSelect adds the custom chevron
// (native <select> arrows are hidden via appearance:none in CSS).
function filterFieldHTML(labelText, basisPx, innerHtml, isSelect) {
  const box = isSelect ? `<div class="filter-select-wrap">${innerHtml}${ICON_CHEVRON}</div>` : innerHtml;
  return `<div class="filter-field" style="flex:1 1 ${basisPx}px"><label>${labelText}</label>${box}</div>`;
}
function filterResetHTML(active) {
  if (!active) return '';
  return `<button class="filter-reset" id="filterResetBtn">${ICON_CLEAR}Reset</button>`;
}
function creatorOptions() {
  return Array.from(new Set(db.sessions.map(s => s.createdBy))).sort();
}

const STORE_NAMES = ['Store 12 — MG Road', 'Store 4 — Whitefield', 'Store 27 — Indiranagar'];

// ---------- Status stage helpers ----------
// Only two real, persisted statuses. "Review" is not a status - it's a step
// inside in_progress (see the entry/review/done stepper), so it never shows
// up as something a session can be filtered or searched by.
const STAGE_LABEL = { in_progress: 'In progress', ended: 'Submitted' };
function stageChip(status) {
  const cls = status === 'in_progress' ? 'ok' : 'off';
  return `<span class="chip ${cls}"><span class="dot"></span>${STAGE_LABEL[status]}</span>`;
}

// ---------- Entry / Review / Done stepper ----------
const STEP_LABELS = ['Entry', 'Review', 'Done'];
function stepperHTML(currentIndex) {
  return `
    <div class="stepper">
      ${STEP_LABELS.map((label, i) => `
        <div class="stepper-item ${i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'pending'}">
          <span class="stepper-dot">${i < currentIndex ? '✓' : i + 1}</span>
          <span class="stepper-label">${label}</span>
        </div>
        ${i < STEP_LABELS.length - 1 ? `<span class="stepper-line ${i < currentIndex ? 'done' : ''}"></span>` : ''}
      `).join('')}
    </div>
  `;
}

function connectionChip(conn) {
  if (conn && conn.connected) {
    return `<span class="chip ok">${ICON_BLUETOOTH}connected${conn.lastReadingAt ? ' · ' + timeAgo(conn.lastReadingAt) : ' · waiting for reading'}</span>`;
  }
  return `<span class="chip off"><span class="dot"></span>not connected</span>`;
}

// Fixed date/month/year order everywhere, instead of the locale-default
// month/day ordering toLocaleString() gives in en-US.
function formatDate(iso) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}
function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}
function formatDateTime(iso) {
  return `${formatDate(iso)}, ${formatTime(iso)}`;
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
  const productCount = new Set(entries.map(e => e.productId)).size;
  return { count: entries.length, productCount, total: Math.round(total * 1000) / 1000 };
}

// ---------- End-of-day rollup ----------
function todayKey(d = new Date()) { return d.toISOString().slice(0, 10); }

function endSession(sessionId) {
  const session = db.sessions.find(s => s.id === sessionId);
  if (!session || session.status === 'ended') return;
  session.status = 'ended';
  session.endedAt = new Date().toISOString();

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


// ---------- Per-session UI state (product search selection - NOT the connection) ----------
const sessionUI = {};
function getSessionUI(sessionId) {
  if (!sessionUI[sessionId]) {
    sessionUI[sessionId] = { selectedProductId: null, productQuery: '', step: 'entry' };
  }
  return sessionUI[sessionId];
}

// ---------- Global scale connection - one for the whole app ----------
const scale = {
  connected: false, connecting: false, port: null, reader: null,
  lastReadingAt: null, currentReading: null, baud: 9600,
  autoReconnectAttempted: false,
  stableValue: null, stableCount: 0,
  // Only true right after the scale has read zero (the display was
  // cleared) - a capture is only allowed once, then this locks until the
  // next clear. Starts false: even the very first weighing needs a
  // deliberate clear first, not just "place the item and it settles."
  readyToCapture: false,
};

// ---------- Router ----------
function route() {
  if (!db.currentUser) { renderLogin(); return; }
  const hash = location.hash.slice(1) || '/';
  if (hash.startsWith('/session/')) renderSession(hash.split('/')[2]);
  else renderHome();
}
window.addEventListener('hashchange', route);

setInterval(() => {
  if (!db.currentUser) return;
  const hash = location.hash.slice(1) || '/';
  if (hash === '/' || hash === '') { if (document.getElementById('sessionGrid')) updateHomeLists(); }
  else if (hash.startsWith('/session/')) {
    const id = hash.split('/')[2];
    const s = db.sessions.find(x => x.id === id);
    if (s) renderSession(id);
  }
}, 15000);

// ---------- Login ----------
function renderLogin() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="login-shell">
      <div class="login-card">
        <div class="login-logo"><span class="logo-mark">${ICON_SCALE}</span><span><span class="brand-yellow">Weigh</span>Bridge</span></div>
        <h3>Sign in</h3>
        <div class="field">
          <label>Role</label>
          <select id="loginRole">
            <option value="admin">Admin</option>
            <option value="gu">General User (GU)</option>
          </select>
        </div>
        <div class="field">
          <label>Name</label>
          <input type="text" id="loginName" placeholder="Your name" />
        </div>
        <div class="field" id="loginStoreField">
          <label>Store</label>
          <select id="loginStore">
            ${STORE_NAMES.map(n => `<option>${n}</option>`).join('')}
          </select>
        </div>
        <button class="btn primary block" id="loginBtn">Sign in</button>
      </div>
    </div>
  `;
  const roleSelect = document.getElementById('loginRole');
  const storeField = document.getElementById('loginStoreField');
  const syncStoreVisibility = () => { storeField.style.display = roleSelect.value === 'gu' ? '' : 'none'; };
  syncStoreVisibility();
  roleSelect.addEventListener('change', syncStoreVisibility);

  document.getElementById('loginBtn').addEventListener('click', () => {
    const name = document.getElementById('loginName').value.trim();
    if (!name) { document.getElementById('loginName').focus(); return; }
    const role = roleSelect.value;
    db.currentUser = { name, role, store: role === 'gu' ? document.getElementById('loginStore').value : null, viewStore: 'all' };
    saveDB();
    location.hash = '#/';
    route();
  });
}

function logout() {
  db.currentUser = null;
  saveDB();
  location.hash = '#/';
  route();
}

// ---------- Shared header pieces: hamburger menu + device bar ----------
function isAdmin() { return db.currentUser && db.currentUser.role === 'admin'; }

// Simple identity + logout, matching Market Pulse's profile pattern exactly -
// no navigation links bundled in here.
function profileMenuHTML() {
  const u = db.currentUser;
  return `
    <div class="menu-panel" id="menuPanel" style="display:none">
      <div class="menu-hi">Hi, ${u.name}</div>
      <button class="menu-item menu-logout" id="menuLogout">Log out</button>
    </div>
  `;
}
function bindProfileMenu() {
  const btn = document.getElementById('profileBtn');
  const panel = document.getElementById('menuPanel');
  if (!btn || !panel) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });
  document.addEventListener('click', (e) => {
    if (panel.style.display !== 'none' && !panel.contains(e.target) && e.target !== btn) panel.style.display = 'none';
  }, { once: true });
  const logoutBtn = document.getElementById('menuLogout');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
}

// Store chip in the header, mimicking Product Lens's Layout.tsx pattern:
// a lock icon on a non-interactive chip for a single-store (GU) user, or a
// store icon on a clickable chip that opens a picker for everyone else.
function storeChipHTML() {
  const u = db.currentUser;
  if (u.role !== 'admin') {
    return `<span class="store-chip locked">${ICON_LOCK}<span>${u.store}</span></span>`;
  }
  const label = u.viewStore && u.viewStore !== 'all' ? u.viewStore : 'All stores';
  return `<button class="store-chip" id="storeChipBtn">${ICON_STORE}<span>${label}</span></button>`;
}
function bindStoreChip() {
  const btn = document.getElementById('storeChipBtn');
  if (btn) btn.addEventListener('click', showStoreModal);
}

// Mimics Product Lens's StoreModal: a search box over a plain list of
// stores. Scalehouse only has a handful of stores (no zones), so this is
// the same interaction pattern without the zone-filtering step.
function showStoreModal() {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `
    <div class="modal">
      <h3>Select a store</h3>
      <div class="field product-combo">
        <input type="text" id="storeSearch" autocomplete="off" placeholder="Search stores..." />
      </div>
      <div id="storeModalList" class="store-modal-list"></div>
    </div>
  `;
  document.body.appendChild(back);
  back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });

  const options = ['All stores', ...STORE_NAMES];
  const listEl = back.querySelector('#storeModalList');

  function renderList(query) {
    const q = query.trim().toLowerCase();
    const matches = options.filter(name => name.toLowerCase().includes(q));
    listEl.innerHTML = matches.length
      ? matches.map(name => `<div class="store-modal-row" data-name="${name}">${name}</div>`).join('')
      : '<div class="empty">No matching stores</div>';
    listEl.querySelectorAll('[data-name]').forEach(row => {
      row.addEventListener('click', () => {
        db.currentUser.viewStore = row.dataset.name === 'All stores' ? 'all' : row.dataset.name;
        saveDB();
        back.remove();
        route();
      });
    });
  }
  renderList('');
  // Same 500ms debounce as the product search on the entry page (matches
  // Product Lens's actual search pattern), rather than filtering on every keystroke.
  let debounceTimer = null;
  const searchInput = back.querySelector('#storeSearch');
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => renderList(searchInput.value), 500);
  });
}

function deviceBarHTML() {
  const serialSupported = 'serial' in navigator;
  if (!serialSupported) {
    return `<div class="device-bar"><span class="chip off"><span class="dot"></span>Scale connection unavailable in this browser</span></div>`;
  }
  return `
    <div class="device-bar">
      <span id="deviceBarChip" style="display:contents">${connectionChip(scale)}</span>
      <button class="btn ${scale.connected ? 'secondary' : 'primary'}" id="scaleToggleBtn">${scale.connected ? 'Disconnect scale' : 'Connect scale'}</button>
    </div>
  `;
}
function bindDeviceBar() {
  const btn = document.getElementById('scaleToggleBtn');
  if (btn) btn.addEventListener('click', () => { scale.connected ? disconnectScale() : connectScale(); });
}

// Compact status icon used on session pages instead of the full device bar -
// mimics the "Scan" button's slot next to "Back to Home". It only offers a
// way to connect; once connected there is deliberately no disconnect action
// here, and while connecting it's disabled so it can't be double-clicked.
function scaleStatusIconHTML() {
  if (!('serial' in navigator)) {
    return `<span id="btStatusHost" class="bt-status-btn unavailable" title="Scale connection unavailable in this browser">${ICON_BLUETOOTH}<span>Unavailable</span></span>`;
  }
  const cls = scale.connected ? 'connected' : scale.connecting ? 'connecting' : 'disconnected';
  const label = scale.connected ? 'Connected' : scale.connecting ? 'Connecting…' : 'Connect';
  const title = scale.connected ? 'Scale connected' : scale.connecting ? 'Connecting to scale…' : 'Connect scale';
  const disabled = scale.connected || scale.connecting;
  return `<button type="button" id="btStatusHost" class="bt-status-btn ${cls}" ${disabled ? 'disabled' : ''} title="${title}">${ICON_BLUETOOTH}<span>${label}</span></button>`;
}
function bindScaleStatusIcon() {
  const btn = document.getElementById('btStatusHost');
  if (btn && btn.tagName === 'BUTTON') btn.addEventListener('click', () => { if (!scale.connected && !scale.connecting) connectScale(); });
}

function updateLiveWeightDisplay() {
  const chipHost = document.getElementById('deviceBarChip');
  if (chipHost) chipHost.innerHTML = connectionChip(scale);
  const input = document.getElementById('manualWeight');
  if (input && document.activeElement !== input) {
    input.value = scale.currentReading || '';
  }
  const waiting = document.getElementById('waitingForReading');
  if (waiting) waiting.style.display = (scale.connected && !scale.currentReading) ? '' : 'none';
}

// ---------- Home ----------
// The top bar never changes shape across pages, mimicking Product Lens's
// header: same brand mark, store chip, and profile icon everywhere. Pages
// that need a way back put a plain "Back to Home" link in their own content
// instead of swapping out the header (session detail used to do this).
function topHeaderHTML() {
  return `
    <header class="top">
      <div class="bar-inner">
        <h1>
          <span class="logo-mark">${ICON_SCALE}</span>
          <span><span class="brand-yellow">Weigh</span>Bridge</span>
        </h1>
        <div class="header-actions">
          ${storeChipHTML()}
          <button class="icon-btn round" id="profileBtn">${ICON_PROFILE}</button>
        </div>
      </div>
      ${profileMenuHTML()}
    </header>
  `;
}
function bindTopHeader() {
  bindProfileMenu();
  bindStoreChip();
}

// Fixed "today" stat, independent of whatever Status/Date filter is active.
function sessionsCreatedTodayCount() {
  const today = todayKey();
  const admin = isAdmin();
  return db.sessions.filter(s => {
    if (!admin && s.storeName !== db.currentUser.store) return false;
    if (admin && db.currentUser.viewStore !== 'all' && s.storeName !== db.currentUser.viewStore) return false;
    return todayKey(new Date(s.startedAt)) === today;
  }).length;
}

function renderHome() {
  const app = document.getElementById('app');
  const totalOpen = db.sessions.filter(s => s.status !== 'ended').length;

  const admin = isAdmin();

  app.innerHTML = `
    ${topHeaderHTML()}

    ${deviceBarHTML()}

    <div class="section-title-row">
      <div style="display:flex; align-items:center; gap:10px;">
        <h2 class="page-title">Dump Wastages</h2>
        <span class="chip ok">${sessionsCreatedTodayCount()} today</span>
      </div>
      <button class="btn yellow" id="createBtn" ${admin && db.currentUser.viewStore === 'all' ? 'disabled title="Select a store above first"' : ''}>${ICON_PLUS}Create</button>
    </div>

    <div class="toolbar filter-row">
      <div class="filter-group">
        ${filterFieldHTML('Status', 180, `
          <select id="fStatus">
            <option value="" ${homeFilters.status === '' ? 'selected' : ''}>All statuses</option>
            <option value="in_progress" ${homeFilters.status === 'in_progress' ? 'selected' : ''}>In progress</option>
            <option value="ended" ${homeFilters.status === 'ended' ? 'selected' : ''}>Submitted</option>
          </select>
        `, true)}
        ${admin ? filterFieldHTML('Created By', 190, `
          <select id="fCreatedBy">
            <option value="" ${homeFilters.createdBy === '' ? 'selected' : ''}>All users</option>
            ${creatorOptions().map(name => `<option value="${name}" ${homeFilters.createdBy === name ? 'selected' : ''}>${name}</option>`).join('')}
          </select>
        `, true) : ''}
        ${filterFieldHTML('Date', 160, `
          <select id="fDate">
            <option value="all" ${homeFilters.date === 'all' ? 'selected' : ''}>All time</option>
            <option value="today" ${homeFilters.date === 'today' ? 'selected' : ''}>Today</option>
            <option value="7" ${homeFilters.date === '7' ? 'selected' : ''}>Last 7 days</option>
            <option value="30" ${homeFilters.date === '30' ? 'selected' : ''}>Last 30 days</option>
          </select>
        `, true)}
        ${filterResetHTML(isHomeFiltersActive())}
      </div>
    </div>

    <main>
      <div class="list-grid" id="sessionGrid"></div>
    </main>
  `;

  document.getElementById('createBtn').addEventListener('click', admin ? startSessionForAdmin : startSessionForGu);
  document.getElementById('fStatus').addEventListener('change', (e) => { homeFilters.status = e.target.value; updateHomeLists(); });
  const fCreatedBy = document.getElementById('fCreatedBy');
  if (fCreatedBy) fCreatedBy.addEventListener('change', (e) => { homeFilters.createdBy = e.target.value; updateHomeLists(); });
  document.getElementById('fDate').addEventListener('change', (e) => { homeFilters.date = e.target.value; updateHomeLists(); });
  const resetBtn = document.getElementById('filterResetBtn');
  if (resetBtn) resetBtn.addEventListener('click', () => { homeFilters = { status: 'in_progress', createdBy: '', date: 'all' }; renderHome(); });
  bindDeviceBar();
  bindTopHeader();

  updateHomeLists();
}

// Default status = "In progress", matching the earlier spec, and the whole
// list is now one filtered set instead of two fixed Open/Ended sections.
let homeFilters = { status: 'in_progress', createdBy: '', date: 'all' };

function isHomeFiltersActive() {
  return homeFilters.status !== 'in_progress' || homeFilters.createdBy.trim() !== '' || homeFilters.date !== 'all';
}

function matchesDateFilter(iso, dateFilter) {
  if (dateFilter === 'all') return true;
  const days = dateFilter === 'today' ? 0 : parseInt(dateFilter, 10);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return new Date(iso) >= cutoff;
}

function matchesHomeFilters(s) {
  const admin = isAdmin();
  if (!admin && s.storeName !== db.currentUser.store) return false;
  if (homeFilters.status && s.status !== homeFilters.status) return false;
  if (admin && homeFilters.createdBy && s.createdBy !== homeFilters.createdBy) return false;
  if (admin && db.currentUser.viewStore !== 'all' && s.storeName !== db.currentUser.viewStore) return false;
  if (!matchesDateFilter(s.startedAt, homeFilters.date)) return false;
  return true;
}

function updateHomeLists() {
  const sessions = db.sessions.filter(matchesHomeFilters).sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  document.getElementById('sessionGrid').innerHTML = sessions.length
    ? sessions.map(renderSessionCard).join('')
    : '<div class="empty">No sessions match this filter.</div>';

  document.querySelectorAll('[data-open]').forEach(el => {
    el.addEventListener('click', () => { location.hash = '#/session/' + el.dataset.open; });
  });
}

// GU is always scoped to one store (already shown in the header chip), so
// repeating the store name on every card is pure redundancy - the date
// actually distinguishes cards from each other for them. Admin still needs
// the store name since they see sessions across multiple stores.
function cardHeading(s) {
  if (isAdmin()) return s.storeName;
  return new Date(s.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}
// Omit the creator entirely when it's the viewer's own session - no one
// needs to be told they created their own work.
function creatorMetaPart(s) {
  return s.createdBy === db.currentUser.name ? '' : `${s.createdBy} · `;
}

// This session's position among that store's sessions on the same calendar
// day, in the order they were started - the 1st session of the day at that
// store reads 1, the next reads 2, and so on.
function dailySessionIndex(s) {
  const day = todayKey(new Date(s.startedAt));
  const sameDay = db.sessions
    .filter(x => x.storeName === s.storeName && todayKey(new Date(x.startedAt)) === day)
    .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
  return sameDay.findIndex(x => x.id === s.id) + 1;
}

function renderSessionCard(s) {
  const t = sessionTotals(s.id);
  const heading = cardHeading(s);
  const creatorPart = creatorMetaPart(s);
  const startedTime = new Date(s.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const indexBadge = `<span class="chip off">#${dailySessionIndex(s)}</span>`;
  if (s.status === 'ended') {
    const sums = db.summaries.filter(x => x.sessionId === s.id);
    return `
      <div class="card" data-open="${s.id}">
        <div class="row">
          <div class="store">${heading}</div>
          <div style="display:flex; align-items:center; gap:6px;">
            ${indexBadge}
            ${stageChip(s.status)}
          </div>
        </div>
        <div class="meta" style="margin-top:6px">${sums.length} product${sums.length === 1 ? '' : 's'} · ${creatorPart}started ${startedTime} · ended ${formatDateTime(s.endedAt)}</div>
      </div>
    `;
  }
  return `
    <div class="card" data-open="${s.id}">
      <div class="row">
        <div class="store">${heading}</div>
        <div style="display:flex; align-items:center; gap:6px;">
          ${indexBadge}
          ${stageChip(s.status)}
        </div>
      </div>
      <div class="row" style="margin-top:8px">
        <div class="meta">${t.productCount} product${t.productCount === 1 ? '' : 's'} · ${creatorPart}started ${startedTime} · ${timeAgo(s.startedAt)}</div>
      </div>
    </div>
  `;
}

function createSession(storeName) {
  const id = uid();
  db.sessions.push({
    id, storeName, status: 'in_progress',
    startedAt: new Date().toISOString(), endedAt: null,
    createdBy: db.currentUser.name,
  });
  saveDB();
  location.hash = '#/session/' + id;
}

// GU only ever has one store (their own), so there's nothing to choose -
// skip the modal entirely and start the session directly.
function startSessionForGu() {
  createSession(db.currentUser.store);
}

// Admin now picks their store via the header chip (mimicking Product Lens)
// before Create is even enabled, so the store is already known here - no
// separate picker needed, same direct-create shape as the GU path.
function startSessionForAdmin() {
  if (db.currentUser.viewStore === 'all') return;
  createSession(db.currentUser.viewStore);
}

// ---------- Session detail ----------
// Only two persisted statuses (in_progress / ended). "Review" is a step
// inside in_progress, tracked in the per-session UI state, not the DB.
function renderSession(id) {
  const s = db.sessions.find(x => x.id === id);
  const app = document.getElementById('app');
  if (!s) { app.innerHTML = '<div class="empty">Session not found.</div>'; return; }
  if (s.status === 'ended') { renderDoneStep(s); return; }
  const ui = getSessionUI(id);
  if (ui.step === 'review') renderReviewStep(s);
  else renderInProgressSession(s);
}

// Plain content-level nav, mimicking Product Lens's "Back to Home" link -
// sits in the page body instead of replacing the persistent header.
function backToHomeLinkHTML() {
  return `<a href="#/" class="back-link">← Back to Home</a>`;
}

// Step 2: read-only view of what was entered, reached by clicking "Review"
// from the entry step. Not a stored status - purely a UI step, reversible
// via Back with zero data consequence.
function renderReviewStep(s) {
  const app = document.getElementById('app');
  const entries = db.entries.filter(e => e.sessionId === s.id && !e.deletedAt);
  const groups = groupEntriesDesc(entries);

  app.innerHTML = `
    ${topHeaderHTML()}
    <div class="page-nav-row frozen">
      ${backToHomeLinkHTML()}
      ${scaleStatusIconHTML()}
    </div>
    <main><div class="narrow">
      ${stepperHTML(1)}
      <div class="panel">
        <div class="meta">Started ${formatDateTime(s.startedAt)} · Created by ${s.createdBy}</div>
      </div>
      <div class="panel">
        <h3>Entries</h3>
        ${groups.length ? groups.map(([pid, rows]) => renderProductGroup(pid, rows, true)).join('') : '<div class="empty">No entries were recorded.</div>'}
      </div>
      <div class="btn-row" style="margin-top:16px; justify-content:space-between">
        <button class="btn secondary" id="backToEntryBtn">← Back</button>
        <button class="btn danger" id="finalEndBtn">Submit</button>
      </div>
    </div></main>
  `;
  bindTopHeader();
  bindScaleStatusIcon();

  document.getElementById('backToEntryBtn').addEventListener('click', () => { backToEntry(s.id); });
  document.getElementById('finalEndBtn').addEventListener('click', () => {
    if (!confirm('Submit this session? This locks in the final totals and can\'t be undone.')) return;
    endSession(s.id);
    saveDB();
    renderSession(s.id);
  });
}

// Step 3: Done - final read-only view of a submitted session.
function renderDoneStep(s) {
  const app = document.getElementById('app');
  const sums = db.summaries.filter(x => x.sessionId === s.id);
  const isSelf = s.createdBy === db.currentUser.name;

  app.innerHTML = `
    ${topHeaderHTML()}
    <div class="page-nav-row frozen">
      ${backToHomeLinkHTML()}
      ${scaleStatusIconHTML()}
    </div>
    <main><div class="narrow">
      <div class="panel">
        <div class="row" style="display:flex;justify-content:space-between;align-items:center">
          ${stageChip(s.status)}
          ${isSelf ? '' : `<span class="meta">Created by ${s.createdBy}</span>`}
        </div>
        <div class="stat-grid">
          <div class="stat">
            <div class="label">Started</div>
            <div class="value">${formatDateTime(s.startedAt)}</div>
          </div>
          <div class="stat">
            <div class="label">Completed</div>
            <div class="value">${formatDateTime(s.endedAt)}</div>
          </div>
        </div>
      </div>
      <div class="panel">
        <h3>Product totals</h3>
        ${sums.map(x => `<div class="summary-row"><span class="n">${productName(x.productId)}</span><span class="v">${x.totalWeightKg} kg</span></div>`).join('') || '<div class="empty">No entries were recorded.</div>'}
        <div class="summary-total"><span>Total</span><span>${Math.round(sums.reduce((a, x) => a + x.totalWeightKg, 0) * 1000) / 1000} kg</span></div>
      </div>
    </div></main>
  `;
  bindTopHeader();
  bindScaleStatusIcon();
}

// Un-freezes a session that was sent for review so its entries become
// editable again - the reference flow's "Back" step, not a status filter.
function backToEntry(sessionId) {
  getSessionUI(sessionId).step = 'entry';
  renderSession(sessionId);
}

function renderInProgressSession(s) {
  const ui = getSessionUI(s.id);
  const app = document.getElementById('app');
  const entries = db.entries.filter(e => e.sessionId === s.id && !e.deletedAt);
  const groups = groupEntriesDesc(entries);

  const selectedProduct = ui.selectedProductId ? db.products.find(p => p.id === ui.selectedProductId) : null;
  const hasProduct = !!selectedProduct;

  app.innerHTML = `
    ${topHeaderHTML()}
    <div class="page-nav-row frozen">
      ${backToHomeLinkHTML()}
      ${scaleStatusIconHTML()}
    </div>
    <main><div class="narrow">
      ${stepperHTML(0)}

      <div class="panel">
        <h3>Add entry</h3>
        <div class="field product-combo">
          <label>Product</label>
          <div class="product-search-wrap">
            <input type="text" id="productSearch" autocomplete="off" placeholder="Search by name, sku or barcode..." value="${selectedProduct ? selectedProduct.name.replace(/"/g, '&quot;') : ui.productQuery.replace(/"/g, '&quot;')}" />
            <button type="button" id="productSearchBtn" class="search-trigger" title="Search">${ICON_SEARCH}</button>
          </div>
          <div id="productResults" class="product-results" style="display:none"></div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Weight (kg)${scale.connected ? ' <span class="live-tag">' + ICON_BLUETOOTH + 'live from scale</span>' : ''}</label>
            <input type="number" id="manualWeight" step="0.001" min="0" placeholder="0.000"
              value="${scale.connected && scale.currentReading ? scale.currentReading : ''}"
              ${hasProduct ? '' : 'disabled'} />
          </div>
        </div>
        <div class="meta" style="margin-top:8px">
          ${!hasProduct ? 'Select a product above before you can log a weight.' : (scale.connected
            ? 'Place the item — a settled reading logs automatically.'
            : 'Type the weight and press Enter to log it.')}
        </div>
        <div class="meta" id="waitingForReading" style="margin-top:4px; display:${scale.connected && !scale.currentReading ? '' : 'none'}">Waiting for the scale to send a reading...</div>
      </div>

      <div class="section-title" id="entriesAnchor">Entries</div>
      ${groups.length ? groups.map(([pid, rows]) => renderProductGroup(pid, rows, false)).join('') : '<div class="empty">No entries yet.</div>'}

      <div class="btn-row" style="margin-top:20px; justify-content:flex-end">
        <button class="btn primary" id="reviewBtn">Review →</button>
      </div>
    </div></main>
  `;

  bindTopHeader();
  bindScaleStatusIcon();

  // --- Searchable product combo (debounced, same 500ms pattern as Product Lens) ---
  const searchInput = document.getElementById('productSearch');
  const resultsBox = document.getElementById('productResults');
  let debounceTimer = null;

  function runProductSearch() {
    const rawQuery = searchInput.value.trim();
    const q = rawQuery.toLowerCase();
    ui.productQuery = searchInput.value;
    if (!q) { resultsBox.style.display = 'none'; resultsBox.innerHTML = ''; return; }
    const matches = db.products.filter(p =>
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
    resultsBox.innerHTML = matches.length
      ? matches.map(p => `<div class="product-result-row" data-pid="${p.id}"><span>${p.name}</span><span class="sku">${p.sku}</span></div>`).join('')
      : `<div class="product-result-row empty-row">${ICON_SEARCH}<span>No products found matching "${rawQuery}"</span></div>`;
    resultsBox.style.display = 'block';
  }

  searchInput.addEventListener('input', () => {
    ui.selectedProductId = null; // typing invalidates the previous selection
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runProductSearch, 500);
  });
  searchInput.addEventListener('focus', () => { if (searchInput.value.trim()) runProductSearch(); });
  document.getElementById('productSearchBtn').addEventListener('click', () => {
    clearTimeout(debounceTimer);
    runProductSearch();
  });
  resultsBox.addEventListener('click', (e) => {
    const row = e.target.closest('[data-pid]');
    if (!row) return;
    ui.selectedProductId = row.dataset.pid;
    searchInput.value = productName(ui.selectedProductId);
    resultsBox.style.display = 'none';
    renderSession(s.id);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.product-combo')) resultsBox.style.display = 'none';
  }, { once: true });

  // --- Weight field: Enter-to-log for manual entry (no Add button) ---
  const weightInput = document.getElementById('manualWeight');
  weightInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const val = parseFloat(weightInput.value);
    if (!val || val <= 0 || !ui.selectedProductId) return;
    logEntry(s.id, ui.selectedProductId, val, 'manual');
  });

  document.getElementById('reviewBtn').addEventListener('click', () => {
    ui.step = 'review';
    renderSession(s.id);
  });

  document.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => softDeleteEntry(btn.dataset.del, () => renderSession(s.id)));
  });
}

function logEntry(sessionId, productId, weightKg, source) {
  const name = productName(productId);
  addEntry(sessionId, productId, weightKg, source);
  const ui = getSessionUI(sessionId);
  // Force a fresh product pick before the next weight can be logged, rather
  // than leaving the same product selected (and the weight field enabled)
  // for whatever gets weighed next.
  ui.selectedProductId = null;
  ui.productQuery = '';
  showToast(`Logged ${weightKg} kg · ${name}`);
  // Stays put rather than auto-scrolling to the entries list - with the
  // scale able to log repeatedly (each clear-and-weigh cycle), jumping the
  // page on every single entry would be disorienting, not helpful.
  if (location.hash === '#/session/' + sessionId) {
    renderSession(sessionId);
  }
}

// Groups entries by product, newest activity first: the product whose most
// recent entry is the newest overall sorts to the top (so a fresh entry on
// an older product pulls that whole group back up), and within each group
// the entries themselves are newest-first too.
function groupEntriesDesc(entries) {
  const grouped = {};
  entries.forEach(e => { (grouped[e.productId] = grouped[e.productId] || []).push(e); });
  const productIds = Object.keys(grouped).sort((a, b) => {
    const latestA = Math.max(...grouped[a].map(e => new Date(e.recordedAt).getTime()));
    const latestB = Math.max(...grouped[b].map(e => new Date(e.recordedAt).getTime()));
    return latestB - latestA;
  });
  productIds.forEach(pid => grouped[pid].sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt)));
  return productIds.map(pid => [pid, grouped[pid]]);
}

function renderProductGroup(productId, rows, readOnly) {
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
          ${readOnly ? '' : `<button class="del" data-del="${e.id}">Delete</button>`}
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

// ---------- Web Serial bridge - one global connection for the whole app ----------
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
  if (!('serial' in navigator) || scale.connecting || scale.connected) return;
  scale.connecting = true;
  updateDeviceStatusDisplays();
  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: scale.baud || 9600 });
    scale.port = port;
    scale.connected = true;
    scale.connecting = false;
    route();
    readLoop(port);
  } catch (err) {
    scale.connecting = false;
    updateDeviceStatusDisplays();
    alert('Connection failed: ' + err.message);
  }
}

// Refreshes whichever status widget is currently on screen (Home's full
// device bar, or a session page's compact icon) without a full re-render -
// used while a connection attempt is in flight so the button can show
// "Connecting..." and can't be clicked again mid-attempt.
function updateDeviceStatusDisplays() {
  const chipHost = document.getElementById('deviceBarChip');
  if (chipHost) chipHost.innerHTML = connectionChip(scale);
  const toggleBtn = document.getElementById('scaleToggleBtn');
  if (toggleBtn) {
    toggleBtn.textContent = scale.connecting ? 'Connecting…' : (scale.connected ? 'Disconnect scale' : 'Connect scale');
    toggleBtn.disabled = scale.connecting;
  }
  const btHost = document.getElementById('btStatusHost');
  if (btHost) btHost.outerHTML = scaleStatusIconHTML();
  bindScaleStatusIcon();
}

function currentSessionOnScreen() {
  const hash = location.hash.slice(1) || '/';
  if (!hash.startsWith('/session/')) return null;
  const s = db.sessions.find(x => x.id === hash.split('/')[2]);
  if (!s || s.status !== 'in_progress') return null;
  // Entries only auto-capture while the editable entry step is actually on
  // screen - not while parked on the read-only review step.
  return getSessionUI(s.id).step === 'entry' ? s : null;
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
            scale.lastReadingAt = new Date().toISOString();

            if (weight > 0) {
              const activeSession = currentSessionOnScreen();
              const ui = activeSession ? getSessionUI(activeSession.id) : null;

              // Nothing is "read" from the scale at all until a SKU is
              // picked - no live display, no stability tracking. Selecting
              // a product later always starts from a clean slate, it can
              // never inherit stability that built up before selection.
              if (!ui || !ui.selectedProductId) continue;

              const formatted = weight.toFixed(3);

              // Stability detection: there is no marker in the data telling us
              // when the physical button was pressed (the scale streams the
              // same continuously either way), so a settled, repeated reading
              // is used as the practical substitute for "the item is on the
              // scale and this number is real."
              if (formatted === scale.stableValue) {
                scale.stableCount++;
              } else {
                scale.stableValue = formatted;
                scale.stableCount = 1;
              }

              scale.currentReading = formatted;
              updateLiveWeightDisplay();

              if (scale.stableCount >= 2 && scale.readyToCapture) {
                logEntry(activeSession.id, ui.selectedProductId, weight, 'bluetooth');
                // Locks capturing until the scale reads zero again (the
                // Clear button on the scale) - a continuously-streamed
                // reading of the same item can no longer log a second time.
                scale.readyToCapture = false;
              }
            } else if (weight === 0) {
              // Zero is the scale's Clear button taking effect. This isn't
              // just noise to ignore - it's the signal that arms the next
              // capture, so weight only "flows" into an entry right after a
              // deliberate clear, never from continuous streaming.
              scale.currentReading = null;
              scale.stableValue = null;
              scale.stableCount = 0;
              scale.readyToCapture = true;
              updateLiveWeightDisplay();
            }
            // weight < 0: not read at all - no state change, no display
            // update. (The scale never actually transmits a minus sign, so
            // this is only reachable if that ever changes.)
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
  scale.stableValue = null;
  scale.stableCount = 0;
  scale.readyToCapture = false;
  if (scale.reader) { try { await scale.reader.cancel(); } catch (e) {} }
  if (scale.port) { try { await scale.port.close(); } catch (e) {} }
  scale.port = null;
  route();
}

route();
if (!scale.autoReconnectAttempted) tryAutoReconnect();
window.addEventListener('beforeunload', () => {
  if (scale.reader) { try { scale.reader.cancel(); } catch (e) {} }
  if (scale.port) { try { scale.port.close(); } catch (e) {} }
});
