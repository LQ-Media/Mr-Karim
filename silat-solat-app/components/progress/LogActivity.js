"use client";

import { useEffect } from "react";
import { update } from "@/lib/progress/client";
import { logActivity } from "@/lib/progress/model";

/** Counts this page towards today's streak, once per visit. */
export default function LogActivity({ kind }) {
  useEffect(() => {
    update((p) => logActivity(p, kind));
  }, [kind]);
  return null;
}
