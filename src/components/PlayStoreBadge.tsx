import Image from "next/image";
import type { Locale } from "@/i18n/config";
import { PLAY_STORE_URL } from "@/lib/pwa-manifest";

/**
 * ССЫЛКА НА ПРИЛОЖЕНИЕ В GOOGLE PLAY — ТОЛЬКО В БРАУЗЕРЕ (заход 7.258).
 *
 * Приложение «RusoFácil: aprender ruso» опубликовано в Google Play
 * 07.10.2026. Бейдж стоит на главной, на странице цен и в подвале, в обеих
 * локалях, и ещё на `/download`, куда ведёт «Descargar la app» подвала.
 *
 * ВНУТРИ ПРИЛОЖЕНИЯ ЕГО НЕТ, и решает это СЕРВЕР: признак приходит из
 * `isNativeShellRequest()` (токен User-Agent или кука-метка, долг 179), и
 * компонент возвращает `null` до разметки — в ответе приложению нет ни
 * ссылки, ни адреса магазина, ни подписи, а не «спрятано после гидрации».
 * Человеку, который уже в приложении, предлагать установить приложение —
 * неправда (тот же довод, что у подвала и `/download`, долг 154).
 *
 * Бейдж — официальный, с партнёрской страницы Google
 * (`play.google.com/intl/en_us/badges/…/{es-419,ru}_badge_web_generic.png`),
 * без правок; подпись `alt` повторяет надпись на нём. Рядом с бейджем в
 * подвале стоит строка о товарных знаках Google — её просят правила
 * использования бейджа. Про iPhone здесь не сказано ничего: обещания,
 * которого нет, бейдж не даёт.
 *
 * Сторож — `check:play-link` (статическая половина и живая на сервере
 * `verify-rendered`: бейдж есть в браузере на трёх местах в обеих
 * локалях и отсутствует в отдаче приложения).
 */

export type PlayBadgePlacement = "home" | "pricing" | "footer" | "download";

const COPY: Record<Locale, { alt: string; home: string; pricing: string; trademark: string }> = {
  es: {
    alt: "Descargar en Google Play",
    home: "La app para Android ya está en Google Play.",
    pricing: "¿Estudias en el celular? La app para Android está en Google Play.",
    trademark: "Google Play y el logotipo de Google Play son marcas comerciales de Google LLC.",
  },
  ru: {
    alt: "Скачать из Google Play",
    home: "Приложение для Android уже в Google Play.",
    pricing: "Занимаетесь с телефона? Приложение для Android есть в Google Play.",
    trademark: "Google Play и логотип Google Play — товарные знаки Google LLC.",
  },
};

/** Подпись о товарных знаках — для подвала, рядом с бейджем. */
export function playTrademarkNote(lang: Locale): string {
  return COPY[lang].trademark;
}

export default function PlayStoreBadge({
  lang,
  nativeShell,
  placement,
}: {
  lang: Locale;
  /** С сервера: `isNativeShellRequest()`. В приложении — ничего. */
  nativeShell: boolean;
  placement: PlayBadgePlacement;
}) {
  if (nativeShell) return null;
  const copy = COPY[lang];
  // Высота 44 px в подвале (меньше нельзя: цель касания проекта — 44×44,
  // CLAUDE.md), 48 px на страницах. Ширина — из пропорции файла 646×250.
  const size = placement === "footer" ? "h-11 w-auto" : "h-12 w-auto";
  const badge = (
    <a
      href={PLAY_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-rf-play-link={placement}
      className="tap inline-block shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <Image
        src={`/badges/google-play-${lang}.png`}
        alt={copy.alt}
        width={646}
        height={250}
        className={size}
      />
    </a>
  );
  // Подвал и `/download` — бейдж без подписи: в подвале места нет, на
  // `/download` то же самое уже сказано заголовком и подзаголовком.
  if (placement === "footer" || placement === "download") return badge;
  // На главной — по левому краю, как текст героя; в ценах — по центру,
  // как подпись способов оплаты над ним.
  const align = placement === "pricing" ? "items-center text-center" : "items-start";
  return (
    <div className={`flex flex-col gap-2 ${align}`}>
      {badge}
      <p className="text-sm text-foreground/60">{copy[placement]}</p>
    </div>
  );
}
