"use server";

import { getUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { clean, emptyProgress, merge } from "@/lib/progress/model";

// The account side of "My progress" (lib/progress/client.js). Server Functions
// can be reached by a direct POST, so each one checks who is asking; a guest
// gets nothing and saves nothing.

export async function loadAccountProgress() {
  const user = await getUser();
  if (!user) return null;
  const { rows } = await query("select data from app_progress where user_id = $1", [user.id]);
  return rows[0] ? clean(rows[0].data) : emptyProgress();
}

/** Merge the phone's copy into the account and return the result. */
export async function saveAccountProgress(incoming) {
  const user = await getUser();
  if (!user) return null;
  // Refuse anything absurdly large before parsing it into the record.
  if (JSON.stringify(incoming ?? null).length > 200_000) return null;
  const { rows } = await query("select data from app_progress where user_id = $1", [user.id]);
  const merged = merge(rows[0]?.data ?? emptyProgress(), clean(incoming));
  await query(
    `insert into app_progress (user_id, data, updated_at) values ($1, $2, now())
     on conflict (user_id) do update set data = excluded.data, updated_at = now()`,
    [user.id, JSON.stringify(merged)]
  );
  return merged;
}
