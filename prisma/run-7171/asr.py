"""Расшифровка через Whisper: слова с границами для предложения и одно слово для вырезки.

Против 7.168 добавлено ровно одно: `words_of` умеет принимать иные
настройки (подсказку текстом предложения и температуру) — это и есть
«повторная расшифровка ДРУГИМИ настройками» метода Б. Плюс счётчик
секунд, чтобы цена захода называлась числом, а не оценкой.
"""
import json, os, sys, hashlib, urllib.request, io, threading, time

KEY = None
for line in open("/Users/vasiliipetrov/Documents/Visual Studio/мой новый проект/.env"):
    if line.startswith("OPENAI_API_KEY="):
        KEY = line.split("=", 1)[1].strip().strip('"')
assert KEY, "нет OPENAI_API_KEY"

METER = {"asr_seconds": 0.0, "asr_calls": 0, "tts_chars": 0, "tts_calls": 0}
_lock = threading.Lock()


def _post(path, fields, files, base="https://api.openai.com/v1/audio/", raw=False, retries=3):
    boundary = "----7171" + hashlib.sha1(os.urandom(8)).hexdigest()
    body = io.BytesIO()
    for k, v in fields.items():
        body.write(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode())
    for k, (name, data) in files.items():
        body.write(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"; filename=\"{name}\"\r\nContent-Type: audio/wav\r\n\r\n".encode())
        body.write(data)
        body.write(b"\r\n")
    body.write(f"--{boundary}--\r\n".encode())
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(base + path, data=body.getvalue(),
                headers={"Authorization": "Bearer " + KEY, "Content-Type": "multipart/form-data; boundary=" + boundary})
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            last = e
            time.sleep(1.5 * (attempt + 1))
    raise last


def words_of(path, prompt=None, temperature=None, model="whisper-1"):
    """verbose_json с границами слов."""
    fields = {"model": model, "language": "ru", "response_format": "verbose_json",
              "timestamp_granularities[]": "word"}
    if prompt is not None:
        fields["prompt"] = prompt
    if temperature is not None:
        fields["temperature"] = str(temperature)
    d = _post("transcriptions", fields, {"file": (os.path.basename(path), open(path, "rb").read())})
    with _lock:
        METER["asr_seconds"] += max(1.0, float(d.get("duration") or 0))
        METER["asr_calls"] += 1
    return d


def text_of(data_bytes, name="cut.wav", prompt=None):
    fields = {"model": "whisper-1", "language": "ru", "response_format": "json"}
    if prompt is not None:
        fields["prompt"] = prompt
    with _lock:
        METER["asr_seconds"] += 1.0  # тариф считает посекундно, минимум 1 с
        METER["asr_calls"] += 1
    return _post("transcriptions", fields, {"file": (name, data_bytes)})["text"]


def tts(text, voice, out_path, model="gpt-4o-mini-tts", fmt="mp3"):
    """Синтез предложения голосом каста. Параметры банка — из паспорта озвучки."""
    payload = json.dumps({"model": model, "voice": voice, "input": text,
                          "response_format": fmt}).encode()
    req = urllib.request.Request("https://api.openai.com/v1/audio/speech", data=payload,
        headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json"})
    last = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                data = r.read()
            open(out_path, "wb").write(data)
            with _lock:
                METER["tts_chars"] += len(text)
                METER["tts_calls"] += 1
            return out_path
        except Exception as e:
            last = e
            time.sleep(1.5 * (attempt + 1))
    raise last


def bill():
    """Тарифы, которыми считались все прежние заходы:
    whisper-1 — $0,006 за минуту; gpt-4o-mini-tts — $0,60 за 1 млн знаков ввода."""
    asr_usd = METER["asr_seconds"] / 60 * 0.006
    tts_usd = METER["tts_chars"] / 1_000_000 * 0.60
    return {"asr_seconds": round(METER["asr_seconds"], 1), "asr_calls": METER["asr_calls"],
            "asr_usd": round(asr_usd, 4), "tts_chars": METER["tts_chars"],
            "tts_calls": METER["tts_calls"], "tts_usd": round(tts_usd, 4),
            "usd": round(asr_usd + tts_usd, 4)}
