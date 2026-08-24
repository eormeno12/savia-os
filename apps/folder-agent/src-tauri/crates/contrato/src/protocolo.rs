use crate::colas::SweepId;
use crate::dominio::{HashVerificado, RutaRelativa};
use std::time::Duration;

/// Lo que vuelve de `sweep.open`: el id, y **si el servidor quiere el padron**.
pub struct BarridoAbierto {
    pub sweep_id: SweepId,
    pub padron_requerido: bool,
}

/// Lo que vuelve de `sweep.close`, y son DOS COSAS que no se pueden separar: lo que Savia
/// retiro, y **como quedo la raiz**. Congelar no es un error ni un retiro — es que el
/// corte por volumen se disparo y Savia esta RETENIENDO bajas hasta tener mas evidencia.
/// Devolver solo `retirados` deja al panel sin con que distinguir «no habia nada que
/// retirar» de «habia demasiado y no lo toque», que son la misma lista vacia.
#[derive(Clone, Debug)]
pub struct CierreAplicado {
    pub retirados: Vec<RutaRelativa>,
    pub congelada: bool,
}

/// El caso «sin auth» se NOMBRA en vez de ser un `Option` que alguien se olvido de
/// llenar. Los dos caminos estan ejercidos: el simulador exige `Authorization: Bearer`
/// en las siete llamadas del protocolo y contesta `401` sin el, y el banco acredita que
/// un token revocado detiene el dispositivo entero.
#[derive(Clone, Debug)]
pub enum Credencial {
    SinAutenticar,
    TokenDeDispositivo(Secreto),
}

/// `Debug` a mano y redactado: un token de dispositivo en un log de escritorio es un
/// token de dispositivo en un reporte de soporte.
#[derive(Clone)]
pub struct Secreto(pub String);

impl std::fmt::Debug for Secreto {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Secreto(<redactado>)")
    }
}

/// Una vinculacion EN CURSO: el agente ya se anuncio y todavia no lo aprobo nadie.
///
/// `codigo` es `String` y no `Secreto` A PROPOSITO, y es la unica cosa de este archivo
/// que se imprime entera: la interfaz TIENE que mostrarlo, porque su trabajo es que un
/// humano lo compare contra lo que ve en su cuenta. Un codigo redactado no vincula nada.
/// El `id`, en cambio, no se muestra nunca — pero tampoco es secreto por si solo: sin la
/// aprobacion de la persona no reclama ningun token.
#[derive(Clone, Debug)]
pub struct Vinculacion {
    pub id: String,
    pub codigo: String,
    pub expira_en: Duration,
}

/// **`Pendiente` ES UN VALOR, NO UN ERROR.** Ver `Cliente::reclamar`.
///
/// `Denegado` y `Vencido` son distintos aunque los dos terminen la vinculacion, porque
/// al usuario se le dice cosas opuestas: uno es «alguien dijo que no» y el otro «te
/// tardaste, pedi otro codigo». Colapsarlos en un solo caso obliga a la interfaz a
/// inventar cual de los dos mostrar.
#[derive(Clone, Debug)]
pub enum Reclamo {
    Pendiente,
    Aprobado { token: Secreto, usuario: String },
    Denegado,
    Vencido,
}

/// La misma forma que R2 en el pipeline: aguas abajo se LEE `clase()` y **nunca se
/// ramifica sobre el codigo HTTP crudo**. La cola no debe saber que existe un 403.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Clase {
    Reintentable,
    Credenciales,
    ColaMuerta,
    /// Ni una ni otra: no se sabe si el efecto ocurrio.
    Ambiguo,
}

#[derive(Clone, Debug)]
pub struct Confirmacion {
    pub verificado: HashVerificado,
    pub divergio: bool,
}

#[derive(Clone, Debug)]
pub struct Cuarentena {
    pub en_cuarentena: u32,
    pub raiz_congelada: bool,
}
