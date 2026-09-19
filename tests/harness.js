/**
 * Loads the Apps Script sources into a single sandbox so the Node test suite
 * runs the exact same code the deployed app runs. No parallel implementation to
 * drift out of sync.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'apps-script');

function loadEngine(files) {
  const sandbox = { console, Math, JSON, Date, Number, String, Object, Array, isNaN, parseInt, parseFloat };
  sandbox.global = sandbox;
  vm.createContext(sandbox);
  for (const file of files) {
    const code = fs.readFileSync(path.join(SRC, file), 'utf8');
    vm.runInContext(code, sandbox, { filename: file });
  }
  return sandbox;
}

module.exports = { loadEngine };
