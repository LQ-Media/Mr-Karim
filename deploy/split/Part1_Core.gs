/**
 * Pokok Keluarga -- part 1 of 7.
 *
 * Apps Script loads every .gs file into one shared scope, so these parts
 * work together exactly as one file would. Paste this one into a script
 * file named Part1_Core.
 *
 * Generated from apps-script/ by tools/build-split-bundle.js -- edit there.
 */

/* ================================================================== *
 * 00_Config.gs                                                   *
 * ================================================================== */

/**
 * Configuration and the sheet schema.
 *
 * The schema lives here rather than in the spreadsheet so that a fresh install
 * builds its own tabs and headers. Nobody should have to prepare a spreadsheet
 * by hand before the app will run, and nobody should have to keep one in sync
 * with the code afterwards.
 */

var CFG = {
  APP_NAME: 'Pokok Keluarga',
  SCHEMA_VERSION: 1,

  /* Property keys. Set once at install, read on every request. */
  PROP_SHEET_ID: 'FAMILY_SHEET_ID',
  PROP_FOLDER_ID: 'PHOTO_FOLDER_ID',
  PROP_CLIENT_ID: 'OAUTH_CLIENT_ID',
  PROP_OWNER_EMAIL: 'OWNER_EMAIL',

  CACHE_GRAPH_KEY: 'graph_v1',
  CACHE_SECONDS: 300,

  /* Google caps a single cache entry at 100KB, so a large tree is split across
   * numbered chunks and reassembled on read. */
  CACHE_CHUNK_BYTES: 90000,
  CACHE_MAX_CHUNKS: 40,

  PHOTO_MAX_BYTES: 8 * 1024 * 1024,
  PHOTO_MAX_EDGE: 1200,

  ROLES: ['owner', 'admin', 'member', 'pending', 'blocked'],
  LANGS: ['ms', 'en', 'ar']
};

/**
 * Every tab, in the order they are created, with their columns.
 *
 * Adding a column here and redeploying is enough: the bootstrap appends any
 * header the sheet does not already have, and never reorders or removes the
 * ones that are there, so existing data survives a schema change.
 */
var SCHEMA = {
  People: ['person_id', 'display_name', 'full_name', 'given_name', 'patronym',
    'patronym_type', 'also_known_as', 'honorific', 'gender', 'birth_date',
    'birth_precision', 'birth_place', 'birth_order', 'birth_order_source',
    'is_living', 'death_date', 'death_precision', 'death_place', 'burial_place',
    'email', 'mobile', 'address', 'country', 'occupation', 'notes',
    'photo_file_id', 'photo_thumb_id', 'map_x', 'map_y',
    'status', 'merged_into_id',
    'created_by', 'created_at', 'updated_by', 'updated_at'],

  Parentage: ['link_id', 'child_id', 'parent_id', 'parent_role', 'relation_type',
    'status', 'created_by', 'created_at'],

  Unions: ['union_id', 'partner_a_id', 'partner_b_id', 'union_type', 'status',
    'start_date', 'end_date', 'place', 'order_index', 'notes',
    'created_by', 'created_at'],

  Users: ['email', 'person_id', 'role', 'lang_pref', 'can_invite', 'invited_by',
    'invited_at', 'last_login_at', 'status'],

  Invites: ['invite_id', 'email', 'token', 'prebind_person_id', 'invited_by',
    'created_at', 'expires_at', 'used_at', 'status'],

  PendingChanges: ['change_id', 'kind', 'target_id', 'payload_json', 'summary',
    'requested_by', 'requested_at', 'status', 'reviewed_by', 'reviewed_at',
    'review_note'],

  MergeQueue: ['candidate_id', 'person_a_id', 'person_b_id', 'score',
    'signals_json', 'detected_at', 'status', 'resolved_by', 'resolved_at'],

  CustomTitles: ['title_id', 'from_person_id', 'to_person_id', 'custom_label',
    'lang', 'created_by', 'created_at'],

  AuditLog: ['log_id', 'ts', 'actor_email', 'action', 'entity', 'entity_id',
    'detail_json'],

  Settings: ['key', 'value']
};

/** Seeded on first run so the owner can change behaviour without editing code. */
var DEFAULT_SETTINGS = {
  family_name: 'Keluarga',
  birth_order_titles: 'Long,Ngah,Alang,Anjang,Andak,Uda,Uteh',
  merge_auto_threshold: '92',
  merge_queue_threshold: '68',
  match_suggest_threshold: '55',
  default_lang: 'ms',
  allow_member_invites: 'TRUE',
  invite_expiry_days: '30',
  /* Off by default. Reading someone's Google Photos is a sensitive scope, so
   * switching this on has consequences for the OAuth consent screen that the
   * owner should choose deliberately -- see docs/GOOGLE-PHOTOS.md. */
  enable_google_photos: 'FALSE'
};

/** The id prefix each table counts from. */
var ID_PREFIX = {
  People: 'P', Parentage: 'L', Unions: 'U', Invites: 'I',
  PendingChanges: 'C', MergeQueue: 'M', CustomTitles: 'T', AuditLog: 'A'
};

/* ================================================================== *
 * 01_Store.gs                                                    *
 * ================================================================== */

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

/* ================================================================== *
 * 02_Auth.gs                                                     *
 * ================================================================== */

/**
 * Authentication and permissions.
 *
 * The script is deployed to execute as its owner, so the Sheet and the photo
 * folder are never shared with relatives -- they reach the data only through
 * this code. That choice rules out Apps Script's own Session.getActiveUser():
 * when a script runs as its owner, that call returns an empty string for any
 * visitor outside the owner's Workspace domain, which is exactly who the
 * relatives will be.
 *
 * It also rules out the Google Identity Services button, for a less obvious
 * reason. Apps Script serves its pages inside a sandbox iframe on a generated
 * googleusercontent.com origin that changes between deployments, and Google
 * Identity Services will only run on JavaScript origins registered in advance.
 * There is no origin to register.
 *
 * So sign-in is done the long way round, which turns out to be the robust way.
 * The visitor is sent to Google at the top level, Google returns them to this
 * web app's own /exec URL -- a fixed, registerable address -- and the
 * authorization code is exchanged for an identity server-side, where the client
 * secret can safely live. The result is a signed session token that the browser
 * presents on every later call.
 */

var AUTH_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
var AUTH_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
var AUTH_SESSION_HOURS = 12;
var AUTH_STATE_MINUTES = 120;

/* Reading someone's Google Photos needs its own consent, asked for only when
 * they actually reach for it. Signing in to look at the family tree should not
 * demand access to a person's photo library. */
var AUTH_PHOTOS_SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';

/* ------------------------------------------------------------------ *
 * The sign-in round trip
 * ------------------------------------------------------------------ */

function AUTH_clientId() {
  var id = ST_props().getProperty(CFG.PROP_CLIENT_ID);
  if (!id) throw new Error('Sign-in is not configured yet. See docs/SETUP.md.');
  return id;
}

function AUTH_redirectUri() {
  return ScriptApp.getService().getUrl();
}

/**
 * Where to send someone to sign in.
 *
 * `state` is signed and timestamped so a callback that did not originate here
 * is rejected -- without it, a link could walk a signed-in visitor through a
 * sign-in they did not start.
 */
function AUTH_signInUrl() {
  return AUTH_buildAuthUrl('openid email profile', { purpose: 'signin' });
}

/**
 * Consent to read the photos this person picks.
 *
 * Asked for separately, and only at the moment somebody chooses to add a photo
 * from Google Photos. The state carries which person the photo is for, so the
 * app can carry on where it left off when Google sends them back.
 *
 * No session token goes into this URL. It would travel through Google's
 * redirect and land in browser history; the browser already holds the session
 * and picks it up again when the page reloads.
 */
function AUTH_photosAuthUrl(personId) {
  return AUTH_buildAuthUrl('openid email ' + AUTH_PHOTOS_SCOPE,
    { purpose: 'photos', personId: String(personId || '') });
}

function AUTH_buildAuthUrl(scope, statePayload) {
  var params = {
    client_id: AUTH_clientId(),
    redirect_uri: AUTH_redirectUri(),
    response_type: 'code',
    scope: scope,
    state: AUTH_makeState(statePayload),
    include_granted_scopes: 'true'
  };
  var parts = [];
  for (var key in params) {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      parts.push(key + '=' + encodeURIComponent(params[key]));
    }
  }
  return AUTH_AUTH_ENDPOINT + '?' + parts.join('&');
}

function AUTH_makeState(payload) {
  var state = { n: Utilities.getUuid(), exp: AUTH_epoch() + AUTH_STATE_MINUTES * 60 };
  for (var key in (payload || {})) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) state[key] = payload[key];
  }
  return AUTH_sign(state);
}

/**
 * Handles Google's redirect back to the app.
 *
 * The authorization code is exchanged over TLS directly with Google's token
 * endpoint, so the identity in the response is trustworthy without verifying
 * the JWT signature ourselves -- but the audience and expiry are still checked,
 * because a token minted for a different application must never be accepted.
 */
function AUTH_completeSignIn(code, state) {
  var checkedState = AUTH_verify(state);
  if (!checkedState) throw new Error('That sign-in link has expired. Please try again.');
  if (checkedState.purpose === 'photos') throw new Error('That link was for photos, not sign-in.');

  var body = AUTH_exchangeCode(code);
  if (!body.id_token) throw new Error('Google did not return an identity.');

  var claims = AUTH_readIdToken(body.id_token);
  if (claims.aud !== AUTH_clientId()) throw new Error('Sign-in rejected.');
  if (String(claims.email_verified) !== 'true') throw new Error('Your Google email is not verified.');
  if (Number(claims.exp) <= AUTH_epoch()) throw new Error('That sign-in has already expired.');

  return AUTH_sign({
    email: String(claims.email).toLowerCase(),
    name: claims.name || '',
    picture: claims.picture || '',
    exp: AUTH_epoch() + AUTH_SESSION_HOURS * 3600
  });
}

/** Reads the claims out of a JWT that Google just handed us over TLS. */
function AUTH_readIdToken(idToken) {
  var parts = String(idToken).split('.');
  if (parts.length !== 3) throw new Error('Google returned an identity we could not read.');
  var payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  while (payload.length % 4) payload += '=';
  return JSON.parse(Utilities.newBlob(Utilities.base64Decode(payload)).getDataAsString());
}

/**
 * Completes the Google Photos consent and keeps the resulting access token.
 *
 * Held in the cache against the person's email for slightly less than its own
 * lifetime, and never written to the spreadsheet: it is a key to somebody's
 * entire photo library and has no business outliving the few minutes it is
 * needed for.
 */
function AUTH_completePhotosGrant(code, state) {
  var checked = AUTH_verify(state);
  if (!checked || checked.purpose !== 'photos') {
    throw new Error('That link has expired. Please try again.');
  }

  var body = AUTH_exchangeCode(code);
  if (!body.access_token) throw new Error('Google did not grant access to your photos.');
  if (!body.id_token) throw new Error('Google did not say who granted it.');

  var claims = AUTH_readIdToken(body.id_token);
  if (claims.aud !== AUTH_clientId()) throw new Error('Sign-in rejected.');

  var email = String(claims.email).toLowerCase();
  var lifetime = Math.max(60, Math.min(Number(body.expires_in || 3600) - 120, 3000));
  CacheService.getUserCache().put('photos_tok_' + email, body.access_token, lifetime);
  CacheService.getScriptCache().put('photos_tok_' + email, body.access_token, lifetime);

  return { email: email, personId: checked.personId || '' };
}

/** The Photos access token for this caller, if the consent is still live. */
function AUTH_photosToken(email) {
  var key = 'photos_tok_' + String(email).toLowerCase();
  return CacheService.getUserCache().get(key) ||
         CacheService.getScriptCache().get(key) || null;
}

function AUTH_exchangeCode(code) {
  var secret = ST_props().getProperty('OAUTH_CLIENT_SECRET');
  if (!secret) throw new Error('Sign-in is not configured yet. See docs/SETUP.md.');

  var response = UrlFetchApp.fetch(AUTH_TOKEN_ENDPOINT, {
    method: 'post',
    muteHttpExceptions: true,
    payload: {
      code: code,
      client_id: AUTH_clientId(),
      client_secret: secret,
      redirect_uri: AUTH_redirectUri(),
      grant_type: 'authorization_code'
    }
  });
  if (response.getResponseCode() !== 200) {
    throw new Error('Google did not accept that. Please try again.');
  }
  return JSON.parse(response.getContentText());
}

/* ------------------------------------------------------------------ *
 * Session tokens
 * ------------------------------------------------------------------ */

/**
 * Sessions are signed rather than stored.
 *
 * A server-side session table would mean either a cache that silently evicts
 * people mid-visit or another sheet to write on every request. A token the
 * server signs and re-checks needs neither, and it cannot be forged without the
 * secret, which never leaves Script Properties.
 */
function AUTH_secret() {
  var props = ST_props();
  var secret = props.getProperty('SESSION_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('SESSION_SECRET', secret);
  }
  return secret;
}

function AUTH_sign(payload) {
  var body = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  var mac = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(body, AUTH_secret()));
  return body + '.' + mac;
}

function AUTH_verify(token) {
  if (!token || typeof token !== 'string' || token.length > 4096) return null;
  var parts = token.split('.');
  if (parts.length !== 2) return null;

  var expected = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(parts[0], AUTH_secret()));
  if (!AUTH_constantTimeEquals(parts[1], expected)) return null;

  var payload;
  try {
    payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  } catch (err) {
    return null;
  }
  if (!payload.exp || Number(payload.exp) <= AUTH_epoch()) return null;
  return payload;
}

/** Compares without leaking how much of the signature matched. */
function AUTH_constantTimeEquals(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function AUTH_epoch() {
  return Math.floor(Date.now() / 1000);
}

/* ------------------------------------------------------------------ *
 * Who is calling
 * ------------------------------------------------------------------ */

/**
 * Resolves a session token into a user, creating a pending record for a
 * first-time visitor so their access request reaches the admin.
 */
function AUTH_session(sessionToken) {
  var identity = AUTH_verify(sessionToken);
  if (!identity || !identity.email) throw new Error('Sign-in expired. Please sign in again.');

  var users = ST_readAll('Users');
  var user = null;
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].email).toLowerCase() === identity.email) { user = users[i]; break; }
  }

  if (!user) user = AUTH_admitOrQueue(identity);

  if (user.status === 'suspended' || user.role === 'blocked') {
    throw new Error('Your access to the family tree has been withdrawn.');
  }

  ST_update('Users', 'email', user.email, { last_login_at: ST_now() });

  return {
    email: user.email,
    personId: user.person_id || null,
    role: user.role,
    lang: user.lang_pref || ST_settings().default_lang || 'ms',
    canInvite: String(user.can_invite).toUpperCase() === 'TRUE',
    name: identity.name,
    picture: identity.picture,
    isAdmin: user.role === 'owner' || user.role === 'admin',
    isPending: user.role === 'pending'
  };
}

/**
 * A visitor nobody has heard of.
 *
 * If they were invited they are admitted immediately and bound to whichever
 * record the invitation named. Otherwise they are recorded as pending, which
 * shows them a holding screen and puts them in the admin's queue -- they see
 * nothing of the family until someone approves them.
 */
function AUTH_admitOrQueue(identity) {
  var invite = AUTH_findInvite(identity.email);
  var settings = ST_settings();

  var row = {
    email: identity.email,
    person_id: invite ? (invite.prebind_person_id || '') : '',
    role: invite ? 'member' : 'pending',
    lang_pref: settings.default_lang || 'ms',
    can_invite: invite && String(settings.allow_member_invites).toUpperCase() === 'TRUE'
      ? 'TRUE' : 'FALSE',
    invited_by: invite ? invite.invited_by : '',
    invited_at: ST_now(),
    last_login_at: ST_now(),
    status: 'active'
  };

  ST_append('Users', row);
  if (invite) {
    ST_update('Invites', 'invite_id', invite.invite_id, { used_at: ST_now(), status: 'used' });
  }
  ST_audit(identity.email, invite ? 'join_via_invite' : 'access_requested',
    'Users', identity.email, null);
  return row;
}

function AUTH_findInvite(email) {
  var invites = ST_readAll('Invites');
  var now = ST_now();
  for (var i = 0; i < invites.length; i++) {
    var invite = invites[i];
    if (invite.status !== 'open') continue;
    if (String(invite.email).toLowerCase() !== email) continue;
    if (invite.expires_at && String(invite.expires_at) < now) continue;
    return invite;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Permissions
 * ------------------------------------------------------------------ */

/**
 * Who a member may edit without an admin's approval.
 *
 * A parent entering their own family should not have to wait for anyone: their
 * household, the generation above and everything below them is theirs to
 * maintain. Reaching sideways -- a cousin's children, an aunt's second marriage
 * -- is where a shared tree gets damaged by well-meaning guesses, so those
 * edits become proposals instead of writes.
 *
 * Siblings are deliberately outside the direct scope. Each adult maintains
 * their own record, and a sibling who needs something changed can propose it.
 */
function AUTH_editableScope(graph, personId) {
  var scope = {};
  if (!personId) return scope;
  scope[personId] = 'self';

  var spouses = KIN_spousesOf(graph, personId);
  for (var i = 0; i < spouses.length; i++) scope[spouses[i].personId] = 'spouse';

  var parents = KIN_parentsOf(graph, personId);
  for (var j = 0; j < parents.length; j++) scope[parents[j]] = 'parent';

  var frontier = KIN_childrenOf(graph, personId);
  var depth = 0;
  while (frontier.length && depth < 6) {
    var next = [];
    for (var k = 0; k < frontier.length; k++) {
      if (scope[frontier[k]]) continue;
      scope[frontier[k]] = 'descendant';
      // A descendant's spouse marries into the household, so they are in scope.
      var theirSpouses = KIN_spousesOf(graph, frontier[k]);
      for (var s = 0; s < theirSpouses.length; s++) {
        if (!scope[theirSpouses[s].personId]) {
          scope[theirSpouses[s].personId] = 'descendant_spouse';
        }
      }
      next = next.concat(KIN_childrenOf(graph, frontier[k]));
    }
    frontier = next;
    depth++;
  }

  return scope;
}

function AUTH_canEditDirectly(session, graph, targetPersonId) {
  if (session.isAdmin) return true;
  if (session.isPending || !session.personId) return false;
  return !!AUTH_editableScope(graph, session.personId)[targetPersonId];
}

function AUTH_requireActive(session) {
  if (session.isPending) throw new Error('Your request to join is still waiting for approval.');
  if (!session.personId) throw new Error('Your account is not linked to anyone in the tree yet.');
}

function AUTH_requireAdmin(session) {
  if (!session.isAdmin) throw new Error('Only a family tree admin can do that.');
}
