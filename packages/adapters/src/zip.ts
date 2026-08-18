/// <reference path="./env.d.ts" />
/**
 * EL DIRECTORIO DE UN ZIP — qué entradas tiene, sin descomprimir ninguna.
 *
 * CERO DEPENDENCIAS, Y ESA ES LA RAZÓN DE QUE ESTE ARCHIVO EXISTA APARTE. Cuatro de
 * los doce formatos son un zip por dentro y comparten bytes mágicos, así que el TRAMO 2
 * los distingue por qué entradas tienen: «los cuatro consultan `entradasZip()`, y la
 * memoización hace que el costo real sea una sola apertura parcial»
 * (§{Los tres casos}). Y la regla que admite dependencias de runtime está escrita con su razón:
 * confinarlas «encerrada en el adaptador que la usa» existe para que «el tramo 2
 * —decidir QUIÉN lee un archivo— siga sin depender de ninguna librería de formato».
 *
 * Si el listado y la descompresión vivieran en el mismo archivo, `registry.ts` —donde
 * vive el selector— importaría transitivamente `fflate`, y esa frase pasaría a ser
 * FALSA sin que ningún especificador de import lo mostrara. Partirlo es lo que la
 * mantiene verdadera, y es el mismo movimiento que el bloque 3b hizo con
 * `provenance.ts`: separar un archivo para volver ESCRIBIBLE una frontera.
 * La otra mitad vive en `unzip.ts`, que es la dueña de `fflate`.
 *
 * ES TOLERANTE Y NO LANZA. «Archivos rotos son la norma, no la excepción. Es tolerante
 * y avisa» (§{Los decodificadores}). Un zip ilegible devuelve la lista vacía; quien
 * llama decide si eso es un aviso o una abstención. Lanzar acá volvería `None` a
 * cualquier evidenciador que consultara las entradas, o sea que un archivo corrupto
 * decidiría por adaptadores que no lo miraron.
 */

import { PARAMETERS } from "@savia-os/ir";

const { zero: ZERO, one: ONE } = PARAMETERS.arithmetic;

// Los desplazamientos y firmas del formato ZIP (APPNOTE.TXT 6.3.x, secciones 4.3.12
// y 4.3.16). NO son parámetros: son la especificación. Un parámetro decide
// comportamiento y se puede medir; esto no se puede elegir sin dejar de leer zips.
const FIRMA_DIRECTORIO = 0x02014b50;
const FIRMA_FIN = 0x06054b50;
const FIN_MINIMO = 22; // el registro de fin, sin comentario
const FIN_ENTRADAS = 10; // uint16 · cuántas entradas hay
const FIN_OFFSET = 16; // uint32 · dónde arranca el directorio central
const DIR_METODO = 10; // uint16 · 0 = sin comprimir, 8 = deflate
const DIR_COMPRIMIDO = 20; // uint32 · bytes que ocupa comprimida
const DIR_NOMBRE = 28; // uint16 · largo del nombre
const DIR_EXTRA = 30; // uint16
const DIR_COMENTARIO = 32; // uint16
const DIR_LOCAL = 42; // uint32 · dónde está su encabezado local
const DIR_FIJO = 46; // el encabezado de directorio, sin las tres partes variables

export type ZipEntry = {
  readonly name: string;
  readonly method: number;
  readonly compressed: number;
  readonly local: number;
};

/**
 * El directorio central, o la lista vacía si esto no es un zip legible.
 *
 * Se busca el registro de fin DESDE ATRÁS porque su posición no es fija: puede llevar
 * un comentario de largo arbitrario. Es la única forma de encontrarlo.
 */
export const zipDirectoryOf = (bytes: Uint8Array): readonly ZipEntry[] => {
  // ACÁ HABÍA UNA GUARDA `bytes.length < FIN_MINIMO` Y SE BORRÓ, y se encontró
  // intentando escribirle el mutante que la acreditara: el bucle de abajo YA maneja
  // cualquier entrada corta, porque `bytes.length - FIN_MINIMO` queda negativo y el
  // cuerpo no corre ni una vez. Medido con entradas de 0, 7 y 21 bytes: las tres
  // devuelven la lista vacía sin lanzar, con guarda y sin ella. Una guarda que ninguna
  // mutación puede distinguir de su ausencia no es una garantía, es una pieza.
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let fin = -ONE;
  for (let i = bytes.length - FIN_MINIMO; i >= ZERO; i -= ONE) {
    if (dv.getUint32(i, true) === FIRMA_FIN) {
      fin = i;
      break;
    }
  }
  if (fin < ZERO) return [];
  const total = dv.getUint16(fin + FIN_ENTRADAS, true);
  const decodificador = new TextDecoder("utf-8");
  const salida: ZipEntry[] = [];
  let p = dv.getUint32(fin + FIN_OFFSET, true);
  for (let n = ZERO; n < total; n += ONE) {
    // Un directorio truncado o con una firma que no es la suya no es un zip a medias:
    // es un zip que no se puede leer. Se devuelve lo que se pudo, sin lanzar.
    if (p + DIR_FIJO > bytes.length) return salida;
    if (dv.getUint32(p, true) !== FIRMA_DIRECTORIO) return salida;
    const largoNombre = dv.getUint16(p + DIR_NOMBRE, true);
    salida.push({
      name: decodificador.decode(bytes.subarray(p + DIR_FIJO, p + DIR_FIJO + largoNombre)),
      method: dv.getUint16(p + DIR_METODO, true),
      compressed: dv.getUint32(p + DIR_COMPRIMIDO, true),
      local: dv.getUint32(p + DIR_LOCAL, true),
    });
    p += DIR_FIJO + largoNombre + dv.getUint16(p + DIR_EXTRA, true) + dv.getUint16(p + DIR_COMENTARIO, true);
  }
  return salida;
};

/**
 * Los nombres de las entradas. Lo que el TRAMO 2 consulta para distinguir los cuatro
 * formatos que comparten bytes mágicos: un `.docx` tiene `word/document.xml`, un
 * `.xlsx` tiene `xl/workbook.xml`, un `.pptx` tiene `ppt/presentation.xml`, y un
 * `.odt` tiene `mimetype` con el suyo adentro.
 *
 * NO DESCOMPRIME NADA. Es el directorio central y nada más.
 */
export const zipEntriesOf = (bytes: Uint8Array): readonly string[] =>
  zipDirectoryOf(bytes).map((e) => e.name);
