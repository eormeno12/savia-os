/**
 * EL SERVIDOR SIMULADO del canal `folder`. En memoria, sin persistencia, sin red
 * saliente. Existe para que el agente se pueda construir y ejercer ANTES de que Savia
 * tenga una API, que hoy es un README.
 *
 * NO ES UN MOCK QUE DICE QUE SI. Simula las decisiones que el plan le asigna al
 * servidor, porque son justamente las que el agente NO toma y contra las que hay que
 * probarlo: dedupe previo a la transferencia, cuarentena de una ausencia, corte por
 * volumen y hash verificado. Un doble que aceptara todo dejaria verde a un agente que
 * reporta cualquier cosa.
 *
 * LOS NUMEROS DE ACA SON PARAMETROS DEL BANCO, NO DEL PRODUCTO. Los cuatro del canal
 * estan sin medir a proposito (ver «Lo que sigue abierto»), asi que aca van con valores
 * chicos para que una prueba termine en segundos, y van rotulados para que nadie los
 * lea como una medicion.
 */
import { createServer, type IncomingMessage } from "node:http";
import { createHash } from "node:crypto";

// -- Parametros del banco ----------------------------------------------------
const BANCO = {
  /** ms - cuanto espera una ausencia antes de poder volverse retiro. Producto: sin medir. */
  ventanaDeCuarentena: 5_000,
  /** fraccion - desde cuantas bajas de golpe se congela la raiz. Producto: sin medir. */
  cortePorVolumen: 0.3,
  /** bytes - tope del permiso prefirmado, como `content-length-range`. */
  tamanoMaximo: 50 * 1024 * 1024,
  /** ms - cuanto vive un codigo de vinculacion sin aprobar. Producto: sin medir. */
  ventanaDeVinculacion: 10 * 60_000,
} as const;

/**
 * LO QUE EL CONGELAMIENTO EXIGE. **No es un parametro del banco**: los de arriba estan
 * sin medir y este esta DECIDIDO por el plan, que dice que al saltar el corte por volumen
 * «se retiene y se exige al menos UN barrido completo mas sobre esa raiz — que es, a la
 * vez, la prueba de que la raiz esta viva y de que los archivos siguen sin estar».
 */
const BARRIDOS_DE_DESHIELO = 1;

// -- Estado ------------------------------------------------------------------
type Documento = {
  readonly id: string;
  readonly root: string;
  readonly path: string;
  version: string;
  retiredAt: string | null;
  /** null = presente. Con valor = ausencia observada, esperando evidencia. */
  ausenteDesde: number | null;
};

const objetos = new Map<string, Uint8Array>();   // hash verificado -> bytes
const documentos = new Map<string, Documento>(); // `${root} ${path}` -> doc
const permisos = new Map<string, { hash: string; root: string; path: string }>();
const barridos = new Map<
  string,
  { root: string; total: number; abierto: boolean; padron: Set<string> | null; congeladaAlAbrir: boolean }
>();
// raiz -> barridos COMPLETOS que todavia se le exigen antes de poder retirar
const congeladas = new Map<string, number>();

/**
 * EL ENROLAMIENTO. Dos mapas, y estan separados por la misma razon por la que el
 * protocolo tiene `code` e `enrollmentId`: una vinculacion es un TRAMITE en curso y un
 * token es una credencial viva. El tramite se descarta; el token se revoca.
 */
type Vinculacion = {
  readonly code: string;
  readonly expiraEn: number;
  estado: "pending" | "approved" | "denied";
  deviceToken: string | null;
  userId: string | null;
};
const vinculaciones = new Map<string, Vinculacion>(); // enrollmentId -> tramite
const tokens = new Map<string, string>();             // deviceToken -> userId

let seq = 0;
const id = (p: string) => `${p}-${(seq += 1)}`;
const clave = (root: string, path: string) => `${root} ${path}`;
const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const anotar = (m: string) => console.log(`  . ${m}`);

/**
 * LAS RUTAS QUE NO EXIGEN CREDENCIAL, y son exactamente dos clases.
 *
 * Las de `begin`/`claim` no la pueden exigir porque SON LAS QUE LA PRODUCEN. Las de
 * `approve`/`deny`/`revoke` no son del agente en absoluto: representan a la PERSONA
 * actuando desde su cuenta, y en Savia de verdad las protegeria su sesion web. Aca no
 * llevan nada porque quien las llama es el ejercicio, haciendo de humano.
 *
 * **Que `approve` sea inalcanzable para el cliente de Rust es la garantia entera del
 * codigo corto**: `Cliente` no tiene un metodo que la llame, y no se le puede agregar
 * sin que alguien tenga que justificar por que el agente se aprueba a si mismo.
 */
const SIN_CREDENCIAL = new Set([
  "POST /enroll/begin",
  "POST /enroll/claim",
  "POST /enroll/approve",
  "POST /enroll/deny",
  "POST /enroll/revoke",
]);

// -- El enrolamiento (tres llamadas del agente + las de la persona) -----------
const rutasDeEnrolamiento: Record<string, (c: any) => unknown> = {
  /**
   * `enroll.begin` - el primer contacto de un agente que no tiene nada.
   *
   * Devuelve DOS identificadores distintos a proposito: `code` es corto porque lo lee
   * una persona, y con el NO se reclama nada; `enrollmentId` es opaco y es con lo que se
   * reclama. Si se reclamara con el codigo, adivinar seis caracteres seria adivinar un
   * token de dispositivo.
   */
  "POST /enroll/begin": ({ expiresInMs }) => {
    const enrollmentId = id("enroll");
    // AFFORDANCE DEL BANCO, no del producto: sin poder acortar la ventana, el camino
    // «vencido» no lo ejerce nada y el arm del cliente queda muerto.
    const ventana = typeof expiresInMs === "number" ? expiresInMs : BANCO.ventanaDeVinculacion;
    const code = `${(seq * 7919) % 1000000}`.padStart(6, "0");
    vinculaciones.set(enrollmentId, {
      code, expiraEn: Date.now() + ventana, estado: "pending", deviceToken: null, userId: null,
    });
    anotar(`enroll.begin codigo=${code} (vence en ${ventana} ms)`);
    return { enrollmentId, code, expiresIn: Math.floor(ventana / 1000) };
  },

  /**
   * `enroll.claim` - el agente pregunta si ya lo aprobaron.
   *
   * ES IDEMPOTENTE, y hace falta: si la respuesta que traia el token se pierde en la
   * red, el agente vuelve a reclamar y tiene que recibir EL MISMO token. Acunar uno
   * nuevo dejaria vivo el anterior, que nadie va a usar y nadie va a revocar.
   */
  "POST /enroll/claim": ({ enrollmentId }) => {
    const v = vinculaciones.get(enrollmentId);
    if (!v) return { error: "vinculacion desconocida" };
    if (v.estado === "denied") { anotar(`enroll.claim denegada`); return { status: "denied" }; }
    // EL VENCIMIENTO SE MIRA ANTES QUE LA APROBACION Y DESPUES DE `approved`: una
    // vinculacion ya aprobada no vence - el token que produjo es una credencial viva y
    // se revoca, no expira con el tramite que lo emitio.
    // `>=` Y NO `>`: alcanzado el instante de vencimiento, ya vencio. Con `>` una
    // ventana de 0 ms depende de si el reloj avanzo un milisegundo entre `begin` y
    // `claim`, o sea que la prueba del camino «vencido» sale cara o cruz.
    if (v.estado === "pending" && Date.now() >= v.expiraEn) {
      anotar(`enroll.claim vencida`);
      return { status: "expired" };
    }
    if (v.estado === "pending") { anotar(`enroll.claim pendiente - nadie aprobo todavia`); return { status: "pending" }; }
    anotar(`enroll.claim APROBADA -> token para ${v.userId}`);
    return { status: "approved", deviceToken: v.deviceToken, userId: v.userId };
  },

  /**
   * LA PERSONA, desde su cuenta. Recibe el CODIGO CORTO —que es lo unico que la persona
   * ve— y no el `enrollmentId`, que ni siquiera se le muestra.
   *
   * **No devuelve el token.** El token viaja al agente por `claim` y por ningun otro
   * lado: la pantalla de la persona nunca lo carga, asi que una captura de esa pantalla
   * no es una credencial.
   */
  "POST /enroll/approve": ({ code, userId }) => {
    const e = [...vinculaciones.entries()].find(([, v]) => v.code === code);
    if (!e) return { error: "codigo desconocido" };
    const [, v] = e;
    if (Date.now() > v.expiraEn) return { error: "codigo vencido" };
    v.estado = "approved";
    v.deviceToken = id("tok");
    v.userId = userId;
    tokens.set(v.deviceToken, userId);
    anotar(`APROBADO     codigo=${code} por ${userId}`);
    return { ok: true };
  },

  "POST /enroll/deny": ({ code }) => {
    const e = [...vinculaciones.entries()].find(([, v]) => v.code === code);
    if (!e) return { error: "codigo desconocido" };
    e[1].estado = "denied";
    anotar(`DENEGADO     codigo=${code}`);
    return { ok: true };
  },

  /**
   * LA REVOCACION, tambien de la persona. Es lo que vuelve ejercitable el camino de
   * credenciales del agente sin tener que romperle el token a mano.
   */
  "POST /enroll/revoke": ({ deviceToken }) => {
    const habia = tokens.delete(deviceToken);
    anotar(`REVOCADO     ${habia ? "token dado de baja" : "no habia tal token"}`);
    return { ok: true };
  },
};

// -- Los seis endpoints (siete llamadas: `presence.decision` es la respuesta) --
const rutas: Record<string, (c: any) => unknown> = {
  /**
   * `sweep.open` - el barrido es la UNIDAD sobre la que se puede decir «completo».
   * `total` es el denominador que el corte por volumen necesita: sin el, «desaparecieron
   * 40» no se puede comparar contra nada.
   */
  "POST /sweep/open": ({ root, total }) => {
    const sweepId = id("sweep");
    // EL DESFASE SE DETECTA CON UN NUMERO QUE YA VIAJABA. `total` es la cuenta de filas
    // vivas del inventario del agente; aca esta la cuenta de documentos vivos de esa
    // raiz. Si difieren, el agente no sabe de la existencia de algunos documentos -
    // perdio su inventario, lo restauraron de un backup, o nunca lo tuvo - y como un
    // barrido incremental NO reporta lo que sigue igual, esos documentos no se veran
    // faltar nunca. Pedirle el padron es la unica forma de enterarse.
    //
    // Lo pide SAVIA y no lo declara el agente a proposito: asi tambien se cubren los
    // casos que el agente no puede declarar porque no los conoce - un inventario
    // corrupto que el cree bueno, o dos agentes sobre la misma raiz.
    const vivos = [...documentos.values()].filter((d) => d.root === root && d.retiredAt === null).length;
    const padronRequerido = vivos !== total;
    // SE ANOTA AL ABRIR, NO AL CERRAR. El congelamiento se dispara con la evidencia de
    // ESTE barrido —`presence.vanished` llega antes que el cierre—, asi que preguntarlo
    // al cerrar contesta «ya estaba congelada» sobre la raiz que este mismo barrido
    // acaba de congelar, y el barrido se cuenta a si mismo como la evidencia extra que
    // se estaba exigiendo. El estado que importa es el de ANTES de mirar.
    barridos.set(sweepId, { root, total, abierto: true, padron: null, congeladaAlAbrir: congeladas.has(root) });
    anotar(`sweep.open   root=${root} agente=${total} savia=${vivos}${padronRequerido ? " -> PADRON REQUERIDO" : ""}`);
    return { sweepId, padronRequerido };
  },

  /**
   * `presence.roster` - el padron. Todo lo que el agente VE en la raiz, sin bytes.
   *
   * `hash: null` significa PRESENTE CON HASH DESCONOCIDO, y no es un detalle: un archivo
   * deshidratado nunca se lee, asi que el agente no tiene su hash. Omitirlo del padron
   * lo volveria ausente y Savia lo retiraria - un archivo que esta perfectamente ahi,
   * solo que en la nube. Presente es presente, y por que no se pudo leer es diagnostico
   * del agente, no cambia nada de este lado.
   */
  "POST /presence/roster": ({ sweepId, entries }) => {
    const b = barridos.get(sweepId);
    if (!b) return { error: "barrido desconocido" };
    b.padron = new Set((entries as { path: string }[]).map((e) => e.path));
    const sinHash = (entries as { hash: string | null }[]).filter((e) => e.hash === null).length;
    anotar(`roster       ${b.padron.size} rutas (${sinHash} sin hash: presentes, no legibles)`);
    return { received: b.padron.size };
  },

  /**
   * `presence.observed` -> `presence.decision`. Lleva hash y CERO BYTES: es la llamada
   * que hace posible el dedupe previo a la transferencia.
   *
   * El hash que llega es una AFIRMACION, no la autoridad. Aca eso se ve: `known` solo
   * puede coincidir con un objeto que este lado YA escribio y verifico, asi que el
   * cliente no hace aparecer contenido que nadie subio.
   */
  "POST /presence/observed": ({ root, entries }) => {
    const decisions = (entries as { path: string; hash: string }[]).map((e) => {
      const k = clave(root, e.path);
      const doc = documentos.get(k);
      if (doc) { doc.ausenteDesde = null; doc.retiredAt = null; }

      if (objetos.has(e.hash)) {
        // KNOWN: cero bytes. El documento se registra igual, con dueno propio.
        if (!doc) documentos.set(k, { id: id("doc"), root, path: e.path, version: e.hash, retiredAt: null, ausenteDesde: null });
        else doc.version = e.hash;
        anotar(`  known      ${e.path}`);
        return { path: e.path, decision: "known" as const };
      }
      const permit = id("permit");
      permisos.set(permit, { hash: e.hash, root, path: e.path });
      anotar(`  upload     ${e.path}`);
      return {
        path: e.path,
        decision: "upload" as const,
        // El permiso prefirmado. El tope de tamano viaja ACA y no se valida en ninguna
        // llamada: es la unica palanca preventiva que la subida directa deja en pie.
        permit: { url: `/upload/${permit}`, contentLengthRange: [0, BANCO.tamanoMaximo] },
      };
    });
    return { decisions };
  },

  /**
   * `upload.completed` - y DEVUELVE EL HASH VERIFICADO, que es el lazo que cierra la
   * divergencia. El que mando el agente era una afirmacion; este lo computo quien leyo
   * los bytes. Si el archivo cambio entre el hasheo y el PUT, los dos difieren y el
   * agente tiene que corregir su inventario con este.
   */
  "POST /upload/completed": ({ permit }) => {
    const p = permisos.get(permit);
    if (!p) return { error: "permiso desconocido" };
    const bytes = objetos.get(`pendiente:${permit}`);
    if (!bytes) return { error: "el objeto no llego" };
    const verified = sha256(bytes);
    objetos.delete(`pendiente:${permit}`);
    objetos.set(verified, bytes);
    permisos.delete(permit);

    const k = clave(p.root, p.path);
    documentos.set(k, { id: id("doc"), root: p.root, path: p.path, version: verified, retiredAt: null, ausenteDesde: null });
    if (verified !== p.hash) anotar(`  DIVERGENCIA ${p.path}: afirmado=${p.hash.slice(0, 8)} verificado=${verified.slice(0, 8)}`);
    anotar(`upload.completed ${p.path} -> ${verified.slice(0, 12)}`);
    return { verifiedHash: verified, diverged: verified !== p.hash };
  },

  /**
   * `presence.vanished` - reporta un HECHO OBSERVADO, no pide un retiro. El nombre es
   * deliberado: quien decide si una ausencia es una baja es este lado.
   */
  "POST /presence/vanished": ({ root, entries }) => {
    const ahora = Date.now();
    const vivos = [...documentos.values()].filter((d) => d.root === root && d.retiredAt === null);
    for (const e of entries as { path: string; lastSeenHash: string }[]) {
      const d = documentos.get(clave(root, e.path));
      if (d && d.ausenteDesde === null) d.ausenteDesde = ahora;
      anotar(`vanished     ${e.path}`);
    }
    // CORTE POR VOLUMEN, sobre el denominador de lo que esta vivo en la raiz.
    const fraccion = vivos.length === 0 ? 0 : (entries as unknown[]).length / vivos.length;
    if (fraccion >= BANCO.cortePorVolumen) {
      congeladas.set(root, BARRIDOS_DE_DESHIELO);
      anotar(`CONGELADA ${root} - ${(fraccion * 100).toFixed(0)}% de golpe, se exige mas evidencia`);
    }
    return { quarantined: (entries as unknown[]).length, frozen: congeladas.has(root) };
  },

  /**
   * `sweep.close` - y es aca donde vence la cuarentena, no en un reloj. Un barrido
   * COMPLETO sobre esta raiz prueba dos cosas a la vez: que la raiz esta viva y que los
   * archivos siguen sin estar. Es lo que reemplaza al `root.probe` que no podia existir,
   * porque un agente de escritorio no es direccionable.
   */
  "POST /sweep/close": ({ sweepId, status }) => {
    const b = barridos.get(sweepId);
    if (!b) return { error: "barrido desconocido" };
    b.abierto = false;
    anotar(`sweep.close  root=${b.root} status=${status}`);
    // `frozen` VIAJA EN LAS TRES SALIDAS, no solo en la que congela. Si solo apareciera
    // cuando es `true`, el cliente necesitaria `#[serde(default)]` para leerlo — y un
    // default es exactamente como se pierde una senal en silencio: «ausente» se leeria
    // «no congelada», que es la respuesta tranquilizadora.
    if (status !== "complete") return { retired: [], frozen: congeladas.has(b.root) };

    const ahora = Date.now();
    // Se lee ANTES de la diferencia, porque la diferencia puede congelar en este mismo
    // cierre — y el barrido que congela no puede contarse como la evidencia que el
    // congelamiento exige. Ver `congeladaAlAbrir` en `sweep.open`.
    const congeladaAlEntrar = b.congeladaAlAbrir;
    // ...y la otra mitad: un congelamiento NUEVO disparado por la evidencia de este
    // mismo cierre REARMA la exigencia, no la cumple. Sin esta bandera, una raiz ya
    // congelada que ademas trae una diferencia de padron masiva se descongela en el
    // mismo cierre que la volvio a congelar — el descuento del congelamiento viejo se
    // come al nuevo, y la evidencia extra que se estaba exigiendo termina siendo cero.
    let congeloEnEsteCierre = false;

    // LA DIFERENCIA DE CONJUNTOS, y va aca y no al recibir el padron a proposito: un
    // padron de un barrido INTERRUMPIDO es una lista parcial, y tratarla como el
    // universo de lo presente retiraria todo lo que el recorrido no llego a mirar. El
    // barrido completo es «la unica fuente legitima de un conjunto de bajas», y esta es
    // esa regla aplicada al padron.
    if (b.padron !== null) {
      const ausentes = [...documentos.values()].filter(
        (d) => d.root === b.root && d.retiredAt === null && d.ausenteDesde === null && !b.padron!.has(d.path),
      );
      for (const d of ausentes) d.ausenteDesde = ahora;
      if (ausentes.length > 0) {
        anotar(`diferencia   ${ausentes.length} documentos que el agente NO ve: ${ausentes.map((d) => d.path).join(", ")}`);
        // El corte por volumen tambien manda aca. Es exactamente el escenario que teme:
        // un agente que perdio su inventario y ademas barrio una raiz a medio montar
        // produciria un padron corto, y la diferencia seria masiva.
        const vivos = [...documentos.values()].filter((d) => d.root === b.root && d.retiredAt === null).length;
        if (vivos > 0 && ausentes.length / vivos >= BANCO.cortePorVolumen) {
          congeladas.set(b.root, BARRIDOS_DE_DESHIELO);
          congeloEnEsteCierre = true;
          anotar(`CONGELADA ${b.root} - la diferencia del padron es el ${((ausentes.length / vivos) * 100).toFixed(0)}%`);
        }
      }
    }
    // EL CONGELAMIENTO EXIGE, Y NO SOLO INFORMA — que es exactamente lo que le faltaba.
    // El corte por volumen dejo de ser una consulta a una persona cuando el retiro paso a
    // ser silencioso: no hay a quien preguntarle. Lo que queda en su lugar es **mas
    // evidencia**, y la unica que sirve es un barrido COMPLETO sobre esa raiz, porque
    // prueba las dos cosas a la vez: que la raiz esta viva y que los archivos siguen sin
    // estar. Es la misma logica de la cuarentena aplicada al caso masivo.
    //
    // Mientras la exigencia no se cumpla, NADA se retira de esa raiz — ni las ausencias
    // que dispararon el corte ni ninguna otra.
    if (congeladas.has(b.root)) {
      if (congeladaAlEntrar && !congeloEnEsteCierre) {
        const faltan = congeladas.get(b.root)! - 1;
        if (faltan <= 0) {
          congeladas.delete(b.root);
          anotar(`deshielo     ${b.root} - llego el barrido completo que se exigia`);
        } else {
          congeladas.set(b.root, faltan);
          anotar(`congelada    ${b.root} - faltan ${faltan} barridos completos`);
        }
      } else {
        anotar(`congelada    ${b.root} - se exige ${BARRIDOS_DE_DESHIELO} barrido completo mas`);
      }
      // Este cierre no retira nada. El `frozen` sale despues del deshielo, asi que dice
      // como quedo la raiz y no como entro.
      return { retired: [], frozen: congeladas.has(b.root) };
    }

    const retirados: string[] = [];
    for (const d of documentos.values()) {
      if (d.root !== b.root || d.ausenteDesde === null || d.retiredAt !== null) continue;
      if (ahora - d.ausenteDesde < BANCO.ventanaDeCuarentena) continue;
      d.retiredAt = new Date(ahora).toISOString();
      retirados.push(d.path);
    }
    if (retirados.length > 0) {
      anotar(`RETIRO silencioso: ${retirados.join(", ")}`);
    }
    return { retired: retirados, frozen: congeladas.has(b.root) };
  },
};

// -- Transporte --------------------------------------------------------------
const cuerpo = (req: IncomingMessage) =>
  new Promise<Buffer>((ok) => { const p: Buffer[] = []; req.on("data", (c) => p.push(c)); req.on("end", () => ok(Buffer.concat(p))); });

export const iniciar = (puerto = 4477) =>
  new Promise<{ cerrar: () => void; estado: () => object }>((listo) => {
    const s = createServer(async (req, res) => {
      const bytes = await cuerpo(req);
      // El PUT prefirmado: la API no lo ve. Aca se simula aparte a proposito.
      if (req.method === "PUT" && req.url?.startsWith("/upload/")) {
        objetos.set(`pendiente:${req.url.slice(8)}`, new Uint8Array(bytes));
        res.writeHead(200).end();
        return;
      }
      const clave = `${req.method} ${req.url}`;
      const h = rutas[clave] ?? rutasDeEnrolamiento[clave];
      // EL 404 VA ANTES QUE EL 401 A PROPOSITO. Con el orden inverso, una base de API
      // mal escrita contesta «credencial invalida» y manda a buscar el problema al lado
      // equivocado. Aca el diagnostico vale mas que no filtrar que rutas existen: es un
      // simulador local, no una superficie publica.
      if (!h) { res.writeHead(404).end(JSON.stringify({ error: `sin ruta: ${clave}` })); return; }
      // LA CREDENCIAL SE MIRA ACA, UNA VEZ Y PARA TODAS. Adentro de cada handler serian
      // seis lugares y seis oportunidades de olvidarse, y el que se olvide es un
      // endpoint abierto que nada distingue de uno cerrado.
      if (!SIN_CREDENCIAL.has(clave)) {
        const cab = req.headers.authorization;
        const token = cab?.startsWith("Bearer ") ? cab.slice(7) : null;
        if (!token || !tokens.has(token)) {
          anotar(`401          ${clave} - ${token ? "token revocado o desconocido" : "sin Authorization"}`);
          res.writeHead(401, { "content-type": "application/json" })
            .end(JSON.stringify({ error: "credencial invalida o ausente" }));
          return;
        }
      }
      const out = h(bytes.length ? JSON.parse(bytes.toString()) : {});
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(out));
    });
    s.listen(puerto, () => {
      console.log(`simulador escuchando en http://127.0.0.1:${puerto}`);
      listo({
        cerrar: () => s.close(),
        estado: () => ({
          documentos: [...documentos.values()].map((d) => ({ path: d.path, version: d.version.slice(0, 12), retirado: d.retiredAt !== null })),
          objetos: objetos.size,
          congeladas: [...congeladas].map(([raiz, faltan]) => `${raiz} (faltan ${faltan})`),
        }),
      });
    });
  });

if (process.argv[1]?.endsWith("server.ts")) void iniciar();
