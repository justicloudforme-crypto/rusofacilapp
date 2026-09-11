"""7.171, часть 4: ожидаемое ударение для файлов методов Б и 134.

Владелец — носитель русского и проверяет ударение на слух, поэтому в
`список.txt` рядом с каждым номером обязано стоять слово со знаком
ударения, которое ДОЛЖНО прозвучать. У методов Б и 134 звук взят из уже
оплаченной озвучки (ударение там верное по определению), но ожидание
всё равно печатается — иначе владельцу не с чем сверять услышанное.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import stress, common

items, keys = [], []
for path, taken_only in (("134.json", True), ("B-work.jsonl", True)):
    p = os.path.join(common.WORK, path)
    rows = json.load(open(p)) if path.endswith(".json") else [json.loads(l) for l in open(p)]
    for r in rows:
        if taken_only and not r.get("taken"):
            continue
        keys.append(f"{r['storyId']}|{r.get('paragraphIndex', r.get('p'))}-{r.get('sentenceIndex', r.get('s'))}-{r['wordIndex']}")
        items.append({"word": r["word"], "sentence": r["sentence"]})

print(f"мест к определению ударения: {len(items)}")
res = stress.ask_stress_batch(items)
out = {}
for k, it, (n, why) in zip(keys, items, res):
    marked = stress.mark(it["sentence"], 0, n) if False else None
    out[k] = {"vowelN": n, "why": why}
json.dump(out, open(os.path.join(common.WORK, "stress-BQ.json"), "w"), ensure_ascii=False, indent=1)
print(json.dumps(stress.bill(), ensure_ascii=False))
