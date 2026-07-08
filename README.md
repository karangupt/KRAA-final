# KRAA — Karan Rental & Accounts Application

Phase 1 build: works fully offline (browser localStorage) right now, and can be
connected to a free Google Sheet as a cloud database whenever you're ready.
Zero domain cost, zero hosting cost — runs entirely on GitHub Pages.

## What's working right now
- Dashboard with live KPIs (revenue, expenses, active bookings, equipment available)
- Full add / edit / delete for: Customers, Bookings, Equipment Inventory, Expenses,
  Quotation & Invoice, Payments, Staff, Bank Accounts, FD/RD, Investments,
  Assets & Liabilities, Personal Expenses
- Mobile-first responsive layout with a collapsible sidebar
- Placeholder screens (Reports, Settings, Net Worth Dashboard) ready to be wired up next

## Part 1 — Host it for free on GitHub Pages
1. Create a new GitHub repository (e.g. `kraa-app`), public or private.
2. Upload every file in this folder, keeping the same structure:
   ```
   index.html
   css/style.css
   js/store.js
   js/sheets-api.js
   js/app.js
   backend/Code.gs   (not used by the site itself, just kept for reference)
   ```
3. In the repo: **Settings → Pages → Source → Deploy from branch → main / root**.
4. GitHub gives you a free URL like `https://yourusername.github.io/kraa-app/`.
   Open it on your phone or laptop — no domain, no server cost.

## Part 1.5 — Protect your data on a public repo

Since GitHub Pages needs a **public** repo, anyone with the URL could open the
site. The app uses **one universal password** — same on every device, set
once by you. Nothing is created per-device; the login screen only ever
checks against the one password you configure.

**Set your password (takes 2 minutes):**
1. Open your deployed site in any browser (or open `index.html` locally).
2. Open the browser console (press F12, click the "Console" tab).
3. Type this, replacing `yourpassword` with the password you want, and press Enter:
   ```js
   await sha256Hex('yourpassword')
   ```
4. It prints a long string like `2c26b46b68ffc68ff99b453c1d304134...` — copy it.
5. Open `js/auth.js` in your repo and paste it here:
   ```js
   const UNIVERSAL_PASSWORD_HASH = 'PASTE_THE_HASH_HERE';
   ```
6. Commit/push the change. Now every device that opens the site sees the
   same "Enter Password" screen, and only your one password unlocks it.

**Important — this is a deterrent, not bank-grade security.** Because the
repo is public, the password's hash is technically visible in the source
code. A weak/short password could theoretically be cracked offline by
someone determined to do so. It stops casual visitors and search-engine
crawlers from seeing your data, but for real protection (where the check
happens on a server you control, and the password is never exposed even as
a hash), connect Google Sheets below — the Apps Script backend enforces the
password server-side and never ships it in any public file.

If you *do* connect Sheets, the same "Enter Password" screen is reused, but
verification switches automatically to the backend check, and
`UNIVERSAL_PASSWORD_HASH` in `auth.js` is ignored.

## Part 2 — Connect Google Sheets as your cloud database (optional, also free)
Right now all data is saved in the browser (localStorage) — great for testing,
but tied to one device. To make it a real shared cloud database:

1. Create a Google Sheet (any name, e.g. "KRAA Database").
2. Open **Extensions → Apps Script**, delete the starter code, and paste in
   the contents of `backend/Code.gs` from this project.
3. Click **Deploy → New deployment → Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy**, approve the Google permission prompts.
5. Copy the Web App URL it gives you.
6. Open `js/sheets-api.js` in your GitHub repo and paste that URL into:
   ```js
   const SHEETS_WEB_APP_URL = 'PASTE_YOUR_URL_HERE';
   ```
7. Commit the change. Reload the app — the sync dot in the sidebar turns
   green when it's connected, and every add/edit/delete now also saves to
   your Google Sheet automatically. Sheet tabs are created on their own the
   first time each module saves data.

## Part 3 — Live US stock prices, Vendors, Credit Cards & Gift Cards

**Vendors, Credit Cards, Gift Cards & Wallets** are plain manual-entry
modules, same pattern as Customers — because there is no public API that
lets an individual fetch their own credit card reward points or Amazon
Pay / Flipkart gift card balance. Banks and these platforms don't expose
that data outside their own logged-in apps. Update these whenever you
check your statement/app.

**US Stocks (and other tickers) support live price fetching**, since
market data APIs do exist publicly:
1. Sign up free at [twelvedata.com](https://twelvedata.com) (free tier is
   generous enough for personal use) and copy your API key.
2. In the Apps Script editor, open `Code.gs`, find `setStockApiKey()`,
   paste your key in place of `PASTE_YOUR_TWELVE_DATA_KEY_HERE`.
3. Run `setStockApiKey` once from the function dropdown (▶), approve
   permissions if asked.
4. Change the placeholder text back afterwards so the real key isn't left
   in the code, and save.
5. In the Investments module, add a stock with **Type = US Stock** and a
   **Ticker** (e.g. `AAPL`, `TSLA`, `MSFT`) and a **Qty**.
6. Click **↻ Refresh Prices** at the top of the Investments page — it
   fetches the live price (in USD), converts it to ₹ using the current
   exchange rate, multiplies by quantity, and updates Current Value.
   Indian stocks can use their exchange-suffixed symbol per Twelve Data's
   docs (e.g. `RELIANCE:NSE`) and are already quoted in ₹, no conversion
   needed.

This only works once Google Sheets is connected (Part 2) — browsers can't
call financial data APIs directly, so the request is routed through your
Apps Script backend, which fetches server-side and returns the price.

## What's next (Phase 2 ideas)
- Reports module: profit/loss, booking calendar, overdue payments
- Role-based login (Owner / Staff) using a simple PIN stored in Settings
- Net Worth Dashboard: auto-rollup of Bank + FD/RD + Investments − Liabilities
- PWA support (installable app icon, offline caching)
- PDF invoice generation, WhatsApp share link

## Notes
- All financial figures shown are sample/demo data seeded on first load —
  edit or delete them freely from inside the app.
- Nothing here requires npm, a build step, or a paid service. Every file is
  plain HTML/CSS/JS so GitHub Pages can serve it as-is.
