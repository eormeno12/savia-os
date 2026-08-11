"""Structural (no-LLM) parser: raw model output -> bloques schema.

Every rule applied here is deterministic and documented inline. Nothing in
this file calls a model — it only pattern-matches the text a model already
produced (see AL_FINAL.md for the full rule list as given by the user).
"""

import json
import re

TIPOS = {
    "titulo_documento",
    "parrafo",
    "encabezado_seccion",
    "item_lista",
    "elemento_no_textual",
}

# dots.ocr layout category -> schema tipo
DOTS_CATEGORY_MAP = {
    "Title": "titulo_documento",
    "Section-header": "encabezado_seccion",
    "List-item": "item_lista",
    "Picture": "elemento_no_textual",
    # Table, Formula, Text, Caption, Footnote, Page-header, Page-footer:
    # none of these map onto the 5 allowed tipos, so they fall back to
    # "parrafo" per the fallback rule.
}

REFERENCIA_FUERA_DE_PAGINA_PATTERNS = [
    r"cont[ií]n[uú]a? en la p[aá]gina",
    r"contin[uú]a en p[aá]g",
    r"sigue en la p[aá]gina",
    r"ver p[aá]gina",
    r"continued on page",
    r"see page \d+",
    r"cont'?d on page",
]

# Two grounding output shapes observed from Unlimited-OCR (DeepSeek-OCR family):
#
#   (A) "<|ref|>TEXT<|/ref|><|det|>[[x1,y1,x2,y2]]<|/det|>"   (e.g. the Locate prompt)
#   (B) "<|det|>LABEL [x1,y1,x2,y2]<|/det|>TEXT"              (grounding OCR / markdown)
#
# Both carry normalized 0-999 bboxes. LABEL in (B) is the model's own layout
# category (title/text/image/image_caption/footer/...).
GROUNDING_REF_RE = re.compile(
    r"<\|ref\|>(?P<text>.*?)<\|/ref\|>\s*<\|det\|>\s*\[*\s*(?P<coords>[\d\.\s,]+?)\s*\]*\s*<\|/det\|>",
    re.DOTALL,
)
GROUNDING_DET_LABEL_RE = re.compile(
    r"<\|det\|>\s*(?P<label>[A-Za-z_]+)?\s*\[(?P<coords>[\d\.\s,]+?)\]\s*<\|/det\|>"
    r"(?P<text>.*?)(?=<\|det\|>|$)",
    re.DOTALL,
)

# Unlimited-OCR layout label -> schema tipo (deterministic; documented per block)
UNLIMITED_LABEL_MAP = {
    "image": "elemento_no_textual",
    "figure": "elemento_no_textual",
    "footer": "parrafo",
    "header": "parrafo",
    "image_caption": "parrafo",
    "caption": "parrafo",
    "text": "parrafo",
}

BORDE_PCT = 0.02  # "~2% del borde inferior/derecho" as given


def _extract_json(raw_text: str):
    """Best-effort JSON extraction from a model's raw text output."""
    raw_text = raw_text.strip()
    # strip markdown code fences if present
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", raw_text, re.DOTALL)
    if fence:
        raw_text = fence.group(1).strip()
    try:
        return json.loads(raw_text)
    except Exception:
        pass
    # fall back: widest [...] or {...} span in the text
    for open_c, close_c in (("[", "]"), ("{", "}")):
        start = raw_text.find(open_c)
        end = raw_text.rfind(close_c)
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(raw_text[start:end + 1])
            except Exception:
                continue
    return None


def _classify_markdown_line(line: str, is_first_block: bool):
    stripped = line.strip()
    if re.match(r"^#{1,6}\s+\S", stripped):
        return "encabezado_seccion", "markdown_heading(#)"
    if re.match(r"^[-*]\s+\S", stripped) or re.match(r"^\d+[.)]\s+\S", stripped):
        return "item_lista", "markdown_list_marker"
    if is_first_block:
        return "titulo_documento", "primera_linea_del_output"
    return "parrafo", "fallback_parrafo"


def _split_plain_text_blocks(text: str):
    """Split plain/markdown text into (texto, start, end) blocks on blank lines."""
    blocks = []
    cursor = 0
    for chunk in re.split(r"\n\s*\n", text):
        chunk_stripped = chunk.strip("\n")
        if not chunk_stripped.strip():
            cursor = text.find(chunk, cursor) + len(chunk)
            continue
        start = text.find(chunk, cursor)
        if start == -1:
            start = cursor
        end = start + len(chunk_stripped)
        blocks.append((chunk_stripped, start, end))
        cursor = end
    return blocks


def _token_logprob_for_span(token_spans, start, end):
    if not token_spans:
        return None
    vals = [lp for (s, e, lp) in token_spans if lp is not None and s < end and e > start]
    if not vals:
        return None
    return sum(vals) / len(vals)


def _apply_confianza_flag(flags, texto, start, end, token_spans, logprobs_available, threshold):
    if not logprobs_available:
        flags.append("no_computable: sin logprobs expuestos")
        return
    if not texto:
        return
    mean_lp = _token_logprob_for_span(token_spans, start, end) if start is not None else None
    if mean_lp is None:
        flags.append("no_computable: texto no localizable en output crudo para mapear logprobs")
        return
    if mean_lp < threshold:
        flags.append("confianza_legibilidad_baja")


def _apply_referencia_fuera_de_pagina(flags, texto):
    for pat in REFERENCIA_FUERA_DE_PAGINA_PATTERNS:
        if re.search(pat, texto, re.IGNORECASE):
            flags.append("referencia_fuera_de_pagina")
            return


def _bbox_edge_check(bbox, page_w, page_h):
    if bbox is None or not page_w or not page_h:
        return False
    x1, y1, x2, y2 = bbox
    near_right = x2 >= page_w * (1 - BORDE_PCT)
    near_bottom = y2 >= page_h * (1 - BORDE_PCT)
    return near_right or near_bottom


def _overlaps(a, b):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    return ax1 < bx2 and bx1 < ax2 and ay1 < by2 and by1 < ay2


def _flag_orden_lectura_ambiguo(bloques):
    """Flag blocks whose bbox overlaps a NON-contiguous block in reading order."""
    for i, bi in enumerate(bloques):
        if bi["bbox"] is None:
            continue
        for j, bj in enumerate(bloques):
            if bj["bbox"] is None or abs(i - j) <= 1:
                continue
            if _overlaps(bi["bbox"], bj["bbox"]):
                if "orden_lectura_ambiguo" not in bi["flags"]:
                    bi["flags"].append("orden_lectura_ambiguo")
                break


def _guess_coord_space(bboxes, image_width, image_height):
    if not bboxes:
        return "sin_bbox"
    max_val = max(v for bbox in bboxes for v in bbox)
    if max_val <= 1000 and (image_width > 1100 or image_height > 1100):
        return "normalizado_0_1000 (heurística: valores <=1000 en una imagen mayor a 1000px)"
    if max_val <= max(image_width, image_height) * 1.05:
        return "pixeles_reales (heurística: valores en rango de las dimensiones de la imagen)"
    return "desconocido (valores fuera de rango esperado, revisar manualmente)"


def parse_dots_ocr_output(
    raw_output,
    prompt_id,
    page_number,
    image_width,
    image_height,
    token_spans=None,
    logprobs_available=False,
    confianza_threshold=-1.5,
):
    bloques = []
    seccion_actual = None
    all_bboxes = []

    if prompt_id in ("layout_all_en", "layout_only_en"):
        data = _extract_json(raw_output)
        items = data if isinstance(data, list) else (data or {}).get("layout") if isinstance(data, dict) else None
        if items is None:
            items = []
        for item in items if isinstance(items, list) else []:
            if not isinstance(item, dict):
                continue
            category = item.get("category", "")
            texto = item.get("text", "") or ""
            bbox = item.get("bbox")
            if isinstance(bbox, list) and len(bbox) == 4:
                bbox = [float(v) for v in bbox]
                all_bboxes.append(bbox)
            else:
                bbox = None

            tipo = DOTS_CATEGORY_MAP.get(category, "parrafo")
            tipo_regla = f"categoria_json:{category}" if category in DOTS_CATEGORY_MAP else f"fallback_parrafo(categoria_json:{category})"

            if tipo == "encabezado_seccion":
                seccion_actual = len([b for b in bloques if b["tipo"] == "encabezado_seccion"]) + 1

            flags = []
            if _bbox_edge_check(bbox, image_width, image_height) if bbox else False:
                flags.append("truncado_borde_pagina")
            elif bbox is None:
                flags.append("no_computable: sin bbox")

            _apply_referencia_fuera_de_pagina(flags, texto)

            if tipo == "elemento_no_textual" and texto.strip():
                flags.append("elemento_no_textual")

            bloques.append({
                "tipo": tipo,
                "tipo_regla": tipo_regla,
                "texto": texto,
                "bbox": bbox,
                "seccion": seccion_actual if tipo != "encabezado_seccion" else None,
                "flags": flags,
            })

        # orden_lectura_ambiguo: needs pairwise bbox overlap check among non-adjacent blocks
        for i, bi in enumerate(bloques):
            if bi["bbox"] is None:
                continue
            for j, bj in enumerate(bloques):
                if bj["bbox"] is None or abs(i - j) <= 1:
                    continue
                if _overlaps(bi["bbox"], bj["bbox"]):
                    if "orden_lectura_ambiguo" not in bi["flags"]:
                        bi["flags"].append("orden_lectura_ambiguo")
                    break

        # confianza_legibilidad_baja (needs char offsets in raw_output; best-effort find())
        cursor = 0
        for b in bloques:
            texto = b["texto"]
            start = end = None
            if texto:
                idx = raw_output.find(texto, cursor)
                if idx != -1:
                    start, end = idx, idx + len(texto)
                    cursor = end
            _apply_confianza_flag(b["flags"], texto, start, end, token_spans, logprobs_available, confianza_threshold)

    else:
        # markdown / ocr / grounding_ocr modes: plain text, no bbox from dots.ocr itself
        for i, (texto, start, end) in enumerate(_split_plain_text_blocks(raw_output)):
            tipo, tipo_regla = _classify_markdown_line(texto, is_first_block=(i == 0))
            if tipo == "encabezado_seccion":
                seccion_actual = len([b for b in bloques if b["tipo"] == "encabezado_seccion"]) + 1
            flags = ["no_computable: sin bbox"]
            _apply_referencia_fuera_de_pagina(flags, texto)
            _apply_confianza_flag(flags, texto, start, end, token_spans, logprobs_available, confianza_threshold)
            bloques.append({
                "tipo": tipo,
                "tipo_regla": tipo_regla,
                "texto": texto,
                "bbox": None,
                "seccion": seccion_actual if tipo != "encabezado_seccion" else None,
                "flags": flags,
            })

    coord_space = _guess_coord_space(all_bboxes, image_width, image_height)
    return {"numero_pagina": page_number, "bloques": bloques}, coord_space


def parse_unlimited_ocr_output(
    raw_output,
    page_number,
    image_width,
    image_height,
    token_spans=None,
    logprobs_available=False,
    confianza_threshold=-1.5,
):
    bloques = []
    seccion_actual = None
    all_bboxes = []

    det_matches = list(GROUNDING_DET_LABEL_RE.finditer(raw_output))
    ref_matches = list(GROUNDING_REF_RE.finditer(raw_output))

    if det_matches:
        # Format (B): "<|det|>LABEL [x1,y1,x2,y2]<|/det|>TEXT"
        seen_title = False
        for m in det_matches:
            texto = m.group("text").strip()
            label = (m.group("label") or "").lower()
            coords_raw = re.findall(r"[\d.]+", m.group("coords"))
            bbox = None
            if len(coords_raw) >= 4:
                bbox = [float(v) for v in coords_raw[:4]]
                all_bboxes.append(bbox)

            # tipo: model's layout label first, then text syntax, then fallback.
            if label in UNLIMITED_LABEL_MAP and UNLIMITED_LABEL_MAP[label] == "elemento_no_textual":
                tipo, tipo_regla = "elemento_no_textual", f"unlimited_label:{label}"
            elif label == "title":
                if not seen_title:
                    tipo, tipo_regla = "titulo_documento", "unlimited_label:title(primero)"
                    seen_title = True
                else:
                    tipo, tipo_regla = "encabezado_seccion", "unlimited_label:title(subsecuente)"
            else:
                # text/footer/caption/etc: classify by text syntax (list/heading)
                syn_tipo, syn_regla = _classify_markdown_line(texto, is_first_block=False)
                if syn_tipo in ("item_lista", "encabezado_seccion"):
                    tipo, tipo_regla = syn_tipo, f"sintaxis_texto:{syn_regla}"
                else:
                    tipo = UNLIMITED_LABEL_MAP.get(label, "parrafo")
                    tipo_regla = f"unlimited_label:{label or 'sin_label'}"

            if tipo == "encabezado_seccion":
                seccion_actual = len([b for b in bloques if b["tipo"] == "encabezado_seccion"]) + 1

            flags = []
            if bbox is not None:
                if _bbox_edge_check(bbox, image_width, image_height):
                    flags.append("truncado_borde_pagina")
            else:
                flags.append("no_computable: sin bbox")

            _apply_referencia_fuera_de_pagina(flags, texto)
            _apply_confianza_flag(
                flags, texto, m.start("text"), m.end("text"), token_spans, logprobs_available, confianza_threshold
            )
            if tipo == "elemento_no_textual" and texto:
                flags.append("elemento_no_textual")

            bloques.append({
                "tipo": tipo,
                "tipo_regla": f"grounding_det:{tipo_regla}",
                "texto": texto,
                "bbox": bbox,
                "seccion": seccion_actual if tipo != "encabezado_seccion" else None,
                "flags": flags,
            })

        _flag_orden_lectura_ambiguo(bloques)

    elif ref_matches:
        # Format (A): "<|ref|>TEXT<|/ref|><|det|>[[x1,y1,x2,y2]]<|/det|>"
        for m in ref_matches:
            texto = m.group("text").strip()
            coords_raw = re.findall(r"[\d.]+", m.group("coords"))
            bbox = None
            if len(coords_raw) >= 4:
                bbox = [float(v) for v in coords_raw[:4]]
                all_bboxes.append(bbox)

            tipo, tipo_regla = _classify_markdown_line(texto, is_first_block=(len(bloques) == 0))
            if tipo == "encabezado_seccion":
                seccion_actual = len([b for b in bloques if b["tipo"] == "encabezado_seccion"]) + 1

            flags = []
            if bbox is not None:
                if _bbox_edge_check(bbox, image_width, image_height):
                    flags.append("truncado_borde_pagina")
            else:
                flags.append("no_computable: sin bbox")

            _apply_referencia_fuera_de_pagina(flags, texto)
            _apply_confianza_flag(
                flags, texto, m.start("text"), m.end("text"), token_spans, logprobs_available, confianza_threshold
            )

            bloques.append({
                "tipo": tipo,
                "tipo_regla": f"grounding_ref:{tipo_regla}",
                "texto": texto,
                "bbox": bbox,
                "seccion": seccion_actual if tipo != "encabezado_seccion" else None,
                "flags": flags,
            })

        _flag_orden_lectura_ambiguo(bloques)
    else:
        for i, (texto, start, end) in enumerate(_split_plain_text_blocks(raw_output)):
            tipo, tipo_regla = _classify_markdown_line(texto, is_first_block=(i == 0))
            if tipo == "encabezado_seccion":
                seccion_actual = len([b for b in bloques if b["tipo"] == "encabezado_seccion"]) + 1
            flags = ["no_computable: sin bbox"]
            _apply_referencia_fuera_de_pagina(flags, texto)
            _apply_confianza_flag(flags, texto, start, end, token_spans, logprobs_available, confianza_threshold)
            bloques.append({
                "tipo": tipo,
                "tipo_regla": tipo_regla,
                "texto": texto,
                "bbox": None,
                "seccion": seccion_actual if tipo != "encabezado_seccion" else None,
                "flags": flags,
            })

    coord_space = _guess_coord_space(all_bboxes, image_width, image_height)
    return {"numero_pagina": page_number, "bloques": bloques}, coord_space


def parse_mineru_output(
    raw_output,
    page_number,
    image_width,
    image_height,
    token_spans=None,
    logprobs_available=False,
    confianza_threshold=-1.5,
):
    """MinerU2.5-Pro (mineru-vl-utils) output is ALREADY structured — the
    runner hands us a JSON list of {type, bbox, content, angle?} dicts (the
    library's own ContentBlock objects, serialized), not raw text to regex.
    So this parser is mostly a field mapping, not pattern-matching.

    Coordinate space is NOT a heuristic guess here, unlike the other two
    parsers: mineru_vl_utils.structs.ContentBlock asserts
    `all(0 <= coord <= 1 for coord in bbox)` in its own constructor, so every
    bbox this library returns is guaranteed normalized-float-[0,1] by the
    library's own code, not inferred from value ranges.
    """
    blocks_raw = _extract_json(raw_output)
    if not isinstance(blocks_raw, list):
        blocks_raw = []

    bloques = []
    seccion_actual = None
    seen_title = False
    all_bboxes = []

    for item in blocks_raw:
        if not isinstance(item, dict):
            continue
        mtype = item.get("type", "")
        texto = (item.get("content") or "").strip()
        bbox = item.get("bbox")
        if isinstance(bbox, list) and len(bbox) == 4:
            bbox = [float(v) for v in bbox]
            all_bboxes.append(bbox)
        else:
            bbox = None

        if mtype == "title":
            if not seen_title:
                tipo, tipo_regla = "titulo_documento", "mineru_type:title(primero)"
                seen_title = True
            else:
                tipo, tipo_regla = "encabezado_seccion", "mineru_type:title(subsecuente)"
        elif mtype in ("image", "chart"):
            tipo, tipo_regla = "elemento_no_textual", f"mineru_type:{mtype}"
        elif mtype == "list_item":
            tipo, tipo_regla = "item_lista", "mineru_type:list_item"
        else:
            # table, equation, formula_number, code, algorithm, aside_text,
            # ref_text, index, phonetic, *_caption, *_footnote, header,
            # footer, page_number, page_footnote, unknown: none of these map
            # onto the 5 allowed tipos. Try markdown syntax first (this
            # model sometimes emits list items typed plain "text" rather than
            # "list_item" — observed directly, not assumed), else fallback.
            syn_tipo, syn_regla = _classify_markdown_line(texto, is_first_block=False)
            if syn_tipo in ("item_lista", "encabezado_seccion"):
                tipo, tipo_regla = syn_tipo, f"sintaxis_texto:{syn_regla}"
            else:
                tipo, tipo_regla = "parrafo", f"fallback_parrafo(mineru_type:{mtype})"

        if tipo == "encabezado_seccion":
            seccion_actual = len([b for b in bloques if b["tipo"] == "encabezado_seccion"]) + 1

        flags = []
        if bbox is not None:
            if _bbox_edge_check(bbox, 1.0, 1.0):  # page extent in this coord space is [0,1]
                flags.append("truncado_borde_pagina")
        else:
            flags.append("no_computable: sin bbox")

        _apply_referencia_fuera_de_pagina(flags, texto)
        _apply_confianza_flag(flags, texto, None, None, token_spans, logprobs_available, confianza_threshold)

        if tipo == "elemento_no_textual" and texto:
            flags.append("elemento_no_textual")

        bloque = {
            "tipo": tipo,
            "tipo_regla": tipo_regla,
            "texto": texto,
            "bbox": bbox,
            "seccion": seccion_actual if tipo != "encabezado_seccion" else None,
            "flags": flags,
        }
        # "rotate_dir" per the model's paper/raw text format; mineru_vl_utils
        # parses it into ContentBlock.angle (0/90/180/270, or None if the raw
        # output carried no rotate tag for this block at all). Only added
        # when present — never defaulted to 0/null — per the "no inventes"
        # instruction: None here means "concept absent for this block", not
        # "confirmed zero rotation" (that case is angle=0, a real value).
        angle = item.get("angle")
        if angle is not None:
            bloque["rotacion"] = angle
        bloques.append(bloque)

    _flag_orden_lectura_ambiguo(bloques)

    if all_bboxes:
        coord_space = "normalizado_0_1_float (confirmado por el código: ContentBlock.bbox siempre en [0,1])"
    else:
        coord_space = "sin_bbox"
    return {"numero_pagina": page_number, "bloques": bloques}, coord_space
