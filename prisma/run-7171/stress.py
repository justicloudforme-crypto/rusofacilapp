"""7.171, часть 3: знак ударения U+0301 в предложении — постановка и СТОРОЖ.

ОТКУДА БЕРЁТСЯ САМО УДАРЕНИЕ. Словарного источника ударений в проекте
нет (об этом прямо сказано в `src/lib/story-word-pick.ts`), а у омографа
ударение определяет контекст. Поэтому ударение ПРЕДЛАГАЕТСЯ моделью по
самому предложению, а решает ухо владельца: файл кладётся на слух, и
предложенное ударение печатается в `список.txt` рядом с номером, чтобы
владелец слышал и проверял именно его. Ни одна запись отсюда на прод не
идёт без этого «да».

ЧТО ПРОВЕРЯЕТСЯ МЕХАНИЧЕСКИ (сторож `check_marked`, подсадка обязательна):
 1. снять все знаки ударения — обязан получиться ИСХОДНЫЙ текст знак в
    знак. Это же утверждение не даёт молча смешать «ё» и «е»: любая
    подмена буквы ломает равенство;
 2. знак в предложении РОВНО один;
 3. знак стоит сразу после гласной;
 4. эта гласная лежит внутри НУЖНОГО вхождения слова, а не соседнего;
 5. это именно та гласная по счёту, которая названа ударной.
"""
import json, os, re, urllib.request, time

MARK = "́"
VOWELS = "аеёиоуыэюя"
W = re.compile(r"[а-яёА-ЯЁ]+(?:-[а-яёА-ЯЁ]+)*")

KEY = None
for line in open("/Users/vasiliipetrov/Documents/Visual Studio/мой новый проект/.env"):
    if line.startswith("ANTHROPIC_API_KEY="):
        KEY = line.split("=", 1)[1].strip().strip('"')
MODEL = "claude-haiku-4-5-20251001"
METER = {"in": 0, "out": 0, "calls": 0}


def occurrence_span(sentence, word_index):
    """Границы вхождения слова №word_index (нумерация слов, не токенов)."""
    m = list(W.finditer(sentence))[word_index]
    return m.start(), m.end()


def vowel_positions(word):
    return [i for i, ch in enumerate(word.lower()) if ch in VOWELS]


def ask_stress(word, sentence):
    """Какая гласная по счёту ударная у ЭТОГО вхождения. 1-based."""
    vp = vowel_positions(word)
    if len(vp) == 1:
        return 1, "в слове одна гласная — ударение однозначно"
    if "ё" in word.lower():
        return word.lower().index("ё") and vp.index(word.lower().index("ё")) + 1, "ё всегда ударная"
    assert KEY, "нет ANTHROPIC_API_KEY"
    listing = ", ".join(f"{n + 1}-я «{word[i]}»" for n, i in enumerate(vp))
    prompt = (
        f"Предложение: {sentence}\n"
        f"Слово в нём: «{word}». Это русский омограф — написание одно, ударений два.\n"
        f"Гласные этого слова по порядку: {listing}.\n"
        "Определи по смыслу предложения, на какую по счёту гласную падает ударение "
        "именно в этом употреблении. Ответь ТОЛЬКО JSON вида "
        '{"vowel": <номер гласной, 1-based>, "why": "<до 8 слов>"}.'
    )
    body = json.dumps({"model": MODEL, "max_tokens": 100,
                       "messages": [{"role": "user", "content": prompt}]}).encode()
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body,
        headers={"x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"})
    last = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                d = json.loads(r.read().decode())
            METER["in"] += d["usage"]["input_tokens"]
            METER["out"] += d["usage"]["output_tokens"]
            METER["calls"] += 1
            txt = d["content"][0]["text"]
            j = json.loads(re.search(r"\{.*\}", txt, re.S).group(0))
            n = int(j["vowel"])
            if not 1 <= n <= len(vp):
                raise ValueError(f"номер гласной {n} вне 1..{len(vp)}")
            return n, str(j.get("why", ""))[:60]
        except Exception as e:
            last = e
            time.sleep(1.5 * (attempt + 1))
    raise last


def mark(sentence, word_index, vowel_n, shift=0):
    """Ставит знак после vowel_n-й гласной нужного вхождения.
    `shift` ≠ 0 — ПОДСАДКА: знак уезжает на другую гласную того же слова."""
    a, b = occurrence_span(sentence, word_index)
    word = sentence[a:b]
    vp = vowel_positions(word)
    idx = (vowel_n - 1 + shift) % len(vp)
    at = a + vp[idx]
    return sentence[: at + 1] + MARK + sentence[at + 1 :]


def mark_elsewhere(sentence, word_index):
    """ПОДСАДКА второго рода: знак на гласной ДРУГОГО слова."""
    a, b = occurrence_span(sentence, word_index)
    for i, ch in enumerate(sentence):
        if ch.lower() in VOWELS and not (a <= i < b):
            return sentence[: i + 1] + MARK + sentence[i + 1 :]
    return sentence


def check_marked(marked, sentence, word_index, vowel_n):
    """Сторож. Возвращает список нарушений; пустой список — всё сошлось."""
    bad = []
    if marked.replace(MARK, "") != sentence:
        bad.append("снятие знаков не даёт исходный текст (буква подменена или текст сдвинут)")
        return bad
    n = marked.count(MARK)
    if n != 1:
        bad.append(f"знаков ударения {n}, а должен быть 1")
        return bad
    at = marked.index(MARK)
    if at == 0 or marked[at - 1].lower() not in VOWELS:
        bad.append(f"знак стоит не после гласной, а после «{marked[at-1:at]}»")
        return bad
    plain_at = at - 1  # позиция гласной в тексте БЕЗ знаков
    a, b = occurrence_span(sentence, word_index)
    if not (a <= plain_at < b):
        bad.append(f"знак вне нужного вхождения: позиция {plain_at}, вхождение [{a},{b})")
        return bad
    vp = vowel_positions(sentence[a:b])
    got = vp.index(plain_at - a) + 1
    if got != vowel_n:
        bad.append(f"знак на {got}-й гласной, а ударной названа {vowel_n}-я")
    return bad


def bill():
    """Тариф Haiku 4.5: $1 за 1 млн входных, $5 за 1 млн выходных."""
    usd = METER["in"] / 1_000_000 * 1.0 + METER["out"] / 1_000_000 * 5.0
    return {"llm_calls": METER["calls"], "llm_in": METER["in"], "llm_out": METER["out"], "llm_usd": round(usd, 4)}


def ask_stress_batch(items, size=15):
    """То же, что `ask_stress`, но пачками: вопрос про ударение короткий, а
    накладные расходы на один запрос — нет. Места, где гласная одна или есть
    «ё», решаются без модели вовсе. Порядок ответа сверяется по номеру, а не
    по позиции: перепутанный порядок — это чужое ударение молча.

    items: [{"word":…, "sentence":…}] → [(vowel_n, why), …] той же длины.
    """
    out = [None] * len(items)
    ask = []
    for i, it in enumerate(items):
        vp = vowel_positions(it["word"])
        if len(vp) == 1:
            out[i] = (1, "в слове одна гласная — ударение однозначно")
        elif "ё" in it["word"].lower():
            out[i] = (vp.index(it["word"].lower().index("ё")) + 1, "ё всегда ударная")
        else:
            ask.append(i)
    assert KEY or not ask, "нет ANTHROPIC_API_KEY"
    for chunk_start in range(0, len(ask), size):
        chunk = ask[chunk_start : chunk_start + size]
        lines = []
        for n, i in enumerate(chunk, 1):
            it = items[i]
            vp = vowel_positions(it["word"])
            listing = ", ".join(f"{k + 1}—«{it['word'][p]}»" for k, p in enumerate(vp))
            lines.append(f"{n}. Слово «{it['word']}» (гласные: {listing}) в предложении: {it['sentence']}")
        prompt = (
            "Это русские омографы: написание одно, ударений два, решает контекст.\n"
            "Для каждого пункта скажи, на какую ПО СЧЁТУ гласную слова падает ударение "
            "именно в этом употреблении.\n\n" + "\n".join(lines) +
            '\n\nОтветь ТОЛЬКО JSON-массивом: [{"n":1,"vowel":2,"why":"до 6 слов"}, …] — по объекту на каждый пункт.'
        )
        body = json.dumps({"model": MODEL, "max_tokens": 60 * len(chunk) + 200,
                           "messages": [{"role": "user", "content": prompt}]}).encode()
        req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body,
            headers={"x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"})
        got = None
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=180) as r:
                    d = json.loads(r.read().decode())
                METER["in"] += d["usage"]["input_tokens"]
                METER["out"] += d["usage"]["output_tokens"]
                METER["calls"] += 1
                got = json.loads(re.search(r"\[.*\]", d["content"][0]["text"], re.S).group(0))
                break
            except Exception:
                time.sleep(1.5 * (attempt + 1))
        by_n = {int(o["n"]): o for o in (got or []) if isinstance(o, dict) and "n" in o}
        for n, i in enumerate(chunk, 1):
            o = by_n.get(n)
            vp = vowel_positions(items[i]["word"])
            if not o or not (1 <= int(o.get("vowel", 0)) <= len(vp)):
                out[i] = ask_stress(items[i]["word"], items[i]["sentence"])  # поштучный запасной путь
            else:
                out[i] = (int(o["vowel"]), str(o.get("why", ""))[:60])
    return out
