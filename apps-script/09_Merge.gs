/**
 * Merging two records that turned out to be one person.
 *
 * A merge is the most destructive thing this app does, so it is built to be
 * survivable. The losing record is never deleted: it stays in the sheet marked
 * `merged` with a pointer to the survivor, so an old link, an invite or a
 * relative's bookmark still resolves instead of breaking. Every field the
 * survivor was missing is filled from the loser rather than discarded, because
 * the duplicate usually exists precisely because someone knew something the
 * first record did not.
 */

/**
 * @param keepId the record that survives
 * @param loseId the record folded into it
 * @param fieldChoices optional per-field overrides picked by the admin
 */
function MRG_merge(session, keepId, loseId, fieldChoices) {
  AUTH_requireAdmin(session);
  if (keepId === loseId) throw new Error('Those are the same record.');

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var graph = ST_graph();
    var keep = graph.people[keepId];
    var lose = graph.people[loseId];
    if (!keep || !lose) throw new Error('One of those records no longer exists.');

    var before = { keep: keep, lose: lose };

    MRG_mergeFields(keep, lose, fieldChoices);
    MRG_repointParentage(keepId, loseId);
    MRG_repointUnions(keepId, loseId);
    MRG_repointReferences(keepId, loseId);

    ST_update('People', 'person_id', loseId, {
      status: 'merged',
      merged_into_id: keepId,
      updated_by: session.email,
      updated_at: ST_now()
    });

    ST_audit(session.email, 'merge_people', 'People', keepId,
      { merged: loseId, before: before });
    ST_invalidate();

    return { status: 'merged', keptId: keepId, removedId: loseId };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Fills the survivor's empty fields from the loser.
 *
 * Only blanks are filled by default: a value someone deliberately entered on
 * the surviving record is never silently replaced. Where both records hold
 * different values the admin's choice decides, and where they made no choice
 * the survivor keeps what it had.
 */
function MRG_mergeFields(keep, lose, fieldChoices) {
  var patch = {};
  var fields = SCHEMA.People;

  for (var i = 0; i < fields.length; i++) {
    var field = fields[i];
    if (['person_id', 'status', 'merged_into_id', 'created_by', 'created_at',
         'updated_by', 'updated_at'].indexOf(field) !== -1) continue;

    var chosen = fieldChoices && fieldChoices[field];
    if (chosen === 'lose' && lose[field] !== '') {
      patch[field] = lose[field];
      continue;
    }
    if (chosen === 'keep') continue;
    if ((keep[field] === '' || keep[field] === undefined) && lose[field] !== '') {
      patch[field] = lose[field];
    }
  }

  // Nicknames are additive: both records may know a name the family uses.
  var aliases = MRG_mergeAliases(keep.also_known_as, lose.also_known_as);
  if (aliases) patch.also_known_as = aliases;

  patch.updated_at = ST_now();
  ST_update('People', 'person_id', keep.person_id, patch);
}

function MRG_mergeAliases(a, b) {
  var seen = {};
  var out = [];
  var parts = (String(a || '') + ',' + String(b || '')).split(',');
  for (var i = 0; i < parts.length; i++) {
    var value = parts[i].replace(/^\s+|\s+$/g, '');
    if (!value) continue;
    var key = value.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    out.push(value);
  }
  return out.join(', ');
}

/**
 * Moves the loser's parent and child links onto the survivor.
 *
 * Links that would duplicate one the survivor already has are retired rather
 * than moved, otherwise the survivor ends up recorded as having four parents.
 */
function MRG_repointParentage(keepId, loseId) {
  var rows = ST_readAll('Parentage');
  var existing = {};
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].status !== 'active') continue;
    if (rows[i].child_id === keepId) existing['c:' + rows[i].parent_id] = true;
    if (rows[i].parent_id === keepId) existing['p:' + rows[i].child_id] = true;
  }

  for (var j = 0; j < rows.length; j++) {
    var row = rows[j];
    if (row.status !== 'active') continue;

    if (row.child_id === loseId) {
      if (existing['c:' + row.parent_id] || row.parent_id === keepId) {
        ST_update('Parentage', 'link_id', row.link_id, { status: 'removed' });
      } else {
        ST_update('Parentage', 'link_id', row.link_id, { child_id: keepId });
        existing['c:' + row.parent_id] = true;
      }
    }

    if (row.parent_id === loseId) {
      if (existing['p:' + row.child_id] || row.child_id === keepId) {
        ST_update('Parentage', 'link_id', row.link_id, { status: 'removed' });
      } else {
        ST_update('Parentage', 'link_id', row.link_id, { parent_id: keepId });
        existing['p:' + row.child_id] = true;
      }
    }
  }
}

function MRG_repointUnions(keepId, loseId) {
  var rows = ST_readAll('Unions');
  var partners = {};
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].partner_a_id === keepId) partners[rows[i].partner_b_id] = true;
    if (rows[i].partner_b_id === keepId) partners[rows[i].partner_a_id] = true;
  }

  for (var j = 0; j < rows.length; j++) {
    var row = rows[j];
    var isA = row.partner_a_id === loseId;
    var isB = row.partner_b_id === loseId;
    if (!isA && !isB) continue;

    var other = isA ? row.partner_b_id : row.partner_a_id;
    if (other === keepId || partners[other]) {
      ST_update('Unions', 'union_id', row.union_id, { status: 'superseded' });
      continue;
    }
    ST_update('Unions', 'union_id', row.union_id,
      isA ? { partner_a_id: keepId } : { partner_b_id: keepId });
    partners[other] = true;
  }
}

/** Logins, custom titles and open merge candidates that pointed at the loser. */
function MRG_repointReferences(keepId, loseId) {
  var users = ST_readAll('Users');
  for (var i = 0; i < users.length; i++) {
    if (users[i].person_id === loseId) {
      ST_update('Users', 'email', users[i].email, { person_id: keepId });
    }
  }

  var titles = ST_readAll('CustomTitles');
  for (var j = 0; j < titles.length; j++) {
    var patch = {};
    if (titles[j].from_person_id === loseId) patch.from_person_id = keepId;
    if (titles[j].to_person_id === loseId) patch.to_person_id = keepId;
    if (Object.keys(patch).length) ST_update('CustomTitles', 'title_id', titles[j].title_id, patch);
  }

  var queue = ST_readAll('MergeQueue');
  for (var k = 0; k < queue.length; k++) {
    if (queue[k].status !== 'open') continue;
    if (queue[k].person_a_id === loseId || queue[k].person_b_id === loseId) {
      ST_update('MergeQueue', 'candidate_id', queue[k].candidate_id,
        { status: 'merged', resolved_at: ST_now() });
    }
  }
}

/* ------------------------------------------------------------------ *
 * The queue
 * ------------------------------------------------------------------ */

/**
 * Re-scans the whole tree for duplicates.
 *
 * Pairs an admin has already dismissed stay dismissed -- being told twice that
 * two people are the same person when you have just confirmed they are not is
 * how review queues get ignored.
 */
function MRG_rebuildQueue(session) {
  AUTH_requireAdmin(session);
  var graph = ST_graph();
  var settings = ST_settings();
  var pairs = MTC_sweep(graph, Number(settings.merge_queue_threshold) || 68);

  var existing = ST_readAll('MergeQueue');
  var known = {};
  for (var i = 0; i < existing.length; i++) {
    known[existing[i].person_a_id + '|' + existing[i].person_b_id] = existing[i];
  }

  var added = [];
  for (var j = 0; j < pairs.length; j++) {
    var pair = pairs[j];
    var key = pair.a + '|' + pair.b;
    if (known[key]) continue;

    added.push({
      candidate_id: ST_nextId('MergeQueue'),
      person_a_id: pair.a,
      person_b_id: pair.b,
      score: pair.score,
      signals_json: JSON.stringify(pair.signals),
      detected_at: ST_now(),
      status: 'open',
      resolved_by: '',
      resolved_at: ''
    });
  }

  if (added.length) ST_appendMany('MergeQueue', added);
  ST_audit(session.email, 'rebuild_merge_queue', 'MergeQueue', '',
    { scanned: pairs.length, added: added.length });
  return { found: pairs.length, added: added.length };
}

function MRG_dismiss(session, candidateId, note) {
  AUTH_requireAdmin(session);
  ST_update('MergeQueue', 'candidate_id', candidateId, {
    status: 'rejected', resolved_by: session.email, resolved_at: ST_now()
  });
  ST_audit(session.email, 'dismiss_merge', 'MergeQueue', candidateId, { note: note || '' });
  return { status: 'dismissed' };
}
