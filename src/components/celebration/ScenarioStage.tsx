"use client";

import dynamic from "next/dynamic";
import { useMemo, type ComponentType } from "react";
import { SCENARIOS, type ScenarioId } from "./catalog";

// Each catalog entry's next/dynamic wrapper is built at most once and
// cached here (module-scope, survives across every CelebrationModal
// open/close) — next/dynamic must be called at a stable identity, not
// fresh on every render, or React treats it as a brand-new component type
// and remounts/reloads it every time. Caching by id also means a scenario
// the student has already seen this session renders instantly on repeat
// (already-fetched chunk), while one they haven't yet costs one small
// on-demand request the first time it's picked — never anything upfront.
const componentCache = new Map<ScenarioId, ComponentType>();

function getScenarioComponent(id: ScenarioId): ComponentType {
  const cached = componentCache.get(id);
  if (cached) return cached;

  const entry = SCENARIOS.find((s) => s.id === id);
  if (!entry) {
    throw new Error(`Unknown celebration scenario id: ${id}`);
  }
  // ssr:false is fine here — ScenarioStage only ever renders once
  // CelebrationModal's `open` is true, i.e. after a client interaction,
  // so there's nothing for the server to have pre-rendered anyway.
  const Component = dynamic(entry.load, { ssr: false });
  componentCache.set(id, Component);
  return Component;
}

/** Renders whichever catalog scenario `id` names, loading its chunk on
 * demand the first time that particular scenario is picked. This is the
 * only place that ever touches the catalog's `load()` functions — adding
 * a new scenario to catalog/index.ts needs no change here. */
export default function ScenarioStage({ id }: { id: ScenarioId }) {
  // useMemo (not a bare call) so the lint rule against creating components
  // during render can see this is stable across re-renders — the actual
  // stability comes from componentCache above, which also makes this cheap
  // even without the memo (same id always returns the same reference).
  const Scenario = useMemo(() => getScenarioComponent(id), [id]);
  // This is the standard "dynamic component registry" pattern (the same
  // one icon libraries use for `<Icon name="..." />`) — componentCache
  // above guarantees the same `id` always returns the exact same component
  // reference, so nothing is actually created fresh per render; the lint
  // rule can't see through the cache to verify that itself.
  // eslint-disable-next-line react-hooks/static-components
  return <Scenario />;
}
