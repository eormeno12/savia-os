//! Windows. Firma completa, cuerpo en `unimplemented!()`.
//!
//! **Y HAY QUE DECIR LO QUE ESTO NO ES.** `#[cfg(windows)]` no se compila en un Mac,
//! asi que «tiene la firma correcta» es una afirmacion que nadie verifico. El diseno de
//! `plataforma` proponia acreditarla con
//! `cargo check --target x86_64-pc-windows-msvc` como parte del lint; el target no esta
//! instalado en esta maquina, asi que **queda como paso pendiente y nombrado**, no como
//! algo hecho. Sin ese cross-check, esto se descubre roto el dia que alguien tenga un
//! Windows — que por el diseno de este agente es el dia en que la mitad de los usuarios
//! lo instala.
//!
//! Lo que si esta decidido y escrito, porque son las dos POLITICAS y no dos wrappers:
//!
//!  · `politica_de_deshidratacion` = `SeAbreSinHidratar`. `FILE_FLAG_OPEN_NO_RECALL`
//!    abre sin disparar la hidratacion, y `FILE_ATTRIBUTE_RECALL_ON_OPEN` viene en la
//!    enumeracion misma.
//!  · `plan_de_arranque` = `BarridoCompleto{LaPlataformaNoLoTiene}`, SIN mirar nada. No
//!    hay cursor durable para un proceso sin privilegios: `FSCTL_READ_USN_JOURNAL` pide
//!    administrador y abrir el volumen entero.
//!
//! EL RELOJ TIENE UN HALLAZGO CONTRA EL BORRADOR, y es de los que cambian codigo. El
//! borrador dice «`QueryUnbiasedInterruptTime` en Windows» como analogo de
//! `mach_continuous_time`. Pero *unbiased* significa que se le QUITO el sesgo de la
//! suspension: Microsoft documenta que el conteo no sesgado «does not include time the
//! system spends in sleep or hibernation», o sea que es el analogo de
//! `mach_absolute_time`, que es justo el que NO sirve. El par existe
//! (`QueryInterruptTimePrecise` / `QueryUnbiasedInterruptTimePrecise`) y **el requisito
//! manda sobre el nombre de la API**: va el que cumpla «avanza durante la suspension»,
//! y cual de los dos es hay que medirlo en un Windows real con el mismo procedimiento
//! que se uso en macOS —suspender, despertar, comparar contra el reloj de pared—. No se
//! puede hacer desde un Mac. Es un hallazgo contra el documento, no una decision.

use super::{
    CursorDurable, EvidenciaDeRaiz, FalloDeEnumeracion, FalloDeLectura, Ficha, HuellaDeRaiz,
    MotivoDeBarrido, PlanDeArranque, Plataforma, PoliticaDeDeshidratacion, RaizRegistrada,
};
use crate::dominio::{HashAfirmado, Instante, Observacion, RutaRelativa};
use std::path::Path;
use std::time::Duration;

#[derive(Debug)]
pub enum ErrorDePlataforma {
    RelojSinBase,
}

// LO MISMO QUE SU HERMANO DE macOS, y que faltara es el hallazgo que destapo el
// cross-check. Son DOS TIPOS DISTINTOS con el mismo nombre —uno por plataforma— asi que
// la simetria entre los dos brazos no la impone nada: el de macOS implementaba `Display`
// y `Error` y el de Windows era un enum pelado, y nadie podia notarlo porque este
// archivo NUNCA SE COMPILABA. Sin estos dos `impl`, `PlataformaLocal::nueva()?` no
// convierte a `Box<dyn Error>` y el binario no cruza.
impl std::fmt::Display for ErrorDePlataforma {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ErrorDePlataforma::RelojSinBase => f.write_str(
                "no se pudo tomar la base del reloj monotonico que avanza durante la suspension",
            ),
        }
    }
}

impl std::error::Error for ErrorDePlataforma {}

pub struct Windows {
    _privado: (),
}

impl Windows {
    pub fn nueva() -> Result<Self, ErrorDePlataforma> {
        Ok(Self { _privado: () })
    }
}

impl Plataforma for Windows {
    fn politica_de_deshidratacion(&self) -> PoliticaDeDeshidratacion {
        PoliticaDeDeshidratacion::SeAbreSinHidratar
    }

    fn plan_de_arranque(
        &self,
        _raiz: &RaizRegistrada,
        _cursor: Option<&CursorDurable>,
    ) -> PlanDeArranque {
        PlanDeArranque::BarridoCompleto {
            porque: MotivoDeBarrido::LaPlataformaNoLoTiene,
        }
    }

    fn huella_de_raiz(&self, _ruta: &Path) -> Result<HuellaDeRaiz, FalloDeEnumeracion> {
        unimplemented!("GetVolumeNameForVolumeMountPointW + FILE_ID_INFO")
    }

    fn evidencia_de_raiz(&self, _raiz: &RaizRegistrada) -> EvidenciaDeRaiz {
        unimplemented!("GetFileInformationByHandleEx(FileIdBothDirectoryInfo)")
    }

    fn ficha(&self, _raiz: &RaizRegistrada, _ruta: &RutaRelativa) -> Ficha {
        unimplemented!("GetFileInformationByHandleEx + FILE_ATTRIBUTE_RECALL_ON_OPEN")
    }

    fn hashear(
        &self,
        _raiz: &RaizRegistrada,
        _ruta: &RutaRelativa,
    ) -> Result<(HashAfirmado, Observacion), FalloDeLectura> {
        unimplemented!("CreateFileW con FILE_FLAG_OPEN_NO_RECALL")
    }

    fn leer_para_subir(
        &self,
        _raiz: &RaizRegistrada,
        _ruta: &RutaRelativa,
    ) -> Result<Vec<u8>, FalloDeLectura> {
        unimplemented!("CreateFileW con FILE_FLAG_OPEN_NO_RECALL")
    }

    fn granularidad_de_mtime(&self, _raiz: &RaizRegistrada) -> Duration {
        unimplemented!("sonda de truncamiento por volumen")
    }

    fn ahora(&self) -> Instante {
        unimplemented!("ver el hallazgo del encabezado: unbiased es el que NO sirve")
    }
}
