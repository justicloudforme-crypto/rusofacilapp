import { ACCESS_MARK_ICON, type AccessRequirement } from "@/lib/access-marks";

/**
 * Единственная разметка значка платности на сайте.
 *
 * До 07.09.2026 их было три и они не соглашались друг с другом: «⭐
 * Premium» по колонке `Story.isPremium` (то есть у 225 рассказов, которым
 * никакого Premium не нужно), «👑 Solo Premium» рядом с ним у 98 других,
 * «🔒 Con suscripción» у медиа — и корона на плитках филвордов, которой
 * не было у 479 платных пазлов из 984. Здесь глиф, цвет и правило показа
 * написаны один раз, а ЧТО рисовать, решает `accessMarkFor` в
 * `src/lib/access-marks.ts`.
 *
 * `<span>`, не `<button>`/`<a>`: значок сообщает, а не действует — то же
 * ограничение, что у `PremiumBadge`, и его же сторожит `check:tokens`.
 *
 * `data-access-mark` — 7.195, часть 4. Значок часто стоит ВНУТРИ ссылки
 * или кнопки (карточка рассказа, плитка филворда, строка поиска), и его
 * текст попадал в подпись органа управления: «👑 Solo Premium» внутри
 * ссылки читалось прибором как платное слово на органе. Атрибут отделяет
 * метку от органа, и по нему `check-rendered-purchase-surfaces` вычитает
 * текст метки из подписи. Метка при этом остаётся полностью видимой
 * человеку — правится прибор, а не экран.
 */
export default function AccessMark({
  mark,
  label,
  className = "",
}: {
  mark: Exclude<AccessRequirement, "free">;
  /** Готовая строка из словаря. Текст здесь не собирается — он локаль-зависим. */
  label: string;
  className?: string;
}) {
  const tone =
    mark === "premium-tier"
      ? "bg-premium-500/15 text-premium-700 dark:text-premium-300"
      : "bg-foreground/10 text-foreground/70";
  return (
    <span
      data-access-mark={mark}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${tone} ${className}`}
      title={label}
    >
      <span aria-hidden>{ACCESS_MARK_ICON[mark]}</span>
      {label}
    </span>
  );
}
