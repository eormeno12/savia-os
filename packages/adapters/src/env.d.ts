/**
 * Lo mínimo del entorno que este paquete usa y que `lib: ["ES2022"]` no trae.
 *
 * POR QUÉ NO ES `@types/node`, que sería lo obvio. Dos razones, y la segunda es la que
 * decide. (1) `@types/node` mete en alcance `Buffer`, `process`, `require` y
 * `__dirname`, o sea cuatro formas de usar node desde `src/` sin escribir un solo
 * `import`, que es exactamente lo que `scripts/boundaries.mjs` no puede ver: el
 * guardián mira especificadores de import, y un global no es un import. (2) Este
 * archivo declara EXACTAMENTE lo que se usa, así que la lista de lo que el paquete
 * toma del entorno se lee de un vistazo y crece con un diff visible.
 *
 * Se trae con `/// <reference>` desde los dos archivos que la usan y no por el
 * `include` del tsconfig, y eso es NECESARIO y no estilo: `@savia-os/orchestration`
 * compila las fuentes de este paquete a través del import bare —el `types` del
 * manifiesto apunta a `src/index.ts`—, y un ambiente que solo esté en el `include` de
 * ACÁ no forma parte de ESE programa. Verificado: sin la referencia, `orchestration`
 * falla con «Cannot find name 'TextDecoder'» sobre un archivo que no es suyo.
 *
 * `TextDecoder` es global en node desde la v11 y en todo navegador: no hay nada que
 * importar, solo que declarar.
 */

declare class TextDecoder {
  constructor(label?: string);
  decode(input?: Uint8Array): string;
}
