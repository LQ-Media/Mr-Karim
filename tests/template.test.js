/**
 * The HTML templates.
 *
 * Apps Script compiles every scriptlet it finds in a template into JavaScript
 * before running it -- including ones inside comments, because the engine scans
 * the raw file and knows nothing about HTML or JavaScript syntax.
 *
 * An empty scriptlet compiles to a broken statement, and the resulting
 * SyntaxError is reported against whichever line called evaluate(), which can
 * be in a different file entirely. That cost a long afternoon: the error
 * pointed at a line of valid JavaScript, moved faithfully every time that line
 * moved, and survived four rewrites of code that was never the problem.
 *
 * Node cannot catch this -- it is HTML, and the fault only appears when Apps
 * Script compiles it -- so it is checked here.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'apps-script');
const SCRIPTLET = /<\?([\s\S]*?)\?>/g;

let pass = 0;
const failures = [];

for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.html'))) {
  const src = fs.readFileSync(path.join(DIR, file), 'utf8');
  const lines = src.split('\n');
  let match;

  while ((match = SCRIPTLET.exec(src)) !== null) {
    const line = src.slice(0, match.index).split('\n').length;
    // Strip the leading = or != that marks an output scriptlet.
    const body = match[1].replace(/^!?=/, '').trim();

    if (!body) {
      failures.push(
        `${file}:${line} -- empty scriptlet ${JSON.stringify(match[0])}\n` +
        `      ${lines[line - 1].trim()}\n` +
        '      Apps Script compiles this into a broken statement. If you are\n' +
        '      writing ABOUT scriptlets, describe them in words instead.');
    } else {
      pass++;
    }
  }

  // Every variable a template reads must be assigned before evaluate().
  const assigned = new Set(
    [...fs.readFileSync(path.join(DIR, 'Code.gs'), 'utf8')
      .matchAll(/template\.([A-Za-z_]\w*)\s*=/g)].map((m) => m[1]));

  const used = new Set();
  let ref;
  const REF = /<\?!?=\s*(?:JSON\.stringify\()?\s*([A-Za-z_]\w*)/g;
  while ((ref = REF.exec(src)) !== null) used.add(ref[1]);

  for (const name of used) {
    if (name === 'include') continue;
    if (assigned.has(name)) {
      pass++;
    } else {
      failures.push(
        `${file} -- reads '${name}', which doGet never assigns.\n` +
        "      JSON.stringify(undefined) emits nothing, so the generated line\n" +
        "      becomes 'var X = ;' and the template fails to compile.");
    }
  }
}

console.log(`\ntemplate: ${pass} passed, ${failures.length} failed\n`);
if (failures.length) {
  failures.forEach((f) => console.log('  FAIL  ' + f));
  process.exit(1);
}
