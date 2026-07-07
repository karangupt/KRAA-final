/* KRAA App — router + views */

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const fmt = n => '₹' + (Number(n) || 0).toLocaleString('en-IN');
const todayStr = () => new Date().toISOString().slice(0,10);

/* ---------- Module configs: drives generic table + form rendering ---------- */
const MODULES = {
  customer: {
    title: 'Customers', collection: 'customers', icon: '◔',
    columns: [
      { label: 'Name', field: 'name', cls: 'name-cell' },
      { label: 'Phone', field: 'phone' },
      { label: 'Email', field: 'email' },
      { label: 'GST No.', field: 'gst' }
    ],
    fields: [
      { name: 'name', label: 'Customer name', type: 'text', required: true },
      { name: 'phone', label: 'Phone', type: 'text' },
      { name: 'email', label: 'Email', type: 'text' },
      { name: 'gst', label: 'GST number', type: 'text' },
      { name: 'notes', label: 'Notes', type: 'text' }
    ]
  },
  booking: {
    title: 'Bookings', collection: 'bookings', icon: '◨',
    columns: [
      { label: 'Item', field: 'item', cls: 'name-cell' },
      { label: 'Start', field: 'startDate' },
      { label: 'End', field: 'endDate' },
      { label: 'Amount', field: 'amount', render: v => fmt(v) },
      { label: 'Status', field: 'status', render: v => tagFor(v) }
    ],
    fields: [
      { name: 'item', label: 'Equipment / item', type: 'text', required: true },
      { name: 'customerId', label: 'Customer', type: 'select', source: 'customers', optLabel: 'name' },
      { name: 'startDate', label: 'Start date', type: 'date' },
      { name: 'endDate', label: 'End date', type: 'date' },
      { name: 'amount', label: 'Amount (₹)', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['pending','confirmed','completed','cancelled'] }
    ]
  },
  inventory: {
    title: 'Equipment Inventory', collection: 'equipment', icon: '◫',
    columns: [
      { label: 'Equipment', field: 'name', cls: 'name-cell' },
      { label: 'Category', field: 'category' },
      { label: 'Total Qty', field: 'qty' },
      { label: 'Available', field: 'available' },
      { label: 'Rate/day', field: 'rate', render: v => fmt(v) }
    ],
    fields: [
      { name: 'name', label: 'Equipment name', type: 'text', required: true },
      { name: 'category', label: 'Category', type: 'text' },
      { name: 'qty', label: 'Total quantity', type: 'number' },
      { name: 'available', label: 'Available now', type: 'number' },
      { name: 'rate', label: 'Rental rate / day (₹)', type: 'number' }
    ]
  },
  expense: {
    title: 'Expenses', collection: 'expenses', icon: '◒',
    columns: [
      { label: 'Date', field: 'date' },
      { label: 'Category', field: 'category' },
      { label: 'Description', field: 'desc', cls: 'name-cell' },
      { label: 'Amount', field: 'amount', render: v => fmt(v) }
    ],
    fields: [
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'category', label: 'Category', type: 'text' },
      { name: 'desc', label: 'Description', type: 'text' },
      { name: 'amount', label: 'Amount (₹)', type: 'number' }
    ]
  },
  invoice: {
    title: 'Quotation & Invoice', collection: 'invoices', icon: '◪',
    columns: [
      { label: 'Number', field: 'number', cls: 'name-cell' },
      { label: 'Date', field: 'date' },
      { label: 'Amount', field: 'amount', render: v => fmt(v) },
      { label: 'Status', field: 'status', render: v => tagFor(v) }
    ],
    fields: [
      { name: 'number', label: 'Invoice number', type: 'text', required: true },
      { name: 'customerId', label: 'Customer', type: 'select', source: 'customers', optLabel: 'name' },
      { name: 'date', label: 'Date', type: 'date' },
      { name: 'amount', label: 'Amount (₹)', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['unpaid','partial','paid'] }
    ]
  },
  payments: {
    title: 'Payments', collection: 'payments', icon: '◓',
    columns: [
      { label: 'Date', field: 'date' },
      { label: 'Invoice', field: 'invoiceId' },
      { label: 'Amount', field: 'amount', render: v => fmt(v) },
      { label: 'Mode', field: 'mode' }
    ],
    fields: [
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'invoiceId', label: 'Invoice', type: 'select', source: 'invoices', optLabel: 'number' },
      { name: 'amount', label: 'Amount (₹)', type: 'number' },
      { name: 'mode', label: 'Mode', type: 'select', options: ['Cash','UPI','Bank Transfer','Cheque'] }
    ]
  },
  staff: {
    title: 'Staff', collection: 'staff', icon: '◕',
    columns: [
      { label: 'Name', field: 'name', cls: 'name-cell' },
      { label: 'Role', field: 'role' },
      { label: 'Phone', field: 'phone' },
      { label: 'Salary', field: 'salary', render: v => fmt(v) }
    ],
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'role', label: 'Role', type: 'text' },
      { name: 'phone', label: 'Phone', type: 'text' },
      { name: 'salary', label: 'Monthly salary (₹)', type: 'number' }
    ]
  },
  bank: {
    title: 'Bank Accounts', collection: 'bankAccounts', icon: '◧',
    columns: [
      { label: 'Bank', field: 'bank', cls: 'name-cell' },
      { label: 'Type', field: 'accType' },
      { label: 'Account No.', field: 'number' },
      { label: 'Balance', field: 'balance', render: v => fmt(v) }
    ],
    fields: [
      { name: 'bank', label: 'Bank name', type: 'text', required: true },
      { name: 'accType', label: 'Account type', type: 'select', options: ['Savings','Current'] },
      { name: 'number', label: 'Account number (masked)', type: 'text' },
      { name: 'balance', label: 'Balance (₹)', type: 'number' }
    ]
  },
  fdrd: {
    title: 'FD / RD', collection: 'fdrd', icon: '◨',
    columns: [
      { label: 'Type', field: 'type' },
      { label: 'Bank', field: 'bank', cls: 'name-cell' },
      { label: 'Principal', field: 'principal', render: v => fmt(v) },
      { label: 'Rate %', field: 'rate' },
      { label: 'Maturity', field: 'maturity' }
    ],
    fields: [
      { name: 'type', label: 'Type', type: 'select', options: ['FD','RD'] },
      { name: 'bank', label: 'Bank', type: 'text', required: true },
      { name: 'principal', label: 'Principal (₹)', type: 'number' },
      { name: 'rate', label: 'Interest rate (%)', type: 'number' },
      { name: 'maturity', label: 'Maturity date', type: 'date' }
    ]
  },
  investments: {
    title: 'Investments', collection: 'investments', icon: '◫',
    columns: [
      { label: 'Type', field: 'type' },
      { label: 'Name', field: 'name', cls: 'name-cell' },
      { label: 'Invested', field: 'invested', render: v => fmt(v) },
      { label: 'Current value', field: 'current', render: v => fmt(v) }
    ],
    fields: [
      { name: 'type', label: 'Type', type: 'select', options: ['Mutual Fund','Stocks','Bonds','Gold','Silver','Crypto'] },
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'invested', label: 'Amount invested (₹)', type: 'number' },
      { name: 'current', label: 'Current value (₹)', type: 'number' }
    ]
  },
  assets: {
    title: 'Assets & Liabilities', collection: 'assets', icon: '◒',
    columns: [
      { label: 'Type', field: 'type' },
      { label: 'Name', field: 'name', cls: 'name-cell' },
      { label: 'Value', field: 'value', render: v => fmt(v) }
    ],
    fields: [
      { name: 'type', label: 'Type', type: 'select', options: ['Property','Vehicle','Gold','Liability - Loan','Liability - Credit Card','Other'] },
      { name: 'name', label: 'Description', type: 'text', required: true },
      { name: 'value', label: 'Value (₹)', type: 'number' }
    ]
  },
  personal: {
    title: 'Personal Expenses', collection: 'personalExpenses', icon: '◪',
    columns: [
      { label: 'Date', field: 'date' },
      { label: 'Category', field: 'category', cls: 'name-cell' },
      { label: 'Amount', field: 'amount', render: v => fmt(v) }
    ],
    fields: [
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'category', label: 'Category', type: 'text' },
      { name: 'amount', label: 'Amount (₹)', type: 'number' }
    ]
  }
};

const PLACEHOLDER_VIEWS = {
  reports: { title: 'Reports', note: 'Sales, expense and profit reports will render here once enough data is logged across modules.' },
  settings: { title: 'Settings', note: 'Role-based login, backup / restore, and Google Sheets connection status will live here.' },
  networth: { title: 'Net Worth Dashboard', note: 'Auto-calculated from Bank Accounts, FD/RD, Investments and Assets & Liabilities.' }
};

function tagFor(status) {
  const s = (status || '').toLowerCase();
  const cls = ['paid','confirmed','completed','ok'].includes(s) ? 'ok'
            : ['unpaid','due','overdue','cancelled'].includes(s) ? 'due'
            : 'pending';
  return `<span class="tag ${cls}">${status || '—'}</span>`;
}

let currentView = 'dashboard';
let editingContext = null; // { moduleKey, id }

/* ---------- Router ---------- */
function navigateTo(view) {
  currentView = view;
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $('#viewTitle').textContent = (MODULES[view] && MODULES[view].title)
    || (PLACEHOLDER_VIEWS[view] && PLACEHOLDER_VIEWS[view].title)
    || (view === 'dashboard' ? 'Dashboard' : view);
  render();
  closeSidebarOnMobile();
}

function render() {
  const root = $('#viewRoot');
  try {
    if (currentView === 'dashboard') { root.innerHTML = renderDashboard(); return; }
    if (MODULES[currentView]) { root.innerHTML = renderModuleView(MODULES[currentView], currentView); wireModuleView(currentView); return; }
    if (PLACEHOLDER_VIEWS[currentView]) { root.innerHTML = renderPlaceholder(PLACEHOLDER_VIEWS[currentView]); return; }
    root.innerHTML = renderPlaceholder({ title: currentView, note: 'This module is on the roadmap.' });
  } catch (err) {
    console.error('Render error for view', currentView, err);
    root.innerHTML = `<div class="empty-state"><div class="glyph">⚠</div>Something went wrong loading this view.<br><span style="font-size:11px;">${err.message}</span></div>`;
  }
}

function renderPlaceholder(cfg) {
  return `
  <div class="placeholder-view">
    <h3>${cfg.title}</h3>
    <p>${cfg.note}</p>
  </div>`;
}

/* ---------- Dashboard ---------- */
function renderDashboard() {
  const bookings = Store.all('bookings');
  const invoices = Store.all('invoices');
  const expenses = Store.all('expenses');
  const equipment = Store.all('equipment');

  const revenue = invoices.reduce((s,i) => s + Number(i.amount||0), 0);
  const spend = expenses.reduce((s,e) => s + Number(e.amount||0), 0);
  const activeBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'pending').length;
  const unpaidInvoices = invoices.filter(i => i.status !== 'paid').length;
  const availableUnits = equipment.reduce((s,e) => s + Number(e.available||0), 0);

  const recentBookings = [...bookings].slice(-5).reverse();

  return `
  <div class="kpi-row">
    <div class="kpi"><div class="kpi-label">Total Revenue</div><div class="kpi-value">${fmt(revenue)}</div><div class="kpi-sub">${invoices.length} invoice(s)</div></div>
    <div class="kpi"><div class="kpi-label">Total Expenses</div><div class="kpi-value">${fmt(spend)}</div><div class="kpi-sub">${expenses.length} entries</div></div>
    <div class="kpi"><div class="kpi-label">Active Bookings</div><div class="kpi-value">${activeBookings}</div><div class="kpi-sub">${unpaidInvoices} unpaid invoice(s)</div></div>
    <div class="kpi"><div class="kpi-label">Equipment Available</div><div class="kpi-value">${availableUnits}</div><div class="kpi-sub">across ${equipment.length} item types</div></div>
  </div>

  <div class="card">
    <div class="section-head"><h2>Recent bookings</h2><button class="btn secondary" onclick="navigateTo('booking')">View all</button></div>
    ${recentBookings.length ? `
    <div class="table-wrap"><table class="ledger">
      <thead><tr><th>Item</th><th>Dates</th><th>Amount</th><th>Status</th></tr></thead>
      <tbody>
        ${recentBookings.map(b => `<tr>
          <td class="name-cell">${b.item}</td>
          <td>${b.startDate || ''} → ${b.endDate || ''}</td>
          <td>${fmt(b.amount)}</td>
          <td>${tagFor(b.status)}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>` : `<div class="empty-state"><div class="glyph">◨</div>No bookings yet.</div>`}
  </div>`;
}

/* ---------- Generic module table view ---------- */
function renderModuleView(cfg, key) {
  const rows = Store.all(cfg.collection);
  return `
  <div class="section-head">
    <h2>${cfg.title}</h2>
    <button class="btn" data-add="${key}">+ Add</button>
  </div>
  ${rows.length ? `
  <div class="table-wrap"><table class="ledger">
    <thead><tr>${cfg.columns.map(c => `<th>${c.label}</th>`).join('')}<th></th></tr></thead>
    <tbody>
      ${rows.map(r => `<tr>
        ${cfg.columns.map(c => `<td class="${c.cls||''}">${c.render ? c.render(r[c.field]) : (r[c.field] ?? '')}</td>`).join('')}
        <td class="row-actions">
          <button data-edit="${key}" data-id="${r.id}">Edit</button>
          <button data-del="${key}" data-id="${r.id}">Delete</button>
        </td>
      </tr>`).join('')}
    </tbody>
  </table></div>` : `<div class="empty-state"><div class="glyph">${cfg.icon}</div>No records yet. Click "+ Add" to create the first one.</div>`}`;
}

function wireModuleView(key) {
  const root = $('#viewRoot');
  const addBtn = root.querySelector(`[data-add="${key}"]`);
  if (addBtn) addBtn.addEventListener('click', () => openModal(key, null));
  root.querySelectorAll(`[data-edit="${key}"]`).forEach(b =>
    b.addEventListener('click', () => openModal(key, b.dataset.id)));
  root.querySelectorAll(`[data-del="${key}"]`).forEach(b =>
    b.addEventListener('click', () => {
      if (confirm('Delete this record?')) {
        Store.remove(MODULES[key].collection, b.dataset.id);
        render();
        syncCollection(key);
      }
    }));
}

/* ---------- Modal / form ---------- */
function openModal(moduleKey, id) {
  const cfg = MODULES[moduleKey];
  editingContext = { moduleKey, id };
  const record = id ? Store.get(cfg.collection, id) : {};

  $('#modalTitle').textContent = (id ? 'Edit ' : 'Add ') + cfg.title.replace(/s$/, '');

  const form = $('#modalForm');
  form.innerHTML = cfg.fields.map(f => {
    const val = record[f.name] ?? '';
    if (f.type === 'select') {
      const opts = f.source ? Store.all(f.source).map(o => ({ value: o.id, label: o[f.optLabel] }))
                             : f.options.map(o => ({ value: o, label: o }));
      return `<div class="field"><label>${f.label}</label>
        <select name="${f.name}">
          <option value="">—</option>
          ${opts.map(o => `<option value="${o.value}" ${o.value===val?'selected':''}>${o.label}</option>`).join('')}
        </select></div>`;
    }
    return `<div class="field"><label>${f.label}</label>
      <input type="${f.type}" name="${f.name}" value="${val}" ${f.required?'required':''}></div>`;
  }).join('') + `
    <div class="modal-actions">
      <button type="submit" class="btn">Save</button>
      <button type="button" class="btn secondary" id="cancelModal">Cancel</button>
    </div>`;

  form.querySelector('#cancelModal').addEventListener('click', closeModal);
  form.onsubmit = (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if (id) Store.update(cfg.collection, id, data);
    else Store.add(cfg.collection, data);
    closeModal();
    render();
    syncCollection(moduleKey);
  };

  $('#modalBackdrop').classList.add('show');
}

function closeModal() {
  $('#modalBackdrop').classList.remove('show');
  editingContext = null;
}

/* ---------- Sheets sync (best-effort, silent if not configured) ---------- */
async function syncCollection(moduleKey) {
  if (!SheetsAPI.isConfigured()) return;
  const cfg = MODULES[moduleKey];
  if (!cfg) return;
  await SheetsAPI.pushCollection(cfg.collection, Store.all(cfg.collection));
}

async function checkSyncStatus() {
  const dot = $('#syncDot'), title = $('#syncTitle'), sub = $('#syncSub');
  if (!SheetsAPI.isConfigured()) {
    dot.classList.remove('on'); title.textContent = 'Local storage mode'; sub.textContent = 'Sheets not connected';
    return;
  }
  const ok = await SheetsAPI.ping();
  dot.classList.toggle('on', ok);
  title.textContent = ok ? 'Connected to Google Sheets' : 'Sheets connection failed';
  sub.textContent = ok ? 'Cloud backup active' : 'Check Apps Script deployment';
}

/* ---------- Chrome: nav, sidebar, modal close, date chip ---------- */
function closeSidebarOnMobile() {
  $('#sidebar').classList.remove('open');
  $('#backdrop').classList.remove('show');
}

function initChrome() {
  $$('.nav-item').forEach(btn => btn.addEventListener('click', () => navigateTo(btn.dataset.view)));
  $('#hamburger').addEventListener('click', () => {
    $('#sidebar').classList.toggle('open');
    $('#backdrop').classList.toggle('show');
  });
  $('#backdrop').addEventListener('click', closeSidebarOnMobile);
  $('#modalClose').addEventListener('click', closeModal);
  $('#modalBackdrop').addEventListener('click', (e) => { if (e.target.id === 'modalBackdrop') closeModal(); });
  $('#todayChip').textContent = new Date().toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
}

function showApp() {
  $('#loginScreen').style.display = 'none';
  $('#appRoot').style.display = '';
  initChrome();
  checkSyncStatus();
  navigateTo('dashboard');
}

function initLogin() {
  wireLoginForm();
}

function wireLoginForm() {
  const form = $('#loginForm');
  const errorBox = $('#loginError');
  const btn = $('#loginBtn');

  const lockLeft = Auth.lockoutSecondsRemaining();
  if (lockLeft > 0) {
    btn.disabled = true;
    errorBox.textContent = `Too many attempts. Try again in ${lockLeft}s.`;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Checking...';
    const pw = $('#loginPassword').value;
    try {
      const result = await Auth.login(pw);
      if (result.ok) {
        showApp();
      } else {
        errorBox.textContent = result.error || 'Incorrect password.';
        $('#loginPassword').value = '';
        btn.disabled = false;
        btn.textContent = 'Unlock';
      }
    } catch (err) {
      errorBox.textContent = 'Could not verify password. Check your connection.';
      btn.disabled = false;
      btn.textContent = 'Unlock';
    }
  });
}

function showBootError(err) {
  console.error('KRAA boot error:', err);
  const screen = document.getElementById('loginScreen');
  if (screen) {
    screen.style.display = 'flex';
    screen.innerHTML = `
      <div class="login-card">
        <div class="login-tag">KRAA</div>
        <h2>Something didn't load</h2>
        <p class="login-sub">
          The app hit an error while starting up. This usually means one of the
          js/ files is missing or out of date on this deployment.<br><br>
          Open the browser console (F12 → Console tab) for details, and check
          that <code>js/store.js</code>, <code>js/auth.js</code>,
          <code>js/sheets-api.js</code> and <code>js/app.js</code> are all
          present and up to date in the repo.
        </p>
        <p class="login-error" style="margin:0;">${(err && err.message) ? err.message : String(err)}</p>
      </div>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    initLogin();
    document.getElementById('logoutBtn')?.addEventListener('click', () => Auth.logout());
    if (Auth.isLoggedIn()) {
      showApp();
    }
    // else: login/setup screen stays visible until submitted
  } catch (err) {
    showBootError(err);
  }
});
