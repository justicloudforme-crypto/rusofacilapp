"""7.171, часть 3 — долг 131, метод А: озвучить предложение ЗАНОВО со знаком
ударения и вырезать слово из свежей записи.

ТОЛЬКО НА ОСТАТОК ПОСЛЕ Б. Синтезируются не все 210 предложений, а лишь
те, в которых метод Б не закрыл место: по одной записи на МЕСТО, потому
что знак ударения в записи ровно один и относится он к одному месту.

ПАРАМЕТРЫ БАНКА (паспорт озвучки, не меняются): `gpt-4o-mini-tts`, голос —
из каста ЭТОГО ЖЕ предложения, mp3 128 kbps / 24 000 Гц / моно.

ЗНАК УДАРЕНИЯ. Ставится модулем `stress.py`, там же сторож с пятью
утверждениями и подсадками. Само ударение предлагается моделью по
контексту предложения (словарного источника ударений в проекте нет) и
проверяется УХОМ ВЛАДЕЛЬЦА: предложенное ударение печатается в
`список.txt` рядом с номером файла.

ДОЛГ 136: ГОЛОС ОТСЮДА БРАТЬ НЕЛЬЗЯ. Ниже стоит
`asr.tts(marked, p["voice"], …)`, где `p["voice"]` — ЯРЛЫК ЖУРНАЛА 7.168,
а не колонка `AudioAsset.voice` предложения. Ярлык — снимок каста на
момент написания журнала: у 16 предложений из 904 он разошёлся с
колонкой, и шесть записей 7.171 вышли не тем голосом, каким читается
само предложение (7.174, часть 1). Скрипт оставлен как есть — историю
захода не переписываем, — но копировать этот путь нельзя: голос берётся
из базы, как в `prisma/run-7175/synth_cut.py`. Держится сторожем
`npm run check:synth-voice-source`.

ЗАПИСИ ЭТОГО ШАГА НИКУДА НЕ ПУБЛИКУЮТСЯ. Это сырьё для вырезки; они
лежат вне репозитория, в ~/rusofacil-listen/7.171/работа/A-записи/, и
оплаченную озвучку рассказа не заменяют и не перезаписывают.

    python3 part3_metodA.py [--plant] [--only=N]
"""
import hashlib, json, os, subprocess, sys, threading
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import asr, cut, common, stress

FF = "/private/tmp/claude-501/-Users-vasiliipetrov-Documents-Visual-Studio/1b0a5093-6b6d-43cf-a78e-6c3b8f583ef6/scratchpad/ffmpeg/node_modules/ffmpeg-static/ffmpeg"
PLANT = "--plant" in sys.argv
ONLY = next((int(a.split("=")[1]) for a in sys.argv if a.startswith("--only=")), None)
REC = os.path.join(common.WORK, "A-записи")
OUT = os.path.join(common.WORK, "A-plant" if PLANT else "A")
os.makedirs(REC, exist_ok=True)
os.makedirs(OUT, exist_ok=True)
CEILING = float(os.environ.get("USD_CEILING", "0.35"))

left = [r for r in (json.loads(l) for l in open(os.path.join(common.WORK, "B-work.jsonl"))) if not r.get("taken")]
if ONLY:
    left = left[:ONLY]
print(f"мест к методу А (остаток после Б): {len(left)}")

# Ударение спрашивается ОДНИМ проходом и пачками — до всякого синтеза, чтобы
# сторож знака мог отказать раньше, чем за место заплачено.
STRESS = stress.ask_stress_batch([{"word": r["word"], "sentence": r["sentence"]} for r in left])
print(f"ударение определено для {sum(1 for x in STRESS if x)} мест из {len(left)}; {json.dumps(stress.bill(), ensure_ascii=False)}")
SLOT = {id(r): i for i, r in enumerate(left)}

lock = threading.Lock()
stop = {"hit": False}
def budget_ok():
    with lock:
        if asr.bill()["usd"] >= CEILING:
            stop["hit"] = True
            return False
        return True


def decode(mp3_path, wav_path):
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", mp3_path,
                    "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le", wav_path], check=True)


def work(p):
    tag = f"{p['storyId']}_{p['paragraphIndex']}_{p['sentenceIndex']}_{p['wordIndex']}"
    rec = {k: p[k] for k in ("storyId", "paragraphIndex", "sentenceIndex", "wordIndex", "word", "sentence", "voice")}
    rec["method"] = "А"
    sent = p["sentence"]
    wi = p["wordIndex"]
    got_stress = STRESS[SLOT[id(p)]]
    if not got_stress:
        rec.update({"taken": False, "why": "ударение не определено"})
        return rec
    n, why = got_stress
    rec["vowelN"], rec["vowelWhy"] = n, why
    marked = stress.mark(sent, wi, n, shift=1 if PLANT else 0)
    bad = stress.check_marked(marked, sent, wi, n)
    rec["marked"] = marked
    rec["stressGuard"] = bad
    if bad:
        rec.update({"taken": False, "why": "сторож знака ударения: " + "; ".join(bad)})
        return rec
    if not budget_ok():
        rec.update({"taken": False, "why": "бюджет исчерпан"})
        return rec
    mp3 = os.path.join(REC, f"{tag}.mp3")
    wav = os.path.join(REC, f"{tag}.wav")
    try:
        if not os.path.exists(mp3):
            asr.tts(marked, p["voice"], mp3)
        if not os.path.exists(wav):
            decode(mp3, wav)
    except Exception as e:
        rec.update({"taken": False, "why": f"синтез отказал: {e}"})
        return rec
    try:
        d = asr.words_of(wav, prompt=sent, temperature=0)
    except Exception as e:
        rec.update({"taken": False, "why": f"расшифровка отказала: {e}"})
        return rec
    got = {"words": d.get("words", []), "duration": d.get("duration")}
    words = [common.norm(t) for t in common.W.findall(sent)]
    heard = [common.norm(w["word"]) for w in got["words"]]
    j = common.align(words, heard).get(wi)
    path = os.path.join(OUT, f"cut_{tag}.wav")
    if j is None:
        rec.update({"taken": False, "why": "вхождение не выровнялось на расшифровку"})
        return rec
    best, tries = common.try_place(wav, got, j, p["word"], path, budget=budget_ok, max_tries=4)
    if best is None:
        rec.update({"taken": False, "why": "бюджет исчерпан"})
        return rec
    rec.update({"tries": len(tries), "pad": best.get("pad"), "start": best.get("start"),
                "end": best.get("end"), "seconds": best.get("seconds"),
                "heard": best.get("heard", ""), "taken": best.get("taken", False),
                "why": best.get("why", "")})
    if not best.get("taken"):
        # Отклонённое аудитом НЕ пересинтезируется по кругу: кладём ту же
        # вырезку на слух с пометкой, решает ухо владельца.
        common.make_cut(wav, best.get("start", 0) or 0, best.get("end", 0) or 0, 0.0, path)
        rec["auditRejected"] = True
    if os.path.exists(path):
        rec["wav"] = path
        rec["sha256"] = hashlib.sha256(open(path, "rb").read()).hexdigest()
        rec["bytes"] = os.path.getsize(path)
    return rec


with ThreadPoolExecutor(4) as ex:
    out = list(ex.map(work, left))

with open(os.path.join(common.WORK, "A-plant.jsonl" if PLANT else "A.jsonl"), "w") as f:
    for r in out:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")

import collections
took = [r for r in out if r.get("taken")]
guard = [r for r in out if r.get("stressGuard")]
print(f"{'ПОДСАДКА ЗНАКА' if PLANT else 'РАБОЧИЙ ПРОГОН'}: мест {len(out)}; принято {len(took)}; "
      f"отклонено аудитом {sum(1 for r in out if r.get('auditRejected'))}")
print(f"сторож знака ударения поймал: {len(guard)} из {len(out)}")
print("причины отказа:", collections.Counter(r.get("why", "") for r in out if not r.get("taken")).most_common(6))
print(f"словоформ, обретших вырезку: {len({r['word'].lower() for r in took})}")
print("бюджет исчерпан:", stop["hit"])
print(json.dumps({**asr.bill(), **stress.bill()}, ensure_ascii=False))
