/* Backs up the current Worldview Test Persona documents, then regenerates each
 * one from persona-data.js via generate-persona-docs.js so it mirrors About Me's
 * own structure. Run from the project root: node scripts/run-persona-docs.js
 */
const fs = require('fs');
const path = require('path');
const { Packer } = require('docx');
const { buildDoc } = require('./doc-generators/generate-persona-docs.js');
const { PERSONAS } = require('./doc-generators/persona-data.js');

const ROOT = path.join(__dirname, '..');
const PERSONAS_DIR = path.join(ROOT, 'Other', 'Personas');
const BACKUPS_DIR = path.join(ROOT, 'Documents', 'Doc Backups');

// id -> existing filename (kept identical so the reorganized doc replaces it in place)
const FILENAMES = {
    'marc-delgado': 'Worldview-Test-Persona-Marc-Delgado.docx',
    'diego-fuentes': 'Worldview-Test-Persona-Diego-Fuentes.docx',
    'emily-sorenson': 'Worldview-Test-Persona-Emily-Sorenson.docx',
    'grace-thompson': 'Worldview-Test-Persona-Grace-Thompson.docx',
    'hannah-goldberg': 'Worldview-Test-Persona-Hannah-Goldberg.docx',
    'jamal-carter': 'Worldview-Test-Persona-Jamal-Carter.docx',
    'liam-obrien': 'Worldview-Test-Persona-Liam-OBrien.docx',
    'noah-kim': 'Worldview-Test-Persona-Noah-Kim.docx',
    'priya-nair': 'Worldview-Test-Persona-Priya-Nair.docx',
    'sofia-reyes': 'Worldview-Test-Persona-Sofia-Reyes.docx',
};

function timestamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function main() {
    if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

    for (const p of PERSONAS) {
        const filename = FILENAMES[p.id];
        if (!filename) throw new Error(`No filename mapped for persona id "${p.id}"`);
        const target = path.join(PERSONAS_DIR, filename);

        if (fs.existsSync(target)) {
            const base = filename.replace(/\.docx$/, '');
            const backupPath = path.join(BACKUPS_DIR, `${base} ${timestamp()}.docx`);
            fs.copyFileSync(target, backupPath);
            console.log('Backed up ' + filename + ' -> ' + path.basename(backupPath));
        }

        const doc = buildDoc(p);
        const buf = await Packer.toBuffer(doc);
        fs.writeFileSync(target, buf);
        console.log('Wrote ' + filename + ' (' + buf.length + ' bytes)');
    }
}

main().catch((err) => { console.error(err); process.exit(1); });
