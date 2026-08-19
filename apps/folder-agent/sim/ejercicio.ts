/**
 * EJERCICIO DEL SIMULADOR. No es un test del agente: es la prueba de que el servidor
 * simulado toma las cuatro decisiones que el plan le asigna, y no dice que si a todo.
 *
 * Corre contra un agente de mentira - un cliente minimo que habla el protocolo - porque
 * el agente de verdad todavia no existe. Cuando exista, este archivo queda como el
 * banco contra el que se lo enchufa.
 */
import { createHash } from "node:crypto";
import { iniciar } from "./server.ts";

const BASE = "http://127.0.0.1:4477";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const llamar = async (ruta: string, cuerpo: unknown) =>
  (await fetch(`${BASE}${ruta}`, { method: "POST", body: JSON.stringify(cuerpo) })).json();

let fallas = 0;
const afirmar = (ok: boolean, que: string, porque: string) => {
  console.log(`${ok ? "  OK  " : "  MAL "} ${que}`);
  if (!ok) { console.log(`       importa porque: ${porque}`); fallas += 1; }
};

const ROOT = "root-1";

const barrer = async (total: number, fn: () => Promise<void>, status = "complete") => {
  const { sweepId } = await llamar("/sweep/open", { root: ROOT, total });
  await fn();
  return llamar("/sweep/close", { sweepId, status });
};

/** El agente de mentira: reporta, y si le piden bytes los sube y confirma. */
const observar = async (archivos: { path: string; contenido: string }[]) => {
  const entries = archivos.map((a) => ({ path: a.path, hash: hash(a.contenido) }));
  const { decisions } = await llamar("/presence/observed", { root: ROOT, entries });
  for (const d of decisions as any[]) {
    if (d.decision !== "upload") continue;
    const a = archivos.find((x) => x.path === d.path)!;
    await fetch(`${BASE}${d.permit.url}`, { method: "PUT", body: a.contenido });
    await llamar("/upload/completed", { permit: d.permit.url.split("/").pop() });
  }
  return decisions as any[];
};

const servidor = await iniciar();

console.log("\n1 - PRIMERA VEZ: los dos se piden");
const d1 = await barrer(2, async () => {
  const d = await observar([
    { path: "contrato.docx", contenido: "el contrato" },
    { path: "informe.xlsx", contenido: "el informe" },
  ]);
  afirmar(d.every((x) => x.decision === "upload"), "los dos salen `upload`", "sin bytes en el almacen no hay nada que deduplicar, asi que pedirlos es lo correcto");
});

console.log("\n2 - SEGUNDA VEZ: dedupe previo a la transferencia");
await barrer(2, async () => {
  const d = await observar([
    { path: "contrato.docx", contenido: "el contrato" },
    { path: "informe.xlsx", contenido: "el informe" },
  ]);
  afirmar(d.every((x) => x.decision === "known"), "los dos salen `known` - cero bytes transferidos", "es la razon entera de las dos colas: sin esto, cuarenta maquinas con la misma presentacion la suben cuarenta veces");
});

console.log("\n3 - OTRA MAQUINA, MISMO ARCHIVO: `known` sin haberlo subido nunca");
await barrer(1, async () => {
  const d = await observar([{ path: "copia/contrato.docx", contenido: "el contrato" }]);
  afirmar(d[0].decision === "known", "una ruta nueva con contenido conocido no pide bytes", "la identidad es el contenido, no la ruta: el mismo archivo en otro lugar ya lo tenemos");
});

console.log("\n4 - DIVERGENCIA: el archivo cambia entre el hasheo y el PUT");
const { decisions: dv } = await llamar("/presence/observed", { root: ROOT, entries: [{ path: "movil.txt", hash: hash("lo que vi") }] });
await fetch(`${BASE}${(dv as any[])[0].permit.url}`, { method: "PUT", body: "lo que subi" });
const rv = await llamar("/upload/completed", { permit: (dv as any[])[0].permit.url.split("/").pop() });
afirmar(rv.diverged === true && rv.verifiedHash === hash("lo que subi"), "la respuesta trae el hash VERIFICADO y marca la divergencia", "sin ese retorno el agente y el registro creen cosas distintas del mismo archivo para siempre, y una desaparicion posterior no matchea con nada");

console.log("\n5 - UNA BAJA: no se retira hasta que la evidencia alcanza");
const r5 = await barrer(4, async () => {
  await llamar("/presence/vanished", { root: ROOT, entries: [{ path: "informe.xlsx", lastSeenHash: hash("el informe") }] });
});
afirmar((r5 as any).retired.length === 0, "el barrido cierra y NO retira: la ventana no vencio", "«una desaparicion es una hipotesis, no un hecho». Retirar al primer reporte convierte un disco lento en un borrado");

console.log("\n6 - PASA LA VENTANA + UN BARRIDO COMPLETO: recien ahi se retira");
await new Promise((r) => setTimeout(r, 5_200));
const r6 = await barrer(3, async () => {});
afirmar((r6 as any).retired.includes("informe.xlsx"), "retiro silencioso, sin preguntarle a nadie", "las dos condiciones son la ventana Y un barrido completo posterior: tiempo sin observacion no es evidencia");

console.log("\n7 - VUELVE EL ARCHIVO: el retiro es reversible");
await barrer(3, async () => {
  await observar([{ path: "informe.xlsx", contenido: "el informe" }]);
});
const doc = (servidor.estado() as any).documentos.find((d: any) => d.path === "informe.xlsx");
afirmar(doc && doc.retirado === false, "vuelve entero, sin re-subir un byte", "es lo que vuelve tolerable que el retiro sea silencioso: un falso positivo cuesta devolver el archivo a la carpeta");

console.log("\n8 - CORTE POR VOLUMEN: muchas de golpe congelan la raiz");
const r8 = await llamar("/presence/vanished", {
  root: ROOT,
  entries: [
    { path: "contrato.docx", lastSeenHash: hash("el contrato") },
    { path: "copia/contrato.docx", lastSeenHash: hash("el contrato") },
  ],
});
afirmar((r8 as any).frozen === true, "la raiz queda congelada y exige mas evidencia", "un disco desmontado produce el mismo conjunto de ausencias que un borrado masivo, y el corte es lo unico que los separa");

console.log(`\n${fallas === 0 ? "ejercicio ok" : `EJERCICIO-ERR: ${fallas} afirmaciones fallaron`}`);
console.log("estado final:", JSON.stringify(servidor.estado(), null, 2));
servidor.cerrar();
process.exit(fallas === 0 ? 0 : 1);
