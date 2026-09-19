/**
 * Laying the family out on a canvas.
 *
 * A me-centred list answers "who is around me". A canvas answers a different
 * question -- "how does all of this fit together" -- and families reach for a
 * wall chart precisely when the list stops being enough.
 *
 * The hard part is not drawing lines. It is that a family is not a tree: people
 * marry, so two chains of descent join and a node can have two parents on
 * different branches. Laying that out means placing couples as units, centring
 * each couple over their children, and then pushing apart whatever collides --
 * repeatedly, because fixing one generation disturbs the next.
 *
 * Positions produced here are a starting point, not a verdict. Families
 * rearrange their own chart, so every card can be dragged and the result saved;
 * this only has to be good enough that nobody starts from a pile.
 *
 * Plain ES5 with no Apps Script APIs, so the browser and the Node tests run the
 * same code.
 */

var LAY = {
  NODE_W: 176,
  NODE_H: 74,
  GAP_X: 28,
  GAP_Y: 128,
  COUPLE_GAP: 18,   // Between two spouses, tighter than between strangers.
  DROP: 30,         // From a couple down to the point their children hang from.
  RISE: 28,         // From the bus line down into a child's head.
  PASSES: 5
};

/**
 * Works out where everybody goes.
 *
 * @return { nodes: {id:{x,y,gen}}, units: [...], generations: {id:gen}, bounds }
 *         where x,y is the centre of each card.
 */
function LAY_compute(graph, options) {
  var opts = options || {};
  var metrics = LAY_metrics(opts);

  var gens = LAY_generations(graph);
  var units = LAY_units(graph);
  var order = LAY_order(graph, units, gens);

  var nodes = {};
  for (var id in gens) {
    if (!Object.prototype.hasOwnProperty.call(gens, id)) continue;
    nodes[id] = {
      x: order.slot[id] * (metrics.NODE_W + metrics.GAP_X),
      y: gens[id] * (metrics.NODE_H + metrics.GAP_Y),
      gen: gens[id]
    };
  }

  // Recorded on the map itself so the overlap pass can tell a married couple
  // from two people who merely stand next to each other.
  var partners = {};
  for (var u = 0; u < units.length; u++) {
    if (units[u].partners.length === 2) {
      partners[units[u].partners[0] + '|' + units[u].partners[1]] = true;
    }
  }
  nodes.__partners = partners;

  LAY_balance(graph, units, nodes, gens, metrics);
  LAY_pairCouples(units, nodes, metrics);
  LAY_spread(nodes, gens, metrics);
  LAY_settle(units, nodes, gens, metrics);

  return {
    nodes: nodes,
    units: units,
    generations: gens,
    bounds: LAY_bounds(nodes, metrics),
    metrics: metrics
  };
}

function LAY_metrics(opts) {
  var m = {};
  for (var key in LAY) {
    if (Object.prototype.hasOwnProperty.call(LAY, key)) m[key] = LAY[key];
  }
  for (var over in opts) {
    if (Object.prototype.hasOwnProperty.call(opts, over)) m[over] = opts[over];
  }
  return m;
}

/* ------------------------------------------------------------------ *
 * Generations
 * ------------------------------------------------------------------ */

/**
 * Which row each person belongs on.
 *
 * Walked outward rather than derived from ancestry depth, because a family with
 * two trees joined by a marriage has no single root to count from. Spouses are
 * pulled onto the same row as each other, which is what makes a couple read as
 * a couple; the first assignment wins, so a marriage between distant cousins
 * bends one person's row rather than deadlocking.
 */
function LAY_generations(graph) {
  var gens = {};
  var ids = LAY_sortedIds(graph);

  for (var i = 0; i < ids.length; i++) {
    if (gens[ids[i]] !== undefined) continue;

    var component = [];
    gens[ids[i]] = 0;
    var queue = [ids[i]];

    while (queue.length) {
      var current = queue.shift();
      component.push(current);
      var level = gens[current];

      var parents = KIN_parentsOf(graph, current);
      for (var p = 0; p < parents.length; p++) {
        if (gens[parents[p]] === undefined) {
          gens[parents[p]] = level - 1;
          queue.push(parents[p]);
        }
      }

      var children = KIN_childrenOf(graph, current);
      for (var c = 0; c < children.length; c++) {
        if (gens[children[c]] === undefined) {
          gens[children[c]] = level + 1;
          queue.push(children[c]);
        }
      }

      var spouses = KIN_spousesOf(graph, current);
      for (var s = 0; s < spouses.length; s++) {
        if (gens[spouses[s].personId] === undefined) {
          gens[spouses[s].personId] = level;
          queue.push(spouses[s].personId);
        }
      }
    }

    // Each disconnected group is normalised on its own, so a second family
    // entered from its youngest member does not float above the first.
    var lowest = Infinity;
    for (var k = 0; k < component.length; k++) lowest = Math.min(lowest, gens[component[k]]);
    for (var n = 0; n < component.length; n++) gens[component[n]] -= lowest;
  }

  return gens;
}

/* ------------------------------------------------------------------ *
 * Family units
 * ------------------------------------------------------------------ */

/**
 * Couples, and the children hanging from them.
 *
 * A couple is one object on the chart: their children descend from the point
 * between them, not from either parent individually, which is what makes a
 * family tree readable rather than a web of crossing lines.
 */
function LAY_units(graph) {
  var units = [];
  var seenUnion = {};
  var placedChild = {};

  var ids = LAY_sortedIds(graph);

  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    var unions = graph.unionsOf[id] || [];

    for (var u = 0; u < unions.length; u++) {
      var union = unions[u];
      if (seenUnion[union.union_id]) continue;
      seenUnion[union.union_id] = true;

      var a = union.partner_a_id;
      var b = union.partner_b_id;
      var shared = LAY_sharedChildren(graph, a, b);
      for (var s = 0; s < shared.length; s++) placedChild[shared[s]] = true;

      units.push({
        id: 'u:' + union.union_id,
        partners: [a, b],
        children: shared,
        union: union
      });
    }
  }

  // A parent with children but no recorded marriage still anchors their
  // children, otherwise those lines would have nowhere to start.
  for (var j = 0; j < ids.length; j++) {
    var person = ids[j];
    var kids = KIN_childrenOf(graph, person);
    var orphaned = [];
    for (var k = 0; k < kids.length; k++) {
      if (!placedChild[kids[k]]) orphaned.push(kids[k]);
    }
    if (orphaned.length) {
      for (var o = 0; o < orphaned.length; o++) placedChild[orphaned[o]] = true;
      units.push({ id: 's:' + person, partners: [person], children: orphaned, union: null });
    }
  }

  return units;
}

function LAY_sharedChildren(graph, aId, bId) {
  var aKids = KIN_childrenOf(graph, aId);
  var bKids = KIN_childrenOf(graph, bId);
  var out = [];
  for (var i = 0; i < aKids.length; i++) {
    if (bKids.indexOf(aKids[i]) !== -1) out.push(aKids[i]);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Left-to-right order
 * ------------------------------------------------------------------ */

/**
 * Walks the family from its oldest members down, giving each person a slot.
 *
 * Depth-first rather than generation-by-generation: following one branch to its
 * end before starting the next is what keeps a household's descendants together
 * instead of interleaved with their cousins'.
 */
function LAY_order(graph, units, gens) {
  var slot = {};
  var next = {};
  var placed = {};

  function take(id) {
    if (placed[id]) return;
    var gen = gens[id];
    if (next[gen] === undefined) next[gen] = 0;
    slot[id] = next[gen]++;
    placed[id] = true;
  }

  var unitsByPartner = {};
  for (var i = 0; i < units.length; i++) {
    for (var p = 0; p < units[i].partners.length; p++) {
      var key = units[i].partners[p];
      if (!unitsByPartner[key]) unitsByPartner[key] = [];
      unitsByPartner[key].push(units[i]);
    }
  }

  var visitedUnit = {};
  function walk(unit) {
    if (visitedUnit[unit.id]) return;
    visitedUnit[unit.id] = true;

    for (var p = 0; p < unit.partners.length; p++) take(unit.partners[p]);

    var kids = unit.children.slice();
    kids.sort(function (a, b) {
      return REL_compareBirth(graph.people[a], graph.people[b]);
    });

    for (var c = 0; c < kids.length; c++) {
      take(kids[c]);
      var theirUnits = unitsByPartner[kids[c]] || [];
      for (var t = 0; t < theirUnits.length; t++) walk(theirUnits[t]);
    }
  }

  // Start from units whose partners have no parents recorded -- the tops of
  // the tree -- then sweep up anything left in a cycle-free but rootless group.
  var roots = [];
  for (var r = 0; r < units.length; r++) {
    var rootish = true;
    for (var q = 0; q < units[r].partners.length; q++) {
      if (KIN_parentsOf(graph, units[r].partners[q]).length) rootish = false;
    }
    if (rootish) roots.push(units[r]);
  }
  roots.sort(function (a, b) { return gens[a.partners[0]] - gens[b.partners[0]]; });

  for (var rr = 0; rr < roots.length; rr++) walk(roots[rr]);
  for (var uu = 0; uu < units.length; uu++) walk(units[uu]);

  var all = LAY_sortedIds(graph);
  for (var a = 0; a < all.length; a++) take(all[a]);

  return { slot: slot };
}

/* ------------------------------------------------------------------ *
 * Tidying
 * ------------------------------------------------------------------ */

/**
 * Pulls each couple over the middle of their children, repeatedly.
 *
 * One pass is never enough: moving a couple to sit above their children shifts
 * them relative to their own parents, so the generation above now needs moving
 * too. Running bottom-up then top-down a few times settles it.
 */
function LAY_balance(graph, units, nodes, gens, metrics) {
  var byDepth = units.slice().sort(function (a, b) {
    return gens[b.partners[0]] - gens[a.partners[0]];
  });

  for (var pass = 0; pass < metrics.PASSES; pass++) {
    // Bottom-up: parents follow their children.
    for (var i = 0; i < byDepth.length; i++) {
      var unit = byDepth[i];
      if (!unit.children.length) continue;
      var centre = LAY_centreOf(unit.children, nodes);
      if (centre === null) continue;
      LAY_moveUnit(unit, nodes, centre);
    }
    LAY_spread(nodes, gens, metrics);

    // Top-down: children gather under their parents where there is room.
    for (var j = byDepth.length - 1; j >= 0; j--) {
      var down = byDepth[j];
      if (down.children.length < 2) continue;
      var parentCentre = LAY_centreOf(down.partners, nodes);
      var childCentre = LAY_centreOf(down.children, nodes);
      if (parentCentre === null || childCentre === null) continue;
      var shift = parentCentre - childCentre;
      for (var c = 0; c < down.children.length; c++) {
        if (nodes[down.children[c]]) nodes[down.children[c]].x += shift;
      }
    }
    LAY_spread(nodes, gens, metrics);
  }
}

function LAY_centreOf(ids, nodes) {
  var total = 0;
  var count = 0;
  for (var i = 0; i < ids.length; i++) {
    if (ids[i] === '__partners' || !nodes[ids[i]]) continue;
    total += nodes[ids[i]].x;
    count++;
  }
  return count ? total / count : null;
}

function LAY_moveUnit(unit, nodes, centre) {
  var current = LAY_centreOf(unit.partners, nodes);
  if (current === null) return;
  var shift = centre - current;
  for (var i = 0; i < unit.partners.length; i++) {
    if (nodes[unit.partners[i]]) nodes[unit.partners[i]].x += shift;
  }
}

/** Puts married couples side by side, closer than unrelated neighbours. */
function LAY_pairCouples(units, nodes, metrics) {
  for (var i = 0; i < units.length; i++) {
    var unit = units[i];
    if (unit.partners.length !== 2) continue;
    var a = nodes[unit.partners[0]];
    var b = nodes[unit.partners[1]];
    if (!a || !b) continue;

    var mid = (a.x + b.x) / 2;
    var half = (metrics.NODE_W + metrics.COUPLE_GAP) / 2;
    if (a.x <= b.x) { a.x = mid - half; b.x = mid + half; }
    else { b.x = mid - half; a.x = mid + half; }
  }
}

/**
 * A last pass to sit each couple over the middle of their children.
 *
 * The earlier passes each end by pushing overlaps apart, which nudges a row
 * rightwards and leaves the generation above looking off-centre. This runs
 * oldest first, after everything else, and only moves parents -- so the
 * children it is aligning to have already stopped moving.
 */
function LAY_settle(units, nodes, gens, metrics) {
  var ordered = units.slice().sort(function (a, b) {
    return gens[a.partners[0]] - gens[b.partners[0]];
  });

  for (var i = 0; i < ordered.length; i++) {
    var unit = ordered[i];
    if (!unit.children.length) continue;
    var centre = LAY_centreOf(unit.children, nodes);
    if (centre === null) continue;
    LAY_moveUnit(unit, nodes, centre);
    LAY_spread(nodes, gens, metrics);
  }
}

/**
 * Pushes apart anything overlapping on the same row.
 *
 * Resolving person by person let a third person slide between a married couple:
 * each card was individually far enough from its neighbours, so nothing was
 * technically overlapping, and Rahim ended up two places away from his own
 * wife with his sister in between.
 *
 * So the row is resolved over blocks instead, where a married pair is one rigid
 * block that cannot be entered. Nothing can come between two spouses because
 * there is no gap between them to come into.
 *
 * The row is also recentred on where it started. Resolving left to right and
 * stopping there walks every row steadily rightwards, leaving each generation
 * offset from the one above it.
 */
function LAY_spread(nodes, gens, metrics) {
  var rows = {};
  for (var id in nodes) {
    if (!Object.prototype.hasOwnProperty.call(nodes, id)) continue;
    if (id === '__partners') continue;
    var gen = nodes[id].gen;
    if (!rows[gen]) rows[gen] = [];
    rows[gen].push(id);
  }

  for (var g in rows) {
    if (!Object.prototype.hasOwnProperty.call(rows, g)) continue;
    LAY_spreadRow(nodes, rows[g], metrics);
  }
}

function LAY_spreadRow(nodes, rowIds, metrics) {
  var before = LAY_centreOf(rowIds, nodes);
  var blocks = LAY_blocks(nodes, rowIds, metrics);

  blocks.sort(function (a, b) { return a.x - b.x; });
  for (var i = 1; i < blocks.length; i++) {
    var needed = (blocks[i - 1].width + blocks[i].width) / 2 + metrics.GAP_X;
    if (blocks[i].x - blocks[i - 1].x < needed) {
      blocks[i].x = blocks[i - 1].x + needed;
    }
  }

  for (var b = 0; b < blocks.length; b++) LAY_writeBlock(blocks[b], nodes, metrics);

  var after = LAY_centreOf(rowIds, nodes);
  if (before !== null && after !== null && after !== before) {
    var correction = before - after;
    for (var k = 0; k < rowIds.length; k++) nodes[rowIds[k]].x += correction;
  }
}

/**
 * Groups a row into things that move together.
 *
 * A married pair is one block; everybody else is their own. Somebody married
 * twice belongs to the first pair found and their other spouse becomes a
 * singleton beside them, because a person cannot be rigidly attached to two
 * people in opposite directions.
 */
function LAY_blocks(nodes, rowIds, metrics) {
  var partners = nodes.__partners || {};
  var present = {};
  for (var i = 0; i < rowIds.length; i++) present[rowIds[i]] = true;

  var taken = {};
  var blocks = [];

  for (var key in partners) {
    if (!Object.prototype.hasOwnProperty.call(partners, key)) continue;
    var pair = key.split('|');
    if (!present[pair[0]] || !present[pair[1]]) continue;
    if (taken[pair[0]] || taken[pair[1]]) continue;

    taken[pair[0]] = true;
    taken[pair[1]] = true;
    var ordered = nodes[pair[0]].x <= nodes[pair[1]].x ? pair : [pair[1], pair[0]];
    blocks.push({
      members: ordered,
      width: metrics.NODE_W * 2 + metrics.COUPLE_GAP,
      x: (nodes[pair[0]].x + nodes[pair[1]].x) / 2
    });
  }

  for (var j = 0; j < rowIds.length; j++) {
    if (taken[rowIds[j]]) continue;
    blocks.push({ members: [rowIds[j]], width: metrics.NODE_W, x: nodes[rowIds[j]].x });
  }

  return blocks;
}

function LAY_writeBlock(block, nodes, metrics) {
  if (block.members.length === 1) {
    nodes[block.members[0]].x = block.x;
    return;
  }
  var half = (metrics.NODE_W + metrics.COUPLE_GAP) / 2;
  nodes[block.members[0]].x = block.x - half;
  nodes[block.members[1]].x = block.x + half;
}

function LAY_bounds(nodes, metrics) {
  var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (var id in nodes) {
    if (!Object.prototype.hasOwnProperty.call(nodes, id)) continue;
    if (id === '__partners') continue;
    minX = Math.min(minX, nodes[id].x - metrics.NODE_W / 2);
    maxX = Math.max(maxX, nodes[id].x + metrics.NODE_W / 2);
    minY = Math.min(minY, nodes[id].y - metrics.NODE_H / 2);
    maxY = Math.max(maxY, nodes[id].y + metrics.NODE_H / 2);
  }
  if (minX === Infinity) return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
  return { minX: minX, maxX: maxX, minY: minY, maxY: maxY,
           width: maxX - minX, height: maxY - minY };
}

function LAY_sortedIds(graph) {
  var ids = [];
  for (var id in graph.people) {
    if (Object.prototype.hasOwnProperty.call(graph.people, id)) ids.push(id);
  }
  ids.sort();
  return ids;
}

/* ------------------------------------------------------------------ *
 * The lines between them
 * ------------------------------------------------------------------ */

/**
 * Builds the connectors from wherever the cards currently are.
 *
 * Derived fresh from live positions rather than stored, so a card dragged
 * across the canvas takes its lines with it and nothing has to be invalidated.
 *
 * Takes the units and the positions and nothing else: the relationships were
 * already resolved when the units were built, so this does not need the graph.
 *
 * Marriages are drawn as a plain horizontal join. Descent runs from the point
 * between the couple, down to a bus line above the children, along it, and into
 * each child's head -- one shared trunk instead of a separate diagonal to every
 * child, which is the difference between a family tree and a cat's cradle.
 */
function LAY_edges(units, positions, metrics) {
  var m = metrics || LAY;
  var edges = [];

  for (var i = 0; i < units.length; i++) {
    var unit = units[i];
    var anchor = LAY_unitAnchor(unit, positions, m);
    if (!anchor) continue;

    if (unit.partners.length === 2) {
      var a = positions[unit.partners[0]];
      var b = positions[unit.partners[1]];
      if (a && b) {
        var left = a.x < b.x ? a : b;
        var right = a.x < b.x ? b : a;
        edges.push({
          kind: 'union',
          unionId: unit.union ? unit.union.union_id : '',
          status: unit.union ? unit.union.status : 'current',
          x1: left.x + m.NODE_W / 2, y1: left.y,
          x2: right.x - m.NODE_W / 2, y2: right.y,
          midX: (left.x + right.x) / 2,
          midY: (left.y + right.y) / 2
        });
      }
    }

    if (!unit.children.length) continue;

    var present = [];
    for (var c = 0; c < unit.children.length; c++) {
      if (positions[unit.children[c]]) present.push(unit.children[c]);
    }
    if (!present.length) continue;

    // The bus sits above the highest child, so the drop into each head is the
    // same length however uneven the row has been dragged.
    var topChildY = Infinity;
    for (var t = 0; t < present.length; t++) {
      topChildY = Math.min(topChildY, positions[present[t]].y);
    }
    var busY = topChildY - m.NODE_H / 2 - m.RISE;
    if (busY < anchor.y + 8) busY = anchor.y + 8;

    edges.push({
      kind: 'stem',
      x1: anchor.x, y1: anchor.y, x2: anchor.x, y2: busY
    });

    for (var k = 0; k < present.length; k++) {
      var child = positions[present[k]];
      edges.push({
        kind: 'descent',
        childId: present[k],
        fromX: anchor.x, fromY: busY,
        toX: child.x, toY: child.y - m.NODE_H / 2,
        busY: busY
      });
    }
  }

  return edges;
}

/** The point children hang from: between the couple, or below a lone parent. */
function LAY_unitAnchor(unit, positions, metrics) {
  if (unit.partners.length === 2) {
    var a = positions[unit.partners[0]];
    var b = positions[unit.partners[1]];
    if (!a || !b) {
      var only = a || b;
      return only ? { x: only.x, y: only.y + metrics.NODE_H / 2 } : null;
    }
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + metrics.NODE_H / 2 };
  }
  var single = positions[unit.partners[0]];
  return single ? { x: single.x, y: single.y + metrics.NODE_H / 2 } : null;
}

/** An SVG path for one descent line: down, across, down into the child. */
function LAY_descentPath(edge, radius) {
  var r = radius === undefined ? 10 : radius;
  var dx = edge.toX - edge.fromX;
  if (Math.abs(dx) < 1) {
    return 'M ' + edge.fromX + ' ' + edge.fromY + ' L ' + edge.toX + ' ' + edge.toY;
  }
  var turn = Math.min(r, Math.abs(dx) / 2, Math.abs(edge.toY - edge.busY) / 2);
  var dir = dx > 0 ? 1 : -1;
  return 'M ' + edge.fromX + ' ' + edge.fromY +
    ' L ' + (edge.toX - turn * dir) + ' ' + edge.busY +
    ' Q ' + edge.toX + ' ' + edge.busY + ' ' + edge.toX + ' ' + (edge.busY + turn) +
    ' L ' + edge.toX + ' ' + edge.toY;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LAY_compute: LAY_compute, LAY_edges: LAY_edges,
    LAY_descentPath: LAY_descentPath, LAY_generations: LAY_generations
  };
}
