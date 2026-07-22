/* KRAA App — router + views */

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const fmt = n => '₹' + (Number(n) || 0).toLocaleString('en-IN');

// Display dates as DD-MM-YYYY (Indian convention). Internally everything
// still stores/sorts as YYYY-MM-DD — this only changes what's shown.
const fmtDate = v => {
  if (!v || !/^\d{4}-\d{2}-\d{2}/.test(v)) return v || '—';
  const [y, m, d] = v.slice(0, 10).split('-');
  return `${d}-${m}-${y}`;
};

const fmtByType = (v, type) => (type === 'US Stock' ? '$' : '₹') + (Number(v) || 0).toLocaleString('en-IN');

// Account types that behave like long-term/locked investments — not
// counted in "Available Balance" anywhere in the app. Add more types
// here (e.g. 'PPF') and the exclusion applies everywhere automatically.
const LOCKED_ACCOUNT_TYPES = ['Sukanya Samriddhi', 'Minor Account', 'Spouse Account'];

// ---------- Invoice Generator: company letterhead + fixed content ----------
// Edit these once here to change what appears on every generated invoice.
const COMPANY_INFO = {
  name: 'PROJECTOR SOLUTIONS',
  tagline: '(Projector Rental & Audio Visual Services)',
  addressLines: [
    'C/o, Gupta Cycle Store, Shop No. 263D, Sector 11,',
    'Juhu Gaon, Vashi, Navi Mumbai – 400703, Maharashtra'
  ],
  mobile: '+91 9819952683 / +91 9820889679',
  email: 'info@projectorsolutions.in | karangupt@gmail.com',
  udyam: 'UDYAM-MH-33-0763833',
  gstNote: 'Not Applicable (Business exempt under GST threshold limit)',
  bankName: 'IDFC FIRST Bank',
  bankAccNo: '10165752073',
  bankAccName: 'Karan Gupta',
  bankBranchIfsc: 'Pune Branch & IDFB0041352',
  upiId: '9820889679@okbizaxis',
  paymentLink: 'https://razorpay.me/@projectorsolutions'
};

const INVOICE_TERMS = [
  'Pricing: Prices mentioned in the invoice are inclusive of agreed rental charges only.',
  'Payment Terms: Payment is due immediately upon completion of service unless otherwise agreed in writing.',
  'Nature of Service: Equipment is provided strictly on a rental basis.',
  'Equipment Responsibility: Any electrical, physical, liquid, accidental, or mishandling damage to the rented equipment during the rental period shall be chargeable to the customer.',
  'Transportation & Installation: Transportation and installation charges are extra unless explicitly mentioned in the invoice.',
  'Rental charges are applicable for a maximum usage period of 4 hours only. Any additional usage beyond the specified duration will be charged at ₹200 per hour per equipment.',
  'Late Return / Delay: Extra charges may apply if the equipment is retained beyond the agreed rental time.',
  'Power Requirement: Customer must ensure proper electricity and power backup availability at the venue.',
  'Cancellation Policy: Last-minute cancellation after booking confirmation or dispatch may attract rental charges, as the equipment slot is reserved and other bookings may be declined.'
];

function numToWordsIndian(num) {
  num = Math.round(Number(num) || 0);
  if (num === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function twoDigits(n) {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  }
  function threeDigits(n) {
    if (n < 100) return twoDigits(n);
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigits(n % 100) : '');
  }
  const crore = Math.floor(num / 10000000); num %= 10000000;
  const lakh = Math.floor(num / 100000); num %= 100000;
  const thousand = Math.floor(num / 1000); num %= 1000;
  const rest = num;
  let parts = [];
  if (crore) parts.push(threeDigits(crore) + ' Crore');
  if (lakh) parts.push(threeDigits(lakh) + ' Lakh');
  if (thousand) parts.push(threeDigits(thousand) + ' Thousand');
  if (rest) parts.push(threeDigits(rest));
  return parts.join(' ');
}

let invoiceDraft = {
  docType: 'Provisional Invoice',
  invoiceNo: '',
  date: new Date().toISOString().slice(0, 10),
  deliveryDate: '',
  duration: '1 Day Only (Four hours only)',
  customerName: '',
  customerAddress: '',
  deliveryAddress: '',
  sameAsCustomer: true,
  items: [{ desc: '', qty: 1, rate: 0 }],
  paid: false,
  paymentMode: 'Cash',
  paymentDate: ''
};

const todayStr = () => new Date().toISOString().slice(0,10);

/* ---------- Module configs: drives generic table + form rendering ---------- */
function invoicePaidSoFar(invoiceId) {
  return Store.all('payments')
    .filter(p => p.invoiceId === invoiceId)
    .reduce((s, p) => s + Number(p.amount || 0), 0);
}

const MODULES = {
  customer: {
    title: 'Customers', collection: 'customers', icon: '◔',
    columns: [
      { label: 'Name', field: 'name', cls: 'name-cell' },
      { label: 'Company', field: 'companyName' },
      { label: 'Phone', field: 'phone' },
      { label: 'Email', field: 'email' },
      { label: 'GST No.', field: 'gst' }
    ],
    fields: [
      { name: 'name', label: 'Customer name', type: 'text', required: true },
      { name: 'companyName', label: 'Company name', type: 'text' },
      { name: 'phone', label: 'Phone', type: 'text' },
      { name: 'email', label: 'Email', type: 'text' },
      { name: 'gst', label: 'GST number', type: 'text' },
      { name: 'notes', label: 'Notes', type: 'text' }
    ]
  },
  booking: {
    title: 'Bookings', collection: 'bookings', icon: '◨',
    statusTabs: ['pending', 'confirmed', 'completed', 'cancelled'],
    sortField: 'startDate',
    columns: [
      { label: 'Item', field: 'item', cls: 'name-cell' },
      { label: 'Client', field: 'clientName' },
      { label: 'Company', field: 'companyName' },
      { label: 'Location', field: 'location' },
      { label: 'Start', field: 'startDate', render: fmtDate },
      { label: 'End', field: 'endDate', render: fmtDate },
      { label: 'Amount', field: 'amount', render: v => fmt(v) },
      { label: 'Status', field: 'status', render: v => tagFor(v) }
    ],
    fields: [
      { name: 'item', label: 'Equipment / item', type: 'text', required: true },
      { name: 'clientName', label: 'Client name', type: 'text' },
      { name: 'companyName', label: 'Company name', type: 'text' },
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
      { label: 'Date', field: 'date', render: fmtDate },
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
      { label: 'Date', field: 'date', render: fmtDate },
      { label: 'Amount', field: 'amount', render: v => fmt(v) },
      { label: 'Status', field: 'status', render: v => tagFor(v) },
      { label: 'Paid', field: '_paid', render: (v, row) => {
          if (row.status === 'paid') return fmt(row.amount);
          if (row.status === 'unpaid') return fmt(0);
          return fmt(invoicePaidSoFar(row.id)); // partial
        } },
      { label: 'Pending', field: '_pending', render: (v, row) => {
          if (row.status === 'paid') return fmt(0);
          if (row.status === 'unpaid') return fmt(row.amount);
          const pending = Number(row.amount || 0) - invoicePaidSoFar(row.id);
          return fmt(pending > 0 ? pending : 0);
        } }
    ],
    fields: [
      { name: 'number', label: 'Invoice number', type: 'text', required: true },
      { name: 'customerId', label: 'Customer', type: 'select', source: 'customers', optLabel: 'name' },
      { name: 'date', label: 'Date', type: 'date' },
      { name: 'amount', label: 'Amount (₹)', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['unpaid','partial','paid'] },
      { name: 'paidAmount', label: 'Amount paid so far (₹)', type: 'number', showIf: { field: 'status', equals: 'partial' } }
    ],
    onSave: (saved, previous) => {
      const wasAlreadyPaid = previous && previous.status === 'paid';
      if (saved.status === 'paid' && !wasAlreadyPaid) {
        const alreadyPaid = invoicePaidSoFar(saved.id);
        const remaining = Number(saved.amount || 0) - alreadyPaid;
        if (remaining > 0) {
          Store.add('payments', { invoiceId: saved.id, date: todayStr(), amount: remaining, mode: 'Bank Transfer' });
          syncCollection('payments');
        }
      } else if (saved.status === 'partial' && saved.paidAmount) {
        const alreadyPaid = invoicePaidSoFar(saved.id);
        const diff = Number(saved.paidAmount || 0) - alreadyPaid;
        if (diff > 0) {
          Store.add('payments', { invoiceId: saved.id, date: todayStr(), amount: diff, mode: 'Bank Transfer' });
          syncCollection('payments');
        }
      }
    }
  },
  payments: {
    title: 'Payments', collection: 'payments', icon: '◓',
    columns: [
      { label: 'Date', field: 'date', render: fmtDate },
      { label: 'Invoice', field: 'invoiceId', render: v => {
          if (!v) return '—';
          const inv = Store.get('invoices', v);
          return inv ? inv.number : '—';
        } },
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
      { label: 'Company', field: 'companyName' },
      { label: 'Contact person', field: 'contactPerson' },
      { label: 'Phone', field: 'phone' },
      { label: 'Email', field: 'email' },
      { label: 'Category', field: 'category' }
    ],
    fields: [
      { name: 'name', label: 'Vendor name', type: 'text', required: true },
      { name: 'companyName', label: 'Registered company name (if different)', type: 'text' },
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
      { label: 'Due Date', field: 'dueDate', render: fmtDate },
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
      { label: 'Last Updated', field: 'lastUpdated', render: fmtDate }
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
      { label: 'Date', field: 'date', render: fmtDate },
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
      { label: 'Date', field: 'date', render: fmtDate },
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
      { label: 'Renewal Date', field: 'renewalDate', render: fmtDate },
      { label: 'Maturity Date', field: 'maturityDate', render: fmtDate }
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
      { label: 'Added On', field: 'dateAdded', render: fmtDate }
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
      { label: 'Date', field: 'dateAdded', render: fmtDate }
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
  reports:    { title: 'Reports',              render: renderReports,  wire: null },
  networth:   { title: 'Net Worth Dashboard',  render: renderNetWorth, wire: wireDashboard },
  invoiceGen: { title: 'Generate Invoice',     render: renderInvoiceGen, wire: wireInvoiceGen },
  settings:   { title: 'Settings',             render: renderSettingsView, wire: wireSettingsView }
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
let reorderSelection = {}; // { [moduleKey]: selectedRowId } — for the radio-select reorder UI

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
      <div class="kpi-sub">${nearestCardDue ? 'Next due: ' + fmtDate(nearestCardDue.dueDate) : 'No dues logged'}</div>
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
          <td>${fmtDate(b.startDate)} → ${fmtDate(b.endDate)}</td>
          <td>${fmt(b.amount)}</td>
          <td>${tagFor(b.status)}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>` : `<div class="empty-state"><div class="glyph">◨</div>No bookings yet.</div>`}
  </div>`;
}

/* ---------- Generic module table view ---------- */
const COLUMN_PREFS_KEY = 'kraa_column_prefs_v1';
const COLUMN_WIDTH_KEY = 'kraa_column_width_v1';
function getColumnWidth(moduleKey, field) {
  try { return JSON.parse(localStorage.getItem(COLUMN_WIDTH_KEY) || '{}')[moduleKey]?.[field] || null; }
  catch (e) { return null; }
}
function setColumnWidth(moduleKey, field, widthPx) {
  try {
    const all = JSON.parse(localStorage.getItem(COLUMN_WIDTH_KEY) || '{}');
    all[moduleKey] = all[moduleKey] || {};
    all[moduleKey][field] = widthPx;
    localStorage.setItem(COLUMN_WIDTH_KEY, JSON.stringify(all));
  } catch (e) {}
}

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

function sumAll(rows, field = 'amount') {
  return rows.reduce((s, r) => s + Number(r[field] || 0), 0);
}
function sumThisMonth(rows, field = 'amount', dateField = 'date') {
  const mk = todayStr().slice(0, 7);
  return rows.filter(r => (r[dateField] || '').startsWith(mk)).reduce((s, r) => s + Number(r[field] || 0), 0);
}

const MODULE_SUMMARIES = {
  expense: [
    { label: 'This Month', compute: rows => fmt(sumThisMonth(rows)) },
    { label: 'Total (All Time)', compute: rows => fmt(sumAll(rows)) }
  ],
  personal: [
    { label: 'This Month', compute: rows => fmt(sumThisMonth(rows)) },
    { label: 'Total (All Time)', compute: rows => fmt(sumAll(rows)) }
  ],
  otherIncome: [
    { label: 'This Month', compute: rows => fmt(sumThisMonth(rows)) },
    { label: 'Total (All Time)', compute: rows => fmt(sumAll(rows)) }
  ],
  booking: [
    { label: 'Active Bookings', compute: rows => rows.filter(r => r.status === 'confirmed' || r.status === 'pending').length },
    { label: 'Total Booking Value (Completed)', compute: rows => fmt(rows.filter(r => r.status === 'completed').reduce((s,r) => s + Number(r.amount||0), 0)) }
  ],
  invoice: [
    { label: 'Total Invoiced', compute: rows => fmt(sumAll(rows)) },
    { label: 'Unpaid Count', compute: rows => rows.filter(r => r.status !== 'paid').length }
  ],
  payments: [
    { label: 'Total Received', compute: rows => fmt(sumAll(rows)) }
  ],
  bank: [
    { label: 'Total Balance (All Accounts)', compute: rows => fmt(sumAll(rows, 'balance')) }
  ],
  fdrd: [
    { label: 'Total FD', compute: rows => fmt(rows.filter(r => r.type === 'FD').reduce((s, r) => s + Number(r.principal || 0), 0)) },
    { label: 'Total RD', compute: rows => fmt(rows.filter(r => r.type === 'RD').reduce((s, r) => s + Number(r.principal || 0), 0)) }
  ],
  creditcards: [
    { label: 'Total Due (All Cards)', compute: rows => fmt(sumAll(rows, 'dueAmount')) },
    { label: 'Total Reward Points', compute: rows => sumAll(rows, 'rewardPoints').toLocaleString('en-IN') }
  ],
  insurance: [
    { label: 'Total Sum Assured', compute: rows => fmt(sumAll(rows, 'sumAssured')) },
    { label: 'Policies', compute: rows => rows.length }
  ],
  assets: [
    { label: 'Total Assets', compute: rows => fmt(rows.filter(r => !(r.type || '').startsWith('Liability')).reduce((s, r) => s + Number(r.value || 0), 0)) },
    { label: 'Total Liabilities', compute: rows => fmt(rows.filter(r => (r.type || '').startsWith('Liability')).reduce((s, r) => s + Number(r.value || 0), 0)) }
  ],
  giftcards: [
    { label: 'Total Balance', compute: rows => fmt(sumAll(rows, 'balance')) }
  ],
  investments: [
    { label: 'India Total', compute: rows => fmt(rows.filter(r => r.type !== 'US Stock').reduce((s, r) => s + Number(r.current || 0), 0)) },
    { label: 'US Stock Total', compute: rows => '$' + rows.filter(r => r.type === 'US Stock').reduce((s, r) => s + Number(r.current || 0), 0).toLocaleString('en-IN') }
  ]
};

// Modules that also get a month-by-month breakdown bar chart above the table.
const MODULE_MONTHLY_BREAKDOWN = ['expense'];

function renderMiniMonthlyBreakdown(rows) {
  const map = {};
  rows.forEach(r => {
    if (!r.date) return;
    const mk = r.date.slice(0, 7);
    map[mk] = (map[mk] || 0) + Number(r.amount || 0);
  });
  const entries = Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  if (!entries.length) return '';
  const maxVal = Math.max(1, ...entries.map(([, v]) => v));
  return `
  <div class="card">
    <div class="section-head"><h2>Monthly breakdown</h2></div>
    <div style="display:flex; flex-direction:column; gap:10px;">
      ${entries.map(([mk, v]) => `
        <div>
          <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--muted); margin-bottom:4px;">
            <span style="font-family:var(--font-disp); color:var(--text); font-weight:600;">${monthLabel(mk)}</span>
            <span>${fmt(v)}</span>
          </div>
          <div style="height:8px; background:var(--panel-2); border-radius:4px; overflow:hidden;">
            <div style="height:100%; width:${(v/maxVal*100).toFixed(1)}%; background:var(--amber);"></div>
          </div>
        </div>`).join('')}
    </div>
  </div>`;
}

// Per-module "hide certain statuses" preference (e.g. hide Completed/Cancelled bookings)
const STATUS_TAB_KEY = 'kraa_status_tab_v1';
function getSelectedTab(moduleKey) {
  try { return JSON.parse(localStorage.getItem(STATUS_TAB_KEY) || '{}')[moduleKey] || 'all'; }
  catch (e) { return 'all'; }
}
function setSelectedTab(moduleKey, tab) {
  try {
    const all = JSON.parse(localStorage.getItem(STATUS_TAB_KEY) || '{}');
    all[moduleKey] = tab;
    localStorage.setItem(STATUS_TAB_KEY, JSON.stringify(all));
  } catch (e) {}
}

const SORT_PREF_KEY = 'kraa_sort_pref_v1';
function getSortPref(moduleKey) {
  try { return JSON.parse(localStorage.getItem(SORT_PREF_KEY) || '{}')[moduleKey] || null; }
  catch (e) { return null; }
}
function setSortPref(moduleKey, field, dir) {
  try {
    const all = JSON.parse(localStorage.getItem(SORT_PREF_KEY) || '{}');
    all[moduleKey] = { field, dir };
    localStorage.setItem(SORT_PREF_KEY, JSON.stringify(all));
  } catch (e) {}
}
function clearSortPref(moduleKey) {
  try {
    const all = JSON.parse(localStorage.getItem(SORT_PREF_KEY) || '{}');
    delete all[moduleKey];
    localStorage.setItem(SORT_PREF_KEY, JSON.stringify(all));
  } catch (e) {}
}

function renderModuleView(cfg, key) {
  let rows = Store.all(cfg.collection);
  const selectedTab = cfg.statusTabs ? getSelectedTab(key) : 'all';
  if (cfg.statusTabs && selectedTab !== 'all') {
    rows = rows.filter(r => r.status === selectedTab);
  }

  // Sorting: an explicit column-header click (sortPref) always wins; otherwise
  // fall back to the module's default sortField (e.g. Bookings by Start date).
  const sortPref = getSortPref(key);
  const activeSortField = sortPref ? (sortPref.field === '__manual__' ? null : sortPref.field) : cfg.sortField;
  const activeSortDir = sortPref ? sortPref.dir : 'asc';
  if (activeSortField) {
    rows = [...rows].sort((a, b) => {
      const av = a[activeSortField] ?? '';
      const bv = b[activeSortField] ?? '';
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return activeSortDir === 'desc' ? -cmp : cmp;
    });
  }

  const visibleColumns = cfg.columns.filter(c => isColumnVisible(key, c.field));
  const summaryDefs = MODULE_SUMMARIES[key];

  return `
  <div class="section-head">
    <h2>${cfg.title}</h2>
    <div style="display:flex; gap:10px; position:relative; flex-wrap:wrap; align-items:center;">
      ${rows.length > 1 ? `
        <div style="display:flex; gap:4px; align-items:center; border:1px solid var(--line); border-radius:8px; padding:4px 6px;">
          <span style="font-size:11px; color:var(--muted); margin-right:4px;">Reorder:</span>
          <button class="btn secondary" id="moveTopBtn" title="Move selected to top" ${!reorderSelection[key] ? 'disabled' : ''}>⤒</button>
          <button class="btn secondary" id="moveUpBtn" title="Move selected up" ${!reorderSelection[key] ? 'disabled' : ''}>↑</button>
          <button class="btn secondary" id="moveDownBtn" title="Move selected down" ${!reorderSelection[key] ? 'disabled' : ''}>↓</button>
          <button class="btn secondary" id="moveBottomBtn" title="Move selected to bottom" ${!reorderSelection[key] ? 'disabled' : ''}>⤓</button>
        </div>` : ''}
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
  ${cfg.statusTabs ? `
  <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">
    <button class="status-tab ${selectedTab === 'all' ? 'active' : ''}" data-tab="all">All</button>
    ${cfg.statusTabs.map(st => `<button class="status-tab ${selectedTab === st ? 'active' : ''}" data-tab="${st}">${st.charAt(0).toUpperCase() + st.slice(1)}</button>`).join('')}
  </div>` : ''}
  ${summaryDefs ? `
  <div class="kpi-row">
    ${summaryDefs.map(s => `<div class="kpi"><div class="kpi-label">${s.label}</div><div class="kpi-value">${s.compute(Store.all(cfg.collection))}</div></div>`).join('')}
  </div>` : ''}
  ${MODULE_MONTHLY_BREAKDOWN.includes(key) ? renderMiniMonthlyBreakdown(Store.all(cfg.collection)) : ''}
  ${rows.length ? `
  <div class="table-wrap"><table class="ledger">
    <thead><tr>${rows.length > 1 ? '<th style="width:30px;"></th>' : ''}${visibleColumns.map(c => {
      const w = getColumnWidth(key, c.field);
      return `<th class="sortable-th" data-sort-field="${c.field}" style="cursor:pointer; user-select:none; position:relative; ${w ? `width:${w}px; max-width:${w}px; overflow:hidden; text-overflow:ellipsis;` : ''}">${c.label}${activeSortField === c.field ? (activeSortDir === 'asc' ? ' ▲' : ' ▼') : ''}<span class="col-resize-handle" data-resize-field="${c.field}"></span></th>`;
    }).join('')}<th></th></tr></thead>
    <tbody>
      ${rows.map(r => `<tr>
        ${rows.length > 1 ? `<td><input type="radio" name="reorderRadio" data-reorder-key="${key}" value="${r.id}" ${reorderSelection[key] === r.id ? 'checked' : ''} style="accent-color:var(--amber);"></td>` : ''}
        ${visibleColumns.map(c => {
          const w = getColumnWidth(key, c.field);
          return `<td class="${c.cls||''}" style="${w ? `max-width:${w}px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;` : ''}">${c.render ? c.render(r[c.field], r) : (r[c.field] ?? '')}</td>`;
        }).join('')}
        <td class="row-actions">
          <button data-edit="${key}" data-id="${r.id}">Edit</button>
          <button data-del="${key}" data-id="${r.id}">Delete</button>
        </td>
      </tr>`).join('')}
    </tbody>
  </table></div>` : `<div class="empty-state"><div class="glyph">${cfg.icon}</div>${selectedTab !== 'all' ? `Nothing with status "${selectedTab}" — try the "All" tab above.` : 'No records yet. Click "+ Add" to create the first one.'}</div>`}
  ${rows.length > 1 ? `<p style="color:var(--muted); font-size:11.5px; margin-top:10px;">Select a row with the radio button, then use the Reorder ⤒ ↑ ↓ ⤓ controls above to move it — this clears any active column sort so your order shows.</p>` : ''}`;
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

  root.querySelectorAll('[data-reorder-key]').forEach(radio =>
    radio.addEventListener('change', () => {
      reorderSelection[key] = radio.value;
      render();
    }));

  const doMove = (direction) => {
    const selectedId = reorderSelection[key];
    if (!selectedId) return;
    Store.moveItem(MODULES[key].collection, selectedId, direction);
    setSortPref(key, '__manual__', 'asc'); // reveal manual order immediately
    render();
    syncCollection(key);
  };
  root.querySelector('#moveTopBtn')?.addEventListener('click', () => doMove('top'));
  root.querySelector('#moveUpBtn')?.addEventListener('click', () => doMove('up'));
  root.querySelector('#moveDownBtn')?.addEventListener('click', () => doMove('down'));
  root.querySelector('#moveBottomBtn')?.addEventListener('click', () => doMove('bottom'));

  let resizeJustHappened = false;
  root.querySelectorAll('.col-resize-handle').forEach(handle => {
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const th = handle.closest('th');
      const field = handle.dataset.resizeField;
      const startX = e.clientX;
      const startWidth = th.offsetWidth;
      let moved = false;

      function onMouseMove(ev) {
        const delta = ev.clientX - startX;
        if (Math.abs(delta) > 3) moved = true;
        const newWidth = Math.max(60, startWidth + delta);
        th.style.width = newWidth + 'px';
        th.style.maxWidth = newWidth + 'px';
      }
      function onMouseUp(ev) {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        if (moved) {
          const delta = ev.clientX - startX;
          const finalWidth = Math.max(60, startWidth + delta);
          setColumnWidth(key, field, finalWidth);
          resizeJustHappened = true;
          render();
        }
      }
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });

  root.querySelectorAll('.sortable-th').forEach(th => {
    th.addEventListener('click', () => {
      if (resizeJustHappened) { resizeJustHappened = false; return; }
      const field = th.dataset.sortField;
      const current = getSortPref(key);
      if (current && current.field === field) {
        if (current.dir === 'asc') {
          setSortPref(key, field, 'desc');
        } else {
          clearSortPref(key); // third click: back to default order
        }
      } else {
        setSortPref(key, field, 'asc');
      }
      render();
    });
  });

  root.querySelectorAll('.status-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      setSelectedTab(key, tab.dataset.tab);
      render();
    });
  });

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

/* ---------- Invoice Generator ---------- */
function invoiceItemsTotal() {
  return invoiceDraft.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
}

function renderInvoiceGen() {
  const total = invoiceItemsTotal();
  return `
  <div id="invoiceGenControls">
    <div class="card">
      <div class="section-head"><h2>1. Document details</h2></div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:14px;">
        <div class="field"><label>Document type</label>
          <select id="ig_docType">
            <option value="Provisional Invoice" ${invoiceDraft.docType==='Provisional Invoice'?'selected':''}>Provisional Invoice</option>
            <option value="Tax Invoice" ${invoiceDraft.docType==='Tax Invoice'?'selected':''}>Invoice</option>
          </select>
        </div>
        <div class="field"><label>Invoice number</label><input type="text" id="ig_invoiceNo" value="${invoiceDraft.invoiceNo}" placeholder="e.g. PS/2026/068"></div>
        <div class="field"><label>Date</label><input type="date" id="ig_date" value="${invoiceDraft.date}"></div>
        <div class="field"><label>Delivery date</label><input type="date" id="ig_deliveryDate" value="${invoiceDraft.deliveryDate}"></div>
        <div class="field"><label>Duration</label><input type="text" id="ig_duration" value="${invoiceDraft.duration}"></div>
      </div>
    </div>

    <div class="card">
      <div class="section-head"><h2>2. Customer &amp; delivery</h2></div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:14px;">
        <div class="field"><label>Customer name</label><input type="text" id="ig_customerName" value="${invoiceDraft.customerName}"></div>
        <div class="field"><label>Customer address</label><textarea id="ig_customerAddress" rows="3" style="width:100%; background:var(--bg); border:1px solid var(--line); color:var(--text); padding:9px 10px; border-radius:7px; font-size:13.5px; font-family:inherit;">${invoiceDraft.customerAddress}</textarea></div>
      </div>
      <label style="display:flex; align-items:center; gap:8px; margin-top:10px; font-size:12.5px; color:var(--muted); cursor:pointer;">
        <input type="checkbox" id="ig_sameAddr" ${invoiceDraft.sameAsCustomer ? 'checked' : ''} style="accent-color:var(--amber);">
        Delivery address same as customer address
      </label>
      <div class="field" id="ig_deliveryAddrField" style="margin-top:10px; ${invoiceDraft.sameAsCustomer ? 'display:none;' : ''}">
        <label>Delivery address</label>
        <textarea id="ig_deliveryAddress" rows="3" style="width:100%; background:var(--bg); border:1px solid var(--line); color:var(--text); padding:9px 10px; border-radius:7px; font-size:13.5px; font-family:inherit;">${invoiceDraft.deliveryAddress}</textarea>
      </div>
    </div>

    <div class="card">
      <div class="section-head"><h2>3. Items</h2><button class="btn secondary" id="ig_addItem">+ Add item</button></div>
      <div class="table-wrap"><table class="ledger">
        <thead><tr><th>Description</th><th style="width:80px;">Qty</th><th style="width:120px;">Rate</th><th style="width:120px;">Amount</th><th></th></tr></thead>
        <tbody>
          ${invoiceDraft.items.map((it, i) => `<tr>
            <td><input type="text" data-item-field="desc" data-item-idx="${i}" value="${it.desc}" style="width:100%; background:var(--bg); border:1px solid var(--line); color:var(--text); padding:6px 8px; border-radius:6px; font-size:13px;"></td>
            <td><input type="number" data-item-field="qty" data-item-idx="${i}" value="${it.qty}" style="width:100%; background:var(--bg); border:1px solid var(--line); color:var(--text); padding:6px 8px; border-radius:6px; font-size:13px;"></td>
            <td><input type="number" data-item-field="rate" data-item-idx="${i}" value="${it.rate}" style="width:100%; background:var(--bg); border:1px solid var(--line); color:var(--text); padding:6px 8px; border-radius:6px; font-size:13px;"></td>
            <td class="name-cell">${fmt((Number(it.qty)||0)*(Number(it.rate)||0))}</td>
            <td><button data-remove-item="${i}" style="background:none; border:none; color:var(--danger); cursor:pointer;">✕</button></td>
          </tr>`).join('')}
        </tbody>
      </table></div>
      <p style="text-align:right; margin-top:10px; font-family:var(--font-mono); font-size:15px;">Total: <strong style="color:var(--amber);">${fmt(total)}</strong></p>
    </div>

    <div class="card">
      <div class="section-head"><h2>4. Payment</h2></div>
      <label style="display:flex; align-items:center; gap:8px; font-size:12.5px; color:var(--muted); cursor:pointer;">
        <input type="checkbox" id="ig_paid" ${invoiceDraft.paid ? 'checked' : ''} style="accent-color:var(--amber);">
        Mark as PAID (adds a payment confirmation block + stamp)
      </label>
      <div id="ig_paidFields" style="display:${invoiceDraft.paid ? '' : 'none'}; margin-top:14px;">
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:14px;">
          <div class="field"><label>Payment mode</label>
            <select id="ig_paymentMode">
              ${['Cash','UPI','Bank Transfer','Cheque','Credit Card'].map(m => `<option value="${m}" ${invoiceDraft.paymentMode===m?'selected':''}>${m}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Payment received on</label><input type="date" id="ig_paymentDate" value="${invoiceDraft.paymentDate}"></div>
        </div>
      </div>
    </div>

    <div style="display:flex; gap:10px; margin-bottom:24px;">
      <button class="btn" id="ig_generate">Generate preview</button>
      <button class="btn secondary" id="ig_print">🖨 Print / Save as PDF</button>
    </div>
  </div>

  <div id="invoicePrintArea">${renderInvoicePrintable()}</div>`;
}

function renderInvoicePrintable() {
  const total = invoiceItemsTotal();
  const deliveryAddr = invoiceDraft.sameAsCustomer ? invoiceDraft.customerAddress : invoiceDraft.deliveryAddress;
  const title = invoiceDraft.docType === 'Provisional Invoice' ? 'PROVISIONAL INVOICE – CUM – DELIVERY CHALLAN' : 'INVOICE – CUM – DELIVERY CHALLAN';

  return `
  <div class="invoice-sheet">
    <div class="invoice-title">${title}</div>
    <div class="invoice-header-row">
      <div class="invoice-company">
        <div class="invoice-company-name">${COMPANY_INFO.name}</div>
        <div>${COMPANY_INFO.tagline}</div>
        ${COMPANY_INFO.addressLines.map(l => `<div>${l}</div>`).join('')}
        <div>Mobile: ${COMPANY_INFO.mobile}</div>
        <div>Email: ${COMPANY_INFO.email}</div>
        <div style="margin-top:6px;">Udyam Registration No.: ${COMPANY_INFO.udyam}</div>
        <div>GSTIN: ${COMPANY_INFO.gstNote}</div>
      </div>
      <div class="invoice-meta">
        <table>
          <tr><td>Invoice No:</td><td>${invoiceDraft.invoiceNo || '—'}</td></tr>
          <tr><td>Dated:</td><td>${fmtDate(invoiceDraft.date)}</td></tr>
          <tr><td>Delivery Dated:</td><td>${fmtDate(invoiceDraft.deliveryDate)}</td></tr>
          <tr><td>Duration:</td><td>${invoiceDraft.duration}</td></tr>
        </table>
      </div>
    </div>

    <div class="invoice-addr-row">
      <div><strong>Customer Details / Bill To:</strong><br>${invoiceDraft.customerName}<br>${(invoiceDraft.customerAddress||'').replace(/\n/g,'<br>')}</div>
      <div><strong>Delivery Address:</strong><br>${(deliveryAddr||'').replace(/\n/g,'<br>')}</div>
    </div>

    <table class="invoice-items">
      <thead><tr><th>SI No</th><th>Description of Goods</th><th>Quantity</th><th>Rate</th><th>Amount</th></tr></thead>
      <tbody>
        ${invoiceDraft.items.map((it, i) => `<tr><td>${i+1}</td><td>${it.desc}</td><td>${it.qty}</td><td>${it.rate ? fmt(it.rate) : ''}</td><td>${fmt((Number(it.qty)||0)*(Number(it.rate)||0))}</td></tr>`).join('')}
        ${Array.from({length: Math.max(0, 6 - invoiceDraft.items.length)}).map(() => `<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>`).join('')}
        ${invoiceDraft.paid ? `<tr><td colspan="5" style="padding-top:16px;">
          <strong>Payment Confirmation</strong><br>
          This is to confirm that payment against the below invoice has been successfully received.<br><br>
          <em>Invoice No.: ${invoiceDraft.invoiceNo}<br>
          Invoice Amount: ${fmt(total)}<br>
          Payment Mode: ${invoiceDraft.paymentMode}<br>
          Payment Received On: ${fmtDate(invoiceDraft.paymentDate)}<br>
          Status: PAID</em>
        </td></tr>` : ''}
      </tbody>
      <tfoot><tr><td colspan="4" style="text-align:right;"><strong>Total</strong></td><td><strong>${fmt(total)}</strong></td></tr></tfoot>
    </table>

    <div class="invoice-words-row">
      <div>Amount Chargeable (in words)<br><strong>Indian Rupees: ${numToWordsIndian(total)} Only</strong></div>
      <div style="text-align:right;">E. &amp; O.E</div>
    </div>

    <div class="invoice-terms">
      <strong>Terms &amp; Conditions:</strong>
      <ol>${INVOICE_TERMS.map(t => `<li>${t}</li>`).join('')}</ol>
      <strong>Mode of Payment: Only Digital Payments Accepted (Bank Transfer / UPI / NEFT / RTGS). Cash Payment Not Accepted.</strong><br>
      GPay: UPI ID: ${COMPANY_INFO.upiId}<br>
      Online Payment Link: <a href="${COMPANY_INFO.paymentLink}">${COMPANY_INFO.paymentLink}</a><br>
      *If payment is made using a Credit Card, an additional 2.5% processing charge will be applicable
    </div>

    <div class="invoice-bank-sign">
      <div>
        <strong>Bank Details: (For Cheque Payment / NEFT / RTGS Transfer)</strong><br>
        Bank Name: ${COMPANY_INFO.bankName}<br>
        A/c No.: ${COMPANY_INFO.bankAccNo}<br>
        A/c Name: ${COMPANY_INFO.bankAccName}<br>
        Branch &amp; IFS Code: ${COMPANY_INFO.bankBranchIfsc}
      </div>
      <div style="text-align:center;">
        ${invoiceDraft.paid ? '<div class="invoice-paid-stamp">PAID</div>' : ''}
        <div style="margin-top:40px;">For ${COMPANY_INFO.name}</div>
        <div>Authorised Signatory</div>
      </div>
    </div>
  </div>`;
}

function wireInvoiceGen() {
  const root = $('#viewRoot');
  const bind = (id, prop, evt = 'input') => {
    root.querySelector('#' + id)?.addEventListener(evt, (e) => {
      invoiceDraft[prop] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      wireInvoiceGenRefresh();
    });
  };
  bind('ig_docType', 'docType', 'change');
  bind('ig_invoiceNo', 'invoiceNo');
  bind('ig_date', 'date');
  bind('ig_deliveryDate', 'deliveryDate');
  bind('ig_duration', 'duration');
  bind('ig_customerName', 'customerName');
  bind('ig_customerAddress', 'customerAddress');
  bind('ig_deliveryAddress', 'deliveryAddress');
  bind('ig_paymentMode', 'paymentMode', 'change');
  bind('ig_paymentDate', 'paymentDate');

  root.querySelector('#ig_sameAddr')?.addEventListener('change', (e) => {
    invoiceDraft.sameAsCustomer = e.target.checked;
    render();
  });
  root.querySelector('#ig_paid')?.addEventListener('change', (e) => {
    invoiceDraft.paid = e.target.checked;
    render();
  });

  root.querySelectorAll('[data-item-field]').forEach(input => {
    input.addEventListener('input', () => {
      const idx = Number(input.dataset.itemIdx);
      const field = input.dataset.itemField;
      invoiceDraft.items[idx][field] = field === 'desc' ? input.value : Number(input.value);
      wireInvoiceGenRefresh();
    });
  });

  root.querySelector('#ig_addItem')?.addEventListener('click', () => {
    invoiceDraft.items.push({ desc: '', qty: 1, rate: 0 });
    render();
  });

  root.querySelectorAll('[data-remove-item]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.removeItem);
      if (invoiceDraft.items.length > 1) invoiceDraft.items.splice(idx, 1);
      render();
    });
  });

  root.querySelector('#ig_generate')?.addEventListener('click', () => {
    $('#invoicePrintArea').innerHTML = renderInvoicePrintable();
    $('#invoicePrintArea').scrollIntoView({ behavior: 'smooth' });
  });

  root.querySelector('#ig_print')?.addEventListener('click', () => {
    $('#invoicePrintArea').innerHTML = renderInvoicePrintable();
    window.print();
  });
}

// Lightweight refresh: just updates the live total/preview without a full
// re-render, so the form doesn't lose focus while typing.
function wireInvoiceGenRefresh() {
  const totalEl = document.querySelector('#invoiceGenControls .card:nth-child(3) p strong');
  if (totalEl) totalEl.textContent = fmt(invoiceItemsTotal());
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
      ${sheetsOn ? `<button class="btn secondary" id="driveBackupBtn">📁 Backup to Google Drive</button>` : ''}
    </div>
    ${sheetsOn ? `<div id="driveBackupStatus" style="margin-top:10px; font-size:12.5px; color:var(--muted);"></div>` : `<p style="color:var(--muted); font-size:11.5px; margin-top:10px;">Backing up straight to Google Drive needs Sheets connected first — see README Part 2.</p>`}
  </div>

  ${sheetsOn ? `
  <div class="card" style="border-left-color:var(--teal);">
    <div class="section-head"><h2>Sync with Google Sheets</h2></div>
    <p style="color:var(--muted); font-size:13px; margin-bottom:14px;">
      Sheets is connected. <strong style="color:var(--text);">Pull latest</strong> loads the newest data from your Sheet into this device (useful mid-session, e.g. after editing from another device). <strong style="color:var(--text);">Push all local data</strong> sends everything on this device up to the Sheet — use this once, right after connecting Sheets for the first time, or if this device has entries the Sheet doesn't.
    </p>
    <div style="display:flex; gap:10px; flex-wrap:wrap;">
      <button class="btn secondary" id="pullAllBtn">↓ Pull latest from Sheets</button>
      <button class="btn" id="pushAllBtn">↑ Push all local data to Sheets</button>
    </div>
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
    <p style="color:var(--muted); font-size:13px; margin-bottom:14px;">This permanently deletes every record in every module on this device.</p>
    <button class="btn secondary" id="revealDangerBtn">🔒 Show danger zone</button>
    <div id="dangerZoneContent" style="display:none; margin-top:14px;">
      <p style="color:var(--danger); font-size:12.5px; margin-bottom:12px;">Only do this if you have a backup you trust, or you genuinely want a clean slate. This cannot be undone.</p>
      <button class="btn danger" id="resetBtn">Reset all data</button>
    </div>
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

  root.querySelector('#driveBackupBtn')?.addEventListener('click', async () => {
    const btn = $('#driveBackupBtn');
    const status = $('#driveBackupStatus');
    btn.disabled = true;
    btn.textContent = 'Uploading...';
    status.textContent = 'Saving backup to your Google Drive...';
    const data = JSON.parse(Store.exportJSON());
    const result = await SheetsAPI.backupToDrive(data);
    btn.disabled = false;
    btn.textContent = '📁 Backup to Google Drive';
    if (result && result.ok) {
      status.innerHTML = `Saved as <strong style="color:var(--text);">${result.fileName}</strong> in a "KRAA Backups" folder in your Drive. <a href="${result.fileUrl}" target="_blank" rel="noopener" style="color:var(--amber);">Open file ↗</a>`;
    } else {
      status.textContent = 'Backup failed: ' + (result?.error || 'unknown error');
    }
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

  root.querySelector('#pullAllBtn')?.addEventListener('click', async () => {
    const btn = $('#pullAllBtn');
    const status = $('#pushAllStatus');
    btn.disabled = true;
    btn.textContent = 'Pulling...';
    status.textContent = 'Fetching latest data from Google Sheets...';
    await pullFromSheetsIntoStore();
    btn.disabled = false;
    btn.textContent = '↓ Pull latest from Sheets';
    status.textContent = 'Done — this device now has the latest data from your Sheet.';
    render();
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

  root.querySelector('#revealDangerBtn')?.addEventListener('click', () => {
    const content = $('#dangerZoneContent');
    const btn = $('#revealDangerBtn');
    content.style.display = '';
    btn.style.display = 'none';
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

  // Prevent Enter from silently submitting/closing the form while typing —
  // a very easy accidental keypress. Save still works via the button click.
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
  });

  form.querySelector('#cancelModal').addEventListener('click', closeModal);
  form.onsubmit = (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const previousRecord = id ? Store.get(cfg.collection, id) : null;
    const saved = id ? Store.update(cfg.collection, id, data) : Store.add(cfg.collection, data);
    if (cfg.onSave) cfg.onSave(saved, previousRecord);
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

async function showApp() {
  if (SheetsAPI.isConfigured()) {
    const sub = document.querySelector('#loginScreen .login-card .login-sub, #loginScreen p');
    if (sub) sub.textContent = 'Syncing your data from Google Sheets...';
    await pullFromSheetsIntoStore();
  }

  $('#loginScreen').style.display = 'none';
  $('#appRoot').style.display = '';
  initChrome();
  checkSyncStatus();
  navigateTo('dashboard');
}

// Defense-in-depth against Google Sheets auto-converting date-like text into
// real Date cells: if a value comes back as an ISO timestamp (e.g. from a
// backend that hasn't been redeployed with the fix yet), trim it back to
// a plain YYYY-MM-DD so date filtering/grouping across the app keeps working.
function sanitizeIsoDates(record) {
  const clean = { ...record };
  Object.keys(clean).forEach(k => {
    const v = clean[k];
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
      // This is a UTC timestamp that started life as a plain date (e.g.
      // "2026-07-14") which Sheets auto-converted into a Date cell at IST
      // midnight. Naively slicing the UTC string shifts the date by a day
      // — convert back to the IST calendar date properly instead.
      try {
        const d = new Date(v);
        clean[k] = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // en-CA -> YYYY-MM-DD
      } catch (e) {
        clean[k] = v.slice(0, 10); // fallback, better than nothing
      }
    }
  });
  return clean;
}

async function pullFromSheetsIntoStore() {
  const result = await SheetsAPI.pullAll();
  if (result && result.ok && result.data) {
    try {
      // Only overwrite collections that actually came back from the Sheet,
      // so anything not yet pushed anywhere stays untouched locally.
      const current = JSON.parse(Store.exportJSON());
      Object.keys(result.data).forEach(col => {
        if (Array.isArray(result.data[col])) {
          current[col] = result.data[col].map(sanitizeIsoDates);
        }
      });
      Store.importJSON(JSON.stringify(current));
    } catch (e) {
      console.error('Could not merge Sheets data into local store', e);
    }
  }
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
        await showApp();
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

document.addEventListener('DOMContentLoaded', async () => {
  try {
    initLogin();
    document.getElementById('logoutBtn')?.addEventListener('click', () => Auth.logout());
    if (Auth.isLoggedIn()) {
      await showApp();
    }
    // else: login/setup screen stays visible until submitted
  } catch (err) {
    showBootError(err);
  }
});
