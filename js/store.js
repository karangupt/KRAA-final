/* KRAA Data Store
   ------------------------------------------------------------
   Everything lives in localStorage under one key so the app
   works fully offline out of the box. When a Google Apps Script
   Web App URL is configured (see js/sheets-api.js), the same
   collections get pushed/pulled from a Google Sheet, which acts
   as the free cloud database.
*/

const KRAA_STORE_KEY = 'kraa_data_v1';

const KRAA_DEFAULT_DATA = {
  customers: [
    { id: 'c1', name: 'Vikram Studios', phone: '9820011223', email: 'vikram@studios.in', gst: '27ABCDE1234F1Z5', notes: 'Wedding videographer, repeat client' },
    { id: 'c2', name: 'St. Xavier College', phone: '9833344556', email: 'events@xaviers.edu', gst: '', notes: 'Annual fest client' }
  ],
  bookings: [
    { id: 'b1', customerId: 'c1', clientName: 'Vikram Studios', location: 'Bandra, Mumbai', item: 'Epson 6000L Projector + Screen', startDate: '2026-07-10', endDate: '2026-07-12', amount: 6000, status: 'confirmed' },
    { id: 'b2', customerId: 'c2', clientName: 'St. Xavier College', location: 'Fort, Mumbai', item: '2x BenQ Projector, Sound System', startDate: '2026-07-15', endDate: '2026-07-16', amount: 12000, status: 'pending' }
  ],
  equipment: [
    { id: 'e1', name: 'Epson 6000L Projector', category: 'Projector', qty: 3, available: 2, rate: 2000 },
    { id: 'e2', name: 'BenQ MW632ST', category: 'Projector', qty: 2, available: 1, rate: 1800 },
    { id: 'e3', name: '150" Projector Screen', category: 'Screen', qty: 4, available: 3, rate: 800 }
  ],
  expenses: [
    { id: 'x1', date: '2026-07-01', category: 'Maintenance', desc: 'Projector lamp replacement', amount: 3200 },
    { id: 'x2', date: '2026-07-03', category: 'Transport', desc: 'Delivery van fuel', amount: 900 }
  ],
  invoices: [
    { id: 'i1', customerId: 'c1', bookingId: 'b1', number: 'INV-2026-001', date: '2026-07-10', amount: 6000, status: 'unpaid' }
  ],
  payments: [
    { id: 'p1', invoiceId: 'i1', date: '2026-07-05', amount: 3000, mode: 'UPI' }
  ],
  staff: [
    { id: 's1', name: 'Ramesh Yadav', role: 'Technician', phone: '9876500000', salary: 15000 }
  ],
  bankAccounts: [
    { id: 'ba1', bank: 'HDFC Bank', accType: 'Savings', number: 'XXXX4521', upiId: 'karan@okhdfcbank', customerId: '', branch: 'Andheri West', ifscCode: 'HDFC0001234', customerCare: '1800-202-6161', balance: 84500 },
    { id: 'ba2', bank: 'SBI', accType: 'Sukanya Samriddhi', number: 'XXXX9087', upiId: '', customerId: '', branch: 'Andheri West', ifscCode: 'SBIN0001234', customerCare: '1800-425-3800', balance: 210000 }
  ],
  fdrd: [
    { id: 'f1', type: 'FD', bank: 'SBI', principal: 100000, rate: 7.1, maturity: '2027-03-01' }
  ],
  investments: [
    { id: 'inv1', type: 'Mutual Fund', name: 'Parag Parikh Flexi Cap', ticker: '', qty: '', invested: 50000, current: 58200 },
    { id: 'inv2', type: 'US Stock', name: 'Apple Inc.', ticker: 'AAPL', qty: 5, invested: 60000, current: 68500 }
  ],
  vendors: [
    { id: 'v1', name: 'Sharma Electronics', contactPerson: 'Anil Sharma', phone: '9811122233', email: 'sharma.elec@example.com', category: 'Equipment Supplier', notes: 'Bulk projector parts' }
  ],
  creditCards: [
    { id: 'cc1', cardName: 'HDFC Regalia', bank: 'HDFC Bank', last4: '4521', creditLimit: 200000, dueAmount: 18500, dueDate: '2026-07-20', rewardPoints: 3200 }
  ],
  giftCards: [
    { id: 'gc1', platform: 'Amazon Pay Balance', balance: 1250, lastUpdated: '2026-07-01', notes: '' }
  ],
  assets: [
    { id: 'a1', type: 'Vehicle', name: 'Delivery Van', value: 320000 }
  ],
  personalExpenses: [
    { id: 'pe1', category: 'Electricity Bill', frequency: 'Monthly', date: '2026-07-02', amount: 2400 },
    { id: 'pe2', category: 'Society Maintenance', frequency: 'Monthly', date: '2026-07-05', amount: 3500 },
    { id: 'pe3', category: 'Property Tax', frequency: 'Half-Yearly', date: '2027-01-15', amount: 12000 }
  ],
  insurance: [
    { id: 'ins1', type: 'Term Plan', policyNumber: 'LIC-TP-88452201', insuredName: 'Karan Gupta', nominee: 'Family Member', sumAssured: 5000000, agentName: 'Suresh Mehta', agentNumber: '9876511122', customerCare: '1800-425-9494', email: 'support@licindia.in', renewalDate: '2027-01-15', maturityDate: '2046-01-15', remarks: 'Annual premium' }
  ],
  otherIncome: [
    { id: 'oi1', date: '2026-07-01', type: 'Interest', description: 'HDFC savings interest', amount: 420 },
    { id: 'oi2', date: '2026-07-04', type: 'Rent from Property', description: 'Flat rent - July', amount: 18000 }
  ],
  documents: [
    { id: 'doc1', familyMember: 'Karan Gupta', category: 'Aadhar Card', title: 'Karan Gupta - Aadhar', driveLink: '', dateAdded: '2026-07-01', notes: 'Upload to Google Drive and paste the link here' }
  ],
  familyNotes: [
    { id: 'fn1', title: 'Welcome note', forWhom: '', dateAdded: '2026-07-01', message: 'This is where I keep track of everything for the family — accounts, policies, documents. Check Document Vault and Insurance for policy details, and Net Worth Dashboard for a full picture of our finances.' }
  ]
};

const Store = (() => {
  function _load() {
    try {
      const raw = localStorage.getItem(KRAA_STORE_KEY);
      if (!raw) {
        localStorage.setItem(KRAA_STORE_KEY, JSON.stringify(KRAA_DEFAULT_DATA));
        return structuredClone(KRAA_DEFAULT_DATA);
      }
      return JSON.parse(raw);
    } catch (e) {
      console.error('Store load failed', e);
      return structuredClone(KRAA_DEFAULT_DATA);
    }
  }

  function _save(data) {
    localStorage.setItem(KRAA_STORE_KEY, JSON.stringify(data));
  }

  let data = _load();

  function all(collection) {
    return data[collection] ? [...data[collection]] : [];
  }

  function get(collection, id) {
    return (data[collection] || []).find(r => r.id === id) || null;
  }

  function add(collection, record) {
    if (!data[collection]) data[collection] = [];
    record.id = record.id || (collection.slice(0,2) + Date.now().toString(36));
    data[collection].push(record);
    _save(data);
    return record;
  }

  function update(collection, id, patch) {
    const arr = data[collection] || [];
    const idx = arr.findIndex(r => r.id === id);
    if (idx === -1) return null;
    arr[idx] = { ...arr[idx], ...patch };
    _save(data);
    return arr[idx];
  }

  function remove(collection, id) {
    data[collection] = (data[collection] || []).filter(r => r.id !== id);
    _save(data);
  }

  function reset() {
    data = structuredClone(KRAA_DEFAULT_DATA);
    _save(data);
  }

  function exportJSON() {
    return JSON.stringify(data, null, 2);
  }

  function importJSON(json) {
    const parsed = JSON.parse(json);
    data = parsed;
    _save(data);
  }

  function moveItem(collection, id, direction) {
    const arr = data[collection] || [];
    const idx = arr.findIndex(r => r.id === id);
    if (idx === -1) return;
    let newIdx = idx;
    if (direction === 'top') newIdx = 0;
    else if (direction === 'bottom') newIdx = arr.length - 1;
    else if (direction === 'up') newIdx = Math.max(0, idx - 1);
    else if (direction === 'down') newIdx = Math.min(arr.length - 1, idx + 1);
    const [item] = arr.splice(idx, 1);
    arr.splice(newIdx, 0, item);
    _save(data);
  }

  return { all, get, add, update, remove, reset, exportJSON, importJSON, moveItem };
})();
