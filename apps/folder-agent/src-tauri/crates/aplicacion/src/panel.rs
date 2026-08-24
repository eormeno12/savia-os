//! LA BANDEJA: lo unico del agente que una persona ve.
//!
//! Este modulo **deriva, no guarda**. No tiene estado propio, no muta nada y no habla
//! con Savia: toma el `Almacen` —que ya es la verdad— y la `Plataforma` —que contesta si
//! el disco esta ahi ahora mismo— y arma la foto. Un panel con su propio estado seria un
//! segundo lugar donde vive la verdad, y el dia que se desincronice el usuario le cree
//! al panel.
//!
//! ## Dos cosas del boceto que este modulo NO produce, a proposito
//!
//! **«Sincronizado · hace 2 min».** Nadie anota cuando cerro el ultimo barrido. Se podria
//! poner el reloj del panel y llamarlo «hace un momento», que es exactamente la respuesta
//! tranquilizadora: un agente detenido hace seis horas mostraria «hace un momento» para
//! siempre. El hecho falta; se agrega cuando alguien lo persista.
//!
//! **`en espera` («formato que todavia no leemos»).** `presence.decision` contesta
//! `known` o `upload` y nada mas — no existe un veredicto «este formato no lo proceso».
//! Sin ese tercer caso en el alambre, la unica forma de mostrar `en espera` seria que el
//! agente adivine por extension cuales formatos lee Savia, o sea duplicar del lado del
//! escritorio una decision que es del servidor y que cambia sin que el agente se entere.
//!
//! Las dos son huecos del canal, no del panel, y estan anotados en el borrador.

use savia_folder_contrato::dominio::{RaizId, RutaRelativa};
use savia_folder_contrato::inventario::{EstadoDeFila, EstadoDeHash, Inventario, MotivoDeFallo};
use savia_folder_contrato::plataforma::Plataforma;
use savia_folder_estado::almacen::Almacen;
use savia_folder_estado::colas::MotivoDeDetencion;
use savia_folder_politica::salvaguardas::{EstadoDeRaiz, PorQueAusente, raiz_viva};

/// El estado de UNA carpeta, y es uno solo: el panel muestra una fila por raiz y una
/// fila no puede decir dos cosas.
///
/// **El orden de precedencia esta en `de_una_carpeta` y es una decision, no un detalle.**
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(tag = "estado", rename_all = "camelCase")]
pub enum EstadoDeCarpeta {
    /// El ultimo barrido cerro completo y no hay nada retenido.
    Sincronizado,
    /// Hay un barrido abierto sobre esta raiz.
    Barriendo,
    /// La raiz no esta, o no se puede leer, o la que esta no es la que se enrolo. **No es
    /// un error: es desconexion**, y lo que el usuario tiene que hacer es reconectar el
    /// disco — por eso viaja el motivo y no un booleano.
    CarpetaAusente { porque: Motivo },
    /// Savia disparo su corte por volumen y esta RETENIENDO bajas hasta tener mas
    /// evidencia. Tampoco es un error, y tampoco pide accion: se resuelve solo con el
    /// proximo barrido completo.
    Congelado,
}

/// `PorQueAusente` es de `salvaguardas` y habla de evidencia; esto habla de lo que se le
/// muestra a una persona. Se traduce en vez de reexportarse porque son dos vocabularios:
/// «identidad ilegible» no se le dice a nadie.
#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Motivo {
    /// La carpeta no responde: desmontada, sin permisos, o el volumen no contesta.
    NoSeAlcanza,
    /// Hay una carpeta en esa ruta, pero **no es la que se enrolo**. Es el unico motivo
    /// que pide una decision del usuario, y por eso no se colapsa con el anterior.
    OtraCarpeta,
}

/// Lo que se dice de UN archivo. Cuatro casos, y cada uno sale de un hecho que el agente
/// tiene — ninguno se infiere de la extension ni del nombre.
///
/// **Serializa "adyacente" (`tag = "estado", content = "motivo"`), no externo.** Con el
/// tag por omision, `Fallo(m)` saldria como `{"fallo": m}` y las demas variantes como
/// string plano: `panel.js` lee `f.estado` como string SIEMPRE (`ARCHIVO[f.estado]`), asi
/// que una forma mixta le rompe la busqueda justo en el caso que mas importa mostrar. Con
/// `content = "motivo"` y `#[serde(flatten)]` en `Fila::estado`, `estado` es string en
/// las cuatro variantes y el motivo viaja aparte, presente solo cuando hay uno.
#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(tag = "estado", content = "motivo", rename_all = "camelCase")]
pub enum EstadoDeArchivo {
    /// La ruta se envenerio, o el agente encontro un fallo local terminal leyendola.
    /// **Es el unico que pide una persona**, y el motivo dice por que.
    Fallo(MotivoDeArchivoFallido),
    /// El agente tiene un hash local y Savia todavia no lo confirmo.
    Procesando,
    /// Savia confirmo el hash: contesto `known`, o el `upload.completed` lo devolvio
    /// verificado. Es lo unico que significa «esta en Savia».
    Indexado,
    /// La lapida. El archivo no esta y Savia ya lo sabe.
    Retirado,
}

impl EstadoDeArchivo {
    /// **El orden de atencion, y es el orden en que las filas se muestran.** Una bandeja
    /// con lugar para diez filas y cuarenta mil archivos tiene que mostrar los que piden
    /// algo, no los primeros alfabeticamente.
    fn prioridad(self) -> u8 {
        match self {
            EstadoDeArchivo::Fallo(_) => 0,
            EstadoDeArchivo::Procesando => 1,
            EstadoDeArchivo::Retirado => 2,
            EstadoDeArchivo::Indexado => 3,
        }
    }
}

/// Por que una fila esta en `Fallo`, traducido a lo que le importa a una persona.
/// `MotivoDeFallo` (en `contrato::inventario`) habla de lo que el agente vio en el disco;
/// esto le agrega el motivo que solo la cola conoce (`RechazadoPorSavia`) y traduce los
/// locales — dos vocabularios, igual que `Motivo` mas arriba.
#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum MotivoDeArchivoFallido {
    /// La cola la aparto: fallo tantas veces subiendo que se envenero. **Es el unico que
    /// hoy se produce** — el veneno pisa cualquier motivo local (ver `de_una_carpeta`).
    RechazadoPorSavia,
    /// El agente no pudo abrir el archivo para leerlo (permiso denegado).
    NoSePudoAbrir,
    /// Declarado, no construido hoy: no hay hecho local que produzca este motivo. Ver
    /// `MotivoDeFallo::TipoNoCompatible`.
    TipoNoCompatible,
    /// Declarado, no construido hoy. Ver `MotivoDeFallo::Desconocido`.
    Desconocido,
}

fn traducir_motivo(m: MotivoDeFallo) -> MotivoDeArchivoFallido {
    match m {
        MotivoDeFallo::NoSePudoAbrir => MotivoDeArchivoFallido::NoSePudoAbrir,
        MotivoDeFallo::TipoNoCompatible => MotivoDeArchivoFallido::TipoNoCompatible,
        MotivoDeFallo::Desconocido => MotivoDeArchivoFallido::Desconocido,
    }
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
pub struct Fila {
    pub ruta: String,
    #[serde(flatten)]
    pub estado: EstadoDeArchivo,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Carpeta {
    pub id: String,
    pub ruta_absoluta: String,
    #[serde(flatten)]
    pub estado: EstadoDeCarpeta,
    /// Las filas que entraron en el tope, ordenadas por atencion.
    pub filas: Vec<Fila>,
    /// **Cuantas quedaron afuera del tope.** Va aparte para que la interfaz pueda decir
    /// «y 39.987 mas» en vez de dar a entender que la lista es todo lo que hay.
    pub ocultas: usize,
    pub indexados: usize,
    /// **Se cuenta ANTES de truncar, y esa es toda la razon de que sea un campo.** El
    /// orden de atencion pone los fallos primero, asi que con el tope holgado se ven
    /// todos en `filas` — pero con mas fallos que tope, contarlos del lado de la interfaz
    /// devolveria el tope en vez del total. Un contador que se topea es un contador que
    /// miente justo cuando mas hay que contar.
    pub fallos: usize,
    /// El «128 de 412» del primer barrido (plan, Fase 4). **Hoy siempre `None`, y no es
    /// un placeholder cualquiera: es la unica respuesta honesta.** El total que
    /// `Almacen::abrir_barrido` guarda es `Inventario::vivos`, pensado para el corte por
    /// volumen — se mide ANTES de abrir el barrido, y en el primer barrido de una carpeta
    /// nueva vale cero, que es justo el caso que este campo tendria que mostrar. El total
    /// real (`ResumenDelBarrido::enumeradas`, en `ciclo::barrer`) se conoce al abrir, pero
    /// es el valor de retorno de una funcion: `Almacen` no lo guarda, y `panel::vista` no
    /// tiene forma de leerlo sin inventar un numero. El campo queda reservado con la forma
    /// que va a tener — lo llena el canal de progreso de la Fase 7, que lee directo del
    /// recorrido en vez de por esta foto.
    pub progreso: Option<Progreso>,
}

/// Ver `Carpeta::progreso`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progreso {
    pub procesados: usize,
    pub total: usize,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Vista {
    /// El estado agregado — lo unico siempre visible cuando el panel esta cerrado.
    #[serde(flatten)]
    pub estado: EstadoDeCarpeta,
    /// El dispositivo entero detenido pesa mas que cualquier estado por carpeta, y se
    /// dice aparte: no es «una carpeta esta mal», es «Savia no esta entrando».
    pub detenido: Option<Detencion>,
    /// Archivos en `Fallo` sobre TODAS las raices.
    ///
    /// **Va al lado del agregado y no adentro de el.** Los cuatro estados hablan de la
    /// CARPETA, y una carpeta con un archivo ilegible sigue estando sincronizada: su
    /// ultimo barrido cerro completo y eso es verdad. Pero el agregado es lo unico
    /// visible con el panel cerrado, y un archivo que hace tres barridos que no entra es
    /// justamente lo que hay que ver sin abrir nada. La salida no es un quinto estado de
    /// carpeta —seria falso— sino un hecho aparte, igual que `detenido`, y que la vista
    /// decida cual de los tres manda.
    pub fallos: usize,
    /// «1.204 documentos en Savia» — la suma de `indexados` de todas las carpetas, igual
    /// que `fallos` unas lineas arriba. Ya excluye lapidas y rutas envenenadas porque
    /// `indexados` ya las excluye por carpeta.
    pub indexados: usize,
    pub carpetas: Vec<Carpeta>,
}

/// Hoy `MotivoDeDetencion` tiene un solo caso y esto lo espeja con uno solo. **No lleva
/// un `Otro` de reserva**: un comodin haria que el dia que aparezca un motivo nuevo el
/// panel lo muestre como generico en vez de no compilar, y «Savia no esta entrando, no
/// se sabe por que» no le sirve a nadie.
#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Detencion {
    /// El token no vale. Se resuelve volviendo a vincular, y la interfaz tiene que
    /// ofrecer eso y no un «reintentar».
    Credenciales,
}

/// La foto entera. `max_filas` **entra por parametro y no tiene valor por omision**: es
/// un numero que decide que ve el usuario, y la disciplina de `parametros` vale igual
/// para los numeros de interfaz que para los del canal.
pub fn vista(almacen: &Almacen, plataforma: &dyn Plataforma, max_filas: usize) -> Vista {
    let mut carpetas: Vec<Carpeta> = almacen
        .inventario()
        .raices()
        .into_iter()
        .map(|r| de_una_carpeta(almacen, plataforma, &r.id, max_filas))
        .collect();
    carpetas.sort_by(|a, b| a.ruta_absoluta.cmp(&b.ruta_absoluta));

    Vista {
        estado: agregado(&carpetas),
        detenido: almacen.colas().detenido().map(|m| match m {
            MotivoDeDetencion::Credenciales => Detencion::Credenciales,
        }),
        fallos: carpetas.iter().map(|c| c.fallos).sum(),
        indexados: carpetas.iter().map(|c| c.indexados).sum(),
        carpetas,
    }
}

/// **EL AGREGADO ES EL PEOR, NUNCA EL PROMEDIO NI EL MAS COMUN.** Con tres carpetas
/// sincronizadas y una desmontada, el icono de la bandeja tiene que decir que algo pasa:
/// un agregado que dijera «Sincronizado» porque tres de cuatro lo estan es exactamente
/// la respuesta tranquilizadora que hace que nadie abra el panel.
fn agregado(carpetas: &[Carpeta]) -> EstadoDeCarpeta {
    carpetas
        .iter()
        .map(|c| c.estado.clone())
        .max_by_key(peso)
        .unwrap_or(EstadoDeCarpeta::Sincronizado)
}

fn peso(e: &EstadoDeCarpeta) -> u8 {
    match e {
        EstadoDeCarpeta::Sincronizado => 0,
        EstadoDeCarpeta::Barriendo => 1,
        EstadoDeCarpeta::Congelado => 2,
        EstadoDeCarpeta::CarpetaAusente { .. } => 3,
    }
}

fn de_una_carpeta(
    almacen: &Almacen,
    plataforma: &dyn Plataforma,
    raiz: &RaizId,
    max_filas: usize,
) -> Carpeta {
    let registrada = almacen
        .inventario()
        .raiz(raiz)
        .expect("la raiz sale del propio inventario");
    let colas = almacen.colas();

    // ── LA PRECEDENCIA, Y ES UNA DECISION ────────────────────────────────────
    //
    // `CarpetaAusente` gana porque si el disco no esta, ningun otro estado es
    // averiguable: decir «Sincronizado» sobre una carpeta desmontada es afirmar algo que
    // no se miro.
    //
    // `Congelado` le gana a `Barriendo`, que es la parte que sorprende. Barrer dura
    // segundos y se resuelve solo; congelado dura barridos y es lo unico de los cuatro
    // que dice que paso algo que el usuario no pidio. Mostrar `Barriendo` encima lo
    // taparia justo mientras dura — y el que trabaja se ve igual en los contadores.
    let estado = match raiz_viva(&registrada, &plataforma.evidencia_de_raiz(&registrada)) {
        EstadoDeRaiz::Ausente(p) => EstadoDeCarpeta::CarpetaAusente {
            porque: match p {
                PorQueAusente::Suplente => Motivo::OtraCarpeta,
                // Los otros dos se colapsan A PROPOSITO: «no se pudo enumerar» y «no se
                // pudo leer la identidad» son el mismo hecho para quien mira el panel
                // —el disco no contesta— y la accion es la misma. La distincion entre
                // ellos es diagnostico, y el diagnostico no vive en la bandeja.
                PorQueAusente::NoSePudoEnumerar(_) | PorQueAusente::IdentidadIlegible => {
                    Motivo::NoSeAlcanza
                }
            },
        },
        EstadoDeRaiz::Viva if colas.congelada(raiz) => EstadoDeCarpeta::Congelado,
        EstadoDeRaiz::Viva if colas.barriendo(raiz) => EstadoDeCarpeta::Barriendo,
        EstadoDeRaiz::Viva => EstadoDeCarpeta::Sincronizado,
    };

    let envenenadas: std::collections::BTreeSet<RutaRelativa> =
        colas.rutas_envenenadas(raiz).into_iter().collect();

    let mut filas: Vec<Fila> = almacen
        .inventario()
        .entradas(raiz)
        .into_iter()
        .map(|e| Fila {
            estado: if envenenadas.contains(&e.ruta) {
                // EL VENENO PISA AL ESTADO DE LA FILA, incluso sobre un `e.fallo` local:
                // un archivo que Savia confirmo hace un mes y hoy no se puede leer es un
                // problema, y su fila dice `Indexado`: verdadero sobre el pasado y mudo
                // sobre lo que pasa ahora. Si ademas la cola lo envenero, eso es lo que
                // se muestra.
                EstadoDeArchivo::Fallo(MotivoDeArchivoFallido::RechazadoPorSavia)
            } else if let Some(motivo) = e.fallo {
                EstadoDeArchivo::Fallo(traducir_motivo(motivo))
            } else {
                match e.estado {
                    EstadoDeFila::Ausente { .. } => EstadoDeArchivo::Retirado,
                    EstadoDeFila::Presente {
                        hash: EstadoDeHash::Confirmado(_),
                        ..
                    } => EstadoDeArchivo::Indexado,
                    EstadoDeFila::Presente {
                        hash: EstadoDeHash::Afirmado(_),
                        ..
                    } => EstadoDeArchivo::Procesando,
                }
            },
            ruta: e.ruta.como_str().to_string(),
        })
        .collect();

    let indexados = filas
        .iter()
        .filter(|f| f.estado == EstadoDeArchivo::Indexado)
        .count();
    let fallos = filas
        .iter()
        .filter(|f| matches!(f.estado, EstadoDeArchivo::Fallo(_)))
        .count();

    // `sort_by` y no `sort_unstable_by`: dentro de la misma prioridad el orden que
    // quedo es el del inventario, que esta ordenado por ruta. Un orden inestable haria
    // que la lista se sacuda entre dos refrescos sin que nada haya cambiado.
    filas.sort_by_key(|f| f.estado.prioridad());
    let ocultas = filas.len().saturating_sub(max_filas);
    filas.truncate(max_filas);

    Carpeta {
        id: raiz.como_str().to_string(),
        ruta_absoluta: registrada.ruta_absoluta.to_string_lossy().into_owned(),
        estado,
        filas,
        ocultas,
        indexados,
        fallos,
        // Ver el doc de `Carpeta::progreso`: hoy no hay ningun numero honesto que poner
        // aca, asi que no se pone ninguno.
        progreso: None,
    }
}
