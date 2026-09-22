/**
 * Duplicate detection.
 *
 * In any crowd-sourced family tree the same person gets entered twice by two
 * different relatives, and the tree quietly becomes wrong: the two records never
 * link up, so half the family appears unrelated to the other half. Catching this
 * at entry time matters far more than cleaning it up later, because by then
 * other people have already attached children to the wrong copy.
 *
 * The single most useful signal costs nothing and most systems throw it away:
 * a Malay name states its owner's father. "Ahmad bin Ismail" is Ahmad, son of
 * Ismail. When someone types that name and the tree already holds an Ahmad whose
 * recorded father is called Ismail, that is not a coincidence.
 */

/* Spelling variants that are the same name. Malay transliterations of Arabic
 * names vary by generation, by registrar and by personal preference, so string
 * similarity alone treats Mohd, Muhammad and Mohamed as three different people. */
var MTC_ALIASES = {
  mohd: 'muhammad', muhd: 'muhammad', mohamad: 'muhammad', mohamed: 'muhammad',
  mohammad: 'muhammad', mohammed: 'muhammad', md: 'muhammad', mhd: 'muhammad',
  abd: 'abdul', abdoul: 'abdul', abdull: 'abdul',
  nor: 'nur', noor: 'nur', nurul: 'nur',
  ahmed: 'ahmad', achmad: 'ahmad',
  yusuf: 'yusof', yusoff: 'yusof', joseph: 'yusof',
  ismael: 'ismail', ibrahiem: 'ibrahim',
  fatima: 'fatimah', fatma: 'fatimah',
  aisyah: 'aisha', ayesha: 'aisha', aishah: 'aisha',
  zainab: 'zainab', zaynab: 'zainab',
  khadija: 'khadijah', hadijah: 'khadijah',
  sulaiman: 'sulaiman', suleiman: 'sulaiman', solomon: 'sulaiman',
  osman: 'osman', othman: 'osman', usman: 'osman',
  hamzah: 'hamza', hamsah: 'hamza'
};

/* Titles and honorifics carry no identity information. */
var MTC_HONORIFICS = ['haji', 'hajjah', 'hj', 'hjh', 'dato', 'datuk', 'dr', 'ustaz',
                      'ustazah', 'tuan', 'puan', 'encik', 'cik', 'syed', 'sharifah'];

/* The words that introduce a patronymic, and what they imply about gender. */
var MTC_PATRONYM_MARKERS = [
  { words: ['bin', 'b', 'ibn'], type: 'bin', gender: 'M' },
  { words: ['binti', 'binte', 'bt', 'bte'], type: 'binti', gender: 'F' },
  { words: ['a/l', 'al', 's/o'], type: 'a/l', gender: 'M' },
  { words: ['a/p', 'd/o'], type: 'a/p', gender: 'F' }
];

/* ------------------------------------------------------------------ *
 * Name parsing
 * ------------------------------------------------------------------ */

function MTC_normalise(text) {
  if (!text) return '';
  var lower = String(text).toLowerCase();
  var letters = lower.replace(/[^a-z0-9/\s]/g, ' ');
  var single = letters.replace(/\s+/g, ' ');
  return single.replace(/^\s+|\s+$/g, '');
}

function MTC_canonicalToken(token) {
  return MTC_ALIASES[token] || token;
}

/**
 * Splits a name into the person's own names and their father's.
 *
 * Returns { own, patronym, type, genderHint }. `own` and `patronym` are arrays
 * of canonical tokens with honorifics removed, so "Hj. Mohd Ahmad bin Ismail"
 * yields own ['muhammad','ahmad'], patronym ['ismail'], genderHint 'M'.
 */
function MTC_parseName(fullName) {
  var tokens = MTC_normalise(fullName).split(' ');
  var own = [];
  var patronym = [];
  var type = 'none';
  var genderHint = null;
  var afterMarker = false;

  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    if (!token) continue;

    if (!afterMarker) {
      var marker = MTC_matchMarker(token, tokens[i + 1]);
      if (marker) {
        // A lone "b" is only a marker when a name follows it.
        afterMarker = true;
        type = marker.type;
        genderHint = marker.gender;
        continue;
      }
    }

    if (MTC_HONORIFICS.indexOf(token) !== -1) continue;

    if (afterMarker) patronym.push(MTC_canonicalToken(token));
    else own.push(MTC_canonicalToken(token));
  }

  return { own: own, patronym: patronym, type: type, genderHint: genderHint };
}

function MTC_matchMarker(token, nextToken) {
  for (var i = 0; i < MTC_PATRONYM_MARKERS.length; i++) {
    var marker = MTC_PATRONYM_MARKERS[i];
    if (marker.words.indexOf(token) !== -1) {
      // "b" and "al" appear inside ordinary names too, so require a following word.
      if ((token === 'b' || token === 'al') && !nextToken) return null;
      return marker;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * String similarity
 * ------------------------------------------------------------------ */

/** Jaro-Winkler, which handles the transpositions and dropped letters that
 *  hand-typed names are full of, and rewards a matching prefix. */
function MTC_jaroWinkler(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;

  var matchWindow = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  var aFlags = [];
  var bFlags = [];
  var matches = 0;

  for (var i = 0; i < a.length; i++) {
    var start = Math.max(0, i - matchWindow);
    var end = Math.min(i + matchWindow + 1, b.length);
    for (var j = start; j < end; j++) {
      if (bFlags[j] || a[i] !== b[j]) continue;
      aFlags[i] = true;
      bFlags[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;

  var transpositions = 0;
  var k = 0;
  for (var m = 0; m < a.length; m++) {
    if (!aFlags[m]) continue;
    while (!bFlags[k]) k++;
    if (a[m] !== b[k]) transpositions++;
    k++;
  }
  transpositions = transpositions / 2;

  var jaro = (matches / a.length + matches / b.length + (matches - transpositions) / matches) / 3;

  var prefix = 0;
  for (var p = 0; p < Math.min(4, a.length, b.length); p++) {
    if (a[p] === b[p]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Similarity between two name tokens, corrected for length.
 *
 * Jaro-Winkler on its own rates 'rahim' against 'ibrahim' at 0.91 and 'ali'
 * against 'khalid' at 0.83, because a short string contained in a longer one
 * scores highly. Malay given names are full of such pairs and treating them as
 * matches merges unrelated families, so similarity is scaled by how far apart
 * the two tokens are in length. Identical tokens are unaffected.
 */
function MTC_tokenScore(a, b) {
  if (a === b) return 1;
  var raw = MTC_jaroWinkler(a, b);
  var ratio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
  return raw * (0.5 + 0.5 * ratio);
}

function MTC_directionalSimilarity(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0;
  var total = 0;
  for (var i = 0; i < tokensA.length; i++) {
    var best = 0;
    for (var j = 0; j < tokensB.length; j++) {
      var score = MTC_tokenScore(tokensA[i], tokensB[j]);
      if (score > best) best = score;
    }
    total += best;
  }
  return total / tokensA.length;
}

/**
 * Agreement between two lists of name tokens, in whichever direction is
 * stronger. People routinely enter a relative under a shorter form of their
 * name -- "Ahmad" for "Ahmad Faizal" -- and the extra token should not count
 * against the match. Other signals are left to separate the genuinely
 * different people this lets through.
 */
function MTC_tokenSimilarity(tokensA, tokensB) {
  return Math.max(
    MTC_directionalSimilarity(tokensA, tokensB),
    MTC_directionalSimilarity(tokensB, tokensA)
  );
}

/* ------------------------------------------------------------------ *
 * Scoring
 * ------------------------------------------------------------------ */

/**
 * Scores how likely it is that `candidate` (an existing record) is the same
 * human being as `subject` (what someone is typing, or another record).
 *
 * Returns { score, signals }. Signals are kept so the admin reviewing a merge
 * sees WHY the app thinks these are the same person, rather than a bare number
 * they have to trust.
 */
function MTC_score(graph, subject, candidate) {
  var signals = [];
  var score = 0;

  function add(points, name, detail) {
    if (!points) return;
    score += points;
    signals.push({ signal: name, points: points, detail: detail || '' });
  }

  // A stated gender conflict is close to decisive. Records where gender was
  // never captured are not penalised.
  if (subject.gender && candidate.gender &&
      subject.gender !== 'U' && candidate.gender !== 'U') {
    if (subject.gender !== candidate.gender) {
      add(-45, 'gender_conflict', subject.gender + ' vs ' + candidate.gender);
    } else {
      add(4, 'gender_match', subject.gender);
    }
  }

  var subjectName = MTC_parseName(subject.full_name || subject.display_name);
  var candidateName = MTC_parseName(candidate.full_name || candidate.display_name);

  var nameAgreement = MTC_tokenSimilarity(subjectName.own, candidateName.own);
  if (nameAgreement > 0.82) add(Math.round(nameAgreement * 26), 'name_similar', Math.round(nameAgreement * 100) + '%');
  else if (nameAgreement > 0.6) add(Math.round(nameAgreement * 10), 'name_partial', Math.round(nameAgreement * 100) + '%');

  // Nicknames. A relative may enter the name the family actually uses.
  if (MTC_aliasHit(subject, candidateName) || MTC_aliasHit(candidate, subjectName)) {
    add(12, 'nickname_match', '');
    if (nameAgreement < 0.8) nameAgreement = 0.8;
  }

  // Whether the two records agree about who the father was -- scored once,
  // from whichever evidence each side offers.
  var father = MTC_fatherAgreement(graph, subject, subjectName, candidate, candidateName);
  add(father.points, father.signal, father.detail);

  add(MTC_dateScore(subject.birth_date, candidate.birth_date,
                    subject.birth_precision, candidate.birth_precision), 'birth_date', '');
  add(MTC_dateScore(subject.death_date, candidate.death_date, 'exact', 'exact'), 'death_date', '');

  add(MTC_exactFieldScore(subject.email, candidate.email, 45), 'email', '');
  add(MTC_exactFieldScore(MTC_digits(subject.mobile), MTC_digits(candidate.mobile), 35), 'mobile', '');
  add(MTC_fuzzyFieldScore(subject.address, candidate.address, 12), 'address', '');
  add(MTC_fuzzyFieldScore(subject.birth_place, candidate.birth_place, 10), 'birth_place', '');

  // How the two records already sit in the tree relative to each other.
  var structure = MTC_structuralCheck(graph, subject, candidate, nameAgreement);
  for (var i = 0; i < structure.signals.length; i++) {
    signals.push(structure.signals[i]);
  }
  if (structure.veto) {
    return { score: 0, signals: signals, veto: structure.veto };
  }
  score += structure.points;

  if (score > 100) score = 100;
  if (score < 0) score = 0;
  return { score: Math.round(score), signals: signals };
}

/**
 * Do these two records agree about the father?
 *
 * Each side states a father either through a recorded parent link or through
 * the patronymic in its own name, and either kind of evidence answers the same
 * question. Scoring the patronym, the recorded link and the two patronyms
 * against each other as three separate signals counted one fact three times and
 * pushed every pair of siblings towards a merge.
 */
function MTC_fatherAgreement(graph, subject, subjectName, candidate, candidateName) {
  var a = MTC_statedFather(graph, subject, subjectName);
  var b = MTC_statedFather(graph, candidate, candidateName);
  if (!a.tokens.length || !b.tokens.length) {
    return { points: 0, signal: 'father_unknown', detail: '' };
  }

  // Both sides point at the same person record: conclusive, no name matching
  // needed.
  if (a.personId && b.personId && a.personId === b.personId) {
    return { points: 30, signal: 'same_father_record', detail: a.personId };
  }

  var similarity = MTC_tokenSimilarity(a.tokens, b.tokens);
  var detail = a.tokens.join(' ') + ' / ' + b.tokens.join(' ');
  if (similarity > 0.88) return { points: 30, signal: 'father_matches', detail: detail };
  if (similarity > 0.80) return { points: 12, signal: 'father_similar', detail: detail };
  if (similarity < 0.45) return { points: -20, signal: 'father_conflict', detail: detail };
  return { points: 0, signal: 'father_inconclusive', detail: detail };
}

/** A record's father, from a recorded link if there is one, from the
 *  patronymic in the name otherwise. */
function MTC_statedFather(graph, person, parsedName) {
  var fatherId = person.person_id ? MTC_fatherOf(graph, person.person_id) : null;
  if (fatherId && graph.people[fatherId]) {
    var father = graph.people[fatherId];
    return {
      personId: fatherId,
      tokens: MTC_parseName(father.full_name || father.display_name).own
    };
  }
  return { personId: null, tokens: parsedName.patronym };
}

/**
 * What the existing shape of the tree says about the pair.
 *
 * Two people already linked across generations, or married to each other, are
 * categorically not the same person -- and sharing a name across generations is
 * ordinary, so those pairs are vetoed outright rather than merely penalised.
 *
 * Siblings are the exception, and an important one. The commonest way a
 * duplicate enters a family tree is two cousins each adding the same uncle
 * under the same grandparents, which leaves the two copies looking exactly like
 * siblings. Vetoing siblings would therefore blind the matcher to the case it
 * exists for, so a sibling pair is penalised only when the names disagree.
 */
function MTC_structuralCheck(graph, subject, candidate, nameAgreement) {
  var out = { points: 0, signals: [], veto: null };
  if (!graph || !subject.person_id || !candidate.person_id) return out;

  var relation = KIN_relate(graph, subject.person_id, candidate.person_id);
  var vetoed = relation.kind === 'spouse' ||
    (relation.kind === 'blood' &&
      (relation.type === 'ancestor' || relation.type === 'descendant' ||
       relation.type === 'auncle' || relation.type === 'nibling'));

  if (vetoed) {
    out.veto = relation.type || relation.kind;
    out.signals.push({
      signal: 'cannot_be_same_person', points: 0,
      detail: 'already linked as ' + (relation.type || relation.kind)
    });
    return out;
  }

  if (relation.kind === 'blood' && relation.type === 'sibling' && nameAgreement < 0.9) {
    out.points -= 25;
    out.signals.push({ signal: 'recorded_as_siblings', points: -25, detail: '' });
  }

  // Shared relatives are strong evidence of being the same person -- but only
  // alongside some agreement about the name. Without it they merely confirm
  // that the two are related, which siblings and cousins already are.
  var weight = nameAgreement >= 0.75 ? 1 : (nameAgreement >= 0.55 ? 0.4 : 0);
  if (!weight) return out;

  var sharedParents = MTC_intersect(
    KIN_parentsOf(graph, subject.person_id), KIN_parentsOf(graph, candidate.person_id));
  if (sharedParents.length) {
    var parentPoints = Math.round(Math.min(sharedParents.length * 28, 45) * weight);
    out.points += parentPoints;
    out.signals.push({ signal: 'shared_parent', points: parentPoints, detail: sharedParents.join(', ') });
  }

  var sharedSpouses = MTC_intersect(
    MTC_ids(KIN_spousesOf(graph, subject.person_id)),
    MTC_ids(KIN_spousesOf(graph, candidate.person_id)));
  if (sharedSpouses.length) {
    var spousePoints = Math.round(35 * weight);
    out.points += spousePoints;
    out.signals.push({ signal: 'shared_spouse', points: spousePoints, detail: sharedSpouses.join(', ') });
  }

  var sharedChildren = MTC_intersect(
    KIN_childrenOf(graph, subject.person_id), KIN_childrenOf(graph, candidate.person_id));
  if (sharedChildren.length) {
    var childPoints = Math.round(32 * weight);
    out.points += childPoints;
    out.signals.push({ signal: 'shared_child', points: childPoints, detail: sharedChildren.join(', ') });
  }

  return out;
}

function MTC_aliasHit(person, otherName) {
  if (!person.also_known_as) return false;
  var aliases = MTC_normalise(person.also_known_as).split(' ');
  for (var i = 0; i < aliases.length; i++) {
    if (!aliases[i]) continue;
    for (var j = 0; j < otherName.own.length; j++) {
      if (MTC_tokenScore(MTC_canonicalToken(aliases[i]), otherName.own[j]) > 0.9) return true;
    }
  }
  return false;
}

function MTC_fatherOf(graph, personId) {
  var links = (graph.parentsOf || {})[personId] || [];
  for (var i = 0; i < links.length; i++) {
    if (links[i].parent_role === 'father' &&
        (links[i].relation_type === 'biological' || links[i].relation_type === 'adoptive')) {
      return links[i].parent_id;
    }
  }
  return null;
}

/**
 * Elders' birth dates are often recorded as a year, or as an approximation, so
 * a partial agreement is worth something and a partial disagreement is not
 * worth punishing as hard as two conflicting exact dates would be.
 */
function MTC_dateScore(a, b, precisionA, precisionB) {
  if (!a || !b) return 0;
  var strA = String(a).slice(0, 10);
  var strB = String(b).slice(0, 10);
  if (strA === strB) return 26;

  var vague = precisionA === 'about' || precisionB === 'about' ||
              precisionA === 'year' || precisionB === 'year';
  if (strA.slice(0, 7) === strB.slice(0, 7)) return 16;
  if (strA.slice(0, 4) === strB.slice(0, 4)) return vague ? 12 : 9;

  var yearGap = Math.abs(Number(strA.slice(0, 4)) - Number(strB.slice(0, 4)));
  if (vague && yearGap <= 2) return 4;
  return yearGap > 5 ? -30 : -14;
}

function MTC_exactFieldScore(a, b, points) {
  if (!a || !b) return 0;
  return String(a).toLowerCase() === String(b).toLowerCase() ? points : 0;
}

function MTC_fuzzyFieldScore(a, b, points) {
  if (!a || !b) return 0;
  var similarity = MTC_jaroWinkler(MTC_normalise(a), MTC_normalise(b));
  return similarity > 0.85 ? points : 0;
}

function MTC_digits(text) {
  if (!text) return '';
  var digits = String(text).replace(/\D/g, '');
  return digits.length > 8 ? digits.slice(-8) : digits;
}

function MTC_ids(spouseEntries) {
  var out = [];
  for (var i = 0; i < spouseEntries.length; i++) out.push(spouseEntries[i].personId);
  return out;
}

function MTC_intersect(a, b) {
  var out = [];
  for (var i = 0; i < a.length; i++) if (b.indexOf(a[i]) !== -1) out.push(a[i]);
  return out;
}

/* ------------------------------------------------------------------ *
 * Search
 * ------------------------------------------------------------------ */

/**
 * Every existing record that might be the person being described, best first.
 *
 * Called live while someone types a new name, so the app can offer "this might
 * be Ahmad bin Ismail, son of Ismail -- link to him instead?" before a duplicate
 * is ever created.
 */
function MTC_findCandidates(graph, subject, threshold, limit) {
  var results = [];
  for (var id in graph.people) {
    if (!Object.prototype.hasOwnProperty.call(graph.people, id)) continue;
    if (id === subject.person_id) continue;
    var candidate = graph.people[id];
    if (candidate.status !== 'active') continue;

    var scored = MTC_score(graph, subject, candidate);
    if (scored.score >= (threshold || 60)) {
      results.push({ person: candidate, score: scored.score, signals: scored.signals });
    }
  }
  results.sort(function (a, b) { return b.score - a.score; });
  return results.slice(0, limit || 8);
}

/** A full sweep for the admin's merge queue. */
function MTC_sweep(graph, threshold) {
  var ids = [];
  for (var id in graph.people) {
    if (Object.prototype.hasOwnProperty.call(graph.people, id) &&
        graph.people[id].status === 'active') ids.push(id);
  }
  ids.sort();

  var pairs = [];
  for (var i = 0; i < ids.length; i++) {
    for (var j = i + 1; j < ids.length; j++) {
      var scored = MTC_score(graph, graph.people[ids[i]], graph.people[ids[j]]);
      if (scored.score >= (threshold || 68)) {
        pairs.push({ a: ids[i], b: ids[j], score: scored.score, signals: scored.signals });
      }
    }
  }
  pairs.sort(function (x, y) { return y.score - x.score; });
  return pairs;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MTC_parseName: MTC_parseName,
    MTC_score: MTC_score,
    MTC_findCandidates: MTC_findCandidates,
    MTC_sweep: MTC_sweep,
    MTC_jaroWinkler: MTC_jaroWinkler
  };
}
