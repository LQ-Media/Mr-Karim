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
