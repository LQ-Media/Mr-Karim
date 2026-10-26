"use client";

// The one copy of "My progress" in the browser.
//
// Everyone gets progress, signed in or not: it lives in localStorage on this
// phone. A signed-in visitor's copy is also merged with their account on the
// server (app/progress-actions.js), so it follows them to another device and
// survives clearing the browser. Signing in for the first time merges the
// week they did as a guest into the account rather than replacing it.

import { useSyncExternalStore } from "react";
import { clean, emptyProgress, merge } from "./model.js";
import { loadAccountProgress, saveAccountProgress } from "@/app/progress-actions";

const KEY = "ss_app_progress_v1";
const listeners = new Set();
let state = null; // null until first read in the browser
let signedIn = false;
let pushTimer = null;
let syncing = null;

function readLocal() {
  try {
    return clean(JSON.parse(localStorage.getItem(KEY) || "null"));
  } catch {
    return emptyProgress();
  }
}

function writeLocal(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Private mode or a full disk: progress just won't outlive this tab.
  }
}

function emit() {
  for (const l of listeners) l();
}

function ensure() {
  if (state === null && typeof window !== "undefined") state = readLocal();
  return state || emptyProgress();
}

function schedulePush() {
  if (!signedIn) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    try {
      const merged = await saveAccountProgress(ensure());
      if (merged) {
        state = merge(ensure(), merged);
        writeLocal(state);
        emit();
      }
    } catch {
      // Offline or signed out elsewhere: the local copy is safe and the next
      // change tries again.
    }
  }, 1200);
}

/** Apply a change from lib/progress/model.js, e.g. update((p) => tapTasbih(p)). */
export function update(fn) {
  state = clean(fn(ensure()));
  writeLocal(state);
  emit();
  schedulePush();
}

export function getProgress() {
  return ensure();
}

/**
 * Called once by the app shell. For a signed-in visitor, pull the account's
 * copy and merge both ways.
 */
export function startSync(isSignedIn) {
  signedIn = Boolean(isSignedIn);
  if (!signedIn || syncing) return syncing;
  syncing = (async () => {
    try {
      const remote = await loadAccountProgress();
      state = merge(ensure(), remote);
      writeLocal(state);
      emit();
      schedulePush();
    } catch {
      // Keep working from the local copy.
    }
  })();
  return syncing;
}

/** Resolves once the account's copy has been merged in (at once for a guest). */
export function whenSynced() {
  return syncing || Promise.resolve();
}

function subscribe(l) {
  listeners.add(l);
  const onStorage = (e) => {
    if (e.key === KEY) {
      state = readLocal();
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

const SERVER_SNAPSHOT = emptyProgress();

/** The current progress, re-rendering whenever it changes. */
export function useProgress() {
  return useSyncExternalStore(subscribe, ensure, () => SERVER_SNAPSHOT);
}
