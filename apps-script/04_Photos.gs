/**
 * Portraits.
 *
 * Two constraints shape this. Apps Script cannot resize an image -- there is no
 * image API -- and it cannot serve one either, because a web app may only return
 * HTML, text or JSON, never image bytes.
 *
 * The usual workaround is to set each photo to "anyone with the link" and point
 * an <img> at Drive's thumbnail URL. That is fast, and it puts photographs of
 * the family's children behind nothing but an unguessable URL. So instead the
 * browser downscales before uploading, the files stay private to the owner's
 * Drive, and thumbnails are delivered as base64 through the same authenticated
 * call as everything else. A thumbnail is small enough that this is cheap, and
 * the full-size image is fetched only when someone opens a profile.
 */

function PHO_folder() {
  var id = ST_props().getProperty(CFG.PROP_FOLDER_ID);
  if (!id) throw new Error('Photo storage is not set up yet.');
  return DriveApp.getFolderById(id);
}

/**
 * Stores a portrait. Both sizes are produced by the browser; the server checks
 * them rather than trusting them.
 */
function PHO_upload(session, personId, payload) {
  AUTH_requireActive(session);
  var graph = ST_graph();
  var person = graph.people[personId];
  if (!person) throw new Error('That person is no longer in the tree.');

  if (!AUTH_canEditDirectly(session, graph, personId)) {
    var change = PPL_queueChange(session, 'upload_photo', personId,
      { personId: personId, payload: payload },
      'Add a photo of ' + person.display_name);
    return { status: 'pending_approval', changeId: change.change_id };
  }

  var stored = PHO_store(session.email, personId, payload);
  return { status: 'saved', thumb: stored.thumbDataUrl };
}

function PHO_store(actorEmail, personId, payload) {
  var mime = PHO_checkMime(payload.mime);
  var full = PHO_decode(payload.full, CFG.PHOTO_MAX_BYTES);
  var thumb = PHO_decode(payload.thumb, 400 * 1024);

  var folder = PHO_folder();
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');

  var fullFile = folder.createFile(
    Utilities.newBlob(full, mime, personId + '-' + stamp + '.jpg'));
  var thumbFile = folder.createFile(
    Utilities.newBlob(thumb, mime, personId + '-' + stamp + '-thumb.jpg'));

  // Replacing a portrait leaves the previous one in Drive rather than deleting
  // it. Family photographs are not always easy to find twice.
  ST_update('People', 'person_id', personId, {
    photo_file_id: fullFile.getId(),
    photo_thumb_id: thumbFile.getId(),
    updated_by: actorEmail,
    updated_at: ST_now()
  });
  ST_audit(actorEmail, 'upload_photo', 'People', personId, { file: fullFile.getId() });
  ST_invalidate();

  return {
    fileId: fullFile.getId(),
    thumbId: thumbFile.getId(),
    thumbDataUrl: 'data:' + mime + ';base64,' + Utilities.base64Encode(thumb)
  };
}

function PHO_checkMime(mime) {
  var allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowed.indexOf(mime) === -1) throw new Error('Photos must be JPEG, PNG or WebP.');
  return mime;
}

function PHO_decode(base64, limit) {
  if (!base64) throw new Error('No image was received.');
  var body = String(base64).replace(/^data:[^,]+,/, '');
  // Base64 carries roughly 3 bytes per 4 characters; check before decoding so a
  // huge payload cannot be expanded in memory first.
  if (body.length * 0.75 > limit) throw new Error('That photo is too large.');
  var bytes = Utilities.base64Decode(body);
  if (bytes.length > limit) throw new Error('That photo is too large.');
  return bytes;
}

/**
 * Thumbnails for a batch of people, as data URLs.
 *
 * Fetched for a whole screen at once. Drive reads are the slow part, so results
 * are cached per file; portraits change rarely and the cache key is the file id,
 * so a replaced photo simply has a different key.
 */
function PHO_thumbnails(session, personIds) {
  AUTH_requireActive(session);
  var graph = ST_graph();
  var cache = CacheService.getScriptCache();
  var out = {};

  var wanted = [];
  for (var i = 0; i < personIds.length && i < 60; i++) {
    var person = graph.people[personIds[i]];
    if (person && person.photo_thumb_id) {
      wanted.push({ personId: personIds[i], fileId: person.photo_thumb_id });
    }
  }
  if (!wanted.length) return out;

  var keys = [];
  for (var k = 0; k < wanted.length; k++) keys.push('thumb_' + wanted[k].fileId);
  var cached = cache.getAll(keys);

  var toCache = {};
  for (var w = 0; w < wanted.length; w++) {
    var key = 'thumb_' + wanted[w].fileId;
    if (cached[key]) {
      out[wanted[w].personId] = cached[key];
      continue;
    }
    try {
      var blob = DriveApp.getFileById(wanted[w].fileId).getBlob();
      var dataUrl = 'data:' + blob.getContentType() + ';base64,' +
                    Utilities.base64Encode(blob.getBytes());
      out[wanted[w].personId] = dataUrl;
      if (dataUrl.length < 90000) toCache[key] = dataUrl;
    } catch (err) {
      // A deleted or unreadable file just means no portrait on that card.
    }
  }
  if (Object.keys(toCache).length) {
    try { cache.putAll(toCache, 21600); } catch (err2) { /* optional */ }
  }
  return out;
}

/** The full-size portrait, fetched only when a profile is opened. */
function PHO_full(session, personId) {
  AUTH_requireActive(session);
  var person = ST_graph().people[personId];
  if (!person || !person.photo_file_id) return null;
  var blob = DriveApp.getFileById(person.photo_file_id).getBlob();
  return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
}
