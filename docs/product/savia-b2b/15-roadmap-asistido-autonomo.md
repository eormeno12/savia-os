# 14 — Roadmap: asistido → autónomo

> Estado: 📝 esqueleto — pendiente de completar
> Responde a: ¿qué hace concretamente Savia en modo asistido hoy, y qué la habilita a pasar a autónomo?

## Por qué existe este documento

`company-brain.md` fija las dos etapas ("Asistido... viable hoy, riesgo bajo,
el beachhead" → "Autónomo... visión completa, gated por confianza +
integración + seguridad") pero no baja a comportamiento de producto concreto
ni a los gates que separan una etapa de la otra.

## Insumos existentes a revisar

- Sección "Hacia dónde va" de `company-brain.md`.
- [10-capa4-sintesis-modelo.md](10-capa4-sintesis-modelo.md) y
  [12-capa5-consumo-mcp.md](12-capa5-consumo-mcp.md) — el modo asistido y
  autónomo son, en el fondo, dos formas de consumir un skill.

## Temas a cubrir

### Modo asistido (el beachhead — definir primero)
- [ ] Qué ve exactamente un humano cuando pregunta "cómo se maneja X" —
      formato de respuesta (pasos + fuentes + quién más lo hizo).
- [ ] El humano ejecuta manualmente — Savia no llama ninguna tool de acción en
      este modo. Confirmar que el diseño de Capa 5 respeta esto.
- [ ] Qué feedback deja el humano después de ejecutar (¿confirma que el skill
      era correcto? ¿corrige algo?) — este feedback alimenta
      [11-capa4-motor-sintesis-tecnico.md](11-capa4-motor-sintesis-tecnico.md).

### Gates de confianza (asistido → autónomo)
- [ ] Criterios a definir: ¿cuántas ejecuciones asistidas correctas antes de
      ofrecer automatizar? ¿Quién aprueba el paso a autónomo — el mismo
      aprobador de skills de [03](03-personas-y-roles.md)?
- [ ] Requisitos de integración (¿el skill necesita tools reales de la empresa
      conectadas, no solo estar documentado?).
- [ ] Requisitos de seguridad (¿reversibilidad de la acción, límites de monto/
      alcance, aprobación humana para casos por encima de un umbral?).

### Modo autónomo (visión completa)
- [ ] El agente ejecuta el proceso end-to-end llamando tools de la empresa
      (no de Savia — confirmar el límite "Savia instruye, la empresa
      ejecuta").
- [ ] Manejo de falla a mitad de proceso — rollback, escalamiento a humano.
- [ ] Supervisión continua — ¿un admin puede pausar/revocar la autonomía de un
      skill específico en cualquier momento?

## Preguntas abiertas

- ¿Existe un estado intermedio entre asistido y autónomo (ej. "el agente
  prepara la acción, un humano solo aprueba con un click") o es un salto
  binario?

## Decisiones tomadas

_(vacío)_
