//! La implementacion en memoria del puerto `Inventario`. El vocabulario y el trait viven
//! en `savia-folder-contrato`; esto es el unico adaptador de estado que el agente tiene.
#![forbid(unsafe_code)]

use savia_folder_contrato::dominio::{
    BarridoId, ClaveDeRuta, HashAfirmado, Observacion, RaizId, RutaRelativa, clave_de_ruta,
};
use savia_folder_contrato::inventario::{
    Asiento, EfectoDeInventario, Entrada, EstadoDeFila, EstadoDeHash, Inventario, estrena_contenido,
};
use savia_folder_contrato::plataforma::RaizRegistrada;
use std::collections::BTreeMap;

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
#[derive(serde::Serialize, serde::Deserialize)]
pub struct InventarioEnMemoria {
    raices: BTreeMap<RaizId, RaizRegistrada>,
    #[serde(with = "savia_folder_contrato::dominio::mapa_como_lista")]
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

    /// Saca la raiz del registro **y DEJA SUS FILAS DONDE ESTAN**. Devuelve si estaba.
    ///
    /// **Que las filas sobrevivan es la decision, no un descuido.** «Dejar de mirar» se
    /// prometio reversible —volver a agregar la carpeta no resube nada— y eso no es una
    /// promesa de producto: es una consecuencia. Reelegir la carpeta da el MISMO `RaizId`
    /// (decision 7), asi que al reenrolar el inventario de esa raiz se vuelve a encontrar
    /// entero. Borrar las filas aca convertiria «la saque un rato» en «resubi todo».
    ///
    /// Mientras esta desenrolada nadie recorre sus filas: el bucle de trabajo itera
    /// `raices()` y el panel tambien. Quedan en el deposito, inertes, esperando.
    pub fn desenrolar(&mut self, raiz: &RaizId) -> bool {
        self.raices.remove(raiz).is_some()
    }

    fn clave(&self, raiz: &RaizId, ruta: &RutaRelativa) -> ClaveDeRuta {
        let s = self
            .raices
            .get(raiz)
            .map(|r| r.sensibilidad)
            .unwrap_or(savia_folder_contrato::dominio::SensibilidadAMayusculas::Distingue);
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
                                fallo: None,
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
                        // LA LECTURA QUE SI FUNCIONO ES LA UNICA CURA. Si esta ruta
                        // llegaba de un `Nodo::Fallo` (permiso denegado en la vuelta
                        // anterior), este exito la saca sin que nadie tenga que
                        // intervenir manualmente.
                        e.fallo = None;
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
                                fallo: None,
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
                // EL ORIGEN PUEDE LLEVAR UN `fallo` VIEJO de un contenido que ya no es el
                // que se esta moviendo — la ruta destino recien matcheo por hash, o sea
                // que en su ubicacion nueva SI se pudo leer. Sin esta linea, un archivo
                // sano heredaria un "no se pudo abrir" fantasma de la ruta que dejo atras.
                fila.fallo = None;
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
                    // Una lapida no es "no se pudo abrir": se fue. El motivo de la
                    // ultima lectura, si lo habia, ya no describe nada presente.
                    e.fallo = None;
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
            EfectoDeInventario::MarcarFallo { ruta, motivo } => {
                let k = (raiz.clone(), self.clave(raiz, ruta));
                if let Some(e) = self.filas.get_mut(&k) {
                    e.fallo = Some(*motivo);
                }
                // Sin rama `None => insert`: `Asentamiento::Asentado` nunca se alcanza
                // sobre un candidato `None` (`politica::salvaguardas::asentar`), asi que
                // la fila ya existe siempre que este efecto se aplique.
            }
        }
    }

    /// Las raices enroladas. Devuelve clones y no un iterador para no atar al panel a
    /// un prestamo del inventario mientras lo recorre.
    pub fn raices(&self) -> Vec<RaizRegistrada> {
        self.raices.values().cloned().collect()
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
            fallo: e.fallo,
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
                    savia_folder_contrato::salvaguardas::misma_observacion(
                        o,
                        observacion,
                        granularidad,
                    )
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
