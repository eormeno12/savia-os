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
/**
 * EL TOKEN DE DISPOSITIVO, que a partir del bloque 0 lleva TODA llamada. Empieza en
 * `null` a proposito: asi el primer bloque puede afirmar que sin el no entra nada.
 */
let TOKEN: string | null = null;

const crudo = (ruta: string, cuerpo: unknown) =>
  fetch(`${BASE}${ruta}`, {
    method: "POST",
    body: JSON.stringify(cuerpo),
    headers: TOKEN ? { authorization: `Bearer ${TOKEN}` } : {},
  });

const llamar = async (ruta: string, cuerpo: unknown) => (await crudo(ruta, cuerpo)).json();

/** Sin token pase lo que pase: es como habla un agente que todavia no se vinculo. */
const llamarSinCredencial = async (ruta: string, cuerpo: unknown) =>
  fetch(`${BASE}${ruta}`, { method: "POST", body: JSON.stringify(cuerpo) });

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

console.log("\n0 - EL ENROLAMIENTO: sin token no entra nada");

// La puerta, antes que nada. Si esto pasara, las 16 afirmaciones de abajo estarian
// midiendo un servidor abierto.
const sinNada = await llamarSinCredencial("/sweep/open", { root: ROOT, total: 0 });
afirmar(sinNada.status === 401, "una llamada del protocolo sin credencial se rechaza", "el resto del ejercicio da por sentado que el token vale de algo; si el servidor aceptara sin header, todo lo que sigue seria verde por vacio");

const v = await llamar("/enroll/begin", {});
afirmar(typeof v.code === "string" && v.code !== v.enrollmentId, "`code` y `enrollmentId` son distintos", "el codigo corto lo lee una persona y el id opaco reclama el token: si fueran el mismo, adivinar seis caracteres seria adivinar un token de dispositivo");

const antes = await llamar("/enroll/claim", { enrollmentId: v.enrollmentId });
afirmar(antes.status === "pending" && antes.deviceToken === undefined, "reclamar antes de que alguien apruebe no entrega token", "es la propiedad entera del enrolamiento: el agente puede pedir todo lo que quiera y sin un humano no obtiene nada");

// ── ACA HACE DE HUMANO EL EJERCICIO. El cliente de Rust NO tiene con que llamar esto ──
const ap = await llamar("/enroll/approve", { code: v.code, userId: "user-1" });
afirmar(ap.deviceToken === undefined, "aprobar no le devuelve el token a la persona", "el token viaja al agente por `claim` y por ningun otro lado: una captura de la pantalla de la persona no puede ser una credencial");

const dado = await llamar("/enroll/claim", { enrollmentId: v.enrollmentId });
afirmar(dado.status === "approved" && typeof dado.deviceToken === "string", "aprobado, reclamar entrega el token", "es el unico camino por el que un agente obtiene credencial");

const otraVez = await llamar("/enroll/claim", { enrollmentId: v.enrollmentId });
afirmar(otraVez.deviceToken === dado.deviceToken, "reclamar dos veces entrega el MISMO token", "si la respuesta que traia el token se pierde en la red el agente vuelve a reclamar; acunar uno nuevo dejaria vivo el anterior, que nadie va a usar y nadie va a revocar");

TOKEN = dado.deviceToken;
const conToken = await crudo("/sweep/open", { root: "root-descartable", total: 0 });
afirmar(conToken.status === 200, "con el token, la misma llamada entra", "cierra el par: la puerta distingue, no rechaza todo");

// Los dos finales del tramite, que no son el mismo y al usuario se le dicen distinto.
const vDeny = await llamar("/enroll/begin", {});
await llamar("/enroll/deny", { code: vDeny.code });
afirmar((await llamar("/enroll/claim", { enrollmentId: vDeny.enrollmentId })).status === "denied", "una vinculacion denegada dice `denied`", "«alguien dijo que no» y «te tardaste» son mensajes opuestos para el usuario: colapsarlos obliga a la interfaz a inventar cual mostrar");

const vExp = await llamar("/enroll/begin", { expiresInMs: 0 });
afirmar((await llamar("/enroll/claim", { enrollmentId: vExp.enrollmentId })).status === "expired", "una vinculacion vencida dice `expired`", "sin este camino ejercido, el arm `Vencido` del cliente es codigo muerto que nadie probo");

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
afirmar((r8 as any).frozen === true, "la raiz queda congelada", "un disco desmontado produce el mismo conjunto de ausencias que un borrado masivo, y el corte es lo unico que los separa");

console.log("\n9 - Y CONGELAR EXIGE, NO SOLO INFORMA");
// La ventana vence, y con la raiz sana esto retiraria. Congelada, no.
await new Promise((r) => setTimeout(r, 5_200));
const r9a = await barrer(3, async () => {});
afirmar((r9a as any).retired.length === 0, "vencida la ventana, la raiz congelada NO retira", "es la unica diferencia entre congelar y no congelar. Sin esto el estado se reporta, se muestra en el panel, y el retiro masivo ocurre igual al vencer la ventana - o sea que el corte por volumen no separa nada");
afirmar((r9a as any).frozen === false, "y ese barrido completo ES la evidencia: deshiela", "«se exige al menos UN barrido completo mas sobre esa raiz, que es a la vez la prueba de que la raiz esta viva y de que los archivos siguen sin estar»");

const r9b = await barrer(3, async () => {});
afirmar((r9b as any).retired.includes("contrato.docx"), "con la exigencia cumplida, el retiro ocurre en silencio", "congelar RETIENE, no cancela: si la ausencia sigue ahi despues de la evidencia extra, es un borrado de verdad y el documento se retira");

// ---------------------------------------------------------------------------
// EL PADRON. Raiz aparte para no cruzarse con el estado que dejaron las ocho de
// arriba: `root-1` quedo congelada y con dos ausencias en curso.
// ---------------------------------------------------------------------------
const R2 = "root-2";
const abrirEn = (root: string, total: number) => llamar("/sweep/open", { root, total });
const cerrar = (sweepId: string, status = "complete") => llamar("/sweep/close", { sweepId, status });
const subirEn = async (root: string, archivos: { path: string; contenido: string }[]) => {
  const entries = archivos.map((a) => ({ path: a.path, hash: hash(a.contenido) }));
  const { decisions } = await llamar("/presence/observed", { root, entries });
  for (const d of decisions as any[]) {
    if (d.decision !== "upload") continue;
    const a = archivos.find((x) => x.path === d.path)!;
    await fetch(`${BASE}${d.permit.url}`, { method: "PUT", body: a.contenido });
    await llamar("/upload/completed", { permit: d.permit.url.split("/").pop() });
  }
};

console.log("\n10 - EL DESFASE SE DETECTA CON UN NUMERO QUE YA VIAJABA");
const s9a = await abrirEn(R2, 0);
await subirEn(R2, [
  { path: "a.txt", contenido: "el a" },
  { path: "b.txt", contenido: "el b" },
  { path: "c-nube.txt", contenido: "el c" },
]);
await cerrar((s9a as any).sweepId);

// El agente se reinicia SIN inventario: cree que la raiz esta vacia.
const s9b = await abrirEn(R2, 0);
afirmar((s9b as any).padronRequerido === true, "Savia nota que el agente no sabe de 3 documentos y pide el padron", "un barrido incremental no reporta lo que sigue igual, asi que sin el padron esos documentos no se ven faltar NUNCA y quedan vigentes para siempre");

console.log("\n11 - LA DIFERENCIA RETIRA LO QUE FALTA, Y RESPETA AL DESHIDRATADO");
// Mientras estaba caido, `b.txt` se borro. `c-nube.txt` esta deshidratado: presente,
// pero el agente NO PUEDE leerlo, asi que viaja sin hash.
await llamar("/presence/roster", {
  sweepId: (s9b as any).sweepId,
  entries: [
    { path: "a.txt", hash: hash("el a") },
    { path: "c-nube.txt", hash: null },
  ],
});
const r10 = await cerrar((s9b as any).sweepId);
afirmar((r10 as any).retired.length === 0, "la diferencia no retira en el acto: entra a cuarentena", "«una desaparicion es una hipotesis, no un hecho» vale igual cuando la descubre una diferencia de conjuntos y no una observacion");

// La diferencia fue 1 de 3 vivos = 33%, o sea que ADEMAS disparo el corte por volumen.
// Los dos mecanismos se apilan y esta bien que lo hagan: un agente que perdio su
// inventario es exactamente el que puede mandar un padron corto.
await new Promise((r) => setTimeout(r, 5_200));
const s10 = await abrirEn(R2, 2);
const r10b = await cerrar((s10 as any).sweepId);
afirmar((r10b as any).retired.length === 0, "la diferencia tambien pasa por el congelamiento", "el padron no es una via rapida al retiro: una diferencia grande de conjuntos exige la misma evidencia extra que una tanda de bajas, y por la misma razon");

const s11 = await abrirEn(R2, 2);
const r11 = await cerrar((s11 as any).sweepId);
afirmar((r11 as any).retired.includes("b.txt"), "`b.txt`, borrado mientras el agente estaba caido, se retira", "es el agujero que el padron vino a tapar: sin el, ese documento quedaba vigente en Savia para siempre");
afirmar(!(r11 as any).retired.includes("c-nube.txt"), "`c-nube.txt`, deshidratado y sin hash, NO se retira", "presente es presente. Omitir del padron lo que no se pudo leer retiraria archivos que estan perfectamente ahi, solo que en la nube - y en macOS leerlos para probarlo significa descargar el drive entero");

console.log("\n12 - LA REVOCACION: la persona le saca el dispositivo");
await llamar("/enroll/revoke", { deviceToken: TOKEN });
const revocado = await crudo("/sweep/open", { root: ROOT, total: 0 });
afirmar(revocado.status === 401, "revocado el token, el dispositivo deja de entrar", "es la unica palanca que tiene una persona sobre un agente que ya no controla - una laptop robada, o una que dejo de ser suya");

console.log(`\n${fallas === 0 ? "ejercicio ok" : `EJERCICIO-ERR: ${fallas} afirmaciones fallaron`}`);
console.log("estado final:", JSON.stringify(servidor.estado(), null, 2));
servidor.cerrar();
process.exit(fallas === 0 ? 0 : 1);
