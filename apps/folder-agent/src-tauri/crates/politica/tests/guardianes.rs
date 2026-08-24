//! Las copias que le tocan a `salvaguardas.rs` de los dos guardianes de
//! `tests/guardianes.rs` (crate unico, pre-corte) que verificaban una propiedad por
//! archivo sobre varios archivos a la vez — partidos en copias porque sus archivos
//! cayeron en crates distintas y no hay conocimiento cruzado que compartir. Ver
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
    let src = fuente("salvaguardas.rs");
    for prohibido in PROHIBIDOS {
        assert!(
            !src.contains(prohibido),
            "salvaguardas.rs usa `{prohibido}`: el mundo entra por puerto, no por llamada"
        );
    }
    assert!(
        src.contains("#![forbid(unsafe_code)]"),
        "salvaguardas.rs tiene que declarar `#![forbid(unsafe_code)]`"
    );
}

#[test]
fn ningun_numero_inventado_en_los_modulos_de_decision() {
    // IMPORTA PORQUE: es la regla del monorepo —«si un numero decide comportamiento vive
    // en PARAMETERS con unidad, que decide y como se mediria»—. Un `Duration::from_secs`
    // suelto en las salvaguardas seria un intervalo elegido a ojo con cara de constante.
    let src = fuente("salvaguardas.rs");
    assert!(
        !src.contains("Duration::from_"),
        "salvaguardas.rs construye una `Duration` literal: los intervalos entran por `Politica` o por el puerto"
    );
}
