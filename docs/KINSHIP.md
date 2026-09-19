# How titles are worked out

The database never stores a title. It stores that Ismail fathered Rahim and that
Rahim married Salmah, and every label in the interface is derived from facts like
those, for whoever happens to be looking.

That is not a technical preference. "Uncle" is not a property of a person — it is
a property of a *pair*, and it changes with who is asking. The same man is `Abah`
to his son, `Pak Long` to his nephew, `Atuk` to his grandson and `Abang` to his
younger sister. Storing any one of those against his record would make the tree
wrong for everyone except the person it was written for, and would mean rewriting
thousands of rows whenever one link changed.

Naming happens in two steps, in two files, because the languages disagree about
which facts matter.

---

## Step one: what is the relationship?

`06_Kinship.gs` walks up from both people through their parents, finds the
closest ancestor they share, and reduces the pair to a small structural
description.

Two numbers do most of the work: `up`, the steps from the viewer to that shared
ancestor, and `down`, the steps from the ancestor to the other person.

| `up` | `down` | Relationship |
| --- | --- | --- |
| 0 | *n* | descendant — child, grandchild, great-grandchild |
| *n* | 0 | ancestor — parent, grandparent |
| 1 | 1 | sibling |
| ≥2 | 1 | a sibling of an ancestor — uncle, aunt, great-uncle |
| 1 | ≥2 | a descendant of a sibling — nephew, niece |
| ≥2 | ≥2 | cousin: degree `min−1`, removal `|up−down|` |

The walk carries two things beyond those numbers, because the naming step cannot
recover them afterwards:

**Which side.** Whether the first step went through the father or the mother.
Arabic needs this and will not compile a title without it.

**The linking person.** For a cousin, which uncle or aunt they descend from.
Arabic names cousins after that person.

Step and foster links are deliberately *not* followed. A step-father's brother is
not an uncle by blood, and treating him as one would make two unrelated families
appear to be cousins. Adoptive links *are* followed, because an adoptive family
is a family.

Where no blood path exists the engine looks for one through a marriage — the
spouse of a relative, a relative of a spouse, or the parents of a child's spouse —
and only then gives up.

---

## Step two: what is it called?

`07_Titles.gs` puts a word to that description. Three languages, three different
things they care about:

### Malay grades by birth order

`Pak Long` is the eldest uncle. `Pak Su` is the youngest. `Mak Ngah` is the
second. Which word applies depends on where that person sits **among their own
siblings** — not on their relationship to you. The eldest of five brothers is
Pak Long to every one of his nieces and nephews.

This is the one thing the shape of the tree cannot tell you, so the app derives
birth order from birth dates where it can and lets a human set it where it
cannot — which, for a grandparents' generation, is often. If even one sibling's
date is missing the ranking is unsafe, so the engine returns nothing and the
title falls back to the general `Pak Cik` / `Mak Cik`. Calling the eldest uncle
Pak Su is worse than calling him Pak Cik.

The default sequence is `Long, Ngah, Alang, Anjang, Andak, Uda, Uteh`, with the
youngest always `Su`. Families differ; change `birth_order_titles` on the
Settings tab.

Malay also grades siblings by seniority — `Abang`, `Kakak`, `Adik` — and carries
the birth-order title across a marriage, so the wife of Pak Long is Mak Long.

### Arabic grades by side

Your father's brother is `'Amm` (عم). Your mother's brother is `Khāl` (خال).
There is no word covering both, so a title cannot be produced without knowing
which parent the path ran through.

Cousins are named after the uncle or aunt they descend from, which makes four
distinct terms where English has one:

| Through | Term |
| --- | --- |
| father's brother | `Ibn al-'Amm` (ابن العم) |
| father's sister | `Ibn al-'Ammah` (ابن العمة) |
| mother's brother | `Ibn al-Khāl` (ابن الخال) |
| mother's sister | `Ibn al-Khālah` (ابن الخالة) |

### English grades by neither

Both are "uncle". Cousins are counted by degree and removal. Its one advantage
is that it needs the least information — which is why it is the safest fallback
when a family's birth dates are thin.

### And where a language has no word at all

`Besan` — the relationship between two sets of parents whose children married —
is a real and socially significant relationship. Malay names it, Arabic names it
(`nasib`), and English can only describe it: "your child's parent-in-law".

---

## Step three: what the family actually calls them

No algorithm arrives at `Mak Su Kecik`. Any pair can carry a hand-written title
that overrides the computed one, stored in `CustomTitles` and checked before
anything is derived.

A title recorded against `GLOBAL` applies to every viewer, which covers the
common case of one person the whole family calls by a particular name regardless
of their own relationship to them.

---

## Checking it

`tests/kinship.test.js` asserts 105 titles across a four-generation family, in
all three languages — including the cases that break kinship engines: five
siblings whose birth order decides their titles, relatives on both sides of the
family, half-siblings, a cousin once removed in both directions, and besan.

```
npm test
```

`tools/build-prototype.js` builds a browser page from the same sources, so the
titles can be read rather than asserted.
