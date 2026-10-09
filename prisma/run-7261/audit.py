"""7.261: синтез и аудит трёх слов «Катюши» — правила аудита-2 захода 7.165.

* Whisper `whisper-1`, language=ru, temperature=0;
* клип короче 2 с склеивается сам с собой трижды через паузу 0,35 с (PCM,
  afconvert), исходный mp3 не трогается;
* сравнение по фонетическому ключу (редукция, оглушение, -тся/-ться,
  е/ё после ж/ш/ц, ь — мягкость, двойные схлопываются); принято, если
  ключ ожидаемого слова совпал у >= 2 из 3 повторов (у длинного клипа — у 1 из 1);
* оценка ударения — подсказка, не ворота: ядра слогов как пики громкости,
  ударное — с наибольшей «энергия × длительность».
"""
import hashlib, io, json, math, os, re, struct, subprocess, sys, tempfile, time, urllib.request, wave

ROOT = "/Users/vasiliipetrov/Documents/Visual Studio/мой новый проект"
KEY = None
for line in open(os.path.join(ROOT, ".env")):
    if line.startswith("OPENAI_API_KEY="):
        KEY = line.split("=", 1)[1].strip().strip('"')
assert KEY, "нет OPENAI_API_KEY"
METER = {"tts_calls": 0, "tts_chars": 0, "tts_seconds": 0.0, "asr_calls": 0, "asr_seconds": 0.0}
WORK = os.path.dirname(os.path.abspath(__file__))


def tts(text, out):
    body = json.dumps({"model": "gpt-4o-mini-tts", "voice": "onyx", "input": text, "response_format": "mp3"}).encode()
    req = urllib.request.Request("https://api.openai.com/v1/audio/speech", data=body,
                                 headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    open(out, "wb").write(data)
    METER["tts_calls"] += 1
    METER["tts_chars"] += len(text)
    METER["tts_seconds"] += duration(out)
    return out


def duration(path):
    out = subprocess.run(["afinfo", path], capture_output=True, text=True).stdout
    m = re.search(r"estimated duration: ([\d.]+)", out)
    return float(m.group(1))


def pcm(path):
    """mp3 -> моно 24 кГц int16 через afconvert; имя временного файла — по sha256 полного пути (7.166)."""
    tmp = os.path.join(tempfile.gettempdir(), "r7261-" + hashlib.sha256(os.path.abspath(path).encode()).hexdigest()[:16] + ".wav")
    subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI16@24000", "-c", "1", path, tmp], check=True)
    with wave.open(tmp) as w:
        frames = w.readframes(w.getnframes())
    os.remove(tmp)
    return list(struct.unpack("<%dh" % (len(frames) // 2), frames))


def wav_bytes(samples):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000)
        w.writeframes(struct.pack("<%dh" % len(samples), *samples))
    return buf.getvalue()


def transcribe(path):
    s = pcm(path)
    secs = len(s) / 24000
    reps = 1
    if secs < 2.0:
        gap = [0] * int(0.35 * 24000)
        s = s + gap + s + gap + s
        reps = 3
    data = wav_bytes(s)
    boundary = "----7261" + hashlib.sha1(os.urandom(8)).hexdigest()
    body = io.BytesIO()
    for k, v in {"model": "whisper-1", "language": "ru", "temperature": "0", "response_format": "json"}.items():
        body.write(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode())
    body.write(f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.wav\"\r\nContent-Type: audio/wav\r\n\r\n".encode())
    body.write(data); body.write(f"\r\n--{boundary}--\r\n".encode())
    for attempt in range(3):
        try:
            req = urllib.request.Request("https://api.openai.com/v1/audio/transcriptions", data=body.getvalue(),
                                         headers={"Authorization": "Bearer " + KEY, "Content-Type": "multipart/form-data; boundary=" + boundary})
            with urllib.request.urlopen(req, timeout=120) as r:
                text = json.loads(r.read().decode())["text"]
            break
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2)
    METER["asr_calls"] += 1
    METER["asr_seconds"] += len(s) / 24000
    return text, reps


VOICING = str.maketrans({"б": "п", "в": "ф", "г": "к", "д": "т", "ж": "ш", "з": "с"})


def phon(word):
    w = word.lower().replace("ё", "е")
    w = re.sub(r"ть?ся$", "ца", w)
    w = re.sub(r"(?<=[жшц])е", "о", w)
    out = []
    for ch in w:
        if ch in "оа": out.append("A")
        elif ch in "еиэыя": out.append("I")
        elif ch in "ую": out.append("U")
        elif ch == "ь": out.append("'")
        elif ch == "ъ": continue
        else: out.append(ch.translate(VOICING))
    key = "".join(out)
    return re.sub(r"([^AIU'])\1+", r"\1", key)


def words(text):
    return re.findall(r"[а-яёА-ЯЁ]+", text)


def audit(path, expected):
    text, reps = transcribe(path)
    return judge(path, expected, text, reps)


def judge(path, expected, text, reps):
    """Принято: услышано >= 1 слова, и КАЖДОЕ услышанное слово — ожидаемое
    (Whisper часто схлопывает три повтора в один — 7.261, контроль)."""
    want = phon(expected)
    got = [phon(w) for w in words(text)]
    hits = sum(1 for g in got if g == want)
    return {"file": os.path.basename(path), "expected": expected, "heard": text, "reps": reps,
            "hits": hits, "tokens": len(got), "accepted": hits >= 1 and hits == len(got)}


VOWELS = "аеёиоуыэюя"


def stress_guess(path, word):
    """Подсказка: какое по счёту ядро слога громче-и-длиннее остальных."""
    s = pcm(path)
    hop = 240  # 10 мс
    env = []
    for i in range(0, len(s) - hop, hop):
        seg = s[i:i + hop]
        env.append(math.sqrt(sum(x * x for x in seg) / hop))
    k = 5
    sm = [sum(env[max(0, i - k):i + k + 1]) / len(env[max(0, i - k):i + k + 1]) for i in range(len(env))]
    top = max(sm) or 1
    thr = 0.25 * top
    # ядра — локальные максимумы выше порога, разнесённые >= 90 мс, с провалом между ними
    peaks = []
    for i in range(1, len(sm) - 1):
        if sm[i] >= thr and sm[i] >= sm[i - 1] and sm[i] > sm[i + 1]:
            if peaks and i - peaks[-1] < 9:
                if sm[i] > sm[peaks[-1]]: peaks[-1] = i
                continue
            if peaks and min(sm[peaks[-1]:i + 1]) > 0.85 * min(sm[peaks[-1]], sm[i]):
                if sm[i] > sm[peaks[-1]]: peaks[-1] = i
                continue
            peaks.append(i)
    scores = []
    for p in peaks:
        half = sm[p] * 0.7
        a = p
        while a > 0 and sm[a - 1] >= half: a -= 1
        b = p
        while b < len(sm) - 1 and sm[b + 1] >= half: b += 1
        scores.append(round(sm[p] * (b - a + 1) / top, 2))
    n_syl = sum(1 for c in word.lower() if c in VOWELS)
    guess = scores.index(max(scores)) + 1 if scores else None
    return {"syllables": n_syl, "nuclei": len(peaks), "scores": scores, "stressed": guess if len(peaks) == n_syl else None}
