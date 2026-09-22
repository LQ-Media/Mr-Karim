/**
 * Entry points: serving the page, and one-time installation.
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
  var params = (e && e.parameter) || {};
  var session = '';
  var error = '';

  var resumePhotosFor = '';

  if (params.code && params.state) {
    // Two different round trips come back here: signing in, and granting access
    // to the photos somebody is about to pick. The signed state says which.
    var intent = AUTH_verify(params.state);
    if (intent && intent.purpose === 'photos') {
      try {
        var granted = AUTH_completePhotosGrant(params.code, params.state);
        resumePhotosFor = granted.personId || '';
      } catch (photoErr) {
        error = photoErr.message || String(photoErr);
      }
      // The session is not carried through the redirect -- putting it in a URL
      // would leave it in browser history. The browser still holds it.
    } else {
      try {
        session = AUTH_completeSignIn(params.code, params.state);
      } catch (signInErr) {
        error = signInErr.message || String(signInErr);
      }
    }
  } else if (params.error) {
    error = 'Sign-in was cancelled.';
  }

  var template = HtmlService.createTemplateFromFile('Index');
  template.appName = CFG.APP_NAME;
  template.session = session;
  template.signInError = error;
  template.resumePhotosFor = resumePhotosFor;
  try {
    template.signInUrl = AUTH_signInUrl();
  } catch (urlErr) {
    template.signInUrl = '';
    if (!error) template.signInError = urlErr.message;
  }

  var page = template.evaluate();
  page.setTitle(CFG.APP_NAME);
  page.addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
  page.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return page;
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

  var sheetId = props.getProperty(CFG.PROP_SHEET_ID);
  var spreadsheet;
  if (sheetId) {
    spreadsheet = SpreadsheetApp.openById(sheetId);
  } else {
    spreadsheet = SpreadsheetApp.create(CFG.APP_NAME + ' — Data');
    props.setProperty(CFG.PROP_SHEET_ID, spreadsheet.getId());
  }
  ST_bootstrap(spreadsheet);

  if (!props.getProperty(CFG.PROP_FOLDER_ID)) {
    var folders = DriveApp.getFoldersByName(CFG.APP_NAME + ' — Photos');
    var folder = folders.hasNext() ? folders.next()
      : DriveApp.createFolder(CFG.APP_NAME + ' — Photos');
    props.setProperty(CFG.PROP_FOLDER_ID, folder.getId());
  }

  props.setProperty(CFG.PROP_OWNER_EMAIL, owner);

  var settings = ST_readAll('Settings');
  if (!settings.length) {
    var rows = [];
    for (var key in DEFAULT_SETTINGS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
        rows.push({ key: key, value: DEFAULT_SETTINGS[key] });
      }
    }
    ST_appendMany('Settings', rows);
  }

  var users = ST_readAll('Users');
  var found = false;
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].email).toLowerCase() === owner.toLowerCase()) { found = true; break; }
  }
  if (!found) {
    ST_append('Users', {
      email: owner.toLowerCase(), person_id: '', role: 'owner', lang_pref: 'ms',
      can_invite: 'TRUE', invited_by: 'install', invited_at: ST_now(),
      last_login_at: '', status: 'active'
    });
  }

  var message =
    'Installed.\n\n' +
    'Spreadsheet: ' + spreadsheet.getUrl() + '\n' +
    'Owner: ' + owner + '\n\n' +
    'Next: create an OAuth client id in Google Cloud Console and run\n' +
    "setOAuthClientId('YOUR-CLIENT-ID.apps.googleusercontent.com')\n" +
    'then deploy as a web app. See docs/SETUP.md.';
  Logger.log(message);
  return message;
}

/**
 * Records the OAuth credentials used to sign relatives in.
 *
 * The secret is held in Script Properties and used only server-side, to swap an
 * authorization code for an identity. It is never sent to a browser.
 */
function setOAuthCredentials(clientId, clientSecret) {
  if (!clientId || String(clientId).indexOf('.apps.googleusercontent.com') === -1) {
    throw new Error('That does not look like a Google OAuth client id.');
  }
  if (!clientSecret || String(clientSecret).length < 10) {
    throw new Error('That does not look like a Google OAuth client secret.');
  }
  var props = ST_props();
  props.setProperty(CFG.PROP_CLIENT_ID, String(clientId).replace(/^\s+|\s+$/g, ''));
  props.setProperty('OAUTH_CLIENT_SECRET', String(clientSecret).replace(/^\s+|\s+$/g, ''));
  return 'Sign-in configured. Redirect URI to register: ' + ScriptApp.getService().getUrl();
}

/** The exact redirect URI to paste into the Google Cloud Console. */
function showRedirectUri() {
  var url = ScriptApp.getService().getUrl();
  Logger.log(url);
  return url;
}

/** Prints where everything lives. Useful when picking the install up later. */
function showInstallation() {
  var props = ST_props();
  var sheetId = props.getProperty(CFG.PROP_SHEET_ID);
  var out = [
    'Spreadsheet: ' + (sheetId ? SpreadsheetApp.openById(sheetId).getUrl() : 'not set'),
    'Photo folder: ' + (props.getProperty(CFG.PROP_FOLDER_ID) || 'not set'),
    'OAuth client id: ' + (props.getProperty(CFG.PROP_CLIENT_ID) || 'NOT SET'),
    'OAuth secret: ' + (props.getProperty('OAUTH_CLIENT_SECRET') ? 'set' : 'NOT SET'),
    'Owner: ' + (props.getProperty(CFG.PROP_OWNER_EMAIL) || 'not set'),
    'Web app URL: ' + ScriptApp.getService().getUrl()
  ].join('\n');
  Logger.log(out);
  return out;
}

/** Rescans for duplicates. Attach a daily trigger to this if you like. */
function nightlyDuplicateSweep() {
  var owner = ST_props().getProperty(CFG.PROP_OWNER_EMAIL);
  MRG_rebuildQueue({ email: owner, isAdmin: true, role: 'owner' });
}
