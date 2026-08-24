//! Los guardianes de `tests/guardianes.rs` (crate unico, pre-corte) que tocan un solo
//! archivo y ese archivo cae entero en `aplicacion` (`ciclo.rs`). Movidos tal cual, sin
//! tocar el cuerpo — ver docs/product/savia-b2b/plan-rediseno-agente.md §2.

use std::path::PathBuf;

fn fuente(rel: &str) -> String {
    let p = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("src")
        .join(rel);
    std::fs::read_to_string(&p).unwrap_or_else(|e| panic!("no se pudo leer {}: {e}", p.display()))
}

/// Quita los comentarios de linea. Un guardian que busca sintaxis no se puede disparar
/// con una prosa que la menciona.
fn sin_comentarios(src: &str) -> String {
    src.lines()
        .map(|l| match l.find("//") {
            Some(i) => &l[..i],
            None => l,
        })
        .collect::<Vec<_>>()
        .join("\n")
}

#[test]
fn el_resumen_del_barrido_cuenta_los_diez_nodos() {
    // IMPORTA PORQUE: el doc de `Nodo` dice que la rama va en la salida «porque es lo que
    // el panel muestra por raiz». Durante toda la vida del crate el resumen conto SEIS de
    // diez y las otras cuatro caian en una rama comodin — entre ellas `RaizAusente`, que
    // es la salvaguarda disparandose («se desmonto el disco y no reporte ni una baja»), y
    // `BajaNoReportable`, que OLVIDA una fila. Las dos terminaban sin dejar rastro.
    //
    // La rama comodin es lo que lo hizo posible y lo que lo volveria a hacer posible: con
    // ella, una variante nueva de `Nodo` entra al arbol y desaparece del panel en
    // silencio.
    const NODOS: [&str; 10] = [
        "Aparecio",
        "Desaparecio",
        "Omitido",
        "Esperando",
        "Movimiento",
        "Indeterminado",
        "SinCambio",
        "RaizAusente",
        "BajaNoReportable",
        "AgendaBarrido",
    ];
    let src = sin_comentarios(&fuente("ciclo.rs"));
    let i = src
        .find("match &paso.nodo {")
        .expect("falta el match que arma el resumen");
    let j = src[i..].find("\n        }").expect("match sin cerrar") + i;
    let cuerpo = &src[i..j];

    assert!(
        !cuerpo.contains("_ =>"),
        "el match del resumen gano una rama comodin: una variante nueva de `Nodo` se volveria a caer del panel sin que nada avise"
    );
    for n in NODOS {
        assert!(
            cuerpo.contains(&format!("Nodo::{n}")),
            "`Nodo::{n}` no se cuenta en el resumen del barrido"
        );
    }
}

#[test]
fn el_cierre_no_tira_su_propio_diagnostico() {
    // IMPORTA PORQUE: `Cierre::retenidas` lleva el motivo por el que cada ausencia NO
    // salio, y su propio doc dice «para el panel, nunca para el servidor». No lo leia
    // NADIE —ni `ciclo`, ni `almacen`, ni un test—: el cierre calculaba el diagnostico y
    // el resumen lo tiraba en la misma linea en que consumia el `Cierre`.
    //
    // Es el caso mas caro de todos: no es que falte informacion, es que existe, cuesta
    // calcularla, y se descarta.
    const MOTIVOS: [&str; 4] = [
        "RaizAusente",
        "EsMovimiento",
        "SinHashConfirmado",
        "Deshidratado",
    ];
    let src = sin_comentarios(&fuente("ciclo.rs"));
    assert!(
        src.contains("cierre.retenidas"),
        "`ciclo` volvio a consumir el `Cierre` sin leer `retenidas`"
    );
    for m in MOTIVOS {
        assert!(
            src.contains(&format!("PorQueNoSeReporta::{m}")),
            "el motivo `{m}` no llega al resumen"
        );
    }
}
