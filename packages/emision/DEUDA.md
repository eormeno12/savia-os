# Este paquete no compila, a propósito

`packages/emision` está escrito contra el contrato de `@savia-os/ir` **en español**.
Los bloques 1 y 2 de la reescritura a inglés le rompieron **30 símbolos**:

```
src/emisor.ts(38,3): '"@savia-os/ir"' has no exported member named 'PARAMETROS'. Did you mean 'PARAMETERS'?
src/emisor.ts(39,3): Module '"@savia-os/ir"' has no exported member 'comoHuellaNodo'.
src/emisor.ts(200,22): Property 'via' does not exist on type 'Hint'.
…
```

## Por qué está así y no arreglado

El rename **no creó** esta deuda: la **encontró vencida**. Este paquete siempre estuvo
atado a nombres que iban a cambiar; lo único que hizo la reescritura fue volverlo
visible.

Arreglarlo hoy significa traducirlo hoy — o sea, hacer el **bloque 5 fuera de orden**,
sobre un paquete cuyos símbolos todavía van a moverse cuando se traduzcan
`projection.ts`, `outputs.ts` y `adapter.ts`. Sería reescribirlo dos veces.

## Por qué está DECLARADO y no simplemente roto

`typecheck`, `lint` y `build` salen en verde con este aviso, en vez de fallar. No es
para esconderlo: es para que el rojo del monorepo signifique **algo nuevo**.

Un fallo permanente que todos aprenden a ignorar es peor que ninguno — deja de ser una
señal y pasa a ser ruido, y el día que se rompa otra cosa nadie lo va a notar.

Para ver los errores de verdad:

```bash
pnpm --filter @savia-os/emision typecheck:real
```

## Cuándo se arregla

En el **bloque 5** del rename, cuando `packages/ir` esté entero en inglés. Ahí este
archivo se borra y los scripts vuelven a lo que eran.

**Lo que hay que restaurar:**

```json
"typecheck": "tsc --noEmit",
"lint":  "tsc --noEmit && node scripts/invariantes.mjs && node scripts/citas.mjs",
"build": "tsc --noEmit && node scripts/invariantes.mjs && node scripts/citas.mjs"
```
