/**
 * Splits the server into a handful of files small enough to paste reliably.
 *
 * One 218 KB file is a single point of failure: a copy that silently drops
 * everything below the fold produces a file that looks fine and fails with
 * "unexpected end of input", which tells you nothing about what went wrong.
 *
 * Five files of roughly 45 KB each still fit one paste, and a short one that
 * fails is obvious immediately -- you can see the bottom of it.
 *
 *   node tools/build-split-bundle.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'apps-script');
const OUT = path.join(ROOT, 'deploy', 'split');

/* Split on source-file boundaries, never mid-function, and keep related code
 * together so a part is still readable on its own. */
const PARTS = [
  ['Part1_Core.gs',     ['00_Config.gs', '01_Store.gs', '02_Auth.gs']],
  ['Part2_People.gs',   ['03_People.gs', '04_Photos.gs', '05_Relations.gs']],
  ['Part3_Kinship.gs',  ['06_Kinship.gs', '07_Titles.gs']],
  ['Part4_Matching.gs', ['08_Matching.gs', '09_Merge.gs']],
  ['Part5_Admin.gs',    ['10_Admin.gs', '11_Api.gs']],
  ['Part6_Chart.gs',    ['12_Dev.gs', '13_Layout.gs']],
  ['Part7_Entry.gs',    ['14_Picker.gs', 'Code.gs']]
];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const rule = (name) =>
  '\n/* ================================================================== *\n' +
  ' * ' + name.padEnd(62) + ' *\n' +
  ' * ================================================================== */\n\n';

let total = 0;
PARTS.forEach(function (entry, index) {
  const [outName, sources] = entry;
  let body = [
    '/**',
    ' * Pokok Keluarga -- part ' + (index + 1) + ' of ' + PARTS.length + '.',
    ' *',
    ' * Apps Script loads every .gs file into one shared scope, so these parts',
    ' * work together exactly as one file would. Paste this one into a script',
    ' * file named ' + outName.replace('.gs', '') + '.',
    ' *',
    ' * Generated from apps-script/ by tools/build-split-bundle.js -- edit there.',
    ' */',
    ''
  ].join('\n');

  sources.forEach(function (file) {
    const full = path.join(SRC, file);
    if (!fs.existsSync(full)) throw new Error('Missing source: ' + file);
    body += rule(file) + fs.readFileSync(full, 'utf8').replace(/\s+$/, '') + '\n';
  });

  fs.writeFileSync(path.join(OUT, outName), body);
  const kb = Math.round(body.length / 1024);
  total += body.length;
  console.log('  ' + outName.padEnd(22) + String(kb).padStart(3) + ' KB   ' +
              String(body.split('\n').length).padStart(5) + ' lines');
});

fs.copyFileSync(path.join(SRC, 'appsscript.json'), path.join(OUT, 'appsscript.json'));
fs.copyFileSync(path.join(ROOT, 'deploy', 'Index.html'), path.join(OUT, 'Index.html'));

console.log('\n  ' + Math.round(total / 1024) + ' KB across ' + PARTS.length +
            ' script files, plus Index.html and the manifest.');
