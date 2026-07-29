# 07 — Capa 3: Gobernanza (modelo)

> Estado: 📝 esqueleto — pendiente de completar
> Capa: 3 — Gobernanza ([company-brain.md](01-vision.md))
> Responde a: ¿quién ve qué, y quién decide eso?
> Ver también: [09-capa3-gobernanza-implementacion-tecnica.md](09-capa3-gobernanza-implementacion-tecnica.md).

## Por qué existe este documento

`company-brain.md` marca esta capa como **ya construida y auditada** a nivel
personal — es el activo más difícil de replicar y el que abre la puerta
enterprise. Este doc formaliza qué significa extenderla a "roles de
organización" y "gobernanza a nivel de skill", que hoy no existen.

## Insumos existentes a revisar

- Sección "Capa 3 — Gobernanza" de `company-brain.md`.
- Memoria de arquitectura ya registrada: chokepoint único + autoridad, gap
  cross-boundary se estandariza, sensibilidad = opt-in del dueño (ver memoria
  `access-control-architecture` del asistente si hace falta contexto histórico).
- `docs/audit/backend/2026-06-27/ACCESS-PRIVACY-RULES.md`.
- `docs/plan/savia-b2b-redesign/prototypes/governance-strategy-v1.html` —
  prototipo ya avanzado de esta capa a nivel B2B, punto de partida fuerte.

## Temas a cubrir

### Lo que ya existe (documentar, no rediseñar)
- [ ] Chokepoint único de acceso — qué decide hoy (sensibilidad, fronteras,
      permisos) a nivel personal/colectivo.
- [ ] Sensibilidad como opt-in del dueño — cómo se marca y qué efecto tiene.

### Extensión a organización (nuevo)
- [ ] Roles de organización — catálogo a definir (admin, member, ¿guest?,
      ¿auditor?) y qué puede ver/hacer cada uno.
- [ ] Herencia: si una persona pertenece a una organización, ¿su memoria
      personal queda visible a la organización por default, o sigue siendo
      privada hasta que se comparte explícitamente? (principio bottom-up de la
      visión sugiere lo segundo — confirmar).
- [ ] Fronteras entre equipos dentro de una misma organización (¿un
      departamento puede quedar oculto a otro?).

### Gobernanza a nivel skill (nuevo, depende de Capa 4)
- [ ] Quién puede invocar qué proceso sintetizado — ¿hereda los permisos de
      sus fuentes, o tiene gobernanza propia definida al publicarse?
- [ ] Qué pasa si alguien sin permiso para ver la fuente original sí tiene
      permiso para ejecutar el skill que se derivó de ella (caso borde
      importante).

## Preguntas abiertas

- ¿La gobernanza es la misma UI/mecanismo para "ver una memoria" y para
  "ejecutar un skill", o son dos sistemas de permisos distintos?

## Decisiones tomadas

_(vacío)_
