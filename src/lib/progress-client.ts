"use client";

import type { AnswerMap, MistakeDetail } from "@/lib/lessons/scoring";

const PENDING_KEY = "rusofasil:pending-progress";

interface PendingProgress {
  level: string;
  lesson: string;
  score: number;
  passed: boolean;
  mistakes: MistakeDetail[];
  answers: AnswerMap;
}

function readQueue(): PendingProgress[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as PendingProgress[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingProgress[]) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(queue));
  } catch {
    // Private browsing / storage disabled — the attempt just won't retry
    // automatically; it's still unlocked locally for this session.
  }
}

/** Called when a POST to /api/progress fails (offline, or a transient
 * server error) — queues the attempt for a background retry instead of
 * losing it outright. Keeps only the latest queued attempt per lesson
 * (a newer check supersedes an older unsent one), matching the server's
 * own upsert-latest-wins semantics. */
export function queuePendingProgress(payload: PendingProgress) {
  const queue = readQueue().filter(
    (p) => !(p.level === payload.level && p.lesson === payload.lesson),
  );
  queue.push(payload);
  writeQueue(queue);
}

let flushing = false;

/** Retries every queued attempt — call on mount and on the browser's
 * `online` event. Safe to call redundantly (e.g. from several mounted
 * ExercisesTab instances): a second concurrent call is a no-op via the
 * `flushing` guard, and an empty queue returns immediately. */
export async function flushPendingProgress() {
  if (flushing) return;
  flushing = true;
  try {
    const queue = readQueue();
    if (queue.length === 0) return;
    const remaining: PendingProgress[] = [];
    for (const payload of queue) {
      try {
        const res = await fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) remaining.push(payload);
      } catch {
        remaining.push(payload);
      }
    }
    writeQueue(remaining);
  } finally {
    flushing = false;
  }
}
