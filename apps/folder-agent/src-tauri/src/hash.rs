//! El hash de los bytes. Es lo unico de este crate que NO decide nada: el borrador ya
//! lo dice —«hashear no es decidir: es una funcion deterministica sin politica adentro,
//! del mismo orden que leer el tamano»—.
//!
//! Tiene que coincidir BIT A BIT con el `createHash("sha256")` de Node que usa
//! `sim/server.ts`, porque de esa coincidencia depende el dedupe previo a la
//! transferencia. Si difiriera, el sintoma seria «todo sale `upload`», que se parece a
//! un problema del servidor y no a lo que es.

use crate::dominio::HashAfirmado;
use sha2::{Digest, Sha256};

pub fn sha256(bytes: &[u8]) -> HashAfirmado {
    let mut h = Sha256::new();
    h.update(bytes);
    HashAfirmado::de_bytes(h.finalize().into())
}

/// Por bloques, para no traerse a memoria un `.pptx` de 200 MB solo para hashearlo.
pub struct Sha256Incremental(Sha256);

impl Sha256Incremental {
    pub fn nuevo() -> Self {
        Self(Sha256::new())
    }
    pub fn agregar(&mut self, bytes: &[u8]) {
        self.0.update(bytes);
    }
    pub fn terminar(self) -> HashAfirmado {
        HashAfirmado::de_bytes(self.0.finalize().into())
    }
}
