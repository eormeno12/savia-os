//! El vocabulario compartido del protocolo de subida directa: las identidades del
//! barrido y del permiso prefirmado, y la respuesta ya apareada de `presence.observed`
//! (`Veredicto`/`Decision`). La logica de las dos colas —Hechos y Bytes, su orden, su
//! compactacion por segmento— vive en `savia-folder-estado`; este archivo es solo lo
//! que los dos lados de esa frontera necesitan nombrar igual.

use crate::dominio::{HashAfirmado, HashVerificado, RutaRelativa};

// ═══════════════════════════════ Identidades ════════════════════════════════

#[derive(serde::Serialize, serde::Deserialize, Clone, PartialEq, Eq, Debug)]
pub struct SweepId(pub String);

#[derive(serde::Serialize, serde::Deserialize, Clone, PartialEq, Eq, Debug)]
pub struct PermisoId(pub String);

// ═══════════════════════════ El permiso prefirmado ══════════════════════════

#[derive(serde::Serialize, serde::Deserialize, Clone, PartialEq, Eq, Debug)]
pub struct RangoDeTamano {
    pub minimo: u64,
    pub maximo: u64,
}

impl RangoDeTamano {
    pub fn admite(&self, bytes: u64) -> bool {
        bytes >= self.minimo && bytes <= self.maximo
    }
}

#[derive(serde::Serialize, serde::Deserialize, Clone, PartialEq, Eq, Debug)]
pub struct Permiso {
    pub id: PermisoId,
    pub destino: String,
    /// El `content-length-range`. **El agente NO lo valida como politica**: el tope es
    /// la unica palanca preventiva que la subida directa deja en pie y la aplica el
    /// almacen. Se comprueba antes del PUT solo para no gastar el ancho de banda del
    /// usuario en un envio que va a ser rechazado.
    pub rango: RangoDeTamano,
}

/// La respuesta de `presence.observed`, ya APAREADA con la entrada que la produjo. La
/// respuesta del servidor echa `path` y no `hash`, asi que el afirmado —necesario para
/// promover un `known`— solo esta del lado del pedido.
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct Veredicto {
    pub ruta: RutaRelativa,
    pub afirmado: HashAfirmado,
    pub decision: Decision,
}

#[derive(Clone, PartialEq, Eq, Debug)]
pub enum Decision {
    /// Cero bytes se transfieren. Y la promocion a verificado es legitima: una
    /// coincidencia solo puede direccionar un objeto que ese lado YA escribio y YA
    /// verifico, asi que la propia respuesta es la verificacion.
    Known {
        verificado: HashVerificado,
    },
    Upload {
        permiso: Permiso,
    },
}
