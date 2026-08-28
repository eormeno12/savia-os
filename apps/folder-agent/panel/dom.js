// ────────────────────────────────────────────────────────────────────────────
// UTILIDADES DE DOM PURAS · sin estado, sin texto en español — por eso vive
// aparte de `textos.js`, que tiene su propia responsabilidad (el vocabulario) y
// no la de escapar HTML. `esc()` estaba copiada tres veces: `panel.js`,
// `onboarding.js`, y una tercera variante más angosta —sin `"`— adentro del
// catch de `pintar()` en `bandeja.js`, que además dejaba sin escapar las
// comillas de un mensaje de error insertado en un atributo.
// ────────────────────────────────────────────────────────────────────────────

/** Escapa para insertar como texto o adentro de un atributo entrecomillado
 * (`&<>"`). No es un sanitizador general — es lo que los templates literales
 * de este panel necesitan, ni más ni menos. */
export const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
