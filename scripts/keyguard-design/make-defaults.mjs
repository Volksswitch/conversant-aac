#!/usr/bin/env node
/*
 * make-defaults.mjs - copy Ken's default keyguard designer settings into the app.
 *
 * Usage: node scripts/keyguard-design/make-defaults.mjs [path to a designer .json]
 * With no path it reads scripts/keyguard-design/designer-defaults.json, a copy of the
 * file Ken saved from the keyguard designer (November 27 2026). Writes
 * app/js/keyguard-defaults.js, the starting point for "Save keyguard design".
 *
 * The file must hold exactly one set of settings, every value a string.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const srcPath = process.argv[2] || path.join(here, 'designer-defaults.json');
const src = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
const sets = Object.values(src.parameterSets || {});
if (sets.length !== 1) { console.error(`Expected one set of settings, found ${sets.length}.`); process.exit(1); }
const bad = Object.entries(sets[0]).filter(([, v]) => typeof v !== 'string').map(([k]) => k);
if (bad.length) { console.error('Not strings: ' + bad.join(', ')); process.exit(1); }

const out = `/*
 * keyguard-defaults.js - GENERATED from scripts/keyguard-design/designer-defaults.json
 * (Ken's default keyguard designer settings, November 27 2026). Do not edit by hand:
 * replace that file and run: node scripts/keyguard-design/make-defaults.mjs
 *
 * The starting point for "Save keyguard design"; keyguard-design.js fills in the rest.
 * Every value is a string, as the designer's parameter files store them.
 */
export const FILE_FORMAT_VERSION = ${JSON.stringify(String(src.fileFormatVersion || '1'))};
export const DESIGNER_DEFAULTS = Object.freeze(${JSON.stringify(sets[0], null, 4)});
`;
fs.writeFileSync(path.join(root, 'app', 'js', 'keyguard-defaults.js'), out);
console.log(`Wrote ${Object.keys(sets[0]).length} settings to app/js/keyguard-defaults.js`);
