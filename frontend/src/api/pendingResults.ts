import type { TypingResult } from "../features/typing/types";
import {
  isTypingResult,
  migrateUnversionedTypingResult,
} from "../features/typing/storage";
import { isRetryableApiError } from "./client";

interface PendingStore {
  version: 2;
  entries: PendingEntry[];
}

interface PendingEntry {
  ownerId: string;
  result: TypingResult;
}

const KEY = "rill.pending-account-results.v2";
const LEGACY_KEY = "rill.pending-account-results.v1";
const MAX_PENDING = 20;
const MAX_TOTAL_PENDING = 100;
export const PENDING_RESULTS_CHANGED_EVENT = "rill:pending-results-changed";
export type QueueOutcome = "queued" | "duplicate" | "full" | "unavailable";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePendingEntry(value: unknown): PendingEntry | null {
  if (!isRecord(value) || typeof value.ownerId !== "string") {
    return null;
  }
  const result = migrateUnversionedTypingResult(value.result);
  return isTypingResult(result)
    ? { ownerId: value.ownerId, result }
    : null;
}

function read(): PendingStore {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null") as unknown;
    if (
      isRecord(parsed) &&
      parsed.version === 2 &&
      Array.isArray(parsed.entries)
    ) {
      return {
        version: 2,
        entries: (parsed.entries as unknown[])
          .map(normalizePendingEntry)
          .filter((entry): entry is PendingEntry => entry !== null),
      };
    }
  } catch {
    // Corrupt or unavailable storage is treated as an empty queue.
  }
  return { version: 2, entries: [] };
}

function write(store: PendingStore): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
    window.dispatchEvent(new Event(PENDING_RESULTS_CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function loadPendingAccountResults(ownerId: string): TypingResult[] {
  return read().entries
    .filter((entry) => entry.ownerId === ownerId)
    .map((entry) => entry.result);
}

export function hasLegacyPendingAccountResults(ownerId: string): boolean {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(LEGACY_KEY) ?? "null",
    ) as unknown;
    return (
      isRecord(parsed) &&
      parsed.version === 1 &&
      Array.isArray(parsed.entries) &&
      parsed.entries.some(
        (entry) =>
          isRecord(entry) &&
          entry.ownerId === ownerId &&
          isRecord(entry.result),
      )
    );
  } catch {
    return false;
  }
}

export function queueAccountResult(
  ownerId: string,
  result: TypingResult,
): QueueOutcome {
  const store = read();
  if (
    store.entries.some(
      (entry) =>
        entry.ownerId === ownerId &&
        entry.result.clientResultId === result.clientResultId,
    )
  ) {
    return "duplicate";
  }
  const ownerEntries = store.entries.filter((entry) => entry.ownerId === ownerId);
  const otherEntries = store.entries.filter((entry) => entry.ownerId !== ownerId);
  if (
    ownerEntries.length >= MAX_PENDING ||
    store.entries.length >= MAX_TOTAL_PENDING
  ) {
    return "full";
  }
  return write({
    version: 2,
    entries: [{ ownerId, result }, ...ownerEntries, ...otherEntries],
  })
    ? "queued"
    : "unavailable";
}

export async function flushAccountResults(
  ownerId: string,
  save: (result: TypingResult) => Promise<unknown>,
): Promise<{ saved: number; discarded: number }> {
  const store = read();
  const matching = store.entries
    .filter((entry) => entry.ownerId === ownerId)
    .reverse();
  let saved = 0;
  let discarded = 0;
  for (const entry of matching) {
    try {
      await save(entry.result);
      store.entries = store.entries.filter(
        (candidate) =>
          !(
            candidate.ownerId === ownerId &&
            candidate.result.clientResultId === entry.result.clientResultId
          ),
      );
      saved += 1;
    } catch (error) {
      if (isRetryableApiError(error)) {
        break;
      }
      store.entries = store.entries.filter(
        (candidate) =>
          !(
            candidate.ownerId === ownerId &&
            candidate.result.clientResultId === entry.result.clientResultId
          ),
      );
      discarded += 1;
    }
  }
  write(store);
  return { saved, discarded };
}
