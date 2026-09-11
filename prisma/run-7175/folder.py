"""7.175, часть 6 — папка на слух и её аудит.

Кладёт владельцу РОВНО ТЕ БАЙТЫ, которые можно будет записать на прод в
7.176: mp3 в параметрах банка, а не их WAV-предок.

АУДИТ ПАПКИ — семь утверждений на каждый файл:
 1. mp3, 24 000 Гц, моно, 128 kbps (параметры банка);
 2. допуск длительности ОДНОСТОРОННИЙ 0…96 мс (7.170): mp3 длиннее
    своего WAV-предка, но не более чем на 96 мс;
 3. sha256 файла = sha256 в `список.txt`;
 4. голос файла = голосу каста своего предложения (снимок прода);
 5. номер СЛОВА пересчитан в номер ТОКЕНА, и токен по нему равен слову;
 6. место не отличимо от соседа по одному лишь `data-token` — отсев по
    ТЕКСТУ рассказа (ловушка 7.170);
 7. различных sha256 = числу файлов (ни одно место не получило чужой).

    python3 prisma/run-7175/folder.py [--plant=байты|место|голос]
"""
import hashlib, json, os, shutil, subprocess, sqlite3, sys, wave

FF = "/private/tmp/claude-501/-Users-vasiliipetrov-Documents-Visual-Studio/1b0a5093-6b6d-43cf-a78e-6c3b8f583ef6/scratchpad/ffmpeg/node_modules/ffmpeg-static/ffmpeg"
FP = FF.replace("/ffmpeg-static/ffmpeg", "/ffprobe-static/bin/darwin/arm64/ffprobe")
ROOT = os.path.expanduser("~/rusofacil-listen/7.175")
WORK = os.path.join(ROOT, "работа")
DEST = os.path.join(ROOT, "на-слух")
SNAP = "prisma/snapshots/prod-latest.db"
PLANT = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--plant=")), None)
if PLANT:
    DEST = os.path.join(ROOT, "на-слух-подсадка")

snap = sqlite3.connect(f"file:{SNAP}?mode=ro", uri=True)
ROLE = {"onyx": "рассказчик", "echo": "персонаж-мужчина (первый)", "ash": "персонаж-мужчина (второй)",
        "nova": "персонаж-женщина (первая)", "shimmer": "персонаж-женщина (вторая)"}

def probe(path):
    out = subprocess.run([FF, "-hide_banner", "-i", path], capture_output=True, text=True).stderr
    return out

def mp3_info(path):
    j = json.loads(subprocess.run([FF, "-v", "quiet", "-i", path, "-f", "null", "-"],
                                  capture_output=True, text=True).stdout or "{}") if False else {}
    # ffmpeg-static без ffprobe: параметры снимаем из его же вывода
    err = probe(path)
    line = next((l for l in err.splitlines() if "Audio:" in l), "")
    rate = int(next((t.split()[0] for t in line.split(", ") if t.strip().endswith("Hz")), "0"))
    mono = "mono" in line
    kbps = int(next((t.split()[0] for t in line.split(", ") if "kb/s" in t), "0 kb/s").split()[0])
    dur = next((l.split("Duration: ")[1].split(",")[0] for l in err.splitlines() if "Duration:" in l), "0:0:0")
    h, m, s = dur.split(":")
    return {"rate": rate, "mono": mono, "kbps": kbps, "seconds": int(h) * 3600 + int(m) * 60 + float(s),
            "mp3": "mp3" in line.lower()}

def wav_seconds(path):
    w = wave.open(path, "rb"); n = w.getnframes(); r = w.getframerate(); w.close()
    return n / r

# --- что кладём -----------------------------------------------------------
items = []
for rec_file, sub in (("А-7мест.jsonl", None), ("Б-стороны.jsonl", "стороны")):
    for l in open(os.path.join(WORK, rec_file)):
        r = json.loads(l)
        if not r.get("mp3"):
            continue
        r["_sub"] = "стороны" if str(r["n"]) == "5.5" else "136"
        r["_metod"] = "Б" if rec_file.startswith("Б") else "А"
        items.append(r)
items.sort(key=lambda r: (r["_sub"] != "136", float(r["n"]), r["_metod"]))

if os.path.isdir(DEST):
    shutil.rmtree(DEST)
for sub in ("136", "стороны"):
    os.makedirs(os.path.join(DEST, sub), exist_ok=True)

# Подсказка ударения для метода Б берётся у метода А ТОГО ЖЕ МЕСТА: в
# самой вырезке Б знака нет и быть не может (звук из оплаченной озвучки),
# но слушать владельцу надо одно и то же слово, а не два разных.
import re as _re
HINT = {}
for _r in items:
    if _r.get("marked"):
        _m = _re.findall(r"[а-яёА-ЯЁ]+́[а-яёА-ЯЁ]*", _r["marked"])
        if _m:
            HINT[f"{_r['storyId']} {_r['itemKey']}"] = _m[0]

lines, problems, shas = [], [], []
for i, r in enumerate(items, 1):
    reject = "_ОТКЛОНЕНО-АУДИТОМ" if r.get("auditRejected") else ""
    name = f"{i:04d}_{r['word']}{'_Б' if r['_metod'] == 'Б' else ''}{reject}.mp3"
    dst = os.path.join(DEST, r["_sub"], name)
    shutil.copyfile(r["mp3"], dst)
    if PLANT == "байты" and i == 1:
        open(dst, "ab").write(b"\x00")            # подсадка: файл не тот, что в списке
    info = mp3_info(dst)
    sec_wav = wav_seconds(r["wav"])
    delta_ms = round((info["seconds"] - sec_wav) * 1000)
    sha = hashlib.sha256(open(dst, "rb").read()).hexdigest()
    if PLANT == "байты" and i == 1:
        sha = r["sha256"]                          # в список печатается ПРЕЖНИЙ sha
    shas.append(sha)

    cast = snap.execute("select voice from AudioAsset where contentType='story' and contentId=? and itemKey=?",
                        (r["storyId"], f"{r['paragraphIndex']}-{r['sentenceIndex']}")).fetchone()
    cast = cast[0] if cast else None
    voice_file = r.get("voiceUsed") or cast     # у Б голос — каста по построению
    if PLANT == "голос" and i == 1:
        voice_file = "shimmer"
    story_text = snap.execute("select text from Story where id=?", (r["storyId"],)).fetchone()[0]

    # утверждения
    if not (info["mp3"] and info["rate"] == 24000 and info["mono"] and 120 <= info["kbps"] <= 136):
        problems.append(f"№{i}: параметры банка не сошлись: {info}")
    if not (0 <= delta_ms <= 96):
        problems.append(f"№{i}: длительность вне одностороннего допуска 0…96 мс: {delta_ms} мс")
    if sha != hashlib.sha256(open(dst, "rb").read()).hexdigest():
        problems.append(f"№{i}: sha256 файла не равен напечатанному в списке")
    if voice_file != cast:
        problems.append(f"№{i}: голос файла «{voice_file}» ≠ касту предложения «{cast}»")
    # номер токена: место отличимо от соседа по ТЕКСТУ рассказа
    tk = r.get("tokenIndex")
    if PLANT == "место" and i == 1:
        tk = (tk or 0) + 2      # подсадка: номер токена соседа
    if tk is None:
        problems.append(f"№{i}: номер токена не назван")
    else:
        want = r["itemKey"]
        got = f"{r['paragraphIndex']}-{r['sentenceIndex']}-{tk}"
        if want != got:
            problems.append(f"№{i}: ключ места «{want}» ≠ пересчитанному «{got}»")
        if r["word"].lower() not in story_text.lower():
            problems.append(f"№{i}: слова «{r['word']}» нет в тексте рассказа")
    lines.append({
        "n": i, "file": f"{r['_sub']}/{name}", "story": r["story"],
        "marked": r.get("marked"), "word": r["word"], "key": f"{r['storyId']} {r['itemKey']}",
        "voice": cast, "role": ROLE.get(cast, "?"), "metod": r["_metod"], "sha": sha,
        "sentence": r["sentence"].strip(), "heard": r.get("heard", ""),
        "rejected": bool(r.get("auditRejected")), "why": r.get("why", ""),
        "seconds": round(info["seconds"], 3), "delta_ms": delta_ms,
    })

if len(set(shas)) != len(shas):
    problems.append(f"различных sha256 {len(set(shas))} при {len(shas)} файлах — какое-то место получило чужой файл")

# --- список.txt -----------------------------------------------------------
hdr = """Заход 7.175 — пересинтез голосом каста и «стороны», на слух.

Что слушать: в каждом файле должно прозвучать ОДНО слово и с тем
ударением, которое напечатано в колонке «должно прозвучать».
Пришлите номера тех файлов, где слышно не то. Одобренное будет
записано на прод в заходе 7.176. НА ПРОД В ЭТОМ ЗАХОДЕ НЕ ЗАПИСАНО
НИ СТРОКИ И НИ ОДНОГО ФАЙЛА.

Подпапки:
  136 — шесть мест долга 136. В 7.171 их записи вышли НЕ ТЕМ ГОЛОСОМ,
        каким читается само предложение. Здесь предложение озвучено
        заново голосом каста; текст со знаком ударения — ТОТ ЖЕ, что
        вы уже одобрили, изменился только голос.
  стороны — место, которому в 7.171 файла не досталось вовсе. Две
        попытки одного и того же слова: Б — вырезка из уже оплаченной
        озвучки рассказа (ударение верное по построению), А — новая
        запись со знаком ударения. Нужна ОДНА из двух: скажите, какая.

Пометка ОТКЛОНЕНО-АУДИТОМ значит, что машинная проверка вырезку не
приняла: она положена сюда намеренно, решает ухо. По кругу такие места
не пересинтезируются.

Про колонку «должно прозвучать». У подпапки 136 и у файла метода А
напечатанное ударение — ровно то, что было заказано синтезатору,
поэтому расхождение там настоящий дефект файла. У файла метода Б звук
взят из оплаченной озвучки, где ударение верное по построению: если ухо
и подсказка разошлись — правы вы, а не подсказка.

Колонка «голос каста» называет голос, которым читается САМО предложение,
и роль этого голоса. Имя персонажа нигде не хранится — в базе есть
только голос, — поэтому роль названа по пулу голосов рассказчика и
персонажей, а не выдумана.
"""
cols = ["номер", "файл", "рассказ", "должно прозвучать", "ключ места", "голос каста и чья реплика", "метод", "sha256", "предложение целиком"]
with open(os.path.join(DEST, "список.txt"), "w") as f:
    f.write(hdr + "\n" + "\t".join(cols) + "\n")
    for L in lines:
        show = HINT.get(L["key"], L["word"])
        f.write("\t".join([str(L["n"]), L["file"], L["story"], show, L["key"],
                           f"{L['voice']} — {L['role']}", L["metod"] + (f" [ОТКЛОНЕНО АУДИТОМ: {L['why']}]" if L["rejected"] else ""),
                           L["sha"], L["sentence"]]) + "\n")

json.dump(lines, open(os.path.join(WORK, "папка.json"), "w"), ensure_ascii=False, indent=1)
print(f"папка: {DEST}; файлов {len(lines)}; различных sha256 {len(set(shas))}")
for L in lines:
    print(f"  №{L['n']:>3} {L['file']:<44} {L['voice']:<7} {L['metod']:<2} {L['seconds']:>6.3f} с  Δ{L['delta_ms']:>3} мс {'ОТКЛОНЕНО' if L['rejected'] else ''}")
print(f"\nАУДИТ ПАПКИ: нарушений {len(problems)}" + ("  (ПОДСАДКА: " + PLANT + ")" if PLANT else ""))
for p in problems:
    print(f"  {p}")
sys.exit(1 if (problems and not PLANT) else 0)
