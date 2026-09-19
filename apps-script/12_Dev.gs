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
 * correct here is correct there. [id, name, gender, birth date] */
var DEV_PEOPLE = [
    ["P001","Ismail bin Abdullah","M","1920-03-02"],
    ["P002","Aminah binti Yaakob","F","1924-07-19"],
    ["P010","Osman bin Ismail","M","1945-01-10"],
    ["P011","Fatimah binti Ismail","F","1948-05-22"],
    ["P012","Rahim bin Ismail","M","1951-11-03"],
    ["P013","Zainab binti Ismail","F","1954-02-14"],
    ["P014","Sulaiman bin Ismail","M","1958-09-30"],
    ["P003","Yusof bin Hamid","M","1925-04-04"],
    ["P004","Halimah binti Omar","F","1928-12-01"],
    ["P020","Salmah binti Yusof","F","1950-06-15"],
    ["P021","Hassan bin Yusof","M","1955-08-08"],
    ["P030","Mariam binti Salleh","F","1947-03-03"],
    ["P040","Nurul binti Rahim","F","1975-04-01"],
    ["P041","Karim bin Rahim","M","1978-10-12"],
    ["P042","Faizal bin Rahim","M","1982-01-25"],
    ["P043","Zaki bin Osman","M","1970-07-07"],
    ["P050","Aisha binti Ibrahim","F","1980-02-20"],
    ["P051","Ibrahim bin Daud","M","1952-05-05"],
    ["P060","Hana binti Karim","F","2005-09-09"],
    ["P061","Amir bin Latif","M","2003-03-13"],
    ["P062","Latif bin Hamzah","M","1974-06-06"]
];

/* [child, parent, role] */
var DEV_PARENTAGE = [
    ["P010","P001","father"],
    ["P010","P002","mother"],
    ["P011","P001","father"],
    ["P011","P002","mother"],
    ["P012","P001","father"],
    ["P012","P002","mother"],
    ["P013","P001","father"],
    ["P013","P002","mother"],
    ["P014","P001","father"],
    ["P014","P002","mother"],
    ["P020","P003","father"],
    ["P020","P004","mother"],
    ["P021","P003","father"],
    ["P021","P004","mother"],
    ["P040","P012","father"],
    ["P040","P020","mother"],
    ["P041","P012","father"],
    ["P041","P020","mother"],
    ["P042","P012","father"],
    ["P042","P020","mother"],
    ["P043","P010","father"],
    ["P043","P030","mother"],
    ["P060","P041","father"],
    ["P060","P050","mother"],
    ["P050","P051","father"],
    ["P061","P062","father"]
];

/* [partner, partner] */
var DEV_UNIONS = [
    ["P001","P002"],
    ["P003","P004"],
    ["P012","P020"],
    ["P010","P030"],
    ["P041","P050"],
    ["P060","P061"]
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
      notes: 'Demo family. Remove with clearDemoFamily().',
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

  var karim = idMap.P041;
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
  report('Spreadsheet', sheetId ? SpreadsheetApp.openById(sheetId).getUrl() : 'not created',
    !!sheetId, 'Run installFamilyTree().');

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

  var url = '';
  try { url = ScriptApp.getService().getUrl(); } catch (err) { url = ''; }
  report('Deployed at', url || 'not deployed yet', !!url,
    'Deploy > New deployment > Web app, executing as you, access Anyone.');

  if (url) {
    lines.push('');
    lines.push('  The redirect URI registered in the Google Cloud Console must be');
    lines.push('  exactly this, character for character:');
    lines.push('');
    lines.push('      ' + url);
  }

  var people = ST_readAll('People');
  var users = ST_readAll('Users');
  lines.push('');
  lines.push('  People in the tree: ' + people.length);
  lines.push('  Accounts: ' + users.length +
    ' (' + users.filter(function (u) { return u.role === 'pending'; }).length + ' waiting)');

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

    // Karim, his father's eldest and youngest brothers, his mother's brother,
    // his sister, his cousin, and his daughter looking up at her
    // great-grandfather. Each case is one thing a language does differently.
    var cases = [
      [map.P041, map.P010, 'ms', 'Pak Long', 'eldest of five, so Long'],
      [map.P041, map.P014, 'ms', 'Pak Su', 'youngest of five, so Su'],
      [map.P041, map.P013, 'ms', 'Mak Anjang', 'fourth of five'],
      [map.P041, map.P021, 'ms', 'Pak Su', 'mother\'s brother, youngest of two'],
      [map.P041, map.P021, 'ar', 'Khal', 'maternal side, so Khal'],
      [map.P041, map.P010, 'ar', '\'Amm', 'paternal side, so \'Amm'],
      [map.P041, map.P040, 'ms', 'Kakak', 'elder sister'],
      [map.P041, map.P042, 'ms', 'Adik', 'younger brother'],
      [map.P041, map.P043, 'ms', 'Sepupu', 'first cousin'],
      [map.P041, map.P062, 'ms', 'Besan', 'his child married theirs'],
      [map.P060, map.P001, 'ms', 'Moyang', 'great-grandfather']
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
    var result = 'KINSHIP CHECK against the demo family\n\n' + lines.join('\n') +
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
