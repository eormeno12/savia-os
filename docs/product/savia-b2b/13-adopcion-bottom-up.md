# 12 — Adopción bottom-up (mecánica de emergencia)

> Estado: 📝 esqueleto — pendiente de completar
> Responde a: ¿cómo pasa Savia de "memoria de una persona" a "cerebro de una organización"?

## Por qué existe este documento

La apuesta distintiva de la visión es justamente esta mecánica ("el
conocimiento vive primero en las personas... vía lo colaborativo, el cerebro
de la organización emerge"). Sin este documento, el resto de la spec describe
capas técnicas pero no el motor de crecimiento que hace que el producto exista
en el mundo real.

## Insumos existentes a revisar

- Sección "La apuesta distintiva: bottom-up" de `company-brain.md`.
- `apps/api/src/modules/collective/` y `apps/app/src/components/collective/`
  (mecanismo peer-to-peer ya construido: `CollectiveGroup`, `FragmentShare`,
  invitaciones).
- `apps/app/src/app/invitar/[token]/page.tsx` — flujo de invitación ya
  existente.
- `docs/plan/savia-b2b-redesign/prototypes/org-home-v1.html`.

## Temas a cubrir

### Etapa 1 — Individuo solo
- [ ] Ya existe (producto B2C actual). Documentar tal cual funciona hoy.

### Etapa 2 — Comparte con 1-2 personas (colectivo)
- [ ] Ya existe (`CollectiveGroup`). ¿Qué límite (de tamaño, de tiempo) separa
      esto de "ya es un equipo"?

### Etapa 3 — Aparece la organización formal
- [ ] ¿Qué la dispara? Opciones a evaluar: umbral automático (N personas del
      mismo dominio de email compartiendo memoria), acción explícita
      ("convertir en organización"), venta directa a un admin que arranca
      desde cero.
- [ ] Quién queda como admin por default.
- [ ] Qué pasa con los colectivos/fragmentos que ya existían entre esas
      personas al momento de formalizarse la organización.

### Invitación y viralidad
- [ ] Mecánica de invitación org-level (¿distinta de la invitación a un
      colectivo que ya existe hoy?).
- [ ] Paralelo explícito con Slack/Notion/Figma que menciona la visión — qué
      gancho hace que una persona invite a la siguiente.

### Salida (offboarding)
- [ ] Qué pasa con la memoria personal de alguien que se va de la
      organización — el modelo actual de colectivo ya resuelve esto para
      fragmentos ("al salir, tu fragmento se va con vos"); confirmar si aplica
      igual a nivel organización o si hay memoria que la organización retiene
      (ej. un skill ya sintetizado con su aporte).

## Preguntas abiertas

- ¿Puede existir una organización sin que ningún individuo haya sido usuario
  de Savia antes (venta top-down directa), o el producto fuerza siempre el
  camino bottom-up?

## Decisiones tomadas

_(vacío)_
