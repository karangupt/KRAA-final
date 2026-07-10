/* KRAA App — router + views */

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const fmt = n => '₹' + (Number(n) || 0).toLocaleString('en-IN');

const fmtByType = (v, type) => (type === 'US Stock' ? '$' : '₹') + (Number(v) || 0).toLocaleString('en-IN');

// Account types that behave like long-term/locked investments — not
// counted in "Available Balance" anywhere in the app. Add more types
// here (e.g. 'PPF') and the exclusion applies everywhere automatically.
const LOCKED_ACCOUNT_TYPES = ['Sukanya Samriddhi', 'Minor Account', 'Spouse Account'];
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
      { label: 'Client', field: 'clientName' },
      { label: 'Location', field: 'location' },
      { label: 'Start', field: 'startDate' },
      { label: 'End', field: 'endDate' },
      { label: 'Amount', field: 'amount', render: v => fmt(v) },
      { label: 'Status', field: 'status', render: v => tagFor(v) }
    ],
    fields: [
      { name: 'item', label: 'Equipment / item', type: 'text', required: true },
      { name: 'clientName', label: 'Client name', type: 'text' },
      { name: 'location', label: 'Location / venue', type: 'text' },
      { name: 'customerId', label: 'Linked customer record (optional)', type: 'select', source: 'customers', optLabel: 'name' },
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
      { label: 'Paid Via', field: 'paymentMode', render: (v, row) => {
          if (v !== 'Credit Card') return v || '—';
          const card = Store.get('creditCards', row.creditCardId);
          return `Credit Card${card ? ' — ' + card.cardName : ''}`;
        } },
      { label: 'Amount', field: 'amount', render: v => fmt(v) }
    ],
    fields: [
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'category', label: 'Category', type: 'text' },
      { name: 'desc', label: 'Description', type: 'text' },
      { name: 'paymentMode', label: 'Paid via', type: 'select', options: ['Cash','UPI','Credit Card'] },
      { name: 'creditCardId', label: 'Which credit card?', type: 'select', source: 'creditCards', optLabel: 'cardName', showIf: { field: 'paymentMode', equals: 'Credit Card' } },
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
      { label: 'Type', field: 'accType', render: v => LOCKED_ACCOUNT_TYPES.includes(v) ? `${v} <span class="tag due" style="margin-left:6px;">Locked</span>` : (v || '—') },
      { label: 'Account No.', field: 'number' },
      { label: 'UPI ID', field: 'upiId' },
      { label: 'IFSC Code', field: 'ifscCode' },
      { label: 'Branch', field: 'branch' },
      { label: 'Balance', field: 'balance', render: v => fmt(v) }
    ],
    fields: [
      { name: 'bank', label: 'Bank name', type: 'text', required: true },
      { name: 'accType', label: 'Account type', type: 'select', options: ['Savings','Current','Sukanya Samriddhi','Minor Account','Spouse Account'] },
      { name: 'number', label: 'Account number (masked)', type: 'text' },
      { name: 'upiId', label: 'UPI ID (GPay / PhonePe / Paytm etc.)', type: 'text' },
      { name: 'customerId', label: 'Customer ID / CIF number', type: 'text' },
      { name: 'branch', label: 'Branch name', type: 'text' },
      { name: 'ifscCode', label: 'IFSC code', type: 'text' },
      { name: 'customerCare', label: 'Customer care number', type: 'text' },
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
    extraAction: { id: 'refreshPrices', label: '↻ Refresh Prices' },
    columns: [
      { label: 'Type', field: 'type' },
      { label: 'Name', field: 'name', cls: 'name-cell' },
      { label: 'Ticker', field: 'ticker' },
      { label: 'Broker', field: 'broker' },
      { label: 'Qty', field: 'qty' },
      { label: 'Invested', field: 'invested', render: (v, row) => fmtByType(v, row.type) },
      { label: 'Current value', field: 'current', render: (v, row) => fmtByType(v, row.type) }
    ],
    fields: [
      { name: 'type', label: 'Type', type: 'select', options: ['Mutual Fund','Indian Stock','US Stock','Bonds','Gold','Silver','Crypto'] },
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'ticker', label: 'Ticker symbol (for stocks, e.g. AAPL)', type: 'text' },
      { name: 'broker', label: 'Broker name (e.g. Zerodha, Groww, Robinhood)', type: 'text' },
      { name: 'brokerAccountNumber', label: 'Broker / Demat account number', type: 'text' },
      { name: 'routingNumber', label: 'Routing number (US bank, for US Stock brokerage)', type: 'text' },
      { name: 'qty', label: 'Quantity / units held', type: 'number' },
      { name: 'invested', label: 'Amount invested (₹, or $ for US Stock)', type: 'number' },
      { name: 'current', label: 'Current value (₹, or $ for US Stock) — or click Refresh Prices', type: 'number' }
    ]
  },
  vendor: {
    title: 'Vendors', collection: 'vendors', icon: '◔',
    columns: [
      { label: 'Vendor', field: 'name', cls: 'name-cell' },
      { label: 'Contact person', field: 'contactPerson' },
      { label: 'Phone', field: 'phone' },
      { label: 'Email', field: 'email' },
      { label: 'Category', field: 'category' }
    ],
    fields: [
      { name: 'name', label: 'Vendor / company name', type: 'text', required: true },
      { name: 'contactPerson', label: 'Contact person', type: 'text' },
      { name: 'phone', label: 'Phone', type: 'text' },
      { name: 'email', label: 'Email', type: 'text' },
      { name: 'category', label: 'Category (e.g. Equipment Supplier)', type: 'text' },
      { name: 'notes', label: 'Notes', type: 'text' }
    ]
  },
  creditcards: {
    title: 'Credit Cards', collection: 'creditCards', icon: '◪',
    columns: [
      { label: 'Card', field: 'cardName', cls: 'name-cell' },
      { label: 'Bank', field: 'bank' },
      { label: 'Due Amount', field: 'dueAmount', render: v => fmt(v) },
      { label: 'Due Date', field: 'dueDate' },
      { label: 'Tracked Spend', field: '_spend', render: (v, row) => fmt(Store.all('expenses').filter(e => e.paymentMode === 'Credit Card' && e.creditCardId === row.id).reduce((s, e) => s + Number(e.amount || 0), 0)) },
      { label: 'Reward Points', field: 'rewardPoints' }
    ],
    fields: [
      { name: 'cardName', label: 'Card name (e.g. HDFC Regalia)', type: 'text', required: true },
      { name: 'bank', label: 'Bank', type: 'text' },
      { name: 'last4', label: 'Last 4 digits', type: 'text' },
      { name: 'creditLimit', label: 'Credit limit (₹)', type: 'number' },
      { name: 'dueAmount', label: 'Current due amount (₹)', type: 'number' },
      { name: 'dueDate', label: 'Payment due date', type: 'date' },
      { name: 'rewardPoints', label: 'Reward points (update manually from statement/app)', type: 'number' }
    ]
  },
  giftcards: {
    title: 'Gift Cards & Wallets', collection: 'giftCards', icon: '◓',
    columns: [
      { label: 'Platform', field: 'platform', cls: 'name-cell' },
      { label: 'Balance', field: 'balance', render: v => fmt(v) },
      { label: 'Last Updated', field: 'lastUpdated' }
    ],
    fields: [
      { name: 'platform', label: 'Platform', type: 'select', options: ['Amazon Pay Balance','Flipkart Gift Card','Amazon Gift Card','Paytm Wallet','Other'] },
      { name: 'balance', label: 'Balance (₹) — check the app and update here', type: 'number' },
      { name: 'lastUpdated', label: 'Last checked on', type: 'date' },
      { name: 'notes', label: 'Notes (e.g. card code, expiry)', type: 'text' }
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
    title: 'Recurring Bills & Utilities', collection: 'personalExpenses', icon: '◪',
    columns: [
      { label: 'Category', field: 'category', cls: 'name-cell' },
      { label: 'Frequency', field: 'frequency' },
      { label: 'Date', field: 'date' },
      { label: 'Amount', field: 'amount', render: v => fmt(v) }
    ],
    fields: [
      { name: 'category', label: 'Bill type', type: 'select', options: ['Electricity Bill','Society Maintenance','Property Tax','Water Bill','Gas Bill','Internet/Phone','Other'] },
      { name: 'frequency', label: 'Frequency', type: 'select', options: ['Monthly','Quarterly','Half-Yearly','Yearly','One-time'] },
      { name: 'date', label: 'Date paid / due', type: 'date', required: true },
      { name: 'amount', label: 'Amount (₹)', type: 'number' }
    ]
  },
  otherIncome: {
    title: 'Other Income', collection: 'otherIncome', icon: '◓',
    columns: [
      { label: 'Date', field: 'date' },
      { label: 'Source', field: 'type', cls: 'name-cell' },
      { label: 'Description', field: 'description' },
      { label: 'Amount', field: 'amount', render: v => fmt(v) }
    ],
    fields: [
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'type', label: 'Income source', type: 'select', options: ['Interest','Dividend','Rent from Property','Sale Commission','Other'], required: true },
      { name: 'description', label: 'Description', type: 'text' },
      { name: 'amount', label: 'Amount (₹)', type: 'number' }
    ]
  },
  insurance: {
    title: 'Insurance', collection: 'insurance', icon: '◕',
    columns: [
      { label: 'Type', field: 'type' },
      { label: 'Company', field: 'insuranceCompany', cls: 'name-cell' },
      { label: 'Policy No.', field: 'policyNumber' },
      { label: 'Sum Assured', field: 'sumAssured', render: v => fmt(v) },
      { label: 'Renewal Date', field: 'renewalDate' },
      { label: 'Maturity Date', field: 'maturityDate' }
    ],
    fields: [
      { name: 'type', label: 'Insurance type', type: 'select', options: ['Term Plan','Life Insurance','Health Insurance','Car Insurance','Scooter Insurance','Other'], required: true },
      { name: 'insuranceCompany', label: 'Insurance company name', type: 'text', required: true },
      { name: 'policyNumber', label: 'Policy number', type: 'text', required: true },
      { name: 'insuredName', label: 'Name (policyholder)', type: 'text' },
      { name: 'nominee', label: 'Nominee', type: 'text' },
      { name: 'sumAssured', label: 'Sum assured (₹)', type: 'number' },
      { name: 'agentName', label: 'Agent name', type: 'text' },
      { name: 'agentNumber', label: 'Agent phone number', type: 'text' },
      { name: 'customerCare', label: 'Customer care number', type: 'text' },
      { name: 'email', label: 'Insurer email ID', type: 'text' },
      { name: 'renewalDate', label: 'Renewal date', type: 'date' },
      { name: 'maturityDate', label: 'Maturity date (leave blank for Health/Car/Scooter — usually no maturity)', type: 'date' },
      { name: 'remarks', label: 'Remarks', type: 'text' }
    ]
  },
  documents: {
    title: 'Document Vault', collection: 'documents', icon: '◪',
    columns: [
      { label: 'Family Member', field: 'familyMember', cls: 'name-cell' },
      { label: 'Category', field: 'category' },
      { label: 'Title', field: 'title' },
      { label: 'Link', field: 'driveLink', render: v => v ? `<a href="${v}" target="_blank" rel="noopener" style="color:var(--amber);">Open ↗</a>` : '—' },
      { label: 'Added On', field: 'dateAdded' }
    ],
    fields: [
      { name: 'familyMember', label: 'Family member', type: 'select', options: ['Karan Gupta','Rukmini Gupta','Aahana Gupta','Aarav Gupta','Shared / Family'], required: true },
      { name: 'category', label: 'Document category', type: 'select', options: ['Property Document','Equipment Invoice','Gold Invoice','Aadhar Card','PAN Card','Passport','Other ID','Education Certificate','Other'], required: true },
      { name: 'title', label: 'Title / description', type: 'text', required: true },
      { name: 'driveLink', label: 'Google Drive link (upload the file to Drive, paste the shareable link here)', type: 'text' },
      { name: 'dateAdded', label: 'Date added', type: 'date' },
      { name: 'notes', label: 'Notes', type: 'textarea' }
    ]
  },
  familyNotes: {
    title: 'Family Notes', collection: 'familyNotes', icon: '◕',
    columns: [
      { label: 'Title', field: 'title', cls: 'name-cell' },
      { label: 'For', field: 'forWhom' },
      { label: 'Date', field: 'dateAdded' }
    ],
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'forWhom', label: 'For', type: 'select', options: ['Everyone','Karan Gupta','Rukmini Gupta','Aahana Gupta','Aarav Gupta'] },
      { name: 'dateAdded', label: 'Date', type: 'date' },
      { name: 'message', label: 'Message', type: 'textarea', required: true }
    ]
  }
};

const PLACEHOLDER_VIEWS = {
  // Anything not yet built lands here automatically — see catch-all in render().
};

const CUSTOM_VIEWS = {
  reports:  { title: 'Reports',              render: renderReports,  wire: null },
  networth: { title: 'Net Worth Dashboard',  render: renderNetWorth, wire: wireDashboard },
  settings: { title: 'Settings',             render: renderSettingsView, wire: wireSettingsView }
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
let cachedUsdInrRate = null; // set once user clicks "Convert to ₹" on the dashboard

/* ---------- Router ---------- */
function navigateTo(view) {
  currentView = view;
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $('#viewTitle').textContent = (MODULES[view] && MODULES[view].title)
    || (CUSTOM_VIEWS[view] && CUSTOM_VIEWS[view].title)
    || (PLACEHOLDER_VIEWS[view] && PLACEHOLDER_VIEWS[view].title)
    || (view === 'dashboard' ? 'Dashboard' : view);
  render();
  closeSidebarOnMobile();
}

function render() {
  const root = $('#viewRoot');
  try {
    if (currentView === 'dashboard') { root.innerHTML = renderDashboard(); wireDashboard(); return; }
    if (MODULES[currentView]) { root.innerHTML = renderModuleView(MODULES[currentView], currentView); wireModuleView(currentView); return; }
    if (CUSTOM_VIEWS[currentView]) {
      root.innerHTML = CUSTOM_VIEWS[currentView].render();
      if (CUSTOM_VIEWS[currentView].wire) CUSTOM_VIEWS[currentView].wire();
      return;
    }
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
function monthLabel(monthKey) {
  const d = new Date(monthKey + '-01T00:00:00');
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function buildMonthlyTrend() {
  const incomeSources = [...Store.all('invoices'), ...Store.all('otherIncome')];
  const expenseSources = [...Store.all('expenses'), ...Store.all('personalExpenses')];
  const map = {};
  incomeSources.forEach(e => {
    if (!e.date) return;
    const mk = e.date.slice(0, 7);
    map[mk] = map[mk] || { income: 0, expense: 0 };
    map[mk].income += Number(e.amount || 0);
  });
  expenseSources.forEach(e => {
    if (!e.date) return;
    const mk = e.date.slice(0, 7);
    map[mk] = map[mk] || { income: 0, expense: 0 };
    map[mk].expense += Number(e.amount || 0);
  });
  return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
}

function renderMonthlyTrend() {
  const rows = buildMonthlyTrend();
  if (!rows.length) return `<div class="empty-state"><div class="glyph">◓</div>No dated income/expense entries yet.</div>`;
  const maxVal = Math.max(1, ...rows.map(([, v]) => Math.max(v.income, v.expense)));
  return `
  <div style="display:flex; flex-direction:column; gap:14px;">
    ${rows.map(([mk, v]) => `
      <div>
        <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--muted); margin-bottom:5px;">
          <span style="font-family:var(--font-disp); color:var(--text); font-weight:600;">${monthLabel(mk)}</span>
          <span>Income ${fmt(v.income)} · Expense ${fmt(v.expense)} · Net <span style="color:${v.income-v.expense>=0?'var(--teal)':'var(--danger)'}">${fmt(v.income-v.expense)}</span></span>
        </div>
        <div style="height:8px; background:var(--panel-2); border-radius:4px; overflow:hidden; margin-bottom:3px;">
          <div style="height:100%; width:${(v.income/maxVal*100).toFixed(1)}%; background:var(--teal);"></div>
        </div>
        <div style="height:8px; background:var(--panel-2); border-radius:4px; overflow:hidden;">
          <div style="height:100%; width:${(v.expense/maxVal*100).toFixed(1)}%; background:var(--danger);"></div>
        </div>
      </div>
    `).join('')}
  </div>`;
}

function wireDashboard() {
  $('#convertUsdBtn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await convertUsdToInr();
  });
}

async function convertUsdToInr() {
  let rate = null;
  if (SheetsAPI.isConfigured()) {
    const fx = await SheetsAPI.fetchFxRate('USD', 'INR');
    if (fx && fx.ok) rate = fx.rate;
  }
  if (!rate) {
    const manual = prompt('Enter the current USD to INR rate (e.g. 83.5):', cachedUsdInrRate || '');
    if (!manual || isNaN(parseFloat(manual))) return;
    rate = parseFloat(manual);
  }
  cachedUsdInrRate = rate;
  render();
}

function renderDashboard() {
  const bookings = Store.all('bookings');
  const invoices = Store.all('invoices');
  const expenses = Store.all('expenses');
  const personalExpenses = Store.all('personalExpenses');
  const equipment = Store.all('equipment');
  const bankAccounts = Store.all('bankAccounts');
  const fdrd = Store.all('fdrd');
  const creditCards = Store.all('creditCards');
  const otherIncome = Store.all('otherIncome');

  // Running month only — not a mix of past/future dated entries.
  const currentMonthKey = todayStr().slice(0, 7);
  const inMonth = d => (d || '').slice(0, 7) === currentMonthKey;

  const monthRevenue = invoices.filter(i => inMonth(i.date)).reduce((s,i) => s + Number(i.amount||0), 0)
    + otherIncome.filter(o => inMonth(o.date)).reduce((s,o) => s + Number(o.amount||0), 0);
  const monthExpense = expenses.filter(e => inMonth(e.date)).reduce((s,e) => s + Number(e.amount||0), 0)
    + personalExpenses.filter(e => inMonth(e.date)).reduce((s,e) => s + Number(e.amount||0), 0);
  const monthNet = monthRevenue - monthExpense;

  const activeBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'pending').length;
  const unpaidInvoices = invoices.filter(i => i.status !== 'paid').length;
  const availableUnits = equipment.reduce((s,e) => s + Number(e.available||0), 0);

  const recentBookings = [...bookings].slice(-5).reverse();

  // Bank balance — Savings + Current only. Sukanya is long-term/locked so it's
  // shown separately and NOT counted as "available" spendable balance.
  // Available Balance excludes any account type in LOCKED_ACCOUNT_TYPES
  // (Sukanya Samriddhi, Minor Account, etc.) — those are long-term /
  // not meant to be withdrawn day-to-day.
  const availableBalance = bankAccounts
    .filter(a => !LOCKED_ACCOUNT_TYPES.includes(a.accType))
    .reduce((s, a) => s + Number(a.balance || 0), 0);
  const lockedTotal = bankAccounts
    .filter(a => LOCKED_ACCOUNT_TYPES.includes(a.accType))
    .reduce((s, a) => s + Number(a.balance || 0), 0);
  const fdTotal = fdrd.filter(f => f.type === 'FD').reduce((s, f) => s + Number(f.principal || 0), 0);
  const rdTotal = fdrd.filter(f => f.type === 'RD').reduce((s, f) => s + Number(f.principal || 0), 0);
  const creditCardDue = creditCards.reduce((s, c) => s + Number(c.dueAmount || 0), 0);
  const investments = Store.all('investments');
  const indiaInvestTotal = investments.filter(i => i.type !== 'US Stock').reduce((s, i) => s + Number(i.current || 0), 0);
  const usInvestTotal = investments.filter(i => i.type === 'US Stock').reduce((s, i) => s + Number(i.current || 0), 0);
  const totalInvestmentValueInr = fdTotal + rdTotal + indiaInvestTotal + (cachedUsdInrRate ? Math.round(usInvestTotal * cachedUsdInrRate) : 0);
  const nearestCardDue = creditCards
    .filter(c => c.dueDate)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];

  return `
  <div class="section-head"><h2>${monthLabel(currentMonthKey)} — this month</h2></div>
  <div class="kpi-row">
    <div class="kpi"><div class="kpi-label">Income This Month</div><div class="kpi-value">${fmt(monthRevenue)}</div><div class="kpi-sub">Business + Other Income</div></div>
    <div class="kpi"><div class="kpi-label">Expenses This Month</div><div class="kpi-value">${fmt(monthExpense)}</div><div class="kpi-sub">Business + Personal</div></div>
    <div class="kpi"><div class="kpi-label">Net This Month</div><div class="kpi-value" style="color:${monthNet>=0?'var(--teal)':'var(--danger)'}">${fmt(monthNet)}</div></div>
    <div class="kpi"><div class="kpi-label">Active Bookings</div><div class="kpi-value">${activeBookings}</div><div class="kpi-sub">${unpaidInvoices} unpaid invoice(s)</div></div>
    <div class="kpi"><div class="kpi-label">Equipment Available</div><div class="kpi-value">${availableUnits}</div><div class="kpi-sub">across ${equipment.length} item types</div></div>
  </div>

  <div class="section-head"><h2>Finance snapshot</h2></div>
  <div class="kpi-row">
    <div class="kpi"><div class="kpi-label">Available Balance</div><div class="kpi-value">${fmt(availableBalance)}</div><div class="kpi-sub">Savings + Current only</div></div>
    <div class="kpi"><div class="kpi-label">FD Total</div><div class="kpi-value">${fmt(fdTotal)}</div><div class="kpi-sub">${fdrd.filter(f=>f.type==='FD').length} fixed deposit(s)</div></div>
    <div class="kpi"><div class="kpi-label">RD Total</div><div class="kpi-value">${fmt(rdTotal)}</div><div class="kpi-sub">${fdrd.filter(f=>f.type==='RD').length} recurring deposit(s)</div></div>
    <div class="kpi"><div class="kpi-label">India Investments</div><div class="kpi-value">${fmt(indiaInvestTotal)}</div><div class="kpi-sub">Mutual Funds, Indian Stocks, Gold, etc.</div></div>
    <div class="kpi">
      <div class="kpi-label">US Stock Investments</div>
      <div class="kpi-value">$${usInvestTotal.toLocaleString('en-IN')}</div>
      ${cachedUsdInrRate
        ? `<div class="kpi-sub">≈ ${fmt(Math.round(usInvestTotal * cachedUsdInrRate))} @ ₹${cachedUsdInrRate}/$ &nbsp;<a href="#" id="convertUsdBtn" style="color:var(--amber);">refresh rate</a></div>`
        : `<div class="kpi-sub"><a href="#" id="convertUsdBtn" style="color:var(--amber);">Convert to ₹ →</a></div>`}
    </div>
    <div class="kpi" style="border-left-color:var(--teal);">
      <div class="kpi-label">Total Investment Value</div>
      <div class="kpi-value" style="color:var(--teal);">${fmt(totalInvestmentValueInr)}</div>
      <div class="kpi-sub">${cachedUsdInrRate ? 'FD + RD + India + US, all combined' : 'Excludes US stocks — click Convert above'}</div>
    </div>
    <div class="kpi"><div class="kpi-label">Not Available to Use (Sukanya, Minor, Spouse)</div><div class="kpi-value" style="color:var(--muted);">${fmt(lockedTotal)}</div><div class="kpi-sub">Tracked for visibility, not spendable by you</div></div>
    <div class="kpi" style="border-left-color:${creditCardDue > 0 ? 'var(--danger)' : 'var(--amber)'};">
      <div class="kpi-label">Credit Card Due</div>
      <div class="kpi-value" style="color:${creditCardDue > 0 ? 'var(--danger)' : 'inherit'}">${fmt(creditCardDue)}</div>
      <div class="kpi-sub">${nearestCardDue ? 'Next due: ' + nearestCardDue.dueDate : 'No dues logged'}</div>
    </div>
  </div>

  <div class="card">
    <div class="section-head"><h2>Monthly trend</h2></div>
    ${renderMonthlyTrend()}
    <p style="color:var(--muted); font-size:11.5px; margin-top:14px;"><span style="color:var(--teal);">■</span> Income &nbsp; <span style="color:var(--danger);">■</span> Expense — across every month you have dated entries for, past or future.</p>
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
const COLUMN_PREFS_KEY = 'kraa_column_prefs_v1';

function getColumnPrefs(moduleKey) {
  try {
    const all = JSON.parse(localStorage.getItem(COLUMN_PREFS_KEY) || '{}');
    return all[moduleKey] || {};
  } catch (e) { return {}; }
}

function isColumnVisible(moduleKey, field) {
  const prefs = getColumnPrefs(moduleKey);
  return prefs[field] !== false; // visible by default unless explicitly hidden
}

function setColumnVisible(moduleKey, field, visible) {
  try {
    const all = JSON.parse(localStorage.getItem(COLUMN_PREFS_KEY) || '{}');
    all[moduleKey] = all[moduleKey] || {};
    all[moduleKey][field] = visible;
    localStorage.setItem(COLUMN_PREFS_KEY, JSON.stringify(all));
  } catch (e) { console.error('Could not save column preference', e); }
}

function renderModuleView(cfg, key) {
  const rows = Store.all(cfg.collection);
  const visibleColumns = cfg.columns.filter(c => isColumnVisible(key, c.field));
  return `
  <div class="section-head">
    <h2>${cfg.title}</h2>
    <div style="display:flex; gap:10px; position:relative;">
      <button class="btn secondary" id="columnsBtn">⚙ Columns</button>
      <div class="col-panel" id="columnsPanel" style="display:none;">
        ${cfg.columns.map(c => `
          <label class="col-panel-item">
            <input type="checkbox" data-col-toggle="${c.field}" ${isColumnVisible(key, c.field) ? 'checked' : ''}>
            ${c.label}
          </label>`).join('')}
      </div>
      ${cfg.extraAction ? `<button class="btn secondary" id="${cfg.extraAction.id}">${cfg.extraAction.label}</button>` : ''}
      <button class="btn" data-add="${key}">+ Add</button>
    </div>
  </div>
  ${rows.length ? `
  <div class="table-wrap"><table class="ledger">
    <thead><tr>${visibleColumns.map(c => `<th>${c.label}</th>`).join('')}<th></th></tr></thead>
    <tbody>
      ${rows.map(r => `<tr>
        ${visibleColumns.map(c => `<td class="${c.cls||''}">${c.render ? c.render(r[c.field], r) : (r[c.field] ?? '')}</td>`).join('')}
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

  const columnsBtn = root.querySelector('#columnsBtn');
  const columnsPanel = root.querySelector('#columnsPanel');
  columnsBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    columnsPanel.style.display = columnsPanel.style.display === 'none' ? '' : 'none';
  });
  columnsPanel?.querySelectorAll('[data-col-toggle]').forEach(cb => {
    cb.addEventListener('change', () => {
      setColumnVisible(key, cb.dataset.colToggle, cb.checked);
      render();
    });
  });
  // Close the panel when clicking anywhere else on the page.
  document.addEventListener('click', function closeColPanel(e) {
    if (columnsPanel && !columnsPanel.contains(e.target) && e.target !== columnsBtn) {
      columnsPanel.style.display = 'none';
      document.removeEventListener('click', closeColPanel);
    }
  });

  if (key === 'investments') {
    root.querySelector('#refreshPrices')?.addEventListener('click', refreshStockPrices);
  }
}

async function refreshStockPrices() {
  if (!SheetsAPI.isConfigured()) {
    alert('Live price fetching needs the free Google Sheets backend connected (browsers can\'t call stock market APIs directly). See README Part 3 — Live stock prices.');
    return;
  }
  const btn = $('#refreshPrices');
  const items = Store.all('investments').filter(i => i.ticker);
  if (!items.length) {
    alert('Add a ticker symbol to at least one investment first (e.g. AAPL, TSLA, or an Indian symbol).');
    return;
  }
  if (btn) { btn.disabled = true; btn.textContent = '↻ Refreshing...'; }

  // Fetch USD→INR once if any US stocks are present, reuse for all of them.
  let usdInr = null;
  if (items.some(i => i.type === 'US Stock')) {
    const fx = await SheetsAPI.fetchFxRate('USD', 'INR');
    if (fx && fx.ok) usdInr = fx.rate;
  }

  let updated = 0, failed = [];
  for (const item of items) {
    const result = await SheetsAPI.fetchStockPrice(item.ticker);
    if (result && result.ok && result.price) {
      const qty = Number(item.qty || 1);
      let priceInInr = result.price;
      if (item.type === 'US Stock') {
        if (!usdInr) { failed.push(item.ticker + ' (no FX rate)'); continue; }
        priceInInr = result.price * usdInr;
      }
      Store.update('investments', item.id, { current: Math.round(priceInInr * qty) });
      updated++;
    } else {
      failed.push(item.ticker);
    }
  }

  render();
  syncCollection('investments');
  if (btn) { btn.disabled = false; btn.textContent = '↻ Refresh Prices'; }
  if (failed.length) alert(`Updated ${updated} of ${items.length}. Could not fetch: ${failed.join(', ')}`);
}

/* ---------- Reports ---------- */
function renderReports() {
  const invoices = Store.all('invoices');
  const payments = Store.all('payments');
  const expenses = Store.all('expenses');
  const bookings = Store.all('bookings');
  const otherIncome = Store.all('otherIncome');

  const businessRevenue = invoices.reduce((s, i) => s + Number(i.amount || 0), 0);
  const otherIncomeTotal = otherIncome.reduce((s, o) => s + Number(o.amount || 0), 0);
  const revenue = businessRevenue + otherIncomeTotal;
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const profit = revenue - totalExpenses;

  const paidPerInvoice = {};
  payments.forEach(p => { paidPerInvoice[p.invoiceId] = (paidPerInvoice[p.invoiceId] || 0) + Number(p.amount || 0); });
  const outstanding = invoices.reduce((s, i) => {
    const paid = paidPerInvoice[i.id] || 0;
    const due = Number(i.amount || 0) - paid;
    return s + (due > 0 ? due : 0);
  }, 0);

  const expenseByCategory = {};
  expenses.forEach(e => { expenseByCategory[e.category || 'Uncategorised'] = (expenseByCategory[e.category || 'Uncategorised'] || 0) + Number(e.amount || 0); });
  const catRows = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]);

  const incomeBySource = {};
  otherIncome.forEach(o => { incomeBySource[o.type || 'Other'] = (incomeBySource[o.type || 'Other'] || 0) + Number(o.amount || 0); });
  const incomeRows = Object.entries(incomeBySource).sort((a, b) => b[1] - a[1]);

  const statusCounts = {};
  bookings.forEach(b => { statusCounts[b.status || 'unknown'] = (statusCounts[b.status || 'unknown'] || 0) + 1; });

  return `
  <div class="kpi-row">
    <div class="kpi"><div class="kpi-label">Total Revenue</div><div class="kpi-value">${fmt(revenue)}</div><div class="kpi-sub">Business ${fmt(businessRevenue)} + Other Income ${fmt(otherIncomeTotal)}</div></div>
    <div class="kpi"><div class="kpi-label">Total Expenses</div><div class="kpi-value">${fmt(totalExpenses)}</div></div>
    <div class="kpi"><div class="kpi-label">Net Profit</div><div class="kpi-value" style="color:${profit >= 0 ? 'var(--teal)' : 'var(--danger)'}">${fmt(profit)}</div></div>
    <div class="kpi"><div class="kpi-label">Outstanding Payments</div><div class="kpi-value">${fmt(outstanding)}</div></div>
  </div>

  <div class="card">
    <div class="section-head"><h2>Expenses by category</h2></div>
    ${catRows.length ? `
    <div class="table-wrap"><table class="ledger">
      <thead><tr><th>Category</th><th>Amount</th></tr></thead>
      <tbody>${catRows.map(([cat, amt]) => `<tr><td class="name-cell">${cat}</td><td>${fmt(amt)}</td></tr>`).join('')}</tbody>
    </table></div>` : `<div class="empty-state"><div class="glyph">◒</div>No expenses logged yet.</div>`}
  </div>

  <div class="card">
    <div class="section-head"><h2>Other income by source</h2></div>
    ${incomeRows.length ? `
    <div class="table-wrap"><table class="ledger">
      <thead><tr><th>Source</th><th>Amount</th></tr></thead>
      <tbody>${incomeRows.map(([src, amt]) => `<tr><td class="name-cell">${src}</td><td>${fmt(amt)}</td></tr>`).join('')}</tbody>
    </table></div>` : `<div class="empty-state"><div class="glyph">◓</div>No other income logged yet.</div>`}
  </div>

  <div class="card">
    <div class="section-head"><h2>Bookings by status</h2></div>
    ${Object.keys(statusCounts).length ? `
    <div class="table-wrap"><table class="ledger">
      <thead><tr><th>Status</th><th>Count</th></tr></thead>
      <tbody>${Object.entries(statusCounts).map(([st, count]) => `<tr><td>${tagFor(st)}</td><td>${count}</td></tr>`).join('')}</tbody>
    </table></div>` : `<div class="empty-state"><div class="glyph">◨</div>No bookings logged yet.</div>`}
  </div>`;
}

/* ---------- Net Worth Dashboard ---------- */
function renderNetWorth() {
  const bank = Store.all('bankAccounts');
  const fdrd = Store.all('fdrd');
  const investments = Store.all('investments');
  const assetsRaw = Store.all('assets');

  // Sukanya, Minor and Spouse accounts hold money that isn't really "yours"
  // to count as personal net worth — same exclusion as Available Balance.
  const bankTotal = bank
    .filter(a => !LOCKED_ACCOUNT_TYPES.includes(a.accType))
    .reduce((s, a) => s + Number(a.balance || 0), 0);
  const excludedBankTotal = bank
    .filter(a => LOCKED_ACCOUNT_TYPES.includes(a.accType))
    .reduce((s, a) => s + Number(a.balance || 0), 0);
  const fdrdTotal = fdrd.reduce((s, a) => s + Number(a.principal || 0), 0);

  // India investments are already stored in ₹. US Stocks are stored in $ and
  // must be converted before they can be added to a ₹ net worth total.
  const indiaInvestTotal = investments.filter(i => i.type !== 'US Stock').reduce((s, a) => s + Number(a.current || 0), 0);
  const usInvestTotal = investments.filter(i => i.type === 'US Stock').reduce((s, a) => s + Number(a.current || 0), 0);
  const usInvestInr = cachedUsdInrRate ? Math.round(usInvestTotal * cachedUsdInrRate) : 0;
  const investTotal = indiaInvestTotal + usInvestInr;

  const liabilities = assetsRaw.filter(a => (a.type || '').startsWith('Liability'));
  const otherAssets = assetsRaw.filter(a => !(a.type || '').startsWith('Liability'));
  const assetsTotal = otherAssets.reduce((s, a) => s + Number(a.value || 0), 0);
  const liabilitiesTotal = liabilities.reduce((s, a) => s + Number(a.value || 0), 0);

  const totalAssets = bankTotal + fdrdTotal + investTotal + assetsTotal;
  const netWorth = totalAssets - liabilitiesTotal;

  const rows = [
    { label: 'Bank Accounts', value: bankTotal },
    { label: 'FD / RD', value: fdrdTotal },
    { label: 'India Investments', value: indiaInvestTotal },
    { label: usInvestTotal > 0 ? `US Stocks ($${usInvestTotal.toLocaleString('en-IN')}${cachedUsdInrRate ? ' @ ₹'+cachedUsdInrRate+'/$' : ', not converted yet'})` : 'US Stocks', value: usInvestInr },
    { label: 'Other Assets', value: assetsTotal },
    { label: 'Liabilities', value: -liabilitiesTotal }
  ];

  return `
  <div class="kpi-row">
    <div class="kpi"><div class="kpi-label">Total Assets</div><div class="kpi-value">${fmt(totalAssets)}</div></div>
    <div class="kpi"><div class="kpi-label">Total Liabilities</div><div class="kpi-value" style="color:var(--danger)">${fmt(liabilitiesTotal)}</div></div>
    <div class="kpi"><div class="kpi-label">Net Worth</div><div class="kpi-value" style="color:var(--teal)">${fmt(netWorth)}</div></div>
  </div>
  ${usInvestTotal > 0 && !cachedUsdInrRate ? `<p style="color:var(--amber); font-size:12.5px; margin-bottom:14px;">⚠ You have $${usInvestTotal.toLocaleString('en-IN')} in US Stocks not yet converted to ₹ — Net Worth above excludes them. <a href="#" id="convertUsdBtn" style="color:var(--amber); text-decoration:underline;">Convert now</a></p>` : ''}
  <div class="card">
    <div class="section-head"><h2>Breakdown</h2></div>
    <div class="table-wrap"><table class="ledger">
      <thead><tr><th>Category</th><th>Amount</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td class="name-cell">${r.label}</td><td style="color:${r.value < 0 ? 'var(--danger)' : 'inherit'}">${fmt(r.value)}</td></tr>`).join('')}</tbody>
    </table></div>
    <p style="color:var(--muted); font-size:12px; margin-top:12px;">Pulled live from Bank Accounts, FD/RD, Investments and Assets &amp; Liabilities — update those modules and this updates automatically.${excludedBankTotal > 0 ? ` Excludes ${fmt(excludedBankTotal)} in Sukanya/Minor/Spouse accounts — that money isn't counted as your personal net worth.` : ''}</p>
  </div>`;
}

/* ---------- Settings ---------- */
function renderSettingsView() {
  const sheetsOn = SheetsAPI.isConfigured();
  return `
  <div class="card">
    <div class="section-head"><h2>Data backup &amp; restore</h2></div>
    <p style="color:var(--muted); font-size:13px; margin-bottom:14px;">Download a full backup of everything in this app (all modules) as a JSON file. Keep it somewhere safe — you can restore from it any time, on any device.</p>
    <div style="display:flex; gap:10px; flex-wrap:wrap;">
      <button class="btn" id="backupBtn">Download backup (.json)</button>
      <label class="btn secondary" style="cursor:pointer;">Restore from file
        <input type="file" id="restoreFile" accept="application/json" style="display:none;">
      </label>
    </div>
  </div>

  ${sheetsOn ? `
  <div class="card" style="border-left-color:var(--teal);">
    <div class="section-head"><h2>Push local data to Google Sheets</h2></div>
    <p style="color:var(--muted); font-size:13px; margin-bottom:14px;">
      Sheets is connected. If this device has entries that were added before connecting (or entries not yet in the Sheet), click below to push everything from this device into your Google Sheet in one go.
    </p>
    <button class="btn" id="pushAllBtn">Push all local data to Sheets</button>
    <div id="pushAllStatus" style="margin-top:10px; font-size:12.5px; color:var(--muted);"></div>
  </div>
  ` : ''}

  <div class="card">
    <div class="section-head"><h2>Security</h2></div>
    <p style="color:var(--muted); font-size:13px;">
      Login mode: <strong style="color:var(--text);">${sheetsOn ? 'Google Sheets (server-side check)' : 'Universal password (client-side hash)'}</strong><br><br>
      ${sheetsOn
        ? 'Password is verified by your Apps Script backend — it is never exposed in this app\'s code.'
        : 'To change the password, generate a new SHA-256 hash (see README) and update UNIVERSAL_PASSWORD_HASH in js/auth.js, then redeploy. For stronger security, connect Google Sheets — see README Part 2.'}
    </p>
  </div>

  <div class="card" style="border-color:var(--danger);">
    <div class="section-head"><h2 style="color:var(--danger);">Danger zone</h2></div>
    <p style="color:var(--muted); font-size:13px; margin-bottom:14px;">This permanently deletes every record in every module on this device. Only do this if you have a backup you trust, or you genuinely want a clean slate.</p>
    <button class="btn danger" id="resetBtn">Reset all data</button>
  </div>`;
}

function wireSettingsView() {
  const root = $('#viewRoot');

  root.querySelector('#backupBtn')?.addEventListener('click', () => {
    const data = Store.exportJSON();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kraa-backup-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  root.querySelector('#restoreFile')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('This will REPLACE all current data on this device with the contents of the backup file. This cannot be undone. Continue?')) {
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        Store.importJSON(reader.result);
        alert('Backup restored successfully.');
        render();
      } catch (err) {
        alert('Could not read this file — make sure it\'s a KRAA backup .json. ' + err.message);
      }
    };
    reader.readAsText(file);
  });

  root.querySelector('#pushAllBtn')?.addEventListener('click', async () => {
    const btn = $('#pushAllBtn');
    const status = $('#pushAllStatus');
    btn.disabled = true;
    btn.textContent = 'Pushing...';
    const collections = [...new Set(Object.values(MODULES).map(m => m.collection))];
    let done = 0, failed = [];
    for (const col of collections) {
      const records = Store.all(col);
      const ok = await SheetsAPI.pushCollection(col, records);
      if (ok) done++; else failed.push(col);
      status.textContent = `Pushing ${done + failed.length} of ${collections.length} sheets...`;
    }
    btn.disabled = false;
    btn.textContent = 'Push all local data to Sheets';
    status.textContent = failed.length
      ? `Done, but ${failed.length} sheet(s) failed: ${failed.join(', ')}. Check your Apps Script deployment.`
      : `All ${done} sheets pushed successfully.`;
  });

  root.querySelector('#resetBtn')?.addEventListener('click', () => {
    if (!confirm('This permanently deletes ALL data on this device (customers, bookings, invoices, everything). Are you sure?')) return;
    if (!confirm('Last check — this cannot be undone unless you have a backup. Really reset everything?')) return;
    Store.reset();
    render();
  });
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
    const wrapAttrs = f.showIf ? `data-showif-field="${f.showIf.field}" data-showif-equals="${f.showIf.equals}"` : '';
    let inner;
    if (f.type === 'select') {
      const opts = f.source ? Store.all(f.source).map(o => ({ value: o.id, label: o[f.optLabel] }))
                             : f.options.map(o => ({ value: o, label: o }));
      inner = `<label>${f.label}</label>
        <select name="${f.name}">
          <option value="">—</option>
          ${opts.map(o => `<option value="${o.value}" ${o.value===val?'selected':''}>${o.label}</option>`).join('')}
        </select>`;
    } else if (f.type === 'textarea') {
      inner = `<label>${f.label}</label>
        <textarea name="${f.name}" rows="5" style="width:100%; background:var(--bg); border:1px solid var(--line); color:var(--text); padding:9px 10px; border-radius:7px; font-size:13.5px; font-family:inherit; resize:vertical;" ${f.required?'required':''}>${val}</textarea>`;
    } else {
      inner = `<label>${f.label}</label>
      <input type="${f.type}" name="${f.name}" value="${val}" ${f.type === 'number' ? 'step="any"' : ''} ${f.required?'required':''}>`;
    }
    return `<div class="field" ${wrapAttrs}>${inner}</div>`;
  }).join('') + `
    <div class="modal-actions">
      <button type="submit" class="btn">Save</button>
      <button type="button" class="btn secondary" id="cancelModal">Cancel</button>
    </div>`;

  // Conditional fields: hide/show based on another field's current value,
  // e.g. "Which credit card?" only appears when Payment Mode = Credit Card.
  const conditionalWraps = form.querySelectorAll('[data-showif-field]');
  function applyConditionalVisibility() {
    conditionalWraps.forEach(wrap => {
      const controllerName = wrap.dataset.showifField;
      const expected = wrap.dataset.showifEquals;
      const controller = form.querySelector(`[name="${controllerName}"]`);
      const match = controller && controller.value === expected;
      wrap.style.display = match ? '' : 'none';
    });
  }
  const controllerNames = new Set(Array.from(conditionalWraps).map(w => w.dataset.showifField));
  controllerNames.forEach(name => {
    const controller = form.querySelector(`[name="${name}"]`);
    controller?.addEventListener('change', applyConditionalVisibility);
  });
  applyConditionalVisibility();

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
  wireHashHelper();
}

function wireHashHelper() {
  const showLink = $('#showHashHelper');
  const backLink = $('#backToLogin');
  const loginCard = $('#loginForm');
  const helperCard = $('#hashHelperCard');
  const genBtn = $('#generateHashBtn');
  const copyBtn = $('#copyHashBtn');

  showLink?.addEventListener('click', (e) => {
    e.preventDefault();
    loginCard.style.display = 'none';
    helperCard.style.display = '';
  });

  backLink?.addEventListener('click', (e) => {
    e.preventDefault();
    helperCard.style.display = 'none';
    loginCard.style.display = '';
  });

  genBtn?.addEventListener('click', async () => {
    const pw = $('#hashInputPassword').value;
    if (!pw) { alert('Type a password first.'); return; }
    const hash = await sha256Hex(pw);
    $('#hashResult').value = hash;
    $('#hashResultField').style.display = '';
  });

  copyBtn?.addEventListener('click', () => {
    const field = $('#hashResult');
    field.select();
    navigator.clipboard?.writeText(field.value).then(() => {
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy hash'; }, 1500);
    }).catch(() => {
      document.execCommand('copy');
    });
  });
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
