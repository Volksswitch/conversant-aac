#!/usr/bin/env node
/*
 * check-in-designer.mjs - prove the keyguard designer reads a "Save keyguard design"
 * file (Ken, November 27 2026). Trigger phrase: "check keyguard design".
 *
 * Builds two sample designs with the app's own code (a listed tablet, and an "other
 * tablet" from a card measurement), runs each through OpenSCAD with the keyguard
 * designer, and reports what the designer says about them: the tablet it used, the
 * openings it read, and any warning. Needs OpenSCAD installed in Program Files and the
 * Keyguard project folder beside this one (found from the OneDrive folder).
 *
 * Usage: node scripts/keyguard-design/check-in-designer.mjs [path to keyguard.scad]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildDesign } from '../../app/js/keyguard-design.js';

const scad = process.argv[2] || path.join(process.env.OneDrive || '', '4 T-Z', 'Volksswitch',
    'Keyguard', 'My SCAD files', 'keyguard designer', 'keyguard.scad');
const openscad = ['C:/Program Files/OpenSCAD/openscad.com', 'C:/Program Files (x86)/OpenSCAD/openscad.com']
    .find((p) => fs.existsSync(p));
if (!openscad || !fs.existsSync(scad)) {
    console.error(`Need OpenSCAD and the designer.\n  OpenSCAD: ${openscad || 'not found'}\n  designer: ${scad}`);
    process.exit(1);
}

const openings = [
    '[ "Transcript", "r", 300, 1500, 10, 800, 200, 0, "C", "T", 0, 0, [], [] ],',
    '[ "Yes", "r", 120, 200, 12, 300, 1200, 0, "C", "T", 0, 0, [], [] ],',
];
const date = new Date(2026, 10, 27);
const designs = [
    buildDesign({ choice: { kind: 'tablet', name: 'iPad 10th generation' }, landscape: true,
        openings, screen: { long: 2360, short: 1640 }, mmPerPx: 0.0962, date }),
    buildDesign({ choice: { kind: 'card' }, landscape: true,
        openings, screen: { long: 1920, short: 1080 }, mmPerPx: 0.1166, date }),
];

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kg-design-'));
// A small file that loads the designer and then reports what it made of the settings:
// how many screen openings it read, the first one, and the screen it is using (width
// and height in pixels, and mm per pixel). The settings file's values replace the
// designer's own, exactly as when a person opens the file in the designer.
const wrapper = path.join(dir, 'report.scad');
fs.writeFileSync(wrapper, `include <${scad.split(path.sep).join('/')}>\n`
    + 'echo(CHECK_openings = len(m_s_o), CHECK_first = m_s_o[0]);\n'
    + 'echo(CHECK_tablet = type_of_tablet, CHECK_orientation = orientation, CHECK_screen_px = [swp, shp], CHECK_mm_per_px = mpp);\n');
let failed = false;
for (const d of designs) {
    const file = path.join(dir, d.fileName);
    fs.writeFileSync(file, d.json);
    const out = path.join(dir, 'out.echo');
    let log = '';
    try {
        execFileSync(openscad, ['-o', out, '-p', file, '-P', d.name, wrapper],
            { stdio: ['ignore', 'pipe', 'pipe'], timeout: 600000 });
        log = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
    } catch (err) {
        log = String(err.stderr || err.message);
        failed = true;
    }
    // OpenSCAD's own note about the viewer is not about the design.
    const warnings = log.split(/\r?\n/).filter((l) => /WARNING|ERROR/i.test(l) && !/Viewall and autocenter/.test(l));
    const echoes = log.split(/\r?\n/).filter((l) => /CHECK_/.test(l));
    console.log(`\n== ${d.name}`);
    for (const l of echoes) console.log('  ' + l.slice(0, 200));
    for (const l of warnings.slice(0, 10)) console.log('  ' + l.slice(0, 200));
    const read = (log.match(/CHECK_openings = (\d+)/) || [])[1];
    if (Number(read) !== openings.length) {
        console.log(`  the designer read ${read ?? 'no'} openings, not ${openings.length}`);
        failed = true;
    }
    if (warnings.length) failed = true;
    if (!warnings.length) console.log('  no warnings');
}
console.log(`\nFiles kept in ${dir}`);
process.exit(failed ? 1 : 0);
