/**
 * Чтение, запись и уменьшение PNG без единой внешней библиотеки.
 *
 * ЗАЧЕМ ЭТОТ ФАЙЛ СУЩЕСТВУЕТ. Рядом уже лежит `png-rgba.mjs` — он умеет
 * ровно одно: дописать альфа-канал в снимок Chromium. Иконкам
 * приложения этого мало: их нужно РАСКОДИРОВАТЬ (чтобы сличить слои
 * пиксель в пиксель), УМЕНЬШИТЬ (24 файла Android от 36 до 432 px из
 * одного исходника 1024×1024) и СОБРАТЬ обратно — и в двух видах, с
 * альфой и без неё, потому что Apple прозрачности в иконке не принимает.
 *
 * Почему не `sharp` — причина та же, что записана в `png-rgba.mjs` и
 * подтверждена решением захода 7.190: `sharp` лежит в `node_modules`
 * ТОЛЬКО как транзитивная зависимость `next` и исчезнет на первом же
 * обновлении, которое её сменит. Скрипт, опирающийся на чужую
 * транзитивную зависимость, — это отложенная поломка.
 *
 * Почему не Chromium, хотя он тут есть. Сторож иконок обязан гоняться в
 * CI и пересчитывать эталон САМ. Снимок браузера для этого не годится:
 * растеризация зависит от версии Chromium и от платформы, и «эталон»
 * поехал бы на первом же обновлении Playwright. Всё, что ниже, —
 * целочисленная арифметика: один и тот же вход даёт один и тот же байт
 * на любой машине, и это то единственное свойство, ради которого модуль
 * написан руками.
 *
 * Поддерживается то, что реально встречается в иконках проекта: глубина
 * 8 бит, colorType 0/2/3/4/6, без чересстрочности. Всё остальное —
 * исключение, а не тихая порча файла.
 */
import zlib from "node:zlib";

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Заголовок PNG без раскодирования картинки — для переписи файлов. */
export function readHeader(png) {
  if (!png.subarray(0, 8).equals(SIG)) throw new Error("не PNG");
  const len = png.readUInt32BE(8);
  if (png.toString("latin1", 12, 16) !== "IHDR") throw new Error("IHDR не первым");
  const d = png.subarray(16, 16 + len);
  return {
    width: d.readUInt32BE(0),
    height: d.readUInt32BE(4),
    depth: d[8],
    colorType: d[9],
    interlace: d[12],
    bytes: png.length,
  };
}

/** PNG → {width, height, data} , где data — RGBA по 4 байта на пиксель. */
export function decode(png) {
  if (!png.subarray(0, 8).equals(SIG)) throw new Error("не PNG");
  let off = 8;
  let ihdr = null;
  let palette = null;
  let trns = null;
  const idat = [];
  while (off + 8 <= png.length) {
    const len = png.readUInt32BE(off);
    const type = png.toString("latin1", off + 4, off + 8);
    const data = png.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") ihdr = data;
    else if (type === "PLTE") palette = Buffer.from(data);
    else if (type === "tRNS") trns = Buffer.from(data);
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  if (!ihdr) throw new Error("нет IHDR");
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const depth = ihdr[8];
  const colorType = ihdr[9];
  const interlace = ihdr[12];
  if (depth !== 8 || interlace !== 0) {
    throw new Error(`ожидался 8-битный PNG без чересстрочности, получено depth=${depth} interlace=${interlace}`);
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`неизвестный colorType ${colorType}`);
  if (colorType === 3 && !palette) throw new Error("палитровый PNG без PLTE");

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  if (raw.length < height * (stride + 1)) throw new Error("IDAT короче, чем обещает IHDR");

  // Снятие фильтров строк — по месту, в один проход сверху вниз.
  const lines = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = y * stride;
    const up = (y - 1) * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? lines[cur + x - channels] : 0;
      const b = y > 0 ? lines[up + x] : 0;
      const c = y > 0 && x >= channels ? lines[up + x - channels] : 0;
      let v = src[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      else if (filter !== 0) throw new Error(`неизвестный фильтр строки ${filter}`);
      lines[cur + x] = v & 0xff;
    }
  }

  const data = Buffer.alloc(width * height * 4);
  for (let i = 0, n = width * height; i < n; i++) {
    const s = i * channels;
    const d = i * 4;
    if (colorType === 6) {
      data[d] = lines[s];
      data[d + 1] = lines[s + 1];
      data[d + 2] = lines[s + 2];
      data[d + 3] = lines[s + 3];
    } else if (colorType === 2) {
      data[d] = lines[s];
      data[d + 1] = lines[s + 1];
      data[d + 2] = lines[s + 2];
      data[d + 3] = 0xff;
    } else if (colorType === 0) {
      data[d] = data[d + 1] = data[d + 2] = lines[s];
      data[d + 3] = 0xff;
    } else if (colorType === 4) {
      data[d] = data[d + 1] = data[d + 2] = lines[s];
      data[d + 3] = lines[s + 1];
    } else {
      const idx = lines[s];
      data[d] = palette[idx * 3];
      data[d + 1] = palette[idx * 3 + 1];
      data[d + 2] = palette[idx * 3 + 2];
      data[d + 3] = trns && idx < trns.length ? trns[idx] : 0xff;
    }
  }
  return { width, height, data };
}

/**
 * RGBA → PNG. `alpha: false` пишет colorType 2 (24 бита без канала) —
 * этого требует Apple: иконка App Store с прозрачностью отвергается
 * проверкой пакета, а не замечанием ревьюера.
 *
 * Фильтр строки выбирается эвристикой «наименьшая сумма модулей» из
 * стандарта. Выбор целочисленный и от платформы не зависит, поэтому
 * один и тот же вход даёт один и тот же файл байт в байт — на этом
 * стоит сторож иконок.
 */
export function encode({ width, height, data }, { alpha = true } = {}) {
  const ch = alpha ? 4 : 3;
  const stride = width * ch;
  const line = Buffer.alloc(stride);
  const prev = Buffer.alloc(stride);
  const out = Buffer.alloc(height * (stride + 1));
  const cand = [Buffer.alloc(stride), Buffer.alloc(stride), Buffer.alloc(stride), Buffer.alloc(stride), Buffer.alloc(stride)];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4;
      const d = x * ch;
      line[d] = data[s];
      line[d + 1] = data[s + 1];
      line[d + 2] = data[s + 2];
      if (alpha) line[d + 3] = data[s + 3];
    }
    let best = 0;
    let bestSum = Infinity;
    for (let f = 0; f < 5; f++) {
      const buf = cand[f];
      let sum = 0;
      for (let x = 0; x < stride; x++) {
        const a = x >= ch ? line[x - ch] : 0;
        const b = prev[x];
        const c = x >= ch ? prev[x - ch] : 0;
        let v;
        if (f === 0) v = line[x];
        else if (f === 1) v = line[x] - a;
        else if (f === 2) v = line[x] - b;
        else if (f === 3) v = line[x] - ((a + b) >> 1);
        else v = line[x] - paeth(a, b, c);
        v &= 0xff;
        buf[x] = v;
        sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) {
        bestSum = sum;
        best = f;
      }
    }
    out[y * (stride + 1)] = best;
    cand[best].copy(out, y * (stride + 1) + 1);
    line.copy(prev);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = alpha ? 6 : 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    SIG,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(out, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Уменьшение усреднением площади (area / box): каждый пиксель итога —
 * среднее ровно той области исходника, которую он накрывает, с учётом
 * ДОЛЕЙ краевых пикселей. Для уменьшения в разы это и есть правильный
 * фильтр: он не роняет тонкие детали в щели между отсчётами, как это
 * делает выборка ближайшего, и не мылит, как повторное билинейное.
 *
 * Усреднение идёт по ПРЕДУМНОЖЕННОЙ альфе. Без этого прозрачные пиксели
 * (у которых цвет — мусор) тянули бы за собой цвет на границе знака, и
 * у матрёшки появилась бы кайма. Обратное деление делается один раз, в
 * конце, и только там, где альфа не ноль.
 */
export function resize(img, width, height) {
  const { width: sw, height: sh, data: src } = img;
  if (width > sw || height > sh) throw new Error("этот ресемплер только уменьшает");
  const out = Buffer.alloc(width * height * 4);
  const sx = sw / width;
  const sy = sh / height;

  for (let y = 0; y < height; y++) {
    const y0 = y * sy;
    const y1 = (y + 1) * sy;
    const iy0 = Math.floor(y0);
    const iy1 = Math.min(sh - 1, Math.ceil(y1) - 1);
    for (let x = 0; x < width; x++) {
      const x0 = x * sx;
      const x1 = (x + 1) * sx;
      const ix0 = Math.floor(x0);
      const ix1 = Math.min(sw - 1, Math.ceil(x1) - 1);
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let w = 0;
      for (let yy = iy0; yy <= iy1; yy++) {
        const fy = Math.min(yy + 1, y1) - Math.max(yy, y0);
        if (fy <= 0) continue;
        for (let xx = ix0; xx <= ix1; xx++) {
          const fx = Math.min(xx + 1, x1) - Math.max(xx, x0);
          if (fx <= 0) continue;
          const f = fx * fy;
          const s = (yy * sw + xx) * 4;
          const al = src[s + 3];
          r += src[s] * al * f;
          g += src[s + 1] * al * f;
          b += src[s + 2] * al * f;
          a += al * f;
          w += f;
        }
      }
      const d = (y * width + x) * 4;
      if (a > 0) {
        out[d] = Math.round(r / a);
        out[d + 1] = Math.round(g / a);
        out[d + 2] = Math.round(b / a);
      }
      out[d + 3] = Math.round(a / w);
    }
  }
  return { width, height, data: out };
}

/** Пустое полотно указанного цвета (по умолчанию полностью прозрачное). */
export function canvas(width, height, rgba = [0, 0, 0, 0]) {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = rgba[0];
    data[i * 4 + 1] = rgba[1];
    data[i * 4 + 2] = rgba[2];
    data[i * 4 + 3] = rgba[3];
  }
  return { width, height, data };
}

/** Кладёт `src` в `dst` в точку (x, y) обычным «source-over». */
export function composite(dst, src, x, y) {
  for (let sy = 0; sy < src.height; sy++) {
    const dy = y + sy;
    if (dy < 0 || dy >= dst.height) continue;
    for (let sx = 0; sx < src.width; sx++) {
      const dx = x + sx;
      if (dx < 0 || dx >= dst.width) continue;
      const s = (sy * src.width + sx) * 4;
      const d = (dy * dst.width + dx) * 4;
      const sa = src.data[s + 3] / 255;
      if (sa === 0) continue;
      const da = dst.data[d + 3] / 255;
      const oa = sa + da * (1 - sa);
      for (let k = 0; k < 3; k++) {
        dst.data[d + k] = Math.round((src.data[s + k] * sa + dst.data[d + k] * da * (1 - sa)) / oa);
      }
      dst.data[d + 3] = Math.round(oa * 255);
    }
  }
  return dst;
}

/** Вырезает прямоугольник. */
export function crop(img, x, y, width, height) {
  const out = Buffer.alloc(width * height * 4);
  for (let yy = 0; yy < height; yy++) {
    const sy = y + yy;
    if (sy < 0 || sy >= img.height) continue;
    img.data.copy(out, yy * width * 4, (sy * img.width + x) * 4, (sy * img.width + x + width) * 4);
  }
  return { width, height, data: out };
}

/**
 * Прямоугольник, за пределами которого нет ничего, кроме цвета фона.
 * Сравнение точное: знак нарисован плоскими заливками, и «почти фон» у
 * него встречается только на сглаженной кромке — она в рамку входит.
 */
export function markBounds(img, bg) {
  let x0 = img.width;
  let y0 = img.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const s = (y * img.width + x) * 4;
      if (img.data[s] === bg[0] && img.data[s + 1] === bg[1] && img.data[s + 2] === bg[2]) continue;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) throw new Error("на картинке нет ничего, кроме фона");
  return { x0, y0, x1, y1, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/**
 * Делает фон прозрачным, оставляя всё остальное как есть.
 *
 * Почему кромку НЕ размывают и не «отмывают» от фона: этот слой ложится
 * поверх фонового слоя ТОГО ЖЕ цвета, поэтому сглаженный пиксель,
 * оставленный непрозрачным вместе со своей примесью фона, сойдётся с
 * исходником точно. Любая попытка восстановить «чистый» цвет кромки
 * дала бы кайму там, где сейчас её нет.
 */
export function keyOutBackground(img, bg) {
  const data = Buffer.from(img.data);
  for (let i = 0, n = img.width * img.height; i < n; i++) {
    const s = i * 4;
    if (data[s] === bg[0] && data[s + 1] === bg[1] && data[s + 2] === bg[2]) data[s + 3] = 0;
  }
  return { width: img.width, height: img.height, data };
}

/**
 * Круглая маска со сглаженной кромкой (4×4 отсчёта на пиксель).
 * Нужна `ic_launcher_round.png`: на прошивках, которые просят круглую
 * иконку, квадрат с обрезанными системой углами выглядит иначе, чем
 * круг, нарисованный нами.
 */
export function circleMask(img) {
  const { width, height } = img;
  const data = Buffer.from(img.data);
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) / 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let inside = 0;
      for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) {
          const px = x + (sx + 0.5) / 4 - cx;
          const py = y + (sy + 0.5) / 4 - cy;
          if (px * px + py * py <= r * r) inside++;
        }
      }
      const s = (y * width + x) * 4;
      data[s + 3] = Math.round((data[s + 3] * inside) / 16);
    }
  }
  return { width, height, data };
}

/** Убирает альфу, подложив под картинку сплошной цвет. Для iOS. */
export function flatten(img, bg) {
  const data = Buffer.from(img.data);
  for (let i = 0, n = img.width * img.height; i < n; i++) {
    const s = i * 4;
    const a = data[s + 3] / 255;
    for (let k = 0; k < 3; k++) data[s + k] = Math.round(data[s + k] * a + bg[k] * (1 - a));
    data[s + 3] = 255;
  }
  return { width: img.width, height: img.height, data };
}
