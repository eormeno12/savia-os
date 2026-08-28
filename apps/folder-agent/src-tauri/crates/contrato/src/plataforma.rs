//! El vocabulario de lo que macOS y Windows NO comparten — datos, y el puerto.
//!
//! El borrador dice «no son wrappers sobre una abstraccion comun: en dos casos son
//! POLITICAS DISTINTAS», y el modulo lo toma al pie de la letra: en esos dos casos la
//! diferencia sale como **VALOR** (`PlanDeArranque`, `PoliticaDeDeshidratacion`) y no
//! como un metodo que una plataforma implementa y la otra no.
//!
//! La consecuencia buscada: el llamador es un `match` total, y **el brazo que en
//! produccion solo toma Windows lo toma macOS cada vez que su cursor no vale** — que es
//! lo que impide que ese camino este podrido el dia que alguien tenga un Windows.
//!
//! ESTE MODULO NO SABE QUE ES UN `sweep`, NI UNA COLA, NI UN INVENTARIO. Le entra un
//! `&RaizId` mas una ruta relativa y le salen valores. Es la capa de abajo.
//!
//! **Las implementaciones reales (`Macos`, `Windows`) viven en
//! `savia-folder-plataforma-adaptadores`; el doble de prueba (`Falsa`) en
//! `savia-folder-plataforma-falsa`.** Este archivo es solo el vocabulario y el trait —
//! ninguna de las dos crates de implementacion aparece nombrada aca, y esa ausencia es
//! la que el grafo de Cargo impone en vez de un guardian de texto.

use crate::dominio::{HashAfirmado, IdDeArchivoDelSO, Instante, Observacion, RaizId, RutaRelativa};
use std::path::PathBuf;
use std::time::Duration;

// ─────────────────────── POLITICA 1 · la deshidratacion ─────────────────────

/// La primera de las dos politicas, y es donde el error es mas caro.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum PoliticaDeDeshidratacion {
    /// Windows: `FILE_FLAG_OPEN_NO_RECALL` abre sin disparar la hidratacion, y
    /// `FILE_ATTRIBUTE_RECALL_ON_OPEN` viene en la enumeracion misma. Detectar y abrir
    /// cuestan cero syscalls extra.
    SeAbreSinHidratar,
    /// macOS: se detecta por `SF_DATALESS` en `st_flags`, que tambien viene del `stat`,
    /// pero **no hay forma de leer sin materializar**. La diferencia real entre las dos
    /// plataformas no esta en detectar: esta en que aca el `open()` es el que hace el
    /// dano.
    LeerMaterializa,
}

/// Observacion, no politica. La proteccion NO ramifica sobre esto: `hashear` rechaza
/// por su cuenta.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Hidratacion {
    Materializado,
    /// **NO ES AUSENTE** (salvaguarda 5). Quien reciba esto no reporta una baja.
    Deshidratado,
    /// El sistema de archivos no publica el atributo, o hay sospecha sin atributo. No
    /// es `Materializado` ni es `Deshidratado`: es que no se sabe, y colapsarlo a
    /// `Materializado` es el error que descarga el drive de nube entero.
    Desconocida,
}

// ─────────────────────────── POLITICA 2 · el arranque ───────────────────────

/// La segunda politica. macOS le da a un proceso SIN privilegios un cursor persistente
/// y replayable; Windows no da nada equivalente sin ser administrador y sin abrir el
/// volumen entero.
#[derive(Clone, Debug)]
pub enum PlanDeArranque {
    Replay {
        desde: CursorDurable,
    },
    /// Windows SIEMPRE, y macOS en las situaciones de `MotivoDeBarrido`. Es el MISMO
    /// brazo, y por eso el camino de Windows corre en un Mac todos los dias.
    BarridoCompleto {
        porque: MotivoDeBarrido,
    },
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum MotivoDeBarrido {
    /// La plataforma no tiene cursor durable para un proceso sin privilegios.
    LaPlataformaNoLoTiene,
    /// Primer arranque sobre esta raiz, o el inventario se perdio. El borrador ya dice
    /// que cuesta: un barrido, no una re-subida — Savia contesta `known`.
    SinInventario,
    /// El cursor se tomo contra otra huella de raiz.
    HuellaDeRaizDistinta,
    /// macOS descarto y recreo su base de eventos: el UUID cambio y los ids guardados
    /// ya no significan nada. Sin esta comprobacion, el replay entrega un historico
    /// ajeno, `HistoryDone` llega igual, y el arranque cree estar al dia.
    BaseDeEventosDescartada,
    /// El volumen no lleva historial.
    ElVolumenNoLlevaHistorial,
    /// El replay se degrado EN VUELO. El sistema coalescio y no sabe que se perdio, asi
    /// que la unica salida honesta es volver a mirar.
    ElReplaySeDegrado,
}

/// Opaco, y **atado a la evidencia que lo hace valido**. Los tres campos son necesarios
/// y ninguno es decorativo: sin `base_de_eventos` el cursor sobrevive a que macOS
/// recree `.fseventsd` y el replay entrega un historico ajeno; sin `huella`, un cursor
/// se aplica a la raiz equivocada.
#[derive(Clone, Debug)]
pub struct CursorDurable {
    pub marca: u64,
    /// `FSEventsCopyUUIDForDevice`. Apple lo publica EXACTAMENTE para esto: si la base
    /// se descarta, la reemplazante tiene otro UUID «so that clients will be able to
    /// detect this situation».
    pub base_de_eventos: [u8; 16],
    pub huella: HuellaDeRaiz,
}

// ────────────────────────── Identidad de la raiz ────────────────────────────

/// Identidad ESTABLE del volumen: la que sobrevive a un remontaje.
///
/// **NO DERIVA `PartialEq`, Y ESA ES LA MITAD DEL PUNTO.** Dos `NoPublicada`
/// compararian iguales y la salvaguarda de la raiz viva aceptaria un suplente. La
/// comparacion es explicita y de TRES valores.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub enum IdDeVolumen {
    /// Lo que corresponde: `ATTR_VOL_UUID` en macOS, el GUID de
    /// `GetVolumeNameForVolumeMountPointW` en Windows.
    Uuid([u8; 16]),
    /// PROVISIONAL: el `st_dev` de `stat`. Es un DEGRADE consciente y hay que decirlo —
    /// `st_dev` se reasigna entre montajes, asi que un remontaje puede parecer otro
    /// volumen y la raiz queda `Suplantada` (que falla seguro: no se reporta nada).
    /// Lo correcto es `getattrlist(ATTR_VOL_UUID)` con `#[repr(C, packed)]` y leyendo
    /// los atributos en ORDEN DE BIT; entra cuando el modulo pase a `getattrlistbulk`.
    NumeroDeDispositivo(u64),
    /// El sistema de archivos no publica identidad (SMB, NFS, algunos `.dmg`). No se
    /// inventa un sustituto: quien la necesite tiene que saber que no la hay, porque la
    /// salvaguarda 2 se apoya entera en ella.
    NoPublicada { fstype: Box<str> },
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Coincidencia {
    Coincide,
    NoCoincide,
    Indeterminada,
}

impl IdDeVolumen {
    /// De tres valores porque `NoPublicada` no es igual a nada, ni a si misma.
    pub fn coincide_con(&self, otra: &Self) -> Coincidencia {
        match (self, otra) {
            (IdDeVolumen::Uuid(a), IdDeVolumen::Uuid(b)) => {
                if a == b {
                    Coincidencia::Coincide
                } else {
                    Coincidencia::NoCoincide
                }
            }
            (IdDeVolumen::NumeroDeDispositivo(a), IdDeVolumen::NumeroDeDispositivo(b)) => {
                if a == b {
                    Coincidencia::Coincide
                } else {
                    Coincidencia::NoCoincide
                }
            }
            // Dos formas distintas de identidad no se pueden comparar, y afirmar que
            // coinciden seria justamente aceptar un suplente.
            _ => Coincidencia::Indeterminada,
        }
    }
}

/// Lo que se registra al enrolar y se vuelve a exigir en CADA apertura de barrido.
///
/// Las dos mitades hacen falta: la id de directorio atrapa el caso peor del borrador
/// —el volumen no monto y quedo un directorio vacio de suplente en el mismo path, que
/// tiene otro inodo— y la id de volumen atrapa el caso en que dos volumenes distintos
/// repiten numero de inodo, que es raro pero que un restore produce.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct HuellaDeRaiz {
    pub volumen: IdDeVolumen,
    pub directorio: IdDeArchivoDelSO,
}

impl HuellaDeRaiz {
    /// **EL `RaizId` SE DERIVA DE LA HUELLA, Y ESO ES LO QUE HACE CIERTA LA DECISION 7.**
    ///
    /// «Reelegir la raiz movida da el MISMO `RaizId`» estaba escrito en tres lugares como
    /// propiedad y en ninguno como codigo: el demo acunaba `"root-1"` a mano, que alcanza
    /// con una sola carpeta y deja de alcanzar en cuanto hay dos. Sin esta derivacion,
    /// sacar una carpeta y volver a agregarla estrena una raiz nueva — y entonces nada
    /// matchea y **se resube todo**, que es exactamente lo que la decision promete que no
    /// pasa.
    ///
    /// **Se deriva de los dos ids y NUNCA de la ruta**, por lo mismo: la ruta es
    /// procedencia y cambia cuando la persona mueve la carpeta. Y va hasheada porque el
    /// `RaizId` viaja a Savia en las siete llamadas: el `st_dev` y el numero de inodo de
    /// una maquina no son secretos graves, pero tampoco hay ninguna razon para mandarlos.
    ///
    /// **`NoPublicada` deriva igual, y hay que saberlo.** Un volumen sin identidad
    /// (SMB, NFS) da huellas que solo se distinguen por el id de directorio; dos montajes
    /// distintos del mismo servidor con el mismo inodo colisionarian. No se inventa un
    /// sustituto —la salvaguarda 2 se apoya en que la falta de identidad se SEPA— asi que
    /// la colision se acepta y se nombra acá.
    pub fn raiz_id(&self) -> RaizId {
        use sha2::{Digest, Sha256};
        let mut h = Sha256::new();
        match &self.volumen {
            IdDeVolumen::Uuid(b) => {
                h.update([1u8]);
                h.update(b);
            }
            IdDeVolumen::NumeroDeDispositivo(n) => {
                h.update([2u8]);
                h.update(n.to_be_bytes());
            }
            IdDeVolumen::NoPublicada { fstype } => {
                h.update([3u8]);
                h.update(fstype.as_bytes());
            }
        }
        h.update(self.directorio.0.to_be_bytes());
        let d = h.finalize();
        let mut s = String::with_capacity(32);
        for b in &d[..16] {
            s.push_str(&format!("{b:02x}"));
        }
        RaizId::nueva(s)
    }

    /// `NoCoincide` si difiere la id de directorio (decisivo). `Coincide` solo si
    /// ademas coincide el volumen. Si el volumen es `Indeterminada`, el resultado es
    /// `Indeterminada` — **nunca `Coincide`**.
    pub fn coincide_con(&self, otra: &Self) -> Coincidencia {
        if self.directorio != otra.directorio {
            return Coincidencia::NoCoincide;
        }
        self.volumen.coincide_con(&otra.volumen)
    }
}

/// Lo acunado al ENROLAR. La identidad son los dos ids; la ruta es procedencia.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct RaizRegistrada {
    pub id: RaizId,
    pub huella: HuellaDeRaiz,
    /// Solo para mostrar y para saber donde empezar a mirar. Si cambia no pasa nada:
    /// por eso reelegir la raiz movida da el MISMO `RaizId` (decision 7).
    pub ruta_absoluta: PathBuf,
    /// Lo unico que la decision 9 deja del lado del agente: «el unico que sabe si su
    /// sistema de archivos las distingue».
    pub sensibilidad: crate::dominio::SensibilidadAMayusculas,
}

// ─────────────────────────── Lo que el disco deja ver ───────────────────────

/// La TERCERA respuesta que un `stat` real da, y que el flujograma no dibuja porque
/// asume que `¿existe?` contesta si/no. **Nunca produce un hecho.**
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum MotivoIndeterminado {
    /// macOS: TCC. Tiene variante propia porque un permiso denegado produce EXACTAMENTE
    /// el mismo conjunto de ausencias que un borrado masivo, y el panel tiene que decir
    /// «dale acceso a disco», no «carpeta ausente».
    PermisoDenegado,
    ErrorDeEntradaSalida,
    RaizNoResponde,
}

/// Lo que UNA mirada a una ruta deja ver.
///
/// La hidratacion viaja ADENTRO de la ficha y no en una segunda llamada: Windows la
/// obtiene de la enumeracion gratis, y en macOS una segunda pasada seria otra
/// oportunidad de tocar el archivo. Asi la maquina nunca sabe en que plataforma corre.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Ficha {
    Presente {
        observacion: Observacion,
        hidratacion: Hidratacion,
    },
    /// SOLO `ENOENT` / `ERROR_FILE_NOT_FOUND`. Colapsar `EACCES` aca produce el conjunto
    /// completo de ausencias de la raiz con la raiz viva.
    NoExiste,
    Indeterminada(MotivoIndeterminado),
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum FalloDeLectura {
    /// Esta deshidratado y ESTA plataforma no puede leerlo sin materializarlo.
    /// **No es `YaNoEsta`**: quien reciba esto no reporta una baja.
    HidratacionRequerida,
    YaNoEsta,
    PermisoDenegado,
    ErrorDeEntradaSalida,
    /// Cambio mientras se leia. No es un error del sistema: es el asentamiento diciendo
    /// que todavia no.
    CambioMientrasSeLeia,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum FalloDeEnumeracion {
    NoMontado,
    PermisoDenegado,
    ErrorDeEs,
    NoEsDirectorio,
}

/// El error terminal de `Macos::nueva()`/`Windows::nueva()` — a diferencia de
/// `FalloDeLectura`/`FalloDeEnumeracion`/`MotivoIndeterminado`, ningun llamador lo
/// desarma: se boxea con `?` en el arranque y ahi termina. Vive aca, y no repetido en
/// cada adaptador, porque las dos plataformas dan el mismo diagnostico —no hay base
/// para el reloj monotonico que avanza durante la suspension— con mensajes distintos
/// (`mach_timebase_info` en macOS, `QueryInterruptTimePrecise`/
/// `QueryUnbiasedInterruptTimePrecise` en Windows). Antes cada adaptador definia su
/// propio enum con el mismo nombre y el mismo unico caso — dos tipos distintos que
/// nada obligaba a mantener en sincro, y asi fue como windows.rs perdio sus `impl
/// Display`/`impl Error` una vez sin que nadie lo notara: el archivo no compilaba en
/// ninguna maquina de desarrollo.
#[derive(Debug)]
pub enum ErrorDePlataforma {
    /// El mensaje es dato, no una variante mas: cada plataforma pasa el suyo.
    RelojSinBase { motivo: &'static str },
}

// A mano y no `thiserror`: son pocas lineas, y el crate no tiene ninguna dependencia de
// proc-macro fuera de `serde`, que la necesita para las formas del cable.
impl std::fmt::Display for ErrorDePlataforma {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ErrorDePlataforma::RelojSinBase { motivo } => f.write_str(motivo),
        }
    }
}

impl std::error::Error for ErrorDePlataforma {}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Clase {
    Archivo,
    Directorio,
    /// No se sigue NUNCA. Un enlace hacia afuera de la raiz mete en el corpus archivos
    /// que el usuario no eligio; un ciclo cuelga el barrido, y un barrido que no termina
    /// no cierra `completo`, asi que la cuarentena no vence nunca.
    Enlace,
    /// Un punto de montaje ADENTRO de la raiz. No se desciende: montar un NAS en
    /// `~/Savia` no puede convertir el NAS en corpus, y el desmontaje siguiente
    /// produciria un borrado masivo aparente de todo eso.
    OtroVolumen,
    Otro,
}

/// Una entrada del recorrido, con TODO lo que el inventario necesita, sin abrir un solo
/// archivo. Eso es lo que vuelve verdadera la frase «renombrar y mover cuestan cero
/// I/O».
#[derive(Clone, Debug)]
pub struct EntradaEnumerada {
    pub ruta: RutaRelativa,
    pub clase: Clase,
    pub observacion: Observacion,
    pub hidratacion: Hidratacion,
}

/// Error de UNA entrada, que NO aborta la enumeracion: si abortara, todas las entradas
/// posteriores parecerian ausentes y eso es un borrado masivo inventado, de un tamano
/// que depende de en que punto del directorio estaba el archivo ilegible.
#[derive(Clone, Debug)]
pub struct ErrorDeEntrada {
    pub ruta: Option<RutaRelativa>,
    pub errno: i32,
}

/// El resultado de RECORRER la raiz. `Listada` con cero entradas **no es un error**:
/// vaciar una carpeta es legitimo, y el caso masivo lo separa el corte por volumen, que
/// es de Savia.
#[derive(Clone, Debug)]
pub enum ResultadoDeEnumeracion {
    Listada {
        entradas: Vec<EntradaEnumerada>,
        /// Las que fallaron una por una. Con al menos una, el barrido cierra
        /// `interrumpido`: un recorrido con huecos no puede afirmar «barri entero».
        errores: Vec<ErrorDeEntrada>,
    },
    Fallo(FalloDeEnumeracion),
}

/// Lo que hay que traer HOY de la raiz para decidir si esta viva. Los tres son
/// necesarios y ninguno alcanza solo.
#[derive(Clone, Debug)]
pub struct EvidenciaDeRaiz {
    /// El resultado de ENUMERAR, no de `stat`ear. Un `stat` contesta «existe» sobre el
    /// directorio vacio que quedo de suplente y sobre un montaje de red cuyo `readdir`
    /// falla.
    pub enumeracion: ResultadoDeEnumeracion,
    pub volumen: Option<IdDeVolumen>,
    pub directorio: Option<IdDeArchivoDelSO>,
}

// ─────────────────────────────── El trait ───────────────────────────────────

pub trait Plataforma: Send + Sync {
    // — Lo que la plataforma DECIDE. Vuelve como valor, no como metodo ausente —

    fn politica_de_deshidratacion(&self) -> PoliticaDeDeshidratacion;

    /// macOS devuelve `Replay` solo si el cursor existe, su `base_de_eventos` sigue
    /// siendo la del volumen y su `huella` coincide; Windows devuelve
    /// `BarridoCompleto{LaPlataformaNoLoTiene}` sin mirar nada.
    fn plan_de_arranque(
        &self,
        raiz: &RaizRegistrada,
        cursor: Option<&CursorDurable>,
    ) -> PlanDeArranque;

    // — Identidad —

    /// Se llama UNA vez al enrolar. Lo que devuelve se persiste y se vuelve a exigir en
    /// cada apertura de barrido.
    fn huella_de_raiz(&self, ruta: &std::path::Path) -> Result<HuellaDeRaiz, FalloDeEnumeracion>;

    /// La evidencia de la salvaguarda 2. **Enumera, no `stat`ea.** Devuelve EVIDENCIA y
    /// no un veredicto a proposito: el veredicto es politica y vive en `salvaguardas`,
    /// que es puro y se testea sin disco.
    fn evidencia_de_raiz(&self, raiz: &RaizRegistrada) -> EvidenciaDeRaiz;

    // — Una ruta —

    fn ficha(&self, raiz: &RaizRegistrada, ruta: &RutaRelativa) -> Ficha;

    /// El UNICO camino a los bytes, y es fallible por deshidratacion a proposito: en
    /// macOS, `Err(HidratacionRequerida)` es la diferencia entre no leer un archivo y
    /// descargarle al usuario el drive de nube entero.
    ///
    /// Devuelve tambien lo OBSERVADO AL ABRIR: entre enumerar y abrir pasa tiempo, y la
    /// tripleta que evita rehashear tiene que ser la del momento en que se leyeron los
    /// bytes, o miente.
    fn hashear(
        &self,
        raiz: &RaizRegistrada,
        ruta: &RutaRelativa,
    ) -> Result<(HashAfirmado, Observacion), FalloDeLectura>;

    /// Los bytes para el PUT prefirmado. Separado de `hashear` porque el orden del
    /// canal es «primero se pregunta, y solo se transfiere lo que Savia no tiene»: leer
    /// para subir solo ocurre despues de una decision `upload`.
    fn leer_para_subir(
        &self,
        raiz: &RaizRegistrada,
        ruta: &RutaRelativa,
    ) -> Result<Vec<u8>, FalloDeLectura>;

    /// Un HECHO MEDIDO del volumen, no un parametro calibrable: 2 s en FAT/exFAT,
    /// truncado en SMB. Por eso no vive en `parametros`.
    fn granularidad_de_mtime(&self, raiz: &RaizRegistrada) -> Duration;

    // — Reloj —

    /// Avanza durante la suspension. macOS: `mach_continuous_time()`.
    fn ahora(&self) -> Instante;
}

/// Puente para que cualquier `Plataforma` sirva de `Reloj` sin que la maquina tenga que
/// recibir dos puertos que podrian discrepar.
pub struct RelojDePlataforma<'a>(pub &'a dyn Plataforma);

impl crate::dominio::Reloj for RelojDePlataforma<'_> {
    fn ahora(&self) -> Instante {
        self.0.ahora()
    }
}

// No hace falta un `unsafe impl`: `Plataforma` ya exige `Send + Sync`, asi que
// `&dyn Plataforma` los hereda solo. Escribirlos a mano seria meter `unsafe` en el
// modulo por una propiedad que el compilador ya deriva.
