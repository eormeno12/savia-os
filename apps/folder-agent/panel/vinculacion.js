// ────────────────────────────────────────────────────────────────────────────
// EL CLIENTE DE VINCULACIÓN · `iniciar_vinculacion`/`sondear_vinculacion`, el
// mismo circuito para dos superficies: la pantalla 2 del onboarding
// (`onboarding.js`) y "Volver a vincular" desde el aviso de credenciales
// (`bandeja.js`). Mismo servidor, mismo protocolo, mismo sondeo — este módulo
// es el único que sabe hablar con esos dos comandos. Cada consumidor sigue
// gobernando SU forma de estado (`q2` allá, `ui.vinculacion` acá) y SU
// repintado (`actualizar()`/`renderizar()`) — lo que se centraliza es la
// conversación con Rust, no la vista.
// ────────────────────────────────────────────────────────────────────────────

/** Cadencia del sondeo de `enroll.claim`. Decisión de UX, no del canal — no
 * aplica la disciplina de `contrato::parametros` (esos son números que
 * deciden comportamiento del protocolo; este decide cuán seguido esta
 * VENTANA pregunta). 2s: bastante rápido para que aprobar desde el teléfono
 * se sienta instantáneo, bastante lento para no convertir cada segundo de
 * espera en un POST contra la API. */
export const INTERVALO_DE_SONDEO_DE_VINCULACION_MS = 2000;

/** Arranca el circuito desde cero: pide un código nuevo. Un `Err` de red acá
 * deja el estado en `sinConexion` — todavía no hay nada pendiente del lado
 * del servidor que perder. */
export async function pedirCodigoNuevo(invoke) {
  try {
    const r = await invoke("iniciar_vinculacion");
    return { estado: "esperando", codigo: r.codigo, usuario: "" };
  } catch (e) {
    console.error("no se pudo iniciar la vinculacion", e);
    return { estado: "sinConexion", codigo: "", usuario: "" };
  }
}

/** Un sondeo. `null` si sigue pendiente —nada que repintar—, o el desenlace
 * (`{estado, usuario}`) apenas deja de estarlo. `sondear_vinculacion` es
 * idempotente: un `Err` de red acá no consume nada del lado del servidor, así
 * que el caller puede reanudar el sondeo en el próximo tick sin pedir un
 * código nuevo — la corrección del bug de `sinConexion` en `bandeja.js`
 * depende exactamente de esto. */
export async function unSondeo(invoke) {
  const r = await invoke("sondear_vinculacion");
  if (r.estado === "pendiente") return null;
  return { estado: r.estado, usuario: r.usuario ?? "" };
}
