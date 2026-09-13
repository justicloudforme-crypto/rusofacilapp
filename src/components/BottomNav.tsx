"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { hapticTap } from "@/lib/haptics";
import { useHideOnScroll } from "@/lib/useHideOnScroll";
import { usePinnedLayer, useKeyboardOpen } from "@/lib/usePinnedLayer";
import { BookIcon, GraduationCapIcon, DictionaryIcon, PuzzleIcon, PersonalIcon } from "@/components/profile/ProfileIcons";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

/**
 * Persistent 5-item bottom bar for a LOGGED-IN mobile user only — a
 * logged-out visitor's job on this app is to register, and a tab bar
 * competing with that CTA works against it (see the header/mobile-nav
 * plan). Renders nothing at all when logged out; MobileMenu.tsx's drawer
 * (opened via the header hamburger) is the only mobile nav in that case.
 *
 * Items are Рассказы/Курсы/Слова/Игры/Профиль, not Главная — a returning
 * logged-in user has no use for the marketing landing page: the logo in
 * the header still goes there. Deliberately NOT a replacement for
 * MobileMenu.tsx: this covers only the highest-traffic routes, everything
 * else (Аудио и видео, Цены, Группы, the rest of the profile tabs) stays
 * in the drawer, opened via the header avatar.
 */
export default function BottomNav({
  lang,
  dict,
  isLoggedIn,
}: {
  lang: Locale;
  dict: Dictionary;
  isLoggedIn: boolean;
}) {
  const pathname = usePathname();
  const hiddenByScroll = useHideOnScroll();
  /**
   * Поднятая клавиатура снимает панель — долг 161.
   *
   * Замерено с живого телефона владельца 13.09.2026 на
   * `/ru/word-games/CROSSWORD/A1/1`: при открытой клавиатуре видимая
   * часть окна `visualViewport.height = 569` CSS-px (без клавиатуры у
   * этого телефона около 904), и панель занимает в ней полосу 517..569 —
   * НИЖНИЕ 52 пикселя единственной видимой области. Строка определения,
   * которую человек в этот момент читает, оказывается под ней.
   *
   * Отступ в конце документа этого не лечит по построению: он ждёт
   * строку на самом низу, а клавиатура поднимает её в середину. Прячется
   * панель и сама — при прокрутке (`useHideOnScroll`), — но во время
   * набора человек не прокручивает, и то лекарство в этом сценарии не
   * срабатывает никогда.
   *
   * Пока клавиатура поднята, панель ещё и СНИМАЕТСЯ С УЧЁТА (`active`
   * ниже): её полоса не должна ни резервировать место в конце
   * документа, ни сужать свободное место для карточек и доводок.
   */
  const keyboardOpen = useKeyboardOpen();
  const hidden = hiddenByScroll || keyboardOpen;
  const pinnedRef = usePinnedLayer<HTMLElement>({
    edge: "bottom",
    // Единственный слой продукта, который РЕЗЕРВИРУЕТ место: он на
    // экране постоянно, остальные четыре приходят и уходят.
    reserve: true,
    label: "BottomNav",
    active: isLoggedIn && !keyboardOpen,
  });

  if (!isLoggedIn) return null;

  const items = [
    { href: `/${lang}/stories`, label: dict.nav.stories, icon: BookIcon },
    { href: `/${lang}/courses`, label: dict.nav.courses, icon: GraduationCapIcon },
    { href: `/${lang}/vocabulary`, label: dict.nav.vocabulary, icon: DictionaryIcon },
    { href: `/${lang}/word-games`, label: dict.nav.wordGames, icon: PuzzleIcon },
    { href: `/${lang}/profile`, label: dict.nav.profile, icon: PersonalIcon },
  ];

  return (
    <nav
      ref={pinnedRef}
      aria-label={dict.nav.bottomNavLabel}
      // No backdrop-blur: a `fixed` blurred bar forces the Android WebView
      // compositor to repaint the blur region on every frame of whatever
      // scrolls under it — a real device report found this made every tap
      // here feel laggy. bg-background alone (no /opacity) is already
      // fully opaque, so nothing needs blurring behind it.
      //
      // translate-y toggle is skipped entirely (useHideOnScroll always
      // returns false) when the OS prefers-reduced-motion — see that
      // hook's own comment.
      className={`pb-safe fixed inset-x-0 bottom-0 z-40 flex border-t border-black/10 bg-background transition-transform duration-200 sm:hidden dark:border-white/30 ${
        hidden ? "translate-y-full" : "translate-y-0"
      }`}
    >
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => hapticTap()}
            aria-current={active}
            className={`tap flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.65rem] font-medium transition-transform active:scale-95 ${
              active ? "text-primary-text" : "text-foreground/55 hover:text-foreground/80"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="leading-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
