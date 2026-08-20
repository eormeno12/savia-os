//! El espejo local de lo que Savia sabe.
//!
//! Su trabajo entero cabe en una frase: **que `estadoDeReporte` y la cola no puedan
//! discrepar nunca**, porque la unica mentira intolerable de este canal es que el agente
//! crea que Savia sabe algo que no sabe.
//!
//! TRES FORMAS, Y CADA UNA CIERRA UN AGUJERO CONCRETO:
//!
//!  1. **La fila es un ENUM, no dos campos.** `Presente { observacion, hash }` o
//!     `Ausente { ultimo_hash, desde }`, excluyentes. Con la fila como struct plano, un
//!     archivo que se va, se reporta la baja, y VUELVE con la misma tripleta hace que
//!     la comparacion conteste «iguales», no salga ningun `aparecio`, y Savia lo retire
//!     con el archivo ahi, en la carpeta, a la vista. Con el enum, **una fila ausente no
//!     tiene observacion contra la cual algo pueda ser igual**, y la contradiccion es
//!     inexpresable en vez de detectable.
//!
//!  2. **El hash de la fila dice si Savia lo confirmo.** `Afirmado` es lo que el agente
//!     computo; `Confirmado` es lo que volvio en un `known` o en el `verifiedHash` de
//!     `upload.completed`. Solo el segundo puede viajar en una baja: si el usuario edito
//!     cinco veces sin conexion y despues borro, una baja con el afirmado no matchea
//!     ningun documento y el archivo borrado se queda en la busqueda para siempre.
//!
//!  3. **`EstadoDeReporte` no tiene un valor `Enviado`.** Seria una creencia sobre una
//!     PETICION. Solo una RESPUESTA RECIBIDA mueve el estado, y la consecuencia es que
//!     la unica divergencia alcanzable tras un corte es «Savia sabe y el agente no»,
//!     que converge sola en el proximo reporte con un `known` y cero bytes.
//!
//! **UN INVENTARIO VACIO NO PUEDE PRODUCIR UNA SOLA BAJA**, y eso no necesita una rama:
//! el conjunto de ausencias se calcula desde el inventario, asi que sale de la forma.
//! Primer barrido, todo `observed`, Savia contesta `known`, cero bytes.
#![forbid(unsafe_code)]

use crate::dominio::{
    BarridoId, ClaveDeRuta, HashAfirmado, HashVerificado, Instante, Observacion, RaizId,
    RutaRelativa, clave_de_ruta,
};
use crate::plataforma::RaizRegistrada;
use crate::salvaguardas::Candidato;
use std::collections::BTreeMap;

// ═══════════════════════════════ Los estados ════════════════════════════════

/// De donde viene el hash que la fila guarda. La distincion no es de trazabilidad: es
/// lo que decide si esa ruta puede producir una baja reportable.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum EstadoDeHash {
    /// El agente lo computo leyendo bytes locales. Savia todavia no dijo nada.
    Afirmado(HashAfirmado),
    /// Savia lo confirmo: contesto `known`, o `upload.completed` lo devolvio verificado.
    Confirmado(HashVerificado),
}

impl EstadoDeHash {
    /// Los 32 bytes, venga de donde venga. La correlacion por contenido usa ESTO y no el
    /// confirmado: un archivo recien movido a su ruta nueva todavia no tiene respuesta
    /// de Savia, y exigirle confirmacion haria que el movimiento se reporte como baja
    /// mas alta — que es exactamente el desastre de la salvaguarda 4.
    pub fn contenido(&self) -> &[u8; 32] {
        match self {
            EstadoDeHash::Afirmado(h) => h.bytes(),
            EstadoDeHash::Confirmado(h) => h.bytes(),
        }
    }
    /// Lo unico que puede viajar en un `presence.vanished`.
    pub fn confirmado(&self) -> Option<HashVerificado> {
        match self {
            EstadoDeHash::Afirmado(_) => None,
            EstadoDeHash::Confirmado(h) => Some(*h),
        }
    }

    /// **REAFIRMAR LOS MISMOS BYTES NO PUEDE DEGRADAR LO QUE SAVIA YA CONFIRMO.** Un
    /// `touch`, un `cp -p`, un `rsync -t`, un restore, un `git checkout` o la
    /// rehidratacion de un archivo de nube mueven el `mtime` sin mover un byte: el ciclo
    /// sale de NOOP, rehashea, y vuelve con el hash de siempre. Si esa vuelta pisara el
    /// `Confirmado` con un `Afirmado`, la fila perderia para siempre su capacidad de
    /// producir una baja —`puerta_de_baja` exige el confirmado— y como ese paso NO emite
    /// hecho, nada le vuelve a pedir a Savia que confirme. Es la asimetria que el
    /// borrador nombra como el caso peor: «una baja perdida deja un documento indexado
    /// para siempre».
    ///
    /// Contenido distinto SI degrada, y tiene que hacerlo: son bytes nuevos y Savia
    /// todavia no dijo nada de ellos.
    fn reafirmado_con(&self, afirmado: HashAfirmado) -> EstadoDeHash {
        match self {
            EstadoDeHash::Confirmado(v) if v.bytes() == afirmado.bytes() => {
                EstadoDeHash::Confirmado(*v)
            }
            _ => EstadoDeHash::Afirmado(afirmado),
        }
    }
}

/// LOS DOS ESTADOS SON EXCLUYENTES Y POR ESO ES UN ENUM.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum EstadoDeFila {
    Presente {
        observacion: Observacion,
        hash: EstadoDeHash,
    },
    /// La lapida. **Sobrevive a proposito**: sin ella cada barrido re-reportaria cada
    /// borrado historico y el corte por volumen quedaria disparado para siempre, con la
    /// raiz sin salir nunca de `Congelado`.
    Ausente {
        ultimo_hash: HashVerificado,
        desde: Instante,
    },
}

/// DOS RANURAS, NO UNA.
///
/// `fila` es lo ultimo que el agente ACEPTO; `candidato` es una observacion distinta que
/// TODAVIA NO SE REPORTO y cuyo intervalo de asentamiento esta corriendo. Sin la
/// segunda, «¿asentado?» no se puede contestar sin guardar estado adentro de la maquina
/// —y ahi deja de ser pura—. Es el campo que la tabla del borrador no tiene.
///
/// **LA FILA GUARDA EL ULTIMO ESTADO ACEPTADO, NUNCA EL ULTIMO OBSERVADO.** Si el
/// `(tamano, mtime)` observado y sin asentar se escribiera en `fila`, tras un reinicio a
/// mitad de asentamiento la fila diria «igual al inventario», el ciclo tomaria la rama
/// NOOP y la edicion quedaria perdida hasta que el archivo vuelva a cambiar.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Asiento {
    pub fila: Option<EstadoDeFila>,
    pub candidato: Option<Candidato>,
    /// El agente ya no sabe que hash tiene Savia para esta ruta. Lo pone `HashEnDuda`
    /// —tipicamente un `upload.completed` cuya respuesta se perdio— y lo unico que lo
    /// saca es que Savia vuelva a decir algo. Sin este campo la promesa que la cola
    /// escribe («se re-observa en el proximo barrido y el `known` la re-confirma») no
    /// tiene mecanismo: la tripleta no cambio, asi que la rama NOOP corta el paso y esa
    /// ruta queda muda para siempre.
    pub en_duda: bool,
}

/// Una fila completa. La maquina no la ve —ve un `Asiento`—: `alta_en` y `vista_en` son
/// contabilidad del recorrido, no insumo de la decision.
#[derive(Clone, Debug)]
pub struct Entrada {
    pub ruta: RutaRelativa,
    pub estado: EstadoDeFila,
    pub candidato: Option<Candidato>,
    /// El barrido en el que esta RUTA estreno contenido aceptado — o sea: en el que paso
    /// de no tener nada (fila nueva, o solo candidato, o lapida) a tener bytes. Es lo que
    /// separa «reaparecio» de «siempre estuvo» en la correlacion por contenido, y sin ese
    /// distingo borrar una de dos copias identicas no se retira jamas.
    ///
    /// **NO se mueve con una edicion en el lugar**, y esa es la mitad que faltaba: una
    /// ruta que ya tenia contenido y ahora tiene otro no «reaparecio donde antes no
    /// estaba», asi que no puede hacer de destino del movimiento de un tercero. Si se
    /// moviera, pegar el contenido de `viejo.md` dentro de `plantilla.md` haria que la
    /// baja de `viejo.md` se lea como un movimiento hacia `plantilla.md`: la baja no se
    /// retiene, se destruye junto con la fila, y ningun barrido posterior la recupera.
    pub alta_en: BarridoId,
    /// El ultimo barrido que la vio. Al cerrar COMPLETO, las que no lo tienen son el
    /// conjunto de ausencias.
    pub vista_en: BarridoId,
    /// Ver `Asiento::en_duda`.
    pub en_duda: bool,
}

/// **«ESTA RUTA ESTRENA CONTENIDO»**, y es la definicion operativa de *reaparecer* que la
/// salvaguarda 4 necesita: aparecer donde antes no habia nada aceptado. Una fila que ya
/// estaba `Presente` NO estrena por cambiar de bytes; una lapida SI, porque el archivo se
/// habia ido y esa ruta no sostenia contenido.
///
/// Vive aca y no en cada llamador porque la usan dos: el que arma el `IndiceDeContenido`
/// del recorrido y el que mueve `alta_en`. Dos definiciones de lo mismo son dos
/// oportunidades de que una se corrija y la otra no.
pub fn estrena_contenido(fila: Option<EstadoDeFila>) -> bool {
    !matches!(fila, Some(EstadoDeFila::Presente { .. }))
}

// ═══════════════════════════ El puerto de lectura ═══════════════════════════

/// **TODOS LOS METODOS SON `&self`. El trait NO tiene un solo metodo de escritura, y eso
/// es el contrato**: la maquina no puede comprometer nada antes que la cola. Si
/// escribiera, se marcaria «reportado», el proceso moriria antes de encolar el hecho, y
/// ese archivo no se reportaria nunca mas porque en la vuelta siguiente la comparacion
/// de tripleta contesta «iguales». Es un agujero permanente y silencioso.
pub trait Inventario {
    fn raiz(&self, raiz: &RaizId) -> Option<RaizRegistrada>;

    fn asiento(&self, raiz: &RaizId, ruta: &RutaRelativa) -> Option<Asiento>;

    /// EL NODO `MOVE`, y su contrato es estrecho a proposito: busca una fila cuya RUTA
    /// **estreno contenido en ESTE BARRIDO** y cuyos bytes coincidan. No «cualquier punto
    /// del arbol», y tampoco «cualquier fila que cambio»: una edicion en el lugar cambia
    /// de bytes sin estrenar ruta, asi que no puede hacer de destino. Ver
    /// `salvaguardas::IndiceDeContenido` para el argumento completo.
    fn alta_del_barrido_con(
        &self,
        raiz: &RaizId,
        contenido: &[u8; 32],
        barrido: &BarridoId,
        excepto: &RutaRelativa,
    ) -> Option<RutaRelativa>;

    /// **EL NODO `MOVE` VISTO DESDE EL DESTINO**, que el flujograma no dibuja porque solo
    /// dibuja el que sale de la rama de las ausencias.
    ///
    /// Busca una fila `Presente` en OTRA ruta cuya tripleta sea la misma. El
    /// `idDeArchivoDelSO` es la pista que lo hace barato, y `misma_observacion` es la
    /// verificacion que lo hace seguro: «una pista que se verifica, nunca una
    /// identidad», porque NTFS recicla ids y un restore los cambia todos.
    ///
    /// RESIDUO ACEPTADO Y DICHO: dos rutas que comparten inodo por un ENLACE DURO se ven
    /// como un movimiento. La fila se reubica, y en la vuelta siguiente la ruta original
    /// se reporta como alta. Cuesta un hash de mas y no pierde nada.
    fn fila_con_misma_observacion(
        &self,
        raiz: &RaizId,
        observacion: &Observacion,
        granularidad: std::time::Duration,
        excepto: &RutaRelativa,
    ) -> Option<RutaRelativa>;

    /// Las filas que este barrido no vio y que todavia no son lapidas. Es el conjunto de
    /// ausencias candidatas.
    fn no_vistas_en(&self, raiz: &RaizId, barrido: &BarridoId)
    -> Vec<(RutaRelativa, EstadoDeFila)>;

    /// Las lapidas pendientes de este barrido, para que el cierre pueda reevaluar MOVE
    /// con el recorrido ya completo.
    fn ausentes_desde(
        &self,
        raiz: &RaizId,
        barrido: &BarridoId,
    ) -> Vec<(RutaRelativa, EstadoDeFila)>;

    /// El denominador de `sweep.open`. Sin borde, «desaparecieron 40» no se compara
    /// contra nada y el corte por volumen no existe.
    fn vivos(&self, raiz: &RaizId) -> u64;
}

// ═══════════════════════ El alfabeto de escrituras ══════════════════════════

/// **EL ALFABETO COMPLETO DE ESCRITURAS DEL INVENTARIO.** Que sea cerrado es lo que le
/// da al inventario un solo camino de escritura, y lo que permite que el efecto y el
/// hecho se comprometan en la MISMA transaccion: la maquina los DEVUELVE y el llamador
/// los aplica junto con el encolado.
#[derive(Clone, PartialEq, Eq, Debug)]
pub enum EfectoDeInventario {
    AnotarCandidato {
        ruta: RutaRelativa,
        candidato: Candidato,
    },
    OlvidarCandidato {
        ruta: RutaRelativa,
    },
    ConfirmarPresencia {
        ruta: RutaRelativa,
        observacion: Observacion,
        hash: HashAfirmado,
    },
    /// MOVIMIENTO: cero I/O, cero hecho. La ruta vieja se olvida y `estadoDeReporte` no
    /// se toca — Savia sigue sabiendo exactamente lo que sabia.
    OlvidarRuta {
        ruta: RutaRelativa,
    },
    /// MOVIMIENTO VISTO DESDE EL DESTINO. Reubica la fila **conservando su hash y su
    /// estado de confirmacion**: los bytes no cambiaron, asi que lo que Savia sabe sigue
    /// siendo exactamente lo mismo. Es lo que vuelve verdadera la frase del borrador
    /// —«`idDeArchivoDelSO` hace que renombrar y mover cuesten CERO I/O»—: sin esto, el
    /// destino es una ruta nueva, se hashea, y mover un archivo cuesta leerlo entero.
    MoverRuta {
        de: RutaRelativa,
        a: RutaRelativa,
        observacion: Observacion,
    },
    /// La lapida. Solo se emite con un hash CONFIRMADO: una ruta sin confirmacion no
    /// tiene documento del otro lado, asi que no hay nada que retirar y su fila se
    /// olvida en vez de convertirse en lapida.
    MarcarAusente {
        ruta: RutaRelativa,
        ultimo_hash: HashVerificado,
        desde: Instante,
    },
    /// El retorno de `upload.completed` o de un `known`. **Escribe el hash VERIFICADO
    /// sobre el afirmado**: el que mando este lado era una afirmacion y el que computo
    /// quien leyo los bytes es la autoridad. Sin esto, una desaparicion posterior viaja
    /// con un hash que no matchea con nada.
    CorregirHash {
        ruta: RutaRelativa,
        verificado: HashVerificado,
    },
    /// El agente perdio la respuesta y ya no sabe que hash tiene Savia para esta ruta.
    /// **No borra nada y no afirma nada**: solo hace que el proximo barrido la vuelva a
    /// observar, que es el unico camino de cura que el protocolo tiene. Sin este efecto,
    /// la frase de `Confirmacion::HashEnDuda` —«el sistema se cura por el camino
    /// normal»— no tiene quien la cumpla.
    MarcarHashEnDuda {
        ruta: RutaRelativa,
    },
}

// ═══════════════════════ La implementacion en memoria ═══════════════════════

/// PERSISTENCIA: HOY NO HAY, Y ESTA ROTULADO.
///
/// El diseno del modulo pedia SQLite (`rusqlite` con `bundled`, WAL,
/// `synchronous = NORMAL`, un solo archivo en el directorio de datos de la app y **nunca
/// adentro de una raiz vigilada**). Lo que ese diseno compra y hoy NO se paga es la
/// durabilidad; lo que compra y **si** se paga es la ATOMICIDAD, porque las dos mitades
/// —el estado y la cola— viven en el mismo `Almacen` y se escriben en una sola llamada
/// `&mut self`, asi que no hay forma de hacer una sin la otra.
///
/// «Se pierde el inventario» no es un caso especial: el borrador ya dice que cuesta un
/// barrido y Savia contesta `known` a todo.
///
/// **Y LO QUE ESTO COSTABA LO CERRO EL PADRON.** Este comentario decia que lo borrado
/// mientras no habia inventario «no se retira jamas» —no hay lapidas ni filas de esos
/// archivos, asi que ningun barrido los ve faltar—. Dejo de ser cierto: un inventario
/// vacio abre el barrido declarando `total = 0` contra los N documentos vivos que Savia
/// tiene de esa raiz, el desfase salta ahi, y el padron le dice a Savia todo lo que el
/// recorrido SI vio. Lo que Savia tiene vivo y el padron no nombra es lo que se fue.
///
/// Queda un borde, y hay que nombrarlo: la deteccion es por CARDINALIDAD. Un inventario
/// corrupto que conserve la cuenta exacta y equivoque el contenido no pide padron.
///
/// Lo que sigue en pie es que perder los `RootId` crearia documentos duplicados salvo
/// que el enrolamiento sea idempotente por
/// `(dispositivo, identidadDeVolumen, idDelDirectorio)`. Eso es un requisito que este
/// modulo IMPONE al enrolamiento, no una dependencia que hereda.
pub struct InventarioEnMemoria {
    raices: BTreeMap<RaizId, RaizRegistrada>,
    filas: BTreeMap<(RaizId, ClaveDeRuta), Entrada>,
}

impl Default for InventarioEnMemoria {
    fn default() -> Self {
        Self::nuevo()
    }
}

impl InventarioEnMemoria {
    pub fn nuevo() -> Self {
        Self {
            raices: BTreeMap::new(),
            filas: BTreeMap::new(),
        }
    }

    pub fn enrolar(&mut self, r: RaizRegistrada) {
        self.raices.insert(r.id.clone(), r);
    }

    fn clave(&self, raiz: &RaizId, ruta: &RutaRelativa) -> ClaveDeRuta {
        let s = self
            .raices
            .get(raiz)
            .map(|r| r.sensibilidad)
            .unwrap_or(crate::dominio::SensibilidadAMayusculas::Distingue);
        clave_de_ruta(ruta, s)
    }

    /// Marca la fila como vista en este barrido. **NO es un efecto de la maquina**, y
    /// esa separacion es una resolucion entre disenos: la maquina exige «tripleta igual
    /// ⇒ cero efectos», y si `marcar_vista` fuera un efecto, el caso mas comun del
    /// barrido violaria ese invariante. `vista_en` es contabilidad del RECORRIDO, no
    /// consecuencia de una decision.
    pub fn marcar_vista(&mut self, raiz: &RaizId, ruta: &RutaRelativa, barrido: &BarridoId) {
        let k = (raiz.clone(), self.clave(raiz, ruta));
        if let Some(e) = self.filas.get_mut(&k) {
            e.vista_en = barrido.clone();
        }
    }

    /// Aplica UN efecto. Es privado al crate: el unico camino publico es
    /// `Almacen::comprometer`, que escribe estado y cola juntos.
    pub(crate) fn aplicar(
        &mut self,
        raiz: &RaizId,
        efecto: &EfectoDeInventario,
        barrido: Option<&BarridoId>,
    ) {
        let sin_barrido = BarridoId::nuevo("");
        let b = barrido.cloned().unwrap_or(sin_barrido);
        match efecto {
            EfectoDeInventario::AnotarCandidato { ruta, candidato } => {
                let k = (raiz.clone(), self.clave(raiz, ruta));
                match self.filas.get_mut(&k) {
                    Some(e) => e.candidato = Some(*candidato),
                    None => {
                        // Una ruta que el inventario no tenia y que todavia no asento.
                        // Se guarda SOLO el candidato: la fila nace con el hash en
                        // ceros, que `es_aceptada` lee como «esto no es una afirmacion
                        // sobre nada». No cuenta en el denominador de `sweep.open` ni
                        // puede entrar al conjunto de ausencias, que es justo lo que
                        // impide que un archivo a medio guardar se reporte como baja en
                        // el barrido siguiente.
                        self.filas.insert(
                            k,
                            Entrada {
                                ruta: ruta.clone(),
                                estado: EstadoDeFila::Presente {
                                    observacion: candidato.observacion,
                                    hash: EstadoDeHash::Afirmado(HashAfirmado::de_bytes(
                                        SIN_AFIRMAR,
                                    )),
                                },
                                candidato: Some(*candidato),
                                alta_en: b.clone(),
                                vista_en: b,
                                en_duda: false,
                            },
                        );
                    }
                }
            }
            EfectoDeInventario::OlvidarCandidato { ruta } => {
                let k = (raiz.clone(), self.clave(raiz, ruta));
                if let Some(e) = self.filas.get_mut(&k) {
                    e.candidato = None;
                }
            }
            EfectoDeInventario::ConfirmarPresencia {
                ruta,
                observacion,
                hash,
            } => {
                let k = (raiz.clone(), self.clave(raiz, ruta));
                match self.filas.get_mut(&k) {
                    Some(e) => {
                        // La fila que cuenta es la ACEPTADA: una nacida de un candidato
                        // tiene el hash centinela y no es una afirmacion sobre nada, asi
                        // que la ruta sigue sin estrenar contenido.
                        let aceptada = if es_aceptada(e) { Some(e.estado) } else { None };
                        let cambio_de_contenido = match aceptada {
                            Some(EstadoDeFila::Presente { hash: h, .. }) => {
                                h.contenido() != hash.bytes()
                            }
                            _ => true,
                        };
                        // `alta_en` marca el ESTRENO de la ruta, no cada cambio de bytes.
                        // Ver la ficha del campo: con una edicion en el lugar moviendolo,
                        // la baja de otro archivo con ese mismo contenido se anula.
                        if estrena_contenido(aceptada) {
                            e.alta_en = b.clone();
                        }
                        e.estado = EstadoDeFila::Presente {
                            observacion: *observacion,
                            hash: match aceptada {
                                // Reafirmar los mismos bytes conserva la confirmacion:
                                // lo que Savia sabe no cambio porque el `mtime` si.
                                Some(EstadoDeFila::Presente { hash: h, .. }) => {
                                    h.reafirmado_con(*hash)
                                }
                                _ => EstadoDeHash::Afirmado(*hash),
                            },
                        };
                        e.candidato = None;
                        e.vista_en = b.clone();
                        // La duda muere con el contenido que la produjo: estos bytes son
                        // otros y van a viajar en su propio `presence.observed`.
                        if cambio_de_contenido {
                            e.en_duda = false;
                        }
                    }
                    None => {
                        self.filas.insert(
                            k,
                            Entrada {
                                ruta: ruta.clone(),
                                estado: EstadoDeFila::Presente {
                                    observacion: *observacion,
                                    hash: EstadoDeHash::Afirmado(*hash),
                                },
                                candidato: None,
                                alta_en: b.clone(),
                                vista_en: b,
                                en_duda: false,
                            },
                        );
                    }
                }
            }
            EfectoDeInventario::OlvidarRuta { ruta } => {
                let k = (raiz.clone(), self.clave(raiz, ruta));
                self.filas.remove(&k);
            }
            EfectoDeInventario::MoverRuta { de, a, observacion } => {
                let vieja = (raiz.clone(), self.clave(raiz, de));
                let Some(mut fila) = self.filas.remove(&vieja) else {
                    return;
                };
                // El hash y su estado de confirmacion viajan intactos. `alta_en` NO se
                // mueve: la pareja (contenido) es la misma de siempre, y correr el alta
                // a este barrido haria que la fila se vea como «reaparecio», que es
                // justo lo que la correlacion del cierre usa para anular bajas ajenas.
                if let EstadoDeFila::Presente { hash, .. } = fila.estado {
                    fila.estado = EstadoDeFila::Presente {
                        observacion: *observacion,
                        hash,
                    };
                }
                fila.ruta = a.clone();
                fila.candidato = None;
                fila.vista_en = b;
                self.filas.insert((raiz.clone(), self.clave(raiz, a)), fila);
            }
            EfectoDeInventario::MarcarAusente {
                ruta,
                ultimo_hash,
                desde,
            } => {
                let k = (raiz.clone(), self.clave(raiz, ruta));
                if let Some(e) = self.filas.get_mut(&k) {
                    e.estado = EstadoDeFila::Ausente {
                        ultimo_hash: *ultimo_hash,
                        desde: *desde,
                    };
                    e.candidato = None;
                    e.vista_en = b;
                }
            }
            EfectoDeInventario::CorregirHash { ruta, verificado } => {
                let k = (raiz.clone(), self.clave(raiz, ruta));
                if let Some(e) = self.filas.get_mut(&k)
                    && let EstadoDeFila::Presente { observacion, .. } = e.estado
                {
                    e.estado = EstadoDeFila::Presente {
                        observacion,
                        hash: EstadoDeHash::Confirmado(*verificado),
                    };
                    // Savia volvio a hablar: ya no hay duda que curar.
                    e.en_duda = false;
                }
            }
            EfectoDeInventario::MarcarHashEnDuda { ruta } => {
                let k = (raiz.clone(), self.clave(raiz, ruta));
                if let Some(e) = self.filas.get_mut(&k) {
                    e.en_duda = true;
                }
            }
        }
    }

    pub fn entradas(&self, raiz: &RaizId) -> Vec<Entrada> {
        self.filas
            .iter()
            .filter(|((r, _), _)| r == raiz)
            .map(|(_, e)| e.clone())
            .collect()
    }
}

/// Una fila creada solo por un candidato tiene el hash en ceros y no es una afirmacion
/// sobre nada. Se filtra de todo lo que cuenta como corpus: del denominador de
/// `sweep.open` y del conjunto de ausencias.
/// El hash imposible que marca «fila sin afirmacion todavia». No es un numero que
/// decida politica: es un centinela, y se lo nombra para que no parezca uno de los
/// cuatro parametros sin medir.
const SIN_AFIRMAR: [u8; 32] = [0u8; 32];

fn es_aceptada(e: &Entrada) -> bool {
    match &e.estado {
        EstadoDeFila::Presente { hash, .. } => hash.contenido() != &SIN_AFIRMAR,
        EstadoDeFila::Ausente { .. } => true,
    }
}

impl Inventario for InventarioEnMemoria {
    fn raiz(&self, raiz: &RaizId) -> Option<RaizRegistrada> {
        self.raices.get(raiz).cloned()
    }

    fn asiento(&self, raiz: &RaizId, ruta: &RutaRelativa) -> Option<Asiento> {
        let k = (raiz.clone(), self.clave(raiz, ruta));
        self.filas.get(&k).map(|e| Asiento {
            fila: if es_aceptada(e) { Some(e.estado) } else { None },
            candidato: e.candidato,
            en_duda: e.en_duda,
        })
    }

    fn alta_del_barrido_con(
        &self,
        raiz: &RaizId,
        contenido: &[u8; 32],
        barrido: &BarridoId,
        excepto: &RutaRelativa,
    ) -> Option<RutaRelativa> {
        self.filas
            .iter()
            .filter(|((r, _), _)| r == raiz)
            .map(|(_, e)| e)
            .filter(|e| es_aceptada(e) && &e.alta_en == barrido && &e.ruta != excepto)
            .find(|e| match &e.estado {
                // SOLO filas `Presente`: un hash que sostiene una fila ya ausente no
                // «reaparece en el arbol», se fue con ella. Si contara, dos archivos
                // borrados con el mismo contenido se verian mutuamente y ninguno se
                // reportaria.
                EstadoDeFila::Presente { hash, .. } => hash.contenido() == contenido,
                EstadoDeFila::Ausente { .. } => false,
            })
            .map(|e| e.ruta.clone())
    }

    fn fila_con_misma_observacion(
        &self,
        raiz: &RaizId,
        observacion: &Observacion,
        granularidad: std::time::Duration,
        excepto: &RutaRelativa,
    ) -> Option<RutaRelativa> {
        // Sin id de archivo no hay atajo: `misma_observacion` devuelve `false` cuando
        // falta de cualquiera de los dos lados, asi que sobre una unidad de red que no
        // publica ids un movimiento cuesta un hash. Es el lado seguro — el costo del
        // default opuesto es empatar dos archivos distintos.
        self.filas
            .iter()
            .filter(|((r, _), _)| r == raiz)
            .map(|(_, e)| e)
            .filter(|e| es_aceptada(e) && &e.ruta != excepto)
            .find(|e| match &e.estado {
                EstadoDeFila::Presente { observacion: o, .. } => {
                    crate::salvaguardas::misma_observacion(o, observacion, granularidad)
                }
                EstadoDeFila::Ausente { .. } => false,
            })
            .map(|e| e.ruta.clone())
    }

    fn no_vistas_en(
        &self,
        raiz: &RaizId,
        barrido: &BarridoId,
    ) -> Vec<(RutaRelativa, EstadoDeFila)> {
        self.filas
            .iter()
            .filter(|((r, _), _)| r == raiz)
            .map(|(_, e)| e)
            .filter(|e| {
                es_aceptada(e)
                    && &e.vista_en != barrido
                    && matches!(e.estado, EstadoDeFila::Presente { .. })
            })
            .map(|e| (e.ruta.clone(), e.estado))
            .collect()
    }

    fn ausentes_desde(
        &self,
        raiz: &RaizId,
        barrido: &BarridoId,
    ) -> Vec<(RutaRelativa, EstadoDeFila)> {
        self.filas
            .iter()
            .filter(|((r, _), _)| r == raiz)
            .map(|(_, e)| e)
            .filter(|e| {
                es_aceptada(e)
                    && &e.vista_en == barrido
                    && matches!(e.estado, EstadoDeFila::Ausente { .. })
            })
            .map(|e| (e.ruta.clone(), e.estado))
            .collect()
    }

    fn vivos(&self, raiz: &RaizId) -> u64 {
        self.filas
            .iter()
            .filter(|((r, _), _)| r == raiz)
            .map(|(_, e)| e)
            .filter(|e| es_aceptada(e) && matches!(e.estado, EstadoDeFila::Presente { .. }))
            .count() as u64
    }
}
