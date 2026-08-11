"""Runs INSIDE .venv-mineru (isolated venv — see mineru_runner.py for why).

Loads MinerU2.5-Pro via transformers + MinerUClient, runs two_step_extract on
one image, prints a single JSON line to stdout prefixed with RESULT_MARKER.
Everything else the libraries print (tqdm progress bars, logger lines) goes to
stderr, so stdout stays clean for the parent process to parse.

Usage: python mineru_worker.py --model-dir DIR --image PATH [--image-analysis]
"""

import argparse
import json
import sys
import time

RESULT_MARKER = "RESULT_JSON::"

# Container block types with no textual content of their own (their children
# — the actual text/list_item/etc blocks — carry the real content and are
# emitted as their own separate blocks with bboxes contained inside these).
# Skipped so callers don't have to special-case a 6th "container" concept the
# fixed 5-value schema tipo has no slot for, and so bbox-overlap detection
# doesn't flag a container against its own children as reading-order-ambiguous.
CONTAINER_BLOCK_TYPES = {"list", "image_block", "equation_block"}


def eprint(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)
    sys.stderr.flush()


def load_model_and_processor(model_dir):
    """Load with device_map="auto"; verify placement; fall back if needed.

    Empirically (this Mac, transformers 4.57.6 + accelerate 1.14.0),
    device_map="auto" already resolves to a single "mps" device correctly —
    see the demo-ocr integration notes. This still verifies it programmatically
    rather than assuming, and has a real fallback path (explicit device_map,
    then CPU) in case a different transformers/accelerate combo behaves
    differently, since environments genuinely vary.
    """
    import torch
    from transformers import AutoProcessor, Qwen2VLForConditionalGeneration

    device_forced = False
    model = Qwen2VLForConditionalGeneration.from_pretrained(model_dir, dtype="auto", device_map="auto")
    device = next(model.parameters()).device

    if device.type == "cpu" and torch.backends.mps.is_available():
        eprint(f"[mineru_worker] device_map=auto landed on {device}; retrying with explicit mps")
        del model
        try:
            model = Qwen2VLForConditionalGeneration.from_pretrained(
                model_dir, dtype="auto", device_map={"": "mps"}
            )
            device = next(model.parameters()).device
            device_forced = True
        except Exception as e:
            eprint(f"[mineru_worker] explicit mps device_map failed ({e}); staying on CPU")

    processor = AutoProcessor.from_pretrained(model_dir, use_fast=True)
    return model, processor, device, device_forced


def block_to_dict(block):
    d = {
        "type": block.type,
        "bbox": block.bbox,
        "content": block.content,
    }
    if block.angle is not None:
        d["angle"] = block.angle
    return d


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", required=True)
    parser.add_argument("--image", required=True)
    parser.add_argument("--image-analysis", action="store_true")
    args = parser.parse_args()

    from PIL import Image
    from mineru_vl_utils import MinerUClient

    t0 = time.time()
    eprint("[mineru_worker] loading model...")
    model, processor, device, device_forced = load_model_and_processor(args.model_dir)
    load_elapsed = time.time() - t0
    eprint(f"[mineru_worker] loaded in {load_elapsed:.1f}s on device={device}")

    client = MinerUClient(
        backend="transformers",
        model=model,
        processor=processor,
        image_analysis=args.image_analysis,
        use_tqdm=False,
        # scored=True raises UnsupportedError for the transformers backend
        # (only vllm-engine / vllm-async-engine implement predict_scored) —
        # verified directly against vlm_client/*.py. So no per-token logprobs
        # are available here; the confianza_legibilidad_baja flag reports
        # "no_computable: sin logprobs expuestos" for this model, honestly.
    )

    image = Image.open(args.image)
    width, height = image.size

    t1 = time.time()
    result = client.two_step_extract(image, image_analysis=args.image_analysis)
    extract_elapsed = time.time() - t1

    blocks = [block_to_dict(b) for b in result if b.type not in CONTAINER_BLOCK_TYPES]

    payload = {
        "blocks": blocks,
        "image_size": [width, height],
        "load_elapsed_sec": load_elapsed,
        "extract_elapsed_sec": extract_elapsed,
        "device": str(device),
        "device_forced": device_forced,
        "image_analysis": args.image_analysis,
    }
    print(RESULT_MARKER + json.dumps(payload))
    sys.stdout.flush()


if __name__ == "__main__":
    main()
