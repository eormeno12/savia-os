#![forbid(unsafe_code)]

use crate::dominio::{Instante, Observacion};
use std::time::Duration;

// ══════════════════════ 1a · Asentamiento (agente) ══════════════════════════

/// La observacion que TODAVIA NO SE REPORTO y cuyo intervalo esta corriendo.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub struct Candidato {
    pub observacion: Observacion,
    /// Cuando se vio ESTA tripleta por primera vez. **No es el `mtime`**: el `mtime` lo
    /// escribe quien escribe el archivo y puede venir del futuro o de una unidad con el
    /// reloj corrido. Este instante lo pone el agente al mirar.
    pub estable_desde: Instante,
}

/// La comparacion de la tripleta. Publica porque el banco le apunta directo.
///
/// `tamano ==` **Y** `id_de_archivo ==` **Y** `|Δmtime| <= granularidad`.
///
///  · El `mtime` por TOLERANCIA y no por igualdad: en FAT/exFAT (2 s) y en SMB
///    (truncado), la igualdad exacta hace ver TODO archivo cambiado en cada vuelta y se
///    rehashea el corpus entero, para siempre.
///  · El `id_de_archivo` es el TERCER TERMINO DE UN AND, nunca prueba de identidad por
///    si solo: el guardado atomico de Office borra y recrea con el mismo tamano y un
///    `fileId` nuevo, y sin ese termino la edicion se pierde en silencio.
///  · Desconocido en cualquiera de los dos lados ⇒ **distinto** ⇒ se vuelve a mirar. El
///    costo es un hash; el del default opuesto es una edicion perdida para siempre.
pub fn misma_observacion(a: &Observacion, b: &Observacion, granularidad: Duration) -> bool {
    if a.tamano != b.tamano {
        return false;
    }
    match (a.id_de_archivo, b.id_de_archivo) {
        (Some(x), Some(y)) if x == y => {}
        _ => return false,
    }
    a.mtime.distancia(b.mtime) <= granularidad
}
