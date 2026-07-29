# 03 — Capa 1: Captación multimodal (producto)

> Estado: 📝 esqueleto — pendiente de completar
> Capa: 1 — Captación multimodal ([company-brain.md](01-vision.md))
> Responde a: ¿qué experimenta una persona/organización al traer conocimiento a Savia?
> Ver también: [05-capa1-pipeline-ingesta-tecnico.md](05-capa1-pipeline-ingesta-tecnico.md) para el cómo técnico.

## Por qué existe este documento

La visión ya lista las modalidades y su estado (tabla en `company-brain.md`),
pero no describe la **experiencia** de captar cada una. Este doc es sobre el
producto (qué ve y decide el usuario), no sobre el pipeline interno.

## Insumos existentes a revisar

- Tabla de modalidades en `company-brain.md` (texto/chat ✅, documentos ⚠️
  parcial, hojas/imágenes/video/conectores ⬜ nuevo).
- `apps/app/src/components/fuentes/` (pantalla "Fuentes" ya construida para
  captación personal).
- `apps/api/src/modules/connections/` (conectores personales existentes).

## Temas a cubrir

### Captación personal (ya existe, documentar tal cual funciona)
- [ ] Traer un archivo propio (drive personal)
- [ ] Conectar una fuente personal (Gmail, etc. si existe)

### Captación de organización (nuevo)
- [ ] Quién conecta una fuente **de la empresa** (Slack/Drive/Notion
      compartido) — ¿solo el admin, o cualquier miembro puede proponer un
      conector que el admin aprueba?
- [ ] Qué ve el usuario cuando una fuente es org-level vs personal (¿se
      distingue visualmente? ¿aparece en "Fuentes" igual?)
- [ ] Consentimiento y alcance: ¿qué se le pide a la empresa (permisos OAuth,
      qué canales/carpetas incluir) antes de empezar a ingestar?
- [ ] Revocación: qué pasa con la memoria ya extraída si se desconecta una
      fuente org-level (¿se borra, se congela, se marca como obsoleta?)

### Por modalidad (una entrada por fila de la tabla de la visión)
- [ ] Hojas de cálculo — experiencia de traer un Excel/CSV, qué se pregunta al
      usuario (ej. qué columna es clave)
- [ ] Imágenes — experiencia de subir fotos/gráficos
- [ ] Video/audio — experiencia de traer una reunión/podcast
- [ ] Conectores — experiencia de dar de alta un conector con sync continuo

## Preguntas abiertas

- ¿Existe un límite de "cuánto" puede captar una organización antes de
  necesitar un plan superior? (cruza con [16-billing-y-planes.md](16-billing-y-planes.md))

## Decisiones tomadas

_(vacío)_
