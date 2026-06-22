# Step 09 — MCP Server propio (lo que "activa" Savia)

**Objetivo**: una IA externa (Claude/Cursor/…) se conecta al MCP de Savia con su
token y puede buscar memoria (filtrada por sus spaces concedidos) y añadir nueva
memoria (siempre libre; Savia clasifica).

**Depende de**: 01, 02, 05, 07, 08.

---

## Proceso `mcp`

- Entrypoint `apps/api/src/mcp.ts` (puerto 4401), mismo código base que el proceso
  `main`, sin el servidor HTTP REST. Usa `@modelcontextprotocol/sdk` (HTTP streamable).
- Scripts: `"start:mcp": "node dist/mcp.js"`, dev `"mcp:dev": "nest start --watch --entryFile mcp"`.
- Patrón de referencia: `apps/demo-api` ya integra `@modelcontextprotocol/sdk`.

## Auth

- Cada request MCP trae `Authorization: Bearer <token-de-conexión>`.
- `resolveToken` (step 08, vía cache Redis) → `{ connectionId, userId, spaceIds }`.
- Sin token válido / conexión revocada → error MCP de auth.
- Actualizar `Connection.lastSeenAt` de forma throttled.

## Tools expuestas

### `savia_search(query, spaces?)`

```
1. resolve token → { userId, grantedSpaces }
2. requested = spaces ?? grantedSpaces          // la IA puede pedir un subconjunto
3. effective = intersect(requested, grantedSpaces)  // CLAMP — nunca más de lo concedido
4. if effective.length === 0 → return []        // default-deny en lectura
5. MemoryService.search(userId, query, { spaces: effective })
6. AccessLog.create({ action:"search", spaceIds: effective, resultCount })
7. return memorias (texto + score)
```

> El parámetro `spaces` permite que la IA enfoque la búsqueda ("busca solo en
> Trabajo"), pero Savia **siempre** intersecta con lo concedido. La IA no puede
> ver más de lo que el usuario le dio acceso.

### `savia_remember(content)`

```
1. resolve token → { userId, connectionId }   // no se verifica grant — write libre
2. MemoryService.add(userId, content, { source:"mcp", connectionId })
3. classifier.classify(content, userSpaces) → asigna spaces automáticamente
4. AccessLog.create({ action:"remember", spaceIds: [] })
```

La escritura no tiene restricción. Savia clasifica la memoria en los spaces que
correspondan según el texto. El usuario puede corregir manualmente después (step 07).

## Enforcement en lectura (no negociable)

- Filtro **duro** en Qdrant: `user_id` + `spaces ∩ effective`; nunca en el prompt.
- `default-deny`: sin grants → búsquedas devuelven `[]`.
- **Rate limit por token** (Redis) como protección ante tokens comprometidos.
- **Audit log** en cada llamada: qué conexión, qué spaces efectivos, cuántos resultados.

## Entregables frontend (`apps/app/src/`)

```
app/(app)/connect/page.tsx
components/connect/McpConfigBlock.tsx   # snippet listo para copiar
```

Mostrar el bloque de config MCP por cliente (Claude Code / Cursor / otros) con la
URL y el token de la conexión. Al tener el token → "Savia activo en tu IA".

## Contracts (`packages/contracts/src/mcp.ts`)

```ts
export const McpSearchInputSchema = z.object({
  query: z.string(),
  spaces: z.array(z.string()).optional()   // nombres o ids de spaces (opcional)
})
export const McpRememberInputSchema = z.object({
  content: z.string()                      // sin scope — write siempre libre
})
export const McpSearchResultSchema = z.object({
  id: z.string(), text: z.string(), score: z.number(),
  spaces: z.array(z.string())             // spaces en que está clasificada esta memoria
})
export type McpSearchInput   = z.infer<typeof McpSearchInputSchema>
export type McpRememberInput = z.infer<typeof McpRememberInputSchema>
export type McpSearchResult  = z.infer<typeof McpSearchResultSchema>
```

## Archivos clave

- `apps/api/src/mcp.ts`
- `apps/api/src/modules/mcp/*` (tools, auth, clamp, audit)
- `apps/app/src/app/(app)/connect/*`

## Verificación

1. `pnpm mcp:dev` levanta el MCP en 4401.
2. Conexión "Claude personal" con acceso solo a "Salud".
3. `savia_search("medicación")` → memorias de "Salud".
4. `savia_search("proyecto fintech", spaces:["Trabajo"])` → `[]` (clamp: no tiene
   acceso a Trabajo).
5. `savia_remember("Hoy empecé una dieta mediterránea")` → crea memoria,
   clasificada en "Salud" automáticamente; aparece en búsquedas de "Salud".
6. `savia_remember("Terminé el sprint de producto")` → crea memoria,
   clasificada en "Trabajo"; **Claude no la ve** porque no tiene acceso a Trabajo.
7. `AccessLog` registra cada llamada con los spaces efectivos.
8. Revocar la conexión → las tools dejan de funcionar.
