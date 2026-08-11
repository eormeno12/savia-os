"""Runner for MinerU2.5-Pro (opendatalab/MinerU2.5-Pro-2605-1.2B).

Unlike dots.ocr and Unlimited-OCR-MLX, this model runs via plain HuggingFace
transformers (no MLX conversion confirmed for it). It is dispatched to a
SEPARATE Python venv (.venv-mineru) rather than imported in-process, because
its transformers version requirement (>=4.51.1,<5.0.0) is incompatible with
mlx-vlm's (>=5.5.0,<5.13.0) already installed in the main .venv for dots.ocr —
verified directly via `importlib.metadata` on both packages, not guessed.
Installing both in one venv is not resolvable; a second venv keeps dots.ocr
and Unlimited-OCR-MLX (already working) untouched.

Trade-off accepted: the model is reloaded fresh on every call (no in-process
cache like the other two runners), since each call is its own subprocess. On
this Mac this costs ~2s extra per run (see mineru_worker.py) — a fast model —
so this was judged an acceptable simplicity/perf trade-off over building a
persistent worker server.
"""

import json
import os
import subprocess
import sys
import time
from typing import Callable, Optional

from PIL import Image

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VENV_PYTHON = os.path.join(BASE_DIR, ".venv-mineru", "bin", "python3")
MODEL_DIR = os.path.join(BASE_DIR, "weights", "mineru2.5-pro")
WORKER_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mineru_worker.py")

RESULT_MARKER = "RESULT_JSON::"


def run(
    image_path: str,
    image_analysis: bool = False,
    on_progress: Optional[Callable[[dict], None]] = None,
) -> dict:
    if not os.path.exists(VENV_PYTHON):
        raise RuntimeError(f"MinerU venv not found at {VENV_PYTHON} — see README setup instructions")
    if not os.path.exists(MODEL_DIR):
        raise RuntimeError(f"MinerU weights not found at {MODEL_DIR}")

    with Image.open(image_path) as im:
        width, height = im.size

    cmd = [VENV_PYTHON, WORKER_SCRIPT, "--model-dir", MODEL_DIR, "--image", image_path]
    if image_analysis:
        cmd.append("--image-analysis")

    start = time.time()
    if on_progress:
        on_progress({"phase": "cargando modelo", "elapsed": 0.0})

    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)

    # Coarse progress only: the worker is one subprocess call away, so we
    # can't get real per-block signals without depending on the library's
    # private batching internals (the same trap that caused repeated bugs in
    # the Unlimited-OCR integration). We report elapsed time on a heartbeat
    # instead of inventing a fake token/block count mid-flight.
    while proc.poll() is None:
        if on_progress:
            on_progress({"phase": "extrayendo", "elapsed": time.time() - start})
        time.sleep(0.5)

    stdout, stderr = proc.communicate()
    elapsed = time.time() - start

    if proc.returncode != 0:
        raise RuntimeError(f"mineru_worker.py failed (exit {proc.returncode}): {stderr.strip()[-4000:]}")

    result_line = None
    for line in stdout.splitlines():
        if line.startswith(RESULT_MARKER):
            result_line = line[len(RESULT_MARKER):]
            break
    if result_line is None:
        raise RuntimeError(f"mineru_worker.py produced no result line. stderr tail: {stderr.strip()[-2000:]}")

    payload = json.loads(result_line)
    blocks = payload["blocks"]

    # "raw_output" for this model is the JSON-serialized ContentBlock list —
    # that IS this library's actual raw structured output (two_step_extract()
    # returns parsed Python objects, not a flat text string the way dots.ocr
    # / Unlimited-OCR emit raw grounding text). The library does not expose
    # the underlying "<|box_start|>..." model text through its stable public
    # API (only via a debug logger line), so we don't scrape that.
    raw_output = json.dumps(blocks, ensure_ascii=False, indent=2)

    return {
        "raw_output": raw_output,
        "prompt_used": f"two_step_extract(image_analysis={image_analysis})",
        "elapsed_sec": elapsed,
        "tokens_generated": len(blocks),  # block count, not a token count — see README
        "unit_label": "bloques",
        "image_size": payload["image_size"],
        "device": payload["device"],
        "device_forced": payload["device_forced"],
        "logprobs_available": False,  # scored=True unsupported by the transformers backend (verified)
        "blocks": blocks,
    }
