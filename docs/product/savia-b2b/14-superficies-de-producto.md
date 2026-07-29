# 13 — Superficies de producto (pantallas y flujos)

> Estado: 📝 esqueleto — pendiente de completar
> Responde a: ¿qué pantallas necesita Savia B2B, y qué pasa con las que ya existen?

## Por qué existe este documento

Traduce todo lo conceptual (capas 1-5, personas, adopción) a UI concreta. Se
completa **después** de los docs de modelo (02, 07, 09, 12) — diseñar pantalla
antes de tener el modelo firme es lo que ya le pasó al plan de redesign
actual (ver [18-estado-actual-vs-propuesto.md](18-estado-actual-vs-propuesto.md)).

## Insumos existentes a revisar

- `docs/plan/savia-b2b-redesign/prototypes/org-home-v1.html` — prototipo de
  home de organización, ya compara explícitamente "Hoy (B2C)" vs "Propuesto
  (B2B)".
- `docs/plan/savia-b2b-redesign/prototypes/governance-strategy-v1.html` —
  prototipo de panel de gobernanza.
- `docs/plan/savia-redesign/` (00 a 08 + mockups) — el plan de redesign B2C
  activo hoy; sus 7 pantallas (bandeja, colectivo, conexiones, cuenta,
  fuentes, memoria, pulso) son la base personal sobre la que se monta lo de
  organización, no se descartan.

## Temas a cubrir

### Pantallas nuevas (organización)
- [ ] Home de organización — construir sobre `org-home-v1.html`.
- [ ] Panel de gobernanza / admin console — construir sobre
      `governance-strategy-v1.html`.
- [ ] Catálogo de skills — no existe prototipo aún; depende del formato
      definido en [10](10-capa4-sintesis-modelo.md).
- [ ] Gestión de miembros/roles de organización.
- [ ] Gestión de conectores org-level (distinta de "Fuentes" personal).

### Pantallas existentes — qué cambia
- [ ] Bandeja, Colectivo, Conexiones, Cuenta, Fuentes, Memoria, Pulso — para
      cada una: ¿sigue igual quedando en contexto personal, o necesita una
      variante/vista cuando el usuario pertenece a una organización?
- [ ] Navegación — cómo convive "mi memoria personal" con "el cerebro de mi
      organización" en la misma app (¿son secciones separadas, un switch de
      contexto, una sola vista fusionada?).

### Responsive / plataforma
- [ ] ¿Alguna de estas superficies (ej. panel de gobernanza, catálogo de
      skills) tiene más sentido como vista de escritorio/admin dedicada que
      como parte de la app móvil-first actual?

## Preguntas abiertas

- ¿El catálogo de skills es una pantalla nueva o vive dentro de "Memoria"
  como una vista más?

## Decisiones tomadas

_(vacío)_
