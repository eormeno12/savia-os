//! LAS CINCO SALVAGUARDAS SON SEIS VARIANTES, Y ESA ARITMETICA ES EL DISENO.
//!
//! La #1 se parte en asentamiento (agente, sujeto = un archivo, dispara con una
//! APARICION) y cuarentena (Savia, sujeto = una raiz, dispara con una DESAPARICION).
//! Se trataban como un numero porque las dos son «esperar un poco», y esperan cosas que
//! no se parecen. La particion no es un parrafo: es `lado()`, un `match` exhaustivo, asi
//! que **una salvaguarda nueva no compila hasta que alguien diga de que lado cae**.
//!
//! EL MODULO ES PURO. No lee el disco, no llama al reloj, no abre la red: la
//! enumeracion, la hidratacion, la identidad y el instante entran por parametro — la
//! misma disciplina con la que `sha256` y `targetSizeChars` entran a `packages/ir`.
//!
//! DOS FORMAS CARGAN CASI TODO EL PESO:
//!
//!  · `Desaparicion` TIENE LOS CAMPOS PRIVADOS y no hay constructor publico. El unico
//!    camino que produce una es `puerta_de_baja`, que recibe el `EstadoDeRaiz` por
//!    parametro. Con eso, «si la raiz no esta viva no se reporta ni una baja» deja de
//!    ser una frase de un documento y pasa a ser un tipo que no se puede escribir — el
//!    mismo criterio que `ir` usa con `NODE_BRAND`: hacer la contradiccion
//!    INEXPRESABLE, no detectable.
//!
//!  · `presencia()` devuelve un enum que **NO TIENE VARIANTE `Ausente`**. La
//!    deshidratacion es incapaz, POR TIPO, de producir una baja.
#![forbid(unsafe_code)]

use savia_folder_contrato::dominio::{HashVerificado, Instante, Observacion, RutaRelativa};
use savia_folder_contrato::plataforma::{
    Coincidencia, EvidenciaDeRaiz, FalloDeEnumeracion, Hidratacion, HuellaDeRaiz, RaizRegistrada,
    ResultadoDeEnumeracion,
};
use savia_folder_contrato::salvaguardas::Candidato;
use std::collections::BTreeMap;
use std::time::Duration;

// ══════════════════════════════ La particion ════════════════════════════════

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Salvaguarda {
    Asentamiento,            // 1a · agente
    Cuarentena,              // 1b · SAVIA — sin evaluador aca
    RaizViva,                // 2  · agente
    CortePorVolumen,         // 3  · SAVIA — sin evaluador aca
    CorrelacionPorContenido, // 4  · agente
    DeshidratadoNoEsAusente, // 5  · agente
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Lado {
    Agente,
    Savia,
}

/// El asentamiento mira UN archivo; la cuarentena mira UNA raiz. Confundir los sujetos
/// es lo que las hacia parecer un solo numero.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Sujeto {
    Archivo,
    Raiz,
}

/// La linea entera: el asentamiento gobierna las altas, la cuarentena las bajas.
/// **Nunca se aplican al mismo evento.**
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Disparo {
    Aparicion,
    Desaparicion,
    Barrido,
}

pub const fn lado(s: Salvaguarda) -> Lado {
    match s {
        Salvaguarda::Asentamiento => Lado::Agente,
        Salvaguarda::Cuarentena => Lado::Savia,
        Salvaguarda::RaizViva => Lado::Agente,
        Salvaguarda::CortePorVolumen => Lado::Savia,
        Salvaguarda::CorrelacionPorContenido => Lado::Agente,
        Salvaguarda::DeshidratadoNoEsAusente => Lado::Agente,
    }
}

pub const fn sujeto(s: Salvaguarda) -> Sujeto {
    match s {
        Salvaguarda::Asentamiento => Sujeto::Archivo,
        Salvaguarda::Cuarentena => Sujeto::Raiz,
        Salvaguarda::RaizViva => Sujeto::Raiz,
        Salvaguarda::CortePorVolumen => Sujeto::Raiz,
        Salvaguarda::CorrelacionPorContenido => Sujeto::Archivo,
        Salvaguarda::DeshidratadoNoEsAusente => Sujeto::Archivo,
    }
}

pub const fn dispara_con(s: Salvaguarda) -> Disparo {
    match s {
        Salvaguarda::Asentamiento => Disparo::Aparicion,
        Salvaguarda::Cuarentena => Disparo::Desaparicion,
        Salvaguarda::RaizViva => Disparo::Barrido,
        Salvaguarda::CortePorVolumen => Disparo::Desaparicion,
        Salvaguarda::CorrelacionPorContenido => Disparo::Desaparicion,
        Salvaguarda::DeshidratadoNoEsAusente => Disparo::Aparicion,
    }
}

/// Las que este modulo evalua.
pub const IMPLEMENTADAS: [Salvaguarda; 4] = [
    Salvaguarda::Asentamiento,
    Salvaguarda::RaizViva,
    Salvaguarda::CorrelacionPorContenido,
    Salvaguarda::DeshidratadoNoEsAusente,
];

/// Las que este modulo NOMBRA y no evalua. **No hay una sola funcion que las tome**, y
/// esa ausencia es la mitad de «el agente no toma una sola decision de politica».
pub const DELEGADAS_A_SAVIA: [Salvaguarda; 2] =
    [Salvaguarda::Cuarentena, Salvaguarda::CortePorVolumen];

// ══════════════════ 5 · Deshidratado != ausente (agente) ════════════════════

/// Lo unico que la salvaguarda 5 puede concluir. **Sin variante `Ausente`.**
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Presencia {
    PresenteYLegible,
    PresentePeroNoSeAbre,
}

/// `Desconocida` se resuelve como `PresentePeroNoSeAbre`, **nunca al reves**. El costo
/// de equivocarse hacia aca es que un archivo espere; el costo del otro lado es bajarle
/// al usuario el drive de nube entero. Es el unico modo de falla del nucleo que le
/// cuesta plata al usuario.
pub const fn presencia(h: Hidratacion) -> Presencia {
    match h {
        Hidratacion::Materializado => Presencia::PresenteYLegible,
        Hidratacion::Deshidratado => Presencia::PresentePeroNoSeAbre,
        Hidratacion::Desconocida => Presencia::PresentePeroNoSeAbre,
    }
}

/// `true` SOLO con `Materializado`. Se consulta ANTES de abrir; preguntarlo despues no
/// es tarde, es haber descargado el drive.
pub const fn se_puede_abrir(h: Hidratacion) -> bool {
    matches!(presencia(h), Presencia::PresenteYLegible)
}

// ══════════════════════ 1a · Asentamiento (agente) ══════════════════════════

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Asentamiento {
    /// Cambio respecto de la ultima mirada, o es la primera: se reinicia el reloj. Aca
    /// NO se hashea — hashear bytes a medio escribir produce el hash de una version que
    /// nunca existio, y despues `upload.completed` devuelve un verificado distinto: se
    /// FABRICA la divergencia que el lazo cerrado existe para reparar.
    Inestable {
        candidato: Candidato,
        /// Cuando volver. La segunda mitad es tan load-bearing como la primera: sin
        /// decir cuando, un archivo guardado UNA vez y nunca mas tocado no genera otro
        /// evento y queda invisible hasta el proximo barrido completo.
        reintentar_en: Duration,
    },
    /// La misma tripleta lleva el intervalo entero sin cambiar. Recien ahora vale leer.
    Asentado,
}

/// SIN `Default` Y SIN CONSTRUCTOR VACIO a proposito: `None` no puede convertirse en
/// comportamiento por descuido. Quien lo necesita lo provee, y el tipo lo obliga.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Politica {
    asentamiento: Duration,
}

impl Politica {
    /// Devuelve `None` para `Duration::ZERO`, y no es celo: **un asentamiento de cero no
    /// es un asentamiento**, es la ausencia de la salvaguarda con nombre de salvaguarda.
    /// Ademas es lo que hace estructuralmente cierto que `reintentar_en > 0` — sin esto
    /// habria que inventar un minimo, que seria un numero mas sin medir.
    pub fn con_asentamiento(asentamiento: Duration) -> Option<Self> {
        if asentamiento.is_zero() {
            return None;
        }
        Some(Self { asentamiento })
    }
    pub fn asentamiento(&self) -> Duration {
        self.asentamiento
    }
}

/// `candidato == None` es la primera mirada: **NUNCA asienta**, por temprana que sea.
/// Hacen falta dos observaciones con la misma tripleta separadas por el intervalo.
pub fn asentar(
    candidato: Option<&Candidato>,
    observacion: &Observacion,
    ahora: Instante,
    granularidad: Duration,
    politica: &Politica,
) -> Asentamiento {
    match candidato {
        Some(c) if la_misma_mirada(&c.observacion, observacion, granularidad) => {
            let llevado = ahora.transcurrido_desde(c.estable_desde);
            if llevado >= politica.asentamiento() {
                Asentamiento::Asentado
            } else {
                Asentamiento::Inestable {
                    candidato: *c,
                    reintentar_en: politica.asentamiento() - llevado,
                }
            }
        }
        _ => Asentamiento::Inestable {
            candidato: Candidato {
                observacion: *observacion,
                estable_desde: ahora,
            },
            reintentar_en: politica.asentamiento(),
        },
    }
}

/// LA COMPARACION DEL ASENTAMIENTO, Y ES OTRA QUE LA DE IDENTIDAD A PROPOSITO.
///
/// `misma_observacion` contesta **«¿es el mismo archivo?»** —una fila del inventario
/// contra lo que hay en disco, o una ruta contra otra— y ahi un id desconocido tiene que
/// dar DISTINTO: el costo de equivocarse es un hash, y el del default opuesto es empatar
/// dos archivos que no tienen nada que ver.
///
/// Aca la pregunta es otra: **«¿estos bytes dejaron de cambiar?»**, sobre LA MISMA RUTA
/// mirada dos veces seguidas. Con la regla de identidad, un volumen que no publica ids
/// —`Observacion.id_de_archivo` dice «`None` cuando el volumen no publica ninguno
/// (unidades de red)»— nunca ve dos miradas iguales: el candidato se acuna de nuevo en
/// cada vuelta, el archivo **no asienta jamas**, no se hashea, no entra al inventario y
/// no produce un solo hecho. Eso no es «paga la E/S de un hash»: es silencio, sin nada en
/// el panel que lo diga, y desmiente la unica limitacion que `raiz_viva` reconoce
/// —«sobre SMB o NFS el canal queda de solo-altas»—, porque no queda de solo-altas: queda
/// de nada.
///
/// Asi que el id **desempata cuando los dos lados lo tienen** y no es un requisito: dos
/// `None` no distinguen nada, y lo que queda —tamano y `mtime`— es toda la evidencia que
/// ese volumen entrega. Un lado con id y el otro sin cuenta como cambio: el volumen
/// cambio de opinion sobre lo que puede decir de este archivo, y se vuelve a esperar.
pub fn la_misma_mirada(a: &Observacion, b: &Observacion, granularidad: Duration) -> bool {
    if a.tamano != b.tamano {
        return false;
    }
    match (a.id_de_archivo, b.id_de_archivo) {
        (Some(x), Some(y)) if x != y => return false,
        (Some(_), None) | (None, Some(_)) => return false,
        _ => {}
    }
    a.mtime.distancia(b.mtime) <= granularidad
}

// ══════════════════════ 2 · La raiz viva (agente) ═══════════════════════════

#[derive(Clone, Debug)]
pub enum EstadoDeRaiz {
    /// Enumerable Y verificada la misma que al enrolar. **El UNICO estado en el que una
    /// baja puede viajar.**
    Viva,
    /// No es un error: es desconexion. Decirlo asi es lo que impide que el usuario crea
    /// que perdio algo.
    Ausente(PorQueAusente),
}

#[derive(Clone, Debug)]
pub enum PorQueAusente {
    NoSePudoEnumerar(FalloDeEnumeracion),
    /// EL CASO PEOR: el path existe y se enumera, pero es OTRA raiz. El volumen no monto
    /// y quedo, en el mismo path, un directorio vacio haciendo de suplente. Un `stat`
    /// da exito, la enumeracion da cero archivos, y sin esta variante todo el corpus se
    /// reporta ausente con la raiz «viva».
    Suplente,
    /// No se pudo leer la identidad, asi que no se puede AFIRMAR que sea la misma.
    /// **Ausencia de evidencia no es evidencia: falla cerrado.**
    IdentidadIlegible,
}

/// Devuelve `Viva` SOLO si la enumeracion funciono Y las dos identidades estan Y
/// coinciden con lo registrado al enrolar.
///
/// Una enumeracion con CERO entradas no es `Ausente`: vaciar una carpeta es legitimo, y
/// el caso masivo lo separa el corte por volumen, que es de Savia. Al suplente lo
/// atrapa la identidad, nunca el conteo.
pub fn raiz_viva(registrada: &RaizRegistrada, hoy: &EvidenciaDeRaiz) -> EstadoDeRaiz {
    if let ResultadoDeEnumeracion::Fallo(f) = &hoy.enumeracion {
        return EstadoDeRaiz::Ausente(PorQueAusente::NoSePudoEnumerar(*f));
    }
    let (Some(vol), Some(dir)) = (hoy.volumen.clone(), hoy.directorio) else {
        return EstadoDeRaiz::Ausente(PorQueAusente::IdentidadIlegible);
    };
    let encontrada = HuellaDeRaiz {
        volumen: vol,
        directorio: dir,
    };
    match registrada.huella.coincide_con(&encontrada) {
        Coincidencia::Coincide => EstadoDeRaiz::Viva,
        Coincidencia::NoCoincide => EstadoDeRaiz::Ausente(PorQueAusente::Suplente),
        // NUNCA `Viva`. Si el volumen no publica identidad, la raiz no puede pasar de
        // indeterminada a viva y por lo tanto no reporta una baja jamas. Eso es seguro,
        // y tambien es una limitacion real: sobre SMB o NFS el canal queda de solo-altas.
        Coincidencia::Indeterminada => EstadoDeRaiz::Ausente(PorQueAusente::IdentidadIlegible),
    }
}

impl EstadoDeRaiz {
    /// **EL UNICO punto donde se decide si esta raiz puede producir bajas.** Es un
    /// metodo y no un `if` en cada sitio por la misma razon que a los retirados los
    /// filtra un punto y no tres (decision 8): tres sitios son tres oportunidades de
    /// olvidarse, y el que se olvide reporta un borrado masivo inventado.
    pub fn permite_reportar_bajas(&self) -> bool {
        matches!(self, EstadoDeRaiz::Viva)
    }
}

/// Lo que el barrido consulta para decidir si cierra `completo`. Si la raiz murio en
/// medio del recorrido, el barrido NO puede cerrar completo: un barrido completo es la
/// evidencia que la cuarentena de Savia consume para vencer, y darsela sobre un
/// recorrido parcial es fabricar evidencia sobre la unica pregunta que hace.
pub fn puede_cerrar_completo(e: &EstadoDeRaiz) -> bool {
    e.permite_reportar_bajas()
}

// ══════════════ 4 · Correlacion por contenido (agente) ══════════════════════

/// El indice de contenido del barrido EN CURSO, por raiz. No es un cache: se arma
/// durante el recorrido y muere con el.
///
/// **INDEXA SOLO RUTAS NUEVAS DE ESTE BARRIDO, Y ESA RESTRICCION ES LA SALVAGUARDA.**
/// Es un refinamiento sobre la letra del borrador, que dice «un hash que reaparece en
/// cualquier punto del arbol». Tomado literal, borrar UNA de dos copias identicas nunca
/// produce una baja —la otra copia tiene el hash— y el documento en esa ruta queda
/// vigente para siempre, apuntando a un archivo que ya no existe. Un movimiento SIEMPRE
/// estrena ruta; una copia preexistente, no. O sea: *reaparecer* es aparecer donde antes
/// no estaba, y eso es el espiritu de la regla, no una excepcion a ella.
///
/// **La correlacion es POR RAIZ**, y sale de que `documento.watched = {root, path}` y de
/// que las salvaguardas son por raiz. Mover un archivo entre dos raices vigiladas es una
/// baja real en una y un alta real en la otra.
#[derive(Default, Debug)]
pub struct IndiceDeContenido {
    por_contenido: BTreeMap<[u8; 32], Vec<RutaRelativa>>,
}

impl IndiceDeContenido {
    pub fn nuevo() -> Self {
        Self::default()
    }

    /// El llamador anota SOLO rutas que ESTRENARON contenido en este barrido —las que
    /// `inventario::estrena_contenido` acepta: fila nueva, fila que solo tenia candidato,
    /// o lapida—. **Una edicion en el lugar no entra**, y no es un detalle: si entrara,
    /// el cierre correlacionaria la baja de otro archivo contra una ruta que no estreno
    /// nada, la leeria como movimiento, y en vez de emitir la baja ejecutaria
    /// `OlvidarRuta` sobre la fila del que si se borro. La baja no se retiene: se
    /// destruye con la fila, y ningun barrido posterior la puede recuperar.
    ///
    /// El nombre lo dice para que no haya que recordarlo, y el llamador lo verifica
    /// contra el inventario ANTES de decidir, no despues.
    pub fn anotar_ruta_nueva(&mut self, ruta: RutaRelativa, contenido: [u8; 32]) {
        let destinos = self.por_contenido.entry(contenido).or_default();
        if !destinos.contains(&ruta) {
            destinos.push(ruta);
        }
        // Orden canonico de `RutaRelativa`, **no orden de `readdir`**: una baja no puede
        // depender de en que orden el sistema devolvio los archivos.
        destinos.sort();
    }

    pub fn destinos(&self, contenido: &[u8; 32]) -> &[RutaRelativa] {
        self.por_contenido
            .get(contenido)
            .map(|v| v.as_slice())
            .unwrap_or(&[])
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Correlacion {
    /// El contenido reaparecio en una ruta nueva del arbol: es un MOVIMIENTO y muere
    /// aca. Cero llamadas, cero bytes.
    Movimiento {
        a: RutaRelativa,
    },
    NoReaparece,
}

pub fn correlacionar(
    indice: &IndiceDeContenido,
    contenido: &[u8; 32],
    excepto: &RutaRelativa,
) -> Correlacion {
    match indice
        .destinos(contenido)
        .iter()
        .find(|r| *r != excepto)
        .cloned()
    {
        Some(a) => Correlacion::Movimiento { a },
        None => Correlacion::NoReaparece,
    }
}

// ══════════════════════════ Los dos hechos ══════════════════════════════════

/// Lo unico que puede entrar a la cola de hechos. El vocabulario es cerrado: aparecio ·
/// desaparecio. No hay un tercer verbo, y no puede haberlo — «se edito» y «se movio»
/// son conclusiones, y las saca Savia.
#[derive(serde::Serialize, serde::Deserialize, Clone, PartialEq, Eq, Debug)]
pub enum Hecho {
    Aparecio(Aparicion),
    Desaparecio(Desaparicion),
}

#[derive(serde::Serialize, serde::Deserialize, Clone, PartialEq, Eq, Debug)]
pub struct Aparicion {
    ruta: RutaRelativa,
    hash: savia_folder_contrato::dominio::HashAfirmado,
}

/// **CAMPOS PRIVADOS, Y ES LA MITAD DEL DISENO.** No hay constructor publico: el unico
/// camino a una `Desaparicion` es `puerta_de_baja`, que recibe el `EstadoDeRaiz`. Con
/// campos publicos, «si la raiz no esta viva no se reporta ni una baja» seria una
/// convencion, y cualquier camino nuevo —un reintento de la cola muerta, el replay del
/// cursor durable de macOS, un handler de eventos apurado— podria emitir una baja sin
/// pasar por la puerta. El bug no se ve hasta que un disco se desmonta.
#[derive(serde::Serialize, serde::Deserialize, Clone, PartialEq, Eq, Debug)]
pub struct Desaparicion {
    ruta: RutaRelativa,
    ultimo_hash: HashVerificado,
}

impl Aparicion {
    /// Un alta no tiene puerta porque no tiene nada que proteger: reportar de mas un
    /// alta cuesta un hash y un `known`. Es la asimetria del canal, escrita en la forma.
    pub fn nueva(ruta: RutaRelativa, hash: savia_folder_contrato::dominio::HashAfirmado) -> Self {
        Self { ruta, hash }
    }
    pub fn ruta(&self) -> &RutaRelativa {
        &self.ruta
    }
    pub fn hash(&self) -> &savia_folder_contrato::dominio::HashAfirmado {
        &self.hash
    }
}

impl Desaparicion {
    pub fn ruta(&self) -> &RutaRelativa {
        &self.ruta
    }
    /// Es `lastSeenByteHash` del protocolo: sin el, «desaparecio tal cosa» no se puede
    /// mapear a ningun documento.
    pub fn ultimo_hash(&self) -> &HashVerificado {
        &self.ultimo_hash
    }
}

/// Por que se retuvo una baja que no salio. Para el panel y para el diagnostico — nunca
/// para el servidor.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum PorQueNoSeReporta {
    RaizAusente,
    EsMovimiento {
        a: RutaRelativa,
    },
    /// La #5 llegando hasta el final del recorrido: solo en linea no es ausente.
    Deshidratado,
    /// Savia nunca confirmo un hash para esta ruta, asi que no tiene documento que
    /// retirar. Mandarla inflaria el numerador del corte por volumen con archivos que
    /// del otro lado no existen y congelaria una raiz sin causa.
    SinHashConfirmado,
}

/// **LA PUERTA.** Es la unica funcion del crate que construye una `Desaparicion`, y
/// recibe el `EstadoDeRaiz` por parametro justamente para que no exista forma de pedir
/// una baja sin haber contestado antes si la raiz esta viva.
///
/// Devuelve `Err` con el motivo en vez de `None` porque el panel tiene que poder decir
/// «reconecta el disco» y no «no pasa nada».
pub fn puerta_de_baja(
    raiz: &EstadoDeRaiz,
    ruta: RutaRelativa,
    ultimo_hash: Option<HashVerificado>,
) -> Result<Desaparicion, PorQueNoSeReporta> {
    if !raiz.permite_reportar_bajas() {
        return Err(PorQueNoSeReporta::RaizAusente);
    }
    match ultimo_hash {
        Some(h) => Ok(Desaparicion {
            ruta,
            ultimo_hash: h,
        }),
        None => Err(PorQueNoSeReporta::SinHashConfirmado),
    }
}
