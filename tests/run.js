/** Runs every test suite and fails the run if any of them fail. */
const { execFileSync } = require('child_process');
const path = require('path');

const suites = ['kinship.test.js', 'matching.test.js', 'settings.test.js', 'writes.test.js', 'layout.test.js', 'template.test.js'];
let failed = false;

for (const suite of suites) {
  try {
    process.stdout.write(execFileSync('node', [path.join(__dirname, suite)], { encoding: 'utf8' }));
  } catch (err) {
    process.stdout.write(err.stdout || '');
    process.stderr.write(err.stderr || '');
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
