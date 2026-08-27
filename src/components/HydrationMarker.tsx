"use client";

import { useEffect } from "react";

/**
 * Removes `data-hydrating` from `<html>` (set server-side in
 * [lang]/layout.tsx) the moment this mounts. A plain useEffect only fires
 * once React has finished hydrating the whole tree and attaching real
 * event listeners everywhere — so this one flip, done in exactly one
 * place, is a true "the whole page is interactive now" signal, not a
 * per-component guess.
 *
 * Pairs with the `html[data-hydrating] button...` rules in globals.css:
 * on a slow connection, the server HTML paints a fully-styled page
 * seconds before the JS that makes onClick handlers work has finished
 * loading — a tap on a plain button in that window silently did nothing
 * (confirmed 2026-08-27 with an automated slow-network test; even the
 * header search icon didn't respond to the first several taps). Rather
 * than gate every such button individually, this dims/disables them all
 * globally via CSS attribute selectors until this fires — a real `<a
 * href>` or `type="submit"` button inside a `<form>` already degrades
 * gracefully without JS (native navigation/native form POST), so
 * globals.css only dims those, never disables them.
 */
export default function HydrationMarker() {
  useEffect(() => {
    document.documentElement.removeAttribute("data-hydrating");
  }, []);
  return null;
}
