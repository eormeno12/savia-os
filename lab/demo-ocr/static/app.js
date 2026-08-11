const MODEL_COLORS = {
  dots_ocr: "#2563eb",
  unlimited_ocr: "#ea580c",
  mineru: "#9333ea",
};
const MODEL_LABELS = {
  dots_ocr: "dots.ocr",
  unlimited_ocr: "Unlimited-OCR-MLX",
  mineru: "MinerU2.5-Pro",
};

const state = {
  docId: null,
  kind: null,
  pageCount: 1,
  currentPage: 1,
  promptsCatalog: null,
  results: [],
  resultSeq: 0,
};

const el = (id) => document.getElementById(id);

async function init() {
  const res = await fetch("/api/prompts");
  state.promptsCatalog = await res.json();
  renderPromptList(el("dotsOcrPrompts"), state.promptsCatalog.dots_ocr, "dots_ocr");
  renderPromptList(el("unlimitedOcrPrompts"), state.promptsCatalog.unlimited_ocr, "unlimited_ocr");
  renderPromptList(el("mineruPrompts"), state.promptsCatalog.mineru, "mineru");

  el("fileInput").addEventListener("change", onFileChange);
  el("pageSelect").addEventListener("change", onPageChange);
  el("runButton").addEventListener("click", runSelected);
  el("closeBlockDetail").addEventListener("click", () => el("blockDetail").classList.add("hidden"));

  renderLegend();
}

function renderLegend() {
  el("legend").innerHTML = `
    <span><span class="legend-swatch" style="background:${MODEL_COLORS.dots_ocr}"></span>dots.ocr</span>
    <span><span class="legend-swatch" style="background:${MODEL_COLORS.unlimited_ocr}"></span>Unlimited-OCR-MLX</span>
    <span><span class="legend-swatch" style="background:${MODEL_COLORS.mineru}"></span>MinerU2.5-Pro</span>
  `;
}

function renderPromptList(container, prompts, modelKey) {
  container.innerHTML = "";
  for (const p of prompts) {
    const item = document.createElement("div");
    item.className = "prompt-item";

    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.model = modelKey;
    checkbox.dataset.promptId = p.id;
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(p.label));
    item.appendChild(label);

    if (p.needs_bbox) {
      const extra = document.createElement("div");
      extra.className = "prompt-extra";
      extra.dataset.role = "bbox-inputs";
      extra.dataset.promptId = p.id;
      ["x1", "y1", "x2", "y2"].forEach((axis) => {
        const inp = document.createElement("input");
        inp.type = "number";
        inp.placeholder = axis;
        inp.dataset.axis = axis;
        extra.appendChild(inp);
      });
      item.appendChild(extra);
    }
    if (p.needs_value) {
      const extra = document.createElement("div");
      extra.className = "prompt-extra";
      extra.dataset.role = "value-input";
      extra.dataset.promptId = p.id;
      const inp = document.createElement("input");
      inp.type = "text";
      inp.className = "value-input";
      inp.placeholder = "valor a localizar";
      extra.appendChild(inp);
      item.appendChild(extra);
    }
    if (p.needs_image_analysis_toggle) {
      const extra = document.createElement("div");
      extra.className = "prompt-extra";
      extra.dataset.role = "image-analysis-toggle";
      const toggleLabel = document.createElement("label");
      toggleLabel.style.display = "flex";
      toggleLabel.style.gap = "6px";
      toggleLabel.style.alignItems = "center";
      const toggle = document.createElement("input");
      toggle.type = "checkbox";
      toggleLabel.appendChild(toggle);
      toggleLabel.appendChild(document.createTextNode("image_analysis (describir figuras/gráficos)"));
      extra.appendChild(toggleLabel);
      item.appendChild(extra);
    }

    container.appendChild(item);
  }
}

async function onFileChange(e) {
  const file = e.target.files[0];
  if (!file) return;

  el("uploadStatus").textContent = "Subiendo...";
  el("runButton").disabled = true;

  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) {
    el("uploadStatus").textContent = "Error al subir el archivo.";
    return;
  }
  const data = await res.json();
  state.docId = data.doc_id;
  state.kind = data.kind;
  state.pageCount = data.page_count;
  state.currentPage = 1;
  state.results = [];
  el("results").innerHTML = "";
  el("coordBanner").classList.add("hidden");

  el("uploadStatus").textContent = `${data.filename} — ${data.kind} — ${data.page_count} página(s)`;

  const pageSelect = el("pageSelect");
  pageSelect.innerHTML = "";
  if (data.page_count > 1) {
    for (let i = 1; i <= data.page_count; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = `Página ${i}`;
      pageSelect.appendChild(opt);
    }
    el("pageSelectorWrap").classList.remove("hidden");
  } else {
    el("pageSelectorWrap").classList.add("hidden");
  }

  loadPageImage(1);
  el("runButton").disabled = false;
}

function onPageChange(e) {
  state.currentPage = parseInt(e.target.value, 10);
  state.results = [];
  el("results").innerHTML = "";
  el("coordBanner").classList.add("hidden");
  loadPageImage(state.currentPage);
}

function loadPageImage(page) {
  const img = el("pageImage");
  img.onload = () => redrawOverlay();
  img.src = `/api/page-image/${state.docId}/${page}`;
}

function collectJobs() {
  const jobs = [];
  document.querySelectorAll('input[type=checkbox][data-model]').forEach((cb) => {
    if (!cb.checked) return;
    const model = cb.dataset.model;
    const promptId = cb.dataset.promptId;
    const job = { model, prompt_id: promptId };

    // Scope extra-input lookups to THIS checkbox's own prompt-item — prompt
    // ids are unique per-model but collide across models (both dots.ocr and
    // Unlimited-OCR have a "grounding_ocr"), so a global querySelector would
    // grab the wrong model's inputs.
    const item = cb.closest(".prompt-item");
    const bboxWrap = item && item.querySelector('[data-role=bbox-inputs]');
    if (bboxWrap) {
      const bbox = Array.from(bboxWrap.querySelectorAll("input")).map((i) => parseFloat(i.value));
      if (bbox.some((v) => Number.isNaN(v))) {
        throw new Error(`Completá los 4 valores de bbox para el prompt "${promptId}"`);
      }
      job.bbox = bbox;
    }
    const valueWrap = item && item.querySelector('[data-role=value-input]');
    if (valueWrap) {
      const value = valueWrap.querySelector("input").value.trim();
      if (!value) throw new Error(`Completá el valor a localizar para el prompt "${promptId}"`);
      job.value = value;
    }
    const imageAnalysisWrap = item && item.querySelector('[data-role=image-analysis-toggle]');
    if (imageAnalysisWrap) {
      job.image_analysis = imageAnalysisWrap.querySelector("input").checked;
    }
    jobs.push(job);
  });
  return jobs;
}

async function runSelected() {
  let jobs;
  try {
    jobs = collectJobs();
  } catch (err) {
    el("runStatus").textContent = err.message;
    return;
  }
  if (jobs.length === 0) {
    el("runStatus").textContent = "Elegí al menos un prompt.";
    return;
  }

  el("runButton").disabled = true;
  el("runStatus").textContent = `Encolando ${jobs.length} corrida(s)...`;

  const res = await fetch("/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doc_id: state.docId, page_num: state.currentPage, jobs }),
  });
  const { job_id } = await res.json();

  await pollJob(job_id, jobs.length);
  el("runButton").disabled = false;
}

function pollJob(jobId, total) {
  return new Promise((resolve) => {
    const tick = async () => {
      const res = await fetch(`/api/run/${jobId}`);
      const job = await res.json();

      if (job.status === "error") {
        el("runStatus").textContent = `Error: ${job.error}`;
        resolve();
        return;
      }
      if (job.status === "done") {
        el("runStatus").textContent = `Listo (${total}/${total}).`;
        addResults(job.results);
        resolve();
        return;
      }

      const cur = job.current ?? 0;
      const prog = (job.progress && job.progress[cur]) || {};
      let progTxt = "";
      if (prog.tokens_generated) {
        progTxt = ` — ${prog.tokens_generated} tokens, ${(prog.elapsed || 0).toFixed(1)}s`;
      } else if (prog.phase) {
        // MinerU reports coarse phases (cargando modelo / extrayendo) with
        // elapsed time only — it's one subprocess call away, so there's no
        // real per-token/per-block signal to show without depending on the
        // library's private batching internals.
        progTxt = ` — ${prog.phase}, ${(prog.elapsed || 0).toFixed(1)}s`;
      }
      el("runStatus").textContent = `Corriendo ${cur + 1}/${total} (${job.status})${progTxt}`;
      setTimeout(tick, 600);
    };
    tick();
  });
}

function addResults(results) {
  for (const r of results) {
    const id = state.resultSeq++;
    const coordMode = guessCoordMode(r.coord_space);
    state.results.push({ id, visible: true, coordMode, ...r });
  }
  renderResults();
  redrawOverlay();
  maybeShowCoordBanner();
}

function guessCoordMode(coordSpaceStr) {
  if (!coordSpaceStr) return "pixels";
  if (coordSpaceStr.startsWith("normalizado_0_1000")) return "normalized_1000";
  if (coordSpaceStr.startsWith("normalizado_0_1_float")) return "normalized_1";
  if (coordSpaceStr.startsWith("normalizado")) return "normalized_1000";
  if (coordSpaceStr.startsWith("pixeles")) return "pixels";
  return "pixels";
}

function maybeShowCoordBanner() {
  const withBbox = state.results.find((r) => r.schema && r.schema.bloques.some((b) => b.bbox));
  if (!withBbox) return;
  const banner = el("coordBanner");
  banner.classList.remove("hidden");
  banner.textContent = `Formato de coordenadas detectado (heurística, primer resultado con bbox): "${withBbox.coord_space}". Confirmá visualmente que el overlay calza con el texto — si no, usá el selector "coords" en la tarjeta del resultado para corregirlo.`;
}

function renderResults() {
  const container = el("results");
  container.innerHTML = "";
  for (const r of state.results) {
    container.appendChild(renderResultCard(r));
  }
}

function renderResultCard(r) {
  const card = document.createElement("div");
  card.className = "result-card";

  const header = document.createElement("div");
  header.className = "result-card-header";

  const badge = document.createElement("span");
  badge.className = `model-badge ${r.model}`;
  badge.textContent = MODEL_LABELS[r.model] || r.model;
  header.appendChild(badge);

  const promptLabel = document.createElement("strong");
  promptLabel.textContent = r.prompt_id;
  header.appendChild(promptLabel);

  if (r.error) {
    const err = document.createElement("span");
    err.className = "result-error";
    err.textContent = r.error;
    header.appendChild(err);
    card.appendChild(header);
    return card;
  }

  const meta = document.createElement("span");
  meta.className = "result-meta";
  const unitLabel = r.unit_label || "tokens";
  const deviceTxt = r.device ? ` · dispositivo: ${r.device}${r.device_forced ? " (forzado)" : ""}` : "";
  meta.textContent = `${r.tokens_generated} ${unitLabel} · ${r.elapsed_sec.toFixed(1)}s · ${r.image_size[0]}×${r.image_size[1]}px · logprobs: ${r.logprobs_available ? "sí" : "no"}${deviceTxt}`;
  header.appendChild(meta);

  const visibilityLabel = document.createElement("label");
  visibilityLabel.style.fontSize = "12px";
  const visibilityCb = document.createElement("input");
  visibilityCb.type = "checkbox";
  visibilityCb.checked = r.visible;
  visibilityCb.addEventListener("change", () => {
    r.visible = visibilityCb.checked;
    redrawOverlay();
  });
  visibilityLabel.appendChild(visibilityCb);
  visibilityLabel.appendChild(document.createTextNode(" mostrar en overlay"));
  header.appendChild(visibilityLabel);

  const coordSelect = document.createElement("select");
  coordSelect.className = "coord-space-select";
  [["normalized_1000", "coords: 0-1000"], ["normalized_1", "coords: 0-1"], ["pixels", "coords: píxeles"]].forEach(([val, txt]) => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = txt;
    if (val === r.coordMode) opt.selected = true;
    coordSelect.appendChild(opt);
  });
  coordSelect.addEventListener("change", () => {
    r.coordMode = coordSelect.value;
    redrawOverlay();
  });
  header.appendChild(coordSelect);
  header.title = `detectado: ${r.coord_space}`;

  card.appendChild(header);

  const panels = document.createElement("div");
  panels.className = "result-panels";

  const rawPre = document.createElement("pre");
  rawPre.textContent = r.raw_output;
  panels.appendChild(rawPre);

  const schemaPre = document.createElement("pre");
  schemaPre.textContent = JSON.stringify(r.schema, null, 2);
  panels.appendChild(schemaPre);

  card.appendChild(panels);
  return card;
}

function redrawOverlay() {
  const svg = el("overlay");
  const img = el("pageImage");
  svg.innerHTML = "";
  if (!img.naturalWidth) return;
  svg.setAttribute("viewBox", `0 0 ${img.naturalWidth} ${img.naturalHeight}`);

  for (const r of state.results) {
    if (!r.visible || !r.schema) continue;
    const color = MODEL_COLORS[r.model] || "#999";
    const refDims = { normalized_1000: [1000, 1000], normalized_1: [1, 1], pixels: r.image_size };
    const [refW, refH] = refDims[r.coordMode] || r.image_size;
    const scaleX = img.naturalWidth / refW;
    const scaleY = img.naturalHeight / refH;

    r.schema.bloques.forEach((block, idx) => {
      if (!block.bbox) return;
      const [x1, y1, x2, y2] = block.bbox;
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", Math.min(x1, x2) * scaleX);
      rect.setAttribute("y", Math.min(y1, y2) * scaleY);
      rect.setAttribute("width", Math.abs(x2 - x1) * scaleX);
      rect.setAttribute("height", Math.abs(y2 - y1) * scaleY);
      rect.setAttribute("class", "bbox-rect");
      rect.setAttribute("stroke", color);
      rect.addEventListener("click", () => showBlockDetail(r, block, idx));
      svg.appendChild(rect);
    });
  }
}

function showBlockDetail(result, block, idx) {
  el("blockDetail").classList.remove("hidden");
  el("blockDetailContent").textContent = JSON.stringify(
    { modelo: MODEL_LABELS[result.model], prompt: result.prompt_id, indice: idx, ...block },
    null,
    2
  );
}

init();
