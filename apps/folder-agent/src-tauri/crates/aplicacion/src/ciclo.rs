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
use savia_folder_protocolo::{CanalDeSavia, FalloDeProtocolo};

/// **EL RESUMEN CUENTA LOS ONCE NODOS, NO SEIS.** El doc de `Nodo` dice que la rama va
/// en la salida «porque es lo que el panel muestra por raiz»; mientras cuatro variantes
/// caian en un `_ => {}`, el panel no las podia mostrar. `Nodo::Fallo` (D3, fase 3) es
/// la undecima: no cambia el argumento, solo la cuenta.
///
/// Y las dos que faltaban son justo las que hay que ver: `RaizAusente` es la salvaguarda
/// disparandose —«se desmonto el disco y no reporte ni una baja»— y `BajaNoReportable`
/// OLVIDA una fila. Las dos terminaban sin dejar rastro.
/// `PartialEq` esta para UNA cosa y conviene decir cual: que un test pueda afirmar que
/// `barrer_reportando` y `barrer` devuelven el MISMO resumen sobre el mismo escenario. Sin
/// el, esa comparacion se escribe campo por campo, y un campo nuevo del resumen entraria
/// sin que la comparacion lo mire — que es exactamente la clase de agujero que el resto de
/// este archivo se esfuerza en cerrar.
#[derive(Default, Debug, PartialEq, Eq)]
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
    /// `Nodo::Fallo` — lecturas locales terminales (hoy, solo un permiso denegado). Ver
    /// `MotivoDeFallo` en `contrato::inventario`.
    pub fallos_locales: u64,
    pub cierre: Option<EstadoDelBarrido>,
}

/// Una vuelta sobre una raiz. **No transmite nada**: solo llena el almacen. El drenaje es
/// aparte a proposito — el contrato con la cola dice que ninguna baja se transmite con
/// un barrido abierto de esa raiz.
///
/// **La firma no se toca.** La usan mecanicamente las tres bancadas de `tests/` y el hilo
/// de trabajo del host; quien quiera mirar el avance archivo por archivo tiene
/// `barrer_reportando`, que es esta misma vuelta con un testigo enchufado.
pub fn barrer(
    raiz: &RaizId,
    barrido: BarridoId,
    plataforma: &dyn Plataforma,
    almacen: &mut Almacen,
    politica: &Politica,
) -> ResumenDelBarrido {
    barrer_interno(raiz, barrido, plataforma, almacen, politica, None)
}

/// La MISMA vuelta que `barrer`, con un testigo que se llama **una vez por archivo
/// iterado** con `(procesados, total)`. `total` es el conjunto enumerado y se conoce ANTES
/// del primer archivo, asi que la primera llamada ya trae el denominador completo: una
/// barra de progreso no tiene que adivinar contra que crece.
///
/// El resumen que devuelve es identico al de `barrer` sobre el mismo escenario — el
/// testigo MIRA, no participa.
///
/// # El throttle es de quien llama, y no es un detalle de estilo
///
/// La Fase 7 del plan pide que «el canal se prueba con un barrido de miles sin que el
/// panel se trabe», y esta funcion sola no lo puede cumplir: se llama **por cada archivo**,
/// asi que enchufarla derecho a un `app.emit(...)` sobre una raiz de decenas de miles
/// significa decenas de miles de eventos IPC — la cola del webview se llena, el panel se
/// pone a repintar en vez de a responder, y el sintoma es justo el que la fase pide evitar.
///
/// **Aca adentro no hay ningun «cada N archivos», y esa ausencia es deliberada**: N seria
/// un numero que decide comportamiento y que nadie midio. Quien conecta el testigo —la
/// integracion en `bandeja/main.rs`, o el frontend juntando repintados— es quien tiene el
/// costo real del canal a la vista y por lo tanto el unico que puede elegir el corte:
/// emitir por tiempo transcurrido, por porcentaje cambiado, o coalescer del lado del
/// webview. Esta funcion entrega el dato crudo y completo.
pub fn barrer_reportando(
    raiz: &RaizId,
    barrido: BarridoId,
    plataforma: &dyn Plataforma,
    almacen: &mut Almacen,
    politica: &Politica,
    on_progreso: &mut dyn FnMut(usize, usize),
) -> ResumenDelBarrido {
    barrer_interno(
        raiz,
        barrido,
        plataforma,
        almacen,
        politica,
        Some(on_progreso),
    )
}

/// El cuerpo, uno solo. Las dos puertas publicas se distinguen SOLO en el ultimo
/// parametro: si hubiera dos cuerpos, la que nadie mira en el banco se desviaria de la
/// otra y el desvio no lo notaria nadie hasta produccion.
fn barrer_interno(
    raiz: &RaizId,
    barrido: BarridoId,
    plataforma: &dyn Plataforma,
    almacen: &mut Almacen,
    politica: &Politica,
    mut on_progreso: Option<&mut dyn FnMut(usize, usize)>,
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
    // EL DENOMINADOR DEL TESTIGO QUEDA FIJADO ACA, ANTES DEL PRIMER ARCHIVO. Es lo que
    // hace que `barrer_reportando` pueda decir «1 de 40.000» ya en su primera llamada, en
    // vez de un total que crece solo: `rutas` es el conjunto entero que este barrido va a
    // recorrer, y no cambia adentro del lazo.
    //
    // **NO ES EL `_total` DE `abrir_barrido`**, que es otra cosa y se descarta tres lineas
    // mas arriba: aquel es el tamano del INVENTARIO —el denominador del corte por volumen,
    // lo unico conocido al abrir— y este es el tamano de lo ENUMERADO. Que difieran es el
    // caso normal, y es justamente lo que el barrido va a resolver.
    let total_enumerado = rutas.len();
    resumen.enumeradas = total_enumerado;

    let mut indice = IndiceDeContenido::nuevo();
    // EL PADRON SE JUNTA ACA Y NO SE DERIVA DEL INVENTARIO DESPUES, porque la lista de
    // lo presente la tiene EL RECORRIDO y no la creencia. Un deshidratado que el agente
    // ve por primera vez sale por `Nodo::Omitido` con cero efectos: no deja fila. Un
    // padron derivado del inventario lo omitiria, y omitir del padron es exactamente
    // decir «no esta».
    let mut padron: Vec<(RutaRelativa, Option<HashVerificado>)> = Vec::new();
    let reloj = RelojDePlataforma(plataforma);

    for (procesados, ruta) in rutas.iter().enumerate() {
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
            Nodo::Fallo(_) => resumen.fallos_locales += 1,
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
        // AL FINAL DE LA ITERACION Y NO AL PRINCIPIO: `procesados` cuenta archivos
        // TERMINADOS, asi que la primera llamada dice «1 de N» y la ultima «N de N». Con
        // el aviso al principio, un barrido de N archivos nunca alcanzaria su propio total
        // y la barra se quedaria a un archivo del final para siempre.
        if let Some(avisar) = on_progreso.as_deref_mut() {
            avisar(procesados + 1, total_enumerado);
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

/// **`PartialEq` esta para lo mismo que en `ResumenDelBarrido` (ver su doc, arriba):
/// que un test pueda afirmar que `drenar_reportando` y `drenar` devuelven el MISMO
/// resultado sobre el mismo escenario.**
#[derive(Debug, PartialEq, Eq)]
pub enum ResultadoDelDrenaje {
    Vacia,
    Detenida(savia_folder_estado::colas::MotivoDeDetencion),
}

/// Drena una raiz hasta que no queda trabajo o hasta que un error de credenciales la
/// detiene. **Un trabajo en vuelo por vez**: dos en paralelo reordenan, y el orden ES el
/// significado.
///
/// **La firma no se toca.** Igual que `barrer`, quien quiera ver el avance tiene
/// `drenar_reportando` — la misma vuelta con un testigo enchufado.
pub fn drenar(
    raiz: &RaizId,
    plataforma: &dyn Plataforma,
    almacen: &mut Almacen,
    canal: &dyn CanalDeSavia,
    traza: &mut Vec<String>,
) -> ResultadoDelDrenaje {
    drenar_interno(raiz, plataforma, almacen, canal, traza, None)
}

/// La MISMA vuelta que `drenar`, con un testigo que se llama **una vez por trabajo que
/// avanzo** —no por intento: un `Reintentable` no completo nada y no cuenta— con
/// `(procesados, total)`.
///
/// A diferencia de `barrer_reportando`, `total` **no es una constante**: `drenar` no
/// enumera nada por adelantado, así que no hay ningun conjunto fijo contra el que medir.
/// En cambio se recalcula en cada aviso como `procesados + lo que la cola dice que
/// falta` — `Colas::hechos_pendientes` (altas y bajas encoladas sin transmitir) mas
/// `Colas::bytes_pendientes` (subida/confirmacion en vuelo), los dos ya publicos y ya
/// usados por los tests de `Colas`. Ese "lo que falta" puede SUBIR de una llamada a la
/// siguiente —`Observar` recien descubre cuantos bytes hacen falta cuando Savia
/// contesta— y es lo esperado: es la cola misma diciendo que encontro mas trabajo, no un
/// error del testigo.
pub fn drenar_reportando(
    raiz: &RaizId,
    plataforma: &dyn Plataforma,
    almacen: &mut Almacen,
    canal: &dyn CanalDeSavia,
    traza: &mut Vec<String>,
    on_progreso: &mut dyn FnMut(usize, usize),
) -> ResultadoDelDrenaje {
    drenar_interno(raiz, plataforma, almacen, canal, traza, Some(on_progreso))
}

/// El cuerpo, uno solo — mismo motivo que `barrer_interno`.
fn drenar_interno(
    raiz: &RaizId,
    plataforma: &dyn Plataforma,
    almacen: &mut Almacen,
    canal: &dyn CanalDeSavia,
    traza: &mut Vec<String>,
    mut on_progreso: Option<&mut dyn FnMut(usize, usize)>,
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
    let mut procesados = 0usize;
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
        let (id, desenlace) = ejecutar(raiz, plataforma, almacen, canal, &trabajo, traza);
        // Si el trabajo no avanza —reintentable con la red caida— se corta el lazo en vez
        // de girar para siempre. El reintento con espera es del drenador de produccion, y
        // su curva entra por parametro; aca no se inventa ninguna.
        let avanza = matches!(
            desenlace,
            Desenlace::Entregado(_) | Desenlace::IlegibleEnDisco | Desenlace::Ambiguo
        );
        almacen.resolver(raiz, &id, desenlace);
        if avanza {
            procesados += 1;
            if let Some(avisar) = on_progreso.as_deref_mut() {
                let colas = almacen.colas();
                let restante = colas.hechos_pendientes(raiz) + colas.bytes_pendientes(raiz);
                avisar(procesados, procesados + restante as usize);
            }
        }
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
    canal: &dyn CanalDeSavia,
    trabajo: &Trabajo,
    traza: &mut Vec<String>,
) -> (TrabajoId, Desenlace) {
    match trabajo {
        Trabajo::AbrirBarrido { id, total, .. } => {
            traza.push(format!("sweep.open total={total}"));
            // EL SERVIDOR COMPARA ESE `total` CONTRA SUS DOCUMENTOS VIVOS y contesta si
            // hace falta el padron. La bandera entra a la cola pegada al `sweepId`: es la
            // respuesta a ESTE `sweep.open` y a ninguno otro.
            let r = canal.abrir_barrido(raiz, *total);
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
                    canal
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
                a_desenlace(canal.enviar_padron(sweep, &payload).map(|_| Recibido::Nada)),
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
                    canal
                        .reportar_desaparecidos(raiz, &bajas, &estado)
                        .map(|_| Recibido::Nada),
                ),
            )
        }
        Trabajo::CerrarBarrido {
            id, sweep, cierre, ..
        } => {
            traza.push(format!("sweep.close {cierre:?}"));
            let r = canal.cerrar_barrido(sweep, *cierre);
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
                    let d = match canal.subir(permiso, &bytes) {
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
            let r = canal.confirmar_subida_reanudada(permiso);
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
///
/// **CADA RAMA QUE CORTA EL DRENAJE DEJA UN RASTRO EN EL LOG.** Hasta ahora ninguna lo
/// hacia: un 401 (`Credenciales`) y una red caida (`Reintentable`) eran indistinguibles,
/// en la traza, de "la cola simplemente no tenia nada que hacer" — la unica manera de
/// distinguirlos era adivinar. `Ambiguo` no loggea a proposito: `drenar` lo trata como
/// avance (ver su `matches!`), no como un corte.
fn a_desenlace(r: Result<Recibido, FalloDeProtocolo>) -> Desenlace {
    match r {
        Ok(v) => Desenlace::Entregado(v),
        Err(e) => match e.clase() {
            Clase::Reintentable => {
                log::warn!("fallo reintentable, se corta el drenaje esta vuelta: {e:?}");
                Desenlace::Reintentable(format!("{e:?}"))
            }
            Clase::Credenciales => {
                log::error!("credenciales rechazadas, la raiz se detiene: {e:?}");
                Desenlace::Credenciales(format!("{e:?}"))
            }
            Clase::Ambiguo => Desenlace::Ambiguo,
            Clase::ColaMuerta => {
                log::error!("cola muerta, hace falta una persona: {e:?}");
                Desenlace::Rechazado {
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
                }
            }
        },
    }
}
