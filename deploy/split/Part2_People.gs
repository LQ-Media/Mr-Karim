/**
 * Pokok Keluarga -- part 2 of 8.
 *
 * Apps Script loads every .gs file into one shared scope, so these parts
 * work together exactly as one file would. Paste this one into a script
 * file named Part2_People.
 *
 * Generated from apps-script/ by tools/build-split-bundle.js -- edit there.
 */

/* ================================================================== *
 * 03_People.gs                                                   *
 * ================================================================== */

/**
 * Writes: people, parent links and marriages.
 *
 * Two rules shape everything here.
 *
 * First, a person is never created on their own. Every new record arrives
 * attached to somebody already in the tree, as their child, parent, spouse or
 * sibling. A floating person is how a family tree quietly splits into two
 * disconnected halves, and refusing to create one removes the problem rather
 * than detecting it later.
 *
 * Second, a write outside the author's own branch becomes a proposal. The
 * payload is stored exactly as submitted and applied unchanged on approval, so
 * what the admin approves is what happens.
 */

var PPL_RELATIONSHIPS = ['child_of', 'parent_of', 'spouse_of', 'sibling_of'];

var PPL_EDITABLE_FIELDS = ['display_name', 'full_name', 'given_name', 'also_known_as',
  'honorific', 'gender', 'birth_date', 'birth_precision', 'birth_place', 'birth_order',
  'is_living', 'death_date', 'death_precision', 'death_place', 'burial_place',
  'email', 'mobile', 'address', 'country', 'occupation', 'notes'];

/**
 * Creates a person, or proposes one.
 *
 * `anchorId` is who they are being attached to and `relationship` is how. When
 * the author may edit the anchor, the record is written immediately; otherwise
 * the whole request is queued for an admin, who gets the same duplicate
 * warnings the author saw.
 */
function PPL_createPerson(session, anchorId, relationship, data, options) {
  AUTH_requireActive(session);
  if (PPL_RELATIONSHIPS.indexOf(relationship) === -1) {
    throw new Error('Unknown relationship: ' + relationship);
  }

  var graph = ST_graph();
  var anchor = graph.people[anchorId];
  if (!anchor) throw new Error('The person you are adding to no longer exists.');

  var clean = PPL_sanitise(data);
  if (!clean.display_name) throw new Error('A name is required.');

  // Offer an existing record before creating a new one, unless the author has
  // already looked at the suggestions and said none of them is the same person.
  if (!(options && options.ignoreDuplicates)) {
    var settings = ST_settings();
    var candidates = MTC_findCandidates(graph, clean, Number(settings.match_suggest_threshold) || 55, 5);
    if (candidates.length) {
      return {
        status: 'possible_duplicate',
        candidates: PPL_describeCandidates(graph, session, candidates),
        pending: { anchorId: anchorId, relationship: relationship, data: clean }
      };
    }
  }

  if (!AUTH_canEditDirectly(session, graph, anchorId)) {
    var change = PPL_queueChange(session, 'create_person', anchorId, {
      anchorId: anchorId, relationship: relationship, data: clean
    }, PPL_summariseCreate(graph, anchor, relationship, clean));
    return { status: 'pending_approval', changeId: change.change_id };
  }

  var created = PPL_applyCreate(session.email, anchorId, relationship, clean);
  return { status: 'created', personId: created.person_id, person: created };
}

/**
 * Writes the first person in an empty tree.
 *
 * Kept separate from PPL_applyCreate because that function requires an anchor,
 * and requiring one is the whole reason floating duplicates cannot happen. This
 * is the single documented exception, guarded by api_startTree.
 */
function PPL_applyRoot(actorEmail, clean) {
  var personId = ST_nextId('People');
  var parsed = MTC_parseName(clean.full_name || clean.display_name);

  var person = {};
  for (var i = 0; i < PPL_EDITABLE_FIELDS.length; i++) {
    person[PPL_EDITABLE_FIELDS[i]] = clean[PPL_EDITABLE_FIELDS[i]] === undefined
      ? '' : clean[PPL_EDITABLE_FIELDS[i]];
  }
  person.person_id = personId;
  person.patronym = parsed.patronym.join(' ');
  person.patronym_type = parsed.type;
  if (!person.gender && parsed.genderHint) person.gender = parsed.genderHint;
  if (!person.gender) person.gender = 'U';
  person.birth_order_source = clean.birth_order ? 'manual' : 'derived';
  person.is_living = clean.is_living === 'FALSE' ? 'FALSE' : 'TRUE';
  person.status = 'active';
  person.created_by = actorEmail;
  person.created_at = ST_now();
  person.updated_by = actorEmail;
  person.updated_at = ST_now();

  ST_append('People', person);
  ST_audit(actorEmail, 'start_tree', 'People', personId, null);
  ST_invalidate();
  return person;
}

/**
 * Performs the write. Shared by the direct path, by approval and by a batch.
 *
 * `alreadyLocked` is passed by a caller that holds the script lock already.
 * Taking it twice in one execution is not reliably reentrant in Apps Script,
 * and a deadlock here would strand someone mid-way through entering a family.
 */
function PPL_applyCreate(actorEmail, anchorId, relationship, clean, alreadyLocked) {
  var lock = alreadyLocked ? null : LockService.getScriptLock();
  if (lock) lock.waitLock(20000);
  try {
    var personId = ST_nextId('People');
    var parsed = MTC_parseName(clean.full_name || clean.display_name);

    var person = {};
    for (var i = 0; i < PPL_EDITABLE_FIELDS.length; i++) {
      var field = PPL_EDITABLE_FIELDS[i];
      person[field] = clean[field] === undefined ? '' : clean[field];
    }
    person.person_id = personId;
    person.patronym = parsed.patronym.join(' ');
    person.patronym_type = parsed.type;
    // A name that says 'binti' tells us the gender when nobody selected one.
    if (!person.gender && parsed.genderHint) person.gender = parsed.genderHint;
    if (!person.gender) person.gender = 'U';
    person.birth_order_source = clean.birth_order ? 'manual' : 'derived';
    person.is_living = clean.is_living === false || clean.is_living === 'FALSE' ? 'FALSE' : 'TRUE';
    person.status = 'active';
    person.merged_into_id = '';
    person.created_by = actorEmail;
    person.created_at = ST_now();
    person.updated_by = actorEmail;
    person.updated_at = ST_now();

    ST_append('People', person);
    PPL_link(actorEmail, anchorId, personId, relationship, clean);
    ST_audit(actorEmail, 'create_person', 'People', personId,
      { anchor: anchorId, relationship: relationship });

    ST_invalidate();
    return person;
  } finally {
    if (lock) lock.releaseLock();
  }
}

/** Creates the parent links or marriage implied by how the person was added. */
function PPL_link(actorEmail, anchorId, personId, relationship, data) {
  var graph = ST_graph();

  if (relationship === 'child_of') {
    var anchorRole = PPL_roleOf(graph.people[anchorId]);
    PPL_addParentLink(actorEmail, personId, anchorId, anchorRole, data.relation_type);
    // A child added to one parent belongs to that parent's current marriage too,
    // which is almost always what the person entering it means.
    var spouses = KIN_spousesOf(graph, anchorId);
    for (var i = 0; i < spouses.length; i++) {
      if (spouses[i].status === 'current') {
        PPL_addParentLink(actorEmail, personId, spouses[i].personId,
          PPL_roleOf(graph.people[spouses[i].personId]), data.relation_type);
        break;
      }
    }
    return;
  }

  if (relationship === 'parent_of') {
    PPL_addParentLink(actorEmail, anchorId, personId, PPL_roleOf(data), data.relation_type);
    return;
  }

  if (relationship === 'spouse_of') {
    PPL_addUnion(actorEmail, anchorId, personId, data);
    return;
  }

  if (relationship === 'sibling_of') {
    var parents = graph.parentsOf[anchorId] || [];
    if (!parents.length) {
      throw new Error('Add their parents first -- a sibling is recorded by sharing parents.');
    }
    for (var p = 0; p < parents.length; p++) {
      PPL_addParentLink(actorEmail, personId, parents[p].parent_id,
        parents[p].parent_role, parents[p].relation_type);
    }
  }
}

function PPL_roleOf(person) {
  if (!person) return 'guardian';
  if (person.gender === 'F') return 'mother';
  if (person.gender === 'M') return 'father';
  return 'guardian';
}

function PPL_addParentLink(actorEmail, childId, parentId, role, relationType) {
  if (childId === parentId) throw new Error('Someone cannot be their own parent.');

  var graph = ST_graph();
  // A cycle would make the ancestor walk run forever and is always a mistake.
  var ancestors = KIN_ancestorMap(graph, parentId);
  if (ancestors[childId]) {
    throw new Error('That would make the family tree loop back on itself.');
  }

  var existing = graph.parentsOf[childId] || [];
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].parent_id === parentId) return existing[i];
  }

  var link = {
    link_id: ST_nextId('Parentage'),
    child_id: childId,
    parent_id: parentId,
    parent_role: role || 'guardian',
    relation_type: relationType || 'biological',
    status: 'active',
    created_by: actorEmail,
    created_at: ST_now()
  };
  ST_append('Parentage', link);
  return link;
}

function PPL_addUnion(actorEmail, aId, bId, data) {
  if (aId === bId) throw new Error('Someone cannot be married to themselves.');

  var graph = ST_graph();
  if (KIN_unionBetween(graph, aId, bId)) {
    throw new Error('That marriage is already recorded.');
  }

  var union = {
    union_id: ST_nextId('Unions'),
    partner_a_id: aId,
    partner_b_id: bId,
    union_type: data.union_type || 'nikah',
    status: data.union_status || 'current',
    start_date: data.union_start_date || '',
    end_date: data.union_end_date || '',
    place: data.union_place || '',
    order_index: (KIN_spousesOf(graph, aId).length + 1),
    notes: data.union_notes || '',
    created_by: actorEmail,
    created_at: ST_now()
  };
  ST_append('Unions', union);
  return union;
}

/* ------------------------------------------------------------------ *
 * Updates
 * ------------------------------------------------------------------ */

function PPL_updatePerson(session, personId, changes) {
  AUTH_requireActive(session);
  var graph = ST_graph();
  var person = graph.people[personId];
  if (!person) throw new Error('That person is no longer in the tree.');

  var clean = PPL_sanitise(changes);
  if (!Object.keys(clean).length) return { status: 'unchanged' };

  if (!AUTH_canEditDirectly(session, graph, personId)) {
    var change = PPL_queueChange(session, 'update_person', personId,
      { personId: personId, changes: clean },
      PPL_summariseUpdate(person, clean));
    return { status: 'pending_approval', changeId: change.change_id };
  }

  PPL_applyUpdate(session.email, personId, clean);
  return { status: 'updated', personId: personId };
}

function PPL_applyUpdate(actorEmail, personId, clean) {
  var before = ST_graph().people[personId];
  var patch = {};
  for (var field in clean) {
    if (Object.prototype.hasOwnProperty.call(clean, field)) patch[field] = clean[field];
  }

  if (patch.full_name || patch.display_name) {
    var parsed = MTC_parseName(patch.full_name || patch.display_name);
    patch.patronym = parsed.patronym.join(' ');
    patch.patronym_type = parsed.type;
  }
  if (patch.birth_order) patch.birth_order_source = 'manual';
  if (patch.is_living === 'FALSE' && !patch.death_date && !before.death_date) {
    patch.death_precision = patch.death_precision || 'unknown';
  }

  patch.updated_by = actorEmail;
  patch.updated_at = ST_now();

  ST_update('People', 'person_id', personId, patch);
  ST_audit(actorEmail, 'update_person', 'People', personId, { changes: clean });
  ST_invalidate();
}

/**
 * Field-level cleaning.
 *
 * Only known fields survive, so nothing a client sends can reach a column it
 * has no business writing -- role, status and merge pointers among them.
 */
function PPL_sanitise(data) {
  var out = {};
  if (!data) return out;

  for (var i = 0; i < PPL_EDITABLE_FIELDS.length; i++) {
    var field = PPL_EDITABLE_FIELDS[i];
    if (data[field] === undefined || data[field] === null) continue;
    var value = data[field];

    if (typeof value === 'string') {
      value = value.replace(/^\s+|\s+$/g, '').substring(0, field === 'notes' ? 5000 : 300);
    }
    if (field === 'gender') {
      value = String(value).toUpperCase();
      if (['M', 'F', 'U'].indexOf(value) === -1) value = 'U';
    }
    if (field === 'is_living') {
      value = (value === true || String(value).toUpperCase() === 'TRUE') ? 'TRUE' : 'FALSE';
    }
    if (field === 'birth_date' || field === 'death_date') {
      value = PPL_cleanDate(value);
      if (value === null) continue;
    }
    if (field === 'birth_order') {
      var n = parseInt(value, 10);
      if (isNaN(n) || n < 1 || n > 30) continue;
      value = n;
    }
    out[field] = value;
  }

  // Carry marriage details through so they reach PPL_addUnion untouched.
  var unionFields = ['union_type', 'union_status', 'union_start_date', 'union_end_date',
                     'union_place', 'union_notes', 'relation_type'];
  for (var u = 0; u < unionFields.length; u++) {
    if (data[unionFields[u]]) out[unionFields[u]] = String(data[unionFields[u]]).substring(0, 200);
  }
  return out;
}

function PPL_cleanDate(value) {
  if (!value) return '';
  var text = String(value).substring(0, 10);
  if (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(text)) return null;
  if (text.length === 4) text += '-01-01';
  if (text.length === 7) text += '-01';
  var year = Number(text.slice(0, 4));
  if (year < 1700 || year > new Date().getFullYear() + 1) return null;
  return text;
}

/* ------------------------------------------------------------------ *
 * Proposals
 * ------------------------------------------------------------------ */

function PPL_queueChange(session, kind, targetId, payload, summary) {
  var change = {
    change_id: ST_nextId('PendingChanges'),
    kind: kind,
    target_id: targetId || '',
    payload_json: JSON.stringify(payload),
    summary: summary,
    requested_by: session.email,
    requested_at: ST_now(),
    status: 'pending',
    reviewed_by: '',
    reviewed_at: '',
    review_note: ''
  };
  ST_append('PendingChanges', change);
  ST_audit(session.email, 'propose_' + kind, 'PendingChanges', change.change_id, payload);
  return change;
}

function PPL_summariseCreate(graph, anchor, relationship, data) {
  var wording = {
    child_of: 'as a child of', parent_of: 'as a parent of',
    spouse_of: 'as the spouse of', sibling_of: 'as a sibling of'
  };
  return 'Add ' + data.display_name + ' ' + wording[relationship] + ' ' + anchor.display_name;
}

function PPL_summariseUpdate(person, changes) {
  var parts = [];
  for (var field in changes) {
    if (Object.prototype.hasOwnProperty.call(changes, field)) {
      parts.push(field.replace(/_/g, ' ') + ' → ' + changes[field]);
    }
  }
  return 'Update ' + person.display_name + ': ' + parts.join(', ');
}

/** Duplicate suggestions, described the way the person entering data needs to
 *  see them: who this is, and how they already connect to the family. */
function PPL_describeCandidates(graph, session, candidates) {
  var out = [];
  var settings = ST_settings();
  for (var i = 0; i < candidates.length; i++) {
    var person = candidates[i].person;
    var father = MTC_fatherOf(graph, person.person_id);
    out.push({
      personId: person.person_id,
      name: person.display_name,
      fullName: person.full_name,
      birthDate: person.birth_date,
      birthPlace: person.birth_place,
      isLiving: person.is_living !== 'FALSE',
      photoId: person.photo_file_id,
      fatherName: father && graph.people[father] ? graph.people[father].display_name : '',
      yourTitle: session.personId
        ? TTL_title(graph, session.personId, person.person_id, session.lang, settings).label
        : '',
      score: candidates[i].score,
      why: PPL_explainSignals(candidates[i].signals)
    });
  }
  return out;
}

/** Turns scoring signals into something a relative can judge for themselves. */
function PPL_explainSignals(signals) {
  var wording = {
    father_matches: 'same father', same_father_record: 'same father on record',
    father_similar: 'similar father name', name_similar: 'very similar name',
    name_partial: 'similar name', nickname_match: 'matches a known nickname',
    birth_date: 'birth date agrees', email: 'same email', mobile: 'same phone number',
    address: 'same address', birth_place: 'same birthplace',
    shared_parent: 'same parents', shared_spouse: 'same spouse', shared_child: 'same child',
    gender_match: ''
  };
  var out = [];
  for (var i = 0; i < signals.length; i++) {
    var text = wording[signals[i].signal];
    if (text && signals[i].points > 0) out.push(text);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Entering several people at once
 * ------------------------------------------------------------------ */

var PPL_BATCH_LIMIT = 25;

/**
 * Adds a whole set of children, or a whole set of siblings, in one go.
 *
 * Entering a family of two hundred one person at a time is the thing most
 * likely to kill a project like this before the tree is ever interesting, and
 * families do not recall themselves one person at a time. They recite a
 * generation in order: the eldest is Osman, then Fatimah, then Rahim.
 *
 * So the rows arrive oldest first and their position becomes their birth order,
 * which is exactly the fact the Malay titles need and the one thing the shape of
 * the tree can never supply. Capturing it as a side effect of how people
 * naturally list their family is far more reliable than asking for it.
 *
 * Every row is still checked against the tree. Where a row might already exist
 * nothing is written at all and the whole batch comes back for the author to
 * resolve, so a half-applied batch can never leave the tree in a state nobody
 * intended.
 */
function PPL_addBatch(session, anchorId, relationship, rows, decisions) {
  AUTH_requireActive(session);
  if (relationship !== 'child_of' && relationship !== 'sibling_of') {
    throw new Error('Only children or siblings can be added in a batch.');
  }
  if (!rows || !rows.length) throw new Error('Nobody was entered.');
  if (rows.length > PPL_BATCH_LIMIT) {
    throw new Error('Please add at most ' + PPL_BATCH_LIMIT + ' people at a time.');
  }

  var graph = ST_graph();
  var anchor = graph.people[anchorId];
  if (!anchor) throw new Error('The person you are adding to no longer exists.');

  var settings = ST_settings();
  var threshold = Number(settings.match_suggest_threshold) || 55;
  var cleaned = [];
  var needsReview = false;

  for (var i = 0; i < rows.length; i++) {
    var clean = PPL_sanitise(rows[i]);
    if (!clean.display_name) continue;

    var decision = (decisions && decisions[String(i)]) || null;
    var entry = { index: i, data: clean, decision: decision, candidates: [] };

    if (!decision) {
      entry.candidates = PPL_describeCandidates(
        graph, session, MTC_findCandidates(graph, clean, threshold, 4));
      if (entry.candidates.length) needsReview = true;
    }
    cleaned.push(entry);
  }

  if (!cleaned.length) throw new Error('Nobody was entered.');
  if (needsReview) {
    return {
      status: 'possible_duplicate',
      rows: cleaned.map(function (e) {
        return { index: e.index, name: e.data.display_name, candidates: e.candidates };
      })
    };
  }

  if (!AUTH_canEditDirectly(session, graph, anchorId)) {
    var change = PPL_queueChange(session, 'add_batch', anchorId,
      { anchorId: anchorId, relationship: relationship, rows: cleaned },
      'Add ' + cleaned.length + ' ' + (relationship === 'child_of' ? 'children' : 'siblings') +
      ' to ' + anchor.display_name);
    return { status: 'pending_approval', changeId: change.change_id };
  }

  return PPL_applyBatch(session.email, anchorId, relationship, cleaned);
}

function PPL_applyBatch(actorEmail, anchorId, relationship, entries) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var created = [];
    var linked = 0;
    var skipped = 0;

    // Continue the numbering from whoever is already recorded, so a generation
    // entered in two sittings still ends up in one sequence.
    var startOrder = PPL_highestBirthOrder(anchorId, relationship);

    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var action = entry.decision ? entry.decision.action : 'create';

      if (action === 'skip') { skipped++; continue; }

      if (action === 'link' && entry.decision.personId) {
        PPL_link(actorEmail, anchorId, entry.decision.personId, relationship, entry.data);
        linked++;
        continue;
      }

      var data = entry.data;
      if (!data.birth_order) {
        data = PPL_withBirthOrder(data, startOrder + created.length + 1);
      }
      var person = PPL_applyCreate(actorEmail, anchorId, relationship, data, true);
      created.push(person.person_id);
    }

    ST_audit(actorEmail, 'add_batch', 'People', anchorId,
      { created: created.length, linked: linked, skipped: skipped });
    ST_invalidate();

    return { status: 'created', created: created.length, linked: linked, skipped: skipped };
  } finally {
    lock.releaseLock();
  }
}

function PPL_withBirthOrder(data, order) {
  var copy = {};
  for (var key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) copy[key] = data[key];
  }
  copy.birth_order = order;
  return copy;
}

/** The highest rank already recorded among the siblings this batch joins. */
function PPL_highestBirthOrder(anchorId, relationship) {
  var graph = ST_graph();
  var existing = relationship === 'child_of'
    ? KIN_childrenOf(graph, anchorId)
    : KIN_siblingsOf(graph, anchorId).concat([anchorId]);

  var highest = 0;
  for (var i = 0; i < existing.length; i++) {
    var person = graph.people[existing[i]];
    var order = person ? Number(person.birth_order) : 0;
    if (order && order > highest) highest = order;
  }
  return highest || existing.length;
}

/**
 * Re-ranks a set of siblings.
 *
 * A generation entered out of order produces wrong titles -- the eldest uncle
 * called Pak Su -- and the family will notice immediately, because these words
 * are used daily. This is the correction, and it is deliberately a direct
 * statement of the order rather than an edit of one person's number, since the
 * ranks only mean anything relative to each other.
 */
function PPL_reorderSiblings(session, parentId, orderedIds) {
  AUTH_requireActive(session);
  var graph = ST_graph();
  if (!graph.people[parentId]) throw new Error('That person is no longer in the tree.');
  if (!AUTH_canEditDirectly(session, graph, parentId)) {
    throw new Error('Only a family tree admin, or someone closer to this family, can reorder them.');
  }

  var children = KIN_childrenOf(graph, parentId);
  for (var i = 0; i < orderedIds.length; i++) {
    if (children.indexOf(orderedIds[i]) === -1) {
      throw new Error('That person is not a child of ' + graph.people[parentId].display_name + '.');
    }
  }
  if (orderedIds.length !== children.length) {
    throw new Error('Every child must be included when reordering.');
  }

  for (var k = 0; k < orderedIds.length; k++) {
    ST_update('People', 'person_id', orderedIds[k], {
      birth_order: k + 1,
      birth_order_source: 'manual',
      updated_by: session.email,
      updated_at: ST_now()
    });
  }

  ST_audit(session.email, 'reorder_siblings', 'People', parentId, { order: orderedIds });
  ST_invalidate();
  return { status: 'reordered', count: orderedIds.length };
}

/* ================================================================== *
 * 04_Photos.gs                                                   *
 * ================================================================== */

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

/* ================================================================== *
 * 05_Relations.gs                                                *
 * ================================================================== */

/**
 * Builds the in-memory relationship graph from raw sheet rows.
 *
 * The whole family is loaded at once and indexed. At family scale -- even a few
 * thousand people -- this costs a handful of Sheet reads and lets every
 * subsequent lookup run against plain objects, which is far cheaper than
 * querying the spreadsheet per person. The result is cached between requests.
 */

/**
 * @param data {{people, parentage, unions, customTitles}} arrays of row objects
 * @return the graph consumed by the kinship engine
 */
function REL_buildGraph(data) {
  var graph = {
    people: {},
    parentsOf: {},
    childrenOf: {},
    unionsOf: {},
    customTitles: data.customTitles || []
  };

  var people = data.people || [];
  for (var i = 0; i < people.length; i++) {
    var person = people[i];
    if (!person.person_id) continue;
    if (person.status === 'merged') continue; // Losers of a merge are followed, not shown.
    graph.people[person.person_id] = person;
  }

  var links = data.parentage || [];
  for (var j = 0; j < links.length; j++) {
    var link = links[j];
    if (link.status === 'removed') continue;
    if (!graph.people[link.child_id] || !graph.people[link.parent_id]) continue;

    if (!graph.parentsOf[link.child_id]) graph.parentsOf[link.child_id] = [];
    graph.parentsOf[link.child_id].push(link);

    if (!graph.childrenOf[link.parent_id]) graph.childrenOf[link.parent_id] = [];
    graph.childrenOf[link.parent_id].push(link);
  }

  var unions = data.unions || [];
  for (var k = 0; k < unions.length; k++) {
    var union = unions[k];
    var a = union.partner_a_id;
    var b = union.partner_b_id;
    if (!graph.people[a] || !graph.people[b]) continue;

    if (!graph.unionsOf[a]) graph.unionsOf[a] = [];
    if (!graph.unionsOf[b]) graph.unionsOf[b] = [];
    graph.unionsOf[a].push(union);
    graph.unionsOf[b].push(union);
  }

  // Children are ordered oldest first everywhere they are displayed, which is
  // also the order the Malay birth-order titles depend on.
  for (var parentId in graph.childrenOf) {
    if (!Object.prototype.hasOwnProperty.call(graph.childrenOf, parentId)) continue;
    graph.childrenOf[parentId].sort(function (x, y) {
      return REL_compareBirth(graph.people[x.child_id], graph.people[y.child_id]);
    });
  }

  for (var pid in graph.unionsOf) {
    if (!Object.prototype.hasOwnProperty.call(graph.unionsOf, pid)) continue;
    graph.unionsOf[pid].sort(function (x, y) {
      return (Number(x.order_index) || 99) - (Number(y.order_index) || 99);
    });
  }

  return graph;
}

function REL_compareBirth(a, b) {
  if (!a || !b) return 0;
  var ao = Number(a.birth_order) || 0;
  var bo = Number(b.birth_order) || 0;
  if (ao && bo) return ao - bo;
  var ad = a.birth_date ? String(a.birth_date) : '';
  var bd = b.birth_date ? String(b.birth_date) : '';
  if (ad && bd) return ad < bd ? -1 : (ad > bd ? 1 : 0);
  if (ad) return -1;
  if (bd) return 1;
  return 0;
}

/**
 * Everyone within `radius` relationship steps of a person.
 *
 * Used both by the me-centred home screen and by the duplicate matcher, where a
 * shared relative is one of the strongest signals that two records are the same
 * human being.
 */
function REL_neighbourhood(graph, personId, radius) {
  var seen = {};
  seen[personId] = 0;
  var frontier = [personId];

  for (var step = 1; step <= (radius || 2); step++) {
    var next = [];
    for (var i = 0; i < frontier.length; i++) {
      var id = frontier[i];
      var touching = KIN_parentsOf(graph, id).concat(KIN_childrenOf(graph, id));

      var spouses = KIN_spousesOf(graph, id);
      for (var s = 0; s < spouses.length; s++) touching.push(spouses[s].personId);

      for (var t = 0; t < touching.length; t++) {
        if (seen[touching[t]] === undefined) {
          seen[touching[t]] = step;
          next.push(touching[t]);
        }
      }
    }
    frontier = next;
  }
  return seen;
}

/**
 * Follows merge redirects to the surviving record.
 *
 * After a merge the losing row stays in the sheet pointing at the winner, so
 * that any link, invite or old bookmark still resolves rather than breaking.
 */
function REL_resolveId(allPeopleById, personId) {
  var hops = 0;
  var current = personId;
  while (current && allPeopleById[current] && allPeopleById[current].merged_into_id && hops < 10) {
    current = allPeopleById[current].merged_into_id;
    hops++;
  }
  return current;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    REL_buildGraph: REL_buildGraph,
    REL_neighbourhood: REL_neighbourhood,
    REL_resolveId: REL_resolveId
  };
}
