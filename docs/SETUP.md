# Setting it up

Start to finish, roughly 30–40 minutes. Everything here is free and no billing
account is needed at any point.

Do all of this signed in as **karim@littlequrankids.sg**, since that account
will own the data.

---

## 1. Create the Apps Script project

1. Go to [script.google.com](https://script.google.com) and click **New project**.
2. Rename it (top left) to `Pokok Keluarga`.
3. Open **Project Settings** (the gear on the left) and tick
   **Show "appsscript.json" manifest file in editor**.

## 2. Add the code

In the editor, recreate each file from the `apps-script/` folder of this
repository. File names must match exactly, without extensions:

| In this repo | In the editor | Type |
| --- | --- | --- |
| `appsscript.json` | `appsscript.json` | already exists — replace its contents |
| `Code.gs`, `00_Config.gs` … `11_Api.gs` | same names | Script (`.gs`) |
| `Index.html`, `Styles.html`, `Client.html` | `Index`, `Styles`, `Client` | HTML |

Add a script file with **+ → Script**, an HTML file with **+ → HTML**. Apps
Script adds the extension itself, so type `00_Config`, not `00_Config.gs`.

Order does not matter — Apps Script loads every file into one shared scope.

> **Faster alternative.** If you are comfortable with a terminal, install
> [clasp](https://github.com/google/clasp) (`npm i -g @google/clasp`), run
> `clasp login`, then `clasp clone <script id>` and `clasp push` from the
> `apps-script/` folder. This pushes all fifteen files at once.

## 3. Build the spreadsheet and photo folder

1. In the editor's function dropdown choose **installFamilyTree** and press
   **Run**.
2. Google will ask you to authorise the script. Choose your account, then
   **Advanced → Go to Pokok Keluarga (unsafe)** → **Allow**. This warning is
   normal: you are authorising a script you own, to reach your own Drive.
3. The execution log prints the URL of the spreadsheet it created. Open it once
   to confirm the ten tabs are there.

Two things now exist in your Drive: **Pokok Keluarga — Data** (the spreadsheet)
and **Pokok Keluarga — Photos** (the folder). Do not rename or move them.

## 4. Deploy it as a web app

1. **Deploy → New deployment**, and pick type **Web app**.
2. Set:
   - **Execute as:** `Me (karim@littlequrankids.sg)`
   - **Who has access:** `Anyone`
3. Click **Deploy** and copy the **Web app URL**. It looks like
   `https://script.google.com/macros/s/AKfycb.../exec`.

**"Anyone" does not mean the family data is public.** It means the *page* can
be reached without a Google sign-in — which it has to be, because the sign-in
happens on that page. The page contains no family data. Every request for
actual data carries a session token that the server verifies first, and a
visitor nobody has invited only ever reaches a "waiting for approval" screen.

Executing as you is what keeps the spreadsheet private: the script reaches it
with your permissions, so relatives never need, and never get, access to the
spreadsheet itself.

## 5. Create the sign-in credentials

The app signs relatives in with their own Google accounts, which needs an OAuth
client. This is the fiddliest step; it is a one-off.

1. Go to [console.cloud.google.com](https://console.cloud.google.com). The
   Apps Script project already has a Cloud project behind it — pick it from the
   project selector, or create a new one and name it `Pokok Keluarga`.
2. Go to **APIs & Services → OAuth consent screen**:
   - **User type:** `External`. It must be External. *Internal* would restrict
     sign-in to littlequrankids.sg addresses, and your relatives will be using
     personal Gmail accounts.
   - App name: `Pokok Keluarga`. Support email and developer email: your own.
   - On the **Scopes** step, add nothing. The defaults (`openid`, `email`,
     `profile`) are all this needs.
   - Finish, then **Publish app** and confirm.

   Publishing sounds alarming and is not. Google only requires an app to go
   through verification when it asks for *sensitive* scopes. Asking who someone
   is — name, email, profile picture — is not sensitive, so publishing is
   instant and nobody sees an "unverified app" warning. Leaving it in *Testing*
   instead would cap you at 100 hand-listed test users and expire their sign-in
   every seven days.

3. Go to **Credentials → Create credentials → OAuth client ID**:
   - **Application type:** `Web application`
   - **Name:** `Pokok Keluarga web app`
   - Under **Authorised redirect URIs**, click **Add URI** and paste the
     **exact** web app URL from step 4, ending in `/exec`.
   - Create, then copy the **Client ID** and **Client secret**.

   Leave **Authorised JavaScript origins** empty. The app never signs anyone in
   from the browser, precisely because Apps Script serves its pages from a
   generated `googleusercontent.com` address that changes and cannot be
   registered here.

## 6. Tell the app about them

Back in the Apps Script editor, paste this into any `.gs` file temporarily,
substituting your two values:

```javascript
function configure() {
  setOAuthCredentials(
    'PASTE-CLIENT-ID.apps.googleusercontent.com',
    'PASTE-CLIENT-SECRET'
  );
}
```

Run **configure** once, then delete the function — the values are now stored in
Script Properties and the secret should not sit in the source.

Run **showInstallation** to check everything is set.

## 7. Start the tree

Open your web app URL, sign in, and the app will ask you to create the first
person: yourself. Everyone after that is added *through* someone already in the
tree, which is what stops the family splitting into disconnected fragments.

Then add your parents, your spouse and your children, and invite the first few
relatives from **☰ → Invite a relative**.

---

## Getting two hundred people in

This is the part that decides whether the project works. The kinship engine is
worthless on a tree nobody finished entering, and two hundred people entered one
form at a time is a weekend nobody has.

### Build outward from yourself

Every person is added through someone already in the tree, so the order you work
in decides whether it stays in one piece:

1. **Yourself**, then **your parents**, then **their parents** — as far up as you
   can name. Stop where your memory does; someone else will know more.
2. **Your parents' brothers and sisters**, entered *oldest first*. This is the
   generation that produces Pak Long, Mak Ngah and Pak Su, so the order here is
   worth a phone call to get right.
3. **Their spouses**, then **their children** — your cousins.
4. **Your spouse**, then **their parents**. That begins the second tree; the two
   sides join through your marriage and the app works out the in-law titles from
   there.
5. **Your children**, and their families.

The app shows a hint on your own record suggesting the next step, until the tree
is big enough not to need it.

### Add a whole generation at once

On **Children** and **Brothers and sisters**, the card at the end of the row says
**Add several**. It gives you a short list — name, son or daughter, birth year —
and a new row appears as you type, so nine children take one screen rather than
nine forms.

**List them oldest first.** Their position becomes their birth order, which is
exactly what decides whether an uncle ends up as Pak Long or Pak Su. Collecting
it this way means you never have to think about it: you recite the family the way
you already would, and the hardest fact in the system comes along for free.

Got it wrong? **Reorder** in the Children section header fixes it in ten seconds.

### What you can safely skip

A name and a gender is enough to create someone. Birth dates, places and photos
can be filled in later by whoever actually knows them — and that is the point of
letting relatives in. Your job is the *shape* of the family; theirs is the detail.

One exception: **enter the full name with bin or binti where you know it.**
"Ahmad bin Ismail" tells the app who his father was, and that single fact is what
stops your cousin from creating a second Ahmad next month.

### Set your family's sibling titles first

Before anyone else starts entering, open **⚙ → Settings** and check the sibling
sequence. The default is `Long, Ngah, Alang, Anjang, Andak, Uda, Uteh`, with the
youngest always `Su`, but families and regions differ — some use Teh in the third
position, some a shorter run. The panel previews the titles as you type them.

Get this right on day one. Relatives use these words daily, and a family shown
the wrong name for an uncle they have called Pak Ngah their whole life will stop
trusting everything else the app tells them.

---

## Inviting people

An invitation is tied to an email address, not to a secret link. The person must
sign in with that exact Google account, so a link forwarded to the wrong person
admits nobody.

You can also bind an invitation to a person already in the tree. If your aunt is
already recorded and you invite her, signing in claims that record instead of
creating a second copy of her — which is the duplicate that is hardest to spot
later, because both copies look equally real.

Members can invite their own relatives by default. Turn that off by setting
`allow_member_invites` to `FALSE` on the **Settings** tab.

## Changing the code later

Edit the files, then **Deploy → Manage deployments → ✏️ → Version: New version
→ Deploy**. The URL stays the same, so nothing you have sent to relatives
breaks. Settings and credentials are unaffected.

## Optional: a nightly duplicate scan

**Triggers** (the clock icon) **→ Add trigger**, choose
`nightlyDuplicateSweep`, time-driven, day timer, at whatever hour suits. New
duplicates then appear in the admin panel each morning without anyone pressing
Scan.

---

## If something goes wrong

**"Sign-in is not configured yet."**
Step 6 has not run, or it did not save. Run `showInstallation` and check the
client id and secret both show as set.

**"Google did not accept that sign-in."**
The redirect URI does not match. It must be the `/exec` URL exactly — no
trailing slash, not the `/dev` URL, and it must be the current deployment's URL.
Run `showRedirectUri` to print the exact string to paste.

**Relatives see "waiting for approval".**
They reached the app without an invitation. Approve them in **⚙ → Access**, or
invite their email address first.

**"That sign-in link has expired."**
The page sat open for more than two hours before they clicked through. Reload.

**A change did not appear.**
The tree is cached for five minutes. Any write clears that cache, but if you
edit the spreadsheet by hand — which is worth avoiding — wait five minutes.

## What the free limits actually are

Apps Script's consumer quotas are generous relative to a family:

| Limit | Per day | What uses it |
| --- | --- | --- |
| Script runtime | 90 minutes | every request |
| URL fetches | 20,000 | one per sign-in |
| Spreadsheet reads/writes | effectively unlimited at this scale | everything |

A single request takes well under a second, so 90 minutes of runtime is
thousands of page views a day. For a family stress test this is not a
constraint you will notice. The one real limit is Drive storage — 15GB shared
across the account — and photos are downscaled before upload, so a thousand
portraits is around 100MB.
