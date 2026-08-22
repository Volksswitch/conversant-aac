/**
 * Conversant AAC — weekly report receiver (Google Apps Script).
 *
 * NOT part of the app and never deployed with it.
 *
 * FIRST TIME. Paste into a Google Apps Script project bound to a Sheet, set SECRET,
 * then Deploy > New deployment > Web app, "Execute as: Me", "Who has access:
 * Anyone". Copy the /exec URL into ENDPOINT in app/js/weekly-send.js, and set the
 * same SECRET in SHARED_SECRET there.
 *
 * ⚠ EVERY TIME AFTER THAT, USE Deploy > MANAGE deployments > pencil > Version: New
 * version > Deploy. NOT "New deployment". A new deployment mints a NEW /exec URL,
 * and the app has the old one compiled into it — so reports keep arriving at the
 * OLD version of this script, which still accepts them and writes them to the
 * `reports` tab. Nothing errors, nothing is lost, and the change you just made
 * appears to have done nothing at all. Editing the existing deployment keeps the
 * URL, which is what makes the app pick the change up.
 *
 * WHY THIS SHAPE
 * - Apps Script cannot answer a CORS preflight, so the app posts with
 *   mode:'no-cors' and Content-Type:'text/plain'. That makes it a "simple request"
 *   which is allowed through — but the response is opaque to the app, so it CANNOT
 *   tell whether delivery succeeded. A missing week is visible here, in the Sheet,
 *   and that is the intended way to notice.
 * - Because the response is unreadable by the client, returning an error code is
 *   pointless for the app. It is still returned for a human testing the URL by hand.
 * - TWO TABS. `reports` is one row per report received: the audit trail, and where the
 *   raw payload is kept. `weeks` is one row per tester per week, upserted rather than
 *   appended, and is the table to read and chart - a cumulative summary cannot show a
 *   tester tailing off, and that is the headline question.
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
var WEEKS_SHEET_NAME = 'weeks';   // one row per tester per week - the retention curve
var PROBLEMS_SHEET_NAME = 'problems';  // one row per 'Report a problem' the tester sent
/* MAIL ON TROUBLE. Ken, August 21 2026: "I need to hear about errors shortly after
 * they are reported." Reports arrive when a tester opens the app, so "shortly after"
 * is as soon as one lands - which is what this does, and it is the only part of the
 * loop that does not wait for somebody to go and look.
 *
 * (!) BLANKING THIS IS THE OFF SWITCH, and it is silent - an empty address disables
 * every alert below with no error and no trace, so it reads as a setting that was
 * never filled in rather than one that was turned off. Change it here and redeploy;
 * editing and saving in the Apps Script editor alone changes nothing at the live URL.
 *
 * It also covers PROBLEM reports, which mail on arrival regardless of the threshold -
 * those are a tester deliberately writing to us, so there is no volume to filter.
 *
 * The threshold is 1 rather than 5 deliberately. Five was a volume filter written
 * when nobody was reading the Sheet; with a handful of testers the interesting event
 * is a KIND of error appearing for the first time, and that arrives as a one. The
 * cost of being wrong is an email. */
var ALERT_EMAIL = 'ken@volksswitch.org';
var ALERT_ERROR_THRESHOLD = 1;

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return _out('no body');
    var p = JSON.parse(e.postData.contents);
    if (p.secret !== SECRET) return _out('bad secret');

    // A problem report is a different animal: one tester, one moment, their own
    // words, and the full diagnostic text. It gets its own tab rather than being
    // squeezed into the weekly columns, which describe a period rather than an
    // event. ⚠ UNLIKE EVERY OTHER PAYLOAD, THIS ONE CAN CONTAIN CONVERSATION TEXT —
    // the report embeds transcripts of the conversations an error happened in. That
    // is permitted only because the tester read it and pressed Send; it must never
    // be produced by anything automatic. Treat this tab as the most sensitive thing
    // in the Sheet.
    if (p.kind === 'problem') {
      _problemSheet().appendRow([
        new Date(),
        p.sentAt || '',
        p.testerName || '(not set)',
        p.installId || '',
        p.appVersion || '',
        p.build || '',
        p.note || '',
        p.report || ''
      ]);
      if (ALERT_EMAIL) {
        MailApp.sendEmail(ALERT_EMAIL,
          'Conversant AAC - problem report from ' + (p.testerName || 'a tester'),
          (p.note || '(no note)') + '\n\nSee the problems tab for the full report.');
      }
      return _out('ok');
    }

    var usage = p.usage || {};
    var errors = p.errors || [];
    var events = (p.events && p.events.totals) || {};
    var timings = (p.events && p.events.timings) || {};
    var depth = p.personalization || {};

    _sheet().appendRow([
      new Date(),                       // received (server clock)
      p.sentAt || '',                   // sent (device clock - they can differ)
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
      usage.respondMsMedian == null ? '' : _s(usage.respondMsMedian),
      usage.respondOver4s || 0,
      // How long the cards were up before the user acted - read plus select, and the
      // only part of the wait above that is the person rather than the machine.
      usage.decideMsMedian == null ? '' : _s(usage.decideMsMedian),
      usage.cardsPerPaletteMedian == null ? '' : usage.cardsPerPaletteMedian,
      usage.optionWordsMedian == null ? '' : usage.optionWordsMedian,
      usage.emptyConversations || 0,
      _pairs(usage.slotCounts),
      _pairs(usage.sourceCounts),
      // The partner-side proxy: someone who came back is the nearest thing the app
      // can say to "they would do it again". Not the same as asking them.
      (usage.partners || []).length,
      usage.returningPartners || 0,
      usage.voiceFellBack || 0,
      // Suggestions shown and then not taken - the case the saved conversations
      // cannot show at all.
      events.palette_shown || 0,
      events.palette_abandoned || 0,
      events.regenerate || 0,
      // Opened the app and never started a conversation: the clearest early-quit
      // signal there is, and it needs both numbers to be read.
      events.app_opened || 0,
      events.conversation_started || 0,
      events.generation_superseded || 0,
      events.rate_limited || 0,
      _med(timings, 'generation.ms'),
      _med(timings, 'checkpoint.sinceMs'),
      _med(timings, 'stt_gap.ms'),
      depth.worldviewPercent == null ? '' : depth.worldviewPercent,
      depth.expressEdited == null ? '' : depth.expressEdited,
      depth.people == null ? '' : depth.people,
      errors.length,
      _errorContexts(errors),
      p.systemInfo ? 'included' : '',
      _raw(p)                           // the report as received, so nothing is lost
    ]);

    _writeWeeks(p);

    if (ALERT_EMAIL && errors.length >= ALERT_ERROR_THRESHOLD) {
      MailApp.sendEmail(ALERT_EMAIL,
        // The subject carries the two things worth knowing without opening anything:
        // who, and what kind. Since 0.7.11 these are only the errors NEW since that
        // tester's last report, so a repeat means it is still happening rather than
        // that the same backlog arrived again.
        'Conversant AAC - ' + (p.testerName || 'a tester') + ': ' + _errorContexts(errors),
        [_errorContexts(errors),
         'Tester: ' + (p.testerName || '(not set)') + '   device ' + (p.installId || '?'),
         'Version: ' + (p.appVersion || '?') + ' (build ' + (p.build || '?') + ')',
         'Covering the last ' + (p.coversDays == null ? '?' : p.coversDays) + ' day(s).',
         '',
         'These are new since that tester last reported.',
         'Nothing about what anybody said is in here or in the Sheet.',
         'Run "evaluate beta" on an export of the reports tab to see them in context.'
        ].join('\n'));
    }
    return _out('ok');
  } catch (err) {
    return _out('error: ' + err);
  }
}

/* THE RETENTION CURVE, one row per tester per week - the table to actually read.
 *
 * (!) ROWS ARE UPSERTED, NOT APPENDED, and that is the whole design. Every report
 * carries the tester's WHOLE history rebucketed, so appending would write week 1
 * again every week and the sheet would fill with stale duplicates of the same weeks.
 * Replacing in place means the newest report always wins, which is what you want: a
 * week is only complete once it is over, and the report that arrives after it ends is
 * the one telling the truth about it.
 *
 * Keyed on install rather than tester name, because the name can be typed late or
 * corrected, and a changed name must not silently start a second curve.
 */
function _writeWeeks(p) {
  var weeks = p.weeks || [];
  if (!weeks.length) return;
  var sheet = _weeksSheet();
  var install = p.installId || p.testerName || '?';
  var existing = {};
  var last = sheet.getLastRow();
  if (last > 1) {
    var keys = sheet.getRange(2, 1, last - 1, 2).getValues();
    for (var i = 0; i < keys.length; i++) existing[keys[i][0] + '|' + keys[i][1]] = i + 2;
  }
  for (var w = 0; w < weeks.length; w++) {
    var k = weeks[w];
    var row = [
      install,
      k.week,
      p.testerName || '(not set)',
      k.start ? new Date(k.start) : '',
      k.activeDays || 0,
      k.conversations || 0,
      k.practice || 0,
      k.userTurns || 0,
      k.partnerTurns || 0,
      k.fromCard || 0,
      k.fromCardPercent == null ? '' : k.fromCardPercent
    ];
    var at = existing[install + '|' + k.week];
    if (at) sheet.getRange(at, 1, 1, row.length).setValues([row]);
    else sheet.appendRow(row);
  }
}

/* ⚠ BUMP THIS WHENEVER THIS FILE CHANGES, and the reason is worth reading once.
 * Editing and saving in the Apps Script editor changes NOTHING at the /exec URL, and
 * "Deploy > New deployment" quietly creates a SECOND web app at a DIFFERENT URL while
 * the original keeps serving the old code. Both mistakes look completely successful:
 * the URL answers, the secret is accepted, reports keep arriving. On Aug 8 2026 that
 * cost a probe row to notice, and only because the change happened to alter something
 * visible in the Sheet -- a change to SECRET would have been invisible and total,
 * silently rejecting every report until someone noticed weeks of empty rows.
 * Visiting the /exec URL in a browser now prints this, so a redeploy is confirmable in
 * two seconds with nothing written. The correct redeploy is:
 *   Deploy > Manage deployments > pencil > Version: New version > Deploy   (same URL) */
var SCRIPT_VERSION = '2026-08-22a';

// A GET is handy for confirming the deployment is live, and WHICH CODE is live.
function doGet() {
  return _out('Conversant AAC report endpoint is running. Script version: ' + SCRIPT_VERSION);
}

function _out(msg) {
  return ContentService.createTextOutput(msg).setMimeType(ContentService.MimeType.TEXT);
}

/* MAKE A TAB FIT ITS HEADER, every time, before anything is written to it.
 *
 * (!) THIS EXISTS BECAUSE THE ABSENCE OF IT LOST REPORTS SILENTLY FOR SIX DAYS
 * (found August 22 2026). A tab created by Apps Script is 26 columns wide. The
 * reports row grew past that on August 16, and Google REFUSES a row wider than the
 * sheet - so appendRow threw on every report from then on. Every layer downstream of
 * that throw is designed to be quiet: doPost catches it and returns a message, the
 * app posts with no-cors so it cannot read the message, and the app marks the week
 * done on ENQUEUE rather than on delivery. Nothing errored, nothing retried, nothing
 * was flagged. The Sheet simply stopped gaining rows, which is indistinguishable from
 * testers going quiet - the exact thing the Sheet exists to detect.
 *
 * It also repairs the OTHER half of the same problem: a header row is written only
 * when a tab is first created, so renaming a column in this file used to change
 * nothing on a Sheet that already existed, and the row on screen drifted further from
 * the data underneath it with every column added. Comparing and rewriting costs one
 * read per report at a handful of reports a week, which is nothing against a column
 * whose name quietly stops describing what is in it.
 *
 * Widening is safe and never destructive: columns are added to the RIGHT of what is
 * there, and existing values keep their positions. */
function _fit(sheet, header) {
  var have = sheet.getMaxColumns();
  if (have < header.length) sheet.insertColumnsAfter(have, header.length - have);
  var current = sheet.getRange(1, 1, 1, header.length).getValues()[0];
  for (var i = 0; i < header.length; i++) {
    if (String(current[i]) !== header[i]) {
      sheet.getRange(1, 1, 1, header.length).setValues([header]);
      sheet.setFrozenRows(1);
      break;
    }
  }
  return sheet;
}
var PROBLEM_HEADER = ['received', 'sent', 'tester', 'install', 'version', 'build',
      'what happened (their words)', 'full report'];

function _problemSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PROBLEMS_SHEET_NAME) || ss.insertSheet(PROBLEMS_SHEET_NAME);
  return _fit(sheet, PROBLEM_HEADER);
}

/* THE HEADER IS ONE LIST, read both when the tab is created and every time one is
 * written to - see _fit, which widens a tab that has been outgrown and rewrites the
 * header row when it no longer matches. Renaming a column here therefore reaches a
 * Sheet that already exists, which it did not until August 22 2026.
 *
 * (!) THE ROW APPENDED IN doPost MUST BE EXACTLY AS LONG AS THIS LIST. A shorter or
 * longer row throws, doPost catches the throw, the app cannot read the reply, and the
 * Sheet simply stops gaining rows - which looks exactly like testers going quiet. Add
 * a value and a name together, always, and only ever at the END: an insertion in the
 * middle shifts every column after it away from the data already sitting under it. */
var REPORT_HEADER = ['received', 'sent', 'tester', 'install', 'version', 'build',
      'days covered', 'conversations', 'practice', 'active days', 'days since use',
      'user turns', 'from card', 'from card %', 'median wait (s)', 'waits over 4s',
      'median decide (s)', 'cards shown', 'words per card',
      'empty conversations', 'categories chosen', 'sources',
      'people named', 'returning people', 'voice fallbacks',
      'palettes shown', 'palettes abandoned', 'regenerates',
      'app opens', 'conversations started', 'superseded', 'rate limited',
      'median generation (s)', 'median gap between checkpoints (s)', 'median stt gap (s)',
      'About Me %', 'express edited', 'people recorded',
      'new errors since last report', 'error kinds', 'system info', 'raw'];

function _sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  return _fit(sheet, REPORT_HEADER);
}

var WEEKS_HEADER = ['install', 'week', 'tester', 'week starting', 'days used',
      'conversations', 'practice', 'things said', 'partner turns',
      'from card', 'from card %'];

function _weeksSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(WEEKS_SHEET_NAME) || ss.insertSheet(WEEKS_SHEET_NAME);
  return _fit(sheet, WEEKS_HEADER);
}

// The whole report minus the secret. Keeping the secret out matters because this
// column is the one a human copies from — into a bug report, a message, a paste to
// someone helping. The secret already ships inside the app so nothing here is newly
// exposed, but there is no reason to carry it into every place a row gets pasted.
function _raw(p) {
  var copy = {};
  for (var k in p) if (k !== 'secret') copy[k] = p[k];
  return JSON.stringify(copy);
}

// Milliseconds to one decimal place of a second, which is the resolution anyone
// reading these actually uses.
function _s(ms) { return Math.round(ms / 100) / 10; }

function _med(timings, name) {
  var t = timings && timings[name];
  return t && t.median != null ? _s(t.median) : '';
}

function _pairs(counts) {
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
