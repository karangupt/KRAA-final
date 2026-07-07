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
site. Two layers protect your data:

**Layer A — Login screen (already built in).** The app now shows a password
gate before anything loads.

**Layer B — Server-side password check (the layer that actually matters).**
If you only relied on the login screen, someone could still read your public
repo's code, find your Apps Script Web App URL, and call it directly to skip
the login screen entirely. So the *real* check happens inside `Code.gs` on
Google's servers — it rejects any request that doesn't include the correct
password token. Your password itself is never stored in code that goes to
GitHub; it lives only in that Apps Script project's private "Script
Properties."

**Before connecting Sheets, you must set this password once:**
1. In the Apps Script editor, open `Code.gs`.
2. Find `setAppPassword()` near the top and temporarily change
   `'CHANGE_ME'` to the password you want.
3. Pick `setAppPassword` from the function dropdown at the top of the
   editor and click **Run (▶)**. Approve the Google permission prompts.
4. Check **View → Logs** — it should say "Password set."
5. Change the text back to `'CHANGE_ME'` (or anything) and save, so the
   real password isn't left sitting in the code.

Until you connect Sheets, the app runs in **local-only mode**: the very
first time you open it, it asks you to set a password on that device and
remembers it there (a soft lock — fine for keeping the app private on your
own phone/laptop, but not equivalent to the server-side check above).

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
