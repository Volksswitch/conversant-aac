/* The report endpoint (scripts/weekly-report-endpoint.gs), run for real.
 *
 * CR-010. Google Sheets refuses any row with a cell over 50,000 characters, and a
 * problem report carries transcripts, so it passes that easily. The endpoint answered
 * with an error, the app kept the report at the head of its queue, and every later
 * report waited behind it for weeks. The script is loaded into a sandbox with a fake
 * spreadsheet that refuses exactly what Google refuses.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { readReports } from '../scripts/beta-eval/load.mjs';

const SRC = readFileSync(new URL('../scripts/weekly-report-endpoint.gs', import.meta.url), 'utf8');

function fakeSheet() {
    let cols = 26;
    const rows = [[]];
    return {
        rows,
        getMaxColumns: () => cols,
        insertColumnsAfter: (_a, n) => { cols += n; },
        getLastRow: () => rows.length,
        setFrozenRows() {},
        getRange: (r, c, nr, nc) => ({
            getValues: () => [Array.from({ length: nc }, (_, i) => (rows[r - 1] || [])[c - 1 + i] ?? '')],
            setValues: (v) => { rows[r - 1] = v[0].slice(); },
        }),
        appendRow(row) {
            if (row.length > cols) throw new Error('row wider than sheet');
            for (const cell of row) {
                if (String(cell).length > 50000) {
                    throw new Error('Your input contains more than the maximum of 50000 characters in a single cell.');
                }
            }
            rows.push(row);
        },
    };
}

function load() {
    const sheets = {};
    const ctx = {
        SpreadsheetApp: {
            getActiveSpreadsheet: () => ({
                getSheetByName: (n) => sheets[n] || null,
                insertSheet: (n) => (sheets[n] = fakeSheet()),
            }),
        },
        MailApp: { sendEmail() {} },
        ContentService: {
            MimeType: { TEXT: 'text' },
            createTextOutput: (m) => ({ text: m, setMimeType() { return this; } }),
        },
    };
    vm.createContext(ctx);
    vm.runInContext(SRC, ctx);
    return { ctx, sheets, post: (p) => ctx.doPost({ postData: { contents: JSON.stringify({ secret: ctx.SECRET, ...p }) } }).text };
}

test('a problem report far over the cell limit is accepted and kept whole', () => {
    const { ctx, sheets, post } = load();
    const report = 'line of transcript\n'.repeat(6500);   // about 123,500 characters
    assert.equal(post({ kind: 'problem', sentAt: '2026-10-05', testerName: 'T', note: 'it froze', report }), 'ok');
    const sheet = sheets[ctx.PROBLEMS_SHEET_NAME];
    const row = sheet.rows.at(-1);
    assert.equal(row.length, ctx.PROBLEM_HEADER.length, 'the row is exactly as long as its header');
    // And the reader puts it back together.
    const { problems } = readReports([sheet.rows[0], row]);
    assert.equal(problems.length, 1);
    assert.equal(problems[0].report, report.trim(), 'the whole report survives the split');
});

test('a weekly report far over the cell limit is accepted and still reads as JSON', () => {
    const { ctx, sheets, post } = load();
    const voices = Array.from({ length: 2000 }, (_, i) => `Microsoft Voice ${i} Online (Natural) [en-US]`);
    const payload = { sentAt: '2026-10-05T00:00:00Z', testerName: 'T', installId: 'i1', usage: {}, errors: [], systemInfo: { speech: { voices } } };
    assert.equal(post(payload), 'ok');
    const sheet = sheets[ctx.SHEET_NAME];
    const row = sheet.rows.at(-1);
    assert.equal(row.length, ctx.REPORT_HEADER.length);
    const { reports, broken } = readReports([sheet.rows[0], row]);
    assert.equal(broken.length, 0);
    assert.equal(reports.length, 1);
    assert.equal(reports[0].systemInfo.speech.voices.length, 2000);
});
