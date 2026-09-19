/**
 * Builds the browser prototype.
 *
 * The prototype exists so the interface and the kinship titles can be judged
 * before anything is deployed to Apps Script. It embeds the real engine sources
 * rather than a simplified copy, so it cannot quietly drift away from what the
 * deployed app actually does.
 *
 *   node tools/build-prototype.js [output.html]
 */
const fs = require('fs');
const path = require('path');
const { buildFamily } = require('../tests/fixtures');

const ROOT = path.join(__dirname, '..');
const ENGINE = ['05_Relations.gs', '06_Kinship.gs', '07_Titles.gs', '08_Matching.gs'];
const output = process.argv[2] || path.join(ROOT, 'tools', 'prototype.html');

const shell = fs.readFileSync(path.join(ROOT, 'tools', 'prototype-shell.html'), 'utf8');

const engine = ENGINE.map(function (file) {
  const src = fs.readFileSync(path.join(ROOT, 'apps-script', file), 'utf8')
    // The Node export footers mean nothing in a browser.
    .replace(/if \(typeof module !== 'undefined'[\s\S]*?\n}\n/, '');
  return '/* ===== ' + file + ' ===== */\n' + src;
}).join('\n');

const [head, rest] = splitOnce(shell, '<script>');
const cut = rest.lastIndexOf('</script>');
const bodyJs = rest.slice(0, cut);
const tail = rest.slice(cut + '</script>'.length);

const page = head +
  '<script>\nvar FAMILY = ' + JSON.stringify(buildFamily()) + ';\n' + engine + '</script>\n' +
  '<script>' + bodyJs + '</script>' + tail;

fs.writeFileSync(output, page);
console.log('Built ' + path.relative(ROOT, output) + ' (' + Math.round(page.length / 1024) + ' KB)');

function splitOnce(text, marker) {
  const i = text.indexOf(marker);
  return [text.slice(0, i), text.slice(i + marker.length)];
}
