/**
 * Builds the canvas prototype.
 *
 * Embeds the real engine sources -- graph, kinship, titles, layout -- so the
 * chart in the browser is positioned and labelled by exactly the code the
 * deployed app runs.
 *
 *   node tools/build-map-prototype.js [output.html] [--fixture]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ENGINE = ['05_Relations.gs', '06_Kinship.gs', '07_Titles.gs',
                '08_Matching.gs', '13_Layout.gs'];

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const useFixture = process.argv.includes('--fixture');
const output = args[0] || path.join(ROOT, 'tools', 'map-prototype.html');

const { buildFamily } = require(
  useFixture ? '../tests/fixtures' : './salim-family');

const shell = fs.readFileSync(path.join(ROOT, 'tools', 'map-shell.html'), 'utf8');

const engine = ENGINE.map(function (file) {
  const src = fs.readFileSync(path.join(ROOT, 'apps-script', file), 'utf8')
    .replace(/if \(typeof module !== 'undefined'[\s\S]*?\n}\n/, '');
  return '/* ===== ' + file + ' ===== */\n' + src;
}).join('\n');

const marker = '<script>';
const head = shell.slice(0, shell.indexOf(marker));
const rest = shell.slice(shell.indexOf(marker) + marker.length);
const cut = rest.lastIndexOf('</script>');

const page = head +
  '<script>\nvar FAMILY = ' + JSON.stringify(buildFamily()) + ';\n' + engine + '</script>\n' +
  '<script>' + rest.slice(0, cut) + '</script>' + rest.slice(cut + '</script>'.length);

fs.writeFileSync(output, page);
console.log('Built ' + path.relative(ROOT, output) + ' (' + Math.round(page.length / 1024) + ' KB)');
