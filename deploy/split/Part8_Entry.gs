/**
 * Pokok Keluarga -- part 8 of 8.
 *
 * Apps Script loads every .gs file into one shared scope, so these parts
 * work together exactly as one file would. Paste this one into a script
 * file named Part8_Entry.
 *
 * Generated from apps-script/ by tools/build-split-bundle.js -- edit there.
 */

/* ================================================================== *
 * Code.gs                                                        *
 * ================================================================== */

/**
 * Entry points: serving the page, and one-time installation.
 *
 * Written plainly on purpose. Apps Script rejected an earlier version of doGet
 * with a syntax error that nothing available locally could reproduce -- Node
 * parsed it, the braces balanced, the bytes were plain ASCII -- and it survived
 * a rewritten method chain and renamed catch parameters. A twelve-line doGet
 * then parsed fine, which put the fault somewhere in this file rather than in
 * the project.
 *
 * So this is the same behaviour expressed with nothing clever in it: one
 * try/catch per function, no nesting, no expressions that depend on a parser
 * resolving an ambiguity. If it still fails, the failure is now small enough to
 * bisect in one step.
 */

/**
 * Serves the app, and receives Google's redirect after a sign-in.
 *
 * The deployment executes as the owner, so the page itself is the only thing a
 * visitor gets without proving who they are -- it carries no family data. When
 * Google sends someone back here with an authorization code, it is exchanged
 * for an identity and the page is rendered with a signed session token, which
 * the browser then presents on every call.
 */
function doGet(e) {
  var params = {};
  if (e && e.parameter) {
    params = e.parameter;
  }

  var state = ENTRY_readRedirect(params);

  var template = HtmlService.createTemplateFromFile('Index');
  template.appName = CFG.APP_NAME;
  template.session = state.session;
  template.signInError = state.error;
  template.resumePhotosFor = state.resumePhotosFor;
  template.signInUrl = state.signInUrl;

  var output = template.evaluate();
  output.setTitle(CFG.APP_NAME);
  output.addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
  output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return output;
}

/**
 * Works out what Google just sent us back with.
 *
 * Two different round trips land on this URL: signing in, and granting access
 * to the photos somebody is about to pick. The signed state says which.
 */
function ENTRY_readRedirect(params) {
  var state = {
    session: '',
    error: '',
    resumePhotosFor: '',
    signInUrl: ''
  };

  if (params.code && params.state) {
    var intent = AUTH_verify(params.state);
    if (intent && intent.purpose === 'photos') {
      ENTRY_takePhotosGrant(params, state);
    } else {
      ENTRY_takeSignIn(params, state);
    }
  } else if (params.error) {
    state.error = 'Sign-in was cancelled.';
  }

  ENTRY_addSignInUrl(state);
  return state;
}

/** The session is not carried through the redirect -- putting it in a URL would
 *  leave it in browser history. The browser still holds it. */
function ENTRY_takePhotosGrant(params, state) {
  try {
    var granted = AUTH_completePhotosGrant(params.code, params.state);
    state.resumePhotosFor = granted.personId || '';
  } catch (photoErr) {
    state.error = photoErr.message || String(photoErr);
  }
}

function ENTRY_takeSignIn(params, state) {
  try {
    state.session = AUTH_completeSignIn(params.code, params.state);
  } catch (signInErr) {
    state.error = signInErr.message || String(signInErr);
  }
}

function ENTRY_addSignInUrl(state) {
  try {
    state.signInUrl = AUTH_signInUrl();
  } catch (urlErr) {
    state.signInUrl = '';
    if (!state.error) {
      state.error = urlErr.message;
    }
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * One-time setup. Run this once from the Apps Script editor.
 *
 * Creates the spreadsheet and the photo folder in the owner's Drive, builds
 * every tab, and records the owner as the first admin. Safe to run again: it
 * reuses whatever already exists and only fills in what is missing.
 */
function installFamilyTree() {
  var props = ST_props();
  var owner = Session.getEffectiveUser().getEmail();

  var spreadsheet = ENTRY_openOrCreateSheet(props);
  ST_bootstrap(spreadsheet);
  ENTRY_ensurePhotoFolder(props);

  props.setProperty(CFG.PROP_OWNER_EMAIL, owner);
  ENTRY_seedSettings();
  ENTRY_ensureOwner(owner);

  var message = 'Installed.\n\n' +
    'Spreadsheet: ' + spreadsheet.getUrl() + '\n' +
    'Owner: ' + owner + '\n\n' +
    'Next: create an OAuth client id in Google Cloud Console, then run\n' +
    'setOAuthCredentials(id, secret) and deploy as a web app.\n' +
    'See docs/DEPLOY.md.';

  Logger.log(message);
  return message;
}

function ENTRY_openOrCreateSheet(props) {
  var sheetId = props.getProperty(CFG.PROP_SHEET_ID);
  if (sheetId) {
    return SpreadsheetApp.openById(sheetId);
  }
  var created = SpreadsheetApp.create(CFG.APP_NAME + ' Data');
  props.setProperty(CFG.PROP_SHEET_ID, created.getId());
  return created;
}

function ENTRY_ensurePhotoFolder(props) {
  if (props.getProperty(CFG.PROP_FOLDER_ID)) {
    return;
  }
  var name = CFG.APP_NAME + ' Photos';
  var folders = DriveApp.getFoldersByName(name);
  var folder;
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(name);
  }
  props.setProperty(CFG.PROP_FOLDER_ID, folder.getId());
}

function ENTRY_seedSettings() {
  var settings = ST_readAll('Settings');
  if (settings.length) {
    return;
  }
  var rows = [];
  for (var key in DEFAULT_SETTINGS) {
    if (Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
      rows.push({ key: key, value: DEFAULT_SETTINGS[key] });
    }
  }
  ST_appendMany('Settings', rows);
}

function ENTRY_ensureOwner(owner) {
  var users = ST_readAll('Users');
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].email).toLowerCase() === owner.toLowerCase()) {
      return;
    }
  }
  ST_append('Users', {
    email: owner.toLowerCase(),
    person_id: '',
    role: 'owner',
    lang_pref: 'ms',
    can_invite: 'TRUE',
    invited_by: 'install',
    invited_at: ST_now(),
    last_login_at: '',
    status: 'active'
  });
}

/**
 * Records the OAuth credentials used to sign relatives in.
 *
 * The secret is held in Script Properties and used only server-side, to swap an
 * authorization code for an identity. It is never sent to a browser.
 */
/**
 * Records the web app's public URL, which is also its OAuth redirect URI.
 *
 * It has to be the /exec address of a real deployment: /dev is the editor's own
 * test URL, it changes, and Google will not redirect to it.
 */
function setWebAppUrl(url) {
  var clean = ENTRY_trim(url);
  if (clean.indexOf('https://script.google.com/') !== 0) {
    throw new Error('That does not look like an Apps Script web app URL.');
  }
  if (clean.slice(-5) !== '/exec') {
    throw new Error('That is not the /exec URL. Deploy > Manage deployments > copy the Web app URL.');
  }
  ST_props().setProperty(CFG.PROP_WEBAPP_URL, clean);
  return 'Redirect URI recorded. Register exactly this in the Cloud Console:\n' + clean;
}

function setOAuthCredentials(clientId, clientSecret) {
  var id = ENTRY_trim(clientId);
  var secret = ENTRY_trim(clientSecret);

  if (!id || id.indexOf('.apps.googleusercontent.com') === -1) {
    throw new Error('That does not look like a Google OAuth client id.');
  }
  if (!secret || secret.length < 10) {
    throw new Error('That does not look like a Google OAuth client secret.');
  }

  var props = ST_props();
  props.setProperty(CFG.PROP_CLIENT_ID, id);
  props.setProperty('OAUTH_CLIENT_SECRET', secret);

  var uri = props.getProperty(CFG.PROP_WEBAPP_URL);
  if (!uri) {
    return 'Credentials saved, but no web app URL is recorded yet.\n' +
      'Run setWebAppUrl(\'https://script.google.com/macros/s/.../exec\') too.';
  }
  return 'Sign-in configured. Redirect URI to register: ' + uri;
}

function ENTRY_trim(value) {
  if (!value) {
    return '';
  }
  return String(value).replace(/^\s+/, '').replace(/\s+$/, '');
}

/**
 * The exact redirect URI to paste into the Google Cloud Console.
 *
 * Prints the recorded one where there is one. Otherwise it says so plainly
 * rather than offering the derived value, which from the editor is the /dev
 * URL and is not what should be registered.
 */
function showRedirectUri() {
  var stored = ST_props().getProperty(CFG.PROP_WEBAPP_URL);
  var out;
  if (stored) {
    out = stored;
  } else {
    out = 'Not recorded yet.\n\n' +
      'Deploy > Manage deployments, copy the Web app URL (it ends in /exec),\n' +
      "then run setWebAppUrl('<that URL>').\n\n" +
      'For reference, this script reports its own URL as:\n' +
      '  ' + ScriptApp.getService().getUrl() + '\n' +
      'From the editor that is the /dev address, which is NOT the one to register.';
  }
  Logger.log(out);
  return out;
}

/** Prints where everything lives. Useful when picking the install up later. */
function showInstallation() {
  var props = ST_props();
  var sheetId = props.getProperty(CFG.PROP_SHEET_ID);

  var sheetUrl = 'not set';
  if (sheetId) {
    sheetUrl = SpreadsheetApp.openById(sheetId).getUrl();
  }

  var rows = [];
  rows.push('Spreadsheet: ' + sheetUrl);
  rows.push('Photo folder: ' + (props.getProperty(CFG.PROP_FOLDER_ID) || 'not set'));
  rows.push('OAuth client id: ' + (props.getProperty(CFG.PROP_CLIENT_ID) || 'NOT SET'));
  rows.push('OAuth secret: ' + (props.getProperty('OAUTH_CLIENT_SECRET') ? 'set' : 'NOT SET'));
  rows.push('Owner: ' + (props.getProperty(CFG.PROP_OWNER_EMAIL) || 'not set'));
  rows.push('Web app URL: ' + ScriptApp.getService().getUrl());

  var out = rows.join('\n');
  Logger.log(out);
  return out;
}

/** Rescans for duplicates. Attach a daily trigger to this if you like. */
function nightlyDuplicateSweep() {
  var owner = ST_props().getProperty(CFG.PROP_OWNER_EMAIL);
  MRG_rebuildQueue({ email: owner, isAdmin: true, role: 'owner' });
}
