/**
 * Spreadsheet access.
 *
 * Everything reads whole tabs at once and writes in batches. Apps Script
 * charges roughly the same for reading one cell as for reading a thousand, so
 * per-row access is what makes these apps feel slow; the whole family is
 * cheaper to fetch in one call and index in memory.
 */

function ST_props() {
  return PropertiesService.getScriptProperties();
}

function ST_spreadsheet() {
  var id = ST_props().getProperty(CFG.PROP_SHEET_ID);
  if (!id) throw new Error('Not installed yet. Run installFamilyTree() from the editor.');
  return SpreadsheetApp.openById(id);
}

function ST_sheet(name) {
  var sheet = ST_spreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('Missing tab: ' + name + '. Re-run installFamilyTree().');
  return sheet;
}

/**
 * Creates any missing tab and appends any missing column.
 *
 * Safe to run repeatedly. Columns are only ever added, never moved or removed,
 * so a schema change in a later version cannot destroy data already entered.
 */
function ST_bootstrap(spreadsheet) {
  for (var name in SCHEMA) {
    if (!Object.prototype.hasOwnProperty.call(SCHEMA, name)) continue;
    var wanted = SCHEMA[name];
    var sheet = spreadsheet.getSheetByName(name);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(name);
      sheet.getRange(1, 1, 1, wanted.length).setValues([wanted]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, wanted.length).setFontWeight('bold');
      continue;
    }

    var lastColumn = Math.max(sheet.getLastColumn(), 1);
    var existing = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    var missing = [];
    for (var i = 0; i < wanted.length; i++) {
      if (existing.indexOf(wanted[i]) === -1) missing.push(wanted[i]);
    }
    if (missing.length) {
      sheet.getRange(1, lastColumn + 1, 1, missing.length).setValues([missing]);
      sheet.getRange(1, 1, 1, lastColumn + missing.length).setFontWeight('bold');
    }
    sheet.setFrozenRows(1);
  }

  var defaultSheet = spreadsheet.getSheetByName('Sheet1');
  if (defaultSheet && spreadsheet.getSheets().length > 1) spreadsheet.deleteSheet(defaultSheet);
}

/** Reads a whole tab as row objects keyed by header name. */
function ST_readAll(name) {
  var sheet = ST_sheet(name);
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) return [];

  var values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  var headers = values[0];
  var rows = [];

  for (var r = 1; r < values.length; r++) {
    var row = {};
    var empty = true;
    for (var c = 0; c < headers.length; c++) {
      if (!headers[c]) continue;
      var value = values[r][c];
      if (value instanceof Date) value = ST_toIsoDate(value);
      else if (value !== '' && value !== null) empty = false;
      row[headers[c]] = value === null ? '' : value;
    }
    if (!empty) {
      row.__row = r + 1; // The physical sheet row, for targeted updates.
      rows.push(row);
    }
  }
  return rows;
}

/** Dates come back from Sheets as Date objects in the script's timezone; the
 *  rest of the app compares them as plain ISO strings. */
function ST_toIsoDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function ST_now() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}

function ST_headers(name) {
  var sheet = ST_sheet(name);
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

/** Appends one row, filling only the columns present in the object. */
function ST_append(name, obj) {
  var sheet = ST_sheet(name);
  var headers = ST_headers(name);
  var row = [];
  for (var i = 0; i < headers.length; i++) {
    row.push(obj[headers[i]] === undefined ? '' : obj[headers[i]]);
  }
  sheet.appendRow(row);
  ST_invalidate();
  return obj;
}

/** Appends many rows in one write. */
function ST_appendMany(name, objects) {
  if (!objects.length) return;
  var sheet = ST_sheet(name);
  var headers = ST_headers(name);
  var rows = [];
  for (var i = 0; i < objects.length; i++) {
    var row = [];
    for (var c = 0; c < headers.length; c++) {
      row.push(objects[i][headers[c]] === undefined ? '' : objects[i][headers[c]]);
    }
    rows.push(row);
  }
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  ST_invalidate();
}

/**
 * Updates the row whose key column holds `keyValue`, writing only the supplied
 * fields. Returns false when no such row exists.
 */
function ST_update(name, keyColumn, keyValue, changes) {
  var sheet = ST_sheet(name);
  var headers = ST_headers(name);
  var keyIndex = headers.indexOf(keyColumn);
  if (keyIndex === -1) throw new Error('No column ' + keyColumn + ' on ' + name);

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  var keys = sheet.getRange(2, keyIndex + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]) !== String(keyValue)) continue;

    var rowNumber = i + 2;
    var current = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
    for (var field in changes) {
      if (!Object.prototype.hasOwnProperty.call(changes, field)) continue;
      var column = headers.indexOf(field);
      if (column !== -1) current[column] = changes[field];
    }
    sheet.getRange(rowNumber, 1, 1, headers.length).setValues([current]);
    ST_invalidate();
    return true;
  }
  return false;
}

/**
 * The next id for a table, as a zero-padded string.
 *
 * Ids are taken from the highest existing number rather than the row count, so
 * that a merged or hidden row never causes an id to be handed out twice.
 */
function ST_nextId(name) {
  var prefix = ID_PREFIX[name] || 'X';
  var sheet = ST_sheet(name);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return prefix + '00001';

  var idColumn = ST_headers(name).indexOf(SCHEMA[name][0]) + 1;
  var values = sheet.getRange(2, idColumn, lastRow - 1, 1).getValues();
  var highest = 0;
  for (var i = 0; i < values.length; i++) {
    var digits = String(values[i][0]).replace(/\D/g, '');
    var n = parseInt(digits, 10);
    if (!isNaN(n) && n > highest) highest = n;
  }
  var next = String(highest + 1);
  while (next.length < 5) next = '0' + next;
  return prefix + next;
}

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

function ST_settings() {
  var rows = ST_readAll('Settings');
  var out = {};
  for (var key in DEFAULT_SETTINGS) {
    if (Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) out[key] = DEFAULT_SETTINGS[key];
  }
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].key) out[rows[i].key] = rows[i].value;
  }
  return out;
}

function ST_setSetting(key, value) {
  if (!ST_update('Settings', 'key', key, { value: value })) {
    ST_append('Settings', { key: key, value: value });
  }
  ST_invalidate();
}

/* ------------------------------------------------------------------ *
 * Graph cache
 * ------------------------------------------------------------------ */

/**
 * The relationship graph, from cache when possible.
 *
 * Rebuilding means reading four tabs and indexing them, which is fast but not
 * free, and the home screen alone needs the graph for every card it draws.
 * Any write invalidates the cache rather than trying to patch it -- a stale
 * tree is a wrong tree, and correctness is worth one extra read.
 */
function ST_graph() {
  var cached = ST_cacheGet(CFG.CACHE_GRAPH_KEY);
  if (cached) {
    try {
      return REL_buildGraph(JSON.parse(cached));
    } catch (err) {
      ST_invalidate();
    }
  }

  var data = {
    people: ST_readAll('People'),
    parentage: ST_readAll('Parentage'),
    unions: ST_readAll('Unions'),
    customTitles: ST_readAll('CustomTitles')
  };
  ST_cachePut(CFG.CACHE_GRAPH_KEY, JSON.stringify(data));
  return REL_buildGraph(data);
}

function ST_invalidate() {
  try {
    var cache = CacheService.getScriptCache();
    var keys = [CFG.CACHE_GRAPH_KEY + '_meta'];
    for (var i = 0; i < CFG.CACHE_MAX_CHUNKS; i++) keys.push(CFG.CACHE_GRAPH_KEY + '_' + i);
    cache.removeAll(keys);
  } catch (err) {
    // A cache that cannot be cleared only costs a rebuild; never fail a write for it.
  }
}

/** Cache entries are capped at 100KB each, so anything larger is chunked. */
function ST_cachePut(key, text) {
  try {
    var cache = CacheService.getScriptCache();
    var chunks = [];
    for (var i = 0; i < text.length; i += CFG.CACHE_CHUNK_BYTES) {
      chunks.push(text.substring(i, i + CFG.CACHE_CHUNK_BYTES));
    }
    if (chunks.length > CFG.CACHE_MAX_CHUNKS) return; // Too big to cache; read through instead.

    var entries = {};
    for (var c = 0; c < chunks.length; c++) entries[key + '_' + c] = chunks[c];
    entries[key + '_meta'] = String(chunks.length);
    cache.putAll(entries, CFG.CACHE_SECONDS);
  } catch (err) {
    // Caching is an optimisation. Losing it must never lose a request.
  }
}

function ST_cacheGet(key) {
  try {
    var cache = CacheService.getScriptCache();
    var count = cache.get(key + '_meta');
    if (!count) return null;

    var wanted = [];
    for (var i = 0; i < Number(count); i++) wanted.push(key + '_' + i);
    var parts = cache.getAll(wanted);

    var text = '';
    for (var j = 0; j < wanted.length; j++) {
      if (parts[wanted[j]] === undefined) return null; // A chunk expired; treat as a miss.
      text += parts[wanted[j]];
    }
    return text;
  } catch (err) {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Audit
 * ------------------------------------------------------------------ */

function ST_audit(actorEmail, action, entity, entityId, detail) {
  try {
    ST_append('AuditLog', {
      log_id: ST_nextId('AuditLog'),
      ts: ST_now(),
      actor_email: actorEmail || '',
      action: action,
      entity: entity || '',
      entity_id: entityId || '',
      detail_json: detail ? JSON.stringify(detail).substring(0, 40000) : ''
    });
  } catch (err) {
    // The log is a record, not a gate. A failure to write it must not roll back
    // the change it was describing.
  }
}
