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

use savia_folder_aplicacion::ciclo;
use savia_folder_aplicacion::panel::{self, EstadoDeCarpeta};
use savia_folder_contrato::colas::{
    Decision, Permiso, PermisoId, RangoDeTamano, SweepId, Veredicto,
};
use savia_folder_contrato::dominio::{
    BarridoId, EstadoDelBarrido, HashVerificado, Mtime, Observacion, RaizId,
    SensibilidadAMayusculas,
};
use savia_folder_contrato::inventario::{EstadoDeFila, EstadoDeHash, Inventario};
use savia_folder_contrato::plataforma::RaizRegistrada;
use savia_folder_contrato::protocolo::Credencial;
use savia_folder_contrato::salvaguardas::misma_observacion;
use savia_folder_estado::almacen::Almacen;
use savia_folder_estado::colas::{
    Colas, Desenlace, Encolado, ParametrosDeCola, Proximo, Recibido, Trabajo, aparicion,
};
use savia_folder_plataforma_falsa::falsa::Falsa;
use savia_folder_politica::salvaguardas;
use savia_folder_protocolo::{BaseDeApi, Cliente};
use std::time::Duration;

/// El tope del BANCO, no del producto. `parametros::MAX_FILAS_DEL_PANEL` sigue en `None`.
const TOPE_DEL_PANEL: usize = 50;

mod comun;
use comun::{
    ASENTAMIENTO_DEL_BANCO, Mini, almacen, barrer_y_confirmar, confirmar_todo, politica, r, raiz,
    registrada, tiempos_del_banco,
};

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
        aparicion(r("a.docx"), savia_folder_contrato::hash::sha256(b"a")),
    );
    c.encolar(
        &raiz,
        aparicion(r("b.docx"), savia_folder_contrato::hash::sha256(b"b")),
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
        aparicion(r("b.docx"), savia_folder_contrato::hash::sha256(b"b2")),
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
        !misma_observacion(&sin_id, &sin_id, Duration::ZERO),
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
        aparicion(r("a.txt"), savia_folder_contrato::hash::sha256(b"a")),
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
        aparicion(r("a.txt"), savia_folder_contrato::hash::sha256(b"a")),
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
        aparicion(r("a.txt"), savia_folder_contrato::hash::sha256(b"a")),
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
    c.resolver(
        &id,
        Desenlace::Entregado(Recibido::Retirados {
            rutas: Vec::new(),
            congelada: false,
        }),
    );
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
            Trabajo::CerrarBarrido { id, .. } => (
                id,
                Desenlace::Entregado(Recibido::Retirados {
                    rutas: Vec::new(),
                    congelada: false,
                }),
            ),
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
        "POST /sweep/close" => (200, "{\"retired\":[],\"frozen\":false}".into()),
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

// ═══════════════════ DEJAR DE MIRAR UNA CARPETA ═════════════════════════════
//
// Las tres garantias de `Almacen::desenrolar`, y cada una es una forma distinta de que
// «quitar» mienta.

#[test]
fn quitar_una_carpeta_no_borra_lo_que_ya_subio() {
    // IMPORTA PORQUE: se le prometio a la persona que sacar una carpeta y volver a
    // agregarla NO resube nada. Eso no es una promesa de producto: se apoya en que las
    // filas del inventario —incluidas las lapidas— sobrevivan al desenrolamiento. Si
    // `desenrolar` las borrara, «la saque un rato» se convertiria en «resubi todo», y el
    // sintoma llegaria semanas despues como una factura de transferencia.
    let p = Falsa::como_macos();
    p.poner("x.txt", b"contenido", 100, Some(1));
    let mut a = almacen();
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b1"), &p, &mut a, &politica());
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b2"), &p, &mut a, &politica());
    confirmar_todo(&mut a);
    let antes = a.inventario().entradas(&raiz()).len();
    assert!(antes > 0, "el banco tiene que haber dejado filas");

    assert!(a.desenrolar(&raiz()).is_some(), "estaba enrolada");
    assert!(
        a.inventario().raices().is_empty(),
        "la carpeta sale de la lista"
    );
    assert_eq!(
        a.inventario().entradas(&raiz()).len(),
        antes,
        "pero sus filas siguen enteras, que es lo que hace que al volver matchee"
    );

    // Y al reenrolarla vuelve a estar, con su inventario intacto.
    a.enrolar(registrada());
    assert_eq!(a.inventario().raices().len(), 1);
    assert_eq!(a.inventario().entradas(&raiz()).len(), antes);
}

#[test]
fn quitar_una_carpeta_deja_de_subir_lo_que_tenia_encolado() {
    // IMPORTA PORQUE: las filas sobreviven a proposito, pero lo ENCOLADO no puede. Son
    // cosas que el agente todavia no le dijo a Savia sobre una carpeta que la persona
    // acaba de sacar de la lista; drenarlas despues es hacer exactamente lo que pidio que
    // dejara de hacer, y encima despues de que el panel ya no la muestra.
    let p = Falsa::como_macos();
    p.poner("x.txt", b"contenido", 100, Some(1));
    let mut a = almacen();
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b1"), &p, &mut a, &politica());
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b2"), &p, &mut a, &politica());
    assert!(
        a.colas().hechos_pendientes(&raiz()) > 0,
        "el banco tiene que haber encolado algo"
    );

    a.desenrolar(&raiz());
    assert_eq!(
        a.colas().hechos_pendientes(&raiz()),
        0,
        "nada de esa raiz queda esperando para salir"
    );
}

#[test]
fn quitar_una_carpeta_que_no_estaba_no_hace_nada() {
    // IMPORTA PORQUE: `None` y `Some(0)` son distintos y la interfaz los va a mostrar
    // distinto. `None` es «esa carpeta no estaba en la lista» —un id viejo, un doble
    // clic— y `Some(0)` es «estaba, y no tenia nada pendiente». Colapsarlos obliga al
    // panel a inventar cual paso.
    let mut a = almacen();
    assert!(a.desenrolar(&RaizId::nueva("no-existe")).is_none());
    assert_eq!(
        a.inventario().raices().len(),
        1,
        "y no toco la que si estaba"
    );
    assert_eq!(
        a.desenrolar(&raiz()),
        Some(0),
        "estaba, y sin nada encolado"
    );
}

#[test]
fn reelegir_la_misma_carpeta_da_la_misma_id() {
    // IMPORTA PORQUE: es la decision 7 —«reelegir la raiz movida da el MISMO RootId»—
    // que estaba escrita en tres lugares como propiedad y en ninguno como codigo. El
    // demo acunaba `"root-1"` a mano. Si la id se estrenara en cada eleccion, nada de lo
    // anterior matchea: se resube todo y las lapidas quedan huerfanas.
    let h = Falsa::huella_del_banco();
    assert_eq!(h.raiz_id(), h.raiz_id(), "es una funcion de la huella");

    // Y la ruta NO entra en la derivacion: mover la carpeta no estrena raiz.
    let a = RaizRegistrada {
        id: h.raiz_id(),
        huella: h,
        ruta_absoluta: std::path::PathBuf::from("/antes"),
        sensibilidad: SensibilidadAMayusculas::Distingue,
    };
    let h2 = Falsa::huella_del_banco();
    let b = RaizRegistrada {
        id: h2.raiz_id(),
        huella: h2,
        ruta_absoluta: std::path::PathBuf::from("/despues/de/moverla"),
        sensibilidad: SensibilidadAMayusculas::Distingue,
    };
    assert_eq!(a.id, b.id, "la ruta es procedencia, no identidad");
}

// ══════════════════════════════════════════════════════════════════════════════
// 10 · LA ARISTA DE D1 (FASE 3): DESVINCULAR NO ARRASTRA COLA, Y REAGREGAR SI CORTA
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn quitar_una_carpeta_con_trabajo_en_vuelo_no_deja_nada_pendiente() {
    // IMPORTA PORQUE: el plan (D1, Fase 3) pide un test de que desvincular **no** manda
    // el padron vacio — o sea, que no congele la raiz por el camino corto que alguien va
    // a querer tomar para "avisarle a Savia que la carpeta se fue". `Colas::olvidar` ya
    // suelta TODO — segmentos, bytes, muertas, envenenadas y `congeladas.remove(raiz)` —
    // pero un escenario sin nada pendiente no prueba nada de verdad: hace falta dejar un
    // trabajo A MEDIO CAMINO — Savia ya contesto que hace falta el padron y todavia no se
    // le mando — para que `desenrolar` tenga algo real que soltar.
    let p = Falsa::como_macos();
    let mut a = almacen();

    // SEED: una ruta que Savia rechaza de una, para dejarla ENVENENADA antes de que
    // empiece el escenario real de abajo. `x.txt` nunca envenena nada por si solo, asi
    // que sin este paso `rutas_envenenadas().is_empty()` de mas abajo tambien queda
    // vacia (Fase 8, verificado a mano).
    p.poner("veneno.txt", b"algo", 50, Some(9));
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(
        &raiz(),
        BarridoId::nuevo("veneno-1"),
        &p,
        &mut a,
        &politica(),
    );
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(
        &raiz(),
        BarridoId::nuevo("veneno-2"),
        &p,
        &mut a,
        &politica(),
    );
    while let Proximo::Trabajo(t) = a.siguiente(&raiz()) {
        let (id, desenlace) = match *t {
            Trabajo::AbrirBarrido { id, .. } => (
                id,
                Desenlace::Entregado(Recibido::Barrido {
                    sweep: SweepId("veneno-sweep".into()),
                    padron_requerido: false,
                }),
            ),
            Trabajo::Observar { id, .. } => (
                id,
                Desenlace::Rechazado {
                    status: 400,
                    cuerpo: "entrada invalida".into(),
                    culpables: Vec::new(),
                },
            ),
            Trabajo::CerrarBarrido { id, .. } => (
                id,
                Desenlace::Entregado(Recibido::Retirados {
                    rutas: Vec::new(),
                    congelada: false,
                }),
            ),
            otro => panic!("el seed de veneno no puede producir otro trabajo: {otro:?}"),
        };
        a.resolver(&raiz(), &id, desenlace);
    }
    assert!(
        a.colas()
            .rutas_envenenadas(&raiz())
            .iter()
            .any(|r| r.como_str() == "veneno.txt"),
        "el seed tiene que dejar la ruta envenenada antes de empezar el escenario real"
    );

    // SEED: un barrido vacio que Savia cierra con `congelada: true`, para dejar la
    // marca puesta ANTES de que empiece el escenario real de abajo. Sin este paso la
    // aserion `!congelada` de mas abajo queda vacia -esta raiz nunca estuvo congelada
    // en el resto del test-, y una mutacion que borrara `congeladas.remove(raiz)` en
    // `olvidar` no la hace fallar (Fase 8, verificado a mano).
    ciclo::barrer(&raiz(), BarridoId::nuevo("seed"), &p, &mut a, &politica());
    while let Proximo::Trabajo(t) = a.siguiente(&raiz()) {
        let (id, recibido) = match *t {
            Trabajo::AbrirBarrido { id, .. } => (
                id,
                Recibido::Barrido {
                    sweep: SweepId("seed-sweep".into()),
                    padron_requerido: false,
                },
            ),
            Trabajo::CerrarBarrido { id, .. } => (
                id,
                Recibido::Retirados {
                    rutas: Vec::new(),
                    congelada: true,
                },
            ),
            otro => panic!("el seed no puede producir otro trabajo: {otro:?}"),
        };
        a.resolver(&raiz(), &id, Desenlace::Entregado(recibido));
    }
    assert!(
        a.colas().congelada(&raiz()),
        "el seed tiene que dejar la marca puesta antes de empezar el escenario real"
    );

    p.poner("x.txt", b"contenido", 100, Some(1));
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b1"), &p, &mut a, &politica());

    // Se drena a mano: Savia contesta que hace falta el padron...
    let Proximo::Trabajo(t) = a.siguiente(&raiz()) else {
        panic!("falta la apertura")
    };
    let Trabajo::AbrirBarrido { id, .. } = *t else {
        panic!("el primero es sweep.open")
    };
    a.resolver(
        &raiz(),
        &id,
        Desenlace::Entregado(Recibido::Barrido {
            sweep: SweepId("s-1".into()),
            padron_requerido: true,
        }),
    );

    // ...y ACA se corta la mano: no hay observados que entregar todavia (recien es el
    // primer barrido, y `x.txt` es un candidato sin asentar), asi que el proximo trabajo
    // es DIRECTO el padron — y todavia no salio.
    let Proximo::Trabajo(t) = a.siguiente(&raiz()) else {
        panic!("falta el padron")
    };
    assert!(
        matches!(*t, Trabajo::EnviarPadron { .. }),
        "el escenario tiene que dejar el padron a medio camino para que la prueba proteja algo: {t:?}"
    );

    // Y ACA la persona pide "dejar de mirar esta carpeta", con el padron todavia colgado.
    assert!(a.desenrolar(&raiz()).is_some(), "estaba enrolada");
    assert_eq!(
        a.colas().hechos_pendientes(&raiz()),
        0,
        "nada de esa raiz queda esperando para salir, ni el padron a medio camino"
    );
    assert!(
        !a.colas().congelada(&raiz()),
        "nadie le mando a Savia un padron vacio que la hubiera congelado, y la marca vieja del seed tampoco sobrevive"
    );
    assert!(
        a.colas().rutas_envenenadas(&raiz()).is_empty(),
        "y tampoco quedo ninguna ruta envenenada colgando"
    );

    // Se vuelve a agregar la MISMA carpeta...
    a.enrolar(registrada());
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b3"), &p, &mut a, &politica());

    // ...y el barrido nuevo abre LIMPIO: lo proximo es `sweep.open`, no el padron colgado
    // del segmento que se solto.
    assert!(
        matches!(
            a.siguiente(&raiz()),
            Proximo::Trabajo(t) if matches!(*t, Trabajo::AbrirBarrido { .. })
        ),
        "el barrido nuevo no puede arrastrar nada del segmento que `olvidar` ya solto"
    );
}

#[test]
fn reagregar_una_carpeta_que_perdio_casi_todo_dispara_el_corte_por_volumen() {
    // IMPORTA PORQUE: es la "arista honesta" que el plan nombra en D1 — mientras la
    // carpeta no se mira, Savia no se entera de lo que cambia adentro, y si en el medio
    // se borraron MUCHOS archivos la primera revision, al volver a agregarla, puede
    // disparar el corte por volumen y la carpeta queda "En pausa" — la salvaguarda
    // haciendo exactamente su trabajo. **El agente no decide congelar** — eso es
    // `FRACCION_DEL_CORTE`, un parametro de SAVIA que sigue en `None` porque no es del
    // agente — asi que esta prueba no calcula ningun corte: prueba el ROUND-TRIP. Cuando
    // el SERVIDOR contesta `congelada: true`, el agente lo recibe y lo aplica hasta el
    // panel, que es el nivel que una persona ve — no solo el de `colas` por dentro.
    let p = Falsa::como_macos();
    for n in 1..=5u128 {
        p.poner(
            &format!("archivo-{n}.txt"),
            format!("contenido {n}").as_bytes(),
            100,
            Some(n),
        );
    }
    let mut a = almacen();
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 1);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 2);
    for n in 1..=5u128 {
        assert!(
            matches!(
                estado_de_hash(&a, &format!("archivo-{n}.txt")),
                Some(EstadoDeHash::Confirmado(_))
            ),
            "los cinco tienen que arrancar CONFIRMADOS para que su baja pueda viajar despues"
        );
    }

    // Se deja de mirar la carpeta...
    assert!(a.desenrolar(&raiz()).is_some(), "estaba enrolada");

    // ...y mientras nadie mira, se borra la mayoria de lo que tenia adentro.
    p.sacar("archivo-2.txt");
    p.sacar("archivo-3.txt");
    p.sacar("archivo-4.txt");
    p.sacar("archivo-5.txt");

    // Se vuelve a agregar la MISMA carpeta...
    a.enrolar(registrada());
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    let resumen = ciclo::barrer(&raiz(), BarridoId::nuevo("b3"), &p, &mut a, &politica());
    assert_eq!(
        resumen.bajas, 4,
        "la primera revision reconcilia: encuentra que cuatro de cinco ya no estan: {resumen:?}"
    );

    // ...y se cierra ESE barrido con Savia contestando que congelo la raiz.
    let mut vio_cierre = false;
    while let Proximo::Trabajo(t) = a.siguiente(&raiz()) {
        let (id, recibido) = match *t {
            Trabajo::AbrirBarrido { id, .. } => (
                id,
                Recibido::Barrido {
                    sweep: SweepId("sweep-3".into()),
                    padron_requerido: false,
                },
            ),
            Trabajo::Observar { id, .. } => (id, Recibido::Decisiones(Vec::new())),
            Trabajo::Desvanecer { id, .. } => (id, Recibido::Nada),
            Trabajo::EnviarPadron { id, .. } => (id, Recibido::Nada),
            Trabajo::CerrarBarrido { id, .. } => {
                vio_cierre = true;
                (
                    id,
                    Recibido::Retirados {
                        rutas: Vec::new(),
                        congelada: true,
                    },
                )
            }
            Trabajo::Subir { id, .. } => (id, Recibido::Nada),
            Trabajo::ConfirmarSubida { id, .. } => (
                id,
                Recibido::Verificado(HashVerificado::rehidratar_del_inventario([9u8; 32])),
            ),
        };
        a.resolver(&raiz(), &id, Desenlace::Entregado(recibido));
    }
    assert!(
        vio_cierre,
        "el cierre tiene que salir para que Savia tenga donde contestar `congelada`"
    );

    // La garantia de punta a punta: la cola lo sabe...
    assert!(
        a.colas().congelada(&raiz()),
        "el agente tiene que guardar lo que Savia contesto"
    );
    // ...y el panel — lo que una persona ve — tambien, que es la garantia real de D1.
    let v = panel::vista(&a, &p, TOPE_DEL_PANEL);
    assert_eq!(
        v.estado,
        EstadoDeCarpeta::Congelado,
        "el agregado tiene que decir Congelado"
    );
    assert_eq!(
        v.carpetas[0].estado,
        EstadoDeCarpeta::Congelado,
        "y la carpeta puntual tambien, no solo el agregado del dispositivo"
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// 11 · `.git`, `.DS_Store` Y CUALQUIER DOTFILE NUNCA SE ENUMERAN
// ══════════════════════════════════════════════════════════════════════════════

/// Sin filtro, un `.git` adentro de la raiz vigilada terminaba con sus objetos sueltos
/// y sus refs subidos a Savia como si fueran documentos — y `.DS_Store`, el metadata de
/// Finder, igual. La convencion (Unix, git, rsync) es que un nombre que empieza con "."
/// no es para mostrar; `nombre_excluido_por_convencion` en `contrato::dominio` la
/// aplica en el unico lugar que enumera de verdad
/// (`plataforma-adaptadores::macos::recorrer`), y `Falsa` la espeja para que este banco
/// la ejerza sin disco real.
#[test]
fn un_git_y_un_ds_store_nunca_llegan_a_fila() {
    let p = Falsa::como_macos();
    p.poner("contrato.docx", b"uno", 100, Some(1));
    p.poner(".DS_Store", b"metadata de finder", 100, Some(2));
    p.poner(".git/HEAD", b"ref: refs/heads/main", 100, Some(3));
    p.poner(
        ".git/objects/ab/cdef0123456789",
        b"blob suelto",
        100,
        Some(4),
    );
    p.poner("sub/.env", b"SECRETO=1", 100, Some(5));
    let mut a = almacen();
    barrer_y_confirmar(&p, &mut a, 1);

    let rutas: Vec<String> = a
        .inventario()
        .entradas(&raiz())
        .into_iter()
        .map(|e| e.ruta.como_str().to_string())
        .collect();
    assert_eq!(
        rutas,
        vec!["contrato.docx".to_string()],
        "el `.git`, el `.DS_Store` y el `.env` bajo un directorio con punto no tienen \
         que dejar fila — solo el documento real"
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// 12 · `detenido` SE LIMPIA, O "VOLVER A VINCULAR" APRUEBA Y NO CAMBIA NADA
// ══════════════════════════════════════════════════════════════════════════════

/// `Colas::detenido` se ponia en `Some` con `Desenlace::Credenciales` y nada en el
/// codebase lo volvia a `None` — ni el tiempo, ni un intento que salga bien, ni un token
/// nuevo. `siguiente` lo mira ANTES que cualquier otra cosa, asi que una vez fijado
/// bloqueaba la raiz para siempre: aprobar un codigo nuevo en "Volver a vincular" dejaba
/// un `Secreto` valido en el cliente, pero el panel seguia mostrando "Sin acceso" porque
/// nada le habia pedido a `Colas` que lo olvidara. `Colas::reanudar` es el unico camino
/// de vuelta, y el hilo de trabajo lo llama justo cuando adopta el token nuevo (ver
/// `bin/bandeja/main.rs`, el drenaje de `token_pendiente`).
#[test]
fn reanudar_saca_el_atasco_que_dejo_una_credencial_rechazada() {
    let raiz = raiz();
    let mut c = cola_hasta_el_cierre(&raiz);
    let Proximo::Trabajo(t) = c.siguiente(&raiz) else {
        panic!("falta el cierre")
    };
    let Trabajo::CerrarBarrido { id, .. } = *t else {
        panic!("el tercero es sweep.close")
    };
    c.resolver(&id, Desenlace::Credenciales("401".into()));
    assert!(
        matches!(c.siguiente(&raiz), Proximo::Detenida(_)),
        "una credencial rechazada tiene que detener la raiz"
    );

    c.reanudar();

    assert!(
        !matches!(c.siguiente(&raiz), Proximo::Detenida(_)),
        "un token nuevo tiene que sacar el atasco — 'Volver a vincular' aprobado no puede \
         seguir mostrando 'Sin acceso'"
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// 13 · UN DISPOSITIVO DETENIDO NO ACUMULA UN BARRIDO POR VUELTA
// ══════════════════════════════════════════════════════════════════════════════

/// Contesta 401 a `sweep.open` siempre. Los otros seis metodos son `unreachable!()`:
/// con la apertura rechazada nunca hay hechos que observar ni cierre que pedir en ESTE
/// escenario (la raiz del banco no tiene archivos), y una vez que `Colas::detenido`
/// queda en `Some`, `siguiente` corta por `Proximo::Detenida` antes de volver a tocar
/// el canal.
struct CanalCredencialesRechazadas;

impl savia_folder_protocolo::CanalDeSavia for CanalCredencialesRechazadas {
    fn abrir_barrido(
        &self,
        _raiz: &RaizId,
        _total: u64,
    ) -> Result<
        savia_folder_contrato::protocolo::BarridoAbierto,
        savia_folder_protocolo::FalloDeProtocolo,
    > {
        Err(savia_folder_protocolo::FalloDeProtocolo::Estado {
            llamada: "sweep.open",
            codigo: 401,
            cuerpo: "credenciales invalidas".into(),
        })
    }
    fn enviar_padron(
        &self,
        _barrido: &SweepId,
        _entradas: &[(String, Option<String>)],
    ) -> Result<u64, savia_folder_protocolo::FalloDeProtocolo> {
        unreachable!("con la apertura rechazada, nada pasa de `sweep.open`")
    }
    fn reportar_observados(
        &self,
        _raiz: &RaizId,
        _entradas: &[(
            savia_folder_contrato::dominio::RutaRelativa,
            savia_folder_contrato::dominio::HashAfirmado,
        )],
    ) -> Result<Vec<Veredicto>, savia_folder_protocolo::FalloDeProtocolo> {
        unreachable!("idem")
    }
    fn subir(
        &self,
        _permiso: &Permiso,
        _bytes: &[u8],
    ) -> Result<savia_folder_protocolo::Subido, savia_folder_protocolo::FalloDeProtocolo> {
        unreachable!("idem")
    }
    fn confirmar_subida_reanudada(
        &self,
        _permiso: &PermisoId,
    ) -> Result<
        savia_folder_contrato::protocolo::Confirmacion,
        savia_folder_protocolo::FalloDeProtocolo,
    > {
        unreachable!("idem")
    }
    fn reportar_desaparecidos(
        &self,
        _raiz: &RaizId,
        _entradas: &[salvaguardas::Desaparicion],
        _viva: &salvaguardas::EstadoDeRaiz,
    ) -> Result<
        savia_folder_contrato::protocolo::Cuarentena,
        savia_folder_protocolo::FalloDeProtocolo,
    > {
        unreachable!("idem")
    }
    fn cerrar_barrido(
        &self,
        _barrido: &SweepId,
        _cierre: EstadoDelBarrido,
    ) -> Result<
        savia_folder_contrato::protocolo::CierreAplicado,
        savia_folder_protocolo::FalloDeProtocolo,
    > {
        unreachable!("con la apertura rechazada, el cierre nunca llega a pedirse")
    }
}

/// Contesta EXITO a todo. Solo se usa DESPUES de `reanudar()`, para contar cuantas
/// `sweep.open` hacen falta para vaciar la cola entera de esta raiz.
struct CanalQueAceptaTodo {
    aperturas: std::cell::Cell<u32>,
}

impl savia_folder_protocolo::CanalDeSavia for CanalQueAceptaTodo {
    fn abrir_barrido(
        &self,
        _raiz: &RaizId,
        _total: u64,
    ) -> Result<
        savia_folder_contrato::protocolo::BarridoAbierto,
        savia_folder_protocolo::FalloDeProtocolo,
    > {
        self.aperturas.set(self.aperturas.get() + 1);
        Ok(savia_folder_contrato::protocolo::BarridoAbierto {
            sweep_id: SweepId(format!("sweep-{}", self.aperturas.get())),
            padron_requerido: false,
        })
    }
    fn enviar_padron(
        &self,
        _barrido: &SweepId,
        _entradas: &[(String, Option<String>)],
    ) -> Result<u64, savia_folder_protocolo::FalloDeProtocolo> {
        unreachable!("la raiz del banco no tiene archivos: no hay padron que pedir")
    }
    fn reportar_observados(
        &self,
        _raiz: &RaizId,
        _entradas: &[(
            savia_folder_contrato::dominio::RutaRelativa,
            savia_folder_contrato::dominio::HashAfirmado,
        )],
    ) -> Result<Vec<Veredicto>, savia_folder_protocolo::FalloDeProtocolo> {
        unreachable!("sin archivos no hay observados que reportar")
    }
    fn subir(
        &self,
        _permiso: &Permiso,
        _bytes: &[u8],
    ) -> Result<savia_folder_protocolo::Subido, savia_folder_protocolo::FalloDeProtocolo> {
        unreachable!("sin archivos no hay bytes que subir")
    }
    fn confirmar_subida_reanudada(
        &self,
        _permiso: &PermisoId,
    ) -> Result<
        savia_folder_contrato::protocolo::Confirmacion,
        savia_folder_protocolo::FalloDeProtocolo,
    > {
        unreachable!("idem")
    }
    fn reportar_desaparecidos(
        &self,
        _raiz: &RaizId,
        _entradas: &[salvaguardas::Desaparicion],
        _viva: &salvaguardas::EstadoDeRaiz,
    ) -> Result<
        savia_folder_contrato::protocolo::Cuarentena,
        savia_folder_protocolo::FalloDeProtocolo,
    > {
        unreachable!("sin archivos no hay bajas que reportar")
    }
    fn cerrar_barrido(
        &self,
        _barrido: &SweepId,
        _cierre: EstadoDelBarrido,
    ) -> Result<
        savia_folder_contrato::protocolo::CierreAplicado,
        savia_folder_protocolo::FalloDeProtocolo,
    > {
        Ok(savia_folder_contrato::protocolo::CierreAplicado {
            retirados: Vec::new(),
            congelada: false,
        })
    }
}

#[test]
fn un_dispositivo_detenido_no_acumula_un_barrido_por_vuelta() {
    // IMPORTA PORQUE: es el escenario medido en produccion, punta a punta — 25.410 de
    // 33.604 segmentos acumulados, casi todos con `falta AbrirBarrido`, con el token
    // muerto. `Colas::resolver` nunca corre sobre esa credencial rechazada —`siguiente`
    // corta por `Proximo::Detenida` ANTES de eso, y `ciclo::barrer` sigue abriendo un
    // barrido por vuelta igual, a proposito, para que el observador no se detenga— asi
    // que es `abrir_barrido`, y no `resolver`, quien tiene que podar aca.
    let p = Falsa::como_macos();
    let mut a = almacen();
    let canal_roto = CanalCredencialesRechazadas;

    let mut pesos = Vec::new();
    for n in 1..=20u32 {
        ciclo::barrer(
            &raiz(),
            BarridoId::nuevo(format!("v{n:02}")),
            &p,
            &mut a,
            &politica(),
        );
        p.avanzar(ASENTAMIENTO_DEL_BANCO);
        let mut traza = Vec::new();
        ciclo::drenar(&raiz(), &p, &mut a, &canal_roto, &mut traza);
        pesos.push(serde_json::to_string(&a.para_guardar()).unwrap().len());
    }
    assert_eq!(
        a.colas().detenido(),
        Some(savia_folder_estado::colas::MotivoDeDetencion::Credenciales),
        "la raiz tiene que seguir detenida al cabo de las veinte vueltas"
    );
    // Vuelta 10 contra vuelta 20: las dos caen bien adentro de la meseta y ninguna cruza
    // el borde de digitos de `proximo_id` (que en este escenario pasa de un digito a dos
    // entre la vuelta 8 y la 9) — ver el mismo razonamiento, medido, en
    // `persistencia::diez_barridos_sin_drenar_no_pesan_mas_que_cuatro`.
    assert_eq!(
        pesos[9], pesos[19],
        "detenido, el tamano tiene que quedar CONSTANTE desde temprano y no crecer uno \
         por vuelta: {pesos:?}"
    );

    // Se adopta un token nuevo ("Volver a vincular" aprobado, o el reinicio de sesion).
    a.reanudar();

    // Y drenar la cola ENTERA tiene que abrir el barrido UNA sola vez, no veinte: los
    // diecinueve anteriores ya quedaron superados durante la detencion, no colgados en
    // la cola esperando su turno.
    let canal_ok = CanalQueAceptaTodo {
        aperturas: std::cell::Cell::new(0),
    };
    let mut traza = Vec::new();
    ciclo::drenar(&raiz(), &p, &mut a, &canal_ok, &mut traza);
    assert_eq!(
        canal_ok.aperturas.get(),
        1,
        "solo el ULTIMO barrido sigue en pie: {traza:?}"
    );
}
