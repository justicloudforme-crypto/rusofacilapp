"""7.171, часть 4: папка «на слух» и `список.txt`.

ЧТО КЛАДЁТСЯ. Три подпапки — `134`, `Б`, `А` — и сквозная нумерация
файлов через все три, чтобы владелец называл забракованное одним числом.

ФОРМАТ. mp3 с параметрами банка (128 kbps / 24 000 Гц / моно): владелец
слушает РОВНО те байты, которые лягут на прод в 7.172, а не их WAV-предка.
Допуск по длительности односторонний и взят из 7.170: кодировщик mp3 не
укорачивает, он добавляет задержку и добивает хвост до границы кадра
(24 мс на 24 кГц), поэтому 0 мс ≤ mp3 − WAV ≤ 96 мс, и минус — это отказ.

ОЖИДАЕМОЕ УДАРЕНИЕ ПЕЧАТАЕТСЯ ВСЕГДА. Владелец — носитель языка и
проверяет ударение на слух; без напечатанного ожидания ему не с чем
сверять услышанное.
"""
import hashlib, json, os, shutil, subprocess, sys, wave
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common, stress

FF = "/private/tmp/claude-501/-Users-vasiliipetrov-Documents-Visual-Studio/1b0a5093-6b6d-43cf-a78e-6c3b8f583ef6/scratchpad/ffmpeg/node_modules/ffmpeg-static/ffmpeg"
FP = "/private/tmp/claude-501/-Users-vasiliipetrov-Documents-Visual-Studio/1b0a5093-6b6d-43cf-a78e-6c3b8f583ef6/scratchpad/ffmpeg/node_modules/ffprobe-static/bin/darwin/arm64/ffprobe"
ROOT = "/Users/vasiliipetrov/rusofacil-listen/7.171/на-слух"
PLANT = "--plant" in sys.argv

plan = json.load(open(os.path.join(common.WORK, "listen-plan.json")))
if os.path.isdir(ROOT):
    shutil.rmtree(ROOT)
for f in ("134", "Б", "А"):
    os.makedirs(os.path.join(ROOT, f), exist_ok=True)


def seconds_wav(p):
    w = wave.open(p, "rb")
    n, r = w.getnframes(), w.getframerate()
    w.close()
    return n / r


def probe(p):
    out = subprocess.run([FP, "-v", "error", "-show_entries",
                          "format=duration:stream=codec_name,sample_rate,channels,bit_rate",
                          "-of", "json", p], capture_output=True, text=True, check=True).stdout
    d = json.loads(out)
    st = d["streams"][0]
    return float(d["format"]["duration"]), st["codec_name"], int(st["sample_rate"]), int(st["channels"]), int(st.get("bit_rate") or 0)


rows, bad = [], []
for r in plan:
    src = r["wav"]
    if not src or not os.path.exists(src):
        bad.append(f"{r['n']}: нет исходного файла")
        continue
    name = f"{r['n']:04d}_{r['word']}" + ("_ОТКЛОНЕНО-АУДИТОМ" if r["auditRejected"] else "") + ".mp3"
    dst = os.path.join(ROOT, r["folder"], name)
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", src, "-codec:a", "libmp3lame",
                    "-b:a", "128k", "-ar", "24000", "-ac", "1", dst], check=True)
    if PLANT and r["n"] == plan[0]["n"]:
        # ПОДСАДКА: копия, укороченная на 100 мс, — разница уходит в минус.
        subprocess.run([FF, "-y", "-loglevel", "error", "-i", src, "-af", "atrim=start=0.1",
                        "-codec:a", "libmp3lame", "-b:a", "128k", "-ar", "24000", "-ac", "1", dst], check=True)
    w = seconds_wav(src)
    m, codec, rate, ch, br = probe(dst)
    delta = round((m - w) * 1000, 1)
    if not (0 <= delta <= 96):
        bad.append(f"{r['n']}: длительность mp3 − WAV = {delta} мс вне допуска [0, 96]")
    if (codec, rate, ch) != ("mp3", 24000, 1) or not (120000 <= br <= 136000):
        bad.append(f"{r['n']}: параметры {codec}/{rate}/{ch}/{br} ≠ параметрам банка")
    marked = stress.mark(r["sentence"], r["wordIndex"], r["vowelN"])
    guard = stress.check_marked(marked, r["sentence"], r["wordIndex"], r["vowelN"])
    if guard:
        bad.append(f"{r['n']}: сторож знака ударения — {guard}")
    a, b = stress.occurrence_span(marked.replace(stress.MARK, ""), r["wordIndex"])
    word_marked = marked[a : b + 1] if stress.MARK in marked[a : b + 1] else stress.mark(r["word"], 0, r["vowelN"])
    rows.append({**r, "file": os.path.join(r["folder"], name), "wordStressed": word_marked,
                 "sha256": hashlib.sha256(open(dst, "rb").read()).hexdigest(),
                 "bytes": os.path.getsize(dst), "mp3Seconds": round(m, 3), "wavSeconds": round(w, 3),
                 "deltaMs": delta})

with open(os.path.join(ROOT, "список.txt"), "w") as f:
    f.write("Заход 7.171 — вырезки омографов на слух.\n\n")
    f.write("Что слушать: в каждом файле должно прозвучать ОДНО слово и с тем\n"
            "ударением, которое напечатано в колонке «должно прозвучать».\n"
            "Пришлите номера тех файлов, где слышно не то. Всё остальное будет\n"
            "записано на прод в заходе 7.172.\n\n")
    f.write("Подпапки: 134 — четыре места, звучавшие чужим вхождением слова;\n"
            "Б — перевырезка из уже оплаченной озвучки (синтеза 0, ударение\n"
            "верное по определению); А — новая запись предложения со знаком\n"
            "ударения, из неё вырезано слово. Пометка ОТКЛОНЕНО-АУДИТОМ значит,\n"
            "что машинная проверка вырезку не приняла: она положена сюда\n"
            "намеренно, решает ухо.\n\n")
    f.write("Про колонку «должно прозвучать». Знак ударения там — ПОДСКАЗКА, а не\n"
            "истина. У подпапок 134 и Б звук взят из уже оплаченной озвучки\n"
            "самого предложения, где ударение верное по построению: если ухо и\n"
            "подсказка разошлись — правы вы, а не подсказка. У подпапки А наоборот:\n"
            "напечатанное ударение — это ровно то, что было заказано\n"
            "синтезатору, поэтому расхождение там — настоящий дефект файла.\n\n")
    f.write("номер\tфайл\tрассказ\tдолжно прозвучать\tключ места\tметод\tsha256\tпредложение целиком\n")
    for r in rows:
        mark = " [ОТКЛОНЕНО АУДИТОМ: " + (r["auditWhy"] or "—") + "]" if r["auditRejected"] else ""
        f.write(f"{r['n']}\t{r['file']}\t{r['title']}\t{r['wordStressed']}\t"
                f"{r['storyId']} {r['itemKey']}\t{r['method']}{mark}\t{r['sha256']}\t{r['sentence']}\n")

json.dump(rows, open(os.path.join(common.WORK, "listen-folder.json"), "w"), ensure_ascii=False, indent=1)
print(f"файлов положено: {len(rows)}")
for fo in ("134", "Б", "А"):
    print(f"  {fo}: {len([r for r in rows if r['folder'] == fo])}")
print(f"из них с пометкой «отклонено аудитом»: {sum(1 for r in rows if r['auditRejected'])}")
print(f"различных sha256: {len({r['sha256'] for r in rows})}")
print(f"допуск длительности: от {min(r['deltaMs'] for r in rows)} до {max(r['deltaMs'] for r in rows)} мс")
print(f"размер папки: {round(sum(r['bytes'] for r in rows) / 1e6, 2)} МБ")
print(f"НАРУШЕНИЙ: {len(bad)}")
for x in bad[:10]:
    print("  " + x)
sys.exit(1 if bad else 0)
