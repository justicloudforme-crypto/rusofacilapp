/**
 * Превращает 24-битный PNG (RGB) в 32-битный (RGBA) без внешних библиотек.
 *
 * Зачем это вообще существует. Play требует у иконки витрины «PNG 32-bit с
 * альфа-каналом». Chromium, снимая страницу, канал ВЫБРАСЫВАЕТ, если все
 * пиксели непрозрачны, и пишет colorType 2 (RGB) — то есть выполнить
 * требование одним `page.screenshot()` нельзя в принципе, сколько ни
 * настраивай `omitBackground`. Поставить ради одного канала `sharp` в
 * зависимости проекта тоже не годится: сейчас он лежит в `node_modules`
 * ТОЛЬКО как транзитивная зависимость `next` и исчезнет на первом же
 * обновлении, которое её сменит. Поэтому канал дописывается здесь, на
 * `node:zlib`, который есть всегда.
 *
 * Поддерживается ровно то, что отдаёт Chromium: глубина 8 бит, colorType
 * 2 или 6, без чересстрочности. Всё остальное — исключение, а не тихая
 * порча файла.
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

export function toRgba(png) {
  if (!png.subarray(0, 8).equals(SIG)) throw new Error("не PNG");
  let off = 8;
  let ihdr = null;
  const idat = [];
  while (off < png.length) {
    const len = png.readUInt32BE(off);
    const type = png.toString("latin1", off + 4, off + 8);
    const data = png.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") ihdr = data;
    else if (type === "IDAT") idat.push(data);
    off += 12 + len;
  }
  if (!ihdr) throw new Error("нет IHDR");
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const depth = ihdr[8];
  const colorType = ihdr[9];
  const interlace = ihdr[12];
  if (colorType === 6) return { png, converted: false, width, height };
  if (depth !== 8 || colorType !== 2 || interlace !== 0) {
    throw new Error(`ожидался 8-битный RGB без чересстрочности, получено depth=${depth} colorType=${colorType} interlace=${interlace}`);
  }

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bppIn = 3;
  const stride = width * bppIn;
  const out = Buffer.alloc(height * (1 + width * 4));
  const prev = Buffer.alloc(stride);
  const line = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bppIn ? line[x - bppIn] : 0;
      const b = prev[x];
      const c = x >= bppIn ? prev[x - bppIn] : 0;
      let v = src[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      else if (filter !== 0) throw new Error(`неизвестный фильтр строки ${filter}`);
      line[x] = v & 0xff;
    }
    // Пишем строку уже с альфой; фильтр 0 («никакой») — тратим байты, но
    // не вносим ещё одного места, где можно ошибиться.
    const base = y * (1 + width * 4);
    out[base] = 0;
    for (let x = 0; x < width; x++) {
      out[base + 1 + x * 4] = line[x * 3];
      out[base + 2 + x * 4] = line[x * 3 + 1];
      out[base + 3 + x * 4] = line[x * 3 + 2];
      out[base + 4 + x * 4] = 0xff;
    }
    line.copy(prev);
  }

  const newIhdr = Buffer.alloc(13);
  newIhdr.writeUInt32BE(width, 0);
  newIhdr.writeUInt32BE(height, 4);
  newIhdr[8] = 8;
  newIhdr[9] = 6; // RGBA
  newIhdr[10] = 0;
  newIhdr[11] = 0;
  newIhdr[12] = 0;

  const result = Buffer.concat([
    SIG,
    chunk("IHDR", newIhdr),
    chunk("IDAT", zlib.deflateSync(out, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return { png: result, converted: true, width, height };
}
