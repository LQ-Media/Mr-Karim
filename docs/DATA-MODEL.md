# Data model

All data lives in one Google Sheet in the owner's Drive. Each tab below is a
table; row 1 holds the column headers exactly as named here. The app creates
every tab and header automatically on first run, so the Sheet does not need to
be prepared by hand.

A guiding rule: **the sheet stores facts, never labels.** No cell ever contains
"uncle" or "Pak Long". Those are computed per viewer at read time. Storing them
would mean re-writing thousands of rows whenever one link changes, and would be
wrong for every viewer except the one it was written for.

Rows are never deleted. Removal is always a status change, so a mistaken
deletion by a relative can be undone and the audit trail stays intact.

---

## `People`

One row per human being. The central table.

| Column | Type | Notes |
| --- | --- | --- |
| `person_id` | `P00001` | Immutable. Never reused, even after a merge. |
| `display_name` | text | What the app shows. Usually the full name. |
| `full_name` | text | Full formal name including patronymic. |
| `given_name` | text | First name only, used by the matcher. |
| `patronym` | text | Auto-parsed from `full_name` (the name after bin/binti). |
| `patronym_type` | `bin` `binti` `a/l` `a/p` `none` | Auto-parsed. Also a gender signal. |
| `also_known_as` | text | Comma-separated nicknames. Searched by the matcher. |
| `honorific` | text | Haji, Hajjah, Dr, Ustaz, etc. Display only. |
| `gender` | `M` `F` `U` | `U` = unknown/unrecorded. |
| `birth_date` | ISO date | May be partial; see `birth_precision`. |
| `birth_precision` | `exact` `month` `year` `about` `unknown` | Elders' dates are often approximate. |
| `birth_place` | text | Matcher signal and a genuinely interesting field. |
| `birth_order` | integer | Rank among siblings. **Drives Malay birth-order titles.** |
| `birth_order_source` | `derived` `manual` | Derived from dates unless a human set it. |
| `is_living` | `TRUE` `FALSE` | |
| `death_date` | ISO date | |
| `death_precision` | as birth | |
| `death_place` | text | |
| `burial_place` | text | |
| `email` | text | Optional. Links a person to a login. |
| `mobile` | text | Optional. Matcher signal. |
| `address` | text | Optional. Matcher signal. |
| `country` | text | |
| `occupation` | text | |
| `notes` | long text | Free-form stories and recollections. |
| `photo_file_id` | Drive ID | Primary portrait. |
| `status` | `active` `merged` `hidden` | |
| `merged_into_id` | `P00042` | Set when this row lost a merge. Lookups follow it. |
| `created_by` | email | |
| `created_at` | ISO datetime | |
| `updated_by` | email | |
| `updated_at` | ISO datetime | |

`birth_order` deserves emphasis. Malay kinship titles for a parent's siblings
(`Pak Long`, `Mak Ngah`, `Pak Su`) encode *where that person sits among their own
siblings*. It cannot be derived from the tree shape — only from birth order. The
app derives it from birth dates where they are known and lets a human correct it
where they are not, which for a grandparents' generation is often.

---

## `Parentage`

Parent-child links. Kept as a separate table rather than two columns on `People`
because the real world allows a child to have biological parents *and* adoptive
parents *and* step-parents simultaneously, all of which the family may want
recorded.

| Column | Type | Notes |
| --- | --- | --- |
| `link_id` | `L00001` | |
| `child_id` | person_id | |
| `parent_id` | person_id | |
| `parent_role` | `father` `mother` `guardian` | |
| `relation_type` | `biological` `adoptive` `foster` `step` | |
| `status` | `active` `removed` | |
| `created_by` `created_at` | | |

Only `biological` and `adoptive` links carry blood-title inheritance. `step` and
`foster` links produce step-titles and never make two people cousins.

---

## `Unions`

Marriages and partnerships. A separate table because a person may have several
over a lifetime, and because the union itself carries facts (date, place, how it
ended) that belong to neither partner alone.

| Column | Type | Notes |
| --- | --- | --- |
| `union_id` | `U00001` | |
| `partner_a_id` `partner_b_id` | person_id | Order is not meaningful. |
| `union_type` | `nikah` `marriage` `civil` `partnership` | |
| `status` | `current` `divorced` `widowed` `separated` | |
| `start_date` `end_date` | ISO date | |
| `place` | text | |
| `order_index` | integer | 1st, 2nd marriage. Orders the display. |
| `notes` | text | |
| `created_by` `created_at` | | |

---

## `Users`

One row per Google account permitted to sign in.

| Column | Type | Notes |
| --- | --- | --- |
| `email` | text | The Google account. Primary key. |
| `person_id` | person_id | Which person in the tree this login *is*. |
| `role` | `owner` `admin` `member` `pending` `blocked` | |
| `lang_pref` | `ms` `en` `ar` | Which title language they see. |
| `can_invite` | `TRUE` `FALSE` | |
| `invited_by` | email | |
| `invited_at` `last_login_at` | ISO datetime | |
| `status` | `active` `suspended` | |

The `person_id` binding is what makes the whole app ego-centric. Without it the
app cannot know whose point of view to render from, so an account with no
binding is sent to a "which of these people are you?" screen before it sees
anything else.

---

## `Invites`

| Column | Type | Notes |
| --- | --- | --- |
| `invite_id` | `I00001` | |
| `email` | text | Who it is for. |
| `token` | random string | The secret in the invite URL. |
| `prebind_person_id` | person_id | Optional. Binds them to a record on first login. |
| `invited_by` | email | |
| `created_at` `expires_at` `used_at` | ISO datetime | |
| `status` | `open` `used` `revoked` `expired` | |

---

## `PendingChanges`

The approval queue. Every write by a non-admin that falls outside their own
branch lands here instead of being applied.

| Column | Type | Notes |
| --- | --- | --- |
| `change_id` | `C00001` | |
| `kind` | `create_person` `update_person` `add_parentage` `add_union` `remove_link` `upload_photo` | |
| `target_id` | id | The entity affected, where one already exists. |
| `payload_json` | JSON | The proposed new values. |
| `summary` | text | Human-readable, so the admin need not read JSON. |
| `requested_by` | email | |
| `requested_at` | ISO datetime | |
| `status` | `pending` `approved` `rejected` | |
| `reviewed_by` `reviewed_at` | | |
| `review_note` | text | |

---

## `MergeQueue`

Suspected duplicates, scored by the matcher.

| Column | Type | Notes |
| --- | --- | --- |
| `candidate_id` | `M00001` | |
| `person_a_id` `person_b_id` | person_id | Stored with the lower ID first, so a pair is queued once. |
| `score` | 0–100 | |
| `signals_json` | JSON | Which signals fired and what each contributed. |
| `detected_at` | ISO datetime | |
| `status` | `open` `merged` `rejected` | `rejected` means "confirmed different people" and suppresses re-detection. |
| `resolved_by` `resolved_at` | | |

---

## `CustomTitles`

Hand-written titles that override the computed ones.

| Column | Type | Notes |
| --- | --- | --- |
| `title_id` | `T00001` | |
| `from_person_id` | person_id or `GLOBAL` | Whose view this applies to. `GLOBAL` = everyone. |
| `to_person_id` | person_id | Who is being labelled. |
| `custom_label` | text | e.g. `Mak Su Kecik` |
| `lang` | `ms` `en` `ar` `*` | `*` applies in every language. |
| `created_by` `created_at` | | |

`GLOBAL` handles the common case where the *whole family* calls one person by a
particular name regardless of their own relationship to them.

---

## `AuditLog`

| Column | Type | Notes |
| --- | --- | --- |
| `log_id` | `A00001` | |
| `ts` | ISO datetime | |
| `actor_email` | email | |
| `action` | text | |
| `entity` `entity_id` | text | |
| `detail_json` | JSON | Before/after values. |

---

## `Settings`

Key/value configuration, editable by the owner without touching code.

| Key | Default | Meaning |
| --- | --- | --- |
| `family_name` | Keluarga | Shown in the header. |
| `photo_folder_id` | *(set at install)* | Drive folder holding portraits. |
| `oauth_client_id` | *(set at install)* | Google Identity Services client ID. |
| `birth_order_titles` | `Long,Ngah,Alang,Anjang,Andak,Uda,Uteh` | The family's ordering. Youngest is always `Su`. |
| `merge_auto_threshold` | 92 | Score above which a match is offered inline during entry. |
| `merge_queue_threshold` | 68 | Score above which a pair is queued for admin review. |
| `default_lang` | `ms` | |
| `allow_member_invites` | `TRUE` | |
