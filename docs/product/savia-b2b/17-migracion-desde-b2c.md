# 16 — Migración desde el modelo B2C actual

> Estado: 📝 esqueleto — pendiente de completar
> Responde a: ¿cómo se transforma lo que ya está construido y en producción, sin romperlo?

## Por qué existe este documento

Savia B2B no se construye desde cero — hay usuarios, datos y código reales
hoy (`User`, `Space`, `MemoryIndex`, `Connection`, `CollectiveGroup`,
`FragmentShare`, billing individual, MCP server). Este doc es el puente entre
[02-glosario-y-entidades.md](02-glosario-y-entidades.md) (el modelo destino) y
la realidad operativa actual. Depende de que 01 y 09 estén razonablemente
resueltos antes de completarse en serio.

## Insumos existentes a revisar

- `apps/api/prisma/schema.prisma` — modelo real hoy.
- `apps/api/RUNBOOK.md` — el patrón de migración ya usado en este proyecto:
  **expand-contract** ("las migraciones son aditivas; no romper el esquema
  viejo en el mismo deploy... la imagen vieja sigue funcionando contra el
  esquema nuevo").
- [13-adopcion-bottom-up.md](13-adopcion-bottom-up.md) — la migración de datos
  y la mecánica de "aparición" de una organización son, en gran parte, la
  misma pregunta vista desde dos ángulos (producto vs datos).

## Temas a cubrir

### Mapeo de entidades (depende de 01)
- [ ] `User` — ¿se mantiene igual y gana una relación opcional a
      `Organization`, o cambia de forma?
- [ ] `Space` — ¿sigue siendo personal por default, con la opción de
      "pertenecer" a una organización?
- [ ] `CollectiveGroup` / `FragmentShare` — ¿se convierten en `Team`, o
      coexisten como el mecanismo peer-to-peer dentro/fuera de una
      organización?

### Compatibilidad hacia atrás
- [ ] Un usuario individual actual (sin organización) — ¿su experiencia
      cambia en algo el día que se despliega el modelo de organización, o es
      transparente para él?
- [ ] Conexiones/MCP configs ya existentes de usuarios actuales — ¿siguen
      funcionando sin cambios?

### Plan de migración de datos
- [ ] Orden de migraciones (expand-contract, como ya es norma en este
      proyecto — ver RUNBOOK.md) para introducir las tablas nuevas
      (`Organization`, `Membership`, etc.) sin downtime.
- [ ] Backfill: ¿hace falta poblar algo retroactivamente (ej. inferir
      organizaciones a partir de dominios de email compartidos entre usuarios
      existentes), o toda organización arranca vacía y crece hacia adelante?

### Riesgo y rollback
- [ ] Cómo se prueba esto sin arriesgar los datos de usuarios B2C reales ya en
      producción (staging con copia de datos, feature flag por
      organización/usuario, etc.).

## Preguntas abiertas

- ¿La migración se hace de una vez (big bang) o incremental, capa por capa
  (primero el modelo de datos, después gobernanza, después síntesis)?

## Decisiones tomadas

_(vacío)_
