/**
 * Pokok Keluarga -- part 5 of 8.
 *
 * Apps Script loads every .gs file into one shared scope, so these parts
 * work together exactly as one file would. Paste this one into a script
 * file named Part5_Admin.
 *
 * Generated from apps-script/ by tools/build-split-bundle.js -- edit there.
 */

/* ================================================================== *
 * 10_Admin.gs                                                    *
 * ================================================================== */

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

/* ================================================================== *
 * 11_Api.gs                                                      *
 * ================================================================== */

/**
 * The call surface the browser talks to.
 *
 * Every function takes the caller's Google ID token as its first argument and
 * verifies it before doing anything. There is no session cookie and no trusted
 * client state: the browser proves who it is on each call, or it gets nothing.
 *
 * Errors are returned as objects rather than thrown across the bridge, so the
 * interface can show the message instead of a generic failure.
 */

function API_run(idToken, handler) {
  try {
    var session = AUTH_session(idToken);
    return { ok: true, data: handler(session) };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

/* ------------------------------------------------------------------ *
 * Reading
 * ------------------------------------------------------------------ */

/** Who the caller is, and what state their account is in. */
function api_me(idToken) {
  return API_run(idToken, function (session) {
    var settings = ST_settings();
    var out = {
      email: session.email,
      role: session.role,
      lang: session.lang,
      isAdmin: session.isAdmin,
      isPending: session.isPending,
      canInvite: session.canInvite,
      familyName: settings.family_name,
      googlePhotos: String(settings.enable_google_photos).toUpperCase() === 'TRUE',
      personId: session.personId,
      needsBinding: !session.isPending && !session.personId,
      treeSize: API_treeSize()
    };

    // The graph is only built for someone who has not been placed in the tree
    // yet, which is a first visit and nothing else. Everyone else gets the
    // shell now and waits for the graph on api_view, with the app already on
    // screen rather than a splash.
    if (out.needsBinding) out.unclaimed = API_unclaimedPeople(ST_graph(), session);
    if (session.isAdmin) {
      out.adminCounts = {
        pendingChanges: API_countPending('PendingChanges'),
        pendingUsers: API_countPendingUsers(),
        mergeQueue: API_countOpenMerges()
      };
    }
    return out;
  });
}

/**
 * The me-centred view: one person in the middle, their immediate family around
 * them, every card carrying the title the VIEWER would use.
 *
 * `focusId` moves the centre without changing whose point of view the titles
 * come from. Opening your uncle still shows his children as your cousins, not
 * as his children -- so the second label says how they sit relative to the
 * person on screen, which is what makes exploring a distant branch legible.
 */
function api_view(idToken, focusId) {
  return API_run(idToken, function (session) {
    AUTH_requireActive(session);
    var graph = ST_graph();
    var settings = ST_settings();
    var centre = focusId && graph.people[focusId] ? focusId : session.personId;
    if (!graph.people[centre]) throw new Error('That person is no longer in the tree.');

    var scope = AUTH_editableScope(graph, session.personId);

    function card(personId, roleHere) {
      var person = graph.people[personId];
      if (!person) return null;
      var title = TTL_title(graph, session.personId, personId, session.lang, settings);
      return {
        personId: personId,
        name: person.display_name,
        fullName: person.full_name,
        gender: person.gender,
        birthDate: person.birth_date,
        birthPrecision: person.birth_precision,
        isLiving: person.is_living !== 'FALSE',
        deathDate: person.death_date,
        hasPhoto: !!person.photo_thumb_id,
        yourTitle: title.label,
        titleScript: title.script,
        titleSource: title.source,
        roleHere: roleHere,
        editable: session.isAdmin || !!scope[personId],
        isYou: personId === session.personId
      };
    }

    function cards(ids, roleHere) {
      var out = [];
      for (var i = 0; i < ids.length; i++) {
        var made = card(ids[i], roleHere);
        if (made) out.push(made);
      }
      return out;
    }

    var parents = KIN_parentsOf(graph, centre);
    var children = KIN_childrenOf(graph, centre);
    var siblings = KIN_siblingsOf(graph, centre);

    siblings.sort(function (a, b) {
      return REL_compareBirth(graph.people[a], graph.people[b]);
    });

    var spouseEntries = KIN_spousesOf(graph, centre);
    var spouses = [];
    for (var s = 0; s < spouseEntries.length; s++) {
      var made = card(spouseEntries[s].personId, API_spouseRole(spouseEntries[s], graph, centre));
      if (made) {
        made.unionStatus = spouseEntries[s].status;
        spouses.push(made);
      }
    }

    return {
      centre: card(centre, 'centre'),
      viewerPersonId: session.personId,
      parents: cards(parents, 'parent'),
      spouses: spouses,
      siblings: cards(siblings, 'sibling'),
      children: cards(children, 'child'),
      counts: {
        grandparents: API_countGeneration(graph, centre, 2),
        grandchildren: API_countDescendants(graph, centre, 2)
      }
    };
  });
}

function API_spouseRole(entry, graph, centreId) {
  var person = graph.people[entry.personId === centreId ? centreId : entry.personId];
  var word = person && person.gender === 'F' ? 'wife' : 'husband';
  if (entry.status === 'divorced') return 'former ' + word;
  if (entry.status === 'widowed') return 'late ' + word;
  return word;
}

/** Everything recorded about one person, plus how they connect. */
function api_person(idToken, personId) {
  return API_run(idToken, function (session) {
    AUTH_requireActive(session);
    var graph = ST_graph();
    var settings = ST_settings();
    var person = graph.people[personId];
    if (!person) throw new Error('That person is no longer in the tree.');

    var title = TTL_title(graph, session.personId, personId, session.lang, settings);
    var out = {
      personId: personId,
      yourTitle: title.label,
      titleScript: title.script,
      titleSource: title.source,
      editable: AUTH_canEditDirectly(session, graph, personId),
      hasPhoto: !!person.photo_file_id
    };

    // Worked out here rather than in the browser, so the button offered and the
    // answer given on pressing it come from the same rule.
    var blocked = PPL_deleteBlockedReason(graph, session, personId);
    out.deletable = !blocked;
    out.deleteBlockedReason = blocked;

    var fields = ['display_name', 'full_name', 'also_known_as', 'honorific', 'gender',
      'birth_date', 'birth_precision', 'birth_place', 'birth_order', 'is_living',
      'death_date', 'death_precision', 'death_place', 'burial_place', 'email',
      'mobile', 'address', 'country', 'occupation', 'notes'];
    for (var i = 0; i < fields.length; i++) out[fields[i]] = person[fields[i]];

    // The derived rank, shown so a family can see why a title came out as it
    // did and correct the order rather than argue with the app.
    out.derivedBirthOrder = KIN_birthOrder(graph, personId);
    out.siblingCount = KIN_siblingCount(graph, personId);
    return out;
  });
}

/**
 * The whole family as a chart: where each card sits, and what joins them.
 *
 * A me-centred list answers "who is around me"; this answers "how does all of
 * this fit together", which is the question families reach for a wall chart to
 * settle. Titles are still worked out for whoever is reading, so the same chart
 * says Atuk to one person and Bapa Mertua to another.
 *
 * Positions saved by an admin come back as they were arranged. Anyone the
 * family has not placed by hand is positioned by the layout engine, so a person
 * added this morning appears somewhere sensible rather than at the origin.
 */
function api_map(idToken) {
  return API_run(idToken, function (session) {
    AUTH_requireActive(session);
    var graph = ST_graph();
    var settings = ST_settings();
    var layout = LAY_compute(graph, {});

    var people = [];
    var positions = {};

    for (var id in graph.people) {
      if (!Object.prototype.hasOwnProperty.call(graph.people, id)) continue;
      var person = graph.people[id];
      var title = TTL_title(graph, session.personId, id, session.lang, settings);

      people.push({
        personId: id,
        name: person.display_name,
        gender: person.gender,
        birthDate: person.birth_date,
        isLiving: person.is_living !== 'FALSE',
        hasPhoto: !!person.photo_thumb_id,
        yourTitle: title.label,
        titleScript: title.script,
        isYou: id === session.personId
      });

      var savedX = Number(person.map_x);
      var savedY = Number(person.map_y);
      var placed = person.map_x !== '' && person.map_y !== '' &&
                   !isNaN(savedX) && !isNaN(savedY);
      positions[id] = placed
        ? { x: savedX, y: savedY }
        : { x: layout.nodes[id].x, y: layout.nodes[id].y };
    }

    var units = [];
    for (var u = 0; u < layout.units.length; u++) {
      units.push({
        partners: layout.units[u].partners,
        children: layout.units[u].children,
        unionId: layout.units[u].union ? layout.units[u].union.union_id : '',
        unionStatus: layout.units[u].union ? layout.units[u].union.status : ''
      });
    }

    return {
      people: people,
      positions: positions,
      units: units,
      metrics: layout.metrics,
      viewerPersonId: session.personId,
      canSaveLayout: session.isAdmin
    };
  });
}

/**
 * Saves an arrangement for the whole family.
 *
 * Restricted to admins because there is one chart and it is shared: a relative
 * tidying their own corner should not rearrange everyone else's. Members drag
 * freely and their arrangement stays in their own browser until an admin
 * commits one.
 */
function api_saveMapLayout(idToken, positions) {
  return API_run(idToken, function (session) {
    AUTH_requireAdmin(session);
    var graph = ST_graph();
    var saved = 0;

    for (var id in positions) {
      if (!Object.prototype.hasOwnProperty.call(positions, id)) continue;
      if (!graph.people[id]) continue;

      var x = Number(positions[id].x);
      var y = Number(positions[id].y);
      if (isNaN(x) || isNaN(y)) continue;
      // A card dragged far outside any plausible canvas is a bug, not a choice.
      if (Math.abs(x) > 500000 || Math.abs(y) > 500000) continue;

      ST_update('People', 'person_id', id, {
        map_x: Math.round(x), map_y: Math.round(y)
      });
      saved++;
    }

    ST_audit(session.email, 'save_map_layout', 'People', '', { count: saved });
    ST_invalidate();
    return { status: 'saved', count: saved };
  });
}

/** Clears the saved arrangement so the layout engine places everyone again. */
function api_resetMapLayout(idToken) {
  return API_run(idToken, function (session) {
    AUTH_requireAdmin(session);
    var people = ST_readAll('People');
    var cleared = 0;
    for (var i = 0; i < people.length; i++) {
      if (people[i].map_x === '' && people[i].map_y === '') continue;
      ST_update('People', 'person_id', people[i].person_id, { map_x: '', map_y: '' });
      cleared++;
    }
    ST_audit(session.email, 'reset_map_layout', 'People', '', { count: cleared });
    ST_invalidate();
    return { status: 'reset', count: cleared };
  });
}

function api_search(idToken, query) {
  return API_run(idToken, function (session) {
    AUTH_requireActive(session);
    var graph = ST_graph();
    var settings = ST_settings();
    var needle = MTC_normalise(query);
    if (needle.length < 2) return [];

    var out = [];
    for (var id in graph.people) {
      if (!Object.prototype.hasOwnProperty.call(graph.people, id)) continue;
      var person = graph.people[id];
      var haystack = MTC_normalise(
        person.display_name + ' ' + person.full_name + ' ' + (person.also_known_as || ''));
      if (haystack.indexOf(needle) === -1) continue;

      out.push({
        personId: id,
        name: person.display_name,
        fullName: person.full_name,
        birthDate: person.birth_date,
        isLiving: person.is_living !== 'FALSE',
        hasPhoto: !!person.photo_thumb_id,
        yourTitle: TTL_title(graph, session.personId, id, session.lang, settings).label
      });
      if (out.length >= 40) break;
    }
    return out;
  });
}

function api_thumbnails(idToken, personIds) {
  return API_run(idToken, function (session) {
    return PHO_thumbnails(session, personIds || []);
  });
}

function api_photo(idToken, personId) {
  return API_run(idToken, function (session) { return PHO_full(session, personId); });
}

/* ------------------------------------------------------------------ *
 * Writing
 * ------------------------------------------------------------------ */

function api_addPerson(idToken, anchorId, relationship, data, options) {
  return API_run(idToken, function (session) {
    return PPL_createPerson(session, anchorId, relationship, data, options);
  });
}

function api_updatePerson(idToken, personId, changes) {
  return API_run(idToken, function (session) {
    return PPL_updatePerson(session, personId, changes);
  });
}

function api_deletePerson(idToken, personId) {
  return API_run(idToken, function (session) {
    return PPL_deletePerson(session, personId);
  });
}

/** Links a person who is already in the tree, instead of creating a duplicate. */
function api_linkExisting(idToken, anchorId, relationship, existingPersonId, data) {
  return API_run(idToken, function (session) {
    AUTH_requireActive(session);
    var graph = ST_graph();
    if (!graph.people[anchorId] || !graph.people[existingPersonId]) {
      throw new Error('One of those people is no longer in the tree.');
    }

    if (!AUTH_canEditDirectly(session, graph, anchorId) &&
        !AUTH_canEditDirectly(session, graph, existingPersonId)) {
      var kind = relationship === 'spouse_of' ? 'add_union' : 'add_parentage';
      var payload = relationship === 'spouse_of'
        ? { aId: anchorId, bId: existingPersonId, data: data || {} }
        : API_parentagePayload(graph, anchorId, relationship, existingPersonId, data);
      var change = PPL_queueChange(session, kind, anchorId, payload,
        'Connect ' + graph.people[existingPersonId].display_name + ' to ' +
        graph.people[anchorId].display_name);
      return { status: 'pending_approval', changeId: change.change_id };
    }

    if (relationship === 'spouse_of') {
      PPL_addUnion(session.email, anchorId, existingPersonId, data || {});
    } else {
      var p = API_parentagePayload(graph, anchorId, relationship, existingPersonId, data);
      PPL_addParentLink(session.email, p.childId, p.parentId, p.role, p.relationType);
    }
    ST_invalidate();
    return { status: 'linked' };
  });
}

function API_parentagePayload(graph, anchorId, relationship, otherId, data) {
  if (relationship === 'child_of') {
    return {
      childId: otherId, parentId: anchorId,
      role: PPL_roleOf(graph.people[anchorId]),
      relationType: (data && data.relation_type) || 'biological'
    };
  }
  if (relationship === 'parent_of') {
    return {
      childId: anchorId, parentId: otherId,
      role: PPL_roleOf(graph.people[otherId]),
      relationType: (data && data.relation_type) || 'biological'
    };
  }
  throw new Error('That connection cannot be made this way.');
}

/** Several children or siblings at once, entered oldest first. */
function api_addBatch(idToken, anchorId, relationship, rows, decisions) {
  return API_run(idToken, function (session) {
    return PPL_addBatch(session, anchorId, relationship, rows, decisions);
  });
}

/** Re-ranks a set of siblings, which is what decides their Malay titles. */
function api_reorderSiblings(idToken, parentId, orderedIds) {
  return API_run(idToken, function (session) {
    return PPL_reorderSiblings(session, parentId, orderedIds);
  });
}

function api_settings(idToken) {
  return API_run(idToken, function (session) { return ADM_settings(session); });
}

function api_saveSettings(idToken, changes) {
  return API_run(idToken, function (session) { return ADM_saveSettings(session, changes); });
}

function api_uploadPhoto(idToken, personId, payload) {
  return API_run(idToken, function (session) { return PHO_upload(session, personId, payload); });
}

/* ---- Google Photos ---- */

function api_photosStart(idToken, personId) {
  return API_run(idToken, function (session) { return PIK_start(session, personId); });
}

function api_photosPoll(idToken, sessionId) {
  return API_run(idToken, function (session) { return PIK_poll(session, sessionId); });
}

function api_photosImport(idToken, sessionId, personId) {
  return API_run(idToken, function (session) {
    return PIK_import(session, sessionId, personId);
  });
}

function api_setLanguage(idToken, lang) {
  return API_run(idToken, function (session) { return ADM_setLanguage(session, lang); });
}

function api_setCustomTitle(idToken, toPersonId, label, scope, lang) {
  return API_run(idToken, function (session) {
    return ADM_setCustomTitle(session, toPersonId, label, scope, lang);
  });
}

function api_claimPerson(idToken, personId) {
  return API_run(idToken, function (session) { return ADM_bindSelf(session, personId); });
}

function api_invite(idToken, email, prebindPersonId) {
  return API_run(idToken, function (session) {
    return ADM_invite(session, email, prebindPersonId);
  });
}

/* ------------------------------------------------------------------ *
 * Admin
 * ------------------------------------------------------------------ */

function api_adminQueues(idToken) {
  return API_run(idToken, function (session) {
    AUTH_requireAdmin(session);
    return {
      changes: ADM_pendingChanges(session),
      users: ADM_pendingUsers(session),
      merges: API_mergeQueue(session)
    };
  });
}

function API_mergeQueue(session) {
  var graph = ST_graph();
  var rows = ST_readAll('MergeQueue');
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].status !== 'open') continue;
    var a = graph.people[rows[i].person_a_id];
    var b = graph.people[rows[i].person_b_id];
    if (!a || !b) continue;
    out.push({
      candidateId: rows[i].candidate_id,
      score: Number(rows[i].score),
      signals: ADM_parseJson(rows[i].signals_json) || [],
      a: API_mergeSide(graph, a),
      b: API_mergeSide(graph, b)
    });
  }
  out.sort(function (x, y) { return y.score - x.score; });
  return out;
}

function API_mergeSide(graph, person) {
  var fatherId = MTC_fatherOf(graph, person.person_id);
  return {
    personId: person.person_id,
    name: person.display_name,
    fullName: person.full_name,
    gender: person.gender,
    birthDate: person.birth_date,
    birthPlace: person.birth_place,
    isLiving: person.is_living !== 'FALSE',
    fatherName: fatherId && graph.people[fatherId] ? graph.people[fatherId].display_name : '',
    childCount: KIN_childrenOf(graph, person.person_id).length,
    spouseCount: KIN_spousesOf(graph, person.person_id).length,
    createdBy: person.created_by,
    createdAt: person.created_at
  };
}

function api_approveChange(idToken, changeId, note) {
  return API_run(idToken, function (session) { return ADM_approve(session, changeId, note); });
}

function api_rejectChange(idToken, changeId, note) {
  return API_run(idToken, function (session) { return ADM_reject(session, changeId, note); });
}

function api_approveUser(idToken, email, personId, role) {
  return API_run(idToken, function (session) {
    return ADM_approveUser(session, email, personId, role);
  });
}

function api_merge(idToken, keepId, loseId, fieldChoices) {
  return API_run(idToken, function (session) {
    return MRG_merge(session, keepId, loseId, fieldChoices);
  });
}

function api_dismissMerge(idToken, candidateId, note) {
  return API_run(idToken, function (session) { return MRG_dismiss(session, candidateId, note); });
}

function api_rebuildMergeQueue(idToken) {
  return API_run(idToken, function (session) { return MRG_rebuildQueue(session); });
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/**
 * People a newly admitted account might be.
 *
 * Offered on first sign-in so someone the family already added claims that
 * record instead of creating a second copy of themselves -- the duplicate that
 * is hardest to spot later, because both copies look equally real.
 */
function API_unclaimedPeople(graph, session) {
  var users = ST_readAll('Users');
  var claimed = {};
  for (var i = 0; i < users.length; i++) {
    if (users[i].person_id) claimed[users[i].person_id] = true;
  }

  var localPart = session.email.split('@')[0].replace(/[._\-0-9]/g, ' ');
  var guess = { full_name: session.name || localPart, display_name: session.name || localPart };
  var ranked = MTC_findCandidates(graph, guess, 40, 6);

  var out = [];
  for (var r = 0; r < ranked.length; r++) {
    if (claimed[ranked[r].person.person_id]) continue;
    out.push({
      personId: ranked[r].person.person_id,
      name: ranked[r].person.display_name,
      birthDate: ranked[r].person.birth_date,
      score: ranked[r].score
    });
  }
  return out;
}

/**
 * How many people are in the tree.
 *
 * Counted from the People tab rather than from the graph, because this is the
 * first call every visit makes and building the graph means reading four tabs
 * and resolving every link -- seconds on a cold deployment, spent before
 * anything appears on screen. The same two statuses REL_buildGraph drops are
 * dropped here, so the two can never disagree about who counts.
 */
function API_treeSize() {
  var people = ST_readAll('People');
  var count = 0;
  for (var i = 0; i < people.length; i++) {
    if (!people[i].person_id) continue;
    if (people[i].status === 'merged' || people[i].status === 'deleted') continue;
    count++;
  }
  return count;
}

function API_countPending(tab) {
  var rows = ST_readAll(tab);
  var n = 0;
  for (var i = 0; i < rows.length; i++) if (rows[i].status === 'pending') n++;
  return n;
}

function API_countPendingUsers() {
  var rows = ST_readAll('Users');
  var n = 0;
  for (var i = 0; i < rows.length; i++) if (rows[i].role === 'pending') n++;
  return n;
}

function API_countOpenMerges() {
  var rows = ST_readAll('MergeQueue');
  var n = 0;
  for (var i = 0; i < rows.length; i++) if (rows[i].status === 'open') n++;
  return n;
}

function API_countGeneration(graph, personId, up) {
  var map = KIN_ancestorMap(graph, personId, up);
  var n = 0;
  for (var id in map) {
    if (Object.prototype.hasOwnProperty.call(map, id) && map[id].depth === up) n++;
  }
  return n;
}

function API_countDescendants(graph, personId, down) {
  var frontier = [personId];
  for (var step = 0; step < down; step++) {
    var next = [];
    for (var i = 0; i < frontier.length; i++) {
      next = next.concat(KIN_childrenOf(graph, frontier[i]));
    }
    frontier = next;
  }
  return frontier.length;
}

/**
 * Creates the very first person and binds the caller to them.
 *
 * The only way a person is ever created without being attached to someone else,
 * and it is available only to an admin, only while the tree is empty. Everyone
 * after this arrives through a relative.
 */
function api_startTree(idToken, data) {
  return API_run(idToken, function (session) {
    AUTH_requireAdmin(session);
    var graph = ST_graph();
    if (Object.keys(graph.people).length) {
      throw new Error('The family tree has already been started.');
    }

    var clean = PPL_sanitise(data);
    if (!clean.display_name) throw new Error('A name is required.');

    var person = PPL_applyRoot(session.email, clean);
    ST_update('Users', 'email', session.email, { person_id: person.person_id });
    return { status: 'created', personId: person.person_id };
  });
}
