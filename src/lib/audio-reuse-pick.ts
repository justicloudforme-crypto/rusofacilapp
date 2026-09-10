/**
 * Чистая половина `audio-reuse.ts`: из прочитанных строк `AudioAsset`
 * выбрать по одному клипу на текст. Вынесена отдельно, чтобы ОДНО И ТО ЖЕ
 * правило работало и в продукте (серверный `clipsByText`, который умеет
 * ходить в базу), и в стороже `scripts/check-listen-buttons.ts`, который
 * `server-only`-модули импортировать не может. Иначе у сторожа была бы
 * своя копия правила — ровно тот класс, из-за которого завёлся долг 104.
 */
export interface ReusableClipRow {
  contentType: string;
  contentId: string;
  itemKey: string;
  text: string;
  audioUrl: string;
}

/**
 * Строки обязаны быть УЖЕ отфильтрованы от рассказов (`contentType !==
 * "story"`): те озвучены кастом из пяти голосов, и совпадение по тексту
 * уронило бы женский голос в урок. Порядок выбора детерминирован: клип
 * `preferContentId` главнее, иначе — первая строка в порядке
 * `contentType, contentId, itemKey`.
 */
export function pickReusableClips(
  rows: readonly ReusableClipRow[],
  preferContentId?: string,
): Record<string, string> {
  const sorted = [...rows].sort(
    (a, b) =>
      a.contentType.localeCompare(b.contentType) ||
      a.contentId.localeCompare(b.contentId) ||
      a.itemKey.localeCompare(b.itemKey),
  );
  const chosen = new Map<string, { url: string; preferred: boolean }>();
  for (const row of sorted) {
    if (row.contentType === "story") continue;
    const preferred = preferContentId !== undefined && row.contentId === preferContentId;
    const current = chosen.get(row.text);
    if (!current || (preferred && !current.preferred)) {
      chosen.set(row.text, { url: row.audioUrl, preferred });
    }
  }
  const out: Record<string, string> = {};
  for (const [text, { url }] of chosen) out[text] = url;
  return out;
}
