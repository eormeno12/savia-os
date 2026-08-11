#!/usr/bin/env node
// Acredita la lista de negación del visor ROMPIÉNDOLA.
//
//   node scripts/repo-viewer.test.mjs
//
// El visor se expone por un túnel público y este repo tiene credenciales reales:
// la lista de negación es lo único que separa una cosa de la otra. Un test que
// solo comprueba "pide .env y da 403" es indistinguible de uno que no funciona
// —cualquier 403, incluso por un bug, lo satisface—, así que acá se hacen las dos
// mitades:
//
//   1. con la lista PUESTA   → el secreto NO se sirve
//   2. con la lista VACIADA  → el secreto SÍ se sirve
//
// Si la mitad 2 falla, la mitad 1 no probaba nada: el 403 venía de otro lado.

import { spawn } from "node:child_process";
import { writeFile, mkdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const AQUI = new URL(".", import.meta.url).pathname;
const VISOR = join(AQUI, "repo-viewer.mjs");
const SECRETO = "CLAVE_FALSA_DE_PRUEBA_no_es_real";

let fallos = 0;
const ok = (cond, msg) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fallos++;
};

/** Levanta el visor sobre una raíz de prueba y devuelve un fetch ya apuntado. */
async function levantar(raizFalsa, puerto, sinNegados = false) {
  let fuente = await readFile(VISOR, "utf8");
  // Se apunta la raíz al directorio de prueba y, si toca, se vacía la lista.
  fuente = fuente.replace(
    'const RAIZ = await realpath(new URL("..", import.meta.url).pathname);',
    `const RAIZ = await realpath(${JSON.stringify(raizFalsa)});`,
  );
  if (sinNegados) fuente = fuente.replace(/const NEGADOS = \[[\s\S]*?\];/, "const NEGADOS = [];");

  const mut = join(raizFalsa, `_visor_${puerto}.mjs`);
  await writeFile(mut, fuente, "utf8");
  const p = spawn(process.execPath, [mut], { env: { ...process.env, PORT: String(puerto) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    try { await fetch(`http://127.0.0.1:${puerto}/`); break; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  return {
    get: async (ruta) => {
      const r = await fetch(`http://127.0.0.1:${puerto}${ruta}`, { redirect: "manual" });
      return { codigo: r.status, texto: await r.text() };
    },
    matar: () => p.kill(),
  };
}

const raiz = join(tmpdir(), `visor-test-${process.pid}`);
await mkdir(join(raiz, "sub"), { recursive: true });
await writeFile(join(raiz, ".env"), `API_KEY=${SECRETO}\n`);
await writeFile(join(raiz, ".env.local"), `OTRO=${SECRETO}\n`);
await writeFile(join(raiz, "sub", ".env"), `ANIDADO=${SECRETO}\n`);
await writeFile(join(raiz, "clave.pem"), `-----BEGIN KEY-----\n${SECRETO}\n`);
await writeFile(join(raiz, "publico.md"), "# Hola\n\nEsto sí se puede ver.\n");

console.log("\n1 · Con la lista de negación PUESTA — el secreto no debe salir\n");
const a = await levantar(raiz, 4571);
const rutasSecretas = [
  "/f/.env", "/f/.env.local", "/f/sub/.env", "/f/clave.pem",
  "/raw/.env", "/raw/sub/.env", "/raw/clave.pem",
  "/f/./.env", "/f/sub/../.env", "/f/%2E%65nv",
];
for (const r of rutasSecretas) {
  const { codigo, texto } = await a.get(r);
  ok(!texto.includes(SECRETO), `${r.padEnd(22)} → ${codigo}, sin filtrar el secreto`);
}
{
  const { codigo, texto } = await a.get("/f/publico.md");
  ok(codigo === 200 && texto.includes("Esto sí se puede ver"), "/f/publico.md         → 200, sí se sirve lo público");
}
for (const r of ["/f/../../../etc/passwd", "/raw/../../etc/hosts"]) {
  const { codigo, texto } = await a.get(r);
  ok(codigo >= 400 && !texto.includes("root:"), `${r.padEnd(22)} → ${codigo}, no escapa de la raíz`);
}
a.matar();

console.log("\n2 · MUTANTE: lista de negación VACÍA — ahora el secreto DEBE salir\n");
console.log("   (si esto no pasa, la parte 1 no estaba probando nada)\n");
const b = await levantar(raiz, 4572, true);
{
  const { texto } = await b.get("/raw/.env");
  ok(texto.includes(SECRETO), "sin la lista, /raw/.env SÍ filtra el secreto → la lista es lo que lo impide");
}
b.matar();

await rm(raiz, { recursive: true, force: true });
console.log(`\n${fallos === 0 ? "  lista de negación acreditada ✓" : `  ${fallos} FALLO(S) ✗`}\n`);
process.exit(fallos === 0 ? 0 : 1);
