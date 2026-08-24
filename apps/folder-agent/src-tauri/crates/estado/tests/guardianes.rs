//! Los guardianes de `tests/guardianes.rs` (crate unico, pre-corte) que caen en
//! `estado`: uno que tocaba solo `colas.rs`, y la copia que le toca a `inventario.rs` de
//! `los_modulos_puros_no_tocan_el_mundo` —partido en copias porque sus tres archivos
//! cayeron en crates distintas y no hay conocimiento cruzado que compartir—. Ver
//! docs/product/savia-b2b/plan-rediseno-agente.md §2.

use std::path::PathBuf;

fn fuente(rel: &str) -> String {
    let p = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("src")
        .join(rel);
    std::fs::read_to_string(&p).unwrap_or_else(|e| panic!("no se pudo leer {}: {e}", p.display()))
}

#[test]
fn los_modulos_puros_no_tocan_el_mundo() {
    // IMPORTA PORQUE: si el inventario leyera el disco o el reloj, dejaria de ser
    // determinista y el banco no podria ejercer «pasaron seis horas y cinco la laptop
    // estuvo dormida» sin dormir la laptop.
    const PROHIBIDOS: [&str; 7] = [
        "std::fs",
        "std::net",
        "std::env",
        "std::process",
        "Instant::now",
        "SystemTime::now",
        "std::time::Instant",
    ];
    let src = fuente("inventario.rs");
    for prohibido in PROHIBIDOS {
        assert!(
            !src.contains(prohibido),
            "inventario.rs usa `{prohibido}`: el mundo entra por puerto, no por llamada"
        );
    }
    assert!(
        src.contains("#![forbid(unsafe_code)]"),
        "inventario.rs tiene que declarar `#![forbid(unsafe_code)]`"
    );
}

#[test]
fn el_desenlace_no_tiene_rama_descartar() {
    // IMPORTA PORQUE: un `400` descartado en silencio pierde un hecho sin que nadie se
    // entere; el inventario del agente y el registro de Savia divergen y no hay mecanismo
    // que los reconcilie. La ausencia de la variante es la garantia.
    let src = fuente("colas.rs");
    let i = src.find("pub enum Desenlace").expect("falta el enum");
    let j = src[i..].find("\n}\n").expect("enum sin cerrar") + i;
    let cuerpo = &src[i..j];
    for prohibida in ["Descartar", "Descartado", "Ignorar"] {
        assert!(
            !cuerpo.contains(prohibida),
            "`Desenlace` gano una rama `{prohibida}`: todo trabajo termina entregado, esperando, detenido, muerto con alerta, ambiguo o ilegible en disco"
        );
    }
}
