"use client";

import { useEffect } from "react";
import { startSync } from "@/lib/progress/client";

/**
 * Starts the account sync for "My progress". The shell renders this before
 * the page, so its effect runs before any page's effects (React runs earlier
 * siblings first) and the Quran reader can wait on it for the bookmark.
 */
export default function ProgressSync({ signedIn }) {
  useEffect(() => {
    startSync(signedIn);
  }, [signedIn]);
  return null;
}
