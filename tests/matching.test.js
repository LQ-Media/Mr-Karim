/**
 * Duplicate matcher tests.
 *
 * The cases that matter are the two failure directions: missing a real duplicate
 * (the tree silently splits in half) and flagging two different people as one
 * (a father and son who share a name get merged, which is worse).
 */
const { loadEngine } = require('./harness');
const { buildFamily } = require('./fixtures');

const env = loadEngine(['05_Relations.gs', '06_Kinship.gs', '07_Titles.gs', '08_Matching.gs']);
const graph = env.REL_buildGraph(buildFamily());

let pass = 0;
const failures = [];

function check(label, actual, predicate, expectation) {
  if (predicate(actual)) pass++;
  else failures.push(`${label}\n      expected: ${expectation}\n      actual:   ${JSON.stringify(actual)}`);
}

/* --- Name parsing ------------------------------------------------- */

const parsed = env.MTC_parseName('Hj. Mohd Ahmad bin Ismail');
check('parses honorific, alias and patronym',
  parsed,
  (p) => p.own.join(' ') === 'muhammad ahmad' && p.patronym.join(' ') === 'ismail' && p.genderHint === 'M',
  "own 'muhammad ahmad', patronym 'ismail', gender M");

const parsedF = env.MTC_parseName('Siti Nurhaliza binti Tarudin');
check('binti implies female',
  parsedF.genderHint, (g) => g === 'F', 'F');

check('a/l is parsed as a patronym marker',
  env.MTC_parseName('Ramesh a/l Subramaniam').patronym.join(' '),
  (p) => p === 'subramaniam', 'subramaniam');

check('a name with no marker keeps every token',
  env.MTC_parseName('John Smith').own.join(' '),
  (o) => o === 'john smith', 'john smith');

check('spelling variants collapse',
  env.MTC_jaroWinkler('muhammad', 'muhammad'), (s) => s === 1, '1');

/* --- Catching real duplicates ------------------------------------- */

// A cousin enters Karim's uncle by a different spelling and a partial name,
// with no DOB. The patronym is the only strong link: Sulaiman's father is
// recorded as Ismail, and the typed name says "bin Ismail".
const typedUncle = {
  person_id: null,
  full_name: 'Sulaiman bin Ismail',
  display_name: 'Sulaiman',
  gender: 'M'
};
const unclehits = env.MTC_findCandidates(graph, typedUncle, 50, 5);
check('finds an existing uncle from name and patronym alone',
  unclehits.length ? { id: unclehits[0].person.person_id, score: unclehits[0].score } : null,
  (h) => h && h.id === 'P014' && h.score >= 60,
  'P014 (Sulaiman) scoring 60+');

check('the patronym is what identified him',
  unclehits[0].signals.map((s) => s.signal),
  (s) => s.indexOf('father_matches') !== -1,
  'father_matches among the signals');

// A transliteration variant plus a matching birth date.
const typedVariant = {
  person_id: null,
  full_name: 'Mohd Osman bin Ismail',
  display_name: 'Osman',
  gender: 'M',
  birth_date: '1945-01-10',
  birth_precision: 'exact'
};
const variantHits = env.MTC_findCandidates(graph, typedVariant, 50, 5);
check('matches across a spelling variant with a confirming date',
  variantHits.length ? { id: variantHits[0].person.person_id, score: variantHits[0].score } : null,
  (h) => h && h.id === 'P010' && h.score >= 75,
  'P010 (Osman) scoring 75+');

/* --- Refusing false positives ------------------------------------- */

// A father and son sharing a given name. Names align, but they are already
// related, and the app must not offer to merge them.
const fatherSon = env.MTC_score(graph, graph.people.P012, graph.people.P042);
check('a father and his son are never a merge candidate',
  fatherSon.score, (s) => s < 40, 'below 40');

check('a direct-line link vetoes the pair outright',
  fatherSon,
  (r) => r.score === 0 && r.veto === 'descendant',
  'score 0 with a descendant veto');

// Same name, different gender.
const genderClash = env.MTC_score(graph,
  { person_id: null, full_name: 'Zainab binti Ismail', gender: 'M' },
  graph.people.P013);
check('a stated gender conflict suppresses the match',
  genderClash.score, (s) => s < 55, 'below 55');

// Two brothers. Same father, same surname pattern, different given names --
// a shared parent must not outweigh clearly different names.
const brothers = env.MTC_score(graph, graph.people.P010, graph.people.P014);
check('two brothers are not merged despite a shared father',
  brothers.score, (s) => s < 40, 'below 40');

// Completely unrelated strangers.
const strangers = env.MTC_score(graph, graph.people.P041, graph.people.P062);
check('unrelated people score near zero',
  strangers.score, (s) => s < 30, 'below 30');

/* --- The sweep ----------------------------------------------------- */

const sweep = env.MTC_sweep(graph, 68);
check('a clean tree produces an empty merge queue',
  sweep.length, (n) => n === 0, '0 pairs');

// Now inject a genuine duplicate: a second record for Karim's father, entered
// by a different relative with a nickname and no dates.
const dirty = buildFamily();
dirty.people.push({
  person_id: 'P900',
  display_name: 'Rahim',
  full_name: 'Abdul Rahim bin Ismail',
  given_name: 'Rahim',
  gender: 'M',
  birth_date: '1951-11-03',
  birth_precision: 'exact',
  is_living: 'TRUE',
  status: 'active'
});
const dirtyGraph = env.REL_buildGraph(dirty);
const dirtySweep = env.MTC_sweep(dirtyGraph, 68);
check('the sweep surfaces an injected duplicate',
  dirtySweep.length ? [dirtySweep[0].a, dirtySweep[0].b].sort().join('+') : null,
  (p) => p === 'P012+P900',
  'P012+P900 at the top of the queue');


/* --- Regressions --------------------------------------------------- */

// Two women whose fathers are called Rahim and Ibrahim. Jaro-Winkler alone
// rates those names at 0.91 and once scored this pair as a 72% duplicate.
const similarFathers = env.MTC_score(graph, graph.people.P040, graph.people.P050);
check('names contained inside longer names are not treated as matches',
  similarFathers.score, (s) => s < 30, 'below 30');

check("a father called Rahim and a father called Ibrahim do not agree",
  similarFathers.signals.map((s) => s.signal),
  (s) => s.indexOf('father_matches') === -1 && s.indexOf('same_father_record') === -1,
  'no father-match signal');

// One shared fact must be counted once. Two brothers both state the same
// father, and that agreement must not be scored three times over.
const brotherSignals = env.MTC_score(graph, graph.people.P010, graph.people.P014)
  .signals.filter((s) => s.signal.indexOf('father') !== -1);
check('agreement about the father is scored exactly once',
  brotherSignals.length, (n) => n === 1, '1 father signal');

// The commonest real duplicate: two cousins each add the same uncle under the
// same grandparents, so the two copies look like siblings to the tree. Vetoing
// siblings would hide exactly the case the matcher exists to catch.
const dup = buildFamily();
dup.people.push({
  person_id: 'P910', display_name: 'Sulaiman', full_name: 'Sulaiman bin Ismail',
  given_name: 'Sulaiman', gender: 'M', birth_date: '1958-09-30',
  birth_precision: 'exact', is_living: 'TRUE', status: 'active'
});
dup.parentage.push({ link_id: 'LX1', child_id: 'P910', parent_id: 'P001',
  parent_role: 'father', relation_type: 'biological', status: 'active' });
dup.parentage.push({ link_id: 'LX2', child_id: 'P910', parent_id: 'P002',
  parent_role: 'mother', relation_type: 'biological', status: 'active' });

const dupGraph = env.REL_buildGraph(dup);
const dupScore = env.MTC_score(dupGraph, dupGraph.people.P014, dupGraph.people.P910);
check('a duplicate entered as a sibling of itself is still caught',
  dupScore.score, (s) => s >= 68, '68 or above');

const dupSweep = env.MTC_sweep(dupGraph, 68);
check('and it reaches the top of the merge queue',
  dupSweep.length ? [dupSweep[0].a, dupSweep[0].b].sort().join('+') : null,
  (p) => p === 'P014+P910', 'P014+P910');

// The same shape, but genuinely two different brothers, must stay apart.
check('while real siblings under the same parents stay separate',
  env.MTC_score(dupGraph, dupGraph.people.P010, dupGraph.people.P014).score,
  (s) => s < 40, 'below 40');

console.log(`\nmatching: ${pass} passed, ${failures.length} failed\n`);
if (failures.length) {
  failures.forEach((f) => console.log('  FAIL  ' + f));
  process.exit(1);
}
