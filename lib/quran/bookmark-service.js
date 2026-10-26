/**
 * Bookmark service — the interface the Quran store expects
 * ({ available, get(), set(pos) }), backed here by "My progress"
 * (lib/progress/client.js): on the phone for a guest, and on the account as
 * well for a signed-in visitor. Saving a bookmark also counts as Quran read
 * today for the streak.
 */

import { getProgress, update, whenSynced } from "@/lib/progress/client";
import { setBookmark } from "@/lib/progress/model";

export function createProgressBookmarkService() {
  return {
    available: true,
    async get() {
      // A signed-in visitor's bookmark may be on the account, not this phone.
      await whenSynced();
      const b = getProgress().bookmark;
      return b ? { chapterId: b.chapterId, verseKey: b.verseKey } : null;
    },
    async set(pos) {
      update((p) => setBookmark(p, pos));
    },
  };
}
