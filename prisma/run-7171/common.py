"""7.171: общая часть — выравнивание расшифровки на слова предложения и вырезка.

ВАЖНО ПРО НУМЕРАЦИЮ. Здесь и в `homo*.jsonl` поле `token` — это номер
СЛОВА в предложении (W.findall), а НЕ номер токена. `AudioAsset.itemKey`
называется номером ТОКЕНА (пробелы и знаки препинания тоже токены). Две
нумерации смешивать молча нельзя — это класс долга 104; перевод одной в
другую делается отдельным шагом (`itemkey.py`), как в 7.170.
"""
import json, os, re, sys, threading
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import asr, cut

SENT = "/private/tmp/claude-501/-Users-vasiliipetrov-Documents-Visual-Studio/6aa2f643-1e2b-464f-a217-d2cf7f118892/scratchpad/7166/homo"
WORK = "/Users/vasiliipetrov/rusofacil-listen/7.171/работа"

W = re.compile(r"[а-яёА-ЯЁ]+(?:-[а-яёА-ЯЁ]+)*")
STRESS = "́"


def norm(s):
    return s.lower().replace(STRESS, "")


def lev(a, b):
    if abs(len(a) - len(b)) > 1:
        return 2
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def align(tokens, heard):
    """Needleman-Wunsch по равенству/близости: индекс слова -> индекс услышанного."""
    n, m = len(tokens), len(heard)
    score = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        score[i][0] = -i
    for j in range(1, m + 1):
        score[0][j] = -j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            d = lev(tokens[i - 1], heard[j - 1])
            sub = 2 if d == 0 else (1 if d == 1 else -1)
            score[i][j] = max(score[i - 1][j - 1] + sub, score[i - 1][j] - 1, score[i][j - 1] - 1)
    i, j, pairs = n, m, {}
    while i > 0 and j > 0:
        d = lev(tokens[i - 1], heard[j - 1])
        sub = 2 if d == 0 else (1 if d == 1 else -1)
        if score[i][j] == score[i - 1][j - 1] + sub:
            if d <= 1:
                pairs[i - 1] = j - 1
            i -= 1
            j -= 1
        elif score[i][j] == score[i - 1][j] - 1:
            i -= 1
        else:
            j -= 1
    return pairs


class WordCache:
    """Расшифровки предложений с границами слов. На диске, чтобы не платить дважды."""

    def __init__(self, path):
        self.path = path
        self.data = json.load(open(path)) if os.path.exists(path) else {}
        self.lock = threading.Lock()
        self.spent_seconds = 0.0

    def need(self, keys):
        return sorted(set(keys) - set(self.data))

    def fetch(self, key, wav_path, **kw):
        d = asr.words_of(wav_path, **kw) if kw else asr.words_of(wav_path)
        with self.lock:
            self.data[key] = {"words": d.get("words", []), "duration": d.get("duration")}
            self.spent_seconds += float(d.get("duration") or 0)

    def save(self):
        json.dump(self.data, open(self.path, "w"), ensure_ascii=False)


def make_cut(wav_path, start, end, pad, out_path, fade_ms=8):
    rate, samples = cut.read(wav_path)
    piece = cut.slice_fade(rate, samples, start - pad, end + pad, fade_ms=fade_ms)
    if not piece:
        return None
    cut.write(out_path, rate, piece)
    return rate, piece


def recognise(rate, piece):
    """Распознаватель не принимает файл короче ~0,1 с: короткая вырезка
    дополняется ТИШИНОЙ по краям (звучание слова от этого не меняется)."""
    pad = piece
    if len(pad) < int(rate * 0.4):
        sil = [0] * ((int(rate * 0.4) - len(pad)) // 2 + 1)
        pad = sil + pad + sil
    return asr.text_of(cut.to_bytes(rate, pad)), len(pad) / rate


def accepted(heard_text, want_word):
    """Критерий приёмки, выведенный числом в 7.168 и здесь не меняемый:
    в вырезке РОВНО одно слово, и оно отличается от нужного не более чем
    на одну букву (порог Левенштейна 1)."""
    ws = {w.lower() for w in W.findall(heard_text)}
    if len(ws) != 1:
        return False, f"в вырезке слов: {len(ws)}"
    h = next(iter(ws))
    if lev(h, norm(want_word)) > 1:
        return False, "вырезка звучит не тем словом"
    return True, ""


# --- расширение и сужение границ («метод Б») -----------------------------
#
# Границы, которые называет распознаватель, ошибаются в обе стороны: то
# отрезают начало слова («потом» → «Том»), то прихватывают соседнее. Поэтому
# у каждого места пробуется ЛЕСЕНКА полей, а не одно значение, и порядок
# лесенки выбирается по причине отказа, чтобы не платить за заведомо
# бесполезные попытки. Критерий приёмки при этом НЕ меняется ни на шаг:
# ровно одно слово в вырезке и расстояние Левенштейна ≤ 1 (7.168).

BASE_PAD = (0.03, 0.03)
EXPAND = [(0.07, 0.07), (0.12, 0.07), (0.07, 0.12), (0.14, 0.14)]
SHRINK = [(0.01, 0.01), (0.0, -0.04), (0.0, -0.08), (-0.03, -0.04)]


def ladder_for(why):
    """Первый шаг у всех один; дальше — по причине отказа."""
    if why.startswith("в вырезке слов") and why != "в вырезке слов: 0":
        return SHRINK + EXPAND[:2]
    return EXPAND + SHRINK[:1]


def try_place(wav_path, words_json, word_slot, want_word, out_path, budget=None, max_tries=6, first_why=None):
    """Пробует лесенку полей вокруг границ слова. Возвращает принятую попытку
    или последнюю неудачную."""
    ww = words_json["words"][word_slot]
    start, end = float(ww["start"]), float(ww["end"])
    tries, last, lad = [], None, None
    step = 0
    while True:
        if step == 0:
            lp, rp = BASE_PAD
        else:
            if lad is None:
                lad = ladder_for(first_why or (last["why"] if last else ""))
            if step - 1 >= len(lad) or step >= max_tries:
                break
            lp, rp = lad[step - 1]
        if budget is not None and not budget():
            break
        a, b = start - lp, end + rp
        r = make_cut(wav_path, a, b, 0.0, out_path)
        step += 1
        if r is None:
            last = {"pad": (lp, rp), "why": "вырезка пуста", "taken": False}
            tries.append(last)
            continue
        rate, piece = r
        if len(piece) < rate * 0.08:
            last = {"pad": (lp, rp), "why": "вырезка короче 80 мс", "taken": False}
            tries.append(last)
            continue
        try:
            text, _ = recognise(rate, piece)
        except Exception as e:
            last = {"pad": (lp, rp), "why": f"распознаватель отказал: {e}", "taken": False}
            tries.append(last)
            continue
        ok, why = accepted(text, want_word)
        last = {"pad": (lp, rp), "heard": text, "why": why, "taken": ok,
                "seconds": round(len(piece) / rate, 3),
                "start": round(a, 3), "end": round(b, 3)}
        tries.append(last)
        if ok:
            return last, tries
    return last, tries
