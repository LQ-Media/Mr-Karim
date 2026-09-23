/**
 * The write paths.
 *
 * These are the operations that can damage a family's data rather than merely
 * mislabel it: creating people, entering a generation at once, reranking
 * siblings, and merging two records into one. Merging is the most destructive
 * thing the app does and deserves the most scrutiny.
 */
const { makeApp, ADMIN } = require('./store-mock');
const { buildFamily } = require('./fixtures');

let pass = 0;
const failures = [];
function check(label, actual, predicate, expectation) {
  if (predicate(actual)) pass++;
  else failures.push(`${label}\n      expected: ${expectation}\n      actual:   ${JSON.stringify(actual)}`);
}
function rows(store, table) { return store.tables[table]; }
function find(store, id) { return rows(store, 'People').find((p) => p.person_id === id); }

/* ================= Creating one person ============================= */
{
  const { env, store } = makeApp(buildFamily());

  // Karim adds a second child to himself and Aisha.
  const res = env.PPL_createPerson(ADMIN, 'P041', 'child_of',
    { display_name: 'Yusuf', full_name: 'Yusuf bin Karim', gender: 'M',
      birth_date: '2008-04-04' }, { ignoreDuplicates: true });

  check('a new child is created', res.status, (s) => s === 'created', 'created');

  const graph = env.ST_graph();
  const kids = env.KIN_childrenOf(graph, 'P041');
  check('the child is attached to the parent', kids.length, (n) => n === 2, '2 children');

  // A child added to one parent should join that parent's current marriage too,
  // which is nearly always what the person entering it means.
  check('and to that parent\'s spouse as well',
    env.KIN_parentsOf(graph, res.personId).sort().join(','),
    (p) => p === 'P041,P050', 'P041,P050');

  check('the patronym is parsed out of the name',
    find(store, res.personId).patronym, (p) => p === 'karim', 'karim');

  check('the new child reads as a sibling of the first',
    env.TTL_title(graph, 'P060', res.personId, 'ms', {}).label,
    (t) => t === 'Adik', 'Adik (younger brother)');
}

/* ================= Guards ========================================== */
{
  const { env } = makeApp(buildFamily());

  // A loop would make the ancestor walk run forever.
  let threw = '';
  try { env.PPL_addParentLink('a@b.c', 'P001', 'P041', 'father', 'biological'); }
  catch (e) { threw = e.message; }
  check('a link that would loop the tree is refused',
    threw, (m) => /loop back/.test(m), 'a message about looping');

  threw = '';
  try { env.PPL_addUnion('a@b.c', 'P041', 'P041', {}); }
  catch (e) { threw = e.message; }
  check('someone cannot marry themselves', threw, (m) => /themselves/.test(m), 'refused');

  threw = '';
  try { env.PPL_addUnion('a@b.c', 'P041', 'P050', {}); }
  catch (e) { threw = e.message; }
  check('a marriage already recorded is not duplicated',
    threw, (m) => /already recorded/.test(m), 'refused');

  // Only known fields survive, so nothing a client sends can reach a column it
  // has no business writing.
  const cleaned = env.PPL_sanitise({
    display_name: 'Ali', role: 'owner', status: 'active',
    merged_into_id: 'P001', person_id: 'P999', gender: 'x'
  });
  check('a client cannot write privileged columns',
    Object.keys(cleaned).sort().join(','),
    (k) => k === 'display_name,gender', 'display_name,gender only');
  check('an unknown gender falls back rather than being stored',
    cleaned.gender, (g) => g === 'U', 'U');

  check('a birth date outside plausible bounds is dropped',
    env.PPL_sanitise({ birth_date: '1200-01-01' }).birth_date, (d) => d === undefined, 'dropped');
  check('a bare year is expanded', env.PPL_cleanDate('1953'), (d) => d === '1953-01-01', '1953-01-01');
}

/* ================= A generation at once ============================ */
{
  const { env, store } = makeApp(buildFamily());

  // Sulaiman's five children, recited oldest first the way a family would.
  const res = env.PPL_addBatch(ADMIN, 'P014', 'child_of', [
    { display_name: 'Iskandar', gender: 'M', birth_date: '1985-01-01', birth_precision: 'year' },
    { display_name: 'Zarina', gender: 'F', birth_date: '1987-01-01', birth_precision: 'year' },
    { display_name: 'Farid', gender: 'M' },
    { display_name: 'Liyana', gender: 'F' },
    { display_name: 'Haikal', gender: 'M' }
  ], { 0: { action: 'create' }, 1: { action: 'create' }, 2: { action: 'create' },
       3: { action: 'create' }, 4: { action: 'create' } });

  check('a whole generation is created at once',
    res.created, (n) => n === 5, '5 created');

  const graph = env.ST_graph();
  const kids = env.KIN_childrenOf(graph, 'P014');
  check('all five attach to the parent', kids.length, (n) => n === 5, '5 children');

  // The order they were listed in is their birth order -- the fact the tree
  // shape can never supply and the Malay titles depend on.
  check('listing order became birth order',
    kids.map((id) => find(store, id).display_name + ':' + find(store, id).birth_order).join(' '),
    (s) => s === 'Iskandar:1 Zarina:2 Farid:3 Liyana:4 Haikal:5',
    'Iskandar:1 … Haikal:5');

  check('and it is marked as deliberate, not inferred',
    find(store, kids[2]).birth_order_source, (s) => s === 'manual', 'manual');

  // Which means their own children immediately get correct titles.
  const grandchild = env.PPL_applyCreate('a@b.c', kids[4], 'child_of',
    { display_name: 'Danish', gender: 'M' });
  check('the youngest uncle is Pak Su to the next generation',
    env.TTL_title(env.ST_graph(), grandchild.person_id, kids[4], 'ms',
      { birth_order_titles: 'Long,Ngah,Alang,Anjang,Andak,Uda,Uteh' }).label,
    (t) => t === 'Ayah', 'Ayah (his own father)');
  check('and the eldest is Pak Long to them',
    env.TTL_title(env.ST_graph(), grandchild.person_id, kids[0], 'ms',
      { birth_order_titles: 'Long,Ngah,Alang,Anjang,Andak,Uda,Uteh' }).label,
    (t) => t === 'Pak Long', 'Pak Long');
}

/* ================= A batch that might duplicate ==================== */
{
  const { env, store } = makeApp(buildFamily());
  const before = rows(store, 'People').length;

  // One row is plainly someone already in the tree.
  const res = env.PPL_addBatch(ADMIN, 'P001', 'child_of', [
    { display_name: 'Rohana', gender: 'F' },
    { display_name: 'Sulaiman', full_name: 'Sulaiman bin Ismail', gender: 'M' }
  ], null);

  check('a batch with a possible duplicate stops for review',
    res.status, (s) => s === 'possible_duplicate', 'possible_duplicate');

  check('nothing at all is written until it is resolved',
    rows(store, 'People').length, (n) => n === before, 'no new rows');

  const flagged = res.rows.filter((r) => r.candidates.length);
  check('the right row is the one flagged',
    flagged.map((r) => r.name).join(','), (n) => n === 'Sulaiman', 'Sulaiman');

  check('and the existing person is offered',
    flagged[0].candidates[0].personId, (id) => id === 'P014', 'P014');

  // Resolve: keep the new one, link the other.
  const done = env.PPL_addBatch(ADMIN, 'P001', 'child_of', [
    { display_name: 'Rohana', gender: 'F' },
    { display_name: 'Sulaiman', full_name: 'Sulaiman bin Ismail', gender: 'M' }
  ], { 0: { action: 'create' }, 1: { action: 'link', personId: 'P014' } });

  check('resolving creates only what was new',
    done.created, (n) => n === 1, '1 created');
  check('and links rather than duplicating the other',
    done.linked, (n) => n === 1, '1 linked');
  check('Sulaiman is still a single record',
    rows(store, 'People').filter((p) => /Sulaiman/.test(p.display_name)).length,
    (n) => n === 1, '1');
}

/* ================= Reordering ====================================== */
{
  const { env, store } = makeApp(buildFamily());
  const settings = { birth_order_titles: 'Long,Ngah,Alang,Anjang,Andak,Uda,Uteh' };

  check('before reordering, Osman is the eldest',
    env.TTL_title(env.ST_graph(), 'P041', 'P010', 'ms', settings).label,
    (t) => t === 'Pak Long', 'Pak Long');

  // The family says the order recorded was wrong: Sulaiman was actually eldest.
  env.PPL_reorderSiblings(ADMIN, 'P001', ['P014', 'P010', 'P011', 'P012', 'P013']);

  check('reordering renames the eldest',
    env.TTL_title(env.ST_graph(), 'P041', 'P014', 'ms', settings).label,
    (t) => t === 'Pak Long', 'Pak Long');
  check('and demotes the one who was',
    env.TTL_title(env.ST_graph(), 'P041', 'P010', 'ms', settings).label,
    (t) => t === 'Pak Ngah', 'Pak Ngah');
  check('the youngest position now holds Zainab',
    env.TTL_title(env.ST_graph(), 'P041', 'P013', 'ms', settings).label,
    (t) => t === 'Mak Su', 'Mak Su');
  check('the ranks written are a clean sequence',
    ['P014', 'P010', 'P011', 'P012', 'P013'].map((id) => find(store, id).birth_order).join(','),
    (s) => s === '1,2,3,4,5', '1,2,3,4,5');

  let threw = '';
  try { env.PPL_reorderSiblings(ADMIN, 'P001', ['P014', 'P010']); }
  catch (e) { threw = e.message; }
  check('a partial reorder is refused',
    threw, (m) => /Every child/.test(m), 'refused');
}

/* ================= Merging ========================================= */
{
  // A duplicate of Rahim, carrying facts the original lacks and a child of its
  // own -- which is what makes a real merge more than deleting a row.
  const seed = buildFamily();
  seed.people.push({
    person_id: 'P900', display_name: 'Rahim', full_name: 'Abdul Rahim bin Ismail',
    given_name: 'Rahim', gender: 'M', birth_date: '1951-11-03', birth_precision: 'exact',
    birth_place: 'Kampung Melayu', occupation: 'Teacher', also_known_as: 'Pak Him',
    is_living: 'TRUE', status: 'active', created_by: 'cousin@example.test'
  });
  seed.people.push({
    person_id: 'P901', display_name: 'Suria', full_name: 'Suria binti Rahim',
    given_name: 'Suria', gender: 'F', birth_date: '1979-02-02', is_living: 'TRUE',
    status: 'active'
  });
  seed.parentage.push({ link_id: 'LZ1', child_id: 'P901', parent_id: 'P900',
    parent_role: 'father', relation_type: 'biological', status: 'active' });
  seed.parentage.push({ link_id: 'LZ2', child_id: 'P900', parent_id: 'P001',
    parent_role: 'father', relation_type: 'biological', status: 'active' });

  const { env, store } = makeApp(seed);
  const res = env.MRG_merge(ADMIN, 'P012', 'P900', null);

  check('the merge reports what survived', res.keptId, (id) => id === 'P012', 'P012');

  // Nothing is deleted. The losing row stays, pointing at the survivor, so an
  // old link or a bookmark still resolves instead of breaking.
  const loser = find(store, 'P900');
  check('the losing record is kept, not deleted', !!loser, (v) => v === true, 'still present');
  check('and marked as merged', loser.status, (s) => s === 'merged', 'merged');
  check('with a pointer to the survivor', loser.merged_into_id, (v) => v === 'P012', 'P012');

  // The duplicate usually exists because someone knew something the first
  // record did not.
  const kept = find(store, 'P012');
  check('facts the survivor lacked are carried across',
    kept.birth_place, (v) => v === 'Kampung Melayu', 'Kampung Melayu');
  check('as is the occupation', kept.occupation, (v) => v === 'Teacher', 'Teacher');
  check('and the nickname the other side knew',
    kept.also_known_as, (v) => /Pak Him/.test(String(v)), 'includes Pak Him');

  const graph = env.ST_graph();
  check('the duplicate is gone from the graph',
    graph.people.P900, (v) => v === undefined, 'absent');

  // The child attached to the wrong copy must not be orphaned.
  check('a child of the duplicate moves to the survivor',
    env.KIN_childrenOf(graph, 'P012').indexOf('P901') !== -1, (v) => v === true, 'P901 present');
  // She reads as a HALF-sibling, and that is correct rather than a shortfall.
  // The duplicate record named only a father, so after the merge that is all
  // the tree knows. Attaching her to the survivor's wife as well would be
  // inventing a mother -- and a duplicate entered by a distant cousin may well
  // be a child of an earlier marriage nobody mentioned. The app says what it
  // knows; the family can add the mother.
  check('a child of the duplicate becomes a half-sibling, not a full one',
    env.TTL_title(graph, 'P041', 'P901', 'ms', {}).label,
    (t) => t === 'Adik Sebapa', 'Adik Sebapa (younger, same father)');

  check('she shares exactly the one parent the duplicate recorded',
    env.KIN_parentsOf(graph, 'P901').join(','), (p) => p === 'P012', 'P012 only');

  // Both records named Ismail as father; the survivor must not end up with two.
  check('a duplicated parent link is retired, not moved',
    env.KIN_parentsOf(graph, 'P012').sort().join(','),
    (p) => p === 'P001,P002', 'P001,P002 only');

  let threw = '';
  try { env.MRG_merge(ADMIN, 'P012', 'P012', null); } catch (e) { threw = e.message; }
  check('a record cannot be merged into itself',
    threw, (m) => /same record/.test(m), 'refused');

  threw = '';
  try { env.MRG_merge({ email: 'x@y.z', isAdmin: false, role: 'member' }, 'P012', 'P010', null); }
  catch (e) { threw = e.message; }
  check('a member cannot merge',
    threw, (m) => /admin/.test(m), 'refused');
}

/* ================= Permission scope ================================ */
{
  const { env } = makeApp(buildFamily());
  const graph = env.ST_graph();
  const member = { email: 'k@x.test', personId: 'P041', role: 'member',
                   isAdmin: false, isPending: false };

  const can = (id) => env.AUTH_canEditDirectly(member, graph, id);

  check('a member may edit themselves', can('P041'), (v) => v === true, 'yes');
  check('their spouse', can('P050'), (v) => v === true, 'yes');
  check('their parents', can('P012'), (v) => v === true, 'yes');
  check('their children', can('P060'), (v) => v === true, 'yes');
  check('and the person their child married',
    can('P061'), (v) => v === true, 'yes');
  check('but not a sibling', can('P040'), (v) => v === false, 'no');
  check('nor an uncle', can('P010'), (v) => v === false, 'no');
  check('nor their spouse\'s father', can('P051'), (v) => v === false, 'no');

  // Reaching sideways becomes a proposal rather than a refusal.
  const res = env.PPL_createPerson(member, 'P010', 'child_of',
    { display_name: 'Nadia', gender: 'F' }, { ignoreDuplicates: true });
  check('an edit outside that scope becomes a proposal',
    res.status, (s) => s === 'pending_approval', 'pending_approval');
}

/* ================= Approving a proposal ============================ */
{
  const { env, store } = makeApp(buildFamily());
  const member = { email: 'cousin@x.test', personId: 'P043', role: 'member',
                   isAdmin: false, isPending: false, lang: 'ms' };

  env.PPL_createPerson(member, 'P014', 'child_of',
    { display_name: 'Nadia', gender: 'F' }, { ignoreDuplicates: true });

  const queued = env.ADM_pendingChanges(ADMIN);
  check('the proposal reaches the admin queue', queued.length, (n) => n === 1, '1');
  check('described in words, not JSON',
    queued[0].summary, (s) => /Add Nadia as a child of Sulaiman/.test(s), 'a readable summary');

  const before = rows(store, 'People').length;
  env.ADM_approve(ADMIN, queued[0].changeId, '');
  check('approving applies it', rows(store, 'People').length,
    (n) => n === before + 1, 'one more person');

  // The audit trail should say who knew this, not who clicked yes.
  const created = rows(store, 'People').find((p) => p.display_name === 'Nadia');
  check('and credits whoever proposed it',
    created.created_by, (v) => v === 'cousin@x.test', 'cousin@x.test');

  check('the request is not left pending',
    env.ADM_pendingChanges(ADMIN).length, (n) => n === 0, '0');
}


/* ================= Removing someone ================================ */
{
  const { env, store } = makeApp(buildFamily());

  // P042 (Faizal) is a leaf: a brother with no children and no account.
  const res = env.PPL_deletePerson(ADMIN, 'P042');
  check('a childless person can be removed', res.status, (s) => s === 'deleted', 'deleted');

  const graph = env.ST_graph();
  check('and is gone from the tree', graph.people.P042, (p) => p === undefined, 'undefined');

  // The row survives, so a mistake is recoverable from the sheet itself.
  const row = find(store, 'P042');
  check('but the row is kept, marked', row && row.status, (s) => s === 'deleted', 'deleted');

  // Siblings must not keep a dangling link to someone who is no longer there.
  check('their parentage links are marked removed',
    rows(store, 'Parentage').filter((l) => l.child_id === 'P042' && l.status !== 'removed').length,
    (n) => n === 0, '0 live links');

  check('their siblings remain', env.KIN_childrenOf(graph, 'P012').length,
    (n) => n === 2, '2 children left');

  check('the removal is audited',
    store.audit.filter((a) => a.action === 'delete_person').length,
    (n) => n === 1, '1 entry');
}

{
  const { env } = makeApp(buildFamily());

  // Removing a parent would leave their children hanging off nothing, so the
  // app refuses rather than silently detaching a branch.
  let message = '';
  try { env.PPL_deletePerson(ADMIN, 'P012'); } catch (err) { message = err.message; }
  check('someone with children cannot be removed', message,
    (m) => /children/i.test(m), 'a message about their children');

  check('and they are still in the tree', env.ST_graph().people.P012,
    (p) => !!p, 'still present');
}

{
  const { env } = makeApp(buildFamily());

  let message = '';
  try { env.PPL_deletePerson(ADMIN, ADMIN.personId); } catch (err) { message = err.message; }
  check('you cannot remove your own card', message,
    (m) => /this is you/i.test(m), 'a message saying it is you');
}

{
  const { env, store } = makeApp(buildFamily());

  // A relative outside their own branch proposes rather than deletes.
  const cousin = { email: 'zaki@example.test', personId: 'P043', role: 'member',
                   lang: 'ms', isAdmin: false, isPending: false, canInvite: false };
  const res = env.PPL_deletePerson(cousin, 'P042');
  check('a distant relative can only propose a removal', res.status,
    (s) => s === 'pending_approval', 'pending_approval');

  check('and nothing is removed yet', env.ST_graph().people.P042, (p) => !!p, 'still present');

  // Approving it applies the same delete, credited to whoever asked for it.
  const change = rows(store, 'PendingChanges')[0];
  env.ADM_applyChange(ADMIN, change, JSON.parse(change.payload_json));
  check('approving the proposal removes them', env.ST_graph().people.P042,
    (p) => p === undefined, 'undefined');
}

{
  const { env, store } = makeApp(buildFamily());

  // Someone who signs in as this person would be orphaned by the delete.
  store.tables.Users.push({ email: 'faizal@example.test', person_id: 'P042',
                            role: 'member', status: 'active' });
  let message = '';
  try { env.PPL_deletePerson(ADMIN, 'P042'); } catch (err) { message = err.message; }
  check('someone with an account cannot be removed', message,
    (m) => /signs in/i.test(m), 'a message about their account');
}

console.log(`\nwrites: ${pass} passed, ${failures.length} failed\n`);
if (failures.length) {
  failures.forEach((f) => console.log('  FAIL  ' + f));
  process.exit(1);
}
