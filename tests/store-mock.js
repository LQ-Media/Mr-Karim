/**
 * An in-memory stand-in for the spreadsheet.
 *
 * The write paths -- creating people, batch entry, reordering, merging -- are
 * the ones that can damage a family's data, and until now they were the only
 * ones with no tests, because they talk to Apps Script APIs that do not exist
 * under Node. This supplies just enough of that surface to exercise the real
 * logic: the same 03/09/10 sources run, against tables held in memory.
 */
const { loadEngine } = require('./harness');

function install(sandbox, seed) {
  const tables = {};
  for (const name of Object.keys(sandbox.SCHEMA)) tables[name] = [];

  (seed.people || []).forEach((r) => tables.People.push(Object.assign({}, r)));
  (seed.parentage || []).forEach((r) => tables.Parentage.push(Object.assign({}, r)));
  (seed.unions || []).forEach((r) => tables.Unions.push(Object.assign({}, r)));

  let uuid = 0;
  let locksHeld = 0;
  const audit = [];

  sandbox.ST_readAll = (name) => (tables[name] || []).map((r) => Object.assign({}, r));

  sandbox.ST_append = (name, obj) => { tables[name].push(Object.assign({}, obj)); return obj; };

  sandbox.ST_appendMany = (name, objs) =>
    objs.forEach((o) => tables[name].push(Object.assign({}, o)));

  sandbox.ST_update = (name, keyColumn, keyValue, changes) => {
    const row = tables[name].find((r) => String(r[keyColumn]) === String(keyValue));
    if (!row) return false;
    Object.assign(row, changes);
    return true;
  };

  sandbox.ST_nextId = (name) => {
    const prefix = sandbox.ID_PREFIX[name] || 'X';
    const key = sandbox.SCHEMA[name][0];
    let highest = 0;
    for (const row of tables[name]) {
      const n = parseInt(String(row[key]).replace(/\D/g, ''), 10);
      if (!isNaN(n) && n > highest) highest = n;
    }
    return prefix + String(highest + 1).padStart(5, '0');
  };

  sandbox.ST_now = () => '2026-01-01T00:00:00';
  sandbox.ST_invalidate = () => {};
  sandbox.ST_audit = (actor, action, entity, id, detail) =>
    audit.push({ actor, action, entity, id, detail });

  const settings = Object.assign({}, sandbox.DEFAULT_SETTINGS);
  sandbox.ST_settings = () => Object.assign({}, settings);
  sandbox.ST_setSetting = (k, v) => { settings[k] = v; };
  sandbox.ST_props = () => ({ getProperty: () => '', setProperty: () => {} });

  sandbox.ST_graph = () => sandbox.REL_buildGraph({
    people: sandbox.ST_readAll('People'),
    parentage: sandbox.ST_readAll('Parentage'),
    unions: sandbox.ST_readAll('Unions'),
    customTitles: sandbox.ST_readAll('CustomTitles')
  });

  // Taking the script lock twice in one execution is not reliably reentrant in
  // Apps Script. Failing loudly here is the point of the mock.
  sandbox.LockService = {
    getScriptLock: () => ({
      waitLock() {
        locksHeld += 1;
        if (locksHeld > 1) throw new Error('script lock taken twice in one execution');
      },
      releaseLock() { locksHeld -= 1; }
    })
  };

  sandbox.Utilities = { getUuid: () => 'uuid-' + (++uuid) };
  sandbox.Session = { getScriptTimeZone: () => 'Asia/Singapore' };
  sandbox.ScriptApp = { getService: () => ({ getUrl: () => 'https://example.test/exec' }) };

  return { tables, audit, settings, locks: () => locksHeld };
}

/** A sandbox with the business logic loaded over an in-memory store. */
function makeApp(seed) {
  const sandbox = loadEngine([
    '00_Config.gs', '05_Relations.gs', '06_Kinship.gs', '07_Titles.gs',
    '08_Matching.gs', '02_Auth.gs', '03_People.gs', '09_Merge.gs', '10_Admin.gs',
    '11_Api.gs'
  ]);
  const store = install(sandbox, seed);
  return { env: sandbox, store };
}

const ADMIN = { email: 'admin@example.test', personId: 'P041', role: 'owner',
                lang: 'ms', isAdmin: true, isPending: false, canInvite: true };

module.exports = { makeApp, ADMIN };
