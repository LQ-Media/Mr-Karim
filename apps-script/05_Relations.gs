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
    // Losers of a merge are followed, not shown; deleted people are gone from
    // the tree but kept in the sheet so a mistake can be undone.
    if (person.status === 'merged' || person.status === 'deleted') continue;
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
