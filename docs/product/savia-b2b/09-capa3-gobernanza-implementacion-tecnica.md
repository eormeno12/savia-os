# 08 — Capa 3: Gobernanza (implementación técnica)

> Estado: 📝 esqueleto — pendiente de completar
> Capa: 3 — Gobernanza ([company-brain.md](01-vision.md))
> Responde a: ¿cómo se implementa el chokepoint de acceso en código?

## Por qué existe este documento

Separa el "qué" ([08](08-capa3-gobernanza-modelo.md)) del "cómo" — esta capa ya
está construida a nivel personal, así que gran parte de este doc es
**documentar lo que existe** antes de decidir cómo extenderlo.

## Insumos existentes a revisar

- `apps/api/src/modules/connections/grants.cache.ts` — cache de grants, punto
  de partida para entender el mecanismo actual.
- `apps/api/src/modules/auth/guards/jwt-auth.guard.ts` y
  `decorators/current-user.decorator.ts`.
- `docs/plan/savia-b2b-redesign/prototypes/governance-strategy-v1.html` —
  menciona extender `GrantScope` con código real referenciado
  (`schema.prisma`, `structure-executor.service.ts`, `collective.service.ts`).
- `docs/audit/backend/2026-06-27/ACCESS-PRIVACY-RULES.md`.

## Temas a cubrir

### Mecanismo actual (documentar)
- [ ] Dónde vive el chokepoint (¿middleware, guard, capa de servicio,
      query-time filtering en Postgres/Qdrant?).
- [ ] Modelo de `Grant`/`Scope` actual — campos, cómo se crea, cómo se
      revoca.
- [ ] Cómo se propaga la identidad del caller a través de las capas (API →
      servicio → query).

### Extensión a organización
- [ ] Qué cambia en el schema (`schema.prisma`) para soportar roles de
      organización sin romper el modelo personal existente.
- [ ] Cómo se implementa la herencia/no-herencia definida en
      [08](08-capa3-gobernanza-modelo.md) a nivel de query (¿joins adicionales,
      columna de organización en cada tabla relevante, row-level security de
      Postgres?).

### Audit log
- [ ] Qué se registra hoy (si ya existe) — formato, dónde se guarda.
- [ ] Qué falta para auditoría enterprise (¿quién vio qué memoria, quién
      ejecutó qué skill, con qué identidad de caller MCP?).
- [ ] Requisitos de retención/exportación para compliance (si aplica).

## Preguntas abiertas

- ¿El enforcement es 100% en el backend, o el frontend también necesita lógica
  de visibilidad (evitar renderizar cosas que igual el backend bloquearía)?

## Decisiones tomadas

_(vacío)_
