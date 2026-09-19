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
