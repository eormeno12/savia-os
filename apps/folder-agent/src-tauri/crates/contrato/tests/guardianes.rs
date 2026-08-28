//! Los guardianes de `tests/guardianes.rs` (crate unico, pre-corte) que tocan un solo
//! archivo y ese archivo cae entero en `contrato`. Movidos tal cual, sin tocar el
//! cuerpo — ver docs/product/savia-b2b/plan-rediseno-agente.md §2.

use std::path::PathBuf;

fn fuente(rel: &str) -> String {
    let p = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("src")
        .join(rel);
    std::fs::read_to_string(&p).unwrap_or_else(|e| panic!("no se pudo leer {}: {e}", p.display()))
}

/// El `#[derive(...)]` mas cercano ANTES de `marcador_de_tipo` (p. ej. `"pub struct
/// Foo"`) en `src`. Dos tests de este archivo lo usan para afirmar que un tipo NO
/// deriva cierto trait — factorizado para que un futuro endurecimiento (derives en
/// mas de una linea, atributos apilados) se arregle en un solo lugar y no deje uno de
/// los dos tests silenciosamente mas debil que el otro.
fn derive_de<'a>(src: &'a str, marcador_de_tipo: &str) -> &'a str {
    let i = src.find(marcador_de_tipo).expect("falta el tipo");
    src[..i].rsplit("#[derive(").next().unwrap_or("")
}

#[test]
fn los_cinco_numeros_del_canal_estan_sin_valor() {
    // IMPORTA PORQUE: si alguno se completara con un numero inventado, el modulo
    // funciona, los tests pasan y el banco reporta cifras — y nadie se entera de que
    // estan calibradas contra un valor que nadie midio.
    let src = fuente("parametros.rs");
    for (nombre, _) in [
        ("ASENTAMIENTO", ()),
        ("MAX_INTENTOS", ()),
        ("VENTANA_DE_CUARENTENA", ()),
        ("FRACCION_DEL_CORTE", ()),
        ("VENTANA_DEL_OBSERVADOR", ()),
    ] {
        let linea = src
            .lines()
            .find(|l| l.contains(&format!("pub const {nombre}:")))
            .unwrap_or_else(|| panic!("falta el parametro {nombre}"));
        assert!(
            linea.contains("= None;"),
            "{nombre} tiene valor: {linea}. Ninguno de los cinco se inventa."
        );
    }
    // Y cada uno lleva unidad, que decide y como se mediria.
    for marca in ["DECIDE:", "COMO SE MEDIRIA:", "SE MEDIRIA:"] {
        assert!(
            src.contains(marca) || marca == "SE MEDIRIA:",
            "falta la ficha `{marca}` en parametros.rs"
        );
    }
}

#[test]
fn el_id_de_archivo_no_puede_ser_clave_de_un_mapa() {
    // IMPORTA PORQUE: NTFS recicla ids y un restore los cambia todos. Si derivara `Hash`,
    // indexar el inventario por el compilaria, y a partir de ahi dos archivos distintos
    // colapsan en una fila: el documento viejo no se retira NUNCA y el contenido nuevo no
    // se sube NUNCA.
    let src = fuente("dominio.rs");
    let derive = derive_de(&src, "pub struct IdDeArchivoDelSO");
    assert!(
        !derive.contains("Hash"),
        "`IdDeArchivoDelSO` deriva `Hash`: es una pista que se verifica, nunca una identidad"
    );
    assert!(!derive.contains("Ord"), "`IdDeArchivoDelSO` deriva `Ord`");
}

#[test]
fn la_id_de_volumen_no_deriva_partial_eq() {
    // IMPORTA PORQUE: dos `NoPublicada` compararian iguales, la huella de raiz
    // «coincidiria», y un directorio suplente sobre otro volumen sin UUID pasaria la
    // salvaguarda 2 entera.
    let src = fuente("plataforma.rs");
    let derive = derive_de(&src, "pub enum IdDeVolumen");
    assert!(
        !derive.contains("PartialEq"),
        "`IdDeVolumen` deriva `PartialEq`: la comparacion tiene que ser de TRES valores"
    );
}

#[test]
fn el_puerto_de_inventario_no_tiene_metodos_de_escritura() {
    // IMPORTA PORQUE: es lo que permite que el efecto y el hecho se comprometan en la
    // MISMA transaccion. Si la maquina escribiera, se marcaria «reportado», el proceso
    // moriria antes de encolar, y ese archivo no se reportaria nunca mas.
    let src = fuente("inventario.rs");
    let i = src.find("pub trait Inventario").expect("falta el trait");
    let j = src[i..].find("\n}\n").expect("trait sin cerrar") + i;
    let cuerpo = &src[i..j];
    assert!(
        !cuerpo.contains("&mut self"),
        "el puerto `Inventario` gano un metodo de escritura"
    );
}
