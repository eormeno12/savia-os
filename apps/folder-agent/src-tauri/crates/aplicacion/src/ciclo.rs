//! EL LAZO: la vuelta completa de una raiz. Es el unico modulo que compone a los otros
//! —la misma forma que `@savia-os/orchestration` tiene en el pipeline— y por eso es el
//! unico que puede ver a la vez la plataforma, el almacen y el protocolo.
//!
//! Hace tres cosas, en este orden y no en otro:
//!
//!  1. **Abre el barrido** con el denominador, enumera, y le pasa CADA ruta a la maquina.
//!     El recorrido marca `vista_en` —contabilidad suya, no efecto de la maquina— y va
//!     armando el `IndiceDeContenido` con las rutas NUEVAS, que es contra lo que MOVE
//!     correlaciona.
//!  2. **Cierra el barrido**, que es cuando MOVE y ROOT tienen respuesta completa: se
//!     anulan las bajas que resultaron movimientos ANTES de transmitir, y se agregan las
//!     de las filas que el recorrido no vio.
//!  3. **Drena**, en orden por raiz, con un solo trabajo en vuelo. Los HECHOS primero y
//!     los BYTES despues, que es lo que impide que una semana sin conexion se convierta
//!     en un backlog de subida de archivos que en realidad solo se movieron.
#![forbid(unsafe_code)]

use savia_folder_contrato::dominio::{
    BarridoId, EstadoDelBarrido, HashVerificado, RaizId, RutaRelativa,
};
use savia_folder_contrato::inventario::Inventario;
use savia_folder_contrato::plataforma::{Plataforma, RelojDePlataforma, ResultadoDeEnumeracion};
use savia_folder_contrato::protocolo::Clase;
use savia_folder_estado::almacen::Almacen;
use savia_folder_estado::colas::{Desenlace, Proximo, Recibido, Trabajo, TrabajoId};
use savia_folder_maquina::maquina::{self, Nodo, OrigenDeSenal, Senal};
use savia_folder_politica::salvaguardas::{IndiceDeContenido, Politica, PorQueNoSeReporta};
use savia_folder_protocolo::{Cliente, FalloDeProtocolo};

/// **EL RESUMEN CUENTA LOS DIEZ NODOS, NO SEIS.** El doc de `Nodo` dice que la rama va
/// en la salida «porque es lo que el panel muestra por raiz»; mientras cuatro variantes
/// caian en un `_ => {}`, el panel no las podia mostrar.
///
/// Y las dos que faltaban son justo las que hay que ver: `RaizAusente` es la salvaguarda
/// disparandose —«se desmonto el disco y no reporte ni una baja»— y `BajaNoReportable`
/// OLVIDA una fila. Las dos terminaban sin dejar rastro.
#[derive(Default, Debug)]
pub struct ResumenDelBarrido {
    pub enumeradas: usize,
    pub apariciones: u64,
    pub bajas: u64,
    pub omitidos_por_deshidratacion: u64,
    pub esperando: u64,
    pub movimientos: u64,
    pub indeterminados: u64,
    /// El caso nulo, y va contado igual: sin el, «de 40.000 rutas no cambio ninguna» y
    /// «de 40.000 rutas no se pudo mirar ninguna» dan el mismo resumen vacio.
    pub sin_cambio: u64,
    /// LA SALVAGUARDA DISPARADA DURANTE EL RECORRIDO: una ruta que falta sobre una raiz
    /// que no esta viva. No produce baja — y hasta ahora tampoco producia rastro.
    pub raiz_no_viva: u64,
    /// Se fue una ruta que Savia nunca confirmo, asi que no hay documento que retirar.
    /// **La fila se olvida**, con lo que si no se cuenta acá no queda registro de que
    /// existio.
    pub sin_documento_que_retirar: u64,
    /// **Tiene que ser cero.** `barrer` siempre pasa un barrido, asi que ninguna senal
    /// suya puede terminar en «agenda un barrido». Se cuenta en vez de entrar en un
    /// `unreachable!` porque un agente que vigila carpetas del usuario no puede
    /// permitirse un panico para senalar una inconsistencia: se detecta, no se previene.
    pub agendados: u64,

    // ── Lo que el CIERRE retuvo, por motivo ──────────────────────────────────
    //
    // `Cierre::retenidas` los venia calculando desde siempre —su propio doc dice «para
    // el panel, nunca para el servidor»— y NO LOS LEIA NADIE: ni `ciclo`, ni `almacen`,
    // ni un test. El diagnostico se calculaba y se tiraba en la misma linea.
    /// Bajas ya encoladas que se anularon porque la raiz murio a mitad del barrido.
    pub retenidas_por_raiz_no_viva: u64,
    /// Ausencias que el recorrido completo mostro que eran mudanzas.
    pub retenidas_por_movimiento: u64,
    /// Ausencias de rutas que Savia nunca confirmo. Mandarlas inflaria el numerador del
    /// corte por volumen con archivos que del otro lado no existen.
    pub retenidas_sin_hash_confirmado: u64,
    /// **Hoy siempre cero, y contarlo lo deja dicho:** `PorQueNoSeReporta::Deshidratado`
    /// esta declarado y no se construye en ningun lado. Un deshidratado sale por
    /// `Nodo::Omitido` mucho antes de poder ser una ausencia candidata, asi que el motivo
    /// nunca llega al cierre.
    pub retenidas_por_deshidratacion: u64,
    pub cierre: Option<EstadoDelBarrido>,
}

/// Una vuelta sobre una raiz. **No transmite nada**: solo llena el almacen. El drenaje es
/// aparte a proposito — el contrato con la cola dice que ninguna baja se transmite con
/// un barrido abierto de esa raiz.
pub fn barrer(
    raiz: &RaizId,
    barrido: BarridoId,
    plataforma: &dyn Plataforma,
    almacen: &mut Almacen,
    politica: &Politica,
) -> ResumenDelBarrido {
    let mut resumen = ResumenDelBarrido::default();
    let Some(registrada) = almacen.inventario().raiz(raiz) else {
        return resumen;
    };
    let (segmento, _total) = almacen.abrir_barrido(raiz, barrido.clone());

    let evidencia = plataforma.evidencia_de_raiz(&registrada);
    let (rutas, recorrido_completo) = match &evidencia.enumeracion {
        ResultadoDeEnumeracion::Listada { entradas, errores } => (
            entradas.iter().map(|e| e.ruta.clone()).collect::<Vec<_>>(),
            // Un recorrido con huecos NO puede afirmar «barri entero». Marcarlo completo
            // convierte las ausencias del tramo ilegible en evidencia de baja.
            errores.is_empty(),
        ),
        ResultadoDeEnumeracion::Fallo(_) => (Vec::new(), false),
    };
    resumen.enumeradas = rutas.len();

    let mut indice = IndiceDeContenido::nuevo();
    // EL PADRON SE JUNTA ACA Y NO SE DERIVA DEL INVENTARIO DESPUES, porque la lista de
    // lo presente la tiene EL RECORRIDO y no la creencia. Un deshidratado que el agente
    // ve por primera vez sale por `Nodo::Omitido` con cero efectos: no deja fila. Un
    // padron derivado del inventario lo omitiria, y omitir del padron es exactamente
    // decir «no esta».
    let mut padron: Vec<(RutaRelativa, Option<HashVerificado>)> = Vec::new();
    let reloj = RelojDePlataforma(plataforma);

    for ruta in &rutas {
        // ANTES de decidir: ¿esta ruta sostenia contenido al empezar el paso? Es lo unico
        // que distingue «reaparecio donde antes no estaba» de «se edito lo que ya
        // estaba», y hay que leerlo aca porque despues de `comprometer` el inventario ya
        // dice otra cosa. Ver `IndiceDeContenido::anotar_ruta_nueva`.
        let estrenaba = savia_folder_contrato::inventario::estrena_contenido(
            almacen
                .inventario()
                .asiento(raiz, ruta)
                .and_then(|a| a.fila),
        );
        // Contabilidad del RECORRIDO, no efecto de la maquina: `vista_en` es lo que hace
        // que al cerrar las filas no vistas sean el conjunto de ausencias.
        almacen.marcar_vista(raiz, ruta, &barrido);
        let senal = Senal {
            raiz: raiz.clone(),
            ruta: ruta.clone(),
            origen: OrigenDeSenal::TurnoDelBarrido,
        };
        let paso = maquina::decidir(
            &senal,
            Some(&barrido),
            plataforma,
            almacen.inventario(),
            &reloj,
            politica,
        );
        match &paso.nodo {
            Nodo::Aparecio => resumen.apariciones += 1,
            Nodo::Desaparecio => resumen.bajas += 1,
            Nodo::Omitido => resumen.omitidos_por_deshidratacion += 1,
            Nodo::Esperando { .. } => resumen.esperando += 1,
            Nodo::Movimiento { .. } => resumen.movimientos += 1,
            Nodo::Indeterminado(_) => resumen.indeterminados += 1,
            Nodo::SinCambio => resumen.sin_cambio += 1,
            Nodo::RaizAusente => resumen.raiz_no_viva += 1,
            Nodo::BajaNoReportable => resumen.sin_documento_que_retirar += 1,
            Nodo::AgendaBarrido => resumen.agendados += 1,
            // SIN RAMA COMODIN A PROPOSITO: con `_ => {}` una variante nueva de `Nodo`
            // entra al arbol y desaparece del resumen sin que nada avise. Asi el
            // compilador obliga a decidir que se hace con ella.
        }
        // El indice se alimenta SOLO con rutas que ESTRENARON contenido en este barrido:
        // es lo que hace que «reaparecio» signifique «aparecio donde antes no estaba» y
        // no «existe en algun lado». Con el arbol entero, borrar una de dos copias
        // identicas no produce baja nunca; con toda `Aparecio`, una edicion en el lugar
        // se vuelve el destino de un movimiento que nadie hizo y la baja del otro archivo
        // se destruye. El guardian es `estrenaba`, leido antes de decidir, porque es el
        // contrato que `anotar_ruta_nueva` declara y no lo puede verificar sola.
        if estrenaba
            && let Some(savia_folder_politica::salvaguardas::Hecho::Aparecio(a)) = &paso.hecho
        {
            indice.anotar_ruta_nueva(a.ruta().clone(), *a.hash().bytes());
        }
        let desaparecio = matches!(paso.nodo, Nodo::Desaparecio);
        almacen.comprometer(raiz, Some(&barrido), paso);
        // Se enumero y no resulto una baja ⇒ ESTA. El hash se lee DESPUES de comprometer
        // para que una ruta recien aparecida lleve el suyo y no el anterior; `None` es
        // «presente con hash desconocido» —deshidratado, sin asentar, o aparecido y
        // todavia sin respuesta de Savia— y NO significa ausente.
        if !desaparecio {
            let confirmado = almacen
                .inventario()
                .asiento(raiz, ruta)
                .and_then(|a| a.fila)
                .and_then(|f| match f {
                    savia_folder_contrato::inventario::EstadoDeFila::Presente { hash, .. } => {
                        hash.confirmado()
                    }
                    savia_folder_contrato::inventario::EstadoDeFila::Ausente { .. } => None,
                });
            padron.push((ruta.clone(), confirmado));
        }
    }

    let cierre = maquina::cerrar_barrido(
        raiz,
        &barrido,
        plataforma,
        almacen.inventario(),
        &reloj,
        &indice,
        recorrido_completo,
    );
    // Las que el cierre descubrio, menos las que resultaron movimientos al terminar el
    // recorrido. `saturating_sub` porque `anular` puede tapar bajas que la vuelta conto
    // durante el recorrido, y un contador en negativo seria peor que uno en cero.
    resumen.bajas =
        (resumen.bajas + cierre.bajas.len() as u64).saturating_sub(cierre.anular.len() as u64);
    for (_, motivo) in &cierre.retenidas {
        match motivo {
            PorQueNoSeReporta::RaizAusente => resumen.retenidas_por_raiz_no_viva += 1,
            PorQueNoSeReporta::EsMovimiento { .. } => resumen.retenidas_por_movimiento += 1,
            PorQueNoSeReporta::SinHashConfirmado => resumen.retenidas_sin_hash_confirmado += 1,
            PorQueNoSeReporta::Deshidratado => resumen.retenidas_por_deshidratacion += 1,
        }
    }
    let estado = almacen.comprometer_cierre(raiz, &barrido, segmento, cierre);
    // SOLO SI EL RECORRIDO CERRO COMPLETO. Savia tambien lo exige antes de aplicar la
    // diferencia, y sostenerlo de los dos lados es deliberado: asi ninguno de los dos
    // solo puede convertir un recorrido con huecos en un retiro masivo.
    if estado == EstadoDelBarrido::Completo {
        almacen.registrar_padron(segmento, padron);
    }
    resumen.cierre = Some(estado);
    resumen
}

/// Una senal suelta del observador (fuera de un barrido). Se separa de `barrer` porque
/// **sin barrido abierto una ausencia no produce una baja**: agenda.
pub fn atender_evento(
    raiz: &RaizId,
    ruta: RutaRelativa,
    plataforma: &dyn Plataforma,
    almacen: &mut Almacen,
    politica: &Politica,
) -> Nodo {
    let reloj = RelojDePlataforma(plataforma);
    let senal = Senal {
        raiz: raiz.clone(),
        ruta,
        origen: OrigenDeSenal::EventoDelSistema,
    };
    let paso = maquina::decidir(
        &senal,
        None,
        plataforma,
        almacen.inventario(),
        &reloj,
        politica,
    );
    let nodo = paso.nodo.clone();
    almacen.comprometer(raiz, None, paso);
    nodo
}

#[derive(Debug)]
pub enum ResultadoDelDrenaje {
    Vacia,
    Detenida(savia_folder_estado::colas::MotivoDeDetencion),
}

/// Drena una raiz hasta que no queda trabajo o hasta que un error de credenciales la
/// detiene. **Un trabajo en vuelo por vez**: dos en paralelo reordenan, y el orden ES el
/// significado.
pub fn drenar(
    raiz: &RaizId,
    plataforma: &dyn Plataforma,
    almacen: &mut Almacen,
    cliente: &Cliente,
    traza: &mut Vec<String>,
) -> ResultadoDelDrenaje {
    // EL LAZO NO PUEDE GIRAR EN VACIO, Y LA GARANTIA ES ESTRUCTURAL, NO UNA LISTA DE
    // VARIANTES. La lista de abajo dice cuando VALE LA PENA seguir; esto dice cuando la
    // cola NO SE MOVIO, que es otra cosa y es la que mata. Un `Desenlace` que el `match`
    // de `Colas::resolver` no atienda para ese trabajo devuelve el trabajo identico y el
    // `loop` no termina jamas: el agente deja de barrer, deja de reportar bajas, y
    // martilla al servidor a miles de peticiones por segundo con el panel diciendo
    // «sincronizando». Comparar el trabajo —no su id, que `Subir` y `ConfirmarSubida`
    // comparten— es lo que hace que ninguna variante futura pueda reintroducirlo.
    let mut anterior: Option<Trabajo> = None;
    loop {
        let proximo = almacen.siguiente(raiz);
        let trabajo = match proximo {
            Proximo::Nada => return ResultadoDelDrenaje::Vacia,
            Proximo::Detenida(m) => return ResultadoDelDrenaje::Detenida(m),
            Proximo::Trabajo(t) => *t,
        };
        if anterior.as_ref() == Some(&trabajo) {
            traza.push("  (la cola no se movio: se corta el drenaje)".into());
            return ResultadoDelDrenaje::Vacia;
        }
        let (id, desenlace) = ejecutar(raiz, plataforma, almacen, cliente, &trabajo, traza);
        // Si el trabajo no avanza —reintentable con la red caida— se corta el lazo en vez
        // de girar para siempre. El reintento con espera es del drenador de produccion, y
        // su curva entra por parametro; aca no se inventa ninguna.
        let avanza = matches!(
            desenlace,
            Desenlace::Entregado(_) | Desenlace::IlegibleEnDisco | Desenlace::Ambiguo
        );
        almacen.resolver(raiz, &id, desenlace);
        if !avanza {
            return ResultadoDelDrenaje::Vacia;
        }
        anterior = Some(trabajo);
    }
}

fn ejecutar(
    raiz: &RaizId,
    plataforma: &dyn Plataforma,
    almacen: &mut Almacen,
    cliente: &Cliente,
    trabajo: &Trabajo,
    traza: &mut Vec<String>,
) -> (TrabajoId, Desenlace) {
    match trabajo {
        Trabajo::AbrirBarrido { id, total, .. } => {
            traza.push(format!("sweep.open total={total}"));
            // EL SERVIDOR COMPARA ESE `total` CONTRA SUS DOCUMENTOS VIVOS y contesta si
            // hace falta el padron. La bandera entra a la cola pegada al `sweepId`: es la
            // respuesta a ESTE `sweep.open` y a ninguno otro.
            let r = cliente.abrir_barrido(raiz, *total);
            if let Ok(b) = &r
                && b.padron_requerido
            {
                traza.push("sweep.open -> PADRON REQUERIDO".to_string());
            }
            (
                id.clone(),
                a_desenlace(r.map(|b| Recibido::Barrido {
                    sweep: b.sweep_id,
                    padron_requerido: b.padron_requerido,
                })),
            )
        }
        Trabajo::Observar { id, entradas, .. } => {
            traza.push(format!("presence.observed x{}", entradas.len()));
            (
                id.clone(),
                a_desenlace(
                    cliente
                        .reportar_observados(raiz, entradas)
                        .map(Recibido::Decisiones),
                ),
            )
        }
        Trabajo::EnviarPadron {
            id,
            sweep,
            entradas,
            ..
        } => {
            let sin_hash = entradas.iter().filter(|(_, h)| h.is_none()).count();
            traza.push(format!(
                "presence.roster x{} ({sin_hash} sin hash)",
                entradas.len()
            ));
            let payload: Vec<(String, Option<String>)> = entradas
                .iter()
                .map(|(r, h)| (r.como_str().to_string(), h.map(|h| h.hex())))
                .collect();
            (
                id.clone(),
                a_desenlace(
                    cliente
                        .enviar_padron(sweep, &payload)
                        .map(|_| Recibido::Nada),
                ),
            )
        }
        Trabajo::Desvanecer { id, entradas, .. } => {
            traza.push(format!("presence.vanished x{}", entradas.len()));
            // La firma exige el testigo de raiz viva. Se recalcula aca porque entre el
            // cierre del barrido y la transmision puede haber pasado tiempo, y el testigo
            // tiene que ser de AHORA.
            let Some(registrada) = almacen.inventario().raiz(raiz) else {
                return (
                    id.clone(),
                    Desenlace::Reintentable("raiz desconocida".into()),
                );
            };
            let estado = savia_folder_politica::salvaguardas::raiz_viva(
                &registrada,
                &plataforma.evidencia_de_raiz(&registrada),
            );
            if !estado.permite_reportar_bajas() {
                // NI UNA BAJA. Y no es un fallo: es la salvaguarda 2 haciendo su trabajo
                // en el ultimo momento posible.
                traza.push("  (raiz no viva: NINGUNA baja sale)".into());
                return (id.clone(), Desenlace::Reintentable("raiz no viva".into()));
            }
            let bajas = reconstruir_bajas(&estado, entradas);
            (
                id.clone(),
                a_desenlace(
                    cliente
                        .reportar_desaparecidos(raiz, &bajas, &estado)
                        .map(|_| Recibido::Nada),
                ),
            )
        }
        Trabajo::CerrarBarrido {
            id, sweep, cierre, ..
        } => {
            traza.push(format!("sweep.close {cierre:?}"));
            let r = cliente.cerrar_barrido(sweep, *cierre);
            // LO QUE SAVIA RETIRO VA A LA TRAZA. El agente no lo decide y no lo puede
            // discutir, pero es lo unico que le dice que un documento suyo dejo de estar
            // vigente — y sin eso el panel no tiene como mostrarlo.
            if let Ok(c) = &r {
                if !c.retirados.is_empty() {
                    traza.push(format!(
                        "  retirados: {}",
                        c.retirados
                            .iter()
                            .map(|x| x.como_str().to_string())
                            .collect::<Vec<_>>()
                            .join(", ")
                    ));
                }
                // EL CONGELAMIENTO VA A LA TRAZA AUNQUE NO RETIRE NADA — es justamente
                // el caso en que no retirar nada NO significa que no habia nada.
                if c.congelada {
                    traza.push("  raiz congelada por Savia".to_string());
                }
            }
            (
                id.clone(),
                a_desenlace(r.map(|c| Recibido::Retirados {
                    rutas: c.retirados,
                    congelada: c.congelada,
                })),
            )
        }
        Trabajo::Subir {
            id, ruta, permiso, ..
        } => {
            let Some(registrada) = almacen.inventario().raiz(raiz) else {
                return (id.clone(), Desenlace::IlegibleEnDisco);
            };
            match plataforma.leer_para_subir(&registrada, ruta) {
                Err(_) => {
                    traza.push(format!("PUT {} -> ilegible en disco", ruta.como_str()));
                    (id.clone(), Desenlace::IlegibleEnDisco)
                }
                Ok(bytes) => {
                    traza.push(format!("PUT {} ({} bytes)", ruta.como_str(), bytes.len()));
                    let d = match cliente.subir(permiso, &bytes) {
                        Ok(_) => Desenlace::Entregado(Recibido::Nada),
                        // EL TOPE DEL PERMISO NO ES UNA ALERTA PARA UNA PERSONA. Es la
                        // comprobacion previa diciendo que los bytes que hay en disco ya
                        // no son los que se decidieron subir —el permiso se emitio contra
                        // un tamano observado—, que es literalmente lo que
                        // `IlegibleEnDisco` significa: «cambiaron entre la decision y el
                        // PUT». Clasificarlo como cola muerta envenenaba la ruta PARA
                        // SIEMPRE por un archivo que el usuario puede achicar o borrar al
                        // minuto siguiente, y sin que nada lo dijera.
                        Err(FalloDeProtocolo::NoCabeEnElPermiso { .. }) => {
                            traza.push("  (no entra en el permiso: se vuelve a observar)".into());
                            Desenlace::IlegibleEnDisco
                        }
                        Err(e) => a_desenlace(Err(e)),
                    };
                    (id.clone(), d)
                }
            }
        }
        Trabajo::ConfirmarSubida { id, permiso, .. } => {
            traza.push("upload.completed".into());
            // El testigo `Subido` no se puede fabricar, asi que la segunda fase se hace
            // con el id persistido. Es el precio de partir la subida en dos fases, y se
            // paga a proposito: un ACK perdido reintenta el ACK, no el archivo entero.
            let r = cliente.confirmar_subida_reanudada(permiso);
            match r {
                Ok(c) => {
                    if c.divergio {
                        traza.push(
                            "  DIVERGENCIA: se corrige el inventario con el verificado".into(),
                        );
                    }
                    (
                        id.clone(),
                        Desenlace::Entregado(Recibido::Verificado(c.verificado)),
                    )
                }
                Err(e) => (id.clone(), a_desenlace(Err(e))),
            }
        }
    }
}

/// Reconstruye las `Desaparicion` pasando por la puerta. **No hay atajo**: la cola guarda
/// ruta y hash verificado, y volver a construirlas exige otra vez el `EstadoDeRaiz`.
fn reconstruir_bajas(
    estado: &savia_folder_politica::salvaguardas::EstadoDeRaiz,
    entradas: &[(RutaRelativa, savia_folder_contrato::dominio::HashVerificado)],
) -> Vec<savia_folder_politica::salvaguardas::Desaparicion> {
    entradas
        .iter()
        .filter_map(|(r, h)| {
            savia_folder_politica::salvaguardas::puerta_de_baja(estado, r.clone(), Some(*h)).ok()
        })
        .collect()
}

/// La traduccion de `FalloDeProtocolo` a `Desenlace`, y es el unico lugar donde ocurre.
/// Aguas abajo se lee `clase()` y **nunca** el codigo HTTP crudo: la cola no debe saber
/// que existe un 403.
fn a_desenlace(r: Result<Recibido, FalloDeProtocolo>) -> Desenlace {
    match r {
        Ok(v) => Desenlace::Entregado(v),
        Err(e) => match e.clase() {
            Clase::Reintentable => Desenlace::Reintentable(format!("{e:?}")),
            Clase::Credenciales => Desenlace::Credenciales(format!("{e:?}")),
            Clase::Ambiguo => Desenlace::Ambiguo,
            Clase::ColaMuerta => Desenlace::Rechazado {
                // El codigo real, y SOLO para la alerta que una persona va a leer: una
                // entrada muerta que dice `0` obliga a buscar el 404 adentro del texto de
                // debug. Aguas abajo se sigue ramificando por `clase()` y nunca por este
                // numero, que es la regla que el modulo declara.
                status: e.codigo_http().unwrap_or(0),
                cuerpo: format!("{e:?}"),
                // Vacio = el lote entero. Aislar por biseccion cual entrada provoca el
                // `400` cuesta hasta log2(n) llamadas y compra una alerta que nombra LA
                // ruta culpable en vez de las cuarenta del barrido; es una decision de
                // costo y todavia no se tomo.
                culpables: Vec::new(),
            },
        },
    }
}
