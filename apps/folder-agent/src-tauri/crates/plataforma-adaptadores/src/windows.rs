//! Windows. Firma completa, cuerpo en `unimplemented!()`.
//!
//! **Y HAY QUE DECIR EXACTAMENTE QUE ES LO QUE ESTA ACREDITADO.** `#[cfg(windows)]` no
//! se compila en un Mac, asi que «tiene la firma correcta» seria una afirmacion que
//! nadie verifico. Ya no lo es: el target `x86_64-pc-windows-msvc` esta instalado y
//! `cargo check --target x86_64-pc-windows-msvc` compila limpio.
//!
//! Eso acredita LA FIRMA, y nada mas. Los cuerpos siguen en `unimplemented!()`, asi que
//! lo que el cross-check compra es que esto no se descubra roto POR NO COMPILAR el dia
//! que alguien tenga un Windows — que por el diseno de este agente es el dia en que la
//! mitad de los usuarios lo instala. Que ademas HAGA algo es trabajo pendiente.
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

use savia_folder_contrato::dominio::{HashAfirmado, Instante, Observacion, RutaRelativa};
use savia_folder_contrato::plataforma::{
    CursorDurable, ErrorDePlataforma, EvidenciaDeRaiz, FalloDeEnumeracion, FalloDeLectura, Ficha,
    HuellaDeRaiz, MotivoDeBarrido, PlanDeArranque, Plataforma, PoliticaDeDeshidratacion,
    RaizRegistrada,
};
use std::path::Path;
use std::time::Duration;

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
