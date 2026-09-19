/**
 * Kinship engine tests.
 *
 * Each case states what one person should call another, in all three languages.
 * The Malay column is where the interesting failures live: those titles depend
 * on birth order, which no other kinship system needs.
 */
const assert = require('assert');
const { loadEngine } = require('./harness');
const { buildFamily } = require('./fixtures');

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

console.log(`\nkinship: ${pass} passed, ${failures.length} failed\n`);
if (failures.length) {
  failures.forEach((f) => console.log('  FAIL  ' + f));
  process.exit(1);
}
