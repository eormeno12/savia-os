/**
 * EL CONTRATO, SIN NADIE ENCIMA. Los valores de Savia como datos y nada mas: este modulo
 * y los dos que reexporta no importan absolutamente nada.
 *
 * Es el punto de entrada de los consumidores que NO son Chakra —hoy el emisor de CSS que
 * alimenta al agente de carpeta— y existe separado de `index.ts` porque ese arrastra el
 * runtime entero de Chakra. Importar `@savia-os/design-tokens` desde un binario de
 * escritorio traeria React; importar `@savia-os/design-tokens/data` no trae nada.
 *
 * `scripts/boundaries.mjs` lo verifica: si alguno de los tres gana un import, el lint
 * falla.
 */
export { tokens } from "./tokens";
export { semanticTokens } from "./semantic-tokens";
