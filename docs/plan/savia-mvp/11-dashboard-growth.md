# Step 11 — Dashboard de áreas + crecimiento

**Objetivo**: visualizar el perfil del usuario como sus **áreas de memoria**
(spaces) y **cuánto ha crecido** su conocimiento por día/semana.

**Depende de**: 02, 06, 07 (y 09 para el panel de accesos).

---

## Fuentes de datos

- **Áreas**: conteo de memorias por space. Se calcula desde `MemoryIndex`
  (`spaceIds`) o desde Qdrant (count por payload). Cachear en Redis.
- **Crecimiento**: tabla `GrowthEvent` (una fila por memoria creada, con `area` y
  `createdAt`). Agregación con `date_trunc` en Postgres → NO depender de mem0 para
  series temporales.
- **Accesos** (opcional en este step): `AccessLog` → qué IA accedió a qué áreas.

## Entregables backend (`apps/api/src/modules/growth/`)

```
growth.module.ts
growth.controller.ts
growth.service.ts
```

Endpoints (protegidos, scoped al usuario):

- `GET /areas` → `[{ spaceId, name, count, share }]` ordenado por tamaño.
  Cacheado (TTL corto), invalidado al ingestar/reclasificar.
- `GET /growth?range=day|week` →
  ```sql
  SELECT date_trunc(:granularity, created_at) bucket, area, count(*)
  FROM growth_events
  WHERE user_id = :uid AND created_at >= :since
  GROUP BY bucket, area ORDER BY bucket;
  ```
  Devuelve serie por área para graficar; más `totals` (hoy / esta semana / delta vs
  semana anterior).
- `GET /access-activity` (opcional) → resumen de `AccessLog` por conexión/área.

## Entregables frontend (`apps/app/src/`)

```
app/(app)/dashboard/page.tsx
components/dashboard/AreasOverview.tsx    # áreas como bloques con tamaño = nº memorias
components/dashboard/GrowthChart.tsx      # curva crecimiento día/semana
components/dashboard/GrowthStats.tsx      # "+N hoy", "+N esta semana"
components/dashboard/AccessActivity.tsx   # (opcional) qué IA accede a qué
```

- **Áreas**: bloques/treemap o burbujas cuyo tamaño refleja el nº de memorias por
  área. Reusar `react-force-graph-2d` (ya en landing) si se quiere una vista de grafo
  de áreas; si no, treemap/grid simple.
- **Crecimiento**: gráfico de líneas/barras con toggle día/semana; stats arriba
  ("creció X en Trabajo esta semana").
- Estética coherente con landing (tokens/tema).

## Notas

- El dashboard se alimenta de spaces del usuario (step 07). Si no tiene
  ninguna, mostrar estado vacío que invite a crearlas/onboarding.
- Mantener el cálculo de áreas cacheado para no pegarle a Qdrant/Postgres en cada
  render.

## Contracts (`packages/contracts/src/growth.ts`)

```ts
export const AreaDtoSchema = z.object({
  spaceId: z.string(), name: z.string(),
  count: z.number(), share: z.number()   // porcentaje del total
})
export const GrowthPointSchema = z.object({
  bucket: z.string(), area: z.string(), count: z.number()
})
export const GrowthSummarySchema = z.object({
  points: z.array(GrowthPointSchema),
  todayTotal: z.number(), weekTotal: z.number(), weekDelta: z.number()
})
export type AreaDto       = z.infer<typeof AreaDtoSchema>
export type GrowthPoint   = z.infer<typeof GrowthPointSchema>
export type GrowthSummary = z.infer<typeof GrowthSummarySchema>
```

Tipos importados en `apps/app` para tipar las respuestas del dashboard.

## Archivos clave

- `apps/api/src/modules/growth/*`
- `apps/app/src/app/(app)/dashboard/*`

## Verificación

1. Tras ingestar varios archivos y tener spaces, `GET /areas` devuelve conteos
   correctos por área.
2. `GET /growth?range=week` coincide con las filas de `GrowthEvent` de la semana.
3. El dashboard muestra áreas con tamaño proporcional y la curva de crecimiento;
   los stats ("+N hoy/semana") cuadran con los datos.
4. (Si se incluye) el panel de accesos refleja las llamadas registradas en
   `AccessLog` (step 09).
