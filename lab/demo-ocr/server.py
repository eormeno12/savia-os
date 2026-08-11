"""Local comparison frontend for dots.ocr vs Unlimited-OCR-MLX vs MinerU2.5-Pro.

Plain Flask + static HTML/JS, no heavy frontend framework. Run with:
    .venv/bin/python server.py
"""

import io
import json
import os
import threading
import time
import traceback
import uuid

from flask import Flask, jsonify, request, send_file, send_from_directory
from PIL import Image

import schema_parser
from ocr_runners import dots_ocr_runner, mineru_runner, unlimited_ocr_runner
from ocr_runners.prompts import (
    DOTS_OCR_PROMPTS,
    MINERU_MODES,
    UNLIMITED_OCR_PROMPTS,
    get_dots_ocr_prompt,
    get_unlimited_ocr_prompt,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
STATIC_DIR = os.path.join(BASE_DIR, "static")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = Flask(__name__, static_folder=None)

MODEL_LOCK = threading.Lock()
JOBS = {}
JOBS_LOCK = threading.Lock()

PAGE_RENDER_DPI = 200


# ---------------------------------------------------------------------------
# static / index
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return send_from_directory(STATIC_DIR, "index.html")


@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory(STATIC_DIR, filename)


# ---------------------------------------------------------------------------
# upload / page rendering
# ---------------------------------------------------------------------------

def _doc_dir(doc_id):
    return os.path.join(UPLOAD_DIR, doc_id)


@app.route("/api/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify({"error": "no file field"}), 400
    f = request.files["file"]
    filename = f.filename or "upload"
    ext = os.path.splitext(filename)[1].lower()

    doc_id = uuid.uuid4().hex[:12]
    doc_dir = _doc_dir(doc_id)
    os.makedirs(doc_dir, exist_ok=True)

    if ext == ".pdf":
        original_path = os.path.join(doc_dir, "original.pdf")
        f.save(original_path)
        import fitz

        pdf = fitz.open(original_path)
        page_count = pdf.page_count
        pdf.close()
        return jsonify({"doc_id": doc_id, "kind": "pdf", "page_count": page_count, "filename": filename})
    else:
        # treat anything else as an image; normalize to PNG
        image = Image.open(f.stream).convert("RGB")
        original_path = os.path.join(doc_dir, "original.png")
        image.save(original_path)
        return jsonify({"doc_id": doc_id, "kind": "image", "page_count": 1, "filename": filename})


def _render_page_png(doc_id, page_num):
    """Return path to a cached PNG render of the given page (1-indexed)."""
    doc_dir = _doc_dir(doc_id)
    cache_path = os.path.join(doc_dir, f"page_{page_num}.png")
    if os.path.exists(cache_path):
        return cache_path

    pdf_path = os.path.join(doc_dir, "original.pdf")
    if os.path.exists(pdf_path):
        import fitz

        pdf = fitz.open(pdf_path)
        try:
            if page_num < 1 or page_num > pdf.page_count:
                raise FileNotFoundError(
                    f"page {page_num} out of range (document has {pdf.page_count} page(s))"
                )
            page = pdf[page_num - 1]
            pix = page.get_pixmap(dpi=PAGE_RENDER_DPI)
            pix.save(cache_path)
        finally:
            pdf.close()
        return cache_path

    image_path = os.path.join(doc_dir, "original.png")
    if os.path.exists(image_path):
        if page_num != 1:
            raise FileNotFoundError("image documents only have page 1")
        return image_path

    raise FileNotFoundError(f"no document found for doc_id={doc_id}")


@app.route("/api/page-image/<doc_id>/<int:page_num>")
def page_image(doc_id, page_num):
    try:
        path = _render_page_png(doc_id, page_num)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    return send_file(path, mimetype="image/png")


# ---------------------------------------------------------------------------
# prompts catalog
# ---------------------------------------------------------------------------

@app.route("/api/prompts")
def prompts():
    return jsonify({
        "dots_ocr": [{"id": p["id"], "label": p["label"], "needs_bbox": p["needs_bbox"]} for p in DOTS_OCR_PROMPTS],
        "unlimited_ocr": [{"id": p["id"], "label": p["label"], "needs_value": p["needs_value"]} for p in UNLIMITED_OCR_PROMPTS],
        "mineru": [
            {"id": p["id"], "label": p["label"], "needs_image_analysis_toggle": p["needs_image_analysis_toggle"]}
            for p in MINERU_MODES
        ],
    })


# ---------------------------------------------------------------------------
# run jobs
# ---------------------------------------------------------------------------

CONFIANZA_THRESHOLD = -1.5  # ln(p) < -1.5  =>  p < ~22%; heuristic, see README


def _run_job(job_id, doc_id, page_num, tasks):
    job = JOBS[job_id]
    try:
        image_path = _render_page_png(doc_id, page_num)
        with Image.open(image_path) as im:
            page_w, page_h = im.size

        results = []
        for i, task in enumerate(tasks):
            job["current"] = i
            job["status"] = "loading_model" if i == 0 else "running"
            model = task["model"]
            prompt_id = task["prompt_id"]

            def progress_cb(info, i=i):
                job["progress"][i] = info

            try:
                with MODEL_LOCK:
                    job["status"] = "running"
                    if model == "dots_ocr":
                        prompt_text = get_dots_ocr_prompt(prompt_id, bbox=task.get("bbox"))
                        raw = dots_ocr_runner.run(image_path, prompt_text, on_progress=progress_cb)
                        schema, coord_space = schema_parser.parse_dots_ocr_output(
                            raw["raw_output"], prompt_id, page_num, page_w, page_h,
                            token_spans=raw.get("token_spans"),
                            logprobs_available=raw.get("logprobs_available", False),
                            confianza_threshold=CONFIANZA_THRESHOLD,
                        )
                    elif model == "unlimited_ocr":
                        prompt_text = get_unlimited_ocr_prompt(prompt_id, value=task.get("value"))
                        raw = unlimited_ocr_runner.run(image_path, prompt_text, on_progress=progress_cb)
                        schema, coord_space = schema_parser.parse_unlimited_ocr_output(
                            raw["raw_output"], page_num, page_w, page_h,
                            token_spans=raw.get("token_spans"),
                            logprobs_available=raw.get("logprobs_available", False),
                            confianza_threshold=CONFIANZA_THRESHOLD,
                        )
                    elif model == "mineru":
                        raw = mineru_runner.run(
                            image_path, image_analysis=bool(task.get("image_analysis")), on_progress=progress_cb
                        )
                        schema, coord_space = schema_parser.parse_mineru_output(
                            raw["raw_output"], page_num, page_w, page_h,
                            logprobs_available=raw.get("logprobs_available", False),
                            confianza_threshold=CONFIANZA_THRESHOLD,
                        )
                    else:
                        raise ValueError(f"unknown model {model}")

                results.append({
                    "model": model,
                    "prompt_id": prompt_id,
                    "prompt_used": raw["prompt_used"],
                    "raw_output": raw["raw_output"],
                    "elapsed_sec": raw["elapsed_sec"],
                    "tokens_generated": raw["tokens_generated"],
                    "unit_label": raw.get("unit_label", "tokens"),
                    "device": raw.get("device"),
                    "device_forced": raw.get("device_forced"),
                    "image_size": raw["image_size"],
                    "logprobs_available": raw.get("logprobs_available", False),
                    "coord_space": coord_space,
                    "schema": schema,
                    "error": None,
                })
            except Exception as e:
                traceback.print_exc()
                results.append({
                    "model": model,
                    "prompt_id": prompt_id,
                    "error": f"{type(e).__name__}: {e}",
                })

        job["results"] = results
        job["status"] = "done"
    except Exception as e:
        traceback.print_exc()
        job["status"] = "error"
        job["error"] = f"{type(e).__name__}: {e}"


@app.route("/api/run", methods=["POST"])
def run():
    body = request.get_json(force=True)
    doc_id = body["doc_id"]
    page_num = int(body["page_num"])
    tasks = body["jobs"]

    job_id = uuid.uuid4().hex[:12]
    with JOBS_LOCK:
        JOBS[job_id] = {
            "status": "queued",
            "current": 0,
            "total": len(tasks),
            "progress": [{} for _ in tasks],
            "results": None,
            "error": None,
        }

    t = threading.Thread(target=_run_job, args=(job_id, doc_id, page_num, tasks), daemon=True)
    t.start()

    return jsonify({"job_id": job_id})


@app.route("/api/run/<job_id>")
def run_status(job_id):
    job = JOBS.get(job_id)
    if job is None:
        return jsonify({"error": "unknown job_id"}), 404
    return jsonify(job)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8765, debug=False, threaded=True)
