"""7.171, часть 1 — долг 134: четыре места, звучащие чужим вхождением.

ЧТО СЛОМАНО. В 7.166 границы слова брались по ПЕРВОМУ совпадению текста
в расшифровке. Поэтому у слова, стоящего в одном предложении дважды,
обе вырезки выходили одинаковыми БАЙТ В БАЙТ: место слышало не себя, а
первое вхождение. 7.170 назвал четыре таких места двумя группами:

    cmsxtpzwq0000qwnc4a2sstlo 9-0 «потом», слова 10 и 14 (токены 20 и 28)
    cmsxtq7fh001fqwnc4gq7cxsa 4-0 «дома»,  слова  1 и 14 (токены  2 и 28)

ЧЕМ ЧИНИМ. Тем же путём, которым в 7.168 сделаны 83 вырезки группы N:
расшифровка предложения с границами слов выравнивается на слова
предложения (Нидлман–Вунш), и границы берутся у ТОГО вхождения, о
котором идёт речь. Синтеза 0 — звук берётся из уже оплаченной озвучки
самого предложения.

ПОДСАДКА (`--plant`): обоим местам группы намеренно отдаются границы
ПЕРВОГО вхождения — ровно тот дефект, который чиним. Утверждение «у пары
мест разные sha256» обязано на этом упасть.

    python3 part1_debt134.py [--plant]
"""
import hashlib, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import asr, cut, common

PLANT = "--plant" in sys.argv
OUT = os.path.join(common.WORK, "134-plant" if PLANT else "134")
os.makedirs(OUT, exist_ok=True)

PLACES = [
    ("cmsxtpzwq0000qwnc4a2sstlo", 9, 0, 10, "потом"),
    ("cmsxtpzwq0000qwnc4a2sstlo", 9, 0, 14, "потом"),
    ("cmsxtq7fh001fqwnc4gq7cxsa", 4, 0, 1, "дома"),
    ("cmsxtq7fh001fqwnc4gq7cxsa", 4, 0, 14, "дома"),
]
PAD = 0.03

rows166 = {r["id"]: r for r in (json.loads(l) for l in open(os.path.join(common.WORK, "homo166.jsonl")))}
cache = common.WordCache(os.path.join(common.WORK, "sent-words.json"))

need = cache.need([f"{s}_{p}_{q}" for s, p, q, _, _ in PLACES])
print(f"предложений к расшифровке: {len(need)}")
for k in need:
    cache.fetch(k, f"{common.SENT}/{k}.wav")
cache.save()

out = []
for storyId, p, s, wi, word in PLACES:
    key = f"{storyId}_{p}_{s}"
    src = rows166[f"{storyId}|{p}|{s}|{wi}"]
    got = cache.data[key]
    heard = [common.norm(w["word"]) for w in got["words"]]
    words = [common.norm(t) for t in common.W.findall(src["sentence"])]
    pairs = common.align(words, heard)
    # Подсадка: обоим местам группы отдаются границы ПЕРВОГО вхождения.
    take = wi
    if PLANT:
        take = next(i for i, w in enumerate(words) if w == common.norm(word))
    j = pairs.get(take)
    rec = {"storyId": storyId, "p": p, "s": s, "wordIndex": wi, "word": word,
           "sentence": src["sentence"], "voice": src["voice"], "url": src["url"]}
    if j is None:
        rec["why"] = "вхождение не выровнялось на расшифровку"
        out.append(rec)
        continue
    path = os.path.join(OUT, f"cut_{storyId}_{p}_{s}_{wi}.wav")
    best, tries = common.try_place(f"{common.SENT}/{key}.wav", got, j, word, path)
    rec.update({"wav": path, "heardIndex": j, "tries": len(tries), "pad": best.get("pad"),
                "start": best.get("start"), "end": best.get("end"),
                "seconds": best.get("seconds"), "heard": best.get("heard", ""),
                "sha256": hashlib.sha256(open(path, "rb").read()).hexdigest() if os.path.exists(path) else None,
                "bytes": os.path.getsize(path) if os.path.exists(path) else 0,
                "taken": best.get("taken", False), "why": best.get("why", "")})
    out.append(rec)

json.dump(out, open(os.path.join(common.WORK, "134-plant.json" if PLANT else "134.json"), "w"),
          ensure_ascii=False, indent=1)

print(f"{'ПОДСАДКА' if PLANT else 'РАБОЧИЙ ПРОГОН'}: мест {len(out)}, принято {sum(1 for r in out if r.get('taken'))}")
for r in out:
    print(f"  {r['storyId'][-6:]} {r['p']}-{r['s']} слово {r['wordIndex']} «{r['word']}» → "
          f"{r.get('start')}–{r.get('end')} с, услышано «{r.get('heard','').strip()}», поле {r.get('pad')}, "
          f"sha {r.get('sha256','—')[:8]}, {'принято' if r.get('taken') else 'ОТКАЗ: ' + r.get('why','')}")

# --- утверждение, ради которого всё и делалось ---------------------------
groups = {}
for r in out:
    groups.setdefault((r["storyId"], r["p"], r["s"], r["word"]), []).append(r)
bad = 0
for k, v in groups.items():
    shas = {r.get("sha256") for r in v}
    spans = {(r.get("start"), r.get("end")) for r in v}
    ok = len(shas) == len(v) and len(spans) == len(v)
    if not ok:
        bad += 1
    print(f"группа {k[0][-6:]} {k[1]}-{k[2]} «{k[3]}»: мест {len(v)}, различных sha256 {len(shas)}, "
          f"различных отрезков {len(spans)} → {'РАЗНЫЕ' if ok else 'ОДИНАКОВЫЕ — ДЕФЕКТ'}")
print(json.dumps(asr.bill(), ensure_ascii=False))
print(f"групп с одинаковым звуком: {bad}")
sys.exit(1 if bad else 0)
