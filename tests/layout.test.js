/**
 * Canvas layout.
 *
 * A wall chart is only useful if it reads as a family: generations in rows,
 * couples side by side, children gathered beneath their parents, and nothing
 * sitting on top of anything else. These assert those properties rather than
 * exact coordinates, which are free to change as the algorithm improves.
 */
const { loadEngine } = require('./harness');
const { buildFamily, buildInLawFamily } = require('./fixtures');

const env = loadEngine(['05_Relations.gs', '06_Kinship.gs', '07_Titles.gs', '13_Layout.gs']);

let pass = 0;
const failures = [];
function check(label, actual, predicate, expectation) {
  if (predicate(actual)) pass++;
  else failures.push(`${label}\n      expected: ${expectation}\n      actual:   ${JSON.stringify(actual)}`);
}

function layoutOf(data) {
  const graph = env.REL_buildGraph(data);
  return { graph, out: env.LAY_compute(graph, {}) };
}

/* ---- Generations ---- */
{
  const { graph, out } = layoutOf(buildFamily());
  const g = out.generations;

  check('grandparents sit on the top row', g.P001, (v) => v === 0, '0');
  check('their children one row down', g.P012, (v) => v === 1, '1');
  check('and the grandchildren below that', g.P041, (v) => v === 2, '2');
  check('the fourth generation below again', g.P060, (v) => v === 3, '3');

  // A spouse who married in has no parents in the tree, but belongs beside the
  // person they married, not floating at the top.
  check('someone who married in shares their spouse\'s row',
    g.P050, (v) => v === g.P041, 'the same row as P041');
  check('and the maternal grandparents share the top row with the paternal ones',
    g.P003, (v) => v === 0, '0');

  check('every person is placed', Object.keys(g).length,
    (n) => n === Object.keys(graph.people).length, '21');
}

/* ---- Rows, couples and collisions ---- */
{
  const { graph, out } = layoutOf(buildFamily());
  const nodes = out.nodes;
  const M = out.metrics;

  // Nothing may overlap anything else on its row.
  const rows = {};
  for (const id of Object.keys(nodes)) {
    if (id === '__partners') continue;
    (rows[nodes[id].gen] = rows[nodes[id].gen] || []).push(id);
  }
  let worst = Infinity;
  for (const gen of Object.keys(rows)) {
    const sorted = rows[gen].slice().sort((a, b) => nodes[a].x - nodes[b].x);
    for (let i = 1; i < sorted.length; i++) {
      worst = Math.min(worst, nodes[sorted[i]].x - nodes[sorted[i - 1]].x);
    }
  }
  check('no two cards overlap on a row', Math.round(worst),
    (gap) => gap >= M.NODE_W, 'at least one card width apart');

  // Married couples stand closer together than unrelated neighbours, which is
  // what makes a couple read as one object.
  const couple = Math.abs(nodes.P012.x - nodes.P020.x);
  check('a married couple is adjacent', Math.round(couple),
    (d) => d <= M.NODE_W + M.GAP_X, 'no wider than a normal gap');

  // Each set of parents sits over the middle of their children.
  for (const unit of out.units) {
    if (unit.children.length < 2) continue;
    const pc = unit.partners.reduce((s, p) => s + nodes[p].x, 0) / unit.partners.length;
    const cc = unit.children.reduce((s, c) => s + nodes[c].x, 0) / unit.children.length;
    check(`parents sit over their children (${unit.id})`, Math.round(Math.abs(pc - cc)),
      (off) => off <= M.NODE_W, 'within one card width');
  }

  // Rows are separated vertically, so descent always runs downward.
  check('rows are stacked, not interleaved',
    Math.round(nodes.P041.y - nodes.P012.y),
    (dy) => dy >= M.NODE_H + 40, 'a clear row apart');
}

/* ---- Edges ---- */
{
  const { graph, out } = layoutOf(buildFamily());
  const positions = {};
  for (const id of Object.keys(out.nodes)) {
    if (id !== '__partners') positions[id] = out.nodes[id];
  }
  const edges = env.LAY_edges(out.units, positions, out.metrics);

  const unions = edges.filter((e) => e.kind === 'union');
  const descents = edges.filter((e) => e.kind === 'descent');
  const stems = edges.filter((e) => e.kind === 'stem');

  check('one connector per marriage', unions.length,
    (n) => n === graph.unionsOf.P001.length + 5, '6 marriages');
  // Five couples with children, plus two lone fathers whose own parents were
  // never recorded -- seven sets of parents, fourteen children between them.
  check('one descent line per parent-child pair', descents.length,
    (n) => n === 14, '14');
  check('one trunk per set of parents', stems.length, (n) => n === 7, '7');

  // Descent must run downward, or the arrowheads point into their parents.
  check('every descent line runs downward',
    descents.every((e) => e.toY > e.fromY), (v) => v === true, 'true');

  // The bus sits above the children it serves.
  check('the bus line clears the children it feeds',
    descents.every((e) => e.busY <= e.toY), (v) => v === true, 'true');

  const path = env.LAY_descentPath(descents[0], 12);
  check('a descent path is drawable SVG', path,
    (d) => /^M [-\d.]+ [-\d.]+/.test(d) && d.length > 10, 'a path starting with M');
}

/* ---- Two families joined by a marriage ---- */
{
  // The shape a real tree takes: one side entered, the other reached only
  // through a marriage. There is no single root to count generations from.
  const { graph, out } = layoutOf(buildInLawFamily());
  const g = out.generations;

  check('a person with no parents recorded still lands beside their spouse',
    g.X04, (v) => v === g.X03, 'the same row as their spouse');
  check('all four who married in sit on the same row',
    [g.X04, g.X06, g.X08, g.X10].join(','), (v) => v === '1,1,1,1', '1,1,1,1');
  check('and their children a row below',
    g.X11, (v) => v === 2, '2');
}

/* ---- A single person, and an empty tree ---- */
{
  const solo = env.LAY_compute(env.REL_buildGraph({
    people: [{ person_id: 'A1', display_name: 'Alone', gender: 'M', status: 'active' }],
    parentage: [], unions: [], customTitles: []
  }), {});
  check('one person alone is placed without error', solo.nodes.A1,
    (n) => n && n.gen === 0, 'at generation 0');

  const empty = env.LAY_compute(env.REL_buildGraph(
    { people: [], parentage: [], unions: [], customTitles: [] }), {});
  check('an empty tree produces empty bounds rather than infinity',
    empty.bounds.width, (w) => w === 0, '0');
}

console.log(`\nlayout: ${pass} passed, ${failures.length} failed\n`);
if (failures.length) {
  failures.forEach((f) => console.log('  FAIL  ' + f));
  process.exit(1);
}
