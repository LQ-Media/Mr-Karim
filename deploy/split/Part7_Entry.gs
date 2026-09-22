/**
 * Pokok Keluarga -- part 7 of 7.
 *
 * Apps Script loads every .gs file into one shared scope, so these parts
 * work together exactly as one file would. Paste this one into a script
 * file named Part7_Entry.
 *
 * Generated from apps-script/ by tools/build-split-bundle.js -- edit there.
 */

/* ================================================================== *
 * 14_Picker.gs                                                   *
 * ================================================================== */

/**
 * Linking a portrait from Google Photos.
 *
 * There is one fact that shapes all of this: a Google Photos link cannot be
 * shown to anybody but its owner. The `baseUrl` the API returns lasts sixty
 * minutes and only works when presented with the access token of the account
 * whose library the photo lives in. Storing that URL would produce a tree where
 * every photograph was visible to exactly one person and broken for everyone
 * else within the hour.
 *
 * So "link from Google Photos" means: pick it there, and the app copies the
 * image once into the family's own Drive. From that moment it belongs to the
 * family, is served to every signed-in relative through the same authenticated
 * route as any other portrait, and keeps working whether or not the person who
 * chose it still has that photo, that phone, or that account.
 *
 * The picking itself uses the Photos Picker API, which never gives the app
 * access to a library -- only to the specific items a person deliberately
 * hands over in Google's own picker.
 */

var PIK_BASE = 'https://photospicker.googleapis.com/v1';

/* Google resizes on request, so both the full image and the thumbnail come
 * down already the right size. Nothing has to be resized afterwards, which
 * matters because Apps Script cannot resize an image at all. */
var PIK_FULL_PARAM = '=w1200-h1200';
var PIK_THUMB_PARAM = '=w256-h256-c';

function PIK_enabled() {
  return String(ST_settings().enable_google_photos).toUpperCase() === 'TRUE';
}

/**
 * Opens a picking session.
 *
 * Returns either a URL for the person to open in Google Photos, or a request
 * for the consent that has not been given yet.
 */
function PIK_start(session, personId) {
  AUTH_requireActive(session);
  if (!PIK_enabled()) {
    throw new Error('Linking from Google Photos is switched off. An admin can turn it on in Settings.');
  }

  var graph = ST_graph();
  if (!graph.people[personId]) throw new Error('That person is no longer in the tree.');

  var token = AUTH_photosToken(session.email);
  if (!token) {
    return { status: 'needs_consent', url: AUTH_photosAuthUrl(personId) };
  }

  var response = UrlFetchApp.fetch(PIK_BASE + '/sessions', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: '{}',
    muteHttpExceptions: true
  });

  if (response.getResponseCode() === 401 || response.getResponseCode() === 403) {
    return { status: 'needs_consent', url: AUTH_photosAuthUrl(personId) };
  }
  if (response.getResponseCode() >= 300) {
    throw new Error('Google Photos could not start a session. Please try again.');
  }

  var body = JSON.parse(response.getContentText());
  return {
    status: 'open',
    sessionId: body.id,
    pickerUri: body.pickerUri,
    pollMillis: PIK_pollMillis(body),
    expiresIn: 600
  };
}

/** How often Google asks to be polled, clamped to something sane. */
function PIK_pollMillis(body) {
  var config = body.pollingConfig || {};
  var seconds = parseFloat(String(config.pollInterval || '3s').replace('s', ''));
  if (isNaN(seconds) || seconds < 1) seconds = 3;
  return Math.min(Math.max(seconds, 1.5), 10) * 1000;
}

/** Has the person finished choosing? */
function PIK_poll(session, sessionId) {
  AUTH_requireActive(session);
  var token = AUTH_photosToken(session.email);
  if (!token) return { status: 'needs_consent', url: AUTH_photosAuthUrl('') };

  var response = UrlFetchApp.fetch(PIK_BASE + '/sessions/' + encodeURIComponent(sessionId), {
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() >= 300) return { status: 'waiting' };

  var body = JSON.parse(response.getContentText());
  return {
    status: body.mediaItemsSet ? 'ready' : 'waiting',
    pollMillis: PIK_pollMillis(body)
  };
}

/**
 * Copies the chosen photo into the family's Drive.
 *
 * The bytes are fetched with the picker's token, which belongs to whoever chose
 * the photo, and written with the script's own authority into the folder the
 * owner holds. That hand-off is the whole point: after it, the image is the
 * family's and every relative can see it.
 */
function PIK_import(session, sessionId, personId) {
  AUTH_requireActive(session);
  var graph = ST_graph();
  var person = graph.people[personId];
  if (!person) throw new Error('That person is no longer in the tree.');

  var token = AUTH_photosToken(session.email);
  if (!token) return { status: 'needs_consent', url: AUTH_photosAuthUrl(personId) };

  var listed = UrlFetchApp.fetch(
    PIK_BASE + '/mediaItems?sessionId=' + encodeURIComponent(sessionId) + '&pageSize=1',
    { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });

  if (listed.getResponseCode() >= 300) {
    throw new Error('Google Photos would not hand over that picture.');
  }

  var items = (JSON.parse(listed.getContentText()) || {}).mediaItems || [];
  if (!items.length) throw new Error('No photo was chosen.');

  var file = items[0].mediaFile || {};
  if (!file.baseUrl) throw new Error('That item has no image to download.');
  if (String(file.mimeType || '').indexOf('image/') !== 0) {
    throw new Error('Only photographs can be used as a portrait.');
  }

  var payload = {
    mime: 'image/jpeg',
    full: PIK_fetchBase64(file.baseUrl + PIK_FULL_PARAM, token, CFG.PHOTO_MAX_BYTES),
    thumb: PIK_fetchBase64(file.baseUrl + PIK_THUMB_PARAM, token, 400 * 1024)
  };

  PIK_closeSession(sessionId, token);

  // From here it is an ordinary portrait: the same approval rules, the same
  // storage, the same delivery to every signed-in relative.
  var result = PHO_upload(session, personId, payload);
  ST_audit(session.email, 'link_google_photo', 'People', personId, { source: 'photos_picker' });
  return result;
}

function PIK_fetchBase64(url, token, limit) {
  var response = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() >= 300) {
    throw new Error('Google Photos would not send the image.');
  }
  var bytes = response.getBlob().getBytes();
  if (bytes.length > limit) throw new Error('That photo is too large.');
  return Utilities.base64Encode(bytes);
}

/** Closing the session revokes the app's access to what was picked. */
function PIK_closeSession(sessionId, token) {
  try {
    UrlFetchApp.fetch(PIK_BASE + '/sessions/' + encodeURIComponent(sessionId), {
      method: 'delete',
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
  } catch (err) {
    // The session expires on its own. Failing to tidy up must not fail the import.
  }
}

/* ================================================================== *
 * Code.gs                                                        *
 * ================================================================== */

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
      } catch (err) {
        error = err.message || String(err);
      }
      // The session is not carried through the redirect -- putting it in a URL
      // would leave it in browser history. The browser still holds it.
    } else {
      try {
        session = AUTH_completeSignIn(params.code, params.state);
      } catch (err2) {
        error = err2.message || String(err2);
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
  } catch (err) {
    template.signInUrl = '';
    if (!error) template.signInError = err.message;
  }

  return template.evaluate()
    .setTitle(CFG.APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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
