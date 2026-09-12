import type { Locale } from "@/i18n/config";
import type { NativePricingDict } from "@/components/pricing/NativePricingPanel";

/**
 * Тексты нативной витрины покупки — ОТДЕЛЬНО от `src/dictionaries/*.json`,
 * и это не вкусовщина, а замер.
 *
 * Первая редакция клала их в общий словарь, под ключ `pricing.native`.
 * Побайтовое сличение `/es/pricing` до и после показало, что веб-отдача
 * выросла на 1 660 знаков — при том, что на вебе эти строки не читает
 * никто. Причина в корневом макете: `Navbar`, `Footer` и `BottomNav` —
 * клиентские компоненты и получают `dict={dict}` ЦЕЛИКОМ, поэтому весь
 * словарь уезжает в flight-разметку КАЖДОЙ страницы. То же самое замечено
 * в 7.180 про пропсы `PaywallProvider`. Цена любой новой строки в словаре
 * — её вес, умноженный на 1913 адресов карты сайта.
 *
 * Здесь же строки живут в серверном модуле, который импортирует ровно
 * одна ветка одной страницы, и на веб-отдачу не влияют ни одним знаком:
 * расхождение HTML до и после правки — 0.
 */
const COPY: Record<Locale, NativePricingDict> = {
  es: {
    heading: "Planes y precios",
    subtitle:
      "Dentro de la aplicación la compra se hace a través de la tienda, con tu cuenta de App Store o Google Play.",
    loading: "Cargando los planes de la tienda…",
    emptyHeading: "Todavía no hay planes disponibles",
    emptyBody:
      "La tienda aún no devuelve ningún producto para esta aplicación. No es un error tuyo y no hace falta hacer nada: vuelve a abrir esta pantalla más adelante. Mientras tanto puedes seguir usando la parte gratuita del curso.",
    errorHeading: "No pudimos conectar con la tienda",
    errorBody:
      "Revisa tu conexión e inténtalo de nuevo. Si el problema sigue, cierra y vuelve a abrir la aplicación.",
    retry: "Reintentar",
    buyCta: "Comprar",
    restoreButton: "Restaurar compras",
    restoreNothing:
      "Listo. Si tenías una compra anterior con esta cuenta de la tienda, ya está aplicada.",
    activeHeading: "Tu acceso está activo",
    activeBody:
      "Compraste el acceso en esta aplicación. Puedes ver el estado, cambiar o cancelar la suscripción desde la tienda.",
    manageButton: "Gestionar suscripción",
    elsewhereHeading: "Ya tienes acceso completo",
    elsewhereBody:
      "Tu cuenta ya tiene el acceso activo y no se compró en esta aplicación, así que aquí no hay nada que pagar de nuevo. Esa suscripción se gestiona en el mismo sitio donde la contrataste.",
    storeNote:
      "Las suscripciones se renuevan solas hasta que las canceles, y se gestionan en los ajustes de tu cuenta de la tienda. El precio exacto lo muestra la tienda en tu moneda.",
  },
  ru: {
    heading: "Тарифы",
    subtitle:
      "Внутри приложения покупка идёт через магазин — по вашей учётной записи App Store или Google Play.",
    loading: "Загружаем тарифы из магазина…",
    emptyHeading: "Тарифов пока нет",
    emptyBody:
      "Магазин пока не отдаёт ни одного продукта для этого приложения. Это не ошибка с вашей стороны, и делать ничего не нужно: загляните на этот экран позже. Бесплатная часть курса работает как обычно.",
    errorHeading: "Не удалось связаться с магазином",
    errorBody:
      "Проверьте связь и попробуйте ещё раз. Если не помогло — закройте и снова откройте приложение.",
    retry: "Повторить",
    buyCta: "Купить",
    restoreButton: "Восстановить покупки",
    restoreNothing:
      "Готово. Если на этой учётной записи магазина была покупка, она уже применена.",
    activeHeading: "Доступ активен",
    activeBody:
      "Доступ куплен в этом приложении. Посмотреть состояние, сменить или отменить подписку можно в магазине.",
    manageButton: "Управлять подпиской",
    elsewhereHeading: "Полный доступ уже есть",
    elsewhereBody:
      "У вашей учётной записи доступ уже активен, и куплен он не в этом приложении — платить здесь второй раз не за что. Этой подпиской управляют там, где её оформили.",
    storeNote:
      "Подписки продлеваются сами, пока их не отменят, и управляются в настройках вашей учётной записи магазина. Точную цену в вашей валюте показывает сам магазин.",
  },
};

export function nativePricingCopy(lang: Locale): NativePricingDict {
  return COPY[lang];
}
