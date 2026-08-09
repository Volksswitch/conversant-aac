/**
 * Conversant AAC — weekly report receiver (Google Apps Script).
 *
 * NOT part of the app and never deployed with it. Paste into a Google Apps Script
 * project bound to a Sheet, set SECRET, then Deploy > New deployment > Web app,
 * "Execute as: Me", "Who has access: Anyone". Copy the /exec URL into ENDPOINT in
 * app/js/weekly-send.js, and set the same SECRET in SHARED_SECRET there.
 *
 * WHY THIS SHAPE
 * - Apps Script cannot answer a CORS preflight, so the app posts with
 *   mode:'no-cors' and Content-Type:'text/plain'. That makes it a "simple request"
 *   which is allowed through — but the response is opaque to the app, so it CANNOT
 *   tell whether delivery succeeded. A missing week is visible here, in the Sheet,
 *   and that is the intended way to notice.
 * - Because the response is unreadable by the client, returning an error code is
 *   pointless for the app. It is still returned for a human testing the URL by hand.
 *
 * ⚠ THE SHEET HOLDS PERSONAL DATA. A report carries the tester name assigned at
 * setup, and a first name plus "uses AAC" is identifying in a cohort of five. Keep
 * the Sheet private, do not share the /exec URL, and rotate SECRET if it leaks.
 * The secret stops a stranger who finds the URL filling the Sheet with junk; it
 * does not protect what is already in it.
 *
 * ⚠ WHAT IS NEVER IN A PAYLOAD, by construction on the app side: any transcript or
 * spoken text, and either API key. If a column ever appears here containing
 * conversation text, that is a bug in weekly-send.js, not a change of policy.
 */

// ⚠ Must match SHARED_SECRET in app/js/weekly-send.js. The live value is kept here
// rather than left as a placeholder because a redeploy from this file with the wrong
// value fails SILENTLY at the app — the server answers "bad secret", the app cannot
// read the answer, and reports simply stop arriving. Nothing is exposed by it being
// here: the same value ships inside the app, readable by anyone who opens the site.
var SECRET = 'u_mlqOZgElbxCB7732CAwSzC';
var SHEET_NAME = 'reports';
var ALERT_EMAIL = '';               // set to get mailed when a report shows errors
var ALERT_ERROR_THRESHOLD = 5;      // errors in one report before mailing

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return _out('no body');
    var p = JSON.parse(e.postData.contents);
    if (p.secret !== SECRET) return _out('bad secret');

    var sheet = _sheet();
    var usage = p.usage || {};
    var errors = p.errors || [];

    sheet.appendRow([
      new Date(),                       // received (server clock)
      p.sentAt || '',                   // sent (device clock — they can differ)
      p.testerName || '(not set)',
      p.installId || '',
      p.appVersion || '',
      p.build || '',
      p.coversDays == null ? '' : p.coversDays,
      usage.conversations || 0,
      usage.practiceConversations || 0,
      usage.activeDays || 0,
      usage.daysSinceLastUse == null ? '' : usage.daysSinceLastUse,
      usage.userTurns || 0,
      usage.fromCard || 0,
      usage.fromCardPercent == null ? '' : usage.fromCardPercent,
      usage.respondMsMedian == null ? '' : Math.round(usage.respondMsMedian / 100) / 10,
      usage.respondOver4s || 0,
      usage.emptyConversations || 0,
      _slots(usage.slotCounts),
      errors.length,
      _errorContexts(errors),
      p.systemInfo ? 'changed' : '',    // system info is sent only when it changes
      JSON.stringify(p)                 // the raw payload, so nothing is lost
    ]);

    if (ALERT_EMAIL && errors.length >= ALERT_ERROR_THRESHOLD) {
      MailApp.sendEmail(ALERT_EMAIL,
        'Conversant AAC — ' + (p.testerName || 'a tester') + ' reported ' + errors.length + ' errors',
        _errorContexts(errors) + '\n\nSee the reports Sheet for the full payload.');
    }
    return _out('ok');
  } catch (err) {
    return _out('error: ' + err);
  }
}

// A GET is handy for confirming the deployment is live from a browser.
function doGet() { return _out('Conversant AAC report endpoint is running.'); }

function _out(msg) {
  return ContentService.createTextOutput(msg).setMimeType(ContentService.MimeType.TEXT);
}

function _sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['received', 'sent', 'tester', 'install', 'version', 'build',
      'days covered', 'conversations', 'practice', 'active days', 'days since use',
      'user turns', 'from card', 'from card %', 'median wait (s)', 'waits over 4s',
      'empty conversations', 'categories chosen', 'errors', 'error kinds',
      'system info', 'raw']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function _slots(counts) {
  if (!counts) return '';
  return Object.keys(counts).map(function (k) { return k + ':' + counts[k]; }).join(' ');
}

function _errorContexts(errors) {
  var byContext = {};
  errors.forEach(function (er) {
    var k = (er && er.context) || '(unknown)';
    byContext[k] = (byContext[k] || 0) + 1;
  });
  return Object.keys(byContext).map(function (k) { return k + ':' + byContext[k]; }).join(' ');
}
