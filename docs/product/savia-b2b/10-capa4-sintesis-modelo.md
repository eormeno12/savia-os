# 09 — Capa 4: Síntesis (modelo)

> Estado: 📝 esqueleto — pendiente de completar · **⚠️ el documento más importante de la carpeta**
> Capa: 4 — Síntesis, "el producto" ([company-brain.md](01-vision.md))
> Responde a: ¿qué es un skill, y cómo se llega a él desde memoria dispersa?
> Ver también: [11-capa4-motor-sintesis-tecnico.md](11-capa4-motor-sintesis-tecnico.md).

## Por qué existe este documento

`company-brain.md` es tajante: esta capa es **"el corazón del producto y lo
que mayormente falta construir"**. Todo lo demás (captación, memoria,
gobernanza, consumo) es infraestructura al servicio de esto. Si este doc queda
vacío, el resto de la documentación describe un producto sin producto.

## Insumos existentes a revisar

- Sección "Capa 4 — Síntesis" de `company-brain.md` (define la forma de un
  skill: pasos, reglas de decisión, actores/sistemas, políticas/restricciones,
  procedencia, versión/vigencia).
- `apx-motor-v2.md` — motor de clustering actual, que la visión
  describe como **"cimiento parcial de organización, no de síntesis
  procedimental"** — es insumo, no la solución.
- `docs/plan/savia-b2b-redesign/prototypes/org-home-v1.html` — ya explora
  "síntesis peer-driven" y "pull puntual" auditable como conceptos de
  producto.

## Temas a cubrir

### Qué es un skill (la unidad de síntesis)
- [ ] Forma completa: pasos, reglas de decisión, actores/sistemas
      involucrados, políticas/restricciones, procedencia, versión/vigencia —
      formalizar cada campo con ejemplo concreto (ej. "cómo se maneja una
      devolución").
- [ ] Diferencia entre un skill y un simple resumen/FAQ generado por LLM —
      qué lo hace "canónico" y no solo "plausible".

### De memoria dispersa a proceso canónico
- [ ] Cómo se identifica que **existe** un proceso repetido en la memoria de
      varias personas (¿patrón de actividad? ¿pedido explícito de un admin?).
- [ ] Reconciliación de vistas parciales — cuando dos personas describen el
      mismo proceso distinto, ¿quién gana, o se fusiona?
- [ ] Rol del humano en el loop — ¿toda síntesis pasa por aprobación antes de
      publicarse como skill invocable?

### Versionado y vigencia
- [ ] Qué dispara una re-síntesis (el proceso real cambió, se detecta
      contradicción con memoria nueva).
- [ ] Cómo se deprecia un skill viejo sin romper automatizaciones que ya lo
      usan.

### Relación con las otras capas
- [ ] Un skill hereda procedencia de Capa 2 y gobernanza de Capa 3 — ¿cómo se
      ve eso en la práctica?
- [ ] Un skill se sirve por Capa 5 (MCP resources) — ¿qué formato exacto se le
      entrega al LLM consumidor?

## Preguntas abiertas

- ¿"Síntesis" es un proceso continuo (siempre corriendo en background) o un
  evento explícito que alguien dispara?
- ¿Puede haber skills contradictorios coexistiendo mientras se resuelve cuál
  es el canónico, o el sistema fuerza unicidad desde el primer momento?

## Decisiones tomadas

_(vacío)_
