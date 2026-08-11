#!/usr/bin/env node
// Visor de repo de solo lectura, pensado para revisar desde el teléfono.
//
//   pnpm viewer          → http://127.0.0.1:4380
//   pnpm viewer:share    → lo mismo + túnel público de cloudflared
//
// CERO dependencias. Ninguna ruta escribe en el repo: lo único que persiste es
// `.review/cola.json`, que es la cola de pedidos de lectura y sus notas.
//
// SEGURIDAD — el túnel expone una URL pública, y este repo tiene credenciales
// reales. La lista de negación NO es una comodidad: es lo único que separa este
// visor de publicar los `.env`. Se aplica por patrón sobre la ruta relativa ANTES
// de tocar el disco, y otra vez sobre la ruta REAL después de resolver symlinks.
// Está acreditada rompiéndola: ver `scripts/repo-viewer.test.mjs`.

import { createServer } from "node:http";
import { readFile, readdir, stat, realpath, writeFile, mkdir } from "node:fs/promises";
import { join, relative, extname, basename, dirname, sep } from "node:path";
import { spawn } from "node:child_process";

const RAIZ = await realpath(new URL("..", import.meta.url).pathname);
const PUERTO = Number(process.env.PORT ?? 4380);
const COLA = join(RAIZ, ".review", "cola.json");

// ── Lo que nunca se lista ni se sirve ────────────────────────────────────────
const NEGADOS = [
  /(^|\/)\.env($|\.|\/)/i,
  /(^|\/)\.git($|\/)/,
  /(^|\/)node_modules($|\/)/,
  /(^|\/)\.venv/,
  /(^|\/)weights($|\/)/,
  /(^|\/)uploads($|\/)/,
  /(^|\/)__pycache__($|\/)/,
  /(^|\/)\.turbo($|\/)/,
  /(^|\/)\.next($|\/)/,
  /(^|\/)dist($|\/)/,
  /(^|\/)graphify-out($|\/)/,
  /\.(pem|key|crt|p12|keystore|pfx)$/i,
  /(^|\/)id_(rsa|ed25519)/,
];
const negado = (rel) => NEGADOS.some((re) => re.test(rel));

// ── Cómo se muestra cada tipo ────────────────────────────────────────────────
const LENGUAJE = {
  ".ts": "ts", ".tsx": "ts", ".mts": "ts", ".cts": "ts",
  ".js": "ts", ".jsx": "ts", ".mjs": "ts", ".cjs": "ts",
  ".json": "json", ".jsonc": "json",
  ".py": "py", ".sh": "sh", ".bash": "sh", ".zsh": "sh",
  ".css": "css", ".html": "xml", ".xml": "xml", ".svg": "xml",
  ".sql": "sql", ".prisma": "prisma", ".yml": "yaml", ".yaml": "yaml",
  ".toml": "toml", ".env.example": "sh", ".gitignore": "sh", ".dockerignore": "sh",
};
const IMAGEN = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".bmp"]);
const TABULAR = new Set([".csv", ".tsv"]);
const PLANO = new Set([".txt", ".log", ".patch", ".diff", ".lock", ".mjs.map"]);
const MIME = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".webp": "image/webp", ".avif": "image/avif", ".ico": "image/x-icon", ".bmp": "image/bmp",
  ".svg": "image/svg+xml", ".pdf": "application/pdf",
};

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const kb = (n) =>
  n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;

const slug = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60);

// ── Resaltado de sintaxis ────────────────────────────────────────────────────
// Tokeniza el texto CRUDO y escapa cada token por separado. Nunca se corre una
// regex sobre HTML ya escapado: ahí es donde estos resaltadores se rompen.
const PALABRAS = {
  ts: /\b(?:import|export|from|as|const|let|var|function|return|if|else|for|while|of|in|type|interface|extends|implements|class|new|await|async|try|catch|finally|throw|typeof|keyof|readonly|satisfies|declare|enum|null|undefined|true|false|this|super|switch|case|break|continue|default|yield|void|never|unknown|any|string|number|boolean|symbol)\b/,
  py: /\b(?:def|class|return|if|elif|else|for|while|in|not|and|or|import|from|as|with|try|except|finally|raise|lambda|None|True|False|self|yield|pass|global|assert|async|await)\b/,
  sh: /\b(?:if|then|else|fi|for|do|done|while|case|esac|function|return|export|local|source|echo|cd|set|unset)\b/,
  sql: /\b(?:SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|ON|GROUP|ORDER|BY|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|ALTER|DROP|AND|OR|NOT|NULL|AS|LIMIT)\b/i,
  prisma: /\b(?:model|enum|datasource|generator|provider|url|String|Int|Boolean|DateTime|Json|Float|Bytes)\b/,
  json: /\b(?:true|false|null)\b/,
  yaml: /^(\s*)([\w.-]+)(?=:)/,
  toml: /^(\s*)([\w.-]+)(?=\s*=)/,
  css: /\b(?:import|media|supports|keyframes|root|var)\b/,
  xml: /<\/?[\w:-]+/,
};

function resaltar(texto, lang) {
  const kw = PALABRAS[lang];
  // Un solo barrido: comentario | string | número | palabra clave | resto.
  const re = new RegExp(
    [
      lang === "py" || lang === "sh" || lang === "yaml" || lang === "toml"
        ? "(#[^\\n]*)"
        : "(//[^\\n]*|/\\*[\\s\\S]*?\\*/|<!--[\\s\\S]*?-->)",
      "(`(?:\\\\.|[^`\\\\])*`|\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*')",
      "(\\b\\d[\\d_]*(?:\\.\\d+)?(?:e[+-]?\\d+)?\\b)",
      kw && lang !== "yaml" && lang !== "toml" ? `(${kw.source})` : "()",
    ].join("|"),
    "gi",
  );
  let out = "", i = 0, m;
  while ((m = re.exec(texto)) !== null) {
    out += esc(texto.slice(i, m.index));
    const [t] = m;
    const clase = m[1] ? "c" : m[2] ? "s" : m[3] ? "n" : m[4] ? "k" : null;
    out += clase ? `<i class="${clase}">${esc(t)}</i>` : esc(t);
    i = m.index + t.length;
    if (t.length === 0) re.lastIndex++;
  }
  return out + esc(texto.slice(i));
}

// ── Markdown ─────────────────────────────────────────────────────────────────
// Compacto pero correcto en lo que importa: escapa siempre, y les pone ancla a
// los encabezados — sin ancla, una nota no puede apuntar a una sección.
function inline(s) {
  let t = esc(s);
  t = t.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (_, a, u) => `<img alt="${a}" src="${u}" loading="lazy">`);
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, (_, a, u) => `<a href="${u}">${a}</a>`);
  t = t.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|\W)\*([^*\n]+)\*/g, "$1<em>$2</em>");
  t = t.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  return t;
}

function markdown(src) {
  const lineas = src.split("\n");
  const fuera = [];
  const toc = [];
  let i = 0;
  const cerrarLista = (pila) => { while (pila.length) fuera.push(`</${pila.pop()}>`); };
  const pila = [];

  while (i < lineas.length) {
    const l = lineas[i];

    // valla de código
    const valla = l.match(/^\s*```+\s*([\w-]*)/);
    if (valla) {
      cerrarLista(pila);
      const lang = LENGUAJE["." + valla[1]] ?? valla[1] ?? "";
      const buf = [];
      i++;
      while (i < lineas.length && !/^\s*```+\s*$/.test(lineas[i])) buf.push(lineas[i++]);
      i++;
      const cuerpo = buf.join("\n");
      fuera.push(`<pre data-lang="${esc(valla[1] || "")}"><code>${lang ? resaltar(cuerpo, lang) : esc(cuerpo)}</code></pre>`);
      continue;
    }

    // encabezado
    const h = l.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      cerrarLista(pila);
      const n = h[1].length, txt = h[2].replace(/\s*#+\s*$/, "");
      const id = slug(txt);
      if (n <= 3) toc.push({ n, txt, id });
      fuera.push(`<h${n} id="${id}"><a class="ancla" href="#${id}" aria-label="enlace a esta sección">#</a>${inline(txt)}</h${n}>`);
      i++; continue;
    }

    // regla
    if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(l)) { cerrarLista(pila); fuera.push("<hr>"); i++; continue; }

    // tabla
    if (/\|/.test(l) && i + 1 < lineas.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lineas[i + 1])) {
      cerrarLista(pila);
      const fila = (s) => s.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
      const enc = fila(l);
      i += 2;
      const cuerpo = [];
      while (i < lineas.length && /\|/.test(lineas[i]) && lineas[i].trim()) cuerpo.push(fila(lineas[i++]));
      fuera.push(
        `<div class="tw"><table><thead><tr>${enc.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>` +
        cuerpo.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("") +
        `</tbody></table></div>`,
      );
      continue;
    }

    // cita
    if (/^\s*>/.test(l)) {
      cerrarLista(pila);
      const buf = [];
      while (i < lineas.length && /^\s*>/.test(lineas[i])) buf.push(lineas[i++].replace(/^\s*>\s?/, ""));
      fuera.push(`<blockquote>${markdown(buf.join("\n")).html}</blockquote>`);
      continue;
    }

    // listas
    const li = l.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (li) {
      const tipo = /^\d/.test(li[2]) ? "ol" : "ul";
      if (!pila.length || pila[pila.length - 1] !== tipo) { cerrarLista(pila); fuera.push(`<${tipo}>`); pila.push(tipo); }
      const cont = li[3].replace(/^\[([ xX])\]\s*/, (_, c) =>
        `<input type="checkbox" disabled ${/[xX]/.test(c) ? "checked" : ""}> `);
      fuera.push(`<li>${inline(cont).replace(/&lt;input/g, "<input").replace(/disabled\s*(checked)?&gt;/g, (m0, c) => `disabled ${c ?? ""}>`)}</li>`);
      i++; continue;
    }

    if (!l.trim()) { cerrarLista(pila); i++; continue; }

    // párrafo
    const buf = [];
    while (i < lineas.length && lineas[i].trim() && !/^(#{1,6}\s|\s*```|\s*>|\s*([-*+]|\d+[.)])\s)/.test(lineas[i]))
      buf.push(lineas[i++]);
    cerrarLista(pila);
    fuera.push(`<p>${inline(buf.join(" "))}</p>`);
  }
  cerrarLista(pila);
  return { html: fuera.join("\n"), toc };
}

// ── CSV ──────────────────────────────────────────────────────────────────────
function csv(texto, sep_ = ",") {
  const filas = [];
  let campo = "", fila = [], comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === sep_) { fila.push(campo); campo = ""; }
    else if (c === "\n") { fila.push(campo); filas.push(fila); fila = []; campo = ""; }
    else if (c !== "\r") campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}

// ── La cola de pedidos ───────────────────────────────────────────────────────
const colaVacia = () => ({ pedidos: [] });
async function leerCola() {
  try { return JSON.parse(await readFile(COLA, "utf8")); } catch { return colaVacia(); }
}
async function escribirCola(c) {
  await mkdir(dirname(COLA), { recursive: true });
  await writeFile(COLA, JSON.stringify(c, null, 2) + "\n", "utf8");
}

// ── Interfaz ─────────────────────────────────────────────────────────────────
const CSS = `
:root{--bg:#fbfbf9;--bg2:#fff;--fg:#16150f;--fg2:#5c5a52;--fg3:#8b887e;
--bd:rgba(20,18,10,.12);--ac:#0f766e;--acbg:rgba(15,118,110,.07);
--al:#a16207;--albg:rgba(161,98,7,.09);--k:#9333ea;--s:#0f766e;--c:#8b887e;--n:#b45309}
@media(prefers-color-scheme:dark){:root{--bg:#14140f;--bg2:#1c1c18;--fg:#f2f1ea;
--fg2:#b8b6ab;--fg3:#83817a;--bd:rgba(255,255,255,.13);--ac:#5ec8bb;
--acbg:rgba(94,200,187,.10);--al:#d9a441;--albg:rgba(217,164,65,.10);
--k:#c084fc;--s:#5ec8bb;--c:#6f6d66;--n:#e0a458}}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:70px}
body{margin:0;background:var(--bg);color:var(--fg);line-height:1.68;
font:16px/1.68 ui-sans-serif,-apple-system,"Segoe UI",system-ui,sans-serif;
-webkit-text-size-adjust:100%;overflow-wrap:break-word}
header{position:sticky;top:0;z-index:9;background:var(--bg2);border-bottom:.5px solid var(--bd);
padding:10px max(15px,env(safe-area-inset-left));display:flex;gap:11px;align-items:center;min-height:52px}
header a.home{color:var(--ac);text-decoration:none;font-size:15px;white-space:nowrap;
padding:6px 2px;min-height:44px;display:flex;align-items:center;font-weight:600}
.crumb{color:var(--fg3);font-size:12.5px;overflow:hidden;text-overflow:ellipsis;
white-space:nowrap;flex:1;min-width:0;font-family:ui-monospace,Menlo,monospace;direction:rtl;text-align:left}
.crumb a{color:var(--fg2);text-decoration:none}
.badge{background:var(--al);color:#fff;font-size:13px;font-weight:600;padding:9px 13px;
border-radius:99px;text-decoration:none;min-height:40px;display:flex;align-items:center}
@media(prefers-color-scheme:dark){.badge{color:#14140f}}
main{max-width:860px;margin:0 auto;padding:20px max(15px,env(safe-area-inset-left))
calc(96px + env(safe-area-inset-bottom))}
h1{font-size:26px;line-height:1.25}h2{font-size:21px;margin-top:2em}h3{font-size:17px}
h1,h2,h3,h4,h5,h6{font-weight:600;letter-spacing:-.01em;scroll-margin-top:64px;position:relative}
h2{border-bottom:.5px solid var(--bd);padding-bottom:.3em}
.ancla{position:absolute;left:-.85em;color:var(--fg3);text-decoration:none;opacity:0;font-weight:400}
h1:hover .ancla,h2:hover .ancla,h3:hover .ancla{opacity:1}
p{margin:.85em 0}a{color:var(--ac)}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.855em;
background:var(--acbg);padding:.13em .38em;border-radius:4px}
pre{background:var(--bg2);border:.5px solid var(--bd);border-radius:10px;
padding:13px 15px;overflow-x:auto;position:relative}
pre code{background:none;padding:0;font-size:12.5px;line-height:1.6;white-space:pre}
pre[data-lang]:not([data-lang=""])::before{content:attr(data-lang);position:absolute;top:0;right:9px;
font:10px ui-monospace,Menlo,monospace;color:var(--fg3);letter-spacing:.06em;text-transform:uppercase}
blockquote{margin:1.1em 0;padding:.6em 1em;border-left:2.5px solid var(--ac);
background:var(--acbg);border-radius:0 8px 8px 0}
blockquote p{margin:.4em 0}
.tw{overflow-x:auto;margin:1.2em 0;border:.5px solid var(--bd);border-radius:10px}
table{border-collapse:collapse;width:100%;font-size:14px}
th,td{padding:8px 11px;text-align:left;border-bottom:.5px solid var(--bd);vertical-align:top}
th{background:var(--acbg);font-weight:600;white-space:nowrap;position:sticky;top:0}
tr:last-child td{border-bottom:none}
hr{border:none;border-top:.5px solid var(--bd);margin:2em 0}
img{max-width:100%;height:auto;border-radius:8px}
i.k{color:var(--k);font-style:normal}i.s{color:var(--s);font-style:normal}
i.c{color:var(--c);font-style:italic}i.n{color:var(--n);font-style:normal}
.ln{color:var(--fg3);user-select:none;display:inline-block;width:3.2em;
text-align:right;padding-right:1.1em;opacity:.55}
ul.dir{list-style:none;padding:0;margin:1em 0;border:.5px solid var(--bd);border-radius:10px;overflow:hidden}
ul.dir li+li{border-top:.5px solid var(--bd)}
ul.dir a{display:flex;justify-content:space-between;gap:1rem;padding:12px 14px;
color:var(--fg);text-decoration:none;min-height:44px;align-items:center}
ul.dir a:active{background:var(--acbg)}
ul.dir .peso{color:var(--fg3);font-size:12px;white-space:nowrap;font-family:ui-monospace,Menlo,monospace}
.ico{color:var(--fg3);margin-right:.55em;font-family:ui-monospace,Menlo,monospace}
.sub{color:var(--fg2);font-size:14.5px}
.item{border:.5px solid var(--bd);border-radius:10px;padding:14px;margin:14px 0;background:var(--bg2)}
.item .rt{font-family:ui-monospace,Menlo,monospace;font-size:13.5px;font-weight:600;
color:var(--ac);text-decoration:none;display:block;margin-bottom:.4em;word-break:break-all}
.item .nt{margin:.4em 0;font-size:14.5px}
.eco{background:var(--albg);border-radius:8px;padding:9px 11px;margin:.5em 0;font-size:14px}
.eco b{font-size:12.5px;color:var(--fg2);display:block;font-family:ui-monospace,Menlo,monospace}
.vacio{color:var(--fg3);padding:2.5rem 0;text-align:center}
form.nota{margin-top:1em;display:flex;flex-direction:column;gap:9px}
textarea{width:100%;min-height:88px;padding:11px;border:.5px solid var(--bd);border-radius:9px;
background:var(--bg);color:var(--fg);font:15px/1.5 inherit;resize:vertical}
.fila{display:flex;gap:9px;flex-wrap:wrap}
button,.btn{padding:11px 17px;border-radius:9px;border:.5px solid var(--bd);background:var(--bg2);
color:var(--fg);font:600 14.5px inherit;min-height:44px;cursor:pointer;text-decoration:none;
display:inline-flex;align-items:center}
button.pri{background:var(--ac);color:var(--bg2);border-color:var(--ac)}
input[type=search]{width:100%;padding:11px 13px;border:.5px solid var(--bd);border-radius:9px;
background:var(--bg2);color:var(--fg);font:15px inherit;min-height:44px}
.toc{position:sticky;top:62px;background:var(--bg2);border:.5px solid var(--bd);border-radius:10px;
padding:10px 13px;margin:0 0 1.4em;max-height:38vh;overflow:auto;font-size:14px}
.toc summary{cursor:pointer;font-weight:600;font-size:13.5px;color:var(--fg2)}
.toc a{display:block;padding:5px 0;color:var(--fg2);text-decoration:none;
overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.toc .n3{padding-left:1.1em;font-size:13px;color:var(--fg3)}
.meta{color:var(--fg3);font-size:12.5px;font-family:ui-monospace,Menlo,monospace;margin:.4em 0 1.4em}
embed,iframe.pdf{width:100%;height:78vh;border:.5px solid var(--bd);border-radius:10px;background:var(--bg2)}
`;

const PAGINA = ({ titulo, migas, cuerpo, pendientes = 0, recarga = null }) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><meta name="color-scheme" content="light dark">
<title>${esc(titulo)} · savia-os</title><style>${CSS}</style></head>
<body><header>
  <a class="home" href="/">savia-os</a>
  <span class="crumb">${migas}</span>
  ${pendientes ? `<a class="badge" href="/pendientes">${pendientes}</a>` : ""}
</header><main>${cuerpo}</main>
${recarga ? `<script>
let m=0;
function ocupado(){const t=document.querySelector('textarea');
 return (t&&t.value.trim().length>0)||(document.activeElement&&document.activeElement.tagName==='TEXTAREA')}
async function t(){try{const r=await fetch('/mtime?p='+encodeURIComponent(${JSON.stringify(recarga)}),{cache:'no-store'});
const j=await r.json();if(!m){m=j.m}else if(j.m!==m&&!ocupado()){location.reload()}}catch(e){}}
setInterval(t,2000);t();</script>` : ""}
</body></html>`;

const migasDe = (rel) => {
  if (!rel) return `<a href="/">/</a>`;
  const partes = rel.split("/");
  let acum = "";
  return partes.map((p, i) => {
    acum = acum ? `${acum}/${p}` : p;
    return i === partes.length - 1 ? esc(p) : `<a href="/f/${encodeURI(acum)}">${esc(p)}</a>`;
  }).join("/");
};

const ICONO = (nombre, dir) => {
  if (dir) return "▸";
  const e = extname(nombre).toLowerCase();
  if (e === ".md") return "¶";
  if (IMAGEN.has(e) || e === ".svg") return "◨";
  if (e === ".pdf") return "▤";
  if (TABULAR.has(e)) return "▦";
  if (LENGUAJE[e]) return "‹›";
  return "·";
};

// ── Vistas ───────────────────────────────────────────────────────────────────
async function vistaDirectorio(abs, rel) {
  const entradas = await readdir(abs, { withFileTypes: true });
  const vis = [];
  for (const e of entradas) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (negado(r)) continue;
    let peso = "";
    if (e.isFile()) { try { peso = kb((await stat(join(abs, e.name))).size); } catch { peso = "?"; } }
    vis.push({ nombre: e.name, href: r, dir: e.isDirectory(), peso });
  }
  vis.sort((a, b) => (a.dir !== b.dir ? (a.dir ? -1 : 1) : a.nombre.localeCompare(b.nombre, "es")));
  if (!vis.length) return `<p class="vacio">Vacío, o todo su contenido está excluido.</p>`;
  return `<form action="/buscar" method="get"><input type="search" name="q" placeholder="Buscar archivo en el repo…" autocomplete="off"></form>
  <ul class="dir">${vis.map((v) =>
    `<li><a href="/f/${encodeURI(v.href)}"><span><span class="ico">${ICONO(v.nombre, v.dir)}</span>${esc(v.nombre)}${v.dir ? "/" : ""}</span><span class="peso">${v.peso}</span></a></li>`,
  ).join("")}</ul>`;
}

async function vistaArchivo(abs, rel, st) {
  const e = extname(abs).toLowerCase();
  const meta = `<p class="meta">${kb(st.size)} · modificado ${new Date(st.mtimeMs).toISOString().slice(0, 16).replace("T", " ")}</p>`;

  if (IMAGEN.has(e)) return meta + `<img src="/raw/${encodeURI(rel)}" alt="${esc(basename(rel))}">`;
  if (e === ".pdf") return meta + `<embed src="/raw/${encodeURI(rel)}" type="application/pdf">`;

  if (st.size > 3_000_000)
    return meta + `<p class="vacio">Pesa ${kb(st.size)} — demasiado para mostrar. <a class="btn" href="/raw/${encodeURI(rel)}">Descargar</a></p>`;

  let txt;
  try { txt = await readFile(abs, "utf8"); } catch { return meta + `<p class="vacio">No se pudo leer como texto.</p>`; }
  if (txt.includes(" "))
    return meta + `<p class="vacio">Binario. <a class="btn" href="/raw/${encodeURI(rel)}">Descargar</a></p>`;

  if (e === ".md") {
    const { html, toc } = markdown(txt);
    const indice = toc.length > 3
      ? `<details class="toc"><summary>Índice · ${toc.length} secciones</summary>${
          toc.map((t) => `<a class="n${t.n}" href="#${t.id}">${esc(t.txt)}</a>`).join("")}</details>`
      : "";
    return meta + indice + html;
  }

  if (e === ".svg") return meta + `<img src="/raw/${encodeURI(rel)}" alt="">` +
    `<h3>Fuente</h3><pre data-lang="svg"><code>${resaltar(txt, "xml")}</code></pre>`;

  if (TABULAR.has(e)) {
    const filas = csv(txt, e === ".tsv" ? "\t" : ",");
    if (!filas.length) return meta + `<p class="vacio">Vacío.</p>`;
    const [enc, ...cuerpo] = filas;
    const recorte = cuerpo.slice(0, 500);
    return meta + `<div class="tw"><table><thead><tr>${enc.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>` +
      `<tbody>${recorte.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` +
      (cuerpo.length > recorte.length ? `<p class="sub">Mostrando 500 de ${cuerpo.length} filas.</p>` : "");
  }

  if (e === ".ipynb") {
    try {
      const nb = JSON.parse(txt);
      return meta + (nb.cells ?? []).map((c) => {
        const src = (Array.isArray(c.source) ? c.source.join("") : c.source) ?? "";
        return c.cell_type === "markdown"
          ? markdown(src).html
          : `<pre data-lang="py"><code>${resaltar(src, "py")}</code></pre>`;
      }).join("\n");
    } catch { /* cae a texto plano */ }
  }

  const lang = LENGUAJE[e] ?? (PLANO.has(e) || !e ? null : null);
  const lineas = txt.split("\n");
  const cuerpo = lineas.map((l, i) =>
    `<span class="ln">${i + 1}</span>${lang ? resaltar(l, lang) : esc(l)}`).join("\n");
  return meta + `<pre data-lang="${esc(lang ?? "")}"><code>${cuerpo}</code></pre>`;
}

async function vistaPendientes(cola) {
  const abiertos = cola.pedidos.filter((p) => p.estado !== "listo");
  if (!abiertos.length)
    return `<h2>Pedidos de lectura</h2><p class="vacio">Nada pendiente. Cuando te pida revisar algo, aparece acá.</p>`;
  return `<h2>Pedidos de lectura</h2>
  <p class="sub">Lo que te pedí que mires, con el motivo. «Guardar nota» lo deja abierto para seguir; «Listo» lo cierra.</p>
  ${abiertos.map((p, i) => `<div class="item">
    <a class="rt" href="/f/${encodeURI(p.ruta)}">${esc(p.ruta)}</a>
    <p class="nt">${esc(p.motivo ?? "")}</p>
    ${(p.notas ?? []).map((n) => `<p class="eco">${n.seccion ? `<b>${esc(n.seccion)}</b>` : ""}${esc(n.nota)}</p>`).join("")}
    <form class="nota" method="post" action="/marcar">
      <input type="hidden" name="i" value="${i}">
      <textarea name="nota" placeholder="qué encontraste, dudas, lo que sea"></textarea>
      <div class="fila">
        <button name="accion" value="guardar">Guardar nota</button>
        <button class="pri" name="accion" value="listo">Listo</button>
      </div>
    </form></div>`).join("")}`;
}

async function buscar(q) {
  const hallazgos = [];
  const term = q.toLowerCase();
  async function caminar(dir, rel, prof) {
    if (prof > 8 || hallazgos.length >= 120) return;
    let ent;
    try { ent = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ent) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (negado(r)) continue;
      if (e.name.toLowerCase().includes(term)) hallazgos.push({ r, dir: e.isDirectory() });
      if (e.isDirectory()) await caminar(join(dir, e.name), r, prof + 1);
    }
  }
  await caminar(RAIZ, "", 0);
  return hallazgos;
}

// ── Servidor ─────────────────────────────────────────────────────────────────
const servidor = createServer(async (req, res) => {
  const cola = await leerCola();
  const pend = cola.pedidos.filter((p) => p.estado !== "listo").length;
  const enviar = (codigo, html, tipo = "text/html; charset=utf-8") => {
    res.writeHead(codigo, {
      "content-type": tipo,
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "cache-control": "no-store",
    });
    res.end(html);
  };
  const error = (codigo, msg) =>
    enviar(codigo, PAGINA({ titulo: String(codigo), migas: migasDe(""), cuerpo: `<p class="vacio">${esc(msg)}</p>`, pendientes: pend }));

  let url;
  try { url = new URL(req.url, "http://x"); } catch { return error(400, "Ruta inválida."); }
  const ruta = decodeURIComponent(url.pathname);

  // POST /marcar
  if (req.method === "POST" && ruta === "/marcar") {
    let cuerpo = "";
    for await (const c of req) { cuerpo += c; if (cuerpo.length > 100_000) return error(413, "Nota demasiado larga."); }
    const p = new URLSearchParams(cuerpo);
    const i = Number(p.get("i"));
    const abiertos = cola.pedidos.filter((x) => x.estado !== "listo");
    const dest = abiertos[i];
    if (dest) {
      const nota = (p.get("nota") ?? "").trim();
      if (nota) (dest.notas ??= []).push({ seccion: null, nota, cuando: new Date().toISOString() });
      if (p.get("accion") === "listo") dest.estado = "listo";
      await escribirCola(cola);
    }
    res.writeHead(303, { location: "/pendientes" });
    return res.end();
  }
  if (req.method !== "GET") return error(405, "Solo GET. Este visor no modifica el repo.");

  if (ruta === "/pendientes")
    return enviar(200, PAGINA({ titulo: "Pendientes", migas: "pendientes", cuerpo: await vistaPendientes(cola), pendientes: pend }));

  if (ruta === "/buscar") {
    const q = (url.searchParams.get("q") ?? "").trim();
    if (!q) return error(400, "Falta el término de búsqueda.");
    const h = await buscar(q);
    const cuerpo = `<h2>«${esc(q)}»</h2><p class="sub">${h.length} resultado${h.length === 1 ? "" : "s"}${h.length >= 120 ? " (recortado)" : ""}</p>` +
      (h.length ? `<ul class="dir">${h.map((x) =>
        `<li><a href="/f/${encodeURI(x.r)}"><span><span class="ico">${ICONO(basename(x.r), x.dir)}</span>${esc(x.r)}</span></a></li>`).join("")}</ul>`
        : `<p class="vacio">Nada.</p>`);
    return enviar(200, PAGINA({ titulo: q, migas: "buscar", cuerpo, pendientes: pend }));
  }

  if (ruta === "/mtime") {
    const p = url.searchParams.get("p") ?? "";
    if (negado(p)) return enviar(200, JSON.stringify({ m: 0 }), "application/json");
    try {
      const a = await realpath(join(RAIZ, p));
      if (a !== RAIZ && !a.startsWith(RAIZ + sep)) return enviar(200, JSON.stringify({ m: 0 }), "application/json");
      const s = await stat(a);
      return enviar(200, JSON.stringify({ m: Math.floor(s.mtimeMs) }), "application/json");
    } catch { return enviar(200, JSON.stringify({ m: 0 }), "application/json"); }
  }

  // /raw/<path> y /f/<path>
  const crudo = ruta.startsWith("/raw/");
  let rel = crudo ? ruta.slice(5) : ruta.startsWith("/f/") ? ruta.slice(3) : ruta === "/" ? "" : null;
  if (rel === null) return error(404, "No existe.");
  rel = rel.replace(/^\/+|\/+$/g, "");

  if (negado(rel)) return error(403, "Excluido a propósito.");

  let abs;
  try { abs = await realpath(join(RAIZ, rel)); } catch { return error(404, "No existe."); }
  if (abs !== RAIZ && !abs.startsWith(RAIZ + sep)) return error(403, "Fuera de la raíz del repo.");
  if (negado(relative(RAIZ, abs))) return error(403, "Excluido a propósito.");

  const st = await stat(abs);

  if (crudo) {
    if (st.isDirectory()) return error(400, "Es un directorio.");
    if (st.size > 60_000_000) return error(413, "Demasiado grande.");
    const e = extname(abs).toLowerCase();
    res.writeHead(200, {
      "content-type": MIME[e] ?? "application/octet-stream",
      "content-security-policy": "default-src 'none'; sandbox",
      "x-content-type-options": "nosniff",
      "cache-control": "no-store",
    });
    return res.end(await readFile(abs));
  }

  try {
    const cuerpo = st.isDirectory() ? await vistaDirectorio(abs, rel) : await vistaArchivo(abs, rel, st);
    return enviar(200, PAGINA({
      titulo: rel || "/", migas: migasDe(rel), cuerpo, pendientes: pend, recarga: rel || ".",
    }));
  } catch (err) { return error(500, err.message); }
});

servidor.listen(PUERTO, "127.0.0.1", () => {
  console.log(`\n  visor  →  http://127.0.0.1:${PUERTO}`);
  console.log(`  raíz   →  ${RAIZ}`);
  console.log(`  cola   →  ${relative(RAIZ, COLA)}`);
  console.log(`  niega  →  .env* · .git · node_modules · venvs · weights · uploads · llaves\n`);
  if (!process.argv.includes("--share")) return console.log(`  Para exponerlo:  pnpm viewer:share\n`);
  console.log(`  Abriendo túnel de cloudflared…\n`);
  const t = spawn("cloudflared", ["tunnel", "--no-autoupdate", "--protocol", "http2", "--url", `http://127.0.0.1:${PUERTO}`], { stdio: "inherit" });
  const cerrar = () => { t.kill(); servidor.close(); process.exit(0); };
  process.on("SIGINT", cerrar);
  process.on("SIGTERM", cerrar);
});
