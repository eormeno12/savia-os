"""Runner for Unlimited-OCR-MLX (LoJexLLM/Unlimited-OCR-MLX).

Reuses the vendored package's loader/tokenizer/preprocessing as-is, but
reimplements the generation loop (instead of calling
UnlimitedOCRInference.infer_single) so we can capture a real per-token
logprob and stream progress — the vendored infer_single() only returns the
final decoded string.

Weight loading also fixes a real bug in the checkpoint published on HF: the
`sam_model.neck.*` keys are named as if `neck` were a plain PyTorch
nn.Sequential (`neck.0.weight`, `neck.1.weight`, ...), but MLX's
`mlx.nn.Sequential` nests its children under `.layers.` (`neck.layers.0...`).
That is the ONLY affected submodule out of 2710 total weight keys — verified
directly against model.safetensors — so we remap just those 6 keys before
calling load_weights() instead of silently dropping them (dropping them
would leave the vision encoder's neck at its random init, degrading OCR
quality without raising any error).
"""

import os
import re
import sys
import time
from typing import Callable, Optional

import numpy as np

WEIGHTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "weights")
MODEL_DIR = os.path.join(WEIGHTS_DIR, "unlimited_ocr_mlx")

if WEIGHTS_DIR not in sys.path:
    sys.path.insert(0, WEIGHTS_DIR)

_cache = {}

_NECK_KEY_RE = re.compile(r"(sam_model\.neck)\.(\d+)\.")


def _load_model_fixed(model_dir: str):
    import json as _json

    import mlx.core as mx
    import safetensors.torch
    from unlimited_ocr_mlx.config import UnlimitedOCRConfig
    from unlimited_ocr_mlx.model import UnlimitedOCRModel

    with open(os.path.join(model_dir, "config.json")) as f:
        config_dict = _json.load(f)
    config = UnlimitedOCRConfig.from_original_config(config_dict)

    weights_path = os.path.join(model_dir, "model.safetensors")
    st_weights = safetensors.torch.load_file(weights_path, device="cpu")

    weights = {}
    remapped = 0
    for k, v in st_weights.items():
        fixed_k = _NECK_KEY_RE.sub(r"\1.layers.\2.", k)
        if fixed_k != k:
            remapped += 1
        weights[fixed_k] = mx.array(v.float().numpy())
    if remapped:
        print(f"[unlimited_ocr_runner] remapped {remapped} sam_model.neck.* keys to match mlx.nn.Sequential layout")

    model = UnlimitedOCRModel(config)

    # The checkpoint's Conv2d weights are still in PyTorch's OIHW layout
    # (out, in, kH, kW); MLX's nn.Conv2d expects OHWI (out, kH, kW, in) since
    # it operates on NHWC activations. convert.py evidently never permuted
    # them. Fix is self-verifying: only transpose a tensor when doing so
    # makes its shape match what this exact model expects for that exact
    # parameter name — so a tensor that's already correctly shaped, or that
    # a transpose wouldn't fix, is left untouched rather than guessed at.
    from mlx.utils import tree_flatten

    expected_shapes = {k: tuple(v.shape) for k, v in tree_flatten(model.parameters())}
    conv_transposed = 0
    for k, v in list(weights.items()):
        expected = expected_shapes.get(k)
        if expected is None or tuple(v.shape) == expected or v.ndim != 4:
            continue
        candidate = v.transpose(0, 2, 3, 1)
        if tuple(candidate.shape) == expected:
            weights[k] = candidate
            conv_transposed += 1
    if conv_transposed:
        print(f"[unlimited_ocr_runner] transposed {conv_transposed} Conv2d weights from OIHW to OHWI")
    # strict=False only because of one further, separately-verified gap:
    # vision_model.embeddings.position_ids is a deterministic mx.arange(...)
    # buffer (model.py:811), not a learned weight, and was never in the
    # checkpoint to begin with — verified by diffing model.parameters() keys
    # against the (neck-remapped) checkpoint keys: that is the only mismatch
    # left. strict=False would also silently ignore any *other* accidental
    # mismatch, but there isn't one here.
    model.load_weights(list(weights.items()), strict=False)
    mx.eval(model.parameters())
    return model


def _load_tokenizer_fixed(model_dir: str):
    """Load the tokenizer without going through AutoTokenizer.

    The vendored load_tokenizer() calls
    AutoTokenizer.from_pretrained(model_dir, trust_remote_code=True), which
    reads config.json's auto_map (AutoConfig -> "config.UnlimitedOCRConfig")
    and tries to dynamically import that MLX-only dataclass and call
    register_for_auto_class() on it as if it were a transformers
    PretrainedConfig — it isn't, so that raises AttributeError. The repo
    ships a plain tokenizer.json (fast tokenizer, no custom tokenizer class),
    so we load that directly and attach special tokens from
    special_tokens_map.json / tokenizer_config.json ourselves.
    """
    import json as _json

    from transformers import PreTrainedTokenizerFast

    with open(os.path.join(model_dir, "special_tokens_map.json")) as f:
        special = _json.load(f)
    with open(os.path.join(model_dir, "tokenizer_config.json")) as f:
        tok_cfg = _json.load(f)

    def _tokstr(v):
        return v["content"] if isinstance(v, dict) else v

    tokenizer = PreTrainedTokenizerFast(tokenizer_file=os.path.join(model_dir, "tokenizer.json"))
    tokenizer.bos_token = _tokstr(special.get("bos_token") or tok_cfg.get("bos_token"))
    tokenizer.eos_token = _tokstr(special.get("eos_token") or tok_cfg.get("eos_token"))
    tokenizer.pad_token = _tokstr(special.get("pad_token") or tok_cfg.get("pad_token"))
    return tokenizer


def get_engine():
    if "engine" not in _cache:
        from unlimited_ocr_mlx.inference import UnlimitedOCRInference

        engine = UnlimitedOCRInference(MODEL_DIR)
        engine.model = _load_model_fixed(MODEL_DIR)
        engine.tokenizer = _load_tokenizer_fixed(MODEL_DIR)
        _cache["engine"] = engine
    return _cache["engine"]


def run(
    image_path: str,
    prompt: str,
    max_length: int = 4096,
    base_size: int = 1024,
    image_size: int = 1024,
    crop_mode: bool = False,
    on_progress: Optional[Callable[[dict], None]] = None,
) -> dict:
    # crop_mode defaults to False ("Base Mode" per the model's own README)
    # because the dynamic-tiling path (crop_mode=True, "Gundam Mode") has a
    # separate, unresolved reshape bug in the SAM encoder's local-crop
    # branch — see the demo-ocr report for details. Base Mode is a real,
    # documented mode of this model, not a substitute.
    import mlx.core as mx
    from unlimited_ocr_mlx.image_processing import load_image as _load

    engine = get_engine()
    model = engine.model
    tokenizer = engine.tokenizer

    image = _load(image_path)
    if image is None:
        raise ValueError(f"Cannot load image: {image_path}")
    width, height = image.size

    from unlimited_ocr_mlx.image_processing import preprocess_image

    patches_arr, orig_arr, crop_shape = preprocess_image(
        image, base_size=base_size, image_size=image_size, crop_mode=crop_mode
    )

    patches_mx = mx.array(patches_arr) if patches_arr.shape[0] > 0 else None
    orig_mx = mx.array(orig_arr)

    images = [[patches_mx, orig_mx]]
    images_spatial_crop = [crop_shape] if crop_mode else [(1, 1)]

    # The vendored infer_single() precomputes n_image_tokens from a formula
    # ("256 + 16 newlines + separator, roughly" per its own comment) instead
    # of asking the vision encoder — that formula is off by 1 in practice
    # (272 assumed vs 273 actual for base_size=1024, crop_mode=False; the
    # discrepancy showed up as a broadcast_shapes crash inside model.py's
    # embedding-merge step). We call encode_images() ourselves first to get
    # the real per-image feature count instead of guessing. This runs vision
    # encoding twice (once here, once inside model()'s own forward pass) —
    # a wasted but harmless bit of extra compute, not a correctness issue.
    image_features = model.encode_images(images, images_spatial_crop)
    n_image_tokens = int(image_features[0].shape[0])

    # Prompt construction follows the canonical DeepSeek-OCR "plain" template
    # (deepseek-ai/DeepSeek-OCR modeling_deepseekocr.py: conversation with
    # sft_format="plain" renders NO role markers — just the raw content
    # "<image>\n<prompt>"). The vendored inference.py instead wrapped the
    # prompt in literal "User: <image_placeholder>\n...\nAssistant: ", where
    # "<image_placeholder>" is NOT a token in this tokenizer — it BPE-shatters
    # into 5 junk subword ids ([30,10253,65,78482,32]) that stay in the
    # sequence and, together with the spurious role text, push the LM off its
    # training distribution. Here we build the plain sequence directly:
    #   [BOS] + [<image> id] * n_image_tokens + encode("\n" + prompt)
    # The real "<image>" token id is 128815; those positions get overwritten by
    # the vision features via seq_mask, so the id only needs to be the correct
    # placeholder for training-distribution parity. "<|grounding|>" etc. in the
    # caller's prompt already tokenize as their own special tokens.
    IMAGE_TOKEN_ID = 128815  # "<image>" (verified single special token)
    bos_id = tokenizer.bos_token_id
    post_ids = tokenizer.encode("\n" + prompt, add_special_tokens=False)
    extended_ids = [bos_id] + [IMAGE_TOKEN_ID] * n_image_tokens + post_ids
    seq_mask = np.zeros(len(extended_ids), dtype=bool)
    seq_mask[1:1 + n_image_tokens] = True

    input_ids_mx = mx.array([extended_ids], dtype=mx.int32)
    images_seq_mask_mx = mx.array(seq_mask[None, :], dtype=mx.bool_)

    eos_token_id = tokenizer.eos_token_id

    start = time.time()
    generated_tokens = []
    token_logprobs = []

    output = model(
        input_ids=input_ids_mx,
        images=images,
        images_seq_mask=images_seq_mask_mx,
        images_spatial_crop=images_spatial_crop,
        use_cache=True,
    )
    past_kv = output.past_key_values
    logits = output.logits[:, -1, :]

    tokens_generated = 0

    for _step in range(max_length):
        logprobs_vec = logits.astype(mx.float32) - mx.logsumexp(logits.astype(mx.float32), axis=-1, keepdims=True)
        next_token = mx.argmax(logits, axis=-1, keepdims=True)
        token_id = int(next_token.item())
        token_lp = float(logprobs_vec[0, token_id].item())

        generated_tokens.append(token_id)
        token_logprobs.append(token_lp)
        tokens_generated += 1

        if token_id == eos_token_id:
            break

        if on_progress and tokens_generated % 4 == 0:
            on_progress(
                {
                    "tokens_generated": tokens_generated,
                    "elapsed": time.time() - start,
                }
            )

        output = model(
            input_ids=next_token,
            past_key_values=past_kv,
            use_cache=True,
        )
        past_kv = output.past_key_values
        logits = output.logits[:, -1, :]

    elapsed = time.time() - start

    # Decode WITH special tokens preserved (skip_special_tokens=False), minus a
    # trailing EOS. This model's grounding output IS structured with special
    # tokens — "<|det|>label [x1,y1,x2,y2]<|/det|>text" per block (normalized
    # 0-999 coords) — so stripping them (as engine.decode_text does) would throw
    # away the bboxes the schema parser needs. We keep them in raw_output.
    content_tokens = list(generated_tokens)
    if content_tokens and content_tokens[-1] == eos_token_id:
        content_tokens = content_tokens[:-1]
        token_logprobs_for_spans = token_logprobs[:-1]
    else:
        token_logprobs_for_spans = token_logprobs
    result_text = tokenizer.decode(content_tokens, skip_special_tokens=False)

    # Build per-token character spans into result_text by locating each
    # individually-decoded token fragment in order (batch decode is the
    # canonical text; individual decode can differ slightly at boundaries,
    # so we search forward from the running cursor rather than trust offsets
    # from concatenating individual fragments directly).
    token_spans = []
    cursor = 0
    for token_id, lp in zip(content_tokens, token_logprobs_for_spans):
        frag = tokenizer.decode([token_id], skip_special_tokens=False)
        if not frag:
            continue
        idx = result_text.find(frag, cursor)
        if idx == -1:
            continue
        token_spans.append((idx, idx + len(frag), lp))
        cursor = idx + len(frag)

    return {
        "raw_output": result_text,
        "prompt_used": prompt,
        "elapsed_sec": elapsed,
        "tokens_generated": tokens_generated,
        "image_size": [width, height],
        "crop_shape": list(crop_shape),
        "base_size": base_size,
        "image_size_param": image_size,
        "crop_mode": crop_mode,
        "token_spans": token_spans,
        "logprobs_available": True,
    }
