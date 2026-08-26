"use client";

import { useEffect, useState } from "react";

// AUDIT.md §8 "Дата регистрации на день вперёд (таймзона)": the server
// runtime (Vercel/Node) formats in UTC, so a visitor who registered late
// in the evening in their own timezone can see a date already rolled over
// to the next UTC day. There's no per-user timezone stored to pass a fixed
// `timeZone` to Intl.DateTimeFormat server-side, so this renders the same
// UTC-formatted date the server did first (no hydration mismatch), then
// swaps to the browser's own local-timezone formatting once mounted — the
// same "safe value, then replace after mount" pattern WelcomeOverlay uses.
export default function LocalDate({ iso, locale }: { iso: string; locale: string }) {
  const utcFormatted = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(iso),
  );
  const [formatted, setFormatted] = useState(utcFormatted);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormatted(new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(iso)));
  }, [iso, locale]);

  return <>{formatted}</>;
}
