/* KRAA Sheets Sync
   ------------------------------------------------------------
   HOW TO CONNECT GOOGLE SHEETS (free, no hosting cost):

   1. Create a Google Sheet. Name it anything, e.g. "KRAA Database".
   2. In the Sheet, go to Extensions > Apps Script.
   3. Delete any starter code and paste the contents of
      backend/Code.gs (included in this project) into the editor.
   4. Click Deploy > New deployment > select type "Web app".
      - Execute as: Me
      - Who has access: Anyone
   5. Click Deploy, authorize the permissions Google asks for.
   6. Copy the Web App URL you're given and paste it below as
      SHEETS_WEB_APP_URL.
   7. Reload this app. The sync dot in the sidebar turns green
      when the connection works, and all data will read/write
      to your Google Sheet instead of only this browser.

   Until a URL is set, the app runs entirely on localStorage —
   fully usable, just single-device.
*/

const SHEETS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwJekN1UW2FqfzxEfv8rY-WYsYaehYv8mupASbzCmvZtw9A05VrYLWlAIdpIftx4qfifA/exec'; // <-- paste your Apps Script Web App URL here

const SheetsAPI = (() => {
  const isConfigured = () => !!SHEETS_WEB_APP_URL;

  async function ping() {
    if (!isConfigured()) return false;
    try {
      const res = await fetch(`${SHEETS_WEB_APP_URL}?action=ping`);
      const json = await res.json();
      return json && json.ok === true;
    } catch (e) {
      return false;
    }
  }

  async function pullAll() {
    if (!isConfigured()) return null;
    try {
      const res = await fetch(`${SHEETS_WEB_APP_URL}?action=pullAll`);
      return await res.json();
    } catch (e) {
      console.error('Sheets pull failed', e);
      return null;
    }
  }

  async function pushCollection(collection, records) {
    if (!isConfigured()) return false;
    try {
      const res = await fetch(SHEETS_WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, // avoids CORS preflight on Apps Script
        body: JSON.stringify({ action: 'pushCollection', collection, records })
      });
      const json = await res.json();
      return json && json.ok === true;
    } catch (e) {
      console.error('Sheets push failed', e);
      return false;
    }
  }

  return { isConfigured, ping, pullAll, pushCollection };
})();
