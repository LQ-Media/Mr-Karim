/**
 * Kinship engine tests.
 *
 * Each case states what one person should call another, in all three languages.
 * The Malay column is where the interesting failures live: those titles depend
 * on birth order, which no other kinship system needs.
 */
const assert = require('assert');
const { loadEngine } = require('./harness');
const { buildFamily, buildInLawFamily, person, parent } = require('./fixtures');

const env = loadEngine(['05_Relations.gs', '06_Kinship.gs', '07_Titles.gs']);
const graph = env.REL_buildGraph(buildFamily());
const settings = { birth_order_titles: 'Long,Ngah,Alang,Anjang,Andak,Uda,Uteh' };

const NAMES = {
  P001: 'Ismail (paternal grandfather)', P002: 'Aminah (paternal grandmother)',
  P003: 'Yusof (maternal grandfather)', P004: 'Halimah (maternal grandmother)',
  P010: 'Osman (father\'s eldest brother)', P011: 'Fatimah (father\'s 2nd sibling)',
  P012: 'Rahim (father, 3rd)', P013: 'Zainab (father\'s 4th sibling)',
  P014: 'Sulaiman (father\'s youngest brother)', P020: 'Salmah (mother)',
  P021: 'Hassan (mother\'s younger brother)', P030: 'Mariam (Osman\'s wife)',
  P040: 'Nurul (elder sister)', P041: 'Karim (ego)', P042: 'Faizal (younger brother)',
  P043: 'Zaki (paternal first cousin)', P050: 'Aisha (wife)',
  P051: 'Ibrahim (wife\'s father)', P060: 'Hana (daughter)',
  P061: 'Amir (daughter\'s husband)', P062: 'Latif (Amir\'s father)'
};

const cases = [
  // ego, target, Malay, English, Arabic
  ['P041', 'P041', 'Saya', 'You', 'Ana'],
  ['P041', 'P012', 'Ayah', 'Father', 'Ab'],
  ['P041', 'P020', 'Ibu', 'Mother', 'Umm'],
  ['P041', 'P001', 'Atuk', 'Grandfather', 'Jadd'],
  ['P041', 'P004', 'Nenek', 'Grandmother', 'Jaddah'],

  // Birth-order titles. Osman is the eldest of five, so Pak Long to every
  // niece and nephew; Sulaiman is the youngest, so Pak Su.
  ['P041', 'P010', 'Pak Long', 'Uncle', "'Amm"],
  ['P041', 'P011', 'Mak Ngah', 'Aunt', "'Ammah"],
  ['P041', 'P013', 'Mak Anjang', 'Aunt', "'Ammah"],
  ['P041', 'P014', 'Pak Su', 'Uncle', "'Amm"],

  // The maternal side. Malay treats him the same as a paternal uncle and ranks
  // him among his own siblings (youngest of two); Arabic must call him Khal.
  ['P041', 'P021', 'Pak Su', 'Uncle', 'Khal'],

  // The wife of Pak Long is Mak Long -- the title follows the marriage.
  ['P041', 'P030', 'Mak Long', 'Aunt by marriage', 'Qarib bil-musaharah'],

  // Siblings are graded by seniority in Malay, not in English or Arabic.
  ['P041', 'P040', 'Kakak', 'Older sister', 'Ukht'],
  ['P041', 'P042', 'Adik', 'Younger brother', 'Akh'],
  ['P040', 'P041', 'Adik', 'Younger brother', 'Akh'],
  ['P042', 'P040', 'Kakak', 'Older sister', 'Ukht'],

  // Cousins. Arabic names Zaki after the uncle he descends from.
  ['P041', 'P043', 'Sepupu', 'First cousin', "Ibn al-'Amm"],
  ['P043', 'P041', 'Sepupu', 'First cousin', "Ibn al-'Amm"],

  // Down the line.
  ['P041', 'P060', 'Anak Perempuan', 'Daughter', 'Bint'],
  ['P012', 'P060', 'Cucu', 'Granddaughter', 'Hafidah'],
  ['P001', 'P060', 'Cicit', 'Great-granddaughter', 'Bint al-Hafid'],
  ['P060', 'P001', 'Moyang', 'Great-grandfather', "Jadd al-'ulya"],

  // Marriage.
  ['P041', 'P050', 'Isteri', 'Wife', 'Zawjah'],
  ['P050', 'P041', 'Suami', 'Husband', 'Zawj'],
  ['P041', 'P051', 'Bapa Mertua', 'Father-in-law', 'Ham'],
  ['P051', 'P041', 'Menantu', 'Son-in-law', 'Sihr'],
  ['P050', 'P040', 'Kakak Ipar', 'Sister-in-law', 'Salifah'],
  ['P040', 'P050', 'Adik Ipar', 'Sister-in-law', 'Salifah'],

  // Nephews and nieces.
  ['P010', 'P041', 'Anak Saudara', 'Nephew', 'Ibn al-Akh'],
  ['P001', 'P043', 'Cucu', 'Grandson', 'Hafid'],
  ['P010', 'P060', 'Cucu Saudara', 'Great-niece', 'Hafidat al-Akh'],

  // A cousin once removed, in both directions.
  ['P060', 'P043', 'Sepupu Ibu Bapa', 'First cousin once removed', "Ibn al-'Amm"],
  ['P043', 'P060', 'Anak Sepupu', 'First cousin once removed', "Bint al-'Amm"],

  // Besan: the relationship between two sets of parents whose children married.
  // Malay has a word for it, English needs a phrase, and it is a real and
  // socially important relationship in this family.
  ['P041', 'P062', 'Besan', "Child's parent-in-law", 'Nasib'],
  ['P062', 'P041', 'Besan', "Child's parent-in-law", 'Nasib'],

  // Great-uncle.
  ['P060', 'P014', 'Atuk Saudara', 'Great-uncle', "'Amm al-Ab"]
];

let pass = 0;
const failures = [];

for (const [ego, target, ms, en, ar] of cases) {
  const got = {
    ms: env.TTL_title(graph, ego, target, 'ms', settings).label,
    en: env.TTL_title(graph, ego, target, 'en', settings).label,
    ar: env.TTL_title(graph, ego, target, 'ar', settings).label
  };
  const want = { ms, en, ar };
  for (const lang of ['ms', 'en', 'ar']) {
    if (got[lang] === want[lang]) {
      pass++;
    } else {
      failures.push(
        `${NAMES[ego]} -> ${NAMES[target]} [${lang}]\n` +
        `      expected: ${want[lang]}\n` +
        `      actual:   ${got[lang]}`
      );
    }
  }
}

/* --- Relationships that exist only through marriage ------------------ *
 *
 * Four siblings, each married, each with children. The interesting people are
 * the four who married in: they are related to each other by nothing but the
 * marriages, and a flat family list has nowhere to put them -- which is exactly
 * what a real trip manifest showed, with three of them left blank.
 */

const inLaws = env.REL_buildGraph(buildInLawFamily());
const IN_NAMES = {
  X01: 'Salim (wife\'s father)', X02: 'Sadiah (wife\'s mother)',
  X03: 'Suaidah (wife)', X04: 'Karim (ego)', X05: 'Syahirah (wife\'s sister)',
  X06: 'Afiq (married to Syahirah)', X07: 'Azwan (wife\'s brother)',
  X08: 'Farihin (married to Azwan)', X09: 'Syazwani (wife\'s sister)',
  X10: 'Nazrul (married to Syazwani)', X11: 'Aqilah (daughter)',
  X14: 'Bilal (Azwan\'s son)', X15: 'Abbas (son)', X16: 'Hadi (Syahirah\'s son)'
};

const inLawCases = [
  ['X04', 'X01', 'Bapa Mertua', 'Father-in-law', 'Ham'],
  ['X04', 'X03', 'Isteri', 'Wife', 'Zawjah'],
  ['X04', 'X05', 'Adik Ipar', 'Sister-in-law', 'Salifah'],
  ['X04', 'X07', 'Adik Ipar', 'Brother-in-law', 'Sihr'],

  // Biras: married to your spouse's sibling. Malay names this relationship,
  // Arabic names it, and English has to borrow brother-in-law and leave the
  // distinction unsaid.
  ['X04', 'X06', 'Biras', 'Brother-in-law', 'Silf'],
  ['X04', 'X08', 'Biras', 'Sister-in-law', 'Silfah'],
  ['X04', 'X10', 'Biras', 'Brother-in-law', 'Silf'],
  ['X06', 'X04', 'Biras', 'Brother-in-law', 'Silf'],
  ['X08', 'X10', 'Biras', 'Brother-in-law', 'Silf'],

  // Your spouse's sibling's child is your nephew. Malay does not mark that the
  // link runs through a marriage.
  ['X04', 'X14', 'Anak Saudara', 'Nephew by marriage', 'Ibn al-Akh'],
  ['X04', 'X16', 'Anak Saudara', 'Nephew by marriage', 'Ibn al-Akh'],

  // The generation below sees plain blood relatives, ranked by the birth order
  // of the parents' generation.
  // These are her MOTHER's siblings, so Arabic uses the maternal words. Malay
  // ranks them by birth order and does not care which side; English marks
  // neither. One stored fact, three different answers.
  ['X11', 'X01', 'Atuk', 'Grandfather', 'Jadd'],
  ['X11', 'X05', 'Mak Ngah', 'Aunt', 'Khalah'],
  ['X11', 'X07', 'Pak Alang', 'Uncle', 'Khal'],
  ['X11', 'X09', 'Mak Su', 'Aunt', 'Khalah'],
  ['X11', 'X06', 'Pak Ngah', 'Uncle by marriage', 'Qarib bil-musaharah'],
  ['X11', 'X14', 'Sepupu', 'First cousin', 'Ibn al-Khal'],
  ['X11', 'X15', 'Adik', 'Younger brother', 'Akh']
];

for (const [ego, target, ms, en, ar] of inLawCases) {
  const got = {
    ms: env.TTL_title(inLaws, ego, target, 'ms', settings).label,
    en: env.TTL_title(inLaws, ego, target, 'en', settings).label,
    ar: env.TTL_title(inLaws, ego, target, 'ar', settings).label
  };
  const want = { ms, en, ar };
  for (const lang of ['ms', 'en', 'ar']) {
    if (got[lang] === want[lang]) {
      pass++;
    } else {
      failures.push(
        `${IN_NAMES[ego]} -> ${IN_NAMES[target]} [${lang}]\n` +
        `      expected: ${want[lang]}\n` +
        `      actual:   ${got[lang]}`
      );
    }
  }
}

/* A step-child must read as a step-child, not as "somebody related to the
 * person you married" -- which is what the generic in-law search returned
 * before step relationships were given priority over it. */
const blended = buildInLawFamily();
blended.people.push(person('X20', 'Hafiz bin Omar', 'M', '2010-01-01'));
blended.parentage.push(parent('X20', 'X03', 'mother'));
const blendedGraph = env.REL_buildGraph(blended);

check2('a spouse\'s child from elsewhere is a step-child',
  env.TTL_title(blendedGraph, 'X04', 'X20', 'ms', settings).label, 'Anak Lelaki Tiri');
check2('and in English too',
  env.TTL_title(blendedGraph, 'X04', 'X20', 'en', settings).label, 'Stepson');
check2('while the ego\'s own child is unaffected',
  env.TTL_title(blendedGraph, 'X04', 'X15', 'ms', settings).label, 'Anak Lelaki');

function check2(label, actual, expected) {
  if (actual === expected) pass++;
  else failures.push(`${label}\n      expected: ${expected}\n      actual:   ${actual}`);
}

console.log(`\nkinship: ${pass} passed, ${failures.length} failed\n`);
if (failures.length) {
  failures.forEach((f) => console.log('  FAIL  ' + f));
  process.exit(1);
}
