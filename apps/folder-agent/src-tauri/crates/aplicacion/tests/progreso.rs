//! EL CANAL DE PROGRESO. `barrer_reportando` es `barrer` con un testigo enchufado, y esa
//! frase es la garantia entera: si las dos vueltas pudieran divergir, el panel mostraria
//! el avance de un barrido que no es el que el agente esta haciendo.
//!
//! Cada afirmacion dice QUE prueba y POR QUE importa —al estilo del resto de las bancadas
//! de este crate—, porque una prueba que no dice que rompe si falla es una prueba que
//! alguien borra cuando molesta.

use savia_folder_aplicacion::ciclo;
use savia_folder_contrato::colas::{Decision, SweepId, Veredicto};
use savia_folder_contrato::dominio::{
    BarridoId, EstadoDelBarrido, HashVerificado, RaizId, SensibilidadAMayusculas,
};
use savia_folder_contrato::plataforma::RaizRegistrada;
use savia_folder_estado::almacen::Almacen;
use savia_folder_estado::colas::{Desenlace, ParametrosDeCola, Proximo, Recibido, Trabajo};
use savia_folder_plataforma_falsa::falsa::Falsa;
use savia_folder_politica::salvaguardas::Politica;
use std::time::Duration;

/// El intervalo del BANCO, no del producto. `parametros::ASENTAMIENTO` sigue en `None`.
const ASENTAMIENTO_DEL_BANCO: Duration = Duration::from_secs(30);

/// Cuantos archivos tiene el escenario. **No es un parametro de nada**: es el tamano del
/// banco, y esta nombrado para que las afirmaciones de abajo comparen contra el mismo
/// numero que el escenario planta en vez de contra un literal repetido.
const ARCHIVOS: usize = 7;

fn raiz() -> RaizId {
    RaizId::nueva("root-1")
}

fn politica() -> Politica {
    Politica::con_asentamiento(ASENTAMIENTO_DEL_BANCO).expect("el banco lo provee")
}

/// El MISMO escenario, dos veces. Cada llamada estrena su `Falsa` y su `Almacen`: las dos
/// vueltas que se comparan tienen que partir de estados independientes pero identicos, o
/// la comparacion mide el arrastre de la primera en vez del efecto del testigo.
fn escenario() -> (Falsa, Almacen) {
    let p = Falsa::como_macos();
    for i in 0..ARCHIVOS {
        p.poner(
            &format!("carpeta/nota-{i}.md"),
            format!("el contenido numero {i}").as_bytes(),
            100 + i as i64,
            Some(i as u128 + 1),
        );
    }
    let mut a = Almacen::nuevo(ParametrosDeCola {
        max_intentos: None,
        max_entradas_por_lote: None,
    });
    a.enrolar(RaizRegistrada {
        id: raiz(),
        huella: Falsa::huella_del_banco(),
        ruta_absoluta: std::path::PathBuf::from("/no/se/toca"),
        sensibilidad: SensibilidadAMayusculas::Distingue,
    });
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    (p, a)
}

/// El servidor de mentira: contesta `known` a todo y deja las filas con hash CONFIRMADO,
/// que es lo unico que despues puede viajar en una baja. Sin esta vuelta, sacar un archivo
/// no produce ninguna baja —no hay documento del otro lado que retirar— y el test del
/// cierre estaria comparando dos resumenes vacios.
fn confirmar_todo(a: &mut Almacen) {
    loop {
        let Proximo::Trabajo(t) = a.siguiente(&raiz()) else {
            return;
        };
        let (id, recibido) = match *t {
            Trabajo::AbrirBarrido { id, .. } => (
                id,
                Recibido::Barrido {
                    sweep: SweepId("sweep-del-banco".into()),
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
            Trabajo::CerrarBarrido { id, .. } => (
                id,
                Recibido::Retirados {
                    rutas: Vec::new(),
                    congelada: false,
                },
            ),
            Trabajo::Subir { id, .. } => (id, Recibido::Nada),
            Trabajo::ConfirmarSubida { id, .. } => (
                id,
                Recibido::Verificado(HashVerificado::rehidratar_del_inventario([9u8; 32])),
            ),
        };
        a.resolver(&raiz(), &id, Desenlace::Entregado(recibido));
    }
}

#[test]
fn el_testigo_mira_y_no_participa() {
    // IMPORTA PORQUE: el dia que la integracion cambie `barrer` por `barrer_reportando`
    // adentro de `trabajar()`, el agente entero pasa a correr por la funcion nueva. Si esa
    // vuelta no fuera IDENTICA —un contador de mas, una baja que no se cuenta, un cierre
    // distinto—, el cambio se colaria como «ahora hay barra de progreso» y estaria
    // moviendo lo que el agente cree que Savia sabe.
    //
    // El resumen se compara ENTERO y no campo por campo: `ResumenDelBarrido` deriva
    // `PartialEq` justamente para que un campo nuevo entre a esta comparacion sin que
    // nadie se acuerde de agregarlo.
    let (sin_testigo, mut almacen_sin) = escenario();
    let resumen_sin = ciclo::barrer(
        &raiz(),
        BarridoId::nuevo("b1"),
        &sin_testigo,
        &mut almacen_sin,
        &politica(),
    );

    let (con_testigo, mut almacen_con) = escenario();
    let mut ignorado: Vec<(usize, usize)> = Vec::new();
    let resumen_con = ciclo::barrer_reportando(
        &raiz(),
        BarridoId::nuevo("b1"),
        &con_testigo,
        &mut almacen_con,
        &politica(),
        &mut |procesados, total| ignorado.push((procesados, total)),
    );

    assert_eq!(
        resumen_sin, resumen_con,
        "`barrer_reportando` devolvio otro resumen que `barrer` sobre el mismo escenario: el testigo dejo de ser un testigo"
    );
    assert!(
        !ignorado.is_empty(),
        "el testigo no se llamo ni una vez, asi que la comparacion de arriba no probo nada"
    );
}

#[test]
fn el_testigo_trae_el_total_completo_desde_la_primera_llamada() {
    // IMPORTA PORQUE: un total que crece junto con el numerador convierte la barra en una
    // que nunca avanza —siempre «i de i»— y en una que nunca se puede convertir en un
    // porcentaje. El denominador se conoce ANTES del lazo (es el conjunto enumerado), asi
    // que no hay ninguna razon para que la primera llamada traiga uno provisorio.
    let (p, mut a) = escenario();
    let mut vistos: Vec<(usize, usize)> = Vec::new();
    let resumen = ciclo::barrer_reportando(
        &raiz(),
        BarridoId::nuevo("b1"),
        &p,
        &mut a,
        &politica(),
        &mut |procesados, total| vistos.push((procesados, total)),
    );

    assert_eq!(
        resumen.enumeradas, ARCHIVOS,
        "el escenario no enumero los archivos que planto: el resto de las afirmaciones compararia contra un banco vacio"
    );
    assert_eq!(
        vistos.len(),
        ARCHIVOS,
        "una llamada por archivo iterado, ni una mas ni una menos"
    );
    assert_eq!(
        vistos[0].1, ARCHIVOS,
        "el total llego incompleto en la PRIMERA llamada: la barra arrancaria contra un denominador que todavia no es el final"
    );
    for (i, (procesados, total)) in vistos.iter().enumerate() {
        assert_eq!(
            *total, ARCHIVOS,
            "el total se movio en la llamada {i}: el denominador tiene que ser el mismo las {ARCHIVOS} veces"
        );
        assert_eq!(
            *procesados,
            i + 1,
            "`procesados` no crece de a uno: la llamada {i} dijo {procesados}"
        );
    }
    assert_eq!(
        vistos.last().copied(),
        Some((ARCHIVOS, ARCHIVOS)),
        "el ultimo aviso no cierra en «N de N»: una barra que se queda a un archivo del final parece colgada"
    );
}

#[test]
fn una_raiz_sin_archivos_no_avisa_nada() {
    // IMPORTA PORQUE: es el caso en el que un `total` de cero se vuelve un divisor. El
    // contrato es que el testigo NO se llama —no hay archivo iterado—, asi que quien
    // dibuje la barra nunca recibe un «0 de 0» que tenga que interpretar.
    let p = Falsa::como_macos();
    let mut a = Almacen::nuevo(ParametrosDeCola {
        max_intentos: None,
        max_entradas_por_lote: None,
    });
    a.enrolar(RaizRegistrada {
        id: raiz(),
        huella: Falsa::huella_del_banco(),
        ruta_absoluta: std::path::PathBuf::from("/no/se/toca"),
        sensibilidad: SensibilidadAMayusculas::Distingue,
    });

    let mut vistos: Vec<(usize, usize)> = Vec::new();
    let resumen = ciclo::barrer_reportando(
        &raiz(),
        BarridoId::nuevo("b1"),
        &p,
        &mut a,
        &politica(),
        &mut |procesados, total| vistos.push((procesados, total)),
    );

    assert_eq!(resumen.enumeradas, 0);
    assert!(
        vistos.is_empty(),
        "el testigo se llamo sobre una raiz vacia: alguien lo esta invocando fuera del lazo de archivos"
    );
}

#[test]
fn un_barrido_de_miles_avisa_una_vez_por_archivo_y_ni_una_de_mas() {
    // IMPORTA PORQUE: es la aceptacion de la Fase 7 —«el canal se prueba con un barrido de
    // miles sin que el panel se trabe»— vista desde el lado que este archivo SI puede
    // afirmar. Que el panel no se trabe lo decide quien conecta el testigo a `app.emit`;
    // lo que se fija aca es el contrato con el que esa decision se toma: **una llamada por
    // archivo, exactamente**, con el total quieto y el numerador monotono.
    //
    // Y decirlo con miles y no con siete es el punto: a esta escala la cuenta deja de ser
    // trivia y pasa a ser el presupuesto de eventos IPC que la integracion tiene que
    // gastar o recortar. Si algun dia alguien mete un «cada N» aca adentro, este test se
    // pone rojo — que es exactamente lo que se quiere, porque ese N seria un numero que
    // decide comportamiento y que nadie midio.
    const MILES: usize = 5_000;

    let p = Falsa::como_macos();
    for i in 0..MILES {
        p.poner(
            &format!("hondo/{}/nota-{i}.md", i % 64),
            format!("contenido {i}").as_bytes(),
            100 + i as i64,
            Some(i as u128 + 1),
        );
    }
    let mut a = Almacen::nuevo(ParametrosDeCola {
        max_intentos: None,
        max_entradas_por_lote: None,
    });
    a.enrolar(RaizRegistrada {
        id: raiz(),
        huella: Falsa::huella_del_banco(),
        ruta_absoluta: std::path::PathBuf::from("/no/se/toca"),
        sensibilidad: SensibilidadAMayusculas::Distingue,
    });
    p.avanzar(ASENTAMIENTO_DEL_BANCO);

    // No se guarda la secuencia entera: se verifica en el momento. Un `Vec` de 5.000 pares
    // mediria la memoria del test y no el contrato de la funcion.
    let mut llamadas = 0usize;
    let mut anterior = 0usize;
    let mut total_visto = 0usize;
    let mut roto: Option<String> = None;
    let resumen = ciclo::barrer_reportando(
        &raiz(),
        BarridoId::nuevo("b1"),
        &p,
        &mut a,
        &politica(),
        &mut |procesados, total| {
            llamadas += 1;
            if llamadas == 1 {
                total_visto = total;
            }
            if roto.is_none() {
                if total != total_visto {
                    roto = Some(format!(
                        "el total se movio en la llamada {llamadas}: {total} contra {total_visto}"
                    ));
                } else if procesados != anterior + 1 {
                    roto = Some(format!(
                        "`procesados` salto de {anterior} a {procesados} en la llamada {llamadas}"
                    ));
                }
            }
            anterior = procesados;
        },
    );

    assert!(roto.is_none(), "{}", roto.unwrap_or_default());
    assert_eq!(
        resumen.enumeradas, MILES,
        "el banco no planto los miles de archivos que este test necesita para significar algo"
    );
    assert_eq!(
        llamadas, MILES,
        "el testigo no se llamo una vez por archivo: alguien le puso un corte adentro de `ciclo`"
    );
    assert_eq!(
        total_visto, MILES,
        "la PRIMERA llamada de un barrido de miles ya tiene que traer el total final"
    );
    assert_eq!(anterior, MILES, "el ultimo aviso no cerro en «N de N»");
}

#[test]
fn el_testigo_tampoco_mueve_la_vuelta_que_cierra_con_ausencias() {
    // IMPORTA PORQUE: la vuelta que importa no es la primera —esa solo da de alta—, es la
    // que descubre que algo falta: ahi el cierre calcula bajas, retenidas y estado del
    // barrido, y es donde una divergencia entre las dos funciones costaria un documento
    // retirado de mas o de menos. El escenario saca un archivo entre la vuelta 1 y la 2 en
    // los DOS lados, y compara el resumen de la vuelta 2.
    const SE_VA: &str = "carpeta/nota-3.md";

    // Las dos primeras vueltas dan de alta y CONFIRMAN: recien con el hash confirmado la
    // ausencia de la tercera vuelta puede convertirse en una baja de verdad.
    let (p1, mut a1) = escenario();
    for n in 1..=2 {
        ciclo::barrer(
            &raiz(),
            BarridoId::nuevo(format!("b{n}")),
            &p1,
            &mut a1,
            &politica(),
        );
        confirmar_todo(&mut a1);
        p1.avanzar(ASENTAMIENTO_DEL_BANCO);
    }
    p1.sacar(SE_VA);
    p1.avanzar(ASENTAMIENTO_DEL_BANCO);
    let resumen_sin = ciclo::barrer(&raiz(), BarridoId::nuevo("b3"), &p1, &mut a1, &politica());

    let (p2, mut a2) = escenario();
    let mut vistos: Vec<(usize, usize)> = Vec::new();
    for n in 1..=2 {
        ciclo::barrer_reportando(
            &raiz(),
            BarridoId::nuevo(format!("b{n}")),
            &p2,
            &mut a2,
            &politica(),
            &mut |procesados, total| vistos.push((procesados, total)),
        );
        confirmar_todo(&mut a2);
        p2.avanzar(ASENTAMIENTO_DEL_BANCO);
    }
    p2.sacar(SE_VA);
    p2.avanzar(ASENTAMIENTO_DEL_BANCO);
    vistos.clear();
    let resumen_con = ciclo::barrer_reportando(
        &raiz(),
        BarridoId::nuevo("b3"),
        &p2,
        &mut a2,
        &politica(),
        &mut |procesados, total| vistos.push((procesados, total)),
    );

    // **SIN ESTO EL TEST PUEDE PASAR SIN MIRAR NADA**: dos resumenes vacios tambien son
    // iguales. La afirmacion de abajo solo vale si la vuelta que se compara es una que
    // efectivamente produjo una baja y cerro completa.
    assert_eq!(
        resumen_sin.bajas, 1,
        "el escenario no produjo la baja que este test existe para comparar"
    );
    assert_eq!(
        resumen_sin.cierre,
        Some(EstadoDelBarrido::Completo),
        "el barrido no cerro completo, asi que el camino de bajas ni se recorrio"
    );

    assert_eq!(
        resumen_sin, resumen_con,
        "las dos vueltas divergieron justo donde el cierre decide bajas"
    );
    assert_eq!(
        vistos.len(),
        ARCHIVOS - 1,
        "el testigo cuenta lo ENUMERADO, no lo que el inventario cree: el archivo que se fue no se itera"
    );
    assert_eq!(
        vistos[0].1,
        ARCHIVOS - 1,
        "el total de la segunda vuelta quedo pegado al de la primera"
    );
}
