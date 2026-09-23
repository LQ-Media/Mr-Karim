/**
 * Testing helpers.
 *
 * None of this is needed to run the app. It exists because the first honest
 * question about a family tree is "does it work?", and answering that by
 * hand-typing four generations before you can see a single title is a poor
 * trade. These seed a known family, check the installation, and assert the
 * kinship engine in place, inside the real deployment, against the real sheet.
 *
 * Remove the demo family with clearDemoFamily() before your relatives arrive.
 */

/* The same twenty-one people the Node test suite uses, so a title that is
 * correct here is correct there.
 *
 * This is the Salim family as recorded on the 2024 Umrah passenger list:
 * names, sex and dates of birth, and the relationships the roles and
 * patronymics imply. Passport numbers, NRIC and phone numbers are
 * deliberately not here -- a seed function has no use for them.
 *
 * It is one of the two trees: Su'aidah's side. Karim's own paternal line
 * (bin Kamaruddin) is not on that list and has to be entered by hand.
 *
 * [id, name, gender, birth date] */
var DEV_PEOPLE = [
    ["S01","Mohamed Salim bin Ali","M","1960-05-24"],
    ["S02","Sa'diah bte Alimon","F","1962-07-09"],
    ["S03","Siti Su'aidah binte Mohamed Salim","F","1986-12-31"],
    ["S04","Nur Abdul Karim bin Kamaruddin","M","1988-03-24"],
    ["S05","Siti Syahirah binte Mohamed Salim","F","1990-08-03"],
    ["S06","Amali Afiq bin Nor Anuar","M","1990-10-26"],
    ["S07","Saiful Azwan bin Mohamed Salim","M","1992-06-03"],
    ["S08","Nur Farihin binte Kamal","F","1992-09-29"],
    ["S09","Siti Syazwani binte Mohamed Salim","F","1998-05-30"],
    ["S10","Nazrul Haque bin Abdolah","M","1998-09-24"],
    ["S11","Aqilah Syukairah binti Nur Abdul Karim","F","2013-03-20"],
    ["S12","Amna Safirah binte Nur Abdul Karim","F","2015-11-02"],
    ["S13","Anwara Sumayyah binte Nur Abdul Karim","F","2020-09-03"],
    ["S14","Bilal Saif bin Saiful Azwan","M","2021-04-29"],
    ["S15","Nur Abbas Syakur bin Nur Abdul Karim","M","2022-06-05"],
    ["S16","Muhammad Hadi bin Amali Afiq","M","2024-01-10"],
    ["S17","Nurul Huda binte Amali Afiq","F","2024-01-10"],
    ["S18","Umar Saif bin Saiful Azwan","M","2024-03-22"]
];

/* [child, parent, role] */
var DEV_PARENTAGE = [
    ["S03","S01","father"], ["S03","S02","mother"],
    ["S05","S01","father"], ["S05","S02","mother"],
    ["S07","S01","father"], ["S07","S02","mother"],
    ["S09","S01","father"], ["S09","S02","mother"],
    ["S11","S04","father"], ["S11","S03","mother"],
    ["S12","S04","father"], ["S12","S03","mother"],
    ["S13","S04","father"], ["S13","S03","mother"],
    ["S15","S04","father"], ["S15","S03","mother"],
    ["S16","S06","father"], ["S16","S05","mother"],
    ["S17","S06","father"], ["S17","S05","mother"],
    ["S14","S07","father"], ["S14","S08","mother"],
    ["S18","S07","father"], ["S18","S08","mother"]
];

/* [partner, partner] */
var DEV_UNIONS = [
    ["S01","S02"], ["S03","S04"], ["S05","S06"], ["S07","S08"], ["S09","S10"]
];

/**
 * Fills an empty tree with a known family so the app can be looked at.
 *
 * Every row it creates is recorded, so clearDemoFamily() removes exactly these
 * people and nothing a real relative has since added.
 */
function seedDemoFamily() {
  var existing = ST_readAll('People');
  if (existing.length) {
    throw new Error('The tree already has ' + existing.length + ' people in it. ' +
      'Seeding is only for an empty tree -- clear it first, or start a fresh copy.');
  }

  var actor = Session.getEffectiveUser().getEmail();
  var idMap = {};
  var created = { people: [], parentage: [], unions: [] };

  for (var i = 0; i < DEV_PEOPLE.length; i++) {
    var row = DEV_PEOPLE[i];
    var parsed = MTC_parseName(row[1]);
    var personId = ST_nextId('People');
    idMap[row[0]] = personId;

    ST_append('People', {
      person_id: personId,
      display_name: row[1],
      full_name: row[1],
      given_name: parsed.own[0] || row[1],
      patronym: parsed.patronym.join(' '),
      patronym_type: parsed.type,
      gender: row[2],
      birth_date: row[3],
      birth_precision: row[3] ? 'exact' : 'unknown',
      birth_order_source: 'derived',
      is_living: 'TRUE',
      status: 'active',
      created_by: actor,
      created_at: ST_now(),
      updated_by: actor,
      updated_at: ST_now()
    });
    created.people.push(personId);
  }

  for (var j = 0; j < DEV_PARENTAGE.length; j++) {
    var link = DEV_PARENTAGE[j];
    var linkId = ST_nextId('Parentage');
    ST_append('Parentage', {
      link_id: linkId,
      child_id: idMap[link[0]],
      parent_id: idMap[link[1]],
      parent_role: link[2],
      relation_type: 'biological',
      status: 'active',
      created_by: actor,
      created_at: ST_now()
    });
    created.parentage.push(linkId);
  }

  for (var k = 0; k < DEV_UNIONS.length; k++) {
    var union = DEV_UNIONS[k];
    var unionId = ST_nextId('Unions');
    ST_append('Unions', {
      union_id: unionId,
      partner_a_id: idMap[union[0]],
      partner_b_id: idMap[union[1]],
      union_type: 'nikah',
      status: 'current',
      order_index: 1,
      created_by: actor,
      created_at: ST_now()
    });
    created.unions.push(unionId);
  }

  // The map from fixture ids to the ids actually handed out is what lets
  // verifyKinship() name its cases, instead of counting positions in a list.
  created.map = idMap;
  ST_props().setProperty('DEMO_ROWS', JSON.stringify(created));
  ST_invalidate();

  var karim = idMap.S04;
  var message = 'Seeded ' + created.people.length + ' people.\n\n' +
    'To look around as Karim, run:  bindMeTo(\'' + karim + '\')\n' +
    'Then open the web app.\n\n' +
    'Remove it all again with clearDemoFamily().';
  Logger.log(message);
  return message;
}

/** Removes exactly the rows seedDemoFamily() created. */
function clearDemoFamily() {
  var raw = ST_props().getProperty('DEMO_ROWS');
  if (!raw) throw new Error('No demo family was seeded from this installation.');
  var created = JSON.parse(raw);

  removeRows('People', 'person_id', created.people);
  removeRows('Parentage', 'link_id', created.parentage);
  removeRows('Unions', 'union_id', created.unions);

  // Any account bound to a demo person is unbound, or it would open on a
  // record that no longer exists.
  var users = ST_readAll('Users');
  for (var i = 0; i < users.length; i++) {
    if (created.people.indexOf(users[i].person_id) !== -1) {
      ST_update('Users', 'email', users[i].email, { person_id: '' });
    }
  }

  ST_props().deleteProperty('DEMO_ROWS');
  ST_invalidate();
  return 'Removed ' + created.people.length + ' demo people.';
}

/**
 * Empties the tree completely, including people entered by hand.
 *
 * clearDemoFamily() only removes what it seeded, which is the right default --
 * it must never take a relative's real work with it. This is the other case:
 * a trial run that should be thrown away before the family arrives. It refuses
 * unless the confirmation names the number of people it is about to remove, so
 * it cannot be run by reflex from the function dropdown.
 *
 * Accounts, invitations, settings and the audit log survive. People, the links
 * between them, the merge queue and anything waiting for approval do not.
 */
function clearTree(confirmation) {
  var people = ST_readAll('People');
  var expected = 'DELETE ALL ' + people.length;

  if (confirmation !== expected) {
    throw new Error('This removes every person in the tree and cannot be undone.\n\n' +
      'There ' + (people.length === 1 ? 'is 1 person' : 'are ' + people.length + ' people') +
      ' recorded. To go ahead, run:\n\n    clearTree(\'' + expected + '\')');
  }

  var tabs = ['People', 'Parentage', 'Unions', 'CustomTitles', 'MergeQueue', 'PendingChanges'];
  for (var i = 0; i < tabs.length; i++) clearAllRows(tabs[i]);

  // Every account is unbound, or it would open on a record that is gone.
  var users = ST_readAll('Users');
  for (var u = 0; u < users.length; u++) {
    if (users[u].person_id) ST_update('Users', 'email', users[u].email, { person_id: '' });
  }

  // Let seedDemoFamily() run again from a clean slate.
  ST_props().deleteProperty('DEMO_ROWS');

  ST_audit(Session.getEffectiveUser().getEmail(), 'clear_tree', 'People', '',
    { removed: people.length });
  ST_invalidate();

  return 'Removed ' + people.length + ' people and every link between them.\n' +
    'Accounts and settings were kept. You can run seedDemoFamily() now.';
}

/** Empties a tab, keeping its header row. */
function clearAllRows(tabName) {
  var sheet = ST_sheet(tabName);
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.deleteRows(2, lastRow - 1);
}

/** Deletes rows bottom-up, so earlier deletions do not shift later row numbers. */
function removeRows(tabName, keyColumn, ids) {
  if (!ids || !ids.length) return;
  var sheet = ST_sheet(tabName);
  var headers = ST_headers(tabName);
  var keyIndex = headers.indexOf(keyColumn);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2 || keyIndex === -1) return;

  var keys = sheet.getRange(2, keyIndex + 1, lastRow - 1, 1).getValues();
  for (var i = keys.length - 1; i >= 0; i--) {
    if (ids.indexOf(String(keys[i][0])) !== -1) sheet.deleteRow(i + 2);
  }
}

/** Links your own account to a person, so the app opens on them. */
function bindMeTo(personId) {
  var email = Session.getEffectiveUser().getEmail().toLowerCase();
  var graph = ST_graph();
  if (!graph.people[personId]) throw new Error('No such person: ' + personId);
  if (!ST_update('Users', 'email', email, { person_id: personId })) {
    throw new Error('No account row for ' + email + '. Run installFamilyTree() first.');
  }
  return email + ' now opens the app as ' + graph.people[personId].display_name + '.';
}

/**
 * Binds your account to Karim in the seeded family.
 *
 * The editor's Run dropdown cannot pass arguments, so bindMeTo() can only be
 * reached from there by writing a wrapper by hand. This is that wrapper, kept
 * with the seed it belongs to.
 */
function bindMeToSeeded() {
  var raw = ST_props().getProperty('DEMO_ROWS');
  if (!raw) throw new Error('Nothing has been seeded yet. Run seedDemoFamily() first.');

  var map = JSON.parse(raw).map;
  if (!map || !map.S04) {
    throw new Error('That seed is from an older version of this file. ' +
      'Run clearDemoFamily(), then seedDemoFamily(), then try again.');
  }
  return bindMeTo(map.S04);
}

/**
 * Empties the notes field on everybody.
 *
 * Earlier seeds stamped a housekeeping line onto every person, which is
 * reasonable for an invented family and wrong for a real one -- it showed up
 * on the card of every relative. This clears the field wherever it is set.
 */
function clearAllNotes() {
  var people = ST_readAll('People');
  var cleared = 0;
  for (var i = 0; i < people.length; i++) {
    if (!people[i].notes) continue;
    ST_update('People', 'person_id', people[i].person_id, { notes: '' });
    cleared++;
  }
  ST_invalidate();
  return cleared ? 'Cleared notes on ' + cleared + ' people.' : 'No notes to clear.';
}

/* ------------------------------------------------------------------ *
 * Checks
 * ------------------------------------------------------------------ */

/**
 * Reports what is and is not configured.
 *
 * Most failures at this stage are one of three things: the OAuth credentials
 * were never saved, the redirect URI registered in the Cloud Console does not
 * match the deployment, or the deployment was never made. This says which.
 */
function checkInstallation() {
  var props = ST_props();
  var lines = [];
  var problems = [];

  function report(label, value, ok, fix) {
    lines.push((ok ? '  OK   ' : '  --   ') + label + ': ' + value);
    if (!ok) problems.push(fix);
  }

  var sheetId = props.getProperty(CFG.PROP_SHEET_ID);
  var sheetUrl = 'not created -- run installFamilyTree() first';
  if (sheetId) {
    try {
      sheetUrl = SpreadsheetApp.openById(sheetId).getUrl();
    } catch (openErr) {
      sheetUrl = 'recorded, but could not be opened: ' + openErr.message;
      sheetId = '';
    }
  }
  report('Spreadsheet', sheetUrl, !!sheetId, 'Run installFamilyTree().');

  if (sheetId) {
    var missing = [];
    var book = SpreadsheetApp.openById(sheetId);
    for (var tab in SCHEMA) {
      if (Object.prototype.hasOwnProperty.call(SCHEMA, tab) && !book.getSheetByName(tab)) {
        missing.push(tab);
      }
    }
    report('Tabs', missing.length ? 'missing ' + missing.join(', ') : 'all present',
      !missing.length, 'Run installFamilyTree() again -- it only adds what is absent.');
  }

  report('Photo folder', props.getProperty(CFG.PROP_FOLDER_ID) || 'not created',
    !!props.getProperty(CFG.PROP_FOLDER_ID), 'Run installFamilyTree().');

  report('OAuth client id', props.getProperty(CFG.PROP_CLIENT_ID) || 'NOT SET',
    !!props.getProperty(CFG.PROP_CLIENT_ID), 'Run setOAuthCredentials(id, secret). See docs/SETUP.md step 5.');

  report('OAuth client secret', props.getProperty('OAUTH_CLIENT_SECRET') ? 'set' : 'NOT SET',
    !!props.getProperty('OAUTH_CLIENT_SECRET'), 'Run setOAuthCredentials(id, secret).');

  var recorded = props.getProperty(CFG.PROP_WEBAPP_URL);
  report('Web app URL', recorded || 'NOT RECORDED', !!recorded,
    "Deploy > Manage deployments, copy the URL ending in /exec, then run " +
    "setWebAppUrl('<that URL>').");

  lines.push('');
  if (recorded) {
    lines.push('  The redirect URI registered in the Google Cloud Console must be');
    lines.push('  exactly this, character for character:');
    lines.push('');
    lines.push('      ' + recorded);
  } else {
    var reported = '';
    try { reported = ScriptApp.getService().getUrl(); } catch (urlErr) { reported = ''; }
    lines.push('  This script reports its own URL as:');
    lines.push('      ' + (reported || 'unavailable'));
    lines.push('');
    lines.push('  Do not register that one. Run from the editor it is the /dev');
    lines.push('  address, and on a Workspace account it can carry an /a/<domain>/');
    lines.push('  path that will not match. Use the /exec URL from Manage');
    lines.push('  deployments, and record it with setWebAppUrl().');
  }

  // Reading a tab that does not exist yet throws, and a report that dies on
  // the first missing thing is useless precisely when it is needed most --
  // before the install has run.
  lines.push('');
  if (sheetId) {
    try {
      var people = ST_readAll('People');
      var users = ST_readAll('Users');
      var waiting = 0;
      for (var u = 0; u < users.length; u++) {
        if (users[u].role === 'pending') waiting++;
      }
      lines.push('  People in the tree: ' + people.length);
      lines.push('  Accounts: ' + users.length + ' (' + waiting + ' waiting)');
    } catch (readErr) {
      lines.push('  Could not read the tabs: ' + readErr.message);
      problems.push('Run installFamilyTree() to build the missing tabs.');
    }
  } else {
    lines.push('  No spreadsheet yet, so there is nothing to count.');
  }

  var out = 'INSTALLATION\n\n' + lines.join('\n');
  if (problems.length) {
    out += '\n\nTO FIX\n\n  ' + problems.join('\n  ');
  } else {
    out += '\n\n  Nothing outstanding.';
  }
  Logger.log(out);
  return out;
}

/**
 * Asserts the kinship engine against whatever is in the sheet right now.
 *
 * The Node suite proves the logic; this proves that THIS deployment, reading
 * THIS spreadsheet, with THIS family's configured title sequence, produces the
 * titles the family expects. Those are different claims, and only the second
 * one tells you the install is sound.
 *
 * With the demo family seeded it checks known answers. With a real family it
 * reports what it found, for a human to read and recognise.
 */
function verifyKinship() {
  var graph = ST_graph();
  var settings = ST_settings();
  var ids = Object.keys(graph.people);
  if (!ids.length) return 'The tree is empty. Run seedDemoFamily() first.';

  var demo = ST_props().getProperty('DEMO_ROWS');
  if (demo) {
    var map = JSON.parse(demo).map;
    if (!map) return 'This demo family predates the check. Re-seed it to use verifyKinship().';

    // Each case is one thing a language does differently, checked against
    // people this family actually calls by these names. Karim's in-laws first,
    // then the same family seen from his eldest daughter, where the Malay
    // birth-order titles and the Arabic maternal words both come into play.
    var cases = [
      [map.S04, map.S01, 'ms', 'Bapa Mertua', 'his wife\'s father'],
      [map.S04, map.S06, 'ms', 'Biras', 'married to his wife\'s sister -- English has no word'],
      [map.S04, map.S06, 'ar', 'Silf', 'the same tie, in Arabic'],
      [map.S04, map.S05, 'ms', 'Adik Ipar', 'wife\'s younger sister'],
      [map.S11, map.S01, 'ms', 'Atuk', 'her mother\'s father'],
      [map.S11, map.S05, 'ms', 'Mak Ngah', 'second of four, so Ngah'],
      [map.S11, map.S07, 'ms', 'Pak Alang', 'third of four, so Alang'],
      [map.S11, map.S09, 'ms', 'Mak Su', 'youngest of four, always Su'],
      [map.S11, map.S07, 'ar', 'Khal', 'mother\'s brother, so Khal not \'Amm'],
      [map.S11, map.S14, 'ar', 'Ibn al-Khal', 'mother\'s brother\'s son'],
      [map.S11, map.S16, 'ar', 'Ibn al-Khalah', 'mother\'s sister\'s son']
    ];

    var passed = 0;
    var lines = [];
    for (var i = 0; i < cases.length; i++) {
      var c = cases[i];
      var got = TTL_title(graph, c[0], c[1], c[2], settings).label;
      var ok = got === c[3];
      if (ok) passed++;
      lines.push((ok ? '  OK   ' : '  FAIL ') +
        graph.people[c[1]].display_name + ' [' + c[2] + '] = ' + got +
        (ok ? '' : ' (expected ' + c[3] + ')') + '   -- ' + c[4]);
    }
    var result = 'KINSHIP CHECK against the Salim family\n\n' + lines.join('\n') +
      '\n\n  ' + passed + ' of ' + cases.length + ' correct.' +
      (passed === cases.length
        ? '\n  The engine is reading your sheet correctly.'
        : '\n  Check birth_order on the People tab, and your birth_order_titles setting.');
    Logger.log(result);
    return result;
  }

  // A real family: show what the app would call everyone, for a human to check.
  var me = ST_readAll('Users').filter(function (u) {
    return String(u.email).toLowerCase() === Session.getEffectiveUser().getEmail().toLowerCase();
  })[0];
  if (!me || !me.person_id) return 'Link your account to a person first: bindMeTo(\'P00001\')';

  var out = ['WHAT YOU WOULD CALL EVERYONE', '',
    '  (as ' + graph.people[me.person_id].display_name + ', in ' + (me.lang_pref || 'ms') + ')', ''];
  for (var k = 0; k < ids.length && k < 60; k++) {
    if (ids[k] === me.person_id) continue;
    var t = TTL_title(graph, me.person_id, ids[k], me.lang_pref || 'ms', settings);
    out.push('  ' + pad(t.label, 22) + graph.people[ids[k]].display_name);
  }
  out.push('');
  out.push('  Read that list. Anything wrong is almost always birth order --');
  out.push('  fix it with Reorder in the app, on the Children row.');

  var text = out.join('\n');
  Logger.log(text);
  return text;
}

function pad(text, width) {
  var out = String(text);
  while (out.length < width) out += ' ';
  return out;
}
