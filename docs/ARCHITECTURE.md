# How it fits together

```
     browser                    Apps Script (runs as the owner)         owner's Drive
  ┌───────────┐                ┌──────────────────────────────┐        ┌─────────────┐
  │ Index     │ ── sign in ──▶ │ Code.gs      doGet, install  │        │             │
  │ Styles    │                │ 02_Auth      OAuth, sessions │        │  Data       │
  │ Client    │ ◀── page ───── │ 11_Api       the call surface│ ─────▶ │  (Sheet)    │
  │           │                │ 03_People    writes          │        │             │
  │           │ ── calls ────▶ │ 05–08        graph, titles,  │        │  Photos     │
  │           │ ◀── JSON ───── │              matching        │ ─────▶ │  (folder)   │
  └───────────┘                │ 09/10        merge, admin    │        └─────────────┘
                               │ 01_Store     sheet access    │
                               └──────────────────────────────┘
```

## The one decision everything follows from

The web app is deployed to **execute as its owner**. The spreadsheet and the
photo folder are therefore never shared with relatives: the script reaches them
with the owner's permissions, and relatives reach them only through code that
enforces the rules. Nobody can open the spreadsheet and rewrite a row.

The cost of that choice is that Apps Script can no longer tell us who is
visiting. `Session.getActiveUser().getEmail()` returns an empty string for
anyone outside the owner's Workspace domain when a script runs as its owner —
which is exactly who the relatives are, on personal Gmail accounts.

The obvious fix, a Google Identity Services button, does not work either. GSI
only runs on JavaScript origins registered in advance, and Apps Script serves
its pages from inside a sandbox iframe on a generated `googleusercontent.com`
origin that changes between deployments. There is no origin to register.

So sign-in goes the long way round, which turns out to be the sturdy way:

1. The page offers a top-level link to Google's authorisation endpoint.
2. Google returns the visitor to the web app's own `/exec` URL — fixed, and
   registerable as a redirect URI.
3. `doGet` exchanges the authorisation code for an identity server-side, where
   the client secret can safely live.
4. It renders the page with an **HMAC-signed session token**, which the browser
   presents on every subsequent call.

Sessions are signed rather than stored. A server-side session table would mean
either a cache that silently evicts people mid-visit or another sheet write on
every request; a token the server signs and re-checks needs neither and cannot
be forged without the secret.

## Request lifecycle

Every API function takes the session token first and verifies it before doing
anything. There is no trusted client state — hiding a button in the interface is
a courtesy, not a control.

```
api_view(token, focusId)
  → AUTH_session(token)        verify signature and expiry, resolve the user
  → AUTH_requireActive         pending accounts and unbound accounts stop here
  → ST_graph()                 whole tree, from cache when warm
  → TTL_title(...) per card    titles computed for THIS viewer
  → { ok: true, data }
```

## Why the whole tree is loaded at once

Apps Script charges roughly the same for reading one cell as for reading a
thousand, so per-row access is what makes these apps feel slow. Four tabs are
read in four calls, indexed into an object graph, and cached for five minutes,
chunked across cache entries because Google caps each one at 100KB.

Any write clears the cache rather than patching it. A stale tree is a wrong
tree, and correctness is worth one extra read.

## Permissions

| | Read | Direct write | Proposal |
| --- | --- | --- | --- |
| Owner / admin | everyone | everyone | — |
| Member | everyone | self, spouse, parents, descendants and their spouses | everyone else |
| Pending | nothing | — | — |

A parent entering their own family should not wait for anyone. Reaching sideways
— a cousin's children, an aunt's second marriage — is where a shared tree gets
damaged by well-meaning guesses, so those edits queue as proposals. The stored
payload is replayed on approval exactly as submitted, and credited to whoever
proposed it rather than to the admin who let it through: the audit trail should
say who knew this, not who clicked yes.

## Things that cannot happen

- **A floating person.** Every record is created attached to someone already in
  the tree. This is the single documented exception: `api_startTree`, which runs
  once, on an empty tree, for an admin.
- **A cycle.** Adding a parent link checks that the proposed parent is not
  already a descendant, or the ancestor walk would never terminate.
- **A deletion.** Removal is a status change. A merged record stays in the sheet
  pointing at its survivor, so old links still resolve.
- **A field a client should not write.** Only known fields survive sanitising,
  so nothing submitted can reach `role`, `status` or a merge pointer.

## Files

| File | Holds |
| --- | --- |
| `Code.gs` | `doGet`, the OAuth callback, installation |
| `00_Config.gs` | schema, defaults, tunables |
| `01_Store.gs` | sheet reads and writes, id allocation, cache, audit |
| `02_Auth.gs` | OAuth round trip, signed sessions, permission scopes |
| `03_People.gs` | person, parent-link and marriage writes; the proposal queue |
| `04_Photos.gs` | Drive storage and base64 delivery |
| `05_Relations.gs` | building and indexing the graph |
| `06_Kinship.gs` | classifying a pair into a relationship |
| `07_Titles.gs` | naming it, in Malay, English or Arabic |
| `08_Matching.gs` | duplicate detection |
| `09_Merge.gs` | folding two records into one |
| `10_Admin.gs` | approvals, invitations, access |
| `11_Api.gs` | the call surface |
| `Index/Styles/Client.html` | the interface |
