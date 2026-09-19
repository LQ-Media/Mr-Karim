/**
 * Configurable birth-order titles.
 *
 * Long, Ngah, Alang and the rest vary by family and by region. A family that
 * sees the wrong word for an uncle they have called Pak Ngah their whole life
 * will not trust anything else the app says, so the sequence has to be theirs,
 * and changing it has to actually change the titles.
 */
const { loadEngine } = require('./harness');
const { buildFamily } = require('./fixtures');

const env = loadEngine(['00_Config.gs', '05_Relations.gs', '06_Kinship.gs',
                        '07_Titles.gs', '08_Matching.gs', '10_Admin.gs']);
const graph = env.REL_buildGraph(buildFamily());

let pass = 0;
const failures = [];
function check(label, actual, predicate, expectation) {
  if (predicate(actual)) pass++;
  else failures.push(`${label}\n      expected: ${expectation}\n      actual:   ${JSON.stringify(actual)}`);
}

function titleOf(targetId, settings) {
  return env.TTL_title(graph, 'P041', targetId, 'ms', settings).label;
}

/* --- The default sequence ------------------------------------------ */

const DEFAULT = { birth_order_titles: 'Long,Ngah,Alang,Anjang,Andak,Uda,Uteh' };

check('eldest of five uncles is Pak Long', titleOf('P010', DEFAULT), (t) => t === 'Pak Long', 'Pak Long');
check('second is Mak Ngah', titleOf('P011', DEFAULT), (t) => t === 'Mak Ngah', 'Mak Ngah');
check('fourth is Mak Anjang', titleOf('P013', DEFAULT), (t) => t === 'Mak Anjang', 'Mak Anjang');
check('youngest is Pak Su', titleOf('P014', DEFAULT), (t) => t === 'Pak Su', 'Pak Su');

/* --- A family that orders them differently -------------------------- */

// Some families use Teh in the third position rather than Alang, and a shorter
// run overall. The youngest stays Su in every variant.
const OTHER = { birth_order_titles: 'Long,Ngah,Teh,Cik' };

check('a different third title takes effect', titleOf('P012', OTHER), (t) => t === 'Ayah', 'Ayah (the father himself)');
check('the fourth sibling picks up the new word', titleOf('P013', OTHER), (t) => t === 'Mak Cik', 'Mak Cik');
check('the first two still follow the family list', titleOf('P010', OTHER), (t) => t === 'Pak Long', 'Pak Long');
check('the youngest is Su whatever the list says', titleOf('P014', OTHER), (t) => t === 'Pak Su', 'Pak Su');

// A list shorter than the family falls back rather than inventing a word.
const SHORT = { birth_order_titles: 'Long,Ngah' };
check('a sequence that runs out falls back to Pak Cik',
  titleOf('P013', SHORT), (t) => t === 'Mak Cik', 'Mak Cik');

// No setting at all uses the built-in default.
check('no configured sequence still names the eldest',
  titleOf('P010', {}), (t) => t === 'Pak Long', 'Pak Long');

/* --- Ranking that cannot be trusted --------------------------------- */

// One sibling with no birth date and no recorded order makes the whole
// generation unrankable. Calling the eldest uncle Pak Su is worse than calling
// him Pak Cik, so the engine declines to guess.
const partial = buildFamily();
partial.people.forEach((p) => {
  if (p.person_id === 'P011') { p.birth_date = ''; p.birth_precision = 'unknown'; }
});
const partialGraph = env.REL_buildGraph(partial);
check('an unrankable generation falls back instead of guessing',
  env.TTL_title(partialGraph, 'P041', 'P010', 'ms', DEFAULT).label,
  (t) => t === 'Pak Cik', 'Pak Cik');

// A hand-set order rescues it, which is the point of the manual override.
const fixed = buildFamily();
fixed.people.forEach((p) => {
  const order = { P010: 1, P011: 2, P012: 3, P013: 4, P014: 5 }[p.person_id];
  if (order) { p.birth_date = ''; p.birth_order = order; p.birth_order_source = 'manual'; }
});
check('a hand-set order works with no birth dates at all',
  env.TTL_title(env.REL_buildGraph(fixed), 'P041', 'P010', 'ms', DEFAULT).label,
  (t) => t === 'Pak Long', 'Pak Long');

/* --- Cleaning what an admin types ----------------------------------- */

check('a typed sequence is normalised',
  env.ADM_cleanSetting('titles', ' Long , Ngah ,, Teh '),
  (v) => v === 'Long,Ngah,Teh', 'Long,Ngah,Teh');

check('markup cannot reach a label beside somebody\'s name',
  env.ADM_cleanSetting('titles', '<img src=x onerror=alert(1)>,Ngah'),
  (v) => v.indexOf('<') === -1 && v.indexOf('>') === -1, 'no angle brackets');

check('an empty sequence is refused rather than saved',
  env.ADM_cleanSetting('titles', '   ,  , '), (v) => v === null, 'null');

check('an unknown language is refused',
  env.ADM_cleanSetting('lang', 'fr'), (v) => v === null, 'null');

check('a known language is accepted',
  env.ADM_cleanSetting('lang', 'ar'), (v) => v === 'ar', 'ar');

check('a match threshold outside sane bounds is refused',
  env.ADM_cleanSetting('score', '5'), (v) => v === null, 'null');

check('a sensible threshold is kept',
  env.ADM_cleanSetting('score', '72'), (v) => v === '72', '72');

console.log(`\nsettings: ${pass} passed, ${failures.length} failed\n`);
if (failures.length) {
  failures.forEach((f) => console.log('  FAIL  ' + f));
  process.exit(1);
}
