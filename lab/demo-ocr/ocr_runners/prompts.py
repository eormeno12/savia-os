"""Prompt catalogs for each model.

Every string here is copied verbatim from a documented source (see comments).
Nothing here is invented — prompt modes without a confirmed exact string were
left out per the task instructions.
"""

# --- dots.ocr (mlx-vlm) -----------------------------------------------------
# Sources:
#  - markdown / layout_all_en: Blaizzy/mlx-vlm README
#    (mlx_vlm/models/dots_ocr/README.md)
#  - layout_only_en / ocr / grounding_ocr: rednote-hilab/dots.ocr GitHub repo,
#    dots_ocr/utils/prompts.py (dict_promptmode_to_prompt), fetched verbatim.

DOTS_OCR_PROMPTS = [
    {
        "id": "markdown",
        "label": "Convertir a Markdown (orden de lectura)",
        "prompt": "Convert this page to clean Markdown while preserving reading order.",
        "needs_bbox": False,
    },
    {
        "id": "layout_all_en",
        "label": "Layout completo (bbox + categoría + texto, JSON)",
        "prompt": (
            "Please output the layout information from the PDF image, including "
            "each layout element's bbox, its category, and the corresponding "
            "text content within the bbox.\n\n"
            "1. Bbox format: [x1, y1, x2, y2]\n\n"
            "2. Layout Categories: The possible categories are ['Caption', "
            "'Footnote', 'Formula', 'List-item', 'Page-footer', 'Page-header', "
            "'Picture', 'Section-header', 'Table', 'Text', 'Title'].\n\n"
            "3. Text Extraction & Formatting Rules:\n"
            "    - Picture: For the 'Picture' category, the text field should "
            "be omitted.\n"
            "    - Formula: Format its text as LaTeX.\n"
            "    - Table: Format its text as HTML.\n"
            "    - All Others (Text, Title, etc.): Format their text as "
            "Markdown.\n\n"
            "4. Constraints:\n"
            "    - The output text must be the original text from the image, "
            "with no translation.\n"
            "    - All layout elements must be sorted according to human "
            "reading order.\n\n"
            "5. Final Output: The entire output must be a single JSON object."
        ),
        "needs_bbox": False,
    },
    {
        "id": "layout_only_en",
        "label": "Solo layout (bbox + categoría, sin texto)",
        "prompt": (
            "Please output the layout information from this PDF image, "
            "including each layout's bbox and its category. The bbox should "
            "be in the format [x1, y1, x2, y2]. The layout categories for the "
            "PDF document include ['Caption', 'Footnote', 'Formula', "
            "'List-item', 'Page-footer', 'Page-header', 'Picture', "
            "'Section-header', 'Table', 'Text', 'Title']. Do not output the "
            "corresponding text. The layout result should be in JSON format."
        ),
        "needs_bbox": False,
    },
    {
        "id": "ocr",
        "label": "OCR simple (todo el texto)",
        "prompt": "Extract the text content from this image.",
        "needs_bbox": False,
    },
    {
        "id": "grounding_ocr",
        "label": "OCR acotado a un bbox (vos elegís la región)",
        "prompt": "Extract text from the given bounding box on the image (format: [x1, y1, x2, y2]).\nBounding Box:\n",
        "needs_bbox": True,
    },
]

# --- Unlimited-OCR-MLX -------------------------------------------------------
# Source: user-provided list (own prior research). The leading "<image>\n"
# token is stripped here because the vendored inference.py already prepends
# its own "<image_placeholder>\n" token before the prompt text — sending both
# would duplicate the image token. See README note in this app for details.

UNLIMITED_OCR_PROMPTS = [
    {
        "id": "document_parsing",
        "label": "document parsing. (prompt propio documentado)",
        "prompt": "document parsing.",
        "needs_value": False,
    },
    {
        "id": "grounding_markdown",
        "label": "Convertir a markdown (con grounding)",
        "prompt": "<|grounding|>Convert the document to markdown.",
        "needs_value": False,
    },
    {
        "id": "grounding_ocr",
        "label": "OCR de la imagen (con grounding)",
        "prompt": "<|grounding|>OCR this image.",
        "needs_value": False,
    },
    {
        "id": "free_ocr",
        "label": "Free OCR",
        "prompt": "Free OCR.",
        "needs_value": False,
    },
    {
        "id": "locate",
        "label": "Localizar valor (campo libre)",
        "prompt": "Locate <|ref|>{value}<|/ref|> in the image.",
        "needs_value": True,
    },
    {
        "id": "parse_figure",
        "label": "Parse the figure",
        "prompt": "Parse the figure.",
        "needs_value": False,
    },
    {
        "id": "describe",
        "label": "Describe this image in detail",
        "prompt": "Describe this image in detail.",
        "needs_value": False,
    },
]

# --- MinerU2.5-Pro (mineru-vl-utils) -----------------------------------------
# Unlike the other two models, this one isn't prompted with free text — it's a
# fixed two-step pipeline (layout detection, then per-block content
# extraction) exposed as MinerUClient.two_step_extract(). The only real
# runtime "mode" switch it has is image_analysis (whether image/chart blocks
# also get a description pass), which the user asked to expose as its own
# toggle rather than force a choice between fixed prompt variants.

MINERU_MODES = [
    {
        "id": "two_step_extract",
        "label": "Extraer documento completo (layout + contenido)",
        "needs_image_analysis_toggle": True,
    },
]


def get_dots_ocr_prompt(prompt_id: str, bbox=None) -> str:
    for p in DOTS_OCR_PROMPTS:
        if p["id"] == prompt_id:
            text = p["prompt"]
            if p["needs_bbox"]:
                if not bbox or len(bbox) != 4:
                    raise ValueError(f"prompt '{prompt_id}' requires a 4-value bbox [x1,y1,x2,y2]")
                text += str([int(v) for v in bbox])
            return text
    raise ValueError(f"unknown dots.ocr prompt id: {prompt_id}")


def get_unlimited_ocr_prompt(prompt_id: str, value=None) -> str:
    for p in UNLIMITED_OCR_PROMPTS:
        if p["id"] == prompt_id:
            text = p["prompt"]
            if p["needs_value"]:
                if not value:
                    raise ValueError(f"prompt '{prompt_id}' requires a text value")
                text = text.format(value=value)
            return text
    raise ValueError(f"unknown unlimited_ocr prompt id: {prompt_id}")
