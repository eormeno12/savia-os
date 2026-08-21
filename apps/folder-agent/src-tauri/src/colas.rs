//! DOS COLAS, NO UNA.
//!
//! La de HECHOS es diminuta, **siempre tiene que llegar y va primero**; la de BYTES
//! tiene un solo productor —la respuesta `upload` de `presence.observed`— y **no existe
//! camino del observador ni del barrido a ella**, asi que «primero se pregunta, y solo
//! se transfiere lo que Savia no tiene» es cierto por construccion y no por prioridad de
//! scheduler.
//!
//! EL ORDEN ES EL SIGNIFICADO. La cola se drena EN ORDEN POR RAIZ y con un solo trabajo
//! en vuelo por raiz: `desaparecio(P,H1)` seguido de `aparecio(P,H2)` es una edicion;
//! entregado al reves es el borrado de la version nueva. Entre raices no hay orden ni
//! bloqueo — las salvaguardas son por raiz, y un disco externo desmontado no puede
//! congelar la raiz del disco interno.
//!
//! **EL SEGMENTO ES LA BARRERA DE COMPACTACION.** Dentro de un segmento se deja como
//! maximo un hecho por `(raiz, ruta)` —lo que a su vez vuelve legal batchear
//! `presence.observed`, porque sin dos hechos sobre la misma ruta en un lote el orden
//! dentro del lote no significa nada— y **nada se compacta a traves de un borde de
//! barrido**, porque un borde no es el estado de un archivo sino evidencia sobre una
//! raiz. Compactar al ultimo estado es seguro por la razon del plan: si el usuario edito
//! cinco veces sin conexion, los bytes de las cuatro intermedias YA NO EXISTEN en ningun
//! lado.
//!
//! Y una consecuencia de esa compactacion que hay que escribir: **la baja no puede
//! viajar con el ultimo hash OBSERVADO, sino con el ultimo CONFIRMADO**. Por eso una
//! `Desaparicion` se construye con un `HashVerificado` y no con uno afirmado (ver
//! `salvaguardas::puerta_de_baja`): si el usuario edito cinco veces sin conexion y
//! despues borro, una baja con el afirmado no matchea ningun documento y el archivo
//! borrado se queda en la busqueda para siempre.
#![forbid(unsafe_code)]

use crate::dominio::{
    BarridoId, EstadoDelBarrido, HashAfirmado, HashVerificado, RaizId, RutaRelativa,
};
use crate::salvaguardas::{Aparicion, Desaparicion, Hecho};
use std::collections::{BTreeMap, BTreeSet};

// ═══════════════════════════════ Identidades ════════════════════════════════

#[derive(
    serde::Serialize, serde::Deserialize, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug,
)]
pub struct SegmentoId(pub u64);

#[derive(serde::Serialize, serde::Deserialize, Clone, PartialEq, Eq, Debug)]
pub struct SweepId(pub String);

#[derive(serde::Serialize, serde::Deserialize, Clone, PartialEq, Eq, Debug)]
pub struct PermisoId(pub String);

/// De que es este segmento. Los dos mecanismos del ciclo producen hechos, pero **solo
/// uno produce evidencia sobre la raiz**.
#[derive(serde::Serialize, serde::Deserialize, Clone, PartialEq, Eq, Debug)]
pub enum OrigenDeSegmento {
    /// Un barrido: lleva `sweep.open`/`sweep.close` y el denominador que el corte por
    /// volumen necesita.
    Barrido { total: u64, barrido: BarridoId },
    /// Hechos sueltos del observador entre dos barridos. **NO lleva marcadores**, y eso
    /// es deliberado: un evento no establece verdad de campo, asi que emitir un
    /// `sweep.close(complete)` por un punado de eventos le daria a la cuarentena un
    /// barrido completo que nadie hizo.
    Eventos,
}

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

// ══════════════════════════════ El trabajo ══════════════════════════════════

#[derive(Clone, PartialEq, Eq, Debug)]
pub enum TrabajoId {
    AperturaDe(SegmentoId),
    ObservadosDe(SegmentoId),
    DesvanecidosDe(SegmentoId),
    PadronDe(SegmentoId),
    CierreDe(SegmentoId),
    Byte(u64),
}

/// Una unidad de entrega. **El orden dentro de un segmento es fijo: abrir, observar,
/// desvanecer, cerrar.** Las apariciones van antes que las desapariciones porque una
/// aparicion es un hecho y una desaparicion es una hipotesis: se le entrega a Savia todo
/// lo cierto antes de pedirle que pese lo dudoso, y de paso el corte por volumen pesa
/// las bajas contra un corpus que ya incluye lo que el agente acaba de confirmar.
#[derive(Clone, PartialEq, Eq, Debug)]
pub enum Trabajo {
    AbrirBarrido {
        id: TrabajoId,
        raiz: RaizId,
        total: u64,
    },
    Observar {
        id: TrabajoId,
        raiz: RaizId,
        entradas: Vec<(RutaRelativa, HashAfirmado)>,
    },
    /// El hash de cada entrada ya viene LIGADO al ultimo confirmado — es lo que el tipo
    /// `Desaparicion` garantiza. Las rutas sin hash confirmado no llegan hasta aca.
    Desvanecer {
        id: TrabajoId,
        raiz: RaizId,
        entradas: Vec<(RutaRelativa, HashVerificado)>,
    },
    /// EL PADRON. Todo lo que el barrido VIO, con su hash confirmado o `None`.
    ///
    /// Lleva las entradas encima —a diferencia de `Subir`, que lleva la ruta y deja los
    /// bytes en disco— porque **la enumeracion no se puede volver a leer**. Los bytes
    /// siguen ahi y se releen; el recorrido que vio estas rutas ya termino.
    EnviarPadron {
        id: TrabajoId,
        raiz: RaizId,
        sweep: SweepId,
        entradas: Vec<(RutaRelativa, Option<HashVerificado>)>,
    },
    CerrarBarrido {
        id: TrabajoId,
        raiz: RaizId,
        sweep: SweepId,
        cierre: EstadoDelBarrido,
    },
    /// El PUT directo al almacen. La API no toca bytes.
    Subir {
        id: TrabajoId,
        raiz: RaizId,
        ruta: RutaRelativa,
        hash_afirmado: HashAfirmado,
        permiso: Permiso,
    },
    /// Segunda fase, persistida aparte: si el proceso muere entre el PUT y esto, hay que
    /// reintentar el ACK, **no volver a subir el archivo entero**.
    ConfirmarSubida {
        id: TrabajoId,
        raiz: RaizId,
        ruta: RutaRelativa,
        permiso: PermisoId,
    },
}

/// Por que no hay trabajo, que no es lo mismo que no haber nada.
#[derive(Clone, PartialEq, Eq, Debug)]
pub enum Proximo {
    Trabajo(Box<Trabajo>),
    Nada,
    /// La raiz no drena y no va a drenar sola. El panel lo tiene que decir.
    Detenida(MotivoDeDetencion),
}

/// Se modela como enum y no como `bool` porque la detencion tiene que poder decir POR
/// QUE en el panel, y el dia que haya un segundo motivo el `match` obliga a decidir que
/// se le muestra al usuario.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum MotivoDeDetencion {
    Credenciales,
}

// ══════════════════════════════ La salida ═══════════════════════════════════

/// El desenlace de un trabajo. **NO HAY RAMA «DESCARTAR», y esa ausencia es la
/// garantia**: el `match` de `resolver` es exhaustivo y no tiene brazo `_`, asi que un
/// camino que tire una entrada en silencio no se puede escribir sin agregar aca una
/// variante que alguien tenga que justificar.
#[derive(Clone, PartialEq, Eq, Debug)]
pub enum Desenlace {
    Entregado(Recibido),
    /// Red caida, DNS, timeout, 5xx, 429. Puede llegar; se reintenta.
    Reintentable(String),
    /// 401/403. PARA y avisa. Reintentar con credenciales invalidas no las arregla,
    /// quema el rate limit y deja el panel diciendo «sincronizando» mientras hace dias
    /// que no entra nada. Detiene el DISPOSITIVO ENTERO, no la raiz: el token es por
    /// persona, no por carpeta.
    Credenciales(String),
    /// 4xx que no es 401/403/429. Es inaceptable y va a seguir siendolo. Va a la cola
    /// muerta CON alerta y **envenena la ruta**, para no entregar sus hechos fuera de
    /// orden.
    Rechazado {
        status: u16,
        cuerpo: String,
        culpables: Vec<RutaRelativa>,
    },
    /// Solo valido sobre `Subir`: los bytes ya no estan en disco o cambiaron entre la
    /// decision y el PUT. No se pierde nada porque el objeto nunca llego, asi que el
    /// hash confirmado de esa ruta sigue siendo el anterior y una baja futura matchea.
    IlegibleEnDisco,
    /// `upload.completed` sobre un permiso que ya no esta. **Es AMBIGUO**: o nunca
    /// llego, o ya se consumio y la respuesta se perdio. Ni reintentable ni cola muerta:
    /// la unica salida es volver a observar, que contestara `known` si el objeto
    /// aterrizo. El protocolo se cura solo, pero solo si nadie miente sobre esa
    /// ambiguedad.
    Ambiguo,
}

#[derive(Clone, PartialEq, Eq, Debug)]
pub enum Recibido {
    /// `padron_requerido` viaja PEGADO al `sweepId` y no como una senal aparte porque es
    /// la respuesta a ese `sweep.open` y a ninguno otro. Un barrido reintentado la
    /// vuelve a contestar contra el estado del momento.
    Barrido {
        sweep: SweepId,
        padron_requerido: bool,
    },
    Decisiones(Vec<Veredicto>),
    /// `presence.vanished` y el PUT: no devuelven nada que la cola necesite.
    Nada,
    /// El hash que computo quien LEYO los bytes. Es la autoridad.
    Verificado(HashVerificado),
    /// Lo que `sweep.close` contesto. **Nunca es fuente de verdad del inventario**: un
    /// cierre reintentado devuelve menos retiros.
    ///
    /// `congelada` no habla de estas rutas sino de la RAIZ: Savia disparo su corte por
    /// volumen y esta reteniendo bajas. Viaja pegado a los retiros porque llega en la
    /// misma respuesta y porque significan cosas opuestas — «retire esto» y «no retire
    /// nada de lo que me dijiste»—, y separarlos deja lugar a aplicar uno sin el otro.
    Retirados {
        rutas: Vec<RutaRelativa>,
        congelada: bool,
    },
}

/// Lo que el INVENTARIO tiene que anotar por causa de este desenlace, y que va en la
/// misma transaccion que la mutacion de la cola. **Es el unico mecanismo por el que el
/// agente pasa a creer que Savia sabe algo.**
#[derive(Clone, PartialEq, Eq, Debug)]
pub enum Confirmacion {
    /// Savia tiene estos bytes para esta ruta. Es lo unico que puede viajar como
    /// `lastSeenHash` en una baja futura.
    HashConfirmado {
        ruta: RutaRelativa,
        hash: HashVerificado,
    },
    BajaEntregada {
        ruta: RutaRelativa,
    },
    /// El agente ya no sabe que hash tiene Savia para esta ruta —tipicamente el PUT
    /// salio y el `upload.completed` no volvio—. Se re-observa en el proximo barrido y
    /// el `known` la re-confirma: el sistema se cura por el camino normal.
    HashEnDuda {
        ruta: RutaRelativa,
    },
    Retirados {
        rutas: Vec<RutaRelativa>,
    },
}

// ══════════════════════════════ Cola muerta ═════════════════════════════════

#[derive(serde::Serialize, serde::Deserialize, Clone, PartialEq, Eq, Debug)]
pub struct EntradaMuerta {
    pub id: u64,
    pub raiz: RaizId,
    /// Las rutas que quedan ENVENENADAS. **El veneno es por ruta y no por entrada**
    /// porque saltear una entrada y seguir con la proxima de la misma ruta entrega sus
    /// hechos fuera de orden, que es el desastre que el orden por raiz existe para
    /// evitar. Por ruta, la raiz sigue drenando y solo esa ruta queda quieta.
    pub rutas: Vec<RutaRelativa>,
    pub status: u16,
    pub respuesta: String,
    /// CUANTOS HECHOS POSTERIORES SE RETUVIERON POR ESTE VENENO. Sin este contador, todo
    /// lo que ocurre despues del rechazo es MUDO: la ruta envenenada sigue produciendo
    /// ediciones y bajas, `encolar` las rechaza, `hechos_pendientes` da cero, `degradada`
    /// da `false` —el tope esta en `None`— y el panel muestra la raiz sincronizada
    /// mientras esas rutas ya no existen para Savia. La cola muerta prometia que un `400`
    /// «nunca se descarta en silencio»; el rechazo cumplia y su estela no.
    ///
    /// LO QUE ESTE CONTADOR NO ES: la forma de levantar el veneno. Levantarlo exige
    /// resolver la entrada muerta, y para eso hace falta una superficie de operacion que
    /// todavia no existe. Queda dicho, no inventado.
    pub retenidos: u64,
}

// ══════════════════════════════ El segmento ═════════════════════════════════

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
struct Segmento {
    id: SegmentoId,
    raiz: RaizId,
    origen: OrigenDeSegmento,
    /// La compactacion ES este mapa: encolar es un upsert por ruta.
    hechos: BTreeMap<RutaRelativa, Hecho>,
    /// El orden de llegada, para que el lote salga como se observo y no como ordena el
    /// mapa. Compactar borra filas; **no reordena ninguna**.
    orden: Vec<RutaRelativa>,
    abierto: bool,
    cierre: Option<EstadoDelBarrido>,
    sweep: Option<SweepId>,
    apertura_entregada: bool,
    observados_entregados: bool,
    desvanecidos_entregados: bool,
    cierre_entregado: bool,
    /// EL PADRON DEL BARRIDO LOCAL, guardado ANTES de saber si hace falta.
    ///
    /// Quien contesta si hace falta es `sweep.open`, y para entonces el recorrido ya
    /// termino: guardarlo solo cuando se lo pide llega tarde por un barrido entero. Se
    /// llena siempre al cerrar el barrido local y cuesta lo mismo que la lista de rutas
    /// que ese barrido ya tenia entera en memoria.
    padron: Option<Vec<(RutaRelativa, Option<HashVerificado>)>>,
    /// Lo que contesto `sweep.open`. `false` es el caso comun —agente y Savia coinciden—
    /// y `true` significa que Savia sabe de documentos que el agente no reporta ni como
    /// presentes ni como ausentes.
    padron_requerido: bool,
    padron_entregado: bool,
    intentos: u32,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
struct BytePendiente {
    id: u64,
    raiz: RaizId,
    ruta: RutaRelativa,
    hash_afirmado: HashAfirmado,
    permiso: Permiso,
    /// Dos fases: un ACK perdido reintenta el ACK, no el archivo entero.
    subido: bool,
    intentos: u32,
}

// ═══════════════════════════════ Las colas ══════════════════════════════════

/// Los numeros de este modulo, todos sin valor por omision.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug)]
pub struct ParametrosDeCola {
    /// Ver `parametros::MAX_INTENTOS`: decide cuando la raiz se muestra DEGRADADA,
    /// **nunca cuando se descarta un hecho**.
    pub max_intentos: Option<u32>,
    /// Entradas por llamada. No es un numero del canal sino un limite del SERVIDOR, que
    /// el protocolo no declara todavia. `None` = el segmento entero en una llamada.
    pub max_entradas_por_lote: Option<usize>,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct Colas {
    parametros: ParametrosDeCola,
    segmentos: Vec<Segmento>,
    bytes: Vec<BytePendiente>,
    muertas: Vec<EntradaMuerta>,
    #[serde(with = "crate::dominio::mapa_como_lista")]
    envenenadas: BTreeMap<(RaizId, RutaRelativa), u64>,
    /// Las raices donde el ULTIMO `sweep.close` contesto `frozen`. Es un conjunto y no
    /// un contador: no interesa cuantas veces congelo, interesa si esta congelada ahora.
    /// Vive en la cola y no en el inventario porque no es un hecho sobre documentos —
    /// ningun documento cambio— sino sobre lo que Savia esta dispuesto a aplicar.
    congeladas: BTreeSet<RaizId>,
    detenido: Option<MotivoDeDetencion>,
    proximo_id: u64,
}

#[derive(Clone, PartialEq, Eq, Debug)]
pub enum Encolado {
    Nuevo,
    /// Se devuelve para poder CONTARLO: un contador que se dispara es la medicion del
    /// intervalo de asentamiento —si compacta mucho, se esta viendo tipear al usuario—
    /// y ese numero esta sin medir.
    Compactado,
    /// No entro: la ruta esta envenenada por una entrada muerta.
    Envenenado,
}

impl Colas {
    pub fn nuevas(parametros: ParametrosDeCola) -> Self {
        Self {
            parametros,
            segmentos: Vec::new(),
            bytes: Vec::new(),
            muertas: Vec::new(),
            envenenadas: BTreeMap::new(),
            congeladas: BTreeSet::new(),
            detenido: None,
            proximo_id: 1,
        }
    }

    fn id(&mut self) -> u64 {
        let x = self.proximo_id;
        self.proximo_id += 1;
        x
    }

    /// Cierra el segmento de eventos abierto, si hay, y abre uno de barrido con su
    /// denominador. El `total` es lo que el corte por volumen compara contra algo.
    pub fn abrir_barrido(&mut self, raiz: &RaizId, barrido: BarridoId, total: u64) -> SegmentoId {
        self.cerrar_segmento_de_eventos(raiz);
        let id = SegmentoId(self.id());
        self.segmentos.push(Segmento {
            id,
            raiz: raiz.clone(),
            origen: OrigenDeSegmento::Barrido { total, barrido },
            padron: None,
            padron_requerido: false,
            padron_entregado: false,
            hechos: BTreeMap::new(),
            orden: Vec::new(),
            abierto: true,
            cierre: None,
            sweep: None,
            apertura_entregada: false,
            observados_entregados: false,
            desvanecidos_entregados: false,
            cierre_entregado: false,
            intentos: 0,
        });
        id
    }

    pub fn cerrar_barrido(&mut self, segmento: SegmentoId, cierre: EstadoDelBarrido) {
        if let Some(s) = self.segmentos.iter_mut().find(|s| s.id == segmento) {
            s.abierto = false;
            s.cierre = Some(cierre);
        }
    }

    /// EL PADRON DEL BARRIDO QUE ACABA DE TERMINAR. Se registra SIEMPRE, sin saber
    /// todavia si Savia lo va a pedir.
    ///
    /// **NO SALE DEL INVENTARIO, SALE DE LA ENUMERACION**, y no es un matiz. Un archivo
    /// deshidratado que el agente ve por primera vez no se lee y no deja fila
    /// —`Paso::nada(Nodo::Omitido)`, cero efectos—, asi que un padron derivado del
    /// inventario lo omitiria y Savia retiraria un archivo que esta perfectamente ahi.
    /// La lista de lo presente la tiene el recorrido, no la creencia.
    ///
    /// Sin `entradas`, o con el barrido interrumpido, no se registra nada: un padron
    /// parcial presentado como el universo de lo presente retira todo lo que el
    /// recorrido no llego a mirar.
    pub fn registrar_padron(
        &mut self,
        segmento: SegmentoId,
        entradas: Vec<(RutaRelativa, Option<HashVerificado>)>,
    ) {
        if let Some(s) = self.segmentos.iter_mut().find(|s| s.id == segmento) {
            s.padron = Some(entradas);
        }
    }

    fn cerrar_segmento_de_eventos(&mut self, raiz: &RaizId) {
        for s in self.segmentos.iter_mut() {
            if &s.raiz == raiz && s.abierto && matches!(s.origen, OrigenDeSegmento::Eventos) {
                s.abierto = false;
            }
        }
    }

    fn segmento_abierto(&mut self, raiz: &RaizId) -> SegmentoId {
        if let Some(s) = self
            .segmentos
            .iter()
            .rev()
            .find(|s| &s.raiz == raiz && s.abierto)
        {
            return s.id;
        }
        let id = SegmentoId(self.id());
        self.segmentos.push(Segmento {
            id,
            raiz: raiz.clone(),
            origen: OrigenDeSegmento::Eventos,
            // Un segmento de eventos no abre barrido, asi que nadie le puede pedir el
            // padron: estos tres se quedan como nacen.
            padron: None,
            padron_requerido: false,
            padron_entregado: false,
            hechos: BTreeMap::new(),
            orden: Vec::new(),
            abierto: true,
            cierre: None,
            sweep: None,
            apertura_entregada: true,
            observados_entregados: false,
            desvanecidos_entregados: false,
            // Un segmento de eventos no emite marcadores: se marcan entregados de
            // entrada para que el drenador no los busque nunca.
            cierre_entregado: true,
            intentos: 0,
        });
        id
    }

    /// Encola y COMPACTA en el mismo movimiento. Si ya habia un hecho para esa ruta en el
    /// segmento ABIERTO, lo reemplaza; **nunca toca un segmento ya cerrado**, que es la
    /// barrera. Invalida ademas el byte pendiente de esa `(raiz, ruta)`: esos bytes ya no
    /// existen y subirlos es gastar el ancho de banda del usuario.
    pub fn encolar(&mut self, raiz: &RaizId, hecho: Hecho) -> Encolado {
        let ruta = match &hecho {
            Hecho::Aparecio(a) => a.ruta().clone(),
            Hecho::Desaparecio(d) => d.ruta().clone(),
        };
        if let Some(muerta) = self.envenenadas.get(&(raiz.clone(), ruta.clone())).copied() {
            // NO SE PIERDE EN SILENCIO. El hecho no entra —entregarlo despues del que fue
            // rechazado seria entregar fuera de orden, que es el desastre que el veneno
            // existe para evitar— pero queda contado contra la entrada muerta que lo
            // retiene, que es lo que el panel muestra y lo que una persona resuelve.
            if let Some(e) = self.muertas.iter_mut().find(|e| e.id == muerta) {
                e.retenidos += 1;
            }
            return Encolado::Envenenado;
        }
        self.bytes
            .retain(|b| !(b.raiz == *raiz && b.ruta == ruta && !b.subido));
        let sid = self.segmento_abierto(raiz);
        let s = self
            .segmentos
            .iter_mut()
            .find(|s| s.id == sid)
            .expect("el segmento se acaba de garantizar");
        let ya_estaba = s.hechos.insert(ruta.clone(), hecho).is_some();
        if !ya_estaba {
            s.orden.push(ruta);
            Encolado::Nuevo
        } else {
            Encolado::Compactado
        }
    }

    /// El proximo trabajo de esa raiz, o por que no hay.
    ///
    /// **HECHOS PRIMERO SIEMPRE**: mientras quede un segmento sin entregar, no devuelve
    /// un `Subir` de esa raiz. Es una lectura pura —no marca nada en vuelo—, asi que una
    /// caida en medio de una llamada solo repite la llamada, y las seis toleran
    /// repetirse.
    pub fn siguiente(&self, raiz: &RaizId) -> Proximo {
        if let Some(m) = self.detenido {
            return Proximo::Detenida(m);
        }
        // Los segmentos se entregan en orden estricto de apertura por raiz.
        for s in self.segmentos.iter().filter(|s| &s.raiz == raiz) {
            if s.abierto {
                // Un segmento abierto no se transmite: NINGUNA baja viaja con un barrido
                // abierto de esa raiz, porque `cerrar_barrido` todavia puede anularla.
                return Proximo::Nada;
            }
            if let Some(t) = self.trabajo_de(s) {
                return Proximo::Trabajo(Box::new(t));
            }
        }
        // Recien ahora, los bytes — y **solo el primero**: un solo trabajo en vuelo por
        // raiz. Dos en paralelo reordenan, y el orden ES el significado.
        if let Some(b) = self.bytes.iter().find(|b| &b.raiz == raiz) {
            if !b.subido {
                return Proximo::Trabajo(Box::new(Trabajo::Subir {
                    id: TrabajoId::Byte(b.id),
                    raiz: b.raiz.clone(),
                    ruta: b.ruta.clone(),
                    hash_afirmado: b.hash_afirmado,
                    permiso: b.permiso.clone(),
                }));
            }
            return Proximo::Trabajo(Box::new(Trabajo::ConfirmarSubida {
                id: TrabajoId::Byte(b.id),
                raiz: b.raiz.clone(),
                ruta: b.ruta.clone(),
                permiso: b.permiso.id.clone(),
            }));
        }
        Proximo::Nada
    }

    fn trabajo_de(&self, s: &Segmento) -> Option<Trabajo> {
        let es_barrido = matches!(s.origen, OrigenDeSegmento::Barrido { .. });
        if es_barrido && !s.apertura_entregada {
            let OrigenDeSegmento::Barrido { total, .. } = &s.origen else {
                unreachable!("recien verificado")
            };
            return Some(Trabajo::AbrirBarrido {
                id: TrabajoId::AperturaDe(s.id),
                raiz: s.raiz.clone(),
                total: *total,
            });
        }
        if !s.observados_entregados {
            let entradas: Vec<_> = self
                .lote(s)
                .into_iter()
                .filter_map(|h| match h {
                    Hecho::Aparecio(a) => Some((a.ruta().clone(), *a.hash())),
                    Hecho::Desaparecio(_) => None,
                })
                .collect();
            if !entradas.is_empty() {
                return Some(Trabajo::Observar {
                    id: TrabajoId::ObservadosDe(s.id),
                    raiz: s.raiz.clone(),
                    entradas,
                });
            }
        }
        if !s.desvanecidos_entregados {
            let entradas: Vec<_> = self
                .lote(s)
                .into_iter()
                .filter_map(|h| match h {
                    Hecho::Desaparecio(d) => Some((d.ruta().clone(), *d.ultimo_hash())),
                    Hecho::Aparecio(_) => None,
                })
                .collect();
            if !entradas.is_empty() {
                return Some(Trabajo::Desvanecer {
                    id: TrabajoId::DesvanecidosDe(s.id),
                    raiz: s.raiz.clone(),
                    entradas,
                });
            }
        }
        // EL PADRON, Y SU LUGAR ES ESTE: despues de los hechos e **inmediatamente antes
        // del cierre**, porque la diferencia de conjuntos se aplica en `sweep.close`.
        // Despues del cierre llega tarde y no la aplica nadie.
        if es_barrido
            && s.padron_requerido
            && !s.padron_entregado
            && let (Some(sweep), Some(padron)) = (s.sweep.clone(), s.padron.as_ref())
        {
            return Some(Trabajo::EnviarPadron {
                id: TrabajoId::PadronDe(s.id),
                raiz: s.raiz.clone(),
                sweep,
                // **NO PASA POR `lote()`**, y ahi esta la diferencia entre demorar y
                // mentir. Un lote de hechos truncado demora: lo que quedo afuera sale en
                // la vuelta siguiente. Un PADRON truncado AFIRMA «esto es todo lo que
                // veo», y Savia retira todo lo que no figure. La unica cota legitima
                // seria el limite real del servidor, que el protocolo no declara.
                entradas: padron.clone(),
            });
        }
        if es_barrido
            && !s.cierre_entregado
            && let (Some(sweep), Some(cierre)) = (s.sweep.clone(), s.cierre)
        {
            return Some(Trabajo::CerrarBarrido {
                id: TrabajoId::CierreDe(s.id),
                raiz: s.raiz.clone(),
                sweep,
                cierre,
            });
        }
        None
    }

    fn lote(&self, s: &Segmento) -> Vec<Hecho> {
        let mut v: Vec<Hecho> = s
            .orden
            .iter()
            .filter_map(|r| s.hechos.get(r).cloned())
            .collect();
        if let Some(n) = self.parametros.max_entradas_por_lote {
            v.truncate(n);
        }
        v
    }

    /// Las bajas encoladas que el cierre del barrido decidio anular. Se aplica **ANTES**
    /// de transmitir: es la mitad del contrato con la maquina.
    pub fn anular_bajas(&mut self, raiz: &RaizId, rutas: &[RutaRelativa]) {
        for s in self.segmentos.iter_mut().filter(|s| &s.raiz == raiz) {
            for r in rutas {
                if matches!(s.hechos.get(r), Some(Hecho::Desaparecio(_))) {
                    s.hechos.remove(r);
                    s.orden.retain(|x| x != r);
                }
            }
        }
    }

    /// **EL UNICO camino por el que un trabajo sale de la cola**, y `Desenlace` no tiene
    /// rama «descartar». Devuelve lo que el inventario tiene que anotar, para que el
    /// llamador lo escriba EN ESTA MISMA TRANSACCION.
    pub fn resolver(&mut self, trabajo: &TrabajoId, desenlace: Desenlace) -> Vec<Confirmacion> {
        match desenlace {
            Desenlace::Entregado(r) => self.entregado(trabajo, r),
            Desenlace::Reintentable(_) => {
                // `intentos += 1` y nada se mueve de lugar. El tope NO descarta: solo
                // decide si el panel muestra la raiz degradada.
                self.sumar_intento(trabajo);
                Vec::new()
            }
            Desenlace::Credenciales(_) => {
                // Detiene el DISPOSITIVO ENTERO y NO detiene al observador: el
                // inventario se sigue actualizando y la cola se sigue llenando, acotada
                // por la compactacion. Si el observador parara, las bajas de esa ventana
                // se perderian — y una baja perdida deja un documento indexado para
                // siempre.
                self.detenido = Some(MotivoDeDetencion::Credenciales);
                Vec::new()
            }
            Desenlace::Rechazado {
                status,
                cuerpo,
                culpables,
            } => {
                self.a_cola_muerta(trabajo, status, cuerpo, culpables);
                // **Y SALE DE LA COLA.** `Clase::ColaMuerta` significa «es inaceptable y
                // va a seguir siendolo»: dejar el trabajo adentro lo reintenta en cada
                // barrido para siempre. Sobre un `Subir` eso re-sube el archivo ENTERO
                // cada vuelta —plata del usuario por un enlace medido—, tapa la cabeza de
                // la cola de bytes de esa raiz, y acumula una entrada muerta duplicada por
                // barrido hasta volver ilegible la alerta. Sobre un marcador de segmento
                // es peor: `rutas_de` no devuelve rutas para esos ids, asi que no
                // envenenaba nada, no marcaba nada entregado, y la raiz entera dejaba de
                // drenar.
                self.dar_por_terminado(trabajo);
                Vec::new()
            }
            Desenlace::IlegibleEnDisco => {
                if let TrabajoId::Byte(id) = trabajo {
                    self.bytes.retain(|b| b.id != *id);
                }
                Vec::new()
            }
            Desenlace::Ambiguo => self.ambiguo(trabajo),
        }
    }

    /// AMBIGUO: no se sabe si el efecto ocurrio, y cada trabajo paga esa duda distinto.
    ///
    /// El brazo original solo atendia `TrabajoId::Byte`. Sobre un marcador de segmento no
    /// movia nada, `siguiente` devolvia el MISMO trabajo, y `drenar` —que cuenta `Ambiguo`
    /// como progreso— giraba para siempre. El disparador ni siquiera es exotico: el
    /// simulador contesta `200 {error:"barrido desconocido"}` cuando el `sweepId` ya no
    /// esta, que es exactamente lo que devuelve un servidor reiniciado con un barrido
    /// abierto — el caso para el que el diseno persiste el `sweepId`.
    fn ambiguo(&mut self, trabajo: &TrabajoId) -> Vec<Confirmacion> {
        let mut out = Vec::new();
        match trabajo {
            // El PUT salio y el ACK no volvio, o al reves. Se saca de la cola y se marca
            // la ruta EN DUDA, para que el proximo barrido la re-observe y el `known` la
            // re-confirme.
            TrabajoId::Byte(id) => {
                if let Some(b) = self.bytes.iter().find(|b| b.id == *id) {
                    out.push(Confirmacion::HashEnDuda {
                        ruta: b.ruta.clone(),
                    });
                }
                let id = *id;
                self.bytes.retain(|b| b.id != id);
            }
            // `sweep.open` no es idempotente: reintentarlo abriria un SEGUNDO barrido y
            // seguiria sin decir nada del primero. Se da por entregado sin `sweepId`, con
            // lo que el cierre de ese segmento no se emite —no hay barrido que nombrar— y
            // los hechos, que no lo referencian, siguen viajando.
            TrabajoId::AperturaDe(sid) => {
                if let Some(s) = self.segmentos.iter_mut().find(|s| s.id == *sid) {
                    s.apertura_entregada = true;
                }
            }
            // Puede que Savia los tenga y puede que no. Se sacan del camino y las rutas
            // quedan EN DUDA: el proximo barrido las vuelve a observar sin leer un byte, y
            // el `known` cierra la pregunta. Es el mismo camino de cura del ACK perdido.
            TrabajoId::ObservadosDe(sid) => {
                if let Some(s) = self.segmentos.iter_mut().find(|s| s.id == *sid) {
                    for (r, h) in s.hechos.iter() {
                        if matches!(h, Hecho::Aparecio(_)) {
                            out.push(Confirmacion::HashEnDuda { ruta: r.clone() });
                        }
                    }
                    s.observados_entregados = true;
                }
            }
            // **LAS BAJAS NO SE DAN POR ENTREGADAS SIN SABERLO, Y ES LA ASIMETRIA DEL
            // CANAL.** Una lapida no se puede volver a derivar: `ausentes_desde` solo mira
            // el barrido en curso, asi que un `presence.vanished` descartado aca no vuelve
            // NUNCA — «una baja perdida deja un documento indexado para siempre». El
            // trabajo se queda, se cuenta el intento, y la raiz se ve degradada. Bloquear
            // con la alerta puesta es mejor que perder la baja, y `drenar` no gira porque
            // corta cuando el trabajo se repite.
            TrabajoId::DesvanecidosDe(_) => self.sumar_intento(trabajo),
            // **EL UNICO TRABAJO QUE SE PUEDE PERDER SIN PERDER NADA**, y por eso no se
            // reintenta como una baja. Un padron que no llega deja el desfase sin
            // corregir, y el proximo `sweep.open` lo vuelve a detectar y lo vuelve a
            // pedir: el mecanismo que produjo el trabajo es el mismo que repara su
            // perdida. Bloquear el segmento en cambio SI cuesta —el cierre no sale, el
            // barrido queda abierto del otro lado, y la cuarentena nunca recibe el
            // barrido completo que exige—.
            TrabajoId::PadronDe(sid) => {
                if let Some(s) = self.segmentos.iter_mut().find(|s| s.id == *sid) {
                    s.padron_entregado = true;
                }
            }
            // El barrido ya no existe del otro lado. Reintentar da la misma respuesta para
            // siempre y bloquea todos los segmentos posteriores de la raiz.
            TrabajoId::CierreDe(sid) => {
                if let Some(s) = self.segmentos.iter_mut().find(|s| s.id == *sid) {
                    s.cierre_entregado = true;
                }
            }
        }
        out
    }

    /// Saca el trabajo de la cola sin afirmar que llego. **No hay ningun camino que
    /// termine un trabajo en silencio**: el unico que llama a esto —el rechazo no
    /// reintentable— deja antes su entrada en la cola muerta, con su alerta y con las
    /// rutas envenenadas.
    fn dar_por_terminado(&mut self, trabajo: &TrabajoId) {
        match trabajo {
            TrabajoId::AperturaDe(sid) => {
                if let Some(s) = self.segmentos.iter_mut().find(|s| s.id == *sid) {
                    s.apertura_entregada = true;
                }
            }
            TrabajoId::ObservadosDe(sid) => {
                if let Some(s) = self.segmentos.iter_mut().find(|s| s.id == *sid) {
                    s.observados_entregados = true;
                }
            }
            TrabajoId::DesvanecidosDe(sid) => {
                if let Some(s) = self.segmentos.iter_mut().find(|s| s.id == *sid) {
                    s.desvanecidos_entregados = true;
                }
            }
            TrabajoId::PadronDe(sid) => {
                if let Some(s) = self.segmentos.iter_mut().find(|s| s.id == *sid) {
                    s.padron_entregado = true;
                }
            }
            TrabajoId::CierreDe(sid) => {
                if let Some(s) = self.segmentos.iter_mut().find(|s| s.id == *sid) {
                    s.cierre_entregado = true;
                }
            }
            TrabajoId::Byte(id) => {
                let id = *id;
                self.bytes.retain(|b| b.id != id);
            }
        }
    }

    fn entregado(&mut self, trabajo: &TrabajoId, recibido: Recibido) -> Vec<Confirmacion> {
        let mut out = Vec::new();
        match (trabajo, recibido) {
            (
                TrabajoId::AperturaDe(sid),
                Recibido::Barrido {
                    sweep,
                    padron_requerido,
                },
            ) => {
                if let Some(s) = self.segmentos.iter_mut().find(|s| s.id == *sid) {
                    s.apertura_entregada = true;
                    s.padron_requerido = padron_requerido;
                    // Se PERSISTE el `sweepId`: si el proceso muere entre el
                    // `sweep.open` y el `sweep.close`, sin esto el cierre no tiene a que
                    // referirse y el barrido queda abierto del otro lado para siempre —
                    // con lo que la cuarentena nunca recibe el barrido completo que
                    // exige y ninguna ausencia se resuelve jamas.
                    s.sweep = Some(sweep);
                    s.intentos = 0;
                }
            }
            (TrabajoId::PadronDe(sid), Recibido::Nada) => {
                if let Some(s) = self.segmentos.iter_mut().find(|s| s.id == *sid) {
                    s.padron_entregado = true;
                    s.intentos = 0;
                }
            }
            (TrabajoId::ObservadosDe(sid), Recibido::Decisiones(vs)) => {
                for v in vs {
                    match v.decision {
                        Decision::Known { verificado } => out.push(Confirmacion::HashConfirmado {
                            ruta: v.ruta,
                            hash: verificado,
                        }),
                        Decision::Upload { permiso } => {
                            // LA COLA DE BYTES TIENE UN SOLO PRODUCTOR, Y ES ESTA LINEA.
                            let id = self.id();
                            let raiz = self
                                .segmentos
                                .iter()
                                .find(|s| s.id == *sid)
                                .map(|s| s.raiz.clone());
                            if let Some(raiz) = raiz {
                                self.bytes.push(BytePendiente {
                                    id,
                                    raiz,
                                    ruta: v.ruta,
                                    hash_afirmado: v.afirmado,
                                    permiso,
                                    subido: false,
                                    intentos: 0,
                                });
                            }
                        }
                    }
                }
                if let Some(s) = self.segmentos.iter_mut().find(|s| s.id == *sid) {
                    s.observados_entregados = true;
                    s.intentos = 0;
                }
            }
            (TrabajoId::DesvanecidosDe(sid), _) => {
                if let Some(s) = self.segmentos.iter_mut().find(|s| s.id == *sid) {
                    for (r, h) in s.hechos.clone() {
                        if let Hecho::Desaparecio(_) = h {
                            out.push(Confirmacion::BajaEntregada { ruta: r });
                        }
                    }
                    s.desvanecidos_entregados = true;
                    s.intentos = 0;
                }
            }
            (TrabajoId::CierreDe(sid), Recibido::Retirados { rutas, congelada }) => {
                out.push(Confirmacion::Retirados { rutas });
                let raiz = self.segmentos.iter_mut().find(|s| s.id == *sid).map(|s| {
                    s.cierre_entregado = true;
                    s.intentos = 0;
                    s.raiz.clone()
                });
                // SE PISA ENTERO EN CADA CIERRE, no se acumula. `false` TIENE que poder
                // descongelar: si solo se insertara, una raiz congelada una vez quedaria
                // congelada para siempre en el panel aunque Savia ya la haya soltado.
                if let Some(raiz) = raiz {
                    if congelada {
                        self.congeladas.insert(raiz);
                    } else {
                        self.congeladas.remove(&raiz);
                    }
                }
            }
            (TrabajoId::CierreDe(sid), _) => {
                if let Some(s) = self.segmentos.iter_mut().find(|s| s.id == *sid) {
                    s.cierre_entregado = true;
                }
            }
            (TrabajoId::Byte(id), Recibido::Verificado(h)) => {
                if let Some(b) = self.bytes.iter().find(|b| b.id == *id) {
                    // Se escribe el hash VERIFICADO sobre el afirmado. Aca se cierra la
                    // divergencia.
                    out.push(Confirmacion::HashConfirmado {
                        ruta: b.ruta.clone(),
                        hash: h,
                    });
                }
                let id = *id;
                self.bytes.retain(|b| b.id != id);
            }
            (TrabajoId::Byte(id), _) => {
                // El PUT termino. La confirmacion es otra fase, para que un ACK perdido
                // no cueste re-subir el archivo entero.
                if let Some(b) = self.bytes.iter_mut().find(|b| b.id == *id) {
                    b.subido = true;
                    b.intentos = 0;
                }
            }
            _ => {}
        }
        out
    }

    fn sumar_intento(&mut self, trabajo: &TrabajoId) {
        match trabajo {
            TrabajoId::AperturaDe(s)
            | TrabajoId::ObservadosDe(s)
            | TrabajoId::DesvanecidosDe(s)
            | TrabajoId::PadronDe(s)
            | TrabajoId::CierreDe(s) => {
                if let Some(x) = self.segmentos.iter_mut().find(|x| x.id == *s) {
                    x.intentos += 1;
                }
            }
            TrabajoId::Byte(id) => {
                if let Some(b) = self.bytes.iter_mut().find(|b| b.id == *id) {
                    b.intentos += 1;
                }
            }
        }
    }

    fn a_cola_muerta(
        &mut self,
        trabajo: &TrabajoId,
        status: u16,
        cuerpo: String,
        culpables: Vec<RutaRelativa>,
    ) {
        let raiz = self.raiz_de(trabajo);
        let Some(raiz) = raiz else { return };
        let id = self.id();
        let rutas = if culpables.is_empty() {
            self.rutas_de(trabajo)
        } else {
            culpables
        };
        for r in &rutas {
            self.envenenadas.insert((raiz.clone(), r.clone()), id);
        }
        for s in self.segmentos.iter_mut().filter(|s| s.raiz == raiz) {
            for r in &rutas {
                s.hechos.remove(r);
                s.orden.retain(|x| x != r);
            }
        }
        self.muertas.push(EntradaMuerta {
            id,
            raiz,
            rutas,
            status,
            respuesta: cuerpo,
            retenidos: 0,
        });
    }

    fn raiz_de(&self, trabajo: &TrabajoId) -> Option<RaizId> {
        match trabajo {
            TrabajoId::AperturaDe(s)
            | TrabajoId::ObservadosDe(s)
            | TrabajoId::DesvanecidosDe(s)
            | TrabajoId::PadronDe(s)
            | TrabajoId::CierreDe(s) => self
                .segmentos
                .iter()
                .find(|x| x.id == *s)
                .map(|x| x.raiz.clone()),
            TrabajoId::Byte(id) => self
                .bytes
                .iter()
                .find(|b| b.id == *id)
                .map(|b| b.raiz.clone()),
        }
    }

    fn rutas_de(&self, trabajo: &TrabajoId) -> Vec<RutaRelativa> {
        match trabajo {
            TrabajoId::ObservadosDe(s) | TrabajoId::DesvanecidosDe(s) => self
                .segmentos
                .iter()
                .find(|x| x.id == *s)
                .map(|x| x.orden.clone())
                .unwrap_or_default(),
            TrabajoId::Byte(id) => self
                .bytes
                .iter()
                .find(|b| b.id == *id)
                .map(|b| vec![b.ruta.clone()])
                .unwrap_or_default(),
            _ => Vec::new(),
        }
    }

    /// Suelta TODO lo pendiente de una raiz: segmentos, bytes, muertas, envenenadas y la
    /// marca de congelada. Devuelve cuantos trabajos se soltaron, para poder decirlo.
    ///
    /// **Es la otra mitad de `desenrolar`, y sin ella «quitar» seguiria subiendo.** Las
    /// filas del inventario sobreviven a proposito; lo ENCOLADO no puede: son cosas que el
    /// agente todavia no le dijo a Savia sobre una carpeta que la persona acaba de sacar
    /// de la lista. Drenarlas despues seria hacer exactamente lo que pidio que dejara de
    /// hacer.
    ///
    /// **NO CIERRA EL BARRIDO ABIERTO, Y POR ESO NO SE LLAMA CON UNO ABIERTO.** Un
    /// segmento abierto tiene un `sweepId` que Savia esta esperando cerrar; soltarlo aca
    /// deja ese barrido colgado del otro lado. Quien llama es el bucle de trabajo, entre
    /// vuelta y vuelta, que es el unico momento en que se sabe que no hay ninguno abierto.
    /// El `debug_assert` lo fija: si alguna vez se llama desde otro lado, revienta en las
    /// pruebas y no en produccion.
    pub fn olvidar(&mut self, raiz: &RaizId) -> usize {
        debug_assert!(
            !self.barriendo(raiz),
            "olvidar() con un barrido abierto deja el `sweepId` colgado en Savia"
        );
        let antes = self.segmentos.len() + self.bytes.len() + self.muertas.len();
        self.segmentos.retain(|s| s.raiz != *raiz);
        self.bytes.retain(|b| b.raiz != *raiz);
        self.muertas.retain(|m| m.raiz != *raiz);
        self.envenenadas.retain(|(r, _), _| r != raiz);
        self.congeladas.remove(raiz);
        antes - (self.segmentos.len() + self.bytes.len() + self.muertas.len())
    }

    pub fn cola_muerta(&self) -> &[EntradaMuerta] {
        &self.muertas
    }

    /// Si hay un barrido ABIERTO sobre esta raiz. Es lo unico que separa «no pasa nada»
    /// de «esta trabajando», y sin esto el panel no puede decir ninguna de las dos.
    pub fn barriendo(&self, raiz: &RaizId) -> bool {
        self.segmentos.iter().any(|s| s.raiz == *raiz && s.abierto)
    }

    /// Si el ULTIMO cierre de esta raiz vino congelado. Ver `Recibido::Retirados`.
    pub fn congelada(&self, raiz: &RaizId) -> bool {
        self.congeladas.contains(raiz)
    }

    pub fn detenido(&self) -> Option<MotivoDeDetencion> {
        self.detenido
    }

    /// Derivado de `max_intentos`, no guardado. Con el parametro en `None` es siempre
    /// `false` y el panel se apoya en la antiguedad del ultimo contacto, que dice lo
    /// mismo sin inventar un umbral.
    pub fn degradada(&self, raiz: &RaizId) -> bool {
        let Some(tope) = self.parametros.max_intentos else {
            return false;
        };
        self.segmentos
            .iter()
            .filter(|s| &s.raiz == raiz)
            .any(|s| s.intentos >= tope)
            || self
                .bytes
                .iter()
                .filter(|b| &b.raiz == raiz)
                .any(|b| b.intentos >= tope)
    }

    /// LOS HECHOS QUE UNA ENTRADA MUERTA ESTA RETENIENDO en esta raiz. Es lo que impide
    /// que el panel diga «sincronizado» sobre una raiz cuyas rutas envenenadas ya no le
    /// llegan a Savia: `hechos_pendientes` da cero —no estan en ninguna cola— y
    /// `degradada` da `false` mientras `max_intentos` siga en `None`, asi que sin este
    /// numero no hay ninguna senal.
    pub fn hechos_retenidos(&self, raiz: &RaizId) -> u64 {
        self.muertas
            .iter()
            .filter(|m| &m.raiz == raiz)
            .map(|m| m.retenidos)
            .sum()
    }

    /// Las rutas que hoy no pueden entrar a la cola de esa raiz. El panel las nombra: una
    /// alerta que no dice CUAL ruta obliga a leer el log entero.
    pub fn rutas_envenenadas(&self, raiz: &RaizId) -> Vec<RutaRelativa> {
        self.envenenadas
            .keys()
            .filter(|(r, _)| r == raiz)
            .map(|(_, ruta)| ruta.clone())
            .collect()
    }

    pub fn hechos_pendientes(&self, raiz: &RaizId) -> u64 {
        self.segmentos
            .iter()
            .filter(|s| &s.raiz == raiz)
            .map(|s| s.hechos.len() as u64)
            .sum()
    }

    pub fn bytes_pendientes(&self, raiz: &RaizId) -> u64 {
        self.bytes.iter().filter(|b| &b.raiz == raiz).count() as u64
    }
}

/// Solo para que el banco pueda construir hechos sin pasar por la maquina cuando lo que
/// prueba es la COLA y no el arbol de decision.
pub fn aparicion(ruta: RutaRelativa, hash: HashAfirmado) -> Hecho {
    Hecho::Aparecio(Aparicion::nueva(ruta, hash))
}

/// No hay `fn desaparicion(...)` publica, y eso no es un olvido: una `Desaparicion` solo
/// se construye pasando por `salvaguardas::puerta_de_baja`, que exige el `EstadoDeRaiz`.
pub fn desaparicion_de(d: Desaparicion) -> Hecho {
    Hecho::Desaparecio(d)
}
