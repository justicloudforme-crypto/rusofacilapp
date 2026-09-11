"""7.175, часть 3 — «стороны» методом Б: перевырезка из УЖЕ ОПЛАЧЕННОЙ озвучки.

СИНТЕЗА ЗДЕСЬ НОЛЬ. Звук берётся из записи самого предложения, поэтому
ударение в нём верное по построению — это и делает Б предпочтительным
перед А, а не просто «другим».

ПОЧЕМУ ЭТО НОВАЯ ПОПЫТКА, А НЕ ПОВТОР 7.171. В 7.171 место не взялось
по двум разным причинам сразу: на НОВОЙ расшифровке (с подсказкой)
вхождение не выровнялось вовсе, а на старой (7.168) лесенка полей
дошла только до второй попытки — у запасного источника `max_tries=2`.
Здесь расшифровка берётся БЕЗ подсказки (7.175 показал числом, что
подсказка у этого предложения даёт выдумку из 9 слов вместо 23), а
лесенка проходится целиком.

КРИТЕРИЙ ПРИЁМКИ НЕ МЕНЯЕТСЯ НИ НА ШАГ (7.168): в вырезке ровно одно
слово, расстояние Левенштейна до нужной словоформы ≤ 1, проверка —
отдельным запросом БЕЗ подсказки.

    python3 prisma/run-7175/metodB.py --plan=… [--plant]

`--plant` — негативный контроль: вместо нужного слова вырезается
СОСЕДНЕЕ и предъявляется под именем нужного; обязано быть отвергнуто.
"""
import hashlib, json, os, subprocess, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "run-7171"))
import asr, cut, common

FF = "/private/tmp/claude-501/-Users-vasiliipetrov-Documents-Visual-Studio/1b0a5093-6b6d-43cf-a78e-6c3b8f583ef6/scratchpad/ffmpeg/node_modules/ffmpeg-static/ffmpeg"
PLAN = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--plan=")), None)
PLANT = "--plant" in sys.argv
JOURNAL = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--journal=")), None)
ROOT = os.path.expanduser("~/rusofacil-listen/7.175")
OUT = os.path.join(ROOT, "работа", "Б-подсадка" if PLANT else "Б")
os.makedirs(OUT, exist_ok=True)
CEILING = float(os.environ.get("USD_CEILING", "0.03"))


def budget_ok():
    return asr.bill()["usd"] < CEILING


def encode(wav_path, mp3_path):
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", wav_path,
                    "-ar", "24000", "-ac", "1", "-b:a", "128k", mp3_path], check=True)


out = []
for p in json.load(open(PLAN)):
    key = f"{p['storyId']}_{p['paragraphIndex']}_{p['sentenceIndex']}"
    src = f"{common.SENT}/{key}.wav"
    rec = {k: p[k] for k in ("n", "storyId", "itemKey", "paragraphIndex", "sentenceIndex",
                             "wordIndex", "tokenIndex", "word", "sentence", "story", "castVoice")}
    rec["method"] = "Б (перевырезка из оплаченной озвучки)"
    rec["синтеза"] = 0
    if not os.path.exists(src):
        rec.update({"taken": False, "why": "нет записи предложения"}); out.append(rec); continue
    words = [common.norm(t) for t in common.W.findall(p["sentence"])]
    wi = p["wordIndex"]
    if PLANT:  # соседнее слово под именем нужного
        wi = wi + 1 if wi + 1 < len(words) else wi - 1
    got, j, used = None, None, None
    for name, kw in (("без подсказки", {}), ("с подсказкой", {"prompt": p["sentence"], "temperature": 0})):
        d = asr.words_of(src, **kw)
        g = {"words": d.get("words", []), "duration": d.get("duration")}
        heard = [common.norm(w["word"]) for w in g["words"]]
        cand = common.align(words, heard).get(wi)
        rec.setdefault("asrTried", []).append({"настройка": name, "слов": len(heard), "выровнялось": cand is not None})
        if cand is not None:
            got, j, used = g, cand, name
            break
    rec["asrUsed"] = used
    if j is None:
        rec.update({"taken": False, "why": "вхождение не выровнялось на расшифровку ни при одной настройке"}); out.append(rec); continue
    wavcut = os.path.join(OUT, f"cut_{p['storyId']}_{p['paragraphIndex']}_{p['sentenceIndex']}_{p['wordIndex']}.wav")
    best, tries = common.try_place(src, got, j, p["word"], wavcut, budget=budget_ok, max_tries=6)
    rec.update({"tries": len(tries), "pad": best.get("pad"), "start": best.get("start"),
                "end": best.get("end"), "seconds": best.get("seconds"),
                "heard": best.get("heard", ""), "taken": best.get("taken", False),
                "why": best.get("why", "")})
    if not best.get("taken"):
        common.make_cut(src, best.get("start", 0) or 0, best.get("end", 0) or 0, 0.0, wavcut)
        rec["auditRejected"] = True
    if os.path.exists(wavcut):
        mp3 = os.path.join(OUT, os.path.basename(wavcut).replace(".wav", ".mp3"))
        encode(wavcut, mp3)
        rec.update({"wav": wavcut, "mp3": mp3, "bytes": os.path.getsize(mp3),
                    "sha256": hashlib.sha256(open(mp3, "rb").read()).hexdigest()})
    out.append(rec)

jn = os.path.join(ROOT, "работа", JOURNAL or ("Б-подсадка.jsonl" if PLANT else "Б.jsonl"))
with open(jn, "w") as f:
    for r in out:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")
print(f"{'ПОДСАДКА (соседнее слово)' if PLANT else 'РАБОЧИЙ ПРОГОН'}: мест {len(out)}; принято {sum(1 for r in out if r.get('taken'))}")
for r in out:
    print(f"  №{r['n']} «{r['word']}» расшифровка={r.get('asrUsed')} попыток={r.get('tries')} "
          f"принято={r.get('taken')} {r.get('why','')} услышано={r.get('heard','')!r}")
print(json.dumps(asr.bill(), ensure_ascii=False))
print(f"журнал: {jn}")
