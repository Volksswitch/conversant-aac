/* Regenerates the LAYOUTS blob embedded in express-bands.html from the app's real
 * keyboard layouts, so the prototype's grid is the grid the app actually draws.
 *
 * The prototype is opened by double-clicking it, and a file:// page cannot import a
 * module - so the geometry has to be embedded rather than imported. This keeps the
 * embedded copy honest: run it after any change to app/js/keyboard-layouts.js.
 *
 * Only GEOMETRY is taken: how many cells a row has, how wide each is, and which one
 * is the space cell (which the app renders as "In my own words"). The letters are of
 * no interest to a panel prototype.
 *
 * Run: node prototypes/refresh-layouts.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { LAYOUTS, panelRoles } from '../app/js/keyboard-layouts.js';

const out = {};
for (const [id, def] of Object.entries(LAYOUTS)) {
    out[id] = {
        name: def.name,
        dock: def.dock,
        // ⚠ The roles come from the APP's own panelRoles(), not from a rule restated
        // here. The prototype exists to show what the panel does, so a second opinion
        // about which cell is "In my own words" would make it lie - which it briefly
        // did, drawing two compose buttons on the split keyboard exactly as the app
        // used to.
        rows: panelRoles(def.rows),
    };
}

const file = new URL('./express-bands.html', import.meta.url);
const html = readFileSync(file, 'utf8');
const START = '/* LAYOUTS-START */', END = '/* LAYOUTS-END */';
const a = html.indexOf(START), b = html.indexOf(END);
if (a < 0 || b < 0) { console.error('markers not found in express-bands.html'); process.exit(1); }
const blob = START + '\nconst LAYOUTS = ' + JSON.stringify(out) + ';\n' + END;
writeFileSync(file, html.slice(0, a) + blob + html.slice(b + END.length), 'utf8');

const n = Object.keys(out).length;
console.log(`embedded ${n} layouts (${Object.values(out).filter(l => l.dock === 'side').length} side, ` +
            `${Object.values(out).filter(l => l.dock === 'bottom').length} bottom)`);
for (const [id, l] of Object.entries(out)) {
    const cells = l.rows.flat().filter(c => c.role === 'position').length;
    const space = l.rows.flat().some(c => c.role === 'compose');
    console.log(`  ${id.padEnd(4)} ${l.name.padEnd(28)} ${l.rows.length} rows, ${cells} button positions` +
                (space ? '' : '  [NO SPACE CELL]'));
}
