# demo-ocr

Frontend local para comparar **tres modelos VLM de OCR self-hosted** corriendo
en este Mac (Apple M5, 24 GB unified memory):

- **dots.ocr** — `mlx-community/dots.ocr-4bit`, vía `mlx-vlm` (MLX).
- **Unlimited-OCR-MLX** — `LoJexLLM/Unlimited-OCR-MLX`, con su propio código MLX vendorizado (parcheado — ver "Estado actual").
- **MinerU2.5-Pro** — `opendatalab/MinerU2.5-Pro-2605-1.2B`, vía `mineru-vl-utils` sobre HuggingFace `transformers` (no MLX; corre en MPS vía `torch`).

Subís un PDF o imagen, elegís qué prompt(s)/modo correr por modelo, y ves el
resultado de cada uno con overlay de bounding boxes clickeables + el output
crudo y el JSON del schema parseado, lado a lado. **No hay scoring ni juicio
de calidad en la UI** — solo los datos.

---

## Cómo levantarlo

```bash
cd apps/demo-ocr
source .venv/bin/activate
python server.py
```

Luego abrí **http://127.0.0.1:8765** en el navegador.

El entorno (`.venv/`), el entorno aislado de MinerU (`.venv-mineru/`) y los
pesos (`weights/`) ya quedaron instalados; no hay que volver a descargarlos.
Si alguna vez tenés que recrear los venvs:

```bash
# venv principal (dots.ocr + Unlimited-OCR-MLX, vía MLX)
uv venv --python 3.12 .venv
source .venv/bin/activate
uv pip install mlx-vlm "huggingface_hub[cli]" flask pymupdf pillow numpy safetensors transformers torch einops
hf download mlx-community/dots.ocr-4bit --local-dir ./weights/dots.ocr-4bit
hf download LoJexLLM/Unlimited-OCR-MLX --local-dir ./weights/unlimited_ocr_mlx

# venv separado para MinerU2.5-Pro (transformers, versión incompatible con mlx-vlm — ver abajo)
uv venv --python 3.12 .venv-mineru
source .venv-mineru/bin/activate
uv pip install "mineru-vl-utils[transformers]" accelerate pillow
hf download opendatalab/MinerU2.5-Pro-2605-1.2B --local-dir ./weights/mineru2.5-pro
```

### Uso

1. **Documento** — "Choose File", subí un PDF o una imagen (PNG/JPG/WebP/TIFF).
2. **Página** — si es un PDF multipágina, aparece un selector de página.
3. **Prompts** — marcá los checkboxes de los prompts que querés correr, por
   modelo. No se corren los siete automáticamente; elegís vos.
   - Para `grounding_ocr` de dots.ocr hay 4 campos (x1,y1,x2,y2) para la región.
   - Para `Localizar valor` de Unlimited-OCR hay un campo de texto libre.
4. **Ejecutar seleccionados** — corre las corridas en secuencia (un modelo por
   vez, por la memoria unificada de 24 GB), con indicador de progreso.
5. **Overlay** — la imagen de la página muestra los bounding boxes: **azul =
   dots.ocr, naranja = Unlimited-OCR**. Clic en un box para ver el JSON del
   bloque.
6. **Paneles** — por cada corrida, una tarjeta con el output crudo y el JSON
   del schema, lado a lado. Toggle "mostrar en overlay" y selector de
   coordenadas por tarjeta.

---

## Modelos y prompts

### dots.ocr (`mlx-community/dots.ocr-4bit`, 3.5 GB)

Corre vía `mlx-vlm` (`stream_generate`). Prompts:

| id | qué hace | fuente de la cadena |
|----|----------|---------------------|
| `markdown` | Convert this page to clean Markdown… | README de Blaizzy/mlx-vlm |
| `layout_all_en` | layout completo (bbox+categoría+texto, JSON) | README de Blaizzy/mlx-vlm + `prompts.py` de rednote-hilab/dots.ocr |
| `layout_only_en` | solo layout (bbox+categoría, sin texto) | `prompts.py` de rednote-hilab/dots.ocr |
| `ocr` | extraer todo el texto | `prompts.py` (`prompt_ocr`) |
| `grounding_ocr` | OCR acotado a un bbox que elegís | `prompts.py` (`prompt_grounding_ocr`) |

Los tres últimos (`layout_only_en`, `ocr`, `grounding_ocr`) los confirmé
**verbatim** contra el `dots_ocr/utils/prompts.py` real del repo
`rednote-hilab/dots.ocr` — no los inventé. Modos documentados pero **no
agregados** por no aplicar a una demo de página única: `prompt_web_parsing`,
`prompt_scene_spotting`, `prompt_image_to_svg`, `prompt_general`.

### Unlimited-OCR-MLX (`LoJexLLM/Unlimited-OCR-MLX`, 6.7 GB)

Los 7 prompts que pediste. **Nota:** tus prompts venían con un prefijo
literal `<image>\n`; el código vendorizado (`inference.py`) ya inyecta su
propio token `<image_placeholder>\n` antes del texto del prompt, así que el
runner **quita** ese `<image>\n` para no duplicar el token de imagen.

| id | prompt (sin el `<image>` que se quita) |
|----|-----------------------------------------|
| `document_parsing` | `document parsing.` |
| `grounding_markdown` | `<\|grounding\|>Convert the document to markdown.` |
| `grounding_ocr` | `<\|grounding\|>OCR this image.` |
| `free_ocr` | `Free OCR.` |
| `locate` | `Locate <\|ref\|>{valor}<\|/ref\|> in the image.` (campo libre) |
| `parse_figure` | `Parse the figure.` |
| `describe` | `Describe this image in detail.` |

> ℹ️ **Estado de Unlimited-OCR: ver sección "Estado actual" más abajo.** El
> port MLX publicado venía roto; se corrigieron 11 bugs (incl. reimplementar la
> atención SAM) y **ahora lee texto real** en formato grounding con coords
> normalizadas 0–999. dots.ocr también funciona completo.

### MinerU2.5-Pro (`opendatalab/MinerU2.5-Pro-2605-1.2B`, 2.3 GB)

A diferencia de los otros dos, este modelo no se prompta con texto libre — es
un pipeline fijo de dos pasos (`MinerUClient.two_step_extract`: detección de
layout, después extracción de contenido por bloque), confirmado leyendo
directamente el código de `mineru_vl_utils` (no la documentación, que está
desactualizada respecto al código real). El único "modo" real es el toggle
`image_analysis`:

| id | qué hace |
|----|----------|
| `two_step_extract` | Layout + contenido de todo el documento. Con el toggle **image_analysis** activado, además describe (no transcribe) los bloques `image`/`chart`; desactivado (default), esos bloques quedan sin contenido. |

Corre vía **HuggingFace `transformers`**, no MLX — no encontré una conversión
MLX confirmada al momento de escribir esto (el paquete `mineru-vl-utils` sí
tiene un extra `[mlx]`, pero pide `mlx-vlm<0.4.0` que choca con la versión
`0.6.4` que ya usa dots.ocr en el venv principal; no lo probé, ver nota más
abajo).

---

## Schema parseado (estructural, SIN LLM)

El parser (`schema_parser.py`) es puramente determinista — no llama a ningún
modelo, solo pattern-matchea el output que el modelo ya produjo. Emite:

```json
{
  "numero_pagina": <int>,
  "bloques": [
    {
      "tipo": "titulo_documento | parrafo | encabezado_seccion | item_lista | elemento_no_textual",
      "texto": "<transcripción tal cual>",
      "bbox": [x1, y1, x2, y2] | null,
      "seccion": <numero o null>,
      "flags": [...],
      "tipo_regla": "<qué regla determinó el tipo, para trazabilidad>",
      "rotacion": <0|90|180|270>   // SOLO presente si el modelo lo reportó (MinerU) — nunca 0/null inventado
    }
  ]
}
```

Reglas de `tipo`:
- **layout JSON de dots.ocr**: se mapea la `category` → tipo
  (`Title`→titulo_documento, `Section-header`→encabezado_seccion,
  `List-item`→item_lista, `Picture`→elemento_no_textual; el resto —Text,
  Table, Formula, Caption, Footnote, Page-header/footer— cae a `parrafo`).
- **markdown/texto plano**: `#`/`##`→encabezado_seccion; `-`/`*`/numeración→
  item_lista; primera línea→titulo_documento; resto→parrafo.
- **tokens de grounding de Unlimited-OCR** (`<|ref|>texto<|/ref|><|det|>[...]<|/det|>`):
  se extrae texto + bbox y se clasifica el texto por sintaxis markdown.
- **bloques de MinerU** (`ContentBlock.type`, ya estructurado — no hay que
  regexear texto): `title`→titulo_documento (primero) / encabezado_seccion
  (siguientes); `list_item`→item_lista; `image`/`chart`→elemento_no_textual;
  el resto (`table`, `equation`, `header`, `footer`, `*_caption`,
  `*_footnote`, etc. — hay ~27 tipos en la librería) intenta sintaxis
  markdown primero, si no cae a `parrafo`. Los bloques contenedores puros
  (`list`, `image_block`, `equation_block` — agrupan a sus hijos, sin
  contenido propio) se descartan antes de construir el schema: no hay un
  6º `tipo` para "contenedor", y si no se descartaran generarían
  `orden_lectura_ambiguo` falsos contra sus propios hijos.
- Fallback siempre: `parrafo`. Cada bloque lleva `tipo_regla` documentando
  qué regla se aplicó.

Los 5 flags (y `no_computable: <razón>` cuando no aplica):
- `truncado_borde_pagina` — bbox a <2% del borde inferior/derecho.
- `confianza_legibilidad_baja` — computable para dots.ocr y Unlimited-OCR
  (ambos exponen logprobs por token; se marca si el logprob medio del bloque
  < −1.5, ≈ p<22%, heurística). **Para MinerU queda `no_computable: sin
  logprobs expuestos`** — verificado directamente en el código de
  `mineru_vl_utils`: el parámetro `scored=True` (que expone logprobs/perplejidad
  por bloque) solo está implementado para los backends `vllm-engine` /
  `vllm-async-engine`; con el backend `transformers` que usamos acá, llamarlo
  lanza `UnsupportedError`. No lo intenté bypassear (hubiera significado
  reimplementar generación a mano, el mismo tipo de riesgo que causó los bugs
  de Unlimited-OCR).
- `orden_lectura_ambiguo` — bbox se solapa con otro bloque no contiguo.
- `elemento_no_textual` — solo si el modelo intentó transcribir texto sobre
  una figura (para MinerU, solo pasa con el toggle `image_analysis` activado).
- `referencia_fuera_de_pagina` — **coincidencia textual literal** de frases
  tipo "continúa en la página" / "continued on page". Nunca inferencia.

### Campo `rotacion` (rotate_dir)

MinerU es el único de los tres que reporta rotación por bloque. El paper/
formato de texto crudo lo emite como tokens `<|rotate_up/right/down/left|>`;
la librería `mineru_vl_utils` los parsea a un campo llamado **`angle`** (no
literalmente `rotate_dir`) con valores `0|90|180|270` — confirmado leyendo
`mineru_client.py` directamente, no la doc. Lo mapeo a `"rotacion"` en el
schema **solo cuando el modelo lo reportó** (incluyendo `rotacion: 0`, que es
un valor real — "no rotado", confirmado — no lo mismo que ausencia del campo).
Si el raw output no traía tag de rotación para ese bloque, el campo
simplemente no aparece. dots.ocr y Unlimited-OCR no tienen este concepto, así
que sus bloques nunca llevan `rotacion`.

### Formato de coordenadas — CONFIRMADO (tres convenciones distintas, una por modelo)

Cada uno de los tres modelos usa su propia convención de coordenadas — la UI
detecta cuál corresponde y escala el overlay en consecuencia:

| modelo | convención | cómo se confirmó |
|--------|-----------|-------------------|
| **dots.ocr** | píxeles reales de la imagen | output real (`layout_all_en`) sobre una imagen 1240×1754 dio `bbox=[79,79,619,119]` — valores en rango de píxeles, no 0–1000 |
| **Unlimited-OCR-MLX** | normalizado 0–999 | output real de grounding dio `bbox=[61,45,504,67]` sobre esa misma imagen — valores <1000 en una imagen mucho mayor a 1000px |
| **MinerU2.5-Pro** | normalizado 0–1 (float) | **no es heurística acá**: `mineru_vl_utils.structs.ContentBlock` hace `assert all(0 <= coord <= 1 for coord in bbox)` en su propio constructor — está garantizado por el código de la librería |

`truncado_borde_pagina` compara el bbox contra el borde de página **en la
misma unidad** (píxeles de la imagen / 1000 / 1.0 según corresponda).

La UI muestra la detección en un banner ("Formato de coordenadas
detectado…") la primera vez que llega un output con bbox, y cada tarjeta tiene
un selector `coords: píxeles / 0-1000 / 0-1` por si hiciera falta corregir el
overlay manualmente.

---

## Estado actual (qué funciona / qué no)

### ✅ dots.ocr — funciona completo

Probado end-to-end por el navegador: subida → render → selección de prompt →
ejecución con progreso → overlay de bboxes clickeables → paneles crudo+schema.
Confirmado sobre un documento real: los 5 prompts corren, el layout JSON se
parsea al schema, y las **coordenadas son píxeles reales** (no 0–1000).

### ✅ Unlimited-OCR-MLX — ahora funciona (leí texto real), tras arreglar el port

El paquete instala y el modelo carga, pero **el código de inferencia MLX
publicado (`LoJexLLM/Unlimited-OCR-MLX`) venía roto/incompleto**. Tuve que
corregir **11 bugs** para que corra y lea texto de verdad. Hoy transcribe el
documento con bboxes y labels de layout — ejemplo real (prompt
`<|grounding|>OCR this image.`):

```
<|det|>title [61, 45, 504, 67]<|/det|>Informe Anual de Actividades
<|det|>title [61, 90, 214, 106]<|/det|>1. Introducción
<|det|>text  [60, 117, 489, 166]<|/det|>Este documento resume las actividades…
<|det|>text  [85, 215, 410, 228]<|/det|>- Aumentar la eficiencia operativa en un 15%
<|det|>image [64, 283, 406, 404]<|/det|>
<|det|>footer[61, 938, 289, 953]<|/det|>continua en la pagina siguiente
```

(Coordenadas **normalizadas 0–999** — distinto de dots.ocr, que da píxeles. La
UI lo detecta solo y el overlay escala bien; hay un selector por tarjeta por si
hiciera falta forzarlo.)

Los primeros 7 fixes eran para que ni siquiera crasheara. Los 3 siguientes
(RMSNorm, RoPE, prompt) los diagnostiqué con un análisis forense en paralelo (6
investigaciones) y los **verifiqué contra los pesos/tokenizer reales**. El
último (SAM) es una **reimplementación** que hiciste bien en pedir — la hice
después de que autorizaras:

| # | bug | dónde | cómo lo verifiqué / arreglé |
|---|-----|-------|------------------------------|
| 1 | `sam_model.neck.N.*` no matchea `mlx.nn.Sequential` | checkpoint keys | remap de 6 keys → `neck.layers.N.*` |
| 2 | falta `vision_model.embeddings.position_ids` (buffer `arange`, no peso) | load | `strict=False`; confirmado que es el único faltante |
| 3 | `AutoTokenizer` crashea (auto_map apunta a dataclasses MLX) | tokenizer | cargar `tokenizer.json` directo con `PreTrainedTokenizerFast` |
| 4 | `images_seq_mask` np→mx con dtype `bool` inválido | runner | `mx.bool_` |
| 5 | pesos Conv2d en OIHW (PyTorch), MLX espera OHWI | 6 convs | transpose auto-verificado (solo si hace matchear la forma) |
| 6 | `inputs_embeds.at[idx].set(...)` no existe en mlx.core | model.py | splice contiguo (la máscara es siempre un bloque contiguo) |
| 7 | conteo de tokens de imagen por fórmula ("~272") off-by-1 | runner | tomar el conteo real de `encode_images()` (=273) |
| 8 | RMSNorm usa `1.0 + weight` (convención Gemma) sobre checkpoint DeepSeek | model.py:88 | inspeccioné los 25 gammas: 0.09–1.04, positivos → el `1.0+` sobre-escalaba 2.5–5× |
| 9 | RoPE en decode: `cos[:1]` indexado por posición absoluta → todos los tokens reciben posición 0 | model.py:119 | indexar la tabla completa por `position_ids` |
| 10 | prompt usa el string inexistente `<image_placeholder>` (5 subtokens basura) + wrappers `User:/Assistant:` | runner | formato real: `<image>` (id 128815) sin role markers; verificado contra el tokenizer |
| **11** | **atención de posición relativa de SAM sin implementar (stub `return 0.0`); buffers alocados `[127,64]` cuando el checkpoint trae `[27,64]` para bloques de ventana** | model.py (SAMAttention) | **implementé `add_decomposed_rel_pos` de SAM (get_rel_pos + einsum), correcto en la ruta global y de ventana; alocación por-bloque (27 ventana / 127 global) — verificado que ahora cargan los 12 rel_pos reales** |

**Progresión observada** (mismo documento):

```
inicial:          " -Compatible"                       (basura pura, 3 tokens)
tras #8–9:        "2018-04-01\nimage [0,0,999,999]"    (estructurado, alucinado)
tras #10:         "image [0, 0, 999, 999]"             (grounding válido, sin texto)
tras #11 (SAM):   transcribe TODO el documento con bboxes  ✅
```

El fix #8 (RMSNorm) destrabó el forward pass del LM; el #11 (SAM rel-pos)
destrabó las features visuales para que lea texto fino en vez de solo una caja
de toda la página.

> Nota: las claims de "precisión >99.5%" del README de ese modelo no eran
> creíbles — el código no corría sin 11 fixes. Los pesos son buenos; el port
> estaba a medias. **Todos los fixes están en `weights/unlimited_ocr_mlx/model.py`
> y `ocr_runners/unlimited_ocr_runner.py`, comentados con un `NOTE(demo-ocr…)`.**

### Modo tiling (`crop_mode=True`, "Gundam") de Unlimited-OCR

El runner corre en "Base Mode" (`crop_mode=False`), un modo documentado del
modelo. El modo tiling de alta precisión tiene además un bug de reshape
separado en la rama de crops locales del encoder SAM
(`input:(6,640,640,3)` vs `weight:(768,3,16,16)`), sin resolver — es parte del
mismo port incompleto.

### ✅ MinerU2.5-Pro — integrado y funcionando

Corre vía `transformers` en un **venv aislado** (`.venv-mineru/`): su
requisito de versión (`transformers>=4.51.1,<5.0.0`) es incompatible con el de
`mlx-vlm` ya instalado para dots.ocr (`transformers>=5.5.0,<5.13.0`) —
confirmado con `importlib.metadata` sobre ambos paquetes, rangos que no se
solapan en absoluto. Instalar los dos en un solo venv no era resolvible sin
arriesgar romper dots.ocr/Unlimited-OCR (que ya funcionaban), así que separé
el entorno en vez de forzarlo.

**MPS: anduvo solo, sin forzar nada.** Probé el código de carga exacto que
diste (`device_map="auto"`) y en este Mac (transformers 4.57.6 + accelerate
1.14.0) ubicó el modelo completo en `mps:0` directamente —
`next(model.parameters()).device` lo confirma. Igual dejé la lógica
defensiva que pediste: el worker (`ocr_runners/mineru_worker.py`) verifica el
device después de cargar, y si alguna vez cae en CPU reintenta con
`device_map={"": "mps"}` explícito; si eso también falla, sigue en CPU **y lo
expone en la UI** (`dispositivo: cpu`) en vez de ocultarlo — no llegué a
necesitar el fallback en la práctica, pero está ahí.

**Integración vía subprocess, no import directo.** Como corre en un venv
separado, `server.py` no puede `import mineru_runner` como hace con los otros
dos — despacha un subprocess al python de `.venv-mineru` (ver
`ocr_runners/mineru_runner.py` + `mineru_worker.py`). Trade-off aceptado: el
modelo se recarga en cada corrida (no hay cache en memoria entre llamadas
como en los otros dos runners) — pero la carga tarda solo ~2s en este modelo
(1.2B, 2.3GB), así que no lo consideré un problema real para una herramienta
de exploración manual. El progreso que ves en la UI mientras corre es grueso
("cargando modelo" → "extrayendo", con tiempo transcurrido) en vez de
contador de tokens — evité depender de métodos privados de la librería
(`_batch_predict`) solo para exponer progreso más fino, ya que ese exacto tipo
de dependencia de internals fue la causa de varios de los bugs de
Unlimited-OCR.

**Campos que trajo este modelo y los otros dos no tienen:**
- **`rotacion`** (0/90/180/270) — ver sección dedicada arriba. Solo aparece
  cuando el modelo lo reportó.
- **`device`** / **`device_forced`** en el resultado — de qué dispositivo
  corrió (mps/cpu) y si hubo que forzarlo. Se muestra en la línea de metadata
  de cada tarjeta.
- Conteo de **bloques** en vez de tokens (`unit_label: "bloques"`) — este
  modelo devuelve objetos ya estructurados (`ContentBlock`), no texto que
  haya que tokenizar/generar en el sentido de los otros dos, así que "tokens
  generados" no es una medida que aplique de la misma forma.
- **NO trae logprobs** — a diferencia de dots.ocr y Unlimited-OCR. Verificado
  directamente en el código de `mineru_vl_utils`: `scored=True` (que expone
  logprobs/perplejidad por bloque) solo está implementado para los backends
  `vllm-engine`/`vllm-async-engine`; con `transformers` lanza
  `UnsupportedError`. `confianza_legibilidad_baja` queda siempre
  `no_computable: sin logprobs expuestos` para este modelo.

**Algo que encontré y no usé, para que lo sepas:** el paquete
`mineru-vl-utils` tiene un extra `[mlx]` (`backend="mlx-engine"`, vía
`mineru_vl_utils.mlx_compat.load_mlx_model`) — o sea que sí existe *algo* de
soporte MLX para este modelo, a diferencia de lo que vos suponías. No lo
probé porque pide `mlx-vlm<0.4.0` (tenemos `0.6.4` instalado para dots.ocr),
mismo tipo de conflicto de versiones que me hizo aislar el venv de
`transformers` — habría necesitado un TERCER venv igual. Si en algún momento
te interesa evitar el subprocess/MPS y probar la ruta MLX nativa, avisame y
lo armo en un venv aparte.

---

## Estructura del proyecto

```
apps/demo-ocr/
├── server.py                 Flask: upload, render de páginas, jobs, progreso
├── schema_parser.py          parser estructural determinista (SIN LLM)
├── ocr_runners/
│   ├── prompts.py            catálogos de prompts (cadenas verbatim + fuentes)
│   ├── dots_ocr_runner.py    wrapper de mlx-vlm para dots.ocr
│   ├── unlimited_ocr_runner.py  runner propio + los fixes de carga/prompt
│   ├── mineru_runner.py      corre en .venv, despacha por subprocess a .venv-mineru
│   └── mineru_worker.py      corre DENTRO de .venv-mineru (carga modelo + extract)
├── static/                   index.html, app.js, style.css (frontend)
├── weights/                  pesos descargados (dots.ocr-4bit, unlimited_ocr_mlx, mineru2.5-pro)
│                             (model.py del port de unlimited_ocr_mlx lleva los fixes #6,#8,#9,#11)
├── .venv/                    entorno principal (dots.ocr + Unlimited-OCR-MLX, MLX)
├── .venv-mineru/             entorno aislado para MinerU (transformers, versión incompatible con mlx-vlm)
└── README.md
```

