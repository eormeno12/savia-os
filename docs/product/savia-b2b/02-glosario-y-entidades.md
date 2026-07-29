# 01 — Glosario y modelo de entidades

> Estado: 📝 esqueleto — pendiente de completar
> Responde a: ¿qué palabra usamos para cada cosa, y qué entidades nuevas hacen falta en el modelo de datos?

## Por qué existe este documento

Es la base de todos los demás — si `Organization`, `Team`, `Skill`, `Grant` no
significan una sola cosa consistente, cada doc de esta carpeta va a inventar su
propia versión. Se completa **primero**, o en paralelo muy cercano a
[03-personas-y-roles.md](03-personas-y-roles.md).

## Insumos existentes a revisar

- [`01-vision.md`](01-vision.md) — usa `skill`,
  `proceso canónico`, `procedencia`, `chokepoint`, `síntesis` sin definirlos
  formalmente como entidades de datos.
- `docs/audit/backend/2026-06-27/03-modelo-de-datos.md` y
  `05-rediseno-estructural.md` — modelo actual: `User, Space, MemoryIndex,
  Connection, CollectiveGroup, GroupMember, FragmentShare`. **No existe
  `Organization`/`Tenant` como entidad de negocio.**
- `docs/plan/savia-b2b-redesign/prototypes/governance-strategy-v1.html` — ya
  propone extender `GrantScope` y menciona una entidad de organización.
- Nota: hoy "tenant" ya se usa en el código con otro sentido (aislamiento
  técnico por usuario en Qdrant, `is_tenant:true`). Hay que desambiguar antes de
  reusar la palabra para "empresa".

## ⚠️ Colisión de nombres detectada

`apps/api/src/modules/organization/` **ya existe en código** y es el motor v2
de clustering (`organization.module.ts:16-19`: "the dynamic memory engine v2
— persona graph + encoding tree"), documentado en `apx-motor-v2.md`.
No tiene relación con "empresa" — es auto-organización de la memoria de **un**
usuario. Antes de introducir una entidad `Organization` (empresa/tenant) hay
que resolver esto: renombrar el módulo existente, o elegir otro nombre para la
entidad de negocio (`Company`, `Tenant`, `Workspace`). Ver también
[11-capa4-motor-sintesis-tecnico.md](11-capa4-motor-sintesis-tecnico.md).

## Términos a resolver (uno por uno, con definición + entidad de datos si aplica)

- [ ] `Organization` (o `Company`/`Tenant`/`Workspace` — elegir uno y fijarlo;
      ver colisión de nombres arriba)
- [ ] `Team` — ¿subgrupo dentro de una organización, o sinónimo de "colectivo"?
- [ ] `Membership` — persona ↔ organización. ¿Una persona puede pertenecer a N
      organizaciones a la vez?
- [ ] `Space` (ya existe) — ¿sigue siendo la unidad de memoria personal, o
      también puede ser "de organización"?
- [ ] `Skill` vs `Process` vs `Procedure`/`Playbook` — ¿son sinónimos o hay
      jerarquía (un Skill *ejecuta* un Process)?
- [ ] `Grant` / `Role` / `Scope` / `Permission` — relación entre estos cuatro
- [ ] `Connector` vs `Connection` (ya existe `Connection` a nivel personal) —
      ¿el conector org-level es la misma entidad extendida o una nueva?
- [ ] `Colectivo`/`CollectiveGroup`/`FragmentShare` (ya existen) — ¿se
      convierten en `Team`, o coexisten como el mecanismo peer-to-peer dentro de
      una organización?

## Vocabulario del IR de ingesta (nuevo, del diseño de pipeline multi-formato)

Ver [05-capa1-pipeline-ingesta-tecnico.md](05-capa1-pipeline-ingesta-tecnico.md)
para el diseño completo. Términos que este glosario debería fijar cuando ese
diseño se implemente, para que no queden como jerga solo del pipeline de
ingesta sino conectados al resto del vocabulario del producto:

- [ ] `PublicDocElement` — la unidad estructural que produce un adapter.
      ¿Es lo mismo que un "hecho" (π) de `company-brain.md`, o es un paso
      previo (estructura) del que recién después se extraen hechos?
- [ ] `ContentKind` / `SemanticLabel` / `Cohesion` — los tres ejes de forma/
      vocabulario/cohesión de un elemento. Vocabulario técnico del pipeline;
      evaluar si algo de esto necesita ser visible en `Skill`/`Grant` más
      arriba en la pila, o si queda encapsulado en Capa 1-2.
- [ ] `SourceRange` (`text`/`fragment`/`grid`) — candidato concreto para la σ
      (coordenadas) de la visión. Ver [07](07-capa2-memoria-arquitectura-tecnica.md).
- [ ] `DocumentId` / `ElementId` / `ContentHash` / `LocalKey` — identidad de
      documento/elemento. `ElementId` es el que persiste entre versiones (lo
      acuña el reconciliador, no el adapter) — es el candidato a "handle
      estable" que Capa 2/4 necesitan para saber que dos memorias vienen de
      "el mismo lugar" a través del tiempo.
- [ ] `DocumentLineageId` — **no existe todavía, decisión abierta** (ver
      [19-decisiones-abiertas.md](19-decisiones-abiertas.md)): qué identifica
      que un archivo subido es una nueva versión de otro ya ingestado.

## Modelo de entidades (diagrama a completar)

```
(a completar — Organization, Membership, Team, Space, MemoryIndex, Skill, Grant,
 y sus relaciones. Marcar qué extiende al modelo actual y qué es nuevo.)
```

## Decisiones tomadas

_(vacío — se llena a medida que se resuelve cada término)_
