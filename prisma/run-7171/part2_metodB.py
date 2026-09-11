"""7.171, часть 2 — долг 131, метод Б: перевырезка из УЖЕ ОПЛАЧЕННОЙ озвучки.

СИНТЕЗА ЗДЕСЬ НОЛЬ. Звук берётся из записи самого предложения, поэтому
ударение в нём верное по определению — риск неверного ударения нулевой.

ЧТО ИМЕННО ДЕЛАЕТСЯ ИНАЧЕ, ЧЕМ В 7.168 (две вещи, обе из плана 7.170):
 1. ПОВТОРНАЯ РАСШИФРОВКА ДРУГИМИ НАСТРОЙКАМИ: те же 210 предложений
    расшифровываются заново с подсказкой (текст самого предложения) и
    temperature=0. Подсказка влияет ТОЛЬКО на границы слов; проверка
    готовой вырезки делается отдельной расшифровкой БЕЗ подсказки, иначе
    распознаватель слышал бы то, что ему подсказали.
 2. РАСШИРЕНИЕ И СУЖЕНИЕ ГРАНИЦ: вместо одного поля 30 мс пробуется
    лесенка полей, и порядок лесенки выбирается по причине отказа
    (в вырезке больше одного слова → сужать; иначе → расширять).

КРИТЕРИЙ ПРИЁМКИ НЕ МЕНЯЕТСЯ НИ НА ШАГ и назван явно:
    вырезка принимается ⟺ её расшифровка (без подсказки) содержит РОВНО
    ОДНО слово И расстояние Левенштейна от него до нужной словоформы ≤ 1.
Порог 1 выведен числом в 7.168: 0 теряет 6 одобренных ухом вырезок из 46,
2 пропускает 7 подсадок чужого слова из 13.

РЕЖИМЫ:
    python3 part2_metodB.py              рабочий прогон по 217 местам
    python3 part2_metodB.py --control    позитивный контроль: те же 46 мест,
                                         чьи вырезки владелец одобрил ухом
    python3 part2_metodB.py --plant      негативный контроль: вместо нужного
                                         слова берётся СОСЕДНЕЕ и предъявляется
                                         под именем нужного — обязано быть отвергнуто
"""
import hashlib, json, os, sys, threading
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import asr, cut, common

PLANT = "--plant" in sys.argv
ON46 = "--control" in sys.argv
MODE = ("plant" if PLANT else "control") if ON46 else ("plant217" if PLANT else "work")
OUT = os.path.join(common.WORK, f"B-{MODE}")
os.makedirs(OUT, exist_ok=True)
MAX_TRIES = 6
CEILING = float(os.environ.get("USD_CEILING", "0.45"))

places = json.load(open(os.path.join(common.WORK, "places-217.json")))
rows166 = {f"{r['storyId']}|{r['p']}|{r['s']}|{r['token']}": r
           for r in (json.loads(l) for l in open(os.path.join(common.WORK, "homo166.jsonl")))}

if ON46:
    # 46 мест, чьи вырезки владелец одобрил ухом ещё в 7.166 (часть О).
    approved = json.load(open(os.path.join(common.WORK, "control-46.json")))
    places = approved

print(f"режим: {MODE}; мест: {len(places)}")

# --- 1. повторная расшифровка предложений ДРУГИМИ настройками ------------
cacheB = common.WordCache(os.path.join(common.WORK, "sent-words-B.json"))
sent_text = {}
for p in places:
    sent_text[f"{p['storyId']}_{p['paragraphIndex']}_{p['sentenceIndex']}"] = p["sentence"]
need = cacheB.need(sent_text)
print(f"предложений к повторной расшифровке: {len(need)}")
if need:
    def grab(k):
        try:
            cacheB.fetch(k, f"{common.SENT}/{k}.wav", prompt=sent_text[k], temperature=0)
        except Exception as e:
            print("  отказ", k, e)
    with ThreadPoolExecutor(6) as ex:
        list(ex.map(grab, need))
    cacheB.save()
print(f"в кеше повторной расшифровки предложений: {len(cacheB.data)}")
cacheOld = common.WordCache(os.path.join(common.WORK, "sent-words.json"))

lock = threading.Lock()
stop = {"hit": False}
def budget_ok():
    with lock:
        if asr.bill()["usd"] >= CEILING:
            stop["hit"] = True
            return False
        return True


def neighbour_index(words, wi):
    """Соседнее слово: следующее, а на последнем месте — предыдущее."""
    return wi + 1 if wi + 1 < len(words) else wi - 1


def work(p):
    key = f"{p['storyId']}_{p['paragraphIndex']}_{p['sentenceIndex']}"
    words = [common.norm(t) for t in common.W.findall(p["sentence"])]
    wi = p["wordIndex"]
    want = p["word"]
    if PLANT:
        wi = neighbour_index(words, wi)  # берём СОСЕДНЕЕ слово, имя оставляем нужное
    rec = {k: p[k] for k in ("storyId", "paragraphIndex", "sentenceIndex", "wordIndex", "word", "sentence", "voice")
           if k in p}
    rec["method"] = "Б"
    path = os.path.join(OUT, f"cut_{p['storyId']}_{p['paragraphIndex']}_{p['sentenceIndex']}_{p['wordIndex']}.wav")
    for source, cache in (("новая расшифровка", cacheB), ("расшифровка 7.168", cacheOld)):
        got = cache.data.get(key)
        if not got:
            continue
        heard = [common.norm(w["word"]) for w in got["words"]]
        pairs = common.align(words, heard)
        j = pairs.get(wi)
        if j is None:
            rec["why"] = "вхождение не выровнялось на расшифровку"
            continue
        best, tries = common.try_place(f"{common.SENT}/{key}.wav", got, j, want, path,
                                       budget=budget_ok, max_tries=MAX_TRIES if source.startswith("новая") else 2)
        if best is None:
            rec["why"] = "бюджет исчерпан"
            break
        rec.update({"source": source, "tries": len(tries), "pad": best.get("pad"),
                    "start": best.get("start"), "end": best.get("end"),
                    "seconds": best.get("seconds"), "heard": best.get("heard", ""),
                    "taken": best.get("taken", False), "why": best.get("why", "")})
        if best.get("taken"):
            rec["wav"] = path
            rec["sha256"] = hashlib.sha256(open(path, "rb").read()).hexdigest()
            rec["bytes"] = os.path.getsize(path)
            return rec
        if stop["hit"]:
            break
    rec["taken"] = False
    if os.path.exists(path):
        os.remove(path)
    return rec


with ThreadPoolExecutor(6) as ex:
    out = list(ex.map(work, places))

with open(os.path.join(common.WORK, f"B-{MODE}.jsonl"), "w") as f:
    for r in out:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")

took = [r for r in out if r.get("taken")]
import collections
print(f"мест: {len(out)}; принято: {len(took)}; отвергнуто: {len(out) - len(took)}")
print("причины отказа:", collections.Counter(r.get("why", "") for r in out if not r.get("taken")).most_common())
print(f"словоформ, обретших хотя бы одну вырезку: {len({r['word'].lower() for r in took})}")
print("источник принятых:", collections.Counter(r.get("source") for r in took).most_common())
print("бюджет исчерпан:", stop["hit"])
print(json.dumps(asr.bill(), ensure_ascii=False))
