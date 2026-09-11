"""Вырезка слова из PCM-WAV: границы Whisper, 8 мс плавного входа/выхода."""
import wave, struct, io

def read(path):
    w = wave.open(path, "rb")
    p = w.getparams(); frames = w.readframes(w.getnframes()); w.close()
    assert p.sampwidth == 2 and p.nchannels == 1, p
    return p.framerate, list(struct.unpack("<%dh" % (len(frames) // 2), frames))

def write(path_or_buf, rate, samples):
    data = struct.pack("<%dh" % len(samples), *samples)
    w = wave.open(path_or_buf, "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
    w.writeframes(data); w.close()

def slice_fade(rate, samples, start_s, end_s, fade_ms=8):
    a = max(0, int(start_s * rate)); b = min(len(samples), int(end_s * rate))
    if b <= a: return []
    out = samples[a:b]
    n = min(int(rate * fade_ms / 1000), len(out) // 2)
    for i in range(n):
        k = i / n
        out[i] = int(out[i] * k)
        out[-1 - i] = int(out[-1 - i] * k)
    return out

def to_bytes(rate, samples):
    buf = io.BytesIO(); write(buf, rate, samples); return buf.getvalue()

def looped(rate, samples, times=3, gap_ms=120):
    gap = [0] * int(rate * gap_ms / 1000)
    out = []
    for i in range(times):
        if i: out += gap
        out += samples
    return out
