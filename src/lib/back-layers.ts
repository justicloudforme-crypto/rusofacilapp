/**
 * УЧЁТ ОТКРЫТЫХ СЛОЁВ ДЛЯ КНОПКИ «НАЗАД» ANDROID — заход 7.242, долг 347
 * (аудит 7.241, Р6).
 *
 * Что было. `NativeBackButtonHandler` на «Назад» делал ровно две вещи:
 * `history.back()`, если есть куда, иначе выход из приложения. Про
 * открытые листы и меню он не знал ничего. Замер 7.241 на эмуляторе:
 * меню «≡» на первой странице → «Назад» закрывает ВСЁ приложение
 * (`topResumedActivity` — лаунчер); лист «Este material está cerrado» →
 * «Назад» уводит на прошлую страницу, а лист остаётся висеть поверх неё
 * (портал в `document.body` переживает смену страницы). Любая система
 * Android ведёт себя иначе: «Назад» сначала закрывает то, что открыто.
 *
 * Как устроено. Открытый слой встаёт на учёт сам, одним вызовом в себе
 * (`useBackLayer`, тот же приём, что у `pinned-layers.ts`), и снимается,
 * когда закрылся. «Назад» закрывает ВЕРХНИЙ слой (последний вставший) и
 * на этом останавливается; только когда слоёв нет — идёт по истории.
 *
 * Модуль чистый, без React: его читают обработчик кнопки и тест.
 */
type Layer = { id: number; close: () => void };

const stack: Layer[] = [];
let nextId = 1;

/** Поставить слой на учёт. Возвращает снятие — звать при закрытии. */
export function pushBackLayer(close: () => void): () => void {
  const id = nextId++;
  stack.push({ id, close });
  return () => {
    const i = stack.findIndex((layer) => layer.id === id);
    if (i >= 0) stack.splice(i, 1);
  };
}

/** Закрыть верхний слой. `true` — слой был, и «Назад» на этом кончается. */
export function closeTopBackLayer(): boolean {
  const top = stack.pop();
  if (!top) return false;
  top.close();
  return true;
}

export function openBackLayerCount(): number {
  return stack.length;
}
