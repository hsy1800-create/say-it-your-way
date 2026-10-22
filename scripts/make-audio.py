"""원어민 소리 파일을 만든다(Kokoro, 목소리 af_heart, 미국 영어).

먼저 `node scripts/audio-list.mjs`로 만들 목록(scripts/audio-todo.json)을 뽑은 뒤 실행한다.
  python3 scripts/make-audio.py <kokoro-v1.0.onnx> <voices-v1.0.bin>
모델 파일: https://github.com/thewh1teagle/kokoro-onnx/releases (model-files-v1.0)
필요한 것: pip install kokoro-onnx soundfile, ffmpeg
"""
import json, subprocess, sys, time
from pathlib import Path

import numpy as np
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "audio"
VOICE, SPEED = "af_heart", 0.9


def trim(samples, sr):
    loud = np.where(np.abs(samples) > 0.012)[0]
    if not len(loud):
        return samples
    a = max(0, loud[0] - int(0.06 * sr))
    b = min(len(samples), loud[-1] + int(0.12 * sr))
    return samples[a:b]


def to_mp3(samples, sr, path):
    pcm = (np.clip(samples, -1, 1) * 32767).astype("<i2").tobytes()
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-y", "-f", "s16le", "-ar", str(sr), "-ac", "1", "-i", "-",
         "-ac", "1", "-b:a", "40k", str(path)],
        input=pcm, check=True)


def main():
    model, voices = sys.argv[1], sys.argv[2]
    todo = json.loads((ROOT / "scripts" / "audio-todo.json").read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    k = Kokoro(model, voices)
    t0 = time.time()
    for i, item in enumerate(todo, 1):
        path = OUT / item["file"]
        if path.exists():
            continue
        say = item["say"]
        # 낱말 하나도 문장처럼 끝을 내려 읽도록 마침표를 붙인다.
        if say[-1] not in ".!?…,":
            say += "."
        samples, sr = k.create(say, voice=VOICE, speed=SPEED, lang="en-us")
        to_mp3(trim(samples, sr), sr, path)
        if i % 50 == 0 or i == len(todo):
            print(f"{i}/{len(todo)}  {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
