# Linking photos from Google Photos

## The constraint that shapes this

A Google Photos link cannot be shown to anyone but its owner.

The Picker API returns a `baseUrl` for each photo. That URL
[lasts sixty minutes](https://developers.google.com/photos/picker/guides/media-items)
and only works when presented with an access token belonging to the account
whose library the photo lives in. Store it in the family tree and you get a
photograph visible to exactly one person and broken for everybody, including
them, within the hour.

So the app does not store links. **It copies the image once into the family's
own Drive folder.** From that moment the photograph belongs to the family: it is
served to every signed-in relative through the same authenticated route as any
other portrait, and it keeps working whether or not the person who chose it
still has that photo, that phone, or that Google account.

That is the only way to have both things you asked for — linking from Google
Photos, and everyone being able to see the result.

## What the person actually sees

1. On someone's profile, **Choose from Google Photos**.
2. The first time, Google asks whether this family tree may see the photos they
   pick. This is a separate permission from signing in, asked for only at this
   moment. It grants access to *the items they hand over*, never to their
   library.
3. Google Photos opens and they choose one picture.
4. They come back to the tab; the app is already watching for it.
5. The app fetches the image at 1200px and a 256px thumbnail, writes both into
   the family folder, and the portrait appears on every relative's screen.

If the person is outside their own branch, the photo goes to the approval queue
like any other change.

## Turning it on

It ships **off**. Three steps to enable it:

1. **Google Cloud Console → APIs & Services → Library**, search for
   **Photos Picker API**, and enable it.
2. **OAuth consent screen → Data access → Add scopes**, and add
   `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`.
3. In the app, **⚙ → Settings → Google Photos → On**.

No code change and no redeploy; the app reads the setting at runtime.

## Read this before step 2

`photospicker.mediaitems.readonly` is a **sensitive scope**. Google
[requires apps that request one to be verified](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
before publishing, which means submitting a justification and a video
demonstration and waiting for review.

Until then you have two options, and neither is free:

| | What happens |
| --- | --- |
| **Stay in Testing** | Works immediately, but capped at **100 test users you list by hand**, and their sign-in expires every **7 days**. For a 200-person family that cap is a real ceiling. |
| **Submit for verification** | No cap, no warning screen, but review takes weeks and Google may ask for changes. |

Adding this scope also changes the sign-in screen for **everyone**, including
relatives who will never touch the feature.

## My recommendation: leave it off to begin with

Not because it does not work — it does — but because **on a phone you already
have it**.

Tapping **Upload photo** opens the phone's own picker, and on Android that picker
*is* Google Photos; on iPhone it is the Photos app, which is where Google Photos
backs up from. Relatives adding pictures of their children from their phones —
which is nearly all of them — reach their Google Photos library today, with no
extra permission, no cap and no verification.

The Picker API earns its place in one case: **someone working on a laptop whose
photos live only in Google Photos and not on that machine.** That is worth
having, and it is built and ready. It is just not worth putting a sensitive
permission in front of two hundred relatives before the tree is even full.

A sensible order:

1. Run the stress test with uploads only. See whether anyone actually hits the
   laptop problem.
2. If they do, switch it on in Testing and add those few people as test users.
3. Submit for verification only if the whole family ends up wanting it.

## Where the photos live

| | |
| --- | --- |
| Stored in | `Pokok Keluarga — Photos` in **your** Drive |
| Sizes kept | 1200px full image, 256px thumbnail |
| Shared with | Nobody. The folder stays private to you. |
| How relatives see them | The app reads the file with your permissions and sends the bytes to whoever is signed in |
| If a photo is replaced | The old one stays in Drive. Family photographs are not always easy to find twice. |

Photos are never made public, and never given an "anyone with the link" URL.
That shortcut is the usual way these apps are built, and it would put
photographs of the family's children behind nothing but an unguessable address.
