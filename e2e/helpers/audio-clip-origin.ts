import type { BrowserContext } from "@playwright/test";
import { silentMp3 } from "./audio-clip-fixture";

/**
 * СВОЙ ИСТОЧНИК КЛИПОВ ВМЕСТО ЖИВОГО ИНТЕРНЕТА — ЗАХОД 7.221, ДОЛГ 297.
 *
 * ЧТО ПОДМЕНЯЕТСЯ И ЧТО НЕТ. Подменяются РОВНО БАЙТЫ: любой запрос за
 * файлом с расширением клипа отдаётся из памяти прогона. Не подменяется
 * ничего больше — ни адрес (он остаётся адресом ЧУЖОГО источника, и это
 * обязательное условие: дефект 7.218 — непрозрачный ответ `status 0` —
 * бывает только у чужого источника), ни заголовки, ни путь запроса через
 * воркер.
 *
 * ЗАГОЛОВКИ СНЯТЫ С БОЕВОГО ИСТОЧНИКА, замер 20.09.2026 записан в
 * `src/app/sw.ts`: простой GET отдаёт 206 и `access-control-allow-origin:
 * *`. Поэтому здесь `access-control-allow-origin: *` — без него запрос
 * воркера (он идёт `mode: "cors"`, см. `WHOLE_CLIP_WITH_CORS`) не прошёл
 * бы вовсе, и проба краснела бы по чужой причине.
 *
 * ОДИН ЗАГОЛОВОК БОЕВОГО ИСТОЧНИКА ЗДЕСЬ НЕ ПОВТОРЯЕТСЯ, И ЭТО ЗАМЕРЕНО, А
 * НЕ ПОДОБРАНО. Боевой источник отвечает `accept-ranges: bytes`. Если то же
 * ответить здесь, элемент `<audio>` в Chromium переходит на чтение файла
 * кусками — и на СОБРАННОМ здесь клипе спотыкается: прогон 21.09.2026,
 * четыре захода из четырёх, `error.code 2`
 * (`PipelineStatus::PIPELINE_ERROR_READ: FFmpegDemuxer: data source error`)
 * ровно на 1,7625 секунде. Тот же заголовок с НАСТОЯЩИМИ байтами боевого
 * файла — три захода из трёх зелёные; без него на собранном клипе — четыре
 * из четырёх зелёные. То есть спотыкается декодер о синтетические кадры при
 * чтении с середины, а не проба о воркер.
 *
 * Цена отказа от заголовка названа числом ниже позитивным контролем: если
 * вернуть в `src/app/sw.ts` правило до 7.218, проба КРАСНЕЕТ — значит она
 * по-прежнему меряет то, ради чего написана, а не форму заголовков.
 * Обработчик диапазонов ниже оставлен: браузер присылает `Range` и без
 * объявления, и отвечать на него надо честно.
 *
 * ПОЧЕМУ ЭТО НЕ ЛИШАЕТ ПРОБУ СМЫСЛА. Прежнее правило `statuses: [0, 200]`
 * вместе с отсутствием `WHOLE_CLIP_WITH_CORS` по-прежнему воспроизводится
 * здесь полностью: запрос без CORS к ЧУЖОМУ адресу даёт непрозрачный
 * ответ независимо от того, кто отдал байты, потому что непрозрачность
 * решает браузер по режиму запроса, а не источник по своей воле.
 */
export interface LocalClipOrigin {
  /** Адреса, за которыми сходили. Пусто → подмена не попала по адресу. */
  hits: string[];
  /** Сколько байт в клипе — для сверки с длиной тела в кеше. */
  byteLength: number;
}

/** Расширения клипов — те же, что знает `isAudioClipUrl` в `src/lib/sw-cache-policy.ts`. */
const CLIP_GLOBS = ["**/*.mp3", "**/*.wav", "**/*.ogg", "**/*.m4a"];

export async function serveClipLocally(context: BrowserContext): Promise<LocalClipOrigin> {
  const body = silentMp3();
  const origin: LocalClipOrigin = { hits: [], byteLength: body.byteLength };

  for (const glob of CLIP_GLOBS) {
    await context.route(glob, async (route) => {
      const request = route.request();
      origin.hits.push(request.url());

      // Предварительный запрос браузера: отвечаем так же, как боевой
      // источник отвечает на простой GET, и разрешаем ровно то, что
      // спросили. Настоящий источник на OPTIONS отдаёт 405 (замер
      // 20.09.2026), но туда браузер ходит только при НЕпростом запросе,
      // которого у нас нет — заголовки стенда проба снимает.
      if (request.method() === "OPTIONS") {
        await route.fulfill({
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, HEAD, OPTIONS",
            "access-control-allow-headers": "content-type, range",
          },
        });
        return;
      }

      const range = (await request.allHeaders()).range;
      const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
      if (match) {
        const start = match[1] === "" ? 0 : Number(match[1]);
        const end = match[2] === "" ? body.byteLength - 1 : Math.min(Number(match[2]), body.byteLength - 1);
        const slice = body.subarray(start, end + 1);
        await route.fulfill({
          status: 206,
          headers: {
            "content-type": "audio/mpeg",
            "content-length": String(slice.byteLength),
            "content-range": `bytes ${start}-${end}/${body.byteLength}`,
            "access-control-allow-origin": "*",
            "access-control-expose-headers": "content-range, content-length",
          },
          body: Buffer.from(slice),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        headers: {
          "content-type": "audio/mpeg",
          "content-length": String(body.byteLength),
          "access-control-allow-origin": "*",
          "access-control-expose-headers": "content-range, content-length",
        },
        body,
      });
    });
  }

  return origin;
}
