# Deploying it, in two pastes

Everything here has to be done by you, signed in as
**karim@littlequrankids.sg**. Two steps in it cannot be automated by anyone:
Google has no API for creating an OAuth client — the Cloud Console is the only
way — and the script needs *your* consent to touch *your* Drive.

About 25 minutes. Free, no billing account, no credit card.

The `deploy/` folder holds the whole project as two files, so you are pasting
twice rather than recreating fifteen files by hand.

---

## 1 · Create the project — 2 min

1. [script.google.com](https://script.google.com) → **New project**
2. Rename it (top left) to `Pokok Keluarga`
3. Left sidebar → **Project Settings** (gear) → tick
   **Show "appsscript.json" manifest file in editor**

## 2 · Paste the two files — 3 min

| Paste | Into |
| --- | --- |
| `deploy/appsscript.json` | the existing `appsscript.json` — select all, replace |
| `deploy/Code.gs` | the existing `Code.gs` — select all, replace |
| `deploy/Index.html` | **+ → HTML**, name it `Index` (no extension), replace the contents |

Save (⌘S / Ctrl+S). Three files in the sidebar: `Code.gs`, `Index.html`,
`appsscript.json`.

## 3 · Build the spreadsheet and photo folder — 2 min

1. Function dropdown → **installFamilyTree** → **Run**
2. Google asks you to authorise. **Review permissions** → your account →
   **Advanced** → **Go to Pokok Keluarga (unsafe)** → **Allow**

   That warning is Google telling you the app has not been through *its* review.
   You are authorising a script you own to reach your own Drive.
3. The log prints the spreadsheet URL. Two things now exist in your Drive:
   **Pokok Keluarga — Data** and **Pokok Keluarga — Photos**. Don't rename them.

## 4 · Deploy it — 2 min

1. **Deploy → New deployment** → gear icon → **Web app**
2. **Execute as:** `Me` · **Who has access:** `Anyone`
3. **Deploy**, then **copy the Web app URL** — it ends in `/exec`.

**"Anyone" is not a data leak.** It means the *page* loads without a Google
sign-in, which it must, because the sign-in happens on that page. The page holds
no family data. Every request for data carries a session token the server
verifies, and anyone you have not invited sees only a "waiting for approval"
screen.

Executing as *you* is what keeps the spreadsheet private: the script reaches it
with your permissions, so relatives never need — and never get — access to the
spreadsheet itself.

## 5 · Create the sign-in credentials — 10 min

This is the fiddly part, and the part nobody can do for you.

1. [console.cloud.google.com](https://console.cloud.google.com). Pick the project
   behind your script from the project selector, or create one called
   `Pokok Keluarga`.

2. **APIs & Services → OAuth consent screen**
   - **User type: External.** It must be External — *Internal* would restrict
     sign-in to littlequrankids.sg addresses, and your relatives are on personal
     Gmail.
   - App name `Pokok Keluarga`, support email and developer email: yours.
   - **Scopes: add nothing.** The defaults (`openid`, `email`, `profile`) are all
     this needs.
   - Finish, then **Publish app** → confirm.

   Publishing sounds alarming and is not. Google only requires verification for
   *sensitive* scopes. Asking who someone is — name, email, picture — is not
   sensitive, so publishing is instant and nobody sees an "unverified app"
   warning. Leaving it in Testing instead would cap you at 100 hand-listed users
   whose sign-in expires every 7 days.

3. **Credentials → Create credentials → OAuth client ID**
   - Type: **Web application**, name `Pokok Keluarga web app`
   - **Authorised redirect URIs → Add URI** → paste the **exact** `/exec` URL
     from step 4. No trailing slash. Not the `/dev` URL.
   - **Create**, and copy the **Client ID** and **Client secret**.
   - Leave **Authorised JavaScript origins** empty. The app never signs anyone
     in from the browser — Apps Script serves pages from a generated
     `googleusercontent.com` address that changes and cannot be registered.

## 6 · Hand them to the app — 2 min

Back in the Apps Script editor, paste this at the very bottom of `Code.gs`:

```javascript
function configure() {
  setOAuthCredentials(
    'PASTE-CLIENT-ID.apps.googleusercontent.com',
    'PASTE-CLIENT-SECRET'
  );
}
```

Run **configure** once, then **delete the function** — the values are in Script
Properties now and the secret should not sit in the source.

Run **checkInstallation**. Everything should read OK.

---

## Now test it

### On your own

1. Run **seedDemoFamily** — fills the empty tree with 21 known people.
2. It prints something like `bindMeTo('P00014')`. Run that too.
3. Open your web app URL. Sign in. You should land on Karim with his family
   around him, every card labelled.
4. Run **verifyKinship** — asserts 11 titles against your own sheet.
5. Try **Add several**, **Reorder**, the ☰ chart, and a photo upload.
6. Run **clearDemoFamily** before your relatives arrive.

### With someone else

You need a second Google account and a **private window**, or the two sessions
fight over who is signed in.

| Test | What should happen |
| --- | --- |
| Uninvited account opens the URL | "Waiting for approval" and nothing else — no names, no photos |
| You invite them (☰ → Invite a relative), they sign in | Straight in |
| You add them to the tree first, then invite | They are offered *"which one are you?"* with themselves at the top |
| They edit someone on the far side of the family | "Sent for approval", and it appears in your ⚙ → Changes |
| They edit their own parents or children | Applies immediately |
| They add someone who already exists | Shown the existing person before anything is created |

[`docs/TESTING.md`](TESTING.md) has the full version.

---

## When something goes wrong

Tell me the exact message and I will fix it. The usual three:

**"Sign-in is not configured yet."**
Step 6 did not save. Run `showInstallation` and check both the client id and the
secret show as set.

**"Google did not accept that sign-in."**
The redirect URI does not match. Run `showRedirectUri`, copy exactly what it
prints, and compare it character for character with the Cloud Console entry.
This is the single most common failure.

**"That sign-in link has expired."**
The page sat open more than two hours before anyone clicked through. Reload.

---

## Changing the code later

Edit `apps-script/`, run `node tools/build-deploy-bundle.js`, paste the two
files again, then **Deploy → Manage deployments → ✏️ → Version: New version →
Deploy**. The URL stays the same, so nothing you have sent to relatives breaks.

If you would rather not paste: install [clasp](https://github.com/google/clasp)
(`npm i -g @google/clasp`), run `clasp login`, `clasp clone <script id>`, then
`clasp push` from `apps-script/`. That pushes all fifteen real files and skips
the bundle entirely.
