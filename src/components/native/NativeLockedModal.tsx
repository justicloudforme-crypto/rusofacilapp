"use client";

import Modal from "@/components/ui/Modal";
import type { NativeAccessCopy } from "@/lib/native-access-copy";

/**
 * Что открывается ВНУТРИ ПРИЛОЖЕНИЯ по тапу на закрытый материал вместо
 * пейвола (долг 179, часть 2 захода 7.192).
 *
 * Что было до. Тап по закрытому рассказу звал `openPaywall()`, тот внутри
 * оболочки звал витрину RevenueCat, а она отвечала `false` НЕ ДОХОДЯ до
 * магазина: `presentPaywall()` начинается с `if (!configured) return false`,
 * а `configured` остаётся false, потому что ключ RevenueCat в боевой сборке
 * пуст (замер 7.192: в чанке прода стоит `s.env.NEXT_PUBLIC_REVENUECAT_
 * ANDROID_API_KEY`, то есть значение на сборке не подставилось вовсе).
 * Наружу это выглядело так, как и описал владелец: кнопка не срабатывает
 * никак. Нерабочая кнопка — дефект сама по себе.
 *
 * Что стало. Замок, объяснение, одна кнопка «понятно», которая закрывает
 * окно. Ни цены, ни способа оплаты, ни ссылки наружу.
 */
export default function NativeLockedModal({
  open,
  onClose,
  copy,
}: {
  open: boolean;
  onClose: () => void;
  copy: NativeAccessCopy["lock"];
}) {
  return (
    <Modal open={open} onClose={onClose} title={copy.heading} closeLabel={copy.close}>
      {/* Заголовок рисует сама рама по пропсу `title` — второй такой же
          здесь стоял до первого прогона e2e и давал в диалоге ДВА
          одинаковых заголовка. */}
      <div className="px-5 pb-6 pt-2 sm:px-6">
        <p className="text-sm leading-6 text-foreground/70">{copy.body}</p>
        <button
          type="button"
          onClick={onClose}
          className="tap mt-6 w-full rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85"
        >
          {copy.close}
        </button>
      </div>
    </Modal>
  );
}
