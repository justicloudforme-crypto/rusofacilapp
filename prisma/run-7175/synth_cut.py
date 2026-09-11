"""7.175 — пересинтез шести мест долга 136 голосом КАСТА и вырезка заново.

ЧЕМ ЭТОТ СКРИПТ ОТЛИЧАЕТСЯ ОТ `part3_metodA.py` 7.171 — ровно одним, и
это и есть лечение долга 136: голос берётся ТОЛЬКО из колонки
`AudioAsset.voice` предложения на свежем снимке прода. Журнальный ярлык
голоса входом не принимается вовсе: поле `journalLabel` в плане лежит
как справка и в синтез не попадает ни при каком флаге.

ГОЛОС СВЕРЯЕТСЯ ДВАЖДЫ — до синтеза и после (правило 7.175): перед
запросом голос перечитывается из снимка напрямую, после синтеза
сверяется голос, которым файл на самом деле заказан.

ТЕКСТ СО ЗНАКОМ УДАРЕНИЯ — тот же, что в 7.171 (владелец одобрил
ударение на слух). Сторож знака из `stress.py` гоняется заново: пять
утверждений, и он стоит ДО синтеза, чтобы отказать раньше, чем
заплачено.

ПАРАМЕТРЫ БАНКА: gpt-4o-mini-tts, mp3 128 kbps / 24 000 Гц / моно.

    python3 prisma/run-7175/synth_cut.py --plan=… [--plant=voice] [--only=N]

ДВЕ ПОДСАДКИ, и обе обязаны быть отвергнуты:
  `--plant=voice`   синтез заказывается ЧУЖИМ голосом — сверка голоса
                    ПОСЛЕ синтеза обязана это поймать;
  `--plant=журнал`  в план вместо каста подставлен ЯРЛЫК ЖУРНАЛА 7.168 —
                    то есть ровно тот дефект, из-за которого завёлся
                    долг 136. Сверка с колонкой снимка ДО синтеза обязана
                    отказать раньше, чем за место заплачено: синтеза 0.
"""
import hashlib, json, os, sqlite3, subprocess, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "run-7171"))
import asr, cut, common, stress

FF = "/private/tmp/claude-501/-Users-vasiliipetrov-Documents-Visual-Studio/1b0a5093-6b6d-43cf-a78e-6c3b8f583ef6/scratchpad/ffmpeg/node_modules/ffmpeg-static/ffmpeg"
SNAP = "prisma/snapshots/prod-latest.db"
ROOT = os.path.expanduser("~/rusofacil-listen/7.175")
PLAN = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--plan=")), None)
PLANT = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--plant=")), None)
ONLY = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--only=")), None)
JOURNAL = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--journal=")), "результат.jsonl")
CEILING = float(os.environ.get("USD_CEILING", "0.06"))
OTHER = {"onyx": "echo", "echo": "onyx", "ash": "nova", "nova": "ash", "shimmer": "onyx"}

WORK = os.path.join(ROOT, "работа" + ("-подсадка" if PLANT else ""))
REC = os.path.join(WORK, "записи")
CUTS = os.path.join(WORK, "вырезки")
for d in (REC, CUTS):
    os.makedirs(d, exist_ok=True)

plan = json.load(open(PLAN))
if ONLY:
    keep = set(ONLY.split(","))
    plan = [p for p in plan if str(p["n"]) in keep]
print(f"мест в плане: {len(plan)}" + (f"   ПОДСАДКА: {PLANT}" if PLANT else ""))

# Источник правды о голосе — снимок прода, а не план и не журнал.
snap = sqlite3.connect(f"file:{SNAP}?mode=ro", uri=True)


def cast_voice(story_id, p, s):
    r = snap.execute(
        "select voice from AudioAsset where contentType='story' and contentId=? and itemKey=?",
        (story_id, f"{p}-{s}")).fetchone()
    return r[0] if r else None


def decode(mp3_path, wav_path):
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", mp3_path,
                    "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le", wav_path], check=True)


def encode(wav_path, mp3_path):
    """Параметры банка: mp3 128 kbps / 24 000 Гц / моно."""
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", wav_path,
                    "-ar", "24000", "-ac", "1", "-b:a", "128k", mp3_path], check=True)


def budget_ok():
    return asr.bill()["usd"] < CEILING


out = []
for p in plan:
    tag = f"{p['storyId']}_{p['paragraphIndex']}_{p['sentenceIndex']}_{p['wordIndex']}"
    rec = {k: p[k] for k in ("n", "storyId", "itemKey", "paragraphIndex", "sentenceIndex",
                             "wordIndex", "tokenIndex", "word", "sentence", "story",
                             "journalLabel", "prevVoice7171", "vowelN", "vowelWhy")}
    rec["method"] = "А (пересинтез голосом каста)"

    # 1. голос — ДО синтеза, из снимка напрямую
    voice = cast_voice(p["storyId"], p["paragraphIndex"], p["sentenceIndex"])
    rec["castVoiceBefore"] = voice
    if PLANT == "журнал" and p.get("journalLabel"):
        p = dict(p, castVoice=p["journalLabel"])   # план, построенный из журнала
    if not voice:
        rec.update({"taken": False, "why": "у предложения нет записи каста"}); out.append(rec); continue
    if voice != p["castVoice"]:
        rec.update({"taken": False, "why": f"каст в плане «{p['castVoice']}» ≠ касту снимка «{voice}»"}); out.append(rec); continue

    # 2. знак ударения — тот же текст, сторож заново
    marked = p["marked"]
    bad = stress.check_marked(marked, p["sentence"], p["wordIndex"], p["vowelN"])
    rec["stressGuard"] = bad
    rec["marked"] = marked
    if bad:
        rec.update({"taken": False, "why": "сторож знака ударения: " + "; ".join(bad)}); out.append(rec); continue

    # 3. синтез. Голос — cast_voice; при подсадке намеренно чужой.
    used = OTHER[voice] if PLANT == "voice" else voice
    rec["voiceUsed"] = used
    mp3raw = os.path.join(REC, f"{tag}_{used}.mp3")
    wav = os.path.join(REC, f"{tag}_{used}.wav")
    if not budget_ok():
        rec.update({"taken": False, "why": "бюджет исчерпан"}); out.append(rec); continue
    try:
        if not os.path.exists(mp3raw):
            asr.tts(marked, used, mp3raw)
        if not os.path.exists(wav):
            decode(mp3raw, wav)
    except Exception as e:
        rec.update({"taken": False, "why": f"синтез отказал: {e}"}); out.append(rec); continue

    # 4. СВЕРКА ГОЛОСА ПОСЛЕ СИНТЕЗА. Проверка, ради которой заход и затеян.
    voice_after = cast_voice(p["storyId"], p["paragraphIndex"], p["sentenceIndex"])
    rec["castVoiceAfter"] = voice_after
    if used != voice_after:
        rec.update({"taken": False, "voiceMismatch": True,
                    "why": f"голос файла «{used}» ≠ касту предложения «{voice_after}»"})
        out.append(rec); continue

    # 5. вырезка: расшифровка, выравнивание, лесенка полей.
    #
    # ДВЕ НАСТРОЙКИ РАСШИФРОВКИ, А НЕ ОДНА, и это находка 7.175. Подсказка
    # текстом предложения (7.171) у одного предложения из семи ПОРТИТ
    # расшифровку: «Конфликт интересов» 8-0 с подсказкой распознаётся как
    # выдумка из 9 слов, не имеющая к звуку отношения, и вхождение не
    # выравнивается; БЕЗ подсказки — 22 слова из 23 и вхождение на месте.
    # Поэтому при отказе выравнивания пробуется вторая настройка. Критерий
    # приёмки при этом НЕ меняется ни на шаг (7.168): ровно одно слово в
    # вырезке и расстояние Левенштейна ≤ 1, и проверяется он отдельным
    # запросом БЕЗ подсказки в обоих случаях.
    words = [common.norm(t) for t in common.W.findall(p["sentence"])]
    got, j, used_asr = None, None, None
    for name, kw in (("с подсказкой", {"prompt": p["sentence"], "temperature": 0}), ("без подсказки", {})):
        try:
            d = asr.words_of(wav, **kw)
        except Exception as e:
            rec.setdefault("asrErrors", []).append(f"{name}: {e}")
            continue
        g = {"words": d.get("words", []), "duration": d.get("duration")}
        heard = [common.norm(w["word"]) for w in g["words"]]
        cand = common.align(words, heard).get(p["wordIndex"])
        rec.setdefault("asrTried", []).append({"настройка": name, "слов": len(heard), "выровнялось": cand is not None})
        if cand is not None:
            got, j, used_asr = g, cand, name
            break
    rec["asrUsed"] = used_asr
    if j is None:
        rec.update({"taken": False, "why": "вхождение не выровнялось на расшифровку ни при одной настройке"}); out.append(rec); continue
    wavcut = os.path.join(CUTS, f"cut_{tag}.wav")
    best, tries = common.try_place(wav, got, j, p["word"], wavcut, budget=budget_ok, max_tries=6)
    if best is None:
        rec.update({"taken": False, "why": "бюджет исчерпан"}); out.append(rec); continue
    rec.update({"tries": len(tries), "pad": best.get("pad"), "start": best.get("start"),
                "end": best.get("end"), "seconds": best.get("seconds"),
                "heard": best.get("heard", ""), "taken": best.get("taken", False),
                "why": best.get("why", "")})
    if not best.get("taken"):
        # Отклонённое аудитом по кругу не пересинтезируется: та же вырезка
        # кладётся на слух с пометкой, решает ухо владельца (7.171).
        common.make_cut(wav, best.get("start", 0) or 0, best.get("end", 0) or 0, 0.0, wavcut)
        rec["auditRejected"] = True
    if os.path.exists(wavcut):
        mp3cut = os.path.join(CUTS, f"cut_{tag}.mp3")
        encode(wavcut, mp3cut)
        rec["wav"] = wavcut
        rec["mp3"] = mp3cut
        rec["sha256"] = hashlib.sha256(open(mp3cut, "rb").read()).hexdigest()
        rec["bytes"] = os.path.getsize(mp3cut)
    out.append(rec)

jsonl = os.path.join(WORK, JOURNAL)
with open(jsonl, "w") as f:
    for r in out:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")

took = [r for r in out if r.get("taken")]
mism = [r for r in out if r.get("voiceMismatch")]
print(f"{'ПОДСАДКА' if PLANT else 'РАБОЧИЙ ПРОГОН'}: мест {len(out)}; принято {len(took)}; "
      f"отклонено аудитом {sum(1 for r in out if r.get('auditRejected'))}; "
      f"поймано сверкой голоса {len(mism)}")
for r in out:
    print(f"  №{r['n']:>5} «{r['word']}» каст={r.get('castVoiceBefore')} заказан={r.get('voiceUsed')} "
          f"принято={r.get('taken')} {r.get('why','')} услышано={r.get('heard','')!r}")
print(json.dumps(asr.bill(), ensure_ascii=False))
print(f"журнал: {jsonl}")
