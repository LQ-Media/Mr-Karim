# Pokok Keluarga — Family Tree Web App

An interactive, collaborative family tree. Relatives sign in with their own Google
account, add their family members, upload photos, and see every other person in
the tree labelled with **the title they personally would use** — Abah, Kakak,
Pak Long, Atuk — computed automatically from the underlying relationship graph.

Runs entirely free on Google infrastructure owned by the family, with no server,
no hosting bill and no billing account.

| Layer | Technology |
| --- | --- |
| Interface | Mobile-first single-page HTML/CSS/JS |
| Hosting | Google Apps Script web app |
| Database | Google Sheet (10 tabs) in the owner's Drive |
| Photo storage | Google Drive folder in the owner's Drive |
| Authentication | Google Identity Services, verified server-side |
| Cost | Zero. No credit card, no billing account. |

## Why Apps Script

Google Drive dropped static website hosting in 2016, so a plain HTML file in
Drive can no longer be served as a web page. Apps Script is the remaining way to
serve a real web interface from a Google account for free. It also gives us
something better than static hosting would: the script executes **as the account
that owns it**, so the Sheet and the photo folder stay private to the owner.
Relatives interact with the data only through the app's own rules — they are
never given access to the spreadsheet itself.

## Core ideas

**Ego-centric titles.** The database stores neutral facts: X is the father of Y,
A and B are married. Nobody is stored as "uncle", because uncle-ness is not a
property of a person — it is a property of a *pair*. When a user opens the app,
every card is labelled relative to them. The same man is `Abah` to his son,
`Pak Long` to his nephew, `Atuk` to his grandson and `Abang` to his sister, from
one stored fact.

**Three languages plus your own.** Every computed title can render in Malay,
English or Arabic/Islamic terms, switchable per user. Families also keep private
names that no algorithm can guess — the one particular aunt everyone calls
`Mak Su Kecik` — so any pair can carry a hand-written custom title that
overrides the computed one.

**Duplicate prevention over duplicate cleanup.** In any crowd-sourced tree the
same person gets entered twice by two different relatives, and the tree silently
becomes wrong. This app resists that at entry time: you never create a floating
person, only a person attached to someone already in the tree, and the app
searches for a match while you type. Anything that slips through is scored and
queued for the admin to merge.

**Malay patronymics as an identity signal.** `Ahmad bin Ismail` states his
father's name in his own name. The matcher parses `bin`, `binti`, `b.`, `bt.`,
`a/l` and `a/p` and scores the patronym against each candidate's recorded
father, which catches most duplicate entries on its own.

## Documentation

| Document | Contents |
| --- | --- |
| [`docs/SETUP.md`](docs/SETUP.md) | Step-by-step deployment, start to finish |
| [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) | Every sheet tab, every column |
| [`docs/KINSHIP.md`](docs/KINSHIP.md) | How titles are computed, in all three languages |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Request lifecycle, permissions, caching |

## Repository layout

    apps-script/     The deployable Apps Script project
    docs/            Setup and design documentation
    tests/           Node tests for the kinship and matching engines
    tools/           Local development helpers
