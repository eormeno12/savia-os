//! EL BANCO DE LOS AGUJEROS QUE YA ESTUVIERON ABIERTOS.
//!
//! `tests/maquina.rs` afirma sobre el diseno; este archivo afirma sobre **defectos
//! concretos que el nucleo tuvo y que una revision adversarial encontro**. Cada prueba
//! reprodujo primero el defecto contra el codigo sin arreglar, asi que ninguna es una
//! afirmacion optimista: si alguien deshace el arreglo, aca se ve.
//!
//! Todas comparten una forma, y no por gusto: **el modo de falla de este canal es
//! silencioso y asimetrico**. Un alta perdida cuesta un barrido; una baja perdida deja un
//! documento indexado para siempre, buscable, alimentando skills, apuntando a un archivo
//! que ya no existe — y sin alerta, sin cola muerta y sin reintento. Por eso la mitad de
//! lo que sigue termina en `assert_eq!(bajas, 1)`.

use savia_folder_nucleo::almacen::Almacen;
use savia_folder_nucleo::ciclo;
use savia_folder_nucleo::colas::{
    Colas, Decision, Desenlace, Encolado, ParametrosDeCola, Permiso, PermisoId, Proximo,
    RangoDeTamano, Recibido, SweepId, Trabajo, Veredicto, aparicion,
};
use savia_folder_nucleo::dominio::{
    BarridoId, EstadoDelBarrido, HashVerificado, Mtime, Observacion, RaizId, RutaRelativa,
    SensibilidadAMayusculas,
};
use savia_folder_nucleo::inventario::{EstadoDeFila, EstadoDeHash, Inventario};
use savia_folder_nucleo::plataforma::{Falsa, RaizRegistrada};
use savia_folder_nucleo::protocolo::{BaseDeApi, Cliente, Credencial, Tiempos};
use savia_folder_nucleo::salvaguardas::{self, Politica};
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// El intervalo del BANCO, no del producto. `parametros::ASENTAMIENTO` sigue en `None`.
const ASENTAMIENTO_DEL_BANCO: Duration = Duration::from_secs(30);

fn raiz() -> RaizId {
    RaizId::nueva("root-1")
}

fn registrada() -> RaizRegistrada {
    RaizRegistrada {
        id: raiz(),
        huella: Falsa::huella_del_banco(),
        ruta_absoluta: std::path::PathBuf::from("/no/se/toca"),
        sensibilidad: SensibilidadAMayusculas::Distingue,
    }
}

fn politica() -> Politica {
    Politica::con_asentamiento(ASENTAMIENTO_DEL_BANCO).expect("el banco lo provee")
}

fn almacen() -> Almacen {
    let mut a = Almacen::nuevo(ParametrosDeCola {
        max_intentos: None,
        max_entradas_por_lote: None,
    });
    a.enrolar(registrada());
    a
}

fn r(s: &str) -> RutaRelativa {
    RutaRelativa::canonica(s).expect("ruta del banco")
}

/// Drena contra un servidor de mentira que contesta `known` a todo, para que las filas
/// queden con hash VERIFICADO — lo unico que despues puede viajar en una baja.
fn confirmar_todo(a: &mut Almacen) {
    loop {
        let Proximo::Trabajo(t) = a.siguiente(&raiz()) else {
            return;
        };
        let (id, recibido) = match *t {
            Trabajo::AbrirBarrido { id, .. } => (
                id,
                Recibido::Barrido {
                    sweep: SweepId("sweep-1".into()),
                    padron_requerido: false,
                },
            ),
            Trabajo::EnviarPadron { id, .. } => (id, Recibido::Nada),
            Trabajo::Observar { id, entradas, .. } => {
                let vs = entradas
                    .into_iter()
                    .map(|(ruta, afirmado)| Veredicto {
                        ruta,
                        afirmado,
                        decision: Decision::Known {
                            verificado: HashVerificado::rehidratar_del_inventario(
                                *afirmado.bytes(),
                            ),
                        },
                    })
                    .collect();
                (id, Recibido::Decisiones(vs))
            }
            Trabajo::Desvanecer { id, .. } => (id, Recibido::Nada),
            Trabajo::CerrarBarrido { id, .. } => (id, Recibido::Retirados(Vec::new())),
            Trabajo::Subir { id, .. } => (id, Recibido::Nada),
            Trabajo::ConfirmarSubida { id, .. } => (
                id,
                Recibido::Verificado(HashVerificado::rehidratar_del_inventario([9u8; 32])),
            ),
        };
        a.resolver(&raiz(), &id, Desenlace::Entregado(recibido));
    }
}

fn barrer_y_confirmar(p: &Falsa, a: &mut Almacen, n: u32) {
    ciclo::barrer(
        &raiz(),
        BarridoId::nuevo(format!("b{n}")),
        p,
        a,
        &politica(),
    );
    confirmar_todo(a);
}

fn estado_de_hash(a: &Almacen, ruta: &str) -> Option<EstadoDeHash> {
    a.inventario()
        .entradas(&raiz())
        .into_iter()
        .find(|e| e.ruta.como_str() == ruta)
        .and_then(|e| match e.estado {
            EstadoDeFila::Presente { hash, .. } => Some(hash),
            EstadoDeFila::Ausente { .. } => None,
        })
}

// ══════════════════════════════════════════════════════════════════════════════
// 1 · REAFIRMAR LOS MISMOS BYTES NO DEGRADA LA CONFIRMACION
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn una_reescritura_sin_cambio_de_bytes_conserva_la_confirmacion() {
    // IMPORTA PORQUE: es el modo de falla que el borrador nombra como el peor y el mas
    // caro — «una baja perdida deja un documento indexado para siempre»— y el disparador
    // es cotidiano: `touch`, `cp -p`, `rsync -t`, un restore, un `git checkout`, guardar
    // un documento sin editarlo, o un sincronizador de nube rehidratando un archivo que
    // habia pasado a «solo en linea». Todos mueven el `mtime` sin mover un byte.
    //
    // Si esa vuelta pisa el `Confirmado` con un `Afirmado`, la ruta pierde en SILENCIO su
    // capacidad de producir una baja: `puerta_de_baja` exige el confirmado, contesta
    // `SinHashConfirmado`, y el paso ejecuta `OlvidarRuta`. La baja no sale y la fila se
    // destruye, asi que ningun barrido futuro la puede volver a notar.
    let p = Falsa::como_macos();
    p.poner("contrato.docx", b"el contrato", 100, Some(1));
    let mut a = almacen();
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 1);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 2);
    assert!(
        matches!(
            estado_de_hash(&a, "contrato.docx"),
            Some(EstadoDeHash::Confirmado(_))
        ),
        "Savia contesto `known`: la fila arranca confirmada"
    );

    // `touch`: mismo contenido, `mtime` nuevo. Dos barridos, porque el asentamiento exige
    // dos miradas con la misma tripleta separadas por el intervalo.
    p.poner("contrato.docx", b"el contrato", 200, Some(1));
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 3);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 4);
    assert!(
        matches!(
            estado_de_hash(&a, "contrato.docx"),
            Some(EstadoDeHash::Confirmado(_))
        ),
        "los MISMOS 32 bytes: lo que Savia sabe no cambio porque el `mtime` si"
    );

    // Y ahora el borrado, con la raiz viva y el recorrido completo.
    p.sacar("contrato.docx");
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    let resumen = ciclo::barrer(&raiz(), BarridoId::nuevo("b5"), &p, &mut a, &politica());
    assert_eq!(
        resumen.bajas, 1,
        "la baja sale igual: un `touch` no puede desarmar la capacidad de reportarla"
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// 2 · UNA EDICION EN EL LUGAR NO ES EL DESTINO DE UN MOVIMIENTO
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn una_edicion_en_el_lugar_no_anula_la_baja_de_otro_archivo() {
    // IMPORTA PORQUE: el `IndiceDeContenido` se aparta de la letra del borrador —«un hash
    // que reaparece en CUALQUIER punto del arbol»— con un solo refinamiento: *reaparecer*
    // es aparecer DONDE ANTES NO ESTABA. Si el llamador alimenta el indice con toda
    // `Aparecio`, ese refinamiento se vacia: una edicion en el lugar entra como si fuera
    // el destino de una mudanza, el cierre lee la baja de otro archivo como movimiento, y
    // en vez de emitirla ejecuta `OlvidarRuta`. La baja no se retiene: se destruye junto
    // con la fila.
    //
    // Y lo dispara una operacion normal: consolidar dos notas en una.
    let p = Falsa::como_macos();
    p.poner("plantilla.md", b"contenido A", 100, Some(1));
    p.poner("viejo.md", b"contenido B", 100, Some(2));
    let mut a = almacen();
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 1);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 2);

    // El usuario pega el contenido de `viejo.md` dentro de `plantilla.md`.
    p.poner("plantilla.md", b"contenido B", 300, Some(1));
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 3);

    // Y recien despues borra `viejo.md`.
    p.sacar("viejo.md");
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    let resumen = ciclo::barrer(&raiz(), BarridoId::nuevo("b4"), &p, &mut a, &politica());
    assert_eq!(
        resumen.bajas, 1,
        "`viejo.md` se borro de verdad: `plantilla.md` no estreno ninguna ruta"
    );
    let rutas: Vec<String> = a
        .inventario()
        .entradas(&raiz())
        .iter()
        .map(|e| e.ruta.como_str().to_string())
        .collect();
    assert!(
        rutas.iter().any(|x| x == "viejo.md"),
        "y su fila sobrevive como lapida en vez de destruirse: {rutas:?}"
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// 3 · UN RENOMBRE PURO MUERE EN EL AGENTE, HAYA O NO LAPIDA EN EL DESTINO
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn un_renombre_hacia_una_ruta_con_lapida_sigue_siendo_un_movimiento() {
    // IMPORTA PORQUE: el nodo «MOVE visto desde el destino» va ANTES que SETTLE
    // exactamente para que un movimiento no quede sin registrar durante una vuelta
    // entera, «que es justo cuando su origen se va a ver faltar». Guardarlo con «no hay
    // fila» reintroduce lo que el nodo existe para evitar: una LAPIDA en la ruta destino
    // lo desactiva, el destino cae a SETTLE, no se hashea ese barrido, el indice queda
    // vacio para ese contenido, y el origen sale como `presence.vanished`.
    //
    // Del otro lado esa baja inventada alimenta la cuarentena y el numerador del corte
    // por volumen, y como la identidad es el contenido, el `vanished(H)` viaja ANTES que
    // el `observed(H)` de la ruta nueva: el orden que la cola describe como «el borrado
    // de la version nueva».
    let p = Falsa::como_macos();
    p.poner("informes/2024.pdf", b"el informe viejo", 100, Some(1));
    p.poner("descargas/2024.pdf", b"el informe nuevo", 100, Some(2));
    let mut a = almacen();
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 1);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 2);

    // 1) Se borra el de `informes/`. Baja legitima, y queda la lapida en esa ruta.
    p.sacar("informes/2024.pdf");
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    assert_eq!(
        ciclo::barrer(&raiz(), BarridoId::nuevo("b3"), &p, &mut a, &politica()).bajas,
        1,
        "esta si es una baja"
    );
    confirmar_todo(&mut a);

    // 2) Y despues se mueve el de `descargas/` ahi: MISMO inodo, mismo tamano, mismo
    //    `mtime`. Es un renombre puro y se reconoce sin leer un byte.
    p.sacar("descargas/2024.pdf");
    p.poner("informes/2024.pdf", b"el informe nuevo", 100, Some(2));
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    p.reiniciar_contadores();
    let resumen = ciclo::barrer(&raiz(), BarridoId::nuevo("b4"), &p, &mut a, &politica());
    assert_eq!(
        resumen.movimientos, 1,
        "mover y renombrar mueren aca y no llegan nunca al servidor"
    );
    assert_eq!(resumen.bajas, 0, "y NINGUNA baja sale de un renombre");
    assert_eq!(
        p.lecturas(),
        0,
        "«renombrar y mover cuestan CERO I/O», tambien sobre una ruta con lapida"
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// 4 · EL VENENO DE LA COLA MUERTA NO PUEDE DEJAR LA RAIZ MUDA
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn lo_que_el_veneno_retiene_queda_contado_y_nombrado() {
    // IMPORTA PORQUE: la cola declara dos cosas —«el hecho es diminuto y siempre tiene
    // que llegar» y «un 400 va a una cola muerta con alerta y nunca se descarta en
    // silencio»— y la segunda solo se cumplia para el hecho rechazado. Todo lo que esa
    // ruta produce DESPUES —ediciones, bajas— lo tiraba `encolar` sin dejar rastro:
    // `hechos_pendientes` daba cero, `degradada` daba `false` con el tope en `None`, y el
    // panel mostraba la raiz sincronizada mientras esas rutas ya no existian para Savia.
    //
    // El veneno se queda (entregar el hecho siguiente de una ruta cuyo anterior fue
    // rechazado es entregar fuera de orden), pero deja de ser mudo.
    let mut c = Colas::nuevas(ParametrosDeCola {
        max_intentos: None,
        max_entradas_por_lote: None,
    });
    let raiz = raiz();
    let s = c.abrir_barrido(&raiz, BarridoId::nuevo("b1"), 2);
    c.encolar(
        &raiz,
        aparicion(r("a.docx"), savia_folder_nucleo::hash::sha256(b"a")),
    );
    c.encolar(
        &raiz,
        aparicion(r("b.docx"), savia_folder_nucleo::hash::sha256(b"b")),
    );
    c.cerrar_barrido(s, EstadoDelBarrido::Completo);

    let Proximo::Trabajo(t) = c.siguiente(&raiz) else {
        panic!("falta la apertura")
    };
    let Trabajo::AbrirBarrido { id, .. } = *t else {
        panic!("el primero es sweep.open")
    };
    c.resolver(
        &id,
        Desenlace::Entregado(Recibido::Barrido {
            sweep: SweepId("s".into()),
            padron_requerido: false,
        }),
    );
    let Proximo::Trabajo(t) = c.siguiente(&raiz) else {
        panic!("falta el observado")
    };
    let Trabajo::Observar { id, .. } = *t else {
        panic!("el segundo es presence.observed")
    };
    c.resolver(
        &id,
        Desenlace::Rechazado {
            status: 400,
            cuerpo: "entrada invalida".into(),
            culpables: Vec::new(),
        },
    );

    // El usuario sigue trabajando: `b.docx` cambia otra vez.
    let s2 = c.abrir_barrido(&raiz, BarridoId::nuevo("b2"), 2);
    let e = c.encolar(
        &raiz,
        aparicion(r("b.docx"), savia_folder_nucleo::hash::sha256(b"b2")),
    );
    c.cerrar_barrido(s2, EstadoDelBarrido::Completo);

    assert_eq!(
        e,
        Encolado::Envenenado,
        "no entra: entregarlo seria entregar fuera de orden"
    );
    assert_eq!(
        c.hechos_retenidos(&raiz),
        1,
        "pero queda CONTADO contra la entrada muerta que lo retiene"
    );
    let envenenadas: Vec<String> = c
        .rutas_envenenadas(&raiz)
        .iter()
        .map(|x| x.como_str().to_string())
        .collect();
    assert!(
        envenenadas.iter().any(|x| x == "b.docx"),
        "y la alerta nombra la ruta: {envenenadas:?}"
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// 5 · SIN `idDeArchivoDelSO`, EL ASENTAMIENTO IGUAL VENCE
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn sin_id_de_archivo_el_asentamiento_igual_vence() {
    // IMPORTA PORQUE: `Observacion.id_de_archivo` dice «`None` cuando el volumen no
    // publica ninguno (unidades de red). El ciclo cae al hash y paga la E/S», y
    // `raiz_viva` dice que sobre SMB o NFS «el canal queda de solo-altas». Con la
    // comparacion de IDENTIDAD usada tambien para asentar, ninguna de las dos frases era
    // cierta: dos `None` nunca coinciden, el candidato se acuna de nuevo en cada mirada,
    // el archivo no asienta JAMAS —no se hashea, no entra al inventario, no produce un
    // hecho— y el canal no queda de solo-altas: queda de nada, en silencio.
    //
    // Hoy `Macos::observar` siempre devuelve un id, asi que esto no es alcanzable en la
    // plataforma real; es el estado GARANTIZADO en cuanto haya una raiz sobre un volumen
    // que no los publica, o en cuanto `windows.rs` deje de ser un esqueleto.
    let p = Falsa::como_macos();
    p.poner("informe.xlsx", b"el informe", 100, None);
    let mut a = almacen();
    for n in 1..=3 {
        p.avanzar(ASENTAMIENTO_DEL_BANCO);
        barrer_y_confirmar(&p, &mut a, n);
    }
    assert_eq!(
        a.inventario().vivos(&raiz()),
        1,
        "dos miradas con la misma tripleta separadas por el intervalo asientan igual"
    );
}

#[test]
fn la_mirada_y_la_identidad_son_dos_preguntas_distintas() {
    // IMPORTA PORQUE: son la MISMA tripleta contestando cosas distintas. «¿Es el mismo
    // archivo?» falla cerrado sin id —el costo de empatar dos archivos distintos es una
    // edicion perdida—; «¿estos bytes dejaron de cambiar?» se pregunta sobre UNA ruta
    // mirada dos veces, y ahi fallar cerrado no cuesta un hash: cuesta el archivo entero.
    let sin_id = Observacion {
        tamano: 10,
        mtime: Mtime {
            segundos: 100,
            nanos: 0,
        },
        id_de_archivo: None,
    };
    assert!(
        !salvaguardas::misma_observacion(&sin_id, &sin_id, Duration::ZERO),
        "identidad: sin id no se puede AFIRMAR que sean el mismo archivo"
    );
    assert!(
        salvaguardas::la_misma_mirada(&sin_id, &sin_id, Duration::ZERO),
        "asentamiento: sin id, tamano y mtime son toda la evidencia que ese volumen da"
    );
    let otro_tamano = Observacion {
        tamano: 11,
        ..sin_id
    };
    assert!(
        !salvaguardas::la_misma_mirada(&sin_id, &otro_tamano, Duration::ZERO),
        "y sigue detectando el cambio: no es «siempre si»"
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// 6 · NINGUN DESENLACE PUEDE DEJAR LA COLA QUIETA
// ══════════════════════════════════════════════════════════════════════════════

/// Arma un segmento de barrido ya cerrado con un alta, y entrega apertura y observado.
/// Deja el `sweep.close` como proximo trabajo.
fn cola_hasta_el_cierre(raiz: &RaizId) -> Colas {
    let mut c = Colas::nuevas(ParametrosDeCola {
        max_intentos: None,
        max_entradas_por_lote: None,
    });
    let s = c.abrir_barrido(raiz, BarridoId::nuevo("b1"), 1);
    c.encolar(
        raiz,
        aparicion(r("a.txt"), savia_folder_nucleo::hash::sha256(b"a")),
    );
    c.cerrar_barrido(s, EstadoDelBarrido::Completo);
    let Proximo::Trabajo(t) = c.siguiente(raiz) else {
        panic!("falta la apertura")
    };
    let Trabajo::AbrirBarrido { id, .. } = *t else {
        panic!("el primero es sweep.open")
    };
    c.resolver(
        &id,
        Desenlace::Entregado(Recibido::Barrido {
            sweep: SweepId("s".into()),
            padron_requerido: false,
        }),
    );
    let Proximo::Trabajo(t) = c.siguiente(raiz) else {
        panic!("falta el observado")
    };
    let Trabajo::Observar { id, entradas, .. } = *t else {
        panic!("el segundo es presence.observed")
    };
    let (ruta, afirmado) = entradas[0].clone();
    c.resolver(
        &id,
        Desenlace::Entregado(Recibido::Decisiones(vec![Veredicto {
            ruta,
            afirmado,
            decision: Decision::Known {
                verificado: HashVerificado::rehidratar_del_inventario(*afirmado.bytes()),
            },
        }])),
    );
    c
}

#[test]
fn un_ambiguo_sobre_un_marcador_mueve_la_cola() {
    // IMPORTA PORQUE: `drenar` cuenta `Ambiguo` como progreso, y el brazo `Ambiguo` de
    // `resolver` solo atendia `TrabajoId::Byte`. Sobre un marcador de segmento no movia
    // nada, `siguiente` devolvia el MISMO trabajo, y el `loop` no terminaba nunca: el
    // agente no vuelve de `drenar`, deja de barrer, deja de reportar bajas —con el panel
    // diciendo «sincronizando»— y martilla al servidor a miles de peticiones por segundo.
    //
    // El disparador lo produce el propio `sim/server.ts`: contesta
    // `200 {error:"barrido desconocido"}` cuando el `sweepId` ya no esta, que es lo que
    // devuelve un servidor reiniciado con un barrido abierto — el caso para el que el
    // diseno persiste el `sweepId`.
    let raiz = raiz();
    let mut c = cola_hasta_el_cierre(&raiz);
    let Proximo::Trabajo(t) = c.siguiente(&raiz) else {
        panic!("falta el cierre")
    };
    let Trabajo::CerrarBarrido { id, .. } = *t else {
        panic!("el tercero es sweep.close")
    };
    c.resolver(&id, Desenlace::Ambiguo);
    assert!(
        matches!(c.siguiente(&raiz), Proximo::Nada),
        "el barrido ya no existe del otro lado: reintentarlo da lo mismo para siempre"
    );
}

#[test]
fn un_rechazo_no_reintentable_saca_el_trabajo_de_la_cola() {
    // IMPORTA PORQUE: `Clase::ColaMuerta` significa «es inaceptable y va a seguir
    // siendolo». Dejar el trabajo adentro lo reintenta en cada barrido para siempre, y
    // sobre un marcador de segmento es peor que lento: `rutas_de` no devuelve rutas para
    // esos ids, asi que no se envenenaba nada, no se marcaba nada entregado, y la raiz
    // ENTERA dejaba de drenar mientras la cola muerta acumulaba una entrada identica por
    // vuelta.
    let raiz = raiz();
    let mut c = Colas::nuevas(ParametrosDeCola {
        max_intentos: None,
        max_entradas_por_lote: None,
    });
    let s = c.abrir_barrido(&raiz, BarridoId::nuevo("b1"), 1);
    c.encolar(
        &raiz,
        aparicion(r("a.txt"), savia_folder_nucleo::hash::sha256(b"a")),
    );
    c.cerrar_barrido(s, EstadoDelBarrido::Completo);
    let Proximo::Trabajo(t) = c.siguiente(&raiz) else {
        panic!("falta la apertura")
    };
    let Trabajo::AbrirBarrido { id, .. } = *t else {
        panic!()
    };
    c.resolver(
        &id,
        Desenlace::Rechazado {
            status: 404,
            cuerpo: "sin ruta".into(),
            culpables: Vec::new(),
        },
    );
    let siguiente = c.siguiente(&raiz);
    assert!(
        !matches!(&siguiente, Proximo::Trabajo(t) if matches!(**t, Trabajo::AbrirBarrido { .. })),
        "el mismo trabajo no puede volver: salio {siguiente:?}"
    );
    assert_eq!(c.cola_muerta().len(), 1, "y la alerta queda, una sola vez");
}

#[test]
fn un_rechazo_sobre_los_bytes_no_re_sube_el_archivo_en_cada_vuelta() {
    // IMPORTA PORQUE: hay UN solo trabajo de bytes en vuelo por raiz. Un `Subir` muerto
    // que no sale de la cola se re-sube ENTERO en cada barrido —para un `.pptx` de 200 MB
    // por un enlace medido, eso es plata del usuario— y ademas tapa la cabeza de la cola,
    // asi que ningun otro archivo de esa raiz se sube nunca.
    let raiz = raiz();
    let mut c = Colas::nuevas(ParametrosDeCola {
        max_intentos: None,
        max_entradas_por_lote: None,
    });
    let s = c.abrir_barrido(&raiz, BarridoId::nuevo("b1"), 1);
    c.encolar(
        &raiz,
        aparicion(r("a.txt"), savia_folder_nucleo::hash::sha256(b"a")),
    );
    c.cerrar_barrido(s, EstadoDelBarrido::Completo);
    let Proximo::Trabajo(t) = c.siguiente(&raiz) else {
        panic!()
    };
    let Trabajo::AbrirBarrido { id, .. } = *t else {
        panic!()
    };
    c.resolver(
        &id,
        Desenlace::Entregado(Recibido::Barrido {
            sweep: SweepId("s".into()),
            padron_requerido: false,
        }),
    );
    let Proximo::Trabajo(t) = c.siguiente(&raiz) else {
        panic!()
    };
    let Trabajo::Observar { id, entradas, .. } = *t else {
        panic!()
    };
    let (ruta, afirmado) = entradas[0].clone();
    c.resolver(
        &id,
        Desenlace::Entregado(Recibido::Decisiones(vec![Veredicto {
            ruta,
            afirmado,
            decision: Decision::Upload {
                permiso: Permiso {
                    id: PermisoId("permit-1".into()),
                    destino: "/upload/permit-1".into(),
                    rango: RangoDeTamano {
                        minimo: 0,
                        maximo: 1024,
                    },
                },
            },
        }])),
    );
    let Proximo::Trabajo(t) = c.siguiente(&raiz) else {
        panic!()
    };
    let Trabajo::CerrarBarrido { id, .. } = *t else {
        panic!()
    };
    c.resolver(&id, Desenlace::Entregado(Recibido::Retirados(Vec::new())));
    let Proximo::Trabajo(t) = c.siguiente(&raiz) else {
        panic!("falta la subida")
    };
    let Trabajo::Subir { id, .. } = *t else {
        panic!("recien ahora, los bytes")
    };
    c.resolver(
        &id,
        Desenlace::Rechazado {
            status: 404,
            cuerpo: "el objeto no existe".into(),
            culpables: Vec::new(),
        },
    );
    assert!(
        matches!(c.siguiente(&raiz), Proximo::Nada),
        "el byte rechazado sale de la cola en vez de bloquear la cabeza"
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// 7 · UN ACK PERDIDO SE CURA POR EL CAMINO NORMAL
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn un_ack_perdido_se_re_observa_en_el_proximo_barrido() {
    // IMPORTA PORQUE: `Confirmacion::HashEnDuda` promete que «se re-observa en el proximo
    // barrido y el `known` la re-confirma: el sistema se cura por el camino normal», y no
    // habia nada que lo hiciera. Como la tripleta del archivo no cambio, el barrido
    // siguiente tomaba la rama NOOP: la fila quedaba `Afirmado` para siempre y su baja no
    // salia nunca.
    //
    // El disparador es un `upload.completed` cuya respuesta se pierde — el objeto SI
    // llego y el documento SI existe del otro lado, pero el agente pierde para siempre la
    // capacidad de reportar su baja.
    let p = Falsa::como_macos();
    p.poner("uno.txt", b"unos bytes", 100, Some(1));
    let mut a = almacen();
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b1"), &p, &mut a, &politica());
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b2"), &p, &mut a, &politica());

    // Se drena a mano hasta el ACK, y el ACK se pierde.
    while let Proximo::Trabajo(t) = a.siguiente(&raiz()) {
        let (id, desenlace) = match *t {
            Trabajo::AbrirBarrido { id, .. } => (
                id,
                Desenlace::Entregado(Recibido::Barrido {
                    sweep: SweepId("s".into()),
                    padron_requerido: false,
                }),
            ),
            Trabajo::EnviarPadron { id, .. } => (id, Desenlace::Entregado(Recibido::Nada)),
            Trabajo::Observar { id, entradas, .. } => {
                let vs = entradas
                    .into_iter()
                    .map(|(ruta, afirmado)| Veredicto {
                        ruta,
                        afirmado,
                        decision: Decision::Upload {
                            permiso: Permiso {
                                id: PermisoId("permit-1".into()),
                                destino: "/upload/permit-1".into(),
                                rango: RangoDeTamano {
                                    minimo: 0,
                                    maximo: 4096,
                                },
                            },
                        },
                    })
                    .collect();
                (id, Desenlace::Entregado(Recibido::Decisiones(vs)))
            }
            Trabajo::CerrarBarrido { id, .. } => {
                (id, Desenlace::Entregado(Recibido::Retirados(Vec::new())))
            }
            Trabajo::Subir { id, .. } => (id, Desenlace::Entregado(Recibido::Nada)),
            // EL ACK SE PIERDE: `upload.completed` no es idempotente, asi que el reintento
            // recibe «permiso desconocido», que es indistinguible de «nunca llego».
            Trabajo::ConfirmarSubida { id, .. } => (id, Desenlace::Ambiguo),
            Trabajo::Desvanecer { id, .. } => (id, Desenlace::Entregado(Recibido::Nada)),
        };
        a.resolver(&raiz(), &id, desenlace);
    }

    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    p.reiniciar_contadores();
    let resumen = ciclo::barrer(&raiz(), BarridoId::nuevo("b3"), &p, &mut a, &politica());
    assert_eq!(
        resumen.apariciones, 1,
        "la ruta en duda se re-observa: es el unico camino de cura que el protocolo tiene"
    );
    assert_eq!(
        p.lecturas(),
        0,
        "y no cuesta releer el archivo: se re-afirma el hash que ya se tiene"
    );

    // Esta vez Savia contesta `known`, y con eso la fila vuelve a poder producir una baja.
    confirmar_todo(&mut a);
    assert!(
        matches!(
            estado_de_hash(&a, "uno.txt"),
            Some(EstadoDeHash::Confirmado(_))
        ),
        "el `known` re-confirma, que es exactamente lo que la cola prometia"
    );
    p.sacar("uno.txt");
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    assert_eq!(
        ciclo::barrer(&raiz(), BarridoId::nuevo("b4"), &p, &mut a, &politica()).bajas,
        1,
        "y la baja sale"
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// 8 · LA API NUNCA TOCA BYTES
// ══════════════════════════════════════════════════════════════════════════════

/// Un servidor de una linea: acepta conexiones hasta que lo paran, anota
/// `METODO ruta` de cada pedido y contesta lo que diga `responder`.
struct Mini {
    puerto: u16,
    vistos: Arc<Mutex<Vec<String>>>,
    parar: Arc<AtomicBool>,
    hilo: Option<std::thread::JoinHandle<()>>,
}

impl Mini {
    fn nuevo(responder: impl Fn(&str) -> (u16, String) + Send + 'static) -> Self {
        let l = TcpListener::bind("127.0.0.1:0").expect("puerto efimero");
        let puerto = l.local_addr().unwrap().port();
        l.set_nonblocking(true).unwrap();
        let vistos = Arc::new(Mutex::new(Vec::new()));
        let parar = Arc::new(AtomicBool::new(false));
        let (v, s) = (vistos.clone(), parar.clone());
        let hilo = std::thread::spawn(move || {
            while !s.load(Ordering::Relaxed) {
                match l.accept() {
                    Ok((mut c, _)) => {
                        // EL ACEPTADO HEREDA `O_NONBLOCK` DEL LISTENER en macOS, y sin
                        // sacarselo el primer `read` devuelve `WouldBlock`, el lazo de
                        // abajo termina con el pedido vacio, y el servidor cierra mientras
                        // el cliente todavia escribe el cuerpo: `Broken pipe` intermitente
                        // que no tiene nada que ver con lo que la prueba afirma.
                        c.set_nonblocking(false).ok();
                        c.set_read_timeout(Some(Duration::from_secs(2))).ok();
                        let mut crudo = Vec::new();
                        let mut buf = [0u8; 4096];
                        while let Ok(n) = c.read(&mut buf) {
                            if n == 0 {
                                break;
                            }
                            crudo.extend_from_slice(&buf[..n]);
                            let texto = String::from_utf8_lossy(&crudo).to_string();
                            let Some((cab, cuerpo)) = texto.split_once("\r\n\r\n") else {
                                continue;
                            };
                            let largo = cab
                                .lines()
                                .find(|l| l.to_ascii_lowercase().starts_with("content-length:"))
                                .and_then(|l| l.split(':').nth(1))
                                .and_then(|l| l.trim().parse::<usize>().ok())
                                .unwrap_or(0);
                            if cuerpo.len() >= largo {
                                break;
                            }
                        }
                        let texto = String::from_utf8_lossy(&crudo).to_string();
                        let linea = texto.lines().next().unwrap_or("").to_string();
                        let mut partes = linea.split_whitespace();
                        let clave = format!(
                            "{} {}",
                            partes.next().unwrap_or(""),
                            partes.next().unwrap_or("")
                        );
                        v.lock().unwrap().push(clave.clone());
                        let (codigo, cuerpo) = responder(&clave);
                        let _ = c.write_all(
                            format!(
                                "HTTP/1.1 {codigo} X\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{cuerpo}",
                                cuerpo.len()
                            )
                            .as_bytes(),
                        );
                    }
                    Err(_) => std::thread::sleep(Duration::from_millis(5)),
                }
            }
        });
        Self {
            puerto,
            vistos,
            parar,
            hilo: Some(hilo),
        }
    }
    fn vistos(&self) -> Vec<String> {
        self.vistos.lock().unwrap().clone()
    }
}

impl Drop for Mini {
    fn drop(&mut self) {
        self.parar.store(true, Ordering::Relaxed);
        if let Some(h) = self.hilo.take() {
            let _ = h.join();
        }
    }
}

fn tiempos_del_banco() -> Tiempos {
    Tiempos {
        conexion: Duration::from_secs(2),
        por_llamada: Duration::from_secs(2),
        envio_de_cuerpo: None,
    }
}

#[test]
fn el_put_abre_el_socket_del_permiso_y_no_el_de_la_api() {
    // IMPORTA PORQUE: un permiso prefirmado REAL es siempre una URL absoluta a otro host.
    // Pasando siempre la autoridad de la API y el destino solo como request-target, el
    // dia que el simulador se reemplace por Savia los bytes de TODOS los archivos del
    // usuario llegan a la API en vez de al almacen — lo contrario exacto de «la API nunca
    // toca bytes», que es la razon entera por la que existe la subida directa. El sintoma
    // en produccion es un 404 por archivo, o peor: una API que acepta el cuerpo.
    let api = Mini::nuevo(|_| (404, "{\"error\":\"la API no toca bytes\"}".into()));
    let store = Mini::nuevo(|_| (200, String::new()));
    let cliente = Cliente::nuevo(
        BaseDeApi::nueva(&format!("http://127.0.0.1:{}", api.puerto)).unwrap(),
        Credencial::SinAutenticar,
        tiempos_del_banco(),
    );
    let permiso = Permiso {
        id: PermisoId("objeto-1".into()),
        destino: format!("http://127.0.0.1:{}/objeto/1", store.puerto),
        rango: RangoDeTamano {
            minimo: 0,
            maximo: 1024,
        },
    };
    // El testigo `Subido` se descarta a proposito: lo que esta prueba mide es a QUE socket
    // salieron los bytes, no la segunda fase.
    let _ = cliente
        .subir(&permiso, b"los bytes del usuario")
        .expect("el PUT tiene que salir bien contra el almacen");
    assert_eq!(
        store.vistos(),
        vec!["PUT /objeto/1".to_string()],
        "el almacen recibe el PUT, con el request-target relativo a SU host"
    );
    assert!(
        api.vistos().is_empty(),
        "y la API no ve un solo byte: {:?}",
        api.vistos()
    );
}

#[test]
fn un_permiso_relativo_sigue_cayendo_a_la_base() {
    // IMPORTA PORQUE: el simulador manda `/upload/<permiso>`, y esa forma tiene que seguir
    // funcionando sin una rama de configuracion. Arreglar el absoluto no puede romper el
    // relativo.
    let api = Mini::nuevo(|_| (200, String::new()));
    let cliente = Cliente::nuevo(
        BaseDeApi::nueva(&format!("http://127.0.0.1:{}", api.puerto)).unwrap(),
        Credencial::SinAutenticar,
        tiempos_del_banco(),
    );
    let permiso = Permiso {
        id: PermisoId("permit-1".into()),
        destino: "/upload/permit-1".into(),
        rango: RangoDeTamano {
            minimo: 0,
            maximo: 1024,
        },
    };
    let _ = cliente.subir(&permiso, b"bytes").expect("el PUT sale");
    assert_eq!(api.vistos(), vec!["PUT /upload/permit-1".to_string()]);
}

// ══════════════════════════════════════════════════════════════════════════════
// 9 · EL DRENAJE TERMINA, CONTESTE LO QUE CONTESTE EL SERVIDOR
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn el_drenaje_termina_contra_un_servidor_que_contesta_siempre_lo_mismo() {
    // IMPORTA PORQUE: es el hallazgo entero, medido de punta a punta. Un servidor que
    // contesta `200 {error:...}` a todo hacia que `drenar` no volviera nunca: en la
    // medicion del revisor fueron 96.592 peticiones en 10 s desde UN escritorio, con el
    // agente sin barrer, sin observar y sin reportar bajas mientras el panel decia
    // «sincronizando».
    //
    // La garantia que lo cierra es estructural —si el trabajo que vuelve es identico al
    // que se acaba de ejecutar, la cola no se movio— asi que ninguna variante futura de
    // `Desenlace` puede reintroducirlo.
    let servidor = Mini::nuevo(|_| (200, "{\"error\":\"barrido desconocido\"}".into()));
    let p = Falsa::como_macos();
    p.poner("x.txt", b"algo", 100, Some(1));
    let mut a = almacen();
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b1"), &p, &mut a, &politica());
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b2"), &p, &mut a, &politica());

    let cliente = Cliente::nuevo(
        BaseDeApi::nueva(&format!("http://127.0.0.1:{}", servidor.puerto)).unwrap(),
        Credencial::SinAutenticar,
        tiempos_del_banco(),
    );
    let mut traza = Vec::new();
    // Si el lazo girara, esto no volveria. Que la prueba TERMINE es la afirmacion.
    ciclo::drenar(&raiz(), &p, &mut a, &cliente, &mut traza);
    assert!(
        servidor.vistos().len() < 20,
        "el drenaje corta en vez de martillar: {} peticiones, traza {traza:?}",
        servidor.vistos().len()
    );
}

#[test]
fn un_archivo_que_no_entra_en_el_permiso_no_envenena_su_ruta() {
    // IMPORTA PORQUE: `NoCabeEnElPermiso` es una comprobacion LOCAL, previa al PUT, que
    // dice que los bytes en disco ya no son los que se decidieron subir. Clasificarla como
    // cola muerta envenenaba la ruta para siempre —y con un disparador cotidiano, un
    // archivo mas grande que el `content-length-range` del permiso—, dejandola invisible
    // aunque el usuario despues la achique o la borre.
    let servidor = Mini::nuevo(|clave| {
        match clave {
        "POST /sweep/open" => (200, "{\"sweepId\":\"s-1\",\"padronRequerido\":false}".into()),
        "POST /presence/observed" => (
            200,
            // Un permiso que NO admite ni un byte: el archivo del banco no entra.
            "{\"decisions\":[{\"path\":\"x.txt\",\"decision\":\"upload\",\"permit\":{\"url\":\"/upload/p-1\",\"contentLengthRange\":[0,0]}}]}"
                .into(),
        ),
        "POST /sweep/close" => (200, "{\"retired\":[]}".into()),
        _ => (200, "{}".into()),
    }
    });
    let p = Falsa::como_macos();
    p.poner("x.txt", b"mas grande que el permiso", 100, Some(1));
    let mut a = almacen();
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b1"), &p, &mut a, &politica());
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b2"), &p, &mut a, &politica());

    let cliente = Cliente::nuevo(
        BaseDeApi::nueva(&format!("http://127.0.0.1:{}", servidor.puerto)).unwrap(),
        Credencial::SinAutenticar,
        tiempos_del_banco(),
    );
    let mut traza = Vec::new();
    ciclo::drenar(&raiz(), &p, &mut a, &cliente, &mut traza);
    assert!(
        a.colas().cola_muerta().is_empty(),
        "no es una alerta para una persona: {:?}",
        a.colas().cola_muerta()
    );
    assert!(
        a.colas().rutas_envenenadas(&raiz()).is_empty(),
        "y la ruta sigue pudiendo reportar lo que le pase despues"
    );
}
