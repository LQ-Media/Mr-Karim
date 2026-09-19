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
