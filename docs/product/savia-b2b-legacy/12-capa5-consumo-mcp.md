# 11 — Capa 5: Consumo vía MCP

> Estado: 📝 esqueleto — pendiente de completar
> Capa: 5 — Consumo ([company-brain.md](01-vision.md))
> Responde a: ¿cómo consume una empresa (y su IA) lo que Savia sabe?

## Por qué existe este documento

Es la capa más construida de las cinco (ya hay MCP server con
`savia_search`/`savia_remember`), así que este doc arranca documentando lo que
existe y termina definiendo lo que falta: catálogo de skills como resources y
gobernanza por-caller extendida a organización.

## Insumos existentes a revisar

- `apps/api/src/mcp.ts` y `apps/api/src/modules/mcp/mcp.tools.ts`.
- Sección "Capa 5 — Consumo" de `company-brain.md`.
- Commit `feat(mcp): step 09 — MCP server (savia_search + savia_remember +
  auth + rate limit + audit log)` — punto de partida real.

## Temas a cubrir

### Lo que ya existe (documentar)
- [ ] `savia_search` / `savia_remember` como tools — contrato exacto (input/
      output), autenticación, rate limit, audit log actual.

### Skills como resources (nuevo, depende de Capa 4)
- [ ] Catálogo liviano vía `resources/list` (metadata de qué skills existen)
      + contenido completo on-demand vía `resources/read` — diseño concreto,
      no una tool por skill (la visión es explícita en que eso "no escala").
- [ ] Progressive disclosure: cómo el agente consumidor decide cuándo pedir
      el contenido completo de un skill.
- [ ] Meta-tool dispatcher opcional (`savia_find_skill`) — ¿hace falta desde
      el día 1, o se agrega cuando el catálogo crece?

### Retrieval a futuro
- [ ] `browse`/`fetch` (mencionados en la visión como evolución de
      `savia_search`) — qué resuelven que `savia_search` no resuelve
      (relacionado con recuperación exacta/direccionable de
      [06](06-capa2-memoria-modelo.md)).

### Gobernanza por-caller
- [ ] Cómo se propaga la identidad de una IA/agente externo hasta el
      chokepoint de [09](09-capa3-gobernanza-implementacion-tecnica.md).
- [ ] Audit: qué se registra cuando un agente ejecuta una acción derivada de
      un skill.

### BYO-LLM
- [ ] Qué significa técnicamente "una conexión org-level y toda la IA de la
      empresa hereda el cerebro" — ¿es una API key por organización, un
      config de MCP compartido, algo más?

### Acciones vs instrucción
- [ ] Confirmar el límite que marca la visión: Savia **instruye** (skills +
      retrieval), los sistemas de la empresa **ejecutan** (Stripe, el ticket,
      etc.) — Savia no expone tools de acción propias. Documentar cómo se
      respeta ese límite en el diseño del MCP server.

## Preguntas abiertas

- ¿El MCP server actual ya soporta múltiples organizaciones detrás de una
  misma instancia, o asume un solo tenant?

## Decisiones tomadas

_(vacío)_
