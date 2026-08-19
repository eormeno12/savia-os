//! EL FLUJOGRAMA «El ciclo, de punta a punta», Y NADA MAS.
//!
//! Una funcion pura `decidir(senal) -> Paso` que recorre exactamente los nodos
//! dibujados —MARK · STAT · EX · DEHY · SAME · SETTLE · HASH · APP, y del otro lado
//! MOVE · ROOT · VAN— sobre tres puertos inyectados, mas `cerrar_barrido` para el
//! veredicto de la vuelta.
//!
//! «Pura» quiere decir lo mismo que en `packages/ir`: sin I/O ambiente, sin globals, sin
//! `unsafe`, sin leer el reloj del sistema, sin `&mut` en ningun puerto. Mismos puertos
//! + misma senal = mismo `Paso`, bit a bit.
//!
//! **EL ORDEN DE LOS NODOS ES UNA PROPIEDAD DE SEGURIDAD, NO DE GUSTO.** Si «juntar
//! todo y despues decidir» fuera el diseno, habria que hashear antes de preguntar si el
//! archivo esta deshidratado — que en macOS es descargar el drive de nube entero del
//! usuario. Por eso la maquina no recibe una observacion ya hecha: MANEJA los puertos en
//! un orden fijo, y ese orden es lo que se verifica.
//!
//! ══ LAS TRES CONTRADICCIONES ENTRE DISENOS QUE SE RESUELVEN ACA ══
//!
//! **1 · ¿UN EVENTO DEL SO PUEDE PRODUCIR UNA BAJA?** El flujograma tiene `VAN`
//! alcanzable desde la rama de la senal; el diseno de la maquina decia que no, que todas
//! las bajas salen del cierre completo de un barrido. Se resuelve **con una frase del
//! propio borrador**, que es la autoridad: «el barrido es lo unico que establece verdad
//! de campo, y por lo tanto **la unica fuente legitima de un conjunto de bajas**». Asi
//! que `VAN` se alcanza cuando la senal es un TURNO DEL BARRIDO —que es una de las dos
//! entradas que el flujograma dibuja— y no cuando es un evento suelto. Un evento sobre
//! una ruta que no esta agenda un barrido y no produce nada. Lo que se paga: retirar
//! tarda un periodo de barrido mas. Lo que se gana: la correlacion por contenido tiene
//! un arbol bien definido contra el cual mirar, y un `rename(A→B)` cuyo evento de A
//! llega antes que el de B no puede emitir una baja falsa.
//!
//! **2 · ¿CONTRA QUE CORRELACIONA `MOVE`?** El borrador dice «un hash que reaparece en
//! CUALQUIER punto del arbol». Tomado literal, borrar UNA de dos copias identicas nunca
//! produce baja y ese documento queda vigente para siempre. Se correlaciona contra un
//! **alta de este barrido**, que es «reaparecio donde antes no estaba» — el espiritu de
//! la regla, no una excepcion. Y como a mitad del recorrido el indice esta incompleto,
//! `cerrar_barrido` **vuelve a evaluar** MOVE con el recorrido ya terminado y devuelve
//! `anular`: las bajas que la cola tira ANTES de transmitir. Es la misma razon por la
//! que el barrido es la unica fuente legitima de un conjunto de bajas.
//!
//! **3 · `marcar_vista` NO ES UN EFECTO DE LA MAQUINA.** El invariante «tripleta igual ⇒
//! cero lecturas y cero efectos» y la contabilidad de `vista_en` se contradecian. Gana
//! el invariante: `vista_en` es contabilidad del RECORRIDO y la escribe el barrido, no
//! consecuencia de una decision.
#![forbid(unsafe_code)]

use crate::dominio::{
    BarridoId, EstadoDelBarrido, HashVerificado, Instante, RaizId, Reloj, RutaRelativa,
};
use crate::inventario::{
    EfectoDeInventario, EstadoDeFila, EstadoDeHash, Inventario, estrena_contenido,
};
use crate::plataforma::{FalloDeLectura, Ficha, MotivoIndeterminado, Plataforma};
use crate::salvaguardas::{
    self, Aparicion, Asentamiento, Correlacion, Desaparicion, EstadoDeRaiz, Hecho,
    IndiceDeContenido, Politica, PorQueNoSeReporta,
};
use std::time::Duration;

// ══════════════════════════════ La senal ════════════════════════════════════

/// **SIN PAYLOAD, Y ESO ES EL NODO `MARK` ENTERO.** Los APIs del sistema entregan
/// banderas —«removed», «created», «renamed»—; aca no hay donde ponerlas, asi que «un
/// evento NUNCA produce un reporte» es inexpresable en vez de detectable. El hecho sale
/// del `stat` y del hash; los eventos hablan de rutas, y las rutas no son identidad.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum OrigenDeSenal {
    EventoDelSistema,
    TurnoDelBarrido,
}

/// Rojo en compilacion si alguien le cuelga un dato al origen.
const _: () = assert!(core::mem::size_of::<OrigenDeSenal>() == 1);

/// Toda senal nombra su raiz, y por construccion del struct: «desaparecieron 40
/// archivos» sin nombrar la raiz es indistinguible entre «se desmonto un disco» y
/// «alguien vacio una carpeta». Con el campo adentro, una senal sin raiz es
/// inexpresable.
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct Senal {
    pub raiz: RaizId,
    pub ruta: RutaRelativa,
    pub origen: OrigenDeSenal,
}

// ══════════════════════════════ La salida ═══════════════════════════════════

/// EN QUE NODO DEL FLUJOGRAMA TERMINO. Va en la salida para que el banco afirme sobre la
/// RAMA y no la infiera de los efectos, y porque es lo que el panel muestra por raiz.
#[derive(Clone, PartialEq, Eq, Debug)]
pub enum Nodo {
    /// SKIP — deshidratado: no es ausente, no abrir.
    Omitido,
    /// NOOP.
    SinCambio,
    /// WAIT — y DICE CUANDO VOLVER.
    Esperando { reintentar_en: Duration },
    /// MOV — el movimiento muere aca y no llega nunca al servidor.
    Movimiento {
        desde: RutaRelativa,
        hacia: RutaRelativa,
    },
    /// ABSENT — NINGUNA baja.
    RaizAusente,
    /// APP.
    Aparecio,
    /// VAN.
    Desaparecio,
    /// La tercera arista de `¿existe?`, que el flujograma no dibuja porque asume que un
    /// `stat` contesta si/no.
    Indeterminado(MotivoIndeterminado),
    /// Un evento vio faltar una ruta. **No es una baja**: es la orden de barrer, porque
    /// solo el barrido establece verdad de campo. Ver la resolucion 1 del encabezado.
    AgendaBarrido,
    /// La ruta se fue y Savia nunca confirmo un hash para ella: no hay documento que
    /// retirar. La fila se olvida y no viaja nada.
    BajaNoReportable,
}

/// Una decision no se puede tirar al piso.
#[must_use]
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct Paso {
    pub nodo: Nodo,
    /// 0 o 1. **NUNCA 2**: `desaparecio(P,H1)` y `aparecio(P,H2)` emitidos juntos y
    /// drenados al reves son el borrado de la version nueva. `Option` lo hace
    /// inexpresable.
    pub hecho: Option<Hecho>,
    /// El llamador los aplica EN LA MISMA transaccion que el hecho.
    pub efectos: Vec<EfectoDeInventario>,
}

impl Paso {
    fn nada(nodo: Nodo) -> Self {
        Self {
            nodo,
            hecho: None,
            efectos: Vec::new(),
        }
    }
}

#[must_use]
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct Cierre {
    /// Lo que viaja en `sweep.close`.
    pub estado: EstadoDelBarrido,
    /// Bajas ya encoladas que la cola TIRA antes de transmitir, porque el recorrido
    /// completo mostro que eran movimientos.
    pub anular: Vec<RutaRelativa>,
    pub efectos: Vec<EfectoDeInventario>,
    /// Las bajas que el cierre agrega: las filas que el recorrido no vio.
    pub bajas: Vec<Desaparicion>,
    /// Por que se retuvo cada una que no salio. Para el panel, nunca para el servidor.
    pub retenidas: Vec<(RutaRelativa, PorQueNoSeReporta)>,
}

// ══════════════════════════ La entrada principal ════════════════════════════

/// El flujograma, exacto.
///
/// Recorrido, en el orden dibujado y con las llamadas a puerto de cada arista:
/// ```text
///   stat → Indeterminada          ⇒ Indeterminado    · 0 lecturas · 0 sondeos de raiz
///        → Presente/Deshidratado  ⇒ Omitido          · 0 lecturas
///        → Presente/Materializado ⇒ SAME → SETTLE → hashear → Aparecio
///        → NoExiste (con barrido) ⇒ MOVE → ROOT → Desaparecio
///        → NoExiste (sin barrido) ⇒ AgendaBarrido    · 0 sondeos de raiz
/// ```
///
/// `evidencia_de_raiz` se consulta SOLO en la rama de las ausencias y SOLO despues de
/// MOVE: un disco montado cuesta cero enumeraciones, y un movimiento tampoco cuesta
/// ninguna. `hashear` se llama a lo sumo UNA vez, y solo despues de SETTLE. El reloj se
/// muestrea UNA vez, arriba de todo, para que dos aristas no vean instantes distintos.
pub fn decidir(
    senal: &Senal,
    barrido: Option<&BarridoId>,
    plataforma: &dyn Plataforma,
    inventario: &dyn Inventario,
    reloj: &dyn Reloj,
    politica: &Politica,
) -> Paso {
    let ahora = reloj.ahora();
    let Some(registrada) = inventario.raiz(&senal.raiz) else {
        // Una senal sobre una raiz que el inventario no conoce no puede producir nada:
        // no hay huella contra la cual verificar identidad, asi que no hay forma de
        // afirmar que la raiz este viva.
        return Paso::nada(Nodo::RaizAusente);
    };

    match plataforma.ficha(&registrada, &senal.ruta) {
        // La TERCERA arista. Permiso denegado, error de E/S, unidad de red que no
        // contesta. NUNCA produce hecho ni efecto: un Full Disk Access revocado por una
        // actualizacion de macOS produce el conjunto COMPLETO de ausencias de la raiz, y
        // ROOT no lo atrapa porque la carpeta se enumera perfecto.
        Ficha::Indeterminada(m) => Paso::nada(Nodo::Indeterminado(m)),

        Ficha::Presente {
            observacion,
            hidratacion,
        } => {
            // DEHY VA ANTES QUE SAME, no solo antes que HASH. La transicion a
            // deshidratado suele dejar el archivo en 0 bytes, asi que comparar primero
            // contesta «cambio» y arrastra a HASH — o sea, a materializar.
            if !salvaguardas::se_puede_abrir(hidratacion) {
                return Paso::nada(Nodo::Omitido);
            }

            let asiento = inventario.asiento(&senal.raiz, &senal.ruta);
            let granularidad = plataforma.granularidad_de_mtime(&registrada);

            // SAME — contra la FILA, y solo si la fila esta `Presente`. Una fila ausente
            // NO TIENE observacion contra la cual algo pueda ser igual: es lo que hace
            // que un archivo que se va y vuelve identico se reporte igual.
            if let Some(a) = &asiento
                && let Some(EstadoDeFila::Presente {
                    observacion: guardada,
                    hash: guardado,
                }) = a.fila
                && salvaguardas::misma_observacion(&guardada, &observacion, granularidad)
            {
                let mut efectos = Vec::new();
                if a.candidato.is_some() {
                    // Cambio y volvio: el candidato dejo de tener sentido.
                    efectos.push(EfectoDeInventario::OlvidarCandidato {
                        ruta: senal.ruta.clone(),
                    });
                }
                // LA UNICA SALIDA DE NOOP QUE NO ES UN CAMBIO EN DISCO, y existe porque
                // sin ella la promesa de `Confirmacion::HashEnDuda` no la cumple nadie.
                // Un `upload.completed` cuya respuesta se perdio deja al agente sin saber
                // que hash tiene Savia; la tripleta no cambio, asi que la comparacion de
                // arriba corta el paso en cada barrido y esa ruta no vuelve a viajar
                // NUNCA. Se re-afirma el hash que ya se tiene —CERO lecturas, cero
                // bytes— y el `known` la re-confirma. Si Savia contesta `upload`, el
                // camino de bytes vuelve a correr; si vuelve a perderse, se repite: cada
                // vuelta es progreso real, no un giro.
                if a.en_duda
                    && let EstadoDeHash::Afirmado(afirmado) = guardado
                {
                    return Paso {
                        nodo: Nodo::Aparecio,
                        hecho: Some(Hecho::Aparecio(Aparicion::nueva(
                            senal.ruta.clone(),
                            afirmado,
                        ))),
                        efectos,
                    };
                }
                return Paso {
                    nodo: Nodo::SinCambio,
                    hecho: None,
                    efectos,
                };
            }

            // MOVE VISTO DESDE EL DESTINO, y va ANTES que SETTLE.
            //
            // No esta en el flujograma —ahi MOVE solo cuelga de la rama de las
            // ausencias— y hace falta igual, porque el flujograma y la tabla del
            // inventario se contradicen: la tabla dice que `idDeArchivoDelSO` «hace que
            // renombrar y mover cuesten CERO I/O», y sin este nodo el destino es una
            // ruta nueva que se hashea entera. Mover una carpeta de 2 GB costaria leer
            // 2 GB.
            //
            // Va antes que SETTLE por la misma razon: preguntarle a un archivo movido
            // «¿estos bytes dejaron de cambiar?» no tiene sentido —no cambiaron, se
            // mudaron— y esperarle el intervalo lo dejaria sin registrar durante una
            // vuelta entera, que es justo cuando su origen se va a ver faltar.
            //
            // EL GUARDIAN ES «LA RUTA NO SOSTIENE CONTENIDO», NO «NO HAY FILA». Con `no
            // hay fila` alcanzaba, una LAPIDA en la ruta destino —o una fila que solo
            // tiene candidato— desactivaba el nodo y reintroducia exactamente lo que
            // existe para evitar: borrar `informes/2024.pdf` y despues mover
            // `descargas/2024.pdf` ahi es un renombre puro, y salia como
            // `presence.vanished` del origen. Una ruta con lapida no tiene contenido que
            // este movimiento pueda pisar; una `Presente` si, y ahi esto seria una
            // sustitucion, no una mudanza.
            if estrena_contenido(asiento.and_then(|a| a.fila))
                && let Some(origen) = inventario.fila_con_misma_observacion(
                    &senal.raiz,
                    &observacion,
                    granularidad,
                    &senal.ruta,
                )
            {
                return Paso {
                    nodo: Nodo::Movimiento {
                        desde: origen.clone(),
                        hacia: senal.ruta.clone(),
                    },
                    // CERO HECHO: mover y renombrar mueren aca y no llegan nunca al
                    // servidor. `estadoDeReporte` no se toca — Savia sigue sabiendo
                    // exactamente lo que sabia.
                    hecho: None,
                    efectos: vec![EfectoDeInventario::MoverRuta {
                        de: origen,
                        a: senal.ruta.clone(),
                        observacion,
                    }],
                };
            }

            // SETTLE — el UNICO punto del arbol donde se consulta el reloj para decidir,
            // y esta enteramente contenido en la rama `existe = si`. Las dos ramas de
            // `¿existe?` son disjuntas, asi que «asentamiento y cuarentena nunca se
            // aplican al mismo evento» no es disciplina: es el tipo `Ficha`.
            let candidato = asiento.as_ref().and_then(|a| a.candidato);
            match salvaguardas::asentar(
                candidato.as_ref(),
                &observacion,
                ahora,
                granularidad,
                politica,
            ) {
                Asentamiento::Inestable {
                    candidato,
                    reintentar_en,
                } => Paso {
                    nodo: Nodo::Esperando { reintentar_en },
                    hecho: None,
                    efectos: vec![EfectoDeInventario::AnotarCandidato {
                        ruta: senal.ruta.clone(),
                        candidato,
                    }],
                },
                Asentamiento::Asentado => match plataforma.hashear(&registrada, &senal.ruta) {
                    Err(FalloDeLectura::HidratacionRequerida) => Paso::nada(Nodo::Omitido),
                    Err(_) => {
                        // Un error de lectura NO produce hecho, y no descarta el
                        // candidato: vuelve a esperar. Que el archivo se haya ido entre
                        // el `stat` y la lectura no lo convierte en una baja decidida
                        // desde una vista parcial.
                        Paso::nada(Nodo::Esperando {
                            reintentar_en: politica.asentamiento(),
                        })
                    }
                    Ok((hash, observado_al_abrir)) => {
                        // Un `touch` cambia el `mtime` y no cambia un byte, y eso no es
                        // un hecho: se refresca la tripleta y no se reporta nada.
                        let mismo_contenido = matches!(
                            asiento.as_ref().and_then(|a| a.fila),
                            Some(EstadoDeFila::Presente { hash: h, .. }) if h.contenido() == hash.bytes()
                        );
                        let efectos = vec![EfectoDeInventario::ConfirmarPresencia {
                            ruta: senal.ruta.clone(),
                            // La `Observacion` que se guarda es la del momento de
                            // ABRIR, no la de enumerar: entre las dos pasa tiempo, y la
                            // tripleta que evita rehashear tiene que ser la del momento
                            // en que se leyeron los bytes o miente.
                            observacion: observado_al_abrir,
                            hash,
                        }];
                        if mismo_contenido {
                            return Paso {
                                nodo: Nodo::SinCambio,
                                hecho: None,
                                efectos,
                            };
                        }
                        Paso {
                            nodo: Nodo::Aparecio,
                            hecho: Some(Hecho::Aparecio(Aparicion::nueva(
                                senal.ruta.clone(),
                                hash,
                            ))),
                            efectos,
                        }
                    }
                },
            }
        }

        Ficha::NoExiste => {
            let Some(asiento) = inventario.asiento(&senal.raiz, &senal.ruta) else {
                // No esta y nunca estuvo. Una ALTA no puede nacer de una ausencia y una
                // BAJA no puede nacer de algo que el inventario no tiene.
                return Paso::nada(Nodo::SinCambio);
            };
            let Some(fila) = asiento.fila else {
                return Paso::nada(Nodo::SinCambio);
            };
            let EstadoDeFila::Presente { hash, .. } = fila else {
                // UNA AUSENCIA YA REPORTADA NO SE REPORTA DOS VECES. Una tormenta de
                // eventos por desmontaje mandaria N copias de la misma baja e inflaria
                // la fraccion del corte por volumen por encima de su propio denominador.
                return Paso::nada(Nodo::SinCambio);
            };

            // Resolucion 1 del encabezado: sin barrido abierto, un evento no produce una
            // baja. Agenda.
            let Some(barrido) = barrido else {
                return Paso::nada(Nodo::AgendaBarrido);
            };

            // MOVE — antes que ROOT, y contra el INVENTARIO, no contra el disco.
            // Recorrer el arbol por cada archivo faltante es O(n²), y en el caso «se
            // desmonto el disco» son 40.000 recorridos de un arbol que no esta.
            if let Some(destino) =
                inventario.alta_del_barrido_con(&senal.raiz, hash.contenido(), barrido, &senal.ruta)
            {
                return Paso {
                    nodo: Nodo::Movimiento {
                        desde: senal.ruta.clone(),
                        hacia: destino,
                    },
                    hecho: None,
                    efectos: vec![EfectoDeInventario::OlvidarRuta {
                        ruta: senal.ruta.clone(),
                    }],
                };
            }

            // ROOT — y esta es la que evita el desastre. Se consulta SOLO aca: una
            // vuelta donde todo esta presente hace CERO sondeos.
            let estado =
                salvaguardas::raiz_viva(&registrada, &plataforma.evidencia_de_raiz(&registrada));
            emitir_baja(&senal.ruta, hash.confirmado(), &estado, ahora)
        }
    }
}

/// La construccion de la baja, en un solo lugar. Pasa SIEMPRE por
/// `salvaguardas::puerta_de_baja`, que es la unica que puede fabricar una
/// `Desaparicion` y que exige el `EstadoDeRaiz` por parametro.
fn emitir_baja(
    ruta: &RutaRelativa,
    confirmado: Option<HashVerificado>,
    estado: &EstadoDeRaiz,
    ahora: Instante,
) -> Paso {
    match salvaguardas::puerta_de_baja(estado, ruta.clone(), confirmado) {
        Ok(baja) => {
            let ultimo_hash = *baja.ultimo_hash();
            Paso {
                nodo: Nodo::Desaparecio,
                hecho: Some(Hecho::Desaparecio(baja)),
                efectos: vec![EfectoDeInventario::MarcarAusente {
                    ruta: ruta.clone(),
                    ultimo_hash,
                    desde: ahora,
                }],
            }
        }
        // RAIZ NO VIVA ⇒ CERO BAJAS, sin importar cuantas ausencias haya, y sin efecto:
        // no se marca ausente algo que no se pudo mirar.
        Err(PorQueNoSeReporta::RaizAusente) => Paso::nada(Nodo::RaizAusente),
        Err(PorQueNoSeReporta::SinHashConfirmado) => Paso {
            nodo: Nodo::BajaNoReportable,
            hecho: None,
            efectos: vec![EfectoDeInventario::OlvidarRuta { ruta: ruta.clone() }],
        },
        Err(_) => Paso::nada(Nodo::RaizAusente),
    }
}

// ═══════════════════ El veredicto de la vuelta ══════════════════════════════

/// MOVE y ROOT reevaluados **cuando ya hay respuesta completa**.
///
/// A mitad de un barrido el inventario todavia no vio las rutas que faltan recorrer: si
/// un archivo se movio de A a B y el recorrido toca A primero, MOVE contesta «no
/// reaparece» con verdad parcial. La maquina no agrega una rama — el cierre vuelve a
/// mirar, que es cuando «el hash reaparece en el arbol» tiene respuesta completa.
///
/// Raiz no viva al cerrar ⇒ `Interrumpido` + `anular` TODAS las bajas pendientes de esa
/// raiz. Raiz viva ⇒ `anular` solo las que resultaron ser movimientos.
pub fn cerrar_barrido(
    raiz: &RaizId,
    barrido: &BarridoId,
    plataforma: &dyn Plataforma,
    inventario: &dyn Inventario,
    reloj: &dyn Reloj,
    indice: &IndiceDeContenido,
    recorrido_completo: bool,
) -> Cierre {
    let ahora = reloj.ahora();
    let Some(registrada) = inventario.raiz(raiz) else {
        return Cierre {
            estado: EstadoDelBarrido::Interrumpido,
            anular: Vec::new(),
            efectos: Vec::new(),
            bajas: Vec::new(),
            retenidas: Vec::new(),
        };
    };
    let estado = salvaguardas::raiz_viva(&registrada, &plataforma.evidencia_de_raiz(&registrada));

    let mut anular = Vec::new();
    let mut efectos = Vec::new();
    let mut bajas = Vec::new();
    let mut retenidas = Vec::new();

    // 1 · Las bajas YA encoladas en este barrido: ¿alguna resulto ser un movimiento
    //     ahora que el recorrido termino? Y si la raiz murio en el medio, se anulan
    //     TODAS: un barrido interrumpido y un borrado masivo producen el mismo conjunto.
    for (ruta, fila) in inventario.ausentes_desde(raiz, barrido) {
        let EstadoDeFila::Ausente { ultimo_hash, .. } = fila else {
            continue;
        };
        if !estado.permite_reportar_bajas() {
            anular.push(ruta.clone());
            efectos.push(EfectoDeInventario::OlvidarRuta { ruta: ruta.clone() });
            retenidas.push((ruta, PorQueNoSeReporta::RaizAusente));
            continue;
        }
        if let Correlacion::Movimiento { a } =
            salvaguardas::correlacionar(indice, ultimo_hash.bytes(), &ruta)
        {
            anular.push(ruta.clone());
            efectos.push(EfectoDeInventario::OlvidarRuta { ruta: ruta.clone() });
            retenidas.push((ruta, PorQueNoSeReporta::EsMovimiento { a }));
        }
    }

    // 2 · Las filas que el recorrido NO vio. Son el conjunto de ausencias, y solo salen
    //     con la raiz viva y el recorrido completo.
    if estado.permite_reportar_bajas() && recorrido_completo {
        for (ruta, fila) in inventario.no_vistas_en(raiz, barrido) {
            let EstadoDeFila::Presente { hash, .. } = fila else {
                continue;
            };
            if let Correlacion::Movimiento { a } =
                salvaguardas::correlacionar(indice, hash.contenido(), &ruta)
            {
                efectos.push(EfectoDeInventario::OlvidarRuta { ruta: ruta.clone() });
                retenidas.push((ruta, PorQueNoSeReporta::EsMovimiento { a }));
                continue;
            }
            let paso = emitir_baja(&ruta, hash.confirmado(), &estado, ahora);
            efectos.extend(paso.efectos);
            match paso.hecho {
                Some(Hecho::Desaparecio(d)) => bajas.push(d),
                _ => retenidas.push((ruta, PorQueNoSeReporta::SinHashConfirmado)),
            }
        }
    }

    // Un barrido solo cierra COMPLETO si el recorrido termino Y la raiz sigue viva.
    // Cerrarlo completo sobre un recorrido parcial le afirma a Savia que se recorrio
    // entero un arbol que se recorrio a medias, y las ausencias del tramo no recorrido
    // se vuelven evidencia de baja.
    let estado_del_barrido = if recorrido_completo && salvaguardas::puede_cerrar_completo(&estado) {
        EstadoDelBarrido::Completo
    } else {
        EstadoDelBarrido::Interrumpido
    };

    Cierre {
        estado: estado_del_barrido,
        anular,
        efectos,
        bajas,
        retenidas,
    }
}
