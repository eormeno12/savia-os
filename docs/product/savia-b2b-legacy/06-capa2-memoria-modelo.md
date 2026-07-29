# 05 — Capa 2: Memoria (modelo)

> Estado: 📝 esqueleto — pendiente de completar
> Capa: 2 — Memoria ([company-brain.md](01-vision.md))
> Responde a: ¿qué es "memoria" en Savia, y cómo se recupera?
> Ver también: [07-capa2-memoria-arquitectura-tecnica.md](07-capa2-memoria-arquitectura-tecnica.md) para el cómo técnico.

## Por qué existe este documento

`company-brain.md` fija el principio ("fidelidad sin alucinación") pero no baja
a qué significa memoria personal vs compartida vs de organización, ni el ciclo
de vida de un hecho memorizado.

## Insumos existentes a revisar

- Sección "Capa 2 — Memoria" de `company-brain.md`.
- `.claude/llms/mem0.txt` — capacidades reales de Mem0 (memory types, add/
  search/update/delete) que hoy sostienen esta capa.
- `apps/api/src/modules/memory/` (mem0.config.ts, memory.controller.ts).

## Temas a cubrir

### Definición operativa
- [ ] Qué es un "hecho" de memoria vs una "memoria" completa vs un "área" (ya
      existe el concepto de área/espacio — confirmar relación con
      [02-glosario-y-entidades.md](02-glosario-y-entidades.md)).

### Recuperación
- [ ] Difusa/semántica — "qué se sabe sobre X" (ya existe, `savia_search`).
- [ ] Exacta/direccionable — "el valor en la celda Y" — **no existe hoy**, qué
      se necesita para soportarla (lookup por coordenada σ).
- [ ] Cuándo usar cada una (¿el agente elige, o hay un dispatcher?).

### Procedencia
- [ ] Cómo una respuesta vuelve a su fuente original (verbatim en S3) —
      documentar el camino real hoy.
- [ ] Qué se muestra al usuario cuando pide "de dónde salió esto".

### Memoria personal vs compartida vs de organización
- [ ] Diferencias conceptuales (no técnicas — eso va en el 06) entre las tres.
- [ ] ¿La memoria de organización es una vista sobre memorias personales, o una
      entidad propia con su propio ciclo de vida?

### Ciclo de vida
- [ ] Creación, actualización (¿se sobreescribe o se versiona?), obsolescencia
      / vigencia — cruza con la nota de "temporalidad (validez bi-temporal)"
      que la visión deja como exploración abierta.

## Preguntas abiertas

- ¿Qué tan literal es "sin alucinación" — hay un mecanismo de verificación
  automática, o es una propiedad que emerge de siempre citar procedencia?

## Decisiones tomadas

_(vacío)_
