"""Runner for dots.ocr (mlx-community/dots.ocr-4bit) via mlx-vlm."""

import time
from typing import Callable, Optional

from PIL import Image

MODEL_ID = "mlx-community/dots.ocr-4bit"

_cache = {}


def get_model():
    if "model" not in _cache:
        from mlx_vlm import load

        model, processor = load(MODEL_ID)
        _cache["model"] = model
        _cache["processor"] = processor
    return _cache["model"], _cache["processor"]


def run(
    image_path: str,
    prompt: str,
    max_tokens: int = 4096,
    on_progress: Optional[Callable[[dict], None]] = None,
) -> dict:
    from mlx_vlm import apply_chat_template, stream_generate

    model, processor = get_model()
    formatted_prompt = apply_chat_template(processor, model.config, prompt, num_images=1)

    with Image.open(image_path) as im:
        width, height = im.size

    start = time.time()
    text_parts = []
    token_spans = []  # [(start_char, end_char, logprob), ...] into the final raw_output
    cursor = 0
    tokens = 0

    for result in stream_generate(
        model,
        processor,
        formatted_prompt,
        image=[image_path],
        max_tokens=max_tokens,
        temperature=0.0,
    ):
        segment = result.text
        text_parts.append(segment)
        tokens += 1

        lp = None
        if result.logprobs is not None and result.token is not None:
            try:
                lp = float(result.logprobs[result.token])
            except Exception:
                lp = None

        if segment:
            token_spans.append((cursor, cursor + len(segment), lp))
            cursor += len(segment)

        if on_progress:
            on_progress(
                {
                    "tokens_generated": tokens,
                    "elapsed": time.time() - start,
                    "text_so_far": "".join(text_parts),
                }
            )

    elapsed = time.time() - start
    full_text = "".join(text_parts)
    logprobs_available = any(lp is not None for (_, _, lp) in token_spans)

    return {
        "raw_output": full_text,
        "prompt_used": prompt,
        "elapsed_sec": elapsed,
        "tokens_generated": tokens,
        "image_size": [width, height],
        "token_spans": token_spans,
        "logprobs_available": logprobs_available,
    }
