/**
 * Pokok Keluarga -- part 3 of 8.
 *
 * Apps Script loads every .gs file into one shared scope, so these parts
 * work together exactly as one file would. Paste this one into a script
 * file named Part3_Kinship.
 *
 * Generated from apps-script/ by tools/build-split-bundle.js -- edit there.
 */

/* ================================================================== *
 * 06_Kinship.gs                                                  *
 * ================================================================== */

/**
 * Kinship engine.
 *
 * Turns a pair of people into the title one of them would use for the other.
 *
 * The database stores only neutral facts -- X fathered Y, A married B. Every
 * title in the interface is derived here, per viewer, at read time. "Uncle" is
 * not a property of a person; it is a property of a pair, and it changes
 * depending on who is looking.
 *
 * This file is plain ES5-compatible JavaScript with no Apps Script APIs, so the
 * same source is loaded directly by the Node test suite.
 */

/* ------------------------------------------------------------------ *
 * Ancestor traversal
 * ------------------------------------------------------------------ */

var KIN_MAX_DEPTH = 12;

/**
 * Walks up from a person through blood and adoptive parents.
 *
 * Returns a map from ancestor id to { depth, side, path }, where `path` is the
 * chain of ids from the starting person up to that ancestor inclusive, and
 * `side` is whether the first step went through the father or the mother.
 * Where an ancestor is reachable by several routes the shortest is kept, and a
 * person appearing on both sides of the family is marked 'both'.
 *
 * Step and foster links are deliberately not followed. A step-father's brother
 * is not your uncle by blood, and treating him as one would make two unrelated
 * families appear to be cousins.
 */
function KIN_ancestorMap(graph, startId, maxDepth) {
  var limit = maxDepth || KIN_MAX_DEPTH;
  var found = {};
  found[startId] = { depth: 0, side: 'self', path: [startId] };

  var frontier = [{ id: startId, depth: 0, side: 'self', path: [startId] }];

  while (frontier.length) {
    var next = [];
    for (var i = 0; i < frontier.length; i++) {
      var node = frontier[i];
      if (node.depth >= limit) continue;

      var links = graph.parentsOf[node.id] || [];
      for (var j = 0; j < links.length; j++) {
        var link = links[j];
        if (link.relation_type !== 'biological' && link.relation_type !== 'adoptive') continue;

        var side = node.depth === 0
          ? (link.parent_role === 'mother' ? 'maternal' : 'paternal')
          : node.side;

        var existing = found[link.parent_id];
        if (existing) {
          // Reachable two ways: record that the two sides converge, but keep
          // the shorter path. Cousin marriage makes this ordinary, not exotic.
          if (existing.side !== side && existing.side !== 'both') existing.side = 'both';
          if (existing.depth <= node.depth + 1) continue;
        }

        var entry = {
          depth: node.depth + 1,
          side: side,
          path: node.path.concat([link.parent_id])
        };
        found[link.parent_id] = entry;
        next.push({ id: link.parent_id, depth: entry.depth, side: side, path: entry.path });
      }
    }
    frontier = next;
  }
  return found;
}

/**
 * The closest ancestor shared by two people.
 *
 * Preference order: fewest total steps first, then the most balanced split.
 * Balance matters -- between a shared grandparent (2 up, 2 down: first cousins)
 * and a shared great-grandparent reached lopsidedly, the balanced one describes
 * the real relationship.
 */
function KIN_commonAncestor(egoMap, targetMap) {
  var best = null;
  for (var id in egoMap) {
    if (!Object.prototype.hasOwnProperty.call(egoMap, id)) continue;
    if (!targetMap[id]) continue;

    var up = egoMap[id].depth;
    var down = targetMap[id].depth;
    var total = up + down;
    var skew = Math.abs(up - down);

    if (!best || total < best.total || (total === best.total && skew < best.skew)) {
      best = {
        ancestorId: id,
        up: up,
        down: down,
        total: total,
        skew: skew,
        side: egoMap[id].side,
        egoPath: egoMap[id].path,
        targetPath: targetMap[id].path
      };
    }
  }
  return best;
}

/* ------------------------------------------------------------------ *
 * Relationship classification
 * ------------------------------------------------------------------ */

/**
 * Works out how `targetId` is related to `egoId`.
 *
 * Returns a language-neutral descriptor. Naming it is a separate step, because
 * the same structural fact is named differently in Malay, English and Arabic --
 * and Arabic in particular needs to know which side of the family the link runs
 * through, which is why `side` is carried all the way here.
 */
function KIN_relate(graph, egoId, targetId) {
  if (!egoId || !targetId) return { kind: 'unrelated' };
  if (egoId === targetId) return { kind: 'self' };

  var target = graph.people[targetId];
  if (!target) return { kind: 'unrelated' };

  // 1. Married to each other.
  var union = KIN_unionBetween(graph, egoId, targetId);
  if (union) {
    return {
      kind: 'spouse',
      gender: target.gender,
      unionStatus: union.status,
      unionOrder: union.order_index,
      target: targetId
    };
  }

  // 2. Related by blood or adoption.
  var egoMap = KIN_ancestorMap(graph, egoId);
  var targetMap = KIN_ancestorMap(graph, targetId);
  var lca = KIN_commonAncestor(egoMap, targetMap);

  if (lca) {
    return KIN_classifyBlood(graph, egoId, targetId, lca);
  }

  // 3. A step relationship. Checked before the general in-law search because a
  //    spouse's child is a step-child specifically, not merely somebody related
  //    to the person you married.
  var step = KIN_findStep(graph, egoId, targetId);
  if (step) return step;

  // 4. Related through a marriage.
  var inLaw = KIN_findInLaw(graph, egoId, targetId, egoMap, targetMap);
  if (inLaw) return inLaw;

  return { kind: 'unrelated', target: targetId, gender: target.gender };
}

function KIN_classifyBlood(graph, egoId, targetId, lca) {
  var target = graph.people[targetId];
  var up = lca.up;
  var down = lca.down;

  var base = {
    kind: 'blood',
    up: up,
    down: down,
    side: lca.side,
    gender: target.gender,
    ancestorId: lca.ancestorId,
    target: targetId
  };

  // Direct line down: child, grandchild, great-grandchild.
  if (up === 0) {
    base.type = 'descendant';
    base.generations = down;
    return base;
  }

  // Direct line up: parent, grandparent, great-grandparent.
  if (down === 0) {
    base.type = 'ancestor';
    base.generations = up;
    return base;
  }

  // Siblings.
  if (up === 1 && down === 1) {
    base.type = 'sibling';
    var shared = KIN_sharedParents(graph, egoId, targetId);
    base.full = shared.length >= 2;
    base.halfVia = shared.length === 1 ? shared[0].parent_role : null;
    base.elder = KIN_isElder(graph, targetId, egoId);
    return base;
  }

  // A sibling of an ancestor: uncle, aunt, great-uncle.
  if (down === 1) {
    base.type = 'auncle';
    base.generations = up - 1;
    // The Malay title depends on where this person ranks among their own
    // siblings, so the ranking is resolved here rather than at naming time.
    base.birthOrder = KIN_birthOrder(graph, targetId);
    base.siblingCount = KIN_siblingCount(graph, targetId);
    base.linkParentId = lca.egoPath[up - 1];
    return base;
  }

  // A descendant of a sibling: nephew, niece, great-nephew.
  if (up === 1) {
    base.type = 'nibling';
    base.generations = down - 1;
    base.linkSiblingId = lca.targetPath[down - 1];
    return base;
  }

  // Cousins. Degree counts shared-ancestor distance, removal counts the
  // generation gap between the two branches.
  base.type = 'cousin';
  base.degree = Math.min(up, down) - 1;
  base.removed = Math.abs(up - down);
  base.elderBranch = up > down;
  // Which uncle or aunt this cousin descends from -- Arabic names cousins after
  // that person ('ibn al-khal' is specifically a maternal uncle's son).
  base.linkAuncleId = lca.targetPath[down - 1];
  base.linkAuncle = graph.people[base.linkAuncleId] || null;
  return base;
}

/* ------------------------------------------------------------------ *
 * Relationships created by marriage
 * ------------------------------------------------------------------ */

function KIN_findInLaw(graph, egoId, targetId, egoMap, targetMap) {
  var target = graph.people[targetId];

  // The target is married to a blood relative of mine.
  var targetSpouses = KIN_spousesOf(graph, targetId);
  for (var i = 0; i < targetSpouses.length; i++) {
    var spouseId = targetSpouses[i].personId;
    var viaMap = KIN_ancestorMap(graph, spouseId);
    var lca = KIN_commonAncestor(egoMap, viaMap);
    if (lca) {
      var viaRel = KIN_classifyBlood(graph, egoId, spouseId, lca);
      return {
        kind: 'in_law',
        direction: 'spouse_of_relative',
        gender: target.gender,
        via: viaRel,
        viaPersonId: spouseId,
        target: targetId
      };
    }
  }

  // The target is a blood relative of the person I am married to.
  var mySpouses = KIN_spousesOf(graph, egoId);
  for (var k = 0; k < mySpouses.length; k++) {
    var mySpouseId = mySpouses[k].personId;
    var spouseMap = KIN_ancestorMap(graph, mySpouseId);
    var lca2 = KIN_commonAncestor(spouseMap, targetMap);
    if (lca2) {
      var rel2 = KIN_classifyBlood(graph, mySpouseId, targetId, lca2);
      return {
        kind: 'in_law',
        direction: 'relative_of_spouse',
        gender: target.gender,
        via: rel2,
        viaPersonId: mySpouseId,
        target: targetId
      };
    }
  }

  // The target is married to a relative of the person I am married to. Two men
  // married to two sisters are biras to each other -- a relationship Malay
  // names, English cannot, and which the Salim family's own trip manifest had
  // to leave blank because a flat list has nowhere to put it.
  for (var m = 0; m < mySpouses.length; m++) {
    var mySpouseMap = KIN_ancestorMap(graph, mySpouses[m].personId);
    for (var t = 0; t < targetSpouses.length; t++) {
      if (targetSpouses[t].personId === egoId) continue;
      var theirMap = KIN_ancestorMap(graph, targetSpouses[t].personId);
      var lca3 = KIN_commonAncestor(mySpouseMap, theirMap);
      if (lca3) {
        return {
          kind: 'in_law',
          direction: 'spouse_of_spouses_relative',
          gender: target.gender,
          via: KIN_classifyBlood(graph, mySpouses[m].personId,
                                 targetSpouses[t].personId, lca3),
          viaPersonId: targetSpouses[t].personId,
          target: targetId
        };
      }
    }
  }

  // The target is a parent of my child's spouse. Malay names this pair
  // relationship 'besan'; English has no word for it at all.
  var myChildren = KIN_childrenOf(graph, egoId);
  for (var c = 0; c < myChildren.length; c++) {
    var childSpouses = KIN_spousesOf(graph, myChildren[c]);
    for (var s = 0; s < childSpouses.length; s++) {
      var inLawParents = KIN_parentsOf(graph, childSpouses[s].personId);
      for (var p = 0; p < inLawParents.length; p++) {
        if (inLawParents[p] === targetId) {
          return {
            kind: 'in_law',
            direction: 'co_parent_in_law',
            gender: target.gender,
            target: targetId
          };
        }
      }
    }
  }

  return null;
}

function KIN_findStep(graph, egoId, targetId) {
  var target = graph.people[targetId];

  // Married to one of my parents, but not a parent of mine.
  var myParents = KIN_parentsOf(graph, egoId);
  for (var i = 0; i < myParents.length; i++) {
    var spouses = KIN_spousesOf(graph, myParents[i]);
    for (var j = 0; j < spouses.length; j++) {
      if (spouses[j].personId === targetId) {
        return { kind: 'step', type: 'parent', gender: target.gender, target: targetId };
      }
    }
  }

  // A child of my spouse, but not a child of mine.
  var mySpouses = KIN_spousesOf(graph, egoId);
  var myChildren = KIN_childrenOf(graph, egoId);
  for (var k = 0; k < mySpouses.length; k++) {
    var theirChildren = KIN_childrenOf(graph, mySpouses[k].personId);
    for (var m = 0; m < theirChildren.length; m++) {
      if (theirChildren[m] === targetId && myChildren.indexOf(targetId) === -1) {
        return { kind: 'step', type: 'child', gender: target.gender, target: targetId };
      }
    }
  }

  // A child of my step-parent, sharing no parent with me.
  for (var n = 0; n < myParents.length; n++) {
    var parentSpouses = KIN_spousesOf(graph, myParents[n]);
    for (var q = 0; q < parentSpouses.length; q++) {
      var stepParentId = parentSpouses[q].personId;
      if (myParents.indexOf(stepParentId) !== -1) continue;
      var stepSibs = KIN_childrenOf(graph, stepParentId);
      if (stepSibs.indexOf(targetId) !== -1) {
        return {
          kind: 'step',
          type: 'sibling',
          gender: target.gender,
          elder: KIN_isElder(graph, targetId, egoId),
          target: targetId
        };
      }
    }
  }

  return null;
}

/* ------------------------------------------------------------------ *
 * Graph helpers
 * ------------------------------------------------------------------ */

function KIN_parentsOf(graph, personId) {
  var links = graph.parentsOf[personId] || [];
  var out = [];
  for (var i = 0; i < links.length; i++) {
    if (links[i].relation_type === 'biological' || links[i].relation_type === 'adoptive') {
      out.push(links[i].parent_id);
    }
  }
  return out;
}

function KIN_childrenOf(graph, personId) {
  var links = graph.childrenOf[personId] || [];
  var out = [];
  for (var i = 0; i < links.length; i++) {
    if (links[i].relation_type === 'biological' || links[i].relation_type === 'adoptive') {
      out.push(links[i].child_id);
    }
  }
  return out;
}

function KIN_sharedParents(graph, aId, bId) {
  var aLinks = graph.parentsOf[aId] || [];
  var bParents = KIN_parentsOf(graph, bId);
  var shared = [];
  for (var i = 0; i < aLinks.length; i++) {
    if (bParents.indexOf(aLinks[i].parent_id) !== -1) shared.push(aLinks[i]);
  }
  return shared;
}

function KIN_spousesOf(graph, personId) {
  var unions = graph.unionsOf[personId] || [];
  var out = [];
  for (var i = 0; i < unions.length; i++) {
    var u = unions[i];
    var other = u.partner_a_id === personId ? u.partner_b_id : u.partner_a_id;
    if (other) out.push({ personId: other, union: u, status: u.status });
  }
  return out;
}

function KIN_unionBetween(graph, aId, bId) {
  var unions = graph.unionsOf[aId] || [];
  for (var i = 0; i < unions.length; i++) {
    var u = unions[i];
    if (u.partner_a_id === bId || u.partner_b_id === bId) return u;
  }
  return null;
}

/** Full siblings, plus half siblings, ordered by birth. */
function KIN_siblingsOf(graph, personId) {
  var parents = KIN_parentsOf(graph, personId);
  var seen = {};
  var out = [];
  for (var i = 0; i < parents.length; i++) {
    var kids = KIN_childrenOf(graph, parents[i]);
    for (var j = 0; j < kids.length; j++) {
      if (kids[j] !== personId && !seen[kids[j]]) {
        seen[kids[j]] = true;
        out.push(kids[j]);
      }
    }
  }
  return out;
}

/**
 * Where a person ranks among their siblings, counting from 1.
 *
 * This is what decides whether an uncle is Pak Long or Pak Su, and it is the one
 * piece of the Malay title system that the tree shape cannot supply. Recorded
 * order wins; otherwise it is inferred from birth dates. For a grandparents'
 * generation, where dates are often unknown, this returns null and the app falls
 * back to the generic Pak Cik / Mak Cik.
 */
function KIN_birthOrder(graph, personId) {
  var person = graph.people[personId];
  if (!person) return null;
  if (person.birth_order_source === 'manual' && person.birth_order) {
    return Number(person.birth_order);
  }

  var group = KIN_siblingsOf(graph, personId).concat([personId]);
  var dated = [];
  for (var i = 0; i < group.length; i++) {
    var p = graph.people[group[i]];
    if (!p) continue;
    var order = p.birth_order ? Number(p.birth_order) : null;
    var date = p.birth_date ? String(p.birth_date) : null;
    if (!order && !date) return null; // One unknown sibling makes the whole ranking unsafe.
    dated.push({ id: group[i], order: order, date: date });
  }

  dated.sort(function (a, b) {
    if (a.order && b.order) return a.order - b.order;
    if (a.order) return -1;
    if (b.order) return 1;
    return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0);
  });

  for (var k = 0; k < dated.length; k++) {
    if (dated[k].id === personId) return k + 1;
  }
  return null;
}

function KIN_siblingCount(graph, personId) {
  return KIN_siblingsOf(graph, personId).length + 1;
}

/** True when `aId` was born before `bId`. Null when it cannot be determined. */
function KIN_isElder(graph, aId, bId) {
  var a = graph.people[aId];
  var b = graph.people[bId];
  if (!a || !b) return null;
  if (a.birth_order && b.birth_order) return Number(a.birth_order) < Number(b.birth_order);
  if (a.birth_date && b.birth_date) return String(a.birth_date) < String(b.birth_date);
  return null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    KIN_ancestorMap: KIN_ancestorMap,
    KIN_commonAncestor: KIN_commonAncestor,
    KIN_relate: KIN_relate,
    KIN_birthOrder: KIN_birthOrder,
    KIN_siblingsOf: KIN_siblingsOf,
    KIN_spousesOf: KIN_spousesOf
  };
}

/* ================================================================== *
 * 07_Titles.gs                                                   *
 * ================================================================== */

/**
 * Naming the relationship.
 *
 * KIN_relate() works out the structure; this file puts a word to it in Malay,
 * English or Arabic. The three languages do not carve up the family the same
 * way, which is exactly why naming is separated from classification:
 *
 *   - Malay grades a parent's siblings by BIRTH ORDER. Pak Long is the eldest
 *     uncle, Pak Su the youngest, and the word changes with his rank among his
 *     own siblings -- not with his relationship to you.
 *   - Arabic grades them by SIDE. Your father's brother is 'Amm, your mother's
 *     brother is Khal, and there is no word that covers both.
 *   - English grades them by neither. Both are "uncle".
 *
 * A single stored fact therefore yields "Pak Su", "Khal" and "Uncle" depending
 * only on who is reading.
 */

/* Malay birth-order titles, eldest first. The family's own sequence overrides
 * this from Settings; the youngest is always 'Su' regardless of the list. */
var TTL_DEFAULT_BIRTH_ORDER = ['Long', 'Ngah', 'Alang', 'Anjang', 'Andak', 'Uda', 'Uteh'];

var TTL_MS = {
  ancestor: ['', 'Ayah', 'Atuk', 'Moyang', 'Datuk Moyang'],
  ancestorF: ['', 'Ibu', 'Nenek', 'Moyang', 'Nenek Moyang'],
  descendant: ['', 'Anak', 'Cucu', 'Cicit', 'Piut', 'Anggah'],
  cousinDegree: ['', 'Sepupu', 'Dua Pupu', 'Tiga Pupu', 'Empat Pupu']
};

var TTL_EN = {
  ordinal: ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'],
  removed: ['', 'once removed', 'twice removed', 'three times removed']
};

/**
 * The public entry point: what does `egoId` call `targetId`?
 *
 * Returns { label, script, code, source, detail }. `script` carries Arabic in
 * its own alphabet where relevant; `source` is 'custom' when the family's own
 * name for someone has overridden the computed one.
 */
function TTL_title(graph, egoId, targetId, lang, settings) {
  lang = lang || 'ms';

  var custom = TTL_customTitle(graph, egoId, targetId, lang);
  if (custom) {
    return { label: custom, script: '', code: 'custom', source: 'custom', detail: null };
  }

  var rel = KIN_relate(graph, egoId, targetId);
  var named = TTL_name(graph, rel, lang, settings);
  named.source = 'computed';
  named.detail = rel;
  return named;
}

/**
 * A family's own name for someone beats anything an algorithm can work out.
 * A title recorded against GLOBAL applies to every viewer, which covers the
 * common case of one person the whole family calls by a particular name.
 */
function TTL_customTitle(graph, egoId, targetId, lang) {
  var rows = graph.customTitles || [];
  var globalHit = null;
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (row.to_person_id !== targetId) continue;
    if (row.lang !== '*' && row.lang !== lang) continue;
    if (row.from_person_id === egoId) return row.custom_label;
    if (row.from_person_id === 'GLOBAL') globalHit = row.custom_label;
  }
  return globalHit;
}

function TTL_name(graph, rel, lang, settings) {
  if (lang === 'en') return TTL_english(graph, rel);
  if (lang === 'ar') return TTL_arabic(graph, rel);
  return TTL_malay(graph, rel, settings);
}

function TTL_wrap(label, script, code) {
  return { label: label, script: script || '', code: code || '' };
}

/* ------------------------------------------------------------------ *
 * Malay
 * ------------------------------------------------------------------ */

function TTL_malay(graph, rel, settings) {
  var m = rel.gender === 'F' ? 'F' : (rel.gender === 'M' ? 'M' : 'U');

  switch (rel.kind) {
    case 'self':
      return TTL_wrap('Saya', '', 'self');

    case 'spouse':
      if (rel.unionStatus === 'divorced') return TTL_wrap(m === 'F' ? 'Bekas Isteri' : 'Bekas Suami', '', 'ex_spouse');
      if (rel.unionStatus === 'widowed') return TTL_wrap(m === 'F' ? 'Arwah Isteri' : 'Arwah Suami', '', 'late_spouse');
      return TTL_wrap(m === 'F' ? 'Isteri' : 'Suami', '', 'spouse');

    case 'blood':
      return TTL_malayBlood(graph, rel, settings);

    case 'in_law':
      return TTL_malayInLaw(graph, rel, settings);

    case 'step':
      if (rel.type === 'parent') return TTL_wrap(m === 'F' ? 'Ibu Tiri' : 'Ayah Tiri', '', 'step_parent');
      if (rel.type === 'child') return TTL_wrap(m === 'F' ? 'Anak Perempuan Tiri' : 'Anak Lelaki Tiri', '', 'step_child');
      if (rel.type === 'sibling') {
        if (rel.elder === true) return TTL_wrap(m === 'F' ? 'Kakak Tiri' : 'Abang Tiri', '', 'step_sibling');
        if (rel.elder === false) return TTL_wrap('Adik Tiri', '', 'step_sibling');
        return TTL_wrap('Adik-beradik Tiri', '', 'step_sibling');
      }
      return TTL_wrap('Keluarga Tiri', '', 'step');

    default:
      return TTL_wrap('Ahli Keluarga', '', 'unrelated');
  }
}

function TTL_malayBlood(graph, rel, settings) {
  var isF = rel.gender === 'F';
  var g = rel.generations;

  if (rel.type === 'ancestor') {
    var up = isF ? TTL_MS.ancestorF : TTL_MS.ancestor;
    if (g < up.length) return TTL_wrap(up[g], '', 'ancestor_' + g);
    return TTL_wrap('Moyang ke-' + (g - 1), '', 'ancestor_' + g);
  }

  if (rel.type === 'descendant') {
    if (g < TTL_MS.descendant.length) {
      var word = TTL_MS.descendant[g];
      if (g === 1) word = isF ? 'Anak Perempuan' : (rel.gender === 'M' ? 'Anak Lelaki' : 'Anak');
      return TTL_wrap(word, '', 'descendant_' + g);
    }
    return TTL_wrap('Keturunan ke-' + g, '', 'descendant_' + g);
  }

  if (rel.type === 'sibling') {
    var suffix = '';
    if (!rel.full) suffix = rel.halfVia === 'mother' ? ' Seibu' : ' Sebapa';
    if (rel.elder === true) return TTL_wrap((isF ? 'Kakak' : 'Abang') + suffix, '', 'sibling_elder');
    if (rel.elder === false) return TTL_wrap('Adik' + suffix, '', 'sibling_younger');
    return TTL_wrap('Adik-beradik' + suffix, '', 'sibling');
  }

  if (rel.type === 'auncle') {
    if (rel.generations === 1) {
      return TTL_wrap(TTL_malayAuncle(rel, isF, settings), '', 'auncle_1');
    }
    if (rel.generations === 2) return TTL_wrap(isF ? 'Nenek Saudara' : 'Atuk Saudara', '', 'auncle_2');
    return TTL_wrap(isF ? 'Moyang Saudara' : 'Moyang Saudara', '', 'auncle_' + rel.generations);
  }

  if (rel.type === 'nibling') {
    if (rel.generations === 1) return TTL_wrap('Anak Saudara', '', 'nibling_1');
    if (rel.generations === 2) return TTL_wrap('Cucu Saudara', '', 'nibling_2');
    return TTL_wrap('Cicit Saudara', '', 'nibling_' + rel.generations);
  }

  if (rel.type === 'cousin') {
    var base = rel.degree < TTL_MS.cousinDegree.length
      ? TTL_MS.cousinDegree[rel.degree]
      : rel.degree + ' Pupu';
    if (!rel.removed) return TTL_wrap(base, '', 'cousin_' + rel.degree);
    if (!rel.elderBranch) {
      // The cousin's child, or grandchild.
      var down = ['', 'Anak ', 'Cucu ', 'Cicit '][Math.min(rel.removed, 3)];
      return TTL_wrap(down + base, '', 'cousin_' + rel.degree + '_r' + rel.removed);
    }
    var upWord = rel.removed === 1 ? 'Ibu Bapa' : 'Atuk Nenek';
    return TTL_wrap(base + ' ' + upWord, '', 'cousin_' + rel.degree + '_r' + rel.removed);
  }

  return TTL_wrap('Saudara', '', 'blood');
}

/**
 * Pak Long, Mak Ngah, Pak Su.
 *
 * The rank is the person's own position among their siblings, so the eldest of
 * five brothers is Pak Long to every one of his nieces and nephews. The youngest
 * is always Su whatever the list says. Where the family has not recorded enough
 * birth dates to rank the generation, this falls back to the generic Pak Cik /
 * Mak Cik rather than guessing -- calling the eldest uncle Pak Su is worse than
 * calling him Pak Cik.
 */
function TTL_malayAuncle(rel, isF, settings) {
  var prefix = isF ? 'Mak' : 'Pak';
  var order = rel.birthOrder;
  var count = rel.siblingCount;

  if (!order || !count) return prefix + ' Cik';
  if (count > 1 && order === count) return prefix + ' Su';

  var list = TTL_birthOrderList(settings);
  if (order - 1 < list.length) return prefix + ' ' + list[order - 1];
  return prefix + ' Cik';
}

function TTL_birthOrderList(settings) {
  if (settings && settings.birth_order_titles) {
    var parts = String(settings.birth_order_titles).split(',');
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var trimmed = parts[i].replace(/^\s+|\s+$/g, '');
      if (trimmed) out.push(trimmed);
    }
    if (out.length) return out;
  }
  return TTL_DEFAULT_BIRTH_ORDER;
}

function TTL_malayInLaw(graph, rel, settings) {
  var isF = rel.gender === 'F';
  var via = rel.via;

  if (rel.direction === 'co_parent_in_law') return TTL_wrap('Besan', '', 'besan');

  if (rel.direction === 'relative_of_spouse' && via) {
    if (via.type === 'ancestor' && via.generations === 1) {
      return TTL_wrap(isF ? 'Ibu Mertua' : 'Bapa Mertua', '', 'parent_in_law');
    }
    if (via.type === 'ancestor' && via.generations === 2) {
      return TTL_wrap(isF ? 'Nenek Mertua' : 'Atuk Mertua', '', 'grandparent_in_law');
    }
    if (via.type === 'sibling') {
      if (via.elder === true) return TTL_wrap(isF ? 'Kakak Ipar' : 'Abang Ipar', '', 'sibling_in_law');
      if (via.elder === false) return TTL_wrap('Adik Ipar', '', 'sibling_in_law');
      return TTL_wrap('Ipar', '', 'sibling_in_law');
    }
    if (via.type === 'auncle' && via.generations === 1) {
      // Your spouse's uncle keeps his own birth-order title.
      return TTL_wrap(TTL_malayAuncle(via, isF, settings) + ' (sebelah pasangan)', '', 'auncle_in_law');
    }
    if (via.type === 'nibling') {
      // Your spouse's nephew is your nephew. Malay does not mark the distinction.
      return TTL_wrap(via.generations === 1 ? 'Anak Saudara' : 'Cucu Saudara', '', 'nibling_in_law');
    }
    if (via.type === 'descendant') {
      return TTL_wrap(isF ? 'Anak Perempuan Tiri' : 'Anak Lelaki Tiri', '', 'step_child');
    }
    if (via.type === 'cousin') return TTL_wrap('Sepupu Ipar', '', 'cousin_in_law');
    return TTL_wrap('Keluarga Mertua', '', 'in_law');
  }

  if (rel.direction === 'spouse_of_spouses_relative' && via) {
    // Married to your spouse's sibling.
    if (via.type === 'sibling') return TTL_wrap('Biras', '', 'biras');
    if (via.type === 'cousin') return TTL_wrap('Biras Sepupu', '', 'biras');
    if (via.type === 'auncle') return TTL_wrap(TTL_malayAuncle(via, isF, settings), '', 'auncle_by_marriage');
    return TTL_wrap('Keluarga Semenda', '', 'in_law');
  }

  if (rel.direction === 'spouse_of_relative' && via) {
    if (via.type === 'descendant' && via.generations === 1) {
      return TTL_wrap('Menantu', '', 'child_in_law');
    }
    if (via.type === 'sibling') {
      if (via.elder === true) return TTL_wrap(isF ? 'Kakak Ipar' : 'Abang Ipar', '', 'sibling_in_law');
      if (via.elder === false) return TTL_wrap('Adik Ipar', '', 'sibling_in_law');
      return TTL_wrap('Ipar', '', 'sibling_in_law');
    }
    if (via.type === 'auncle' && via.generations === 1) {
      // The wife of Pak Long is Mak Long. The title follows the marriage.
      return TTL_wrap(TTL_malayAuncle(via, isF, settings), '', 'auncle_by_marriage');
    }
    if (via.type === 'cousin') return TTL_wrap('Ipar Sepupu', '', 'cousin_in_law');
    if (via.type === 'nibling') return TTL_wrap('Menantu Saudara', '', 'nibling_in_law');
    return TTL_wrap('Keluarga Semenda', '', 'in_law');
  }

  return TTL_wrap('Keluarga Semenda', '', 'in_law');
}

/* ------------------------------------------------------------------ *
 * English
 * ------------------------------------------------------------------ */

function TTL_english(graph, rel) {
  var isF = rel.gender === 'F';

  switch (rel.kind) {
    case 'self': return TTL_wrap('You', '', 'self');
    case 'spouse':
      if (rel.unionStatus === 'divorced') return TTL_wrap(isF ? 'Ex-wife' : 'Ex-husband', '', 'ex_spouse');
      if (rel.unionStatus === 'widowed') return TTL_wrap(isF ? 'Late wife' : 'Late husband', '', 'late_spouse');
      return TTL_wrap(isF ? 'Wife' : 'Husband', '', 'spouse');
    case 'blood': return TTL_englishBlood(rel);
    case 'in_law': return TTL_englishInLaw(rel);
    case 'step':
      if (rel.type === 'parent') return TTL_wrap(isF ? 'Stepmother' : 'Stepfather', '', 'step_parent');
      if (rel.type === 'child') return TTL_wrap(isF ? 'Stepdaughter' : 'Stepson', '', 'step_child');
      if (rel.type === 'sibling') return TTL_wrap(isF ? 'Stepsister' : 'Stepbrother', '', 'step_sibling');
      return TTL_wrap('Step-relative', '', 'step');
    default: return TTL_wrap('Relative', '', 'unrelated');
  }
}

function TTL_englishBlood(rel) {
  var isF = rel.gender === 'F';
  var g = rel.generations;

  if (rel.type === 'ancestor') {
    if (g === 1) return TTL_wrap(isF ? 'Mother' : 'Father', '', 'ancestor_1');
    var base = isF ? 'Grandmother' : 'Grandfather';
    return TTL_wrap(TTL_prefixGreat(g - 2, base), '', 'ancestor_' + g);
  }

  if (rel.type === 'descendant') {
    if (g === 1) return TTL_wrap(isF ? 'Daughter' : 'Son', '', 'descendant_1');
    var d = isF ? 'Granddaughter' : 'Grandson';
    return TTL_wrap(TTL_prefixGreat(g - 2, d), '', 'descendant_' + g);
  }

  if (rel.type === 'sibling') {
    var word = isF ? 'Sister' : 'Brother';
    if (!rel.full) return TTL_wrap('Half-' + word.toLowerCase(), '', 'half_sibling');
    if (rel.elder === true) return TTL_wrap('Older ' + word.toLowerCase(), '', 'sibling_elder');
    if (rel.elder === false) return TTL_wrap('Younger ' + word.toLowerCase(), '', 'sibling_younger');
    return TTL_wrap(word, '', 'sibling');
  }

  if (rel.type === 'auncle') {
    return TTL_wrap(TTL_prefixGreat(rel.generations - 1, isF ? 'Aunt' : 'Uncle'), '', 'auncle_' + rel.generations);
  }

  if (rel.type === 'nibling') {
    return TTL_wrap(TTL_prefixGreat(rel.generations - 1, isF ? 'Niece' : 'Nephew'), '', 'nibling_' + rel.generations);
  }

  if (rel.type === 'cousin') {
    var ord = rel.degree < TTL_EN.ordinal.length ? TTL_EN.ordinal[rel.degree] : rel.degree + 'th';
    var label = ord + ' cousin';
    if (rel.removed) {
      label += ' ' + (rel.removed < TTL_EN.removed.length
        ? TTL_EN.removed[rel.removed]
        : rel.removed + ' times removed');
    }
    return TTL_wrap(label, '', 'cousin_' + rel.degree + '_r' + rel.removed);
  }

  return TTL_wrap('Relative', '', 'blood');
}

function TTL_prefixGreat(greats, base) {
  if (greats <= 0) return base;
  var prefix = '';
  for (var i = 0; i < greats; i++) prefix += 'Great-';
  return prefix + base.toLowerCase();
}

function TTL_englishInLaw(rel) {
  var isF = rel.gender === 'F';
  var via = rel.via;

  if (rel.direction === 'co_parent_in_law') return TTL_wrap("Child's parent-in-law", '', 'besan');

  if (via && via.type === 'ancestor' && via.generations === 1 && rel.direction === 'relative_of_spouse') {
    return TTL_wrap(isF ? 'Mother-in-law' : 'Father-in-law', '', 'parent_in_law');
  }
  if (via && via.type === 'descendant' && via.generations === 1 && rel.direction === 'spouse_of_relative') {
    return TTL_wrap(isF ? 'Daughter-in-law' : 'Son-in-law', '', 'child_in_law');
  }
  if (via && via.type === 'sibling') {
    return TTL_wrap(isF ? 'Sister-in-law' : 'Brother-in-law', '', 'sibling_in_law');
  }
  if (via && via.type === 'auncle') {
    return TTL_wrap(isF ? 'Aunt by marriage' : 'Uncle by marriage', '', 'auncle_in_law');
  }
  if (via && via.type === 'nibling' && rel.direction === 'relative_of_spouse') {
    return TTL_wrap(isF ? 'Niece by marriage' : 'Nephew by marriage', '', 'nibling_in_law');
  }
  if (via && via.type === 'descendant' && rel.direction === 'relative_of_spouse') {
    return TTL_wrap(isF ? 'Stepdaughter' : 'Stepson', '', 'step_child');
  }
  if (rel.direction === 'spouse_of_spouses_relative') {
    // English has no word for this: the people married to your spouse's
    // siblings. Speakers reach for brother- or sister-in-law and leave the
    // distinction unsaid.
    return TTL_wrap(isF ? 'Sister-in-law' : 'Brother-in-law', '', 'biras');
  }
  return TTL_wrap('In-law', '', 'in_law');
}

/* ------------------------------------------------------------------ *
 * Arabic
 * ------------------------------------------------------------------ */

function TTL_arabic(graph, rel) {
  var isF = rel.gender === 'F';

  switch (rel.kind) {
    case 'self': return TTL_wrap('Ana', 'أنا', 'self');
    case 'spouse': return TTL_wrap(isF ? 'Zawjah' : 'Zawj', isF ? 'زوجة' : 'زوج', 'spouse');
    case 'blood': return TTL_arabicBlood(graph, rel);
    case 'in_law': return TTL_arabicInLaw(rel);
    case 'step':
      if (rel.type === 'parent') return TTL_wrap(isF ? "Zawjat al-Ab" : "Zawj al-Umm", isF ? 'زوجة الأب' : 'زوج الأم', 'step_parent');
      if (rel.type === 'child') return TTL_wrap(isF ? 'Rabibah' : 'Rabib', isF ? 'ربيبة' : 'ربيب', 'step_child');
      return TTL_wrap('Qarib bil-musaharah', 'قريب بالمصاهرة', 'step');
    default: return TTL_wrap('Qarib', 'قريب', 'unrelated');
  }
}

function TTL_arabicBlood(graph, rel) {
  var isF = rel.gender === 'F';
  var g = rel.generations;

  if (rel.type === 'ancestor') {
    if (g === 1) return TTL_wrap(isF ? 'Umm' : 'Ab', isF ? 'أم' : 'أب', 'ancestor_1');
    if (g === 2) return TTL_wrap(isF ? 'Jaddah' : 'Jadd', isF ? 'جدة' : 'جد', 'ancestor_2');
    return TTL_wrap((isF ? 'Jaddah' : 'Jadd') + " al-'ulya", isF ? 'جدة عليا' : 'جد أعلى', 'ancestor_' + g);
  }

  if (rel.type === 'descendant') {
    if (g === 1) return TTL_wrap(isF ? 'Bint' : 'Ibn', isF ? 'بنت' : 'ابن', 'descendant_1');
    if (g === 2) return TTL_wrap(isF ? 'Hafidah' : 'Hafid', isF ? 'حفيدة' : 'حفيد', 'descendant_2');
    return TTL_wrap((isF ? 'Bint al-Hafid' : 'Ibn al-Hafid'), isF ? 'بنت الحفيد' : 'ابن الحفيد', 'descendant_' + g);
  }

  if (rel.type === 'sibling') {
    return TTL_wrap(isF ? 'Ukht' : 'Akh', isF ? 'أخت' : 'أخ', 'sibling');
  }

  if (rel.type === 'auncle') {
    var maternal = rel.side === 'maternal';
    if (rel.generations === 1) {
      if (maternal) return TTL_wrap(isF ? 'Khalah' : 'Khal', isF ? 'خالة' : 'خال', 'auncle_1');
      return TTL_wrap(isF ? "'Ammah" : "'Amm", isF ? 'عمة' : 'عم', 'auncle_1');
    }
    if (maternal) return TTL_wrap(isF ? 'Khalat al-Ab' : 'Khal al-Ab', isF ? 'خالة الأب' : 'خال الأب', 'auncle_2');
    return TTL_wrap(isF ? "'Ammat al-Ab" : "'Amm al-Ab", isF ? 'عمة الأب' : 'عم الأب', 'auncle_2');
  }

  if (rel.type === 'nibling') {
    if (rel.generations >= 2) {
      return TTL_wrap(isF ? 'Hafidat al-Akh' : 'Hafid al-Akh',
                      isF ? 'حفيدة الأخ' : 'حفيد الأخ', 'nibling_' + rel.generations);
    }
    return TTL_wrap(isF ? 'Bint al-Akh' : 'Ibn al-Akh', isF ? 'بنت الأخ' : 'ابن الأخ', 'nibling_1');
  }

  if (rel.type === 'cousin') {
    return TTL_arabicCousin(rel, isF);
  }

  return TTL_wrap('Qarib', 'قريب', 'blood');
}

/**
 * Arabic names a cousin after the uncle or aunt they descend from, so the term
 * encodes both the side of the family and that linking person's gender. Four
 * distinct words where English has one.
 */
function TTL_arabicCousin(rel, isF) {
  var link = rel.linkAuncle;
  var maternal = rel.side === 'maternal';
  var linkIsF = link && link.gender === 'F';

  var parentWord, parentScript;
  if (maternal) {
    parentWord = linkIsF ? 'al-Khalah' : 'al-Khal';
    parentScript = linkIsF ? 'الخالة' : 'الخال';
  } else {
    parentWord = linkIsF ? "al-'Ammah" : "al-'Amm";
    parentScript = linkIsF ? 'العمة' : 'العم';
  }

  var self = isF ? 'Bint' : 'Ibn';
  var selfScript = isF ? 'بنت' : 'ابن';

  var label = self + ' ' + parentWord;
  var script = selfScript + ' ' + parentScript;
  if (rel.degree > 1) label += ' (darajah ' + rel.degree + ')';
  return TTL_wrap(label, script, 'cousin_' + rel.degree + '_r' + rel.removed);
}

function TTL_arabicInLaw(rel) {
  var isF = rel.gender === 'F';
  var via = rel.via;

  if (rel.direction === 'co_parent_in_law') return TTL_wrap('Nasib', 'نسيب', 'besan');

  if (via && via.type === 'ancestor' && via.generations === 1 && rel.direction === 'relative_of_spouse') {
    return TTL_wrap(isF ? 'Hamah' : 'Ham', isF ? 'حماة' : 'حم', 'parent_in_law');
  }
  if (via && via.type === 'descendant' && via.generations === 1 && rel.direction === 'spouse_of_relative') {
    return TTL_wrap(isF ? 'Kannah' : 'Sihr', isF ? 'كنة' : 'صهر', 'child_in_law');
  }
  if (via && via.type === 'sibling' && rel.direction !== 'spouse_of_spouses_relative') {
    return TTL_wrap(isF ? 'Salifah' : 'Sihr', isF ? 'سليفة' : 'صهر', 'sibling_in_law');
  }
  if (rel.direction === 'spouse_of_spouses_relative') {
    return TTL_wrap(isF ? 'Silfah' : 'Silf', isF ? 'سلفة' : 'سلف', 'biras');
  }
  if (via && via.type === 'nibling') {
    return TTL_wrap(isF ? 'Bint al-Akh' : 'Ibn al-Akh', isF ? 'بنت الأخ' : 'ابن الأخ', 'nibling_in_law');
  }
  return TTL_wrap('Qarib bil-musaharah', 'قريب بالمصاهرة', 'in_law');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TTL_title: TTL_title, TTL_name: TTL_name };
}
