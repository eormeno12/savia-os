/**
 * HOOK DE RESOLUCION: le agrega `.ts` a los imports relativos sin extension.
 *
 * **EXISTE PARA NO TOCAR LAS FUENTES.** `src/index.ts` importa `./tokens` al estilo
 * TypeScript, que Node no resuelve. La alternativa era agregarle la extension a los
 * imports — pero este guardian tiene que poder sacarle la foto al sistema TAL COMO ESTA,
 * antes de cualquier cambio. Una red que exige mover el trapecio primero no es una red.
 */
export async function resolve(especificador, contexto, siguiente) {
  if (especificador.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(especificador)) {
    try {
      return await siguiente(`${especificador}.ts`, contexto);
    } catch {
      // No era un `.ts`: se sigue por el camino normal.
    }
  }
  return siguiente(especificador, contexto);
}
