//! Los guardianes de `tests/guardianes.rs` (crate unico, pre-corte) que caen en
//! `maquina`: uno que tocaba solo `maquina.rs`, y las copias que le tocan a `maquina.rs`
//! de los dos que verificaban una propiedad por archivo sobre varios archivos a la vez
//! —`los_modulos_puros_no_tocan_el_mundo` y
//! `ningun_numero_inventado_en_los_modulos_de_decision`—, partidos en copias porque sus
//! archivos cayeron en crates distintas y no hay conocimiento cruzado que compartir. Ver
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
    // IMPORTA PORQUE: si la maquina leyera el disco o el reloj, dejaria de ser
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
    let src = fuente("maquina.rs");
    for prohibido in PROHIBIDOS {
        assert!(
            !src.contains(prohibido),
            "maquina.rs usa `{prohibido}`: el mundo entra por puerto, no por llamada"
        );
    }
    assert!(
        src.contains("#![forbid(unsafe_code)]"),
        "maquina.rs tiene que declarar `#![forbid(unsafe_code)]`"
    );
}

#[test]
fn ningun_numero_inventado_en_los_modulos_de_decision() {
    // IMPORTA PORQUE: es la regla del monorepo —«si un numero decide comportamiento vive
    // en PARAMETERS con unidad, que decide y como se mediria»—. Un `Duration::from_secs`
    // suelto en la maquina seria un intervalo elegido a ojo con cara de constante.
    let src = fuente("maquina.rs");
    assert!(
        !src.contains("Duration::from_"),
        "maquina.rs construye una `Duration` literal: los intervalos entran por `Politica` o por el puerto"
    );
}

#[test]
fn el_origen_de_la_senal_no_lleva_veredicto() {
    // IMPORTA PORQUE: los APIs del sistema entregan banderas «removed»/«created». Si
    // `OrigenDeSenal` tuviera donde ponerlas, «un evento nunca produce un reporte» seria
    // una regla que alguien respeta en vez de algo que no se puede escribir.
    // La afirmacion dura es el `const _: () = assert!(size_of == 1)` de `maquina.rs`;
    // esto verifica que el guardian siga ahi.
    let src = fuente("maquina.rs");
    assert!(
        src.contains("assert!(core::mem::size_of::<OrigenDeSenal>() == 1)"),
        "falta el assert de compilacion que fija `OrigenDeSenal` sin payload"
    );
}
