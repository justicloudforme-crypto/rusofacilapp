import type { CSSProperties } from "react";

export type SkeletonVariant = "text" | "circle" | "rect";

const VARIANT_DEFAULTS: Record<SkeletonVariant, string> = {
  text: "h-4 w-full rounded-md",
  circle: "h-10 w-10 rounded-full",
  rect: "h-24 w-full rounded-xl",
};

/**
 * Loading placeholder. AUDIT.md found no loading state at all on /profile,
 * /vocabulary, /stories, or /pricing — this is the shared piece for filling
 * that gap. motion-reduce:animate-none respects the OS reduce-motion
 * setting (the pulse is decorative, not information-bearing).
 *
 * ====================================================================
 * ДОЛГ 212: `height` — СВОЙ РАЗМЕР, НЕ ЗАВИСЯЩИЙ ОТ ТАБЛИЦЫ СТИЛЕЙ
 * ====================================================================
 *
 * Строка долга дословно: «„Mi perfil“ около секунды показывает только
 * подвал и нижнюю панель, и середина при этом занимает РОВНО 0 px —
 * заглушка есть в разметке, но невидима без таблицы стилей […] все 17
 * блоков заглушки `profile/loading.tsx` — пустые `<div>`, у которых
 * высота берётся ТОЛЬКО из классов Tailwind; вторая таблица стилей
 * приходит на 4260 мс, то есть через 3645 мс после подвала, и до неё
 * каждый блок занимает 0 px, тогда как у подвала есть свой текст. То
 * есть дефект не в порядке потока, а в том, что заглушка не имеет
 * собственного размера → дать блокам заглушки внутренний размер, не
 * зависящий от внешней таблицы стилей (инлайновый `style` на высоту)».
 *
 * `height` — это ЧИСЛО ПИКСЕЛЕЙ, уезжающее в инлайновый `style`. Инлайн
 * живёт в самом документе и приезжает с первым же байтом разметки, тогда
 * как класс Tailwind ждёт вторую таблицу стилей.
 *
 * ПОЧЕМУ ЭТО ПРИЗНАК, А НЕ УМОЛЧАНИЕ. Инлайновый стиль СИЛЬНЕЕ класса, и
 * он сильнее его всегда, а не только до загрузки стилей. Умолчание,
 * взятое из варианта, молча перебило бы `h-64`, `h-48`, `h-14` и
 * остальные высоты у 14 живых вызовов в карточках и упражнениях. Поэтому
 * высоту называет тот, кто её знает, и называет ДВАЖДЫ — классом и
 * числом; что эти двое не разошлись, проверяет `check:skeleton-height`.
 */
export default function Skeleton({
  variant = "text",
  className = "",
  height,
  style,
}: {
  variant?: SkeletonVariant;
  className?: string;
  /** Высота в пикселях для ИНЛАЙНОВОГО стиля — видна ДО таблицы стилей (долг 212). */
  height?: number;
  style?: CSSProperties;
}) {
  const intrinsic: CSSProperties | undefined =
    height === undefined && style === undefined ? undefined : { ...(height === undefined ? {} : { height }), ...style };
  return (
    <div
      aria-hidden
      className={`motion-reduce:animate-none animate-pulse bg-neutral-200 dark:bg-neutral-700/50 ${VARIANT_DEFAULTS[variant]} ${className}`}
      style={intrinsic}
    />
  );
}
