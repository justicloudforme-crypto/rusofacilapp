"use client";

import { useEffect } from "react";
import { PAGE_OWNER_KEY, ownerChangePurge } from "@/lib/signed-out";
import { readLocal, writeLocal } from "@/lib/safe-storage";

/**
 * УБОРЩИК КОПИЙ ПРИ СМЕНЕ ВЛАДЕЛЬЦА — Ж.4 (аудит 7.241; заход 7.243).
 *
 * Правило и его границы — `ownerChangePurge` в `src/lib/signed-out.ts`.
 * Здесь только момент: каждая загрузка сравнивает владельца, которого
 * назвал сервер, с прошлым. Так ловится любой путь смены — форма входа,
 * регистрация, вход поверх чужой сессии, — а не один маршрут.
 */
export default function OwnerChangeCachePurge({ owner }: { owner: string }) {
  useEffect(() => {
    const previous = readLocal(PAGE_OWNER_KEY);
    writeLocal(PAGE_OWNER_KEY, owner);
    if (typeof caches === "undefined") return;
    void (async () => {
      try {
        const names = ownerChangePurge(await caches.keys(), previous, owner);
        await Promise.all(names.map((name) => caches.delete(name)));
      } catch {
        // Хранилище кешей недоступно — чистить нечего и ронять нечего.
      }
    })();
  }, [owner]);

  return null;
}
