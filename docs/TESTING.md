# How to test it

Four levels, cheapest first. Each one answers a different question, and they are
worth doing in order — there is no sense debugging a deployment when the logic
underneath is what you actually want to check.

| Level | Question it answers | Setup |
| --- | --- | --- |
| 1. Prototype | Do the titles come out right? Is the interface usable? | none |
| 2. Test suite | Does the logic hold up across four generations? | Node |
| 3. Seeded deployment | Does *my* install work, against *my* sheet? | full deploy |
| 4. Two accounts | Do invitations, proposals and duplicates work? | a second Gmail |

---

## 1. The prototype — nothing to install

Open the prototype page. It runs the real kinship and matching engines in your
browser against a made-up family of twenty-one people.

**What to actually check:**

- **+ Add person.** It asks who they are related to and how before it asks their
  name, because a person with no connection is how a family tree splits in two.
  Watch the duplicate warning appear if you type somebody already on the chart.
- **Tap a card, then Add photo.** The picture is cropped square and appears on
  the card. In the prototype it stays in your browser; in the deployed app the
  same photo is copied into the family's Drive so every relative sees it.

- Change **"Signed in as"** between Ismail, Rahim, Karim, Aisha and Hana. The
  same people should get renamed each time. If Osman is `Pak Long` to Karim and
  `Abang` to Rahim, the ego-centric model is working.
- Switch to **Arabic** and look at Hassan. He should be `Khāl`, not `'Amm` —
  he is on the mother's side. Osman stays `'Amm`.
- Switch to **English**. Both become "Uncle". That flattening is the thing the
  other two languages are doing extra work to avoid.
- In the matcher, type `Sulaiman bin Ismail`. It should find the existing
  Sulaiman on the strength of the patronym alone, with no dates given.
- Then type `Ahmad bin Bakar`. It should find nobody, because it should not.

This is the fastest way to decide whether the *concept* is right before spending
an evening on Cloud Console.

---

## 2. The test suite — for the logic

```bash
git clone <this repo>
cd Mr-Karim
npm test
```

No dependencies to install; it uses Node's own libraries. You should see:

```
kinship:  105 passed, 0 failed
matching:  21 passed, 0 failed
settings:  19 passed, 0 failed
writes:    59 passed, 0 failed
```

The suites run the **same source files** Apps Script loads, so a title that
passes here is the title the deployed app produces. `tests/writes.test.js` runs
the create, batch, reorder and merge paths against an in-memory stand-in for the
spreadsheet, which is how the destructive operations get covered without a
Google account.

Worth reading rather than just running: `tests/kinship.test.js` states every
expected title in plain terms, so it doubles as the specification. If your family
disagrees with any line in it, that is a conversation worth having before two
hundred people are entered.

---

## 3. Your own deployment — with a family already in it

Once `docs/SETUP.md` is done through step 6, do **not** start typing your real
family. Seed a known one first and confirm the whole stack works.

### Check the install

In the Apps Script editor, run **checkInstallation**. It reports what is
configured, prints the exact redirect URI to compare against the Cloud Console,
and lists what to fix.

### Seed a family

Run **seedDemoFamily**. It inserts the same twenty-one people the test suite
uses and prints a command like:

```
bindMeTo('P00014')
```

Run that too — it points your account at Karim, so the app opens on him.

### Look at it

Open your web app URL. You should land on Karim with his parents, sister,
brother, wife and daughter around him, each labelled. Tap through to his uncle
Osman; he should read `Pak Long`. Change the language in **☰ Settings** and
watch every label change.

Then try the things that only work in a real deployment:

- **Add several** on the Children row. Enter three names, oldest first, and
  save. Open one of their children afterwards — the birth order you implied by
  listing them should already be producing the right titles.
- **Reorder** on the Children row. Move someone to the top and save. The titles
  their nieces and nephews see should change immediately.
- **⚙ → Settings.** Change the sibling sequence and watch the preview. Save, and
  check the tree relabels.
- **Upload a photo** to someone. It should appear on their card and on the
  cards around them.

### Confirm the engine is reading *your* sheet

Run **verifyKinship**. With the demo family seeded it asserts eleven known
answers — including the paternal/maternal distinction and `Besan`, which English
has no word for — and tells you how many are right.

This is a different claim from the test suite passing. It proves *this*
deployment, reading *this* spreadsheet, with *your* configured title sequence,
produces the titles your family expects.

### Clean up

Run **clearDemoFamily** before your relatives arrive. It removes exactly the rows
it created and nothing else, and unbinds any account pointing at them.

---

## 4. Two accounts — the part that actually matters

Everything above is one person looking at their own data. The risks in a shared
family tree are all multi-user, so this is the level worth spending time on.

You need a second Google account — any personal Gmail will do. Use a **private
window** for it, or the two sessions will fight over which account is signed in.

### Getting in

1. As yourself, **☰ → Invite a relative**, with the second account's address.
2. In the private window, open the app URL and sign in as the second account. It
   should go straight in, not to a waiting screen.
3. Now open the app in a private window with a **third**, uninvited account. It
   should see *"waiting for approval"* and nothing else — no names, no photos.
   Approve it from **⚙ → Access** and reload.

### Claiming rather than duplicating

Before inviting the second account, add that person to the tree yourself, and
bind the invitation to their record. When they sign in they should be offered
*"which one are you?"* with their own record at the top. This is the duplicate
that is hardest to catch later, because both copies look equally real.

### Proposals

As the second account — an ordinary member, not an admin — try to edit somebody
on the far side of the family. It should say the change was sent for approval,
not refuse. Then check **⚙ → Changes** as yourself: the request should be there
in plain words, and approving it should apply the change and credit *them*, not
you, on the People tab.

Editing their own parents, spouse or children should apply immediately with no
approval.

### Duplicates

Have the second account add someone who already exists — an uncle, entered with
a slightly different spelling and no dates. They should be shown the existing
person before anything is created.

Then deliberately push one through with **"None of these"**, and check
**⚙ → Duplicates** as yourself: the pair should be queued with a score and the
reasons. Merge them and confirm that the children attached to the wrong copy
moved to the survivor.

### What to watch for

| Symptom | Usually means |
| --- | --- |
| A relative sees stale data | The tree caches for five minutes; a write clears it, a manual spreadsheet edit does not |
| Titles are wrong for one branch | Birth order. Use **Reorder** on that parent's children |
| Distant cousins show as unrelated | The tree is not rooted high enough — see the note in `SETUP.md` |
| "Sign-in expired" after a while | Sessions last twelve hours. Expected |
| Slow first load after idle | Apps Script cold start, a second or two. Expected |

---

## Before you invite the whole family

A short checklist, in the order that matters:

1. `npm test` passes.
2. `checkInstallation` shows nothing outstanding.
3. `verifyKinship` reports 11 of 11 against the demo family.
4. Your family's **sibling title sequence** is set in ⚙ → Settings, and the
   preview reads the way your family speaks.
5. `clearDemoFamily` has been run.
6. Your own record, your parents, and your **great-grandparents on both sides**
   are entered — the roots have to sit above the widest branch you want included.
7. A second account has been through invitation, proposal and approval at least
   once.

Then invite four or five relatives, not forty. Watch what they get wrong in the
first week; that is what the stress test is for.
