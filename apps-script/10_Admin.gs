/**
 * The admin side: approvals, invitations and access.
 */

/* ------------------------------------------------------------------ *
 * Approvals
 * ------------------------------------------------------------------ */

function ADM_pendingChanges(session) {
  AUTH_requireAdmin(session);
  var rows = ST_readAll('PendingChanges');
  var out = [];
  for (var i = rows.length - 1; i >= 0; i--) {
    if (rows[i].status !== 'pending') continue;
    out.push({
      changeId: rows[i].change_id,
      kind: rows[i].kind,
      summary: rows[i].summary,
      requestedBy: rows[i].requested_by,
      requestedAt: rows[i].requested_at,
      payload: ADM_parseJson(rows[i].payload_json)
    });
  }
  return out;
}

/**
 * Applies a queued change exactly as it was submitted.
 *
 * The stored payload is replayed rather than re-derived, so what the admin read
 * on screen is what actually happens. A change that fails is recorded as
 * rejected with the reason attached, so it neither disappears nor sits in the
 * queue being retried forever.
 */
function ADM_approve(session, changeId, note) {
  AUTH_requireAdmin(session);

  var rows = ST_readAll('PendingChanges');
  var change = null;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].change_id === changeId) { change = rows[i]; break; }
  }
  if (!change) throw new Error('That request no longer exists.');
  if (change.status !== 'pending') throw new Error('That request has already been reviewed.');

  var payload = ADM_parseJson(change.payload_json);
  if (!payload) throw new Error('That request could not be read.');

  try {
    ADM_applyChange(session, change, payload);
  } catch (err) {
    ST_update('PendingChanges', 'change_id', changeId, {
      status: 'rejected', reviewed_by: session.email, reviewed_at: ST_now(),
      review_note: 'Could not be applied: ' + err.message
    });
    throw err;
  }

  ST_update('PendingChanges', 'change_id', changeId, {
    status: 'approved', reviewed_by: session.email, reviewed_at: ST_now(),
    review_note: note || ''
  });
  ST_audit(session.email, 'approve_change', 'PendingChanges', changeId, payload);
  ST_invalidate();
  return { status: 'approved' };
}

function ADM_applyChange(session, change, payload) {
  // The change is credited to whoever proposed it, not to the admin who let it
  // through -- the audit trail should say who knew this, not who clicked yes.
  var author = change.requested_by;

  switch (change.kind) {
    case 'create_person':
      PPL_applyCreate(author, payload.anchorId, payload.relationship, payload.data);
      return;
    case 'update_person':
      PPL_applyUpdate(author, payload.personId, payload.changes);
      return;
    case 'delete_person':
      PPL_applyDelete(author, payload.personId);
      return;
    case 'add_parentage':
      PPL_addParentLink(author, payload.childId, payload.parentId,
        payload.role, payload.relationType);
      return;
    case 'add_union':
      PPL_addUnion(author, payload.aId, payload.bId, payload.data || {});
      return;
    case 'add_batch':
      PPL_applyBatch(author, payload.anchorId, payload.relationship, payload.rows);
      return;
    case 'upload_photo':
      PHO_store(author, payload.personId, payload.payload);
      return;
    default:
      throw new Error('Unknown request type: ' + change.kind);
  }
}

function ADM_reject(session, changeId, note) {
  AUTH_requireAdmin(session);
  ST_update('PendingChanges', 'change_id', changeId, {
    status: 'rejected', reviewed_by: session.email, reviewed_at: ST_now(),
    review_note: note || ''
  });
  ST_audit(session.email, 'reject_change', 'PendingChanges', changeId, { note: note || '' });
  return { status: 'rejected' };
}

/* ------------------------------------------------------------------ *
 * Invitations
 * ------------------------------------------------------------------ */

/**
 * Invites someone, optionally bound to a record that already exists.
 *
 * Binding is what stops a relative creating a second copy of themselves on
 * their first visit: if the family already added them, the invite ties their
 * Google account to that record the moment they sign in.
 *
 * Ordinary members may invite too, which is how the tree spreads through a
 * family without the owner being a bottleneck -- but only into their own branch.
 * Inviting a stranger to a record on the far side of the family is not theirs
 * to do.
 */
function ADM_invite(session, email, prebindPersonId) {
  AUTH_requireActive(session);
  var settings = ST_settings();

  if (!session.isAdmin) {
    if (!session.canInvite || String(settings.allow_member_invites).toUpperCase() !== 'TRUE') {
      throw new Error('Ask a family tree admin to send that invitation.');
    }
    if (prebindPersonId && !AUTH_canEditDirectly(session, ST_graph(), prebindPersonId)) {
      throw new Error('You can only invite people in your own part of the family.');
    }
  }

  var clean = String(email || '').toLowerCase().replace(/^\s+|\s+$/g, '');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) throw new Error('That is not a valid email address.');

  var users = ST_readAll('Users');
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].email).toLowerCase() === clean) {
      throw new Error('That person can already sign in.');
    }
  }

  var days = Number(settings.invite_expiry_days) || 30;
  var expires = new Date();
  expires.setDate(expires.getDate() + days);

  // The invitation is bound to the email address, not to a secret in a link:
  // the person must sign in with that exact Google account, so a forwarded URL
  // admits nobody. The token is kept only as a record of the invitation.
  var invite = {
    invite_id: ST_nextId('Invites'),
    email: clean,
    token: Utilities.getUuid(),
    prebind_person_id: prebindPersonId || '',
    invited_by: session.email,
    created_at: ST_now(),
    expires_at: Utilities.formatDate(expires, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss"),
    used_at: '',
    status: 'open'
  };
  ST_append('Invites', invite);
  ST_audit(session.email, 'invite', 'Invites', invite.invite_id, { email: clean });

  return {
    status: 'invited',
    email: clean,
    url: ScriptApp.getService().getUrl(),
    expiresAt: invite.expires_at
  };
}

function ADM_revokeInvite(session, inviteId) {
  AUTH_requireAdmin(session);
  ST_update('Invites', 'invite_id', inviteId, { status: 'revoked' });
  return { status: 'revoked' };
}

/* ------------------------------------------------------------------ *
 * Access
 * ------------------------------------------------------------------ */

function ADM_pendingUsers(session) {
  AUTH_requireAdmin(session);
  var rows = ST_readAll('Users');
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].role === 'pending') {
      out.push({ email: rows[i].email, requestedAt: rows[i].invited_at });
    }
  }
  return out;
}

/** Approves a waiting account and binds it to the person they are. */
function ADM_approveUser(session, email, personId, role) {
  AUTH_requireAdmin(session);
  var wanted = ['admin', 'member'].indexOf(role) !== -1 ? role : 'member';
  var settings = ST_settings();

  var ok = ST_update('Users', 'email', String(email).toLowerCase(), {
    role: wanted,
    person_id: personId || '',
    can_invite: String(settings.allow_member_invites).toUpperCase() === 'TRUE' ? 'TRUE' : 'FALSE',
    status: 'active'
  });
  if (!ok) throw new Error('No such account.');

  ST_audit(session.email, 'approve_user', 'Users', email, { role: wanted, personId: personId });
  return { status: 'approved' };
}

function ADM_setUserRole(session, email, role) {
  AUTH_requireAdmin(session);
  if (CFG.ROLES.indexOf(role) === -1) throw new Error('Unknown role.');

  var target = String(email).toLowerCase();
  var owner = String(ST_props().getProperty(CFG.PROP_OWNER_EMAIL) || '').toLowerCase();
  if (target === owner && role !== 'owner') {
    throw new Error('The owner of the family tree cannot be demoted.');
  }

  ST_update('Users', 'email', target, { role: role });
  ST_audit(session.email, 'set_role', 'Users', target, { role: role });
  return { status: 'updated' };
}

/** Binds a signed-in account to the person they are in the tree. */
function ADM_bindSelf(session, personId) {
  var graph = ST_graph();
  if (!graph.people[personId]) throw new Error('That person is no longer in the tree.');

  var users = ST_readAll('Users');
  for (var i = 0; i < users.length; i++) {
    if (users[i].person_id === personId &&
        String(users[i].email).toLowerCase() !== session.email) {
      throw new Error('Someone else has already claimed that person.');
    }
  }

  ST_update('Users', 'email', session.email, { person_id: personId });
  ST_audit(session.email, 'bind_self', 'Users', session.email, { personId: personId });
  return { status: 'bound', personId: personId };
}

function ADM_setLanguage(session, lang) {
  if (CFG.LANGS.indexOf(lang) === -1) throw new Error('Unknown language.');
  ST_update('Users', 'email', session.email, { lang_pref: lang });
  return { status: 'updated', lang: lang };
}

/** A title the family uses that no algorithm would arrive at. */
function ADM_setCustomTitle(session, toPersonId, label, scope, lang) {
  AUTH_requireActive(session);
  var graph = ST_graph();
  if (!graph.people[toPersonId]) throw new Error('That person is no longer in the tree.');

  var global = scope === 'GLOBAL';
  if (global) AUTH_requireAdmin(session);

  var from = global ? 'GLOBAL' : session.personId;
  var clean = String(label || '').replace(/^\s+|\s+$/g, '').substring(0, 60);

  var rows = ST_readAll('CustomTitles');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].from_person_id === from && rows[i].to_person_id === toPersonId &&
        rows[i].lang === (lang || '*')) {
      if (!clean) {
        ST_update('CustomTitles', 'title_id', rows[i].title_id, { custom_label: '' });
        ST_invalidate();
        return { status: 'cleared' };
      }
      ST_update('CustomTitles', 'title_id', rows[i].title_id, { custom_label: clean });
      ST_invalidate();
      return { status: 'updated', label: clean };
    }
  }

  if (!clean) return { status: 'unchanged' };
  ST_append('CustomTitles', {
    title_id: ST_nextId('CustomTitles'),
    from_person_id: from,
    to_person_id: toPersonId,
    custom_label: clean,
    lang: lang || '*',
    created_by: session.email,
    created_at: ST_now()
  });
  ST_invalidate();
  return { status: 'created', label: clean };
}

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

/* Only these may be changed from the interface. Everything else on the Settings
 * tab is either derived at install or too easy to break from a phone. */
var ADM_EDITABLE_SETTINGS = {
  family_name: 'text',
  birth_order_titles: 'titles',
  default_lang: 'lang',
  allow_member_invites: 'bool',
  enable_google_photos: 'bool',
  merge_queue_threshold: 'score',
  match_suggest_threshold: 'score'
};

function ADM_settings(session) {
  AUTH_requireAdmin(session);
  var current = ST_settings();
  var out = {};
  for (var key in ADM_EDITABLE_SETTINGS) {
    if (Object.prototype.hasOwnProperty.call(ADM_EDITABLE_SETTINGS, key)) {
      out[key] = current[key];
    }
  }
  out.defaults = { birth_order_titles: DEFAULT_SETTINGS.birth_order_titles };
  out.photosConfigured = !!ST_props().getProperty('OAUTH_CLIENT_SECRET');
  return out;
}

/**
 * Saves the settings an admin may change.
 *
 * The birth-order sequence is the one that matters most. Long, Ngah, Alang and
 * the rest vary by family and by region -- some use Alang third, some Teh, some
 * a shorter run entirely -- and a family that sees the wrong word for an uncle
 * they have called Pak Ngah their whole life will not trust anything else the
 * app says. The youngest is always Su and is not part of the list.
 */
function ADM_saveSettings(session, changes) {
  AUTH_requireAdmin(session);
  var applied = {};

  for (var key in changes) {
    if (!Object.prototype.hasOwnProperty.call(changes, key)) continue;
    var kind = ADM_EDITABLE_SETTINGS[key];
    if (!kind) continue;

    var value = ADM_cleanSetting(kind, changes[key]);
    if (value === null) continue;
    ST_setSetting(key, value);
    applied[key] = value;
  }

  ST_audit(session.email, 'save_settings', 'Settings', '', applied);
  ST_invalidate();
  return { status: 'saved', applied: applied };
}

function ADM_cleanSetting(kind, raw) {
  if (kind === 'text') {
    var text = String(raw || '').replace(/^\s+|\s+$/g, '').substring(0, 80);
    return text || null;
  }

  if (kind === 'titles') {
    var parts = String(raw || '').split(',');
    var titles = [];
    for (var i = 0; i < parts.length && titles.length < 12; i++) {
      // Titles are words, not markup: anything else would be rendered straight
      // into a label next to somebody's name.
      var word = parts[i].replace(/[^A-Za-z' -]/g, '').replace(/^\s+|\s+$/g, '');
      if (word) titles.push(word.substring(0, 20));
    }
    return titles.length ? titles.join(',') : null;
  }

  if (kind === 'lang') return CFG.LANGS.indexOf(raw) !== -1 ? raw : null;

  if (kind === 'bool') {
    return (raw === true || String(raw).toUpperCase() === 'TRUE') ? 'TRUE' : 'FALSE';
  }

  if (kind === 'score') {
    var n = parseInt(raw, 10);
    if (isNaN(n) || n < 40 || n > 99) return null;
    return String(n);
  }

  return null;
}

function ADM_parseJson(text) {
  try { return JSON.parse(text); } catch (err) { return null; }
}
