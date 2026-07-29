# 10 — Capa 4: Motor de síntesis (técnico)

> Estado: 📝 esqueleto — pendiente de completar · **⚠️ el gap técnico más grande de todo el producto**
> Capa: 4 — Síntesis ([company-brain.md](01-vision.md))
> Responde a: ¿cómo se genera técnicamente la memoria corporativa, con qué
> reglas? (pedido explícito: "cómo vamos a generar memoria corporativa con sus
> reglas")

## Por qué existe este documento

Este es el segundo hueco técnico señalado directamente, y el más grande de
todo el producto según la propia visión ("lo que mayormente falta
construir"). [10-capa4-sintesis-modelo.md](10-capa4-sintesis-modelo.md) define
**qué** es un skill; este documento define **cómo** el sistema llega de "N
memorias individuales dispersas" a "un skill publicado".

## Insumos existentes a revisar

- `apx-motor-v2.md` — el motor de clustering actual (as-built,
  citado línea por línea contra el código real). La visión dice
  explícitamente que es un **cimiento parcial**, no la síntesis en sí — hay
  que leerlo a fondo para saber qué reutiliza el motor de síntesis y qué
  necesita construirse nuevo.
- `apps/api/src/modules/organization/` — **este es el módulo real del motor
  v2** (`organization.module.ts:16-19` lo autodenomina "the dynamic memory
  engine v2 (persona graph + encoding tree)"). ⚠️ Colisión de nombres: hoy
  "organization" en código significa *auto-organización dinámica de la
  memoria de un usuario* (grafo mutual-kNN, personas, árbol jerárquico) — **no
  tiene relación con la entidad `Organization` (empresa/tenant)** que este
  mismo doc suite propone en [02-glosario-y-entidades.md](02-glosario-y-entidades.md).
  Resolver el choque de nombres (renombrar el módulo existente, o elegir otro
  nombre para la entidad de empresa) antes de escribir código nuevo.
- Sección "En exploración" de `company-brain.md` — recuerda que el *cómo*
  profundo de indexar/recuperar sigue abierto; el motor de síntesis consume
  esas decisiones (Capa 2) como input.

## Temas a cubrir

### Disparo (trigger)
- [ ] ¿Qué dispara un intento de síntesis? Opciones a evaluar: cron periódico,
      umbral de actividad (ej. "3 personas mencionaron el mismo proceso"),
      pedido explícito de un admin, detección de conflicto entre memorias.
- [ ] ¿Corre por organización completa, por equipo, o por "tema" detectado?

### Detección de candidatos a proceso
- [ ] Cómo se agrupan memorias que hablan del "mismo" proceso aunque usen
      palabras distintas (clustering semántico — evaluar si el motor v2 ya
      sirve para esto o hace algo distinto).
- [ ] Cómo se distingue "esto es un hecho aislado" de "esto es un patrón
      repetido que merece convertirse en skill".

### Reconciliación (el núcleo algorítmico)
- [ ] ¿Es LLM-based (un modelo lee N memorias y redacta el skill), reglas
      determinísticas, o híbrido?
- [ ] Manejo de conflicto: dos personas describen el mismo proceso de forma
      distinta o contradictoria — ¿cómo se resuelve? ¿se prioriza por
      antigüedad, por rol de quien lo dijo, por frecuencia?
- [ ] Cómo se preserva procedencia durante la reconciliación (cada regla del
      skill final debe poder señalar de qué memoria(s) salió).

### Validación humana
- [ ] Punto exacto del pipeline donde un humano revisa antes de publicar.
- [ ] Qué pasa si el humano rechaza — ¿se descarta, se reintenta con más
      contexto, queda en borrador?

### Publicación y versionado
- [ ] Cómo un skill aprobado se vuelve invocable por Capa 5 (formato de
      salida, dónde se almacena).
- [ ] Qué dispara una re-síntesis de un skill ya publicado (memoria nueva que
      lo contradice, cambio de proceso reportado explícitamente). **Candidato
      concreto:** el mecanismo de reconciliación de identidad del diseño de
      ingesta ([05](05-capa1-pipeline-ingesta-tecnico.md)) ya detecta cuándo
      un elemento de una fuente cambió, se movió o se editó entre dos
      versiones — es la señal natural de "esta fuente cambió, evaluar
      re-síntesis" en vez de construir un detector de cambio aparte.

### Métricas de calidad
- [ ] Cómo se mide que un skill sintetizado es correcto (¿feedback de uso,
      tasa de corrección humana, comparación contra ejecución real?).

## Preguntas abiertas

- ¿El motor de síntesis es un servicio nuevo separado del motor de clustering
  actual (`apps/api/src/modules/organization/`), o una evolución del mismo
  (`motor-v2.md` → `motor-v3`)?
- ¿Cómo se resuelve la colisión de nombres entre el módulo `organization/`
  existente (motor de clustering) y la futura entidad `Organization`
  (empresa/tenant)?
- ¿Cuánto de esto puede ser genérico (mismo motor para cualquier organización)
  vs necesita tuning por organización/industria?

## Decisiones tomadas

_(vacío)_
