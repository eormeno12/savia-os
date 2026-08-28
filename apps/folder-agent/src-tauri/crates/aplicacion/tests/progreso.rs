//! EL CANAL DE PROGRESO. `barrer_reportando` es `barrer` con un testigo enchufado, y esa
//! frase es la garantia entera: si las dos vueltas pudieran divergir, el panel mostraria
//! el avance de un barrido que no es el que el agente esta haciendo.
//!
//! Cada afirmacion dice QUE prueba y POR QUE importa —al estilo del resto de las bancadas
//! de este crate—, porque una prueba que no dice que rompe si falla es una prueba que
//! alguien borra cuando molesta.

use savia_folder_aplicacion::ciclo::{self, ResultadoDelDrenaje};
use savia_folder_contrato::dominio::{BarridoId, EstadoDelBarrido};
use savia_folder_contrato::protocolo::Credencial;
use savia_folder_estado::almacen::Almacen;
use savia_folder_plataforma_falsa::falsa::Falsa;
use savia_folder_protocolo::{BaseDeApi, Cliente};

mod comun;
use comun::{
    ASENTAMIENTO_DEL_BANCO, Mini, almacen, confirmar_todo, politica, raiz, tiempos_del_banco,
};

/// Cuantos archivos tiene el escenario. **No es un parametro de nada**: es el tamano del
/// banco, y esta nombrado para que las afirmaciones de abajo comparen contra el mismo
/// numero que el escenario planta en vez de contra un literal repetido.
const ARCHIVOS: usize = 7;

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
    let a = almacen();
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    (p, a)
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
    let mut a = almacen();

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
    let mut a = almacen();
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

// ═══════════════════ `drenar_reportando`: el mismo testigo, otro lazo ═══════════════════
//
// `drenar` no enumera nada por adelantado —a diferencia de `barrer`, el proximo trabajo
// no se conoce hasta resolver el anterior—, asi que estos tests no comparten cuerpo con
// los de arriba. Lo que SI comparten es el contrato: un testigo que mira y no participa,
// y que un escenario identico produce el mismo resultado con o sin el.
//
// Los servidores de mentira son `comun::Mini` — extraido de `hallazgos.rs` porque
// `CanalDeSavia::subir` devuelve un `Subido` con campos privados: solo el `Cliente` real
// (adentro de `protocolo`) lo puede construir, asi que probar el tramo de bytes exige un
// servidor de verdad del otro lado, no un `CanalDeSavia` fabricado a mano.

fn servidor_de_bajas() -> Mini {
    Mini::nuevo(|clave| match clave {
        "POST /sweep/open" => (
            200,
            "{\"sweepId\":\"s-1\",\"padronRequerido\":false}".into(),
        ),
        "POST /presence/vanished" => (200, "{\"quarantined\":0,\"frozen\":false}".into()),
        "POST /sweep/close" => (200, "{\"retired\":[],\"frozen\":false}".into()),
        _ => (200, "{}".into()),
    })
}

#[test]
fn drenar_reportando_y_drenar_devuelven_el_mismo_resultado() {
    // IMPORTA PORQUE: es el mismo contrato que `el_testigo_mira_y_no_participa` de
    // arriba, pero del lado de `drenar` — el dia que la integracion cambie `drenar` por
    // `drenar_reportando` adentro de `trabajar()`, esta prueba es la que garantiza que el
    // agente entero sigue reportando exactamente las mismas bajas.
    const SE_VA: &str = "carpeta/nota-3.md";

    fn escenario_con_una_baja_encolada() -> (Falsa, Almacen) {
        let (p, mut a) = escenario();
        for n in 1..=2 {
            ciclo::barrer(
                &raiz(),
                BarridoId::nuevo(format!("b{n}")),
                &p,
                &mut a,
                &politica(),
            );
            confirmar_todo(&mut a);
            p.avanzar(ASENTAMIENTO_DEL_BANCO);
        }
        p.sacar(SE_VA);
        p.avanzar(ASENTAMIENTO_DEL_BANCO);
        ciclo::barrer(&raiz(), BarridoId::nuevo("b3"), &p, &mut a, &politica());
        (p, a)
    }

    let (_p1, mut a1) = escenario_con_una_baja_encolada();
    let servidor1 = servidor_de_bajas();
    let cliente1 = Cliente::nuevo(
        BaseDeApi::nueva(&format!("http://127.0.0.1:{}", servidor1.puerto)).unwrap(),
        Credencial::SinAutenticar,
        tiempos_del_banco(),
    );
    let mut traza1 = Vec::new();
    let resultado_sin = ciclo::drenar(&raiz(), &_p1, &mut a1, &cliente1, &mut traza1);

    let (_p2, mut a2) = escenario_con_una_baja_encolada();
    let servidor2 = servidor_de_bajas();
    let cliente2 = Cliente::nuevo(
        BaseDeApi::nueva(&format!("http://127.0.0.1:{}", servidor2.puerto)).unwrap(),
        Credencial::SinAutenticar,
        tiempos_del_banco(),
    );
    let mut traza2 = Vec::new();
    let mut vistos: Vec<(usize, usize)> = Vec::new();
    let resultado_con = ciclo::drenar_reportando(
        &raiz(),
        &_p2,
        &mut a2,
        &cliente2,
        &mut traza2,
        &mut |procesados, total| vistos.push((procesados, total)),
    );

    // **SIN ESTO EL TEST PUEDE PASAR SIN MIRAR NADA**: dos colas vacias tambien terminan
    // igual. La afirmacion solo vale si el escenario de verdad tenia una baja para
    // transmitir.
    assert_eq!(
        a1.colas().hechos_pendientes(&raiz()),
        0,
        "el escenario no drenó nada: la comparación de abajo no prueba nada"
    );
    assert_eq!(
        resultado_sin, resultado_con,
        "`drenar_reportando` devolvio otro resultado que `drenar` sobre el mismo escenario"
    );
    assert!(
        !vistos.is_empty(),
        "el testigo no se llamo ni una vez, asi que la comparacion de arriba no probo nada"
    );
    assert_eq!(
        a2.colas().hechos_pendientes(&raiz()),
        0,
        "la vuelta con testigo dejo hechos sin drenar: el testigo desvio el lazo"
    );
}

#[test]
fn el_testigo_de_drenar_ve_bajar_hechos_pendientes_y_subir_bytes_pendientes() {
    // IMPORTA PORQUE: a diferencia de `barrer_reportando`, `drenar_reportando` NO puede
    // prometer un total constante — `Observar` recien descubre cuantos bytes hacen falta
    // cuando Savia contesta. Esta prueba fija ese contrato: el total puede SUBIR a mitad
    // de camino (cuando la respuesta trae decisiones `upload`), nunca es menor que lo ya
    // procesado, y termina en «N de N» como cualquier otro cierre.
    let (p, mut a) = escenario();
    // El asentamiento pide ver cada archivo DOS veces: la primera solo anota el
    // candidato (sin hecho), la segunda lo confirma y recien ahi encola el `Aparecio`.
    ciclo::barrer(&raiz(), BarridoId::nuevo("b1"), &p, &mut a, &politica());
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b2"), &p, &mut a, &politica());

    // Antes de drenar: ARCHIVOS altas encoladas, y todavia nadie le pidio bytes a nadie.
    assert_eq!(a.colas().hechos_pendientes(&raiz()), ARCHIVOS as u64);
    assert_eq!(a.colas().bytes_pendientes(&raiz()), 0);

    let servidor = Mini::nuevo(|clave| match clave {
        "POST /sweep/open" => (
            200,
            "{\"sweepId\":\"s-1\",\"padronRequerido\":false}".into(),
        ),
        "POST /presence/observed" => {
            let decisiones = (0..ARCHIVOS)
                .map(|i| {
                    format!(
                        "{{\"path\":\"carpeta/nota-{i}.md\",\"decision\":\"upload\",\"permit\":{{\"url\":\"/upload/p-{i}\",\"contentLengthRange\":[0,1024]}}}}"
                    )
                })
                .collect::<Vec<_>>()
                .join(",");
            (200, format!("{{\"decisions\":[{decisiones}]}}"))
        }
        "POST /upload/completed" => (
            200,
            format!(
                "{{\"verifiedHash\":\"{}\",\"diverged\":false}}",
                "0".repeat(64)
            ),
        ),
        "POST /sweep/close" => (200, "{\"retired\":[],\"frozen\":false}".into()),
        // Los PUT de bytes van cada uno a su propio `/upload/p-N`: la API nunca los toca,
        // y el fallback contesta 200 vacio a cualquiera de los siete.
        _ => (200, String::new()),
    });
    let cliente = Cliente::nuevo(
        BaseDeApi::nueva(&format!("http://127.0.0.1:{}", servidor.puerto)).unwrap(),
        Credencial::SinAutenticar,
        tiempos_del_banco(),
    );
    let mut traza = Vec::new();
    let mut vistos: Vec<(usize, usize)> = Vec::new();
    let resultado = ciclo::drenar_reportando(
        &raiz(),
        &p,
        &mut a,
        &cliente,
        &mut traza,
        &mut |procesados, total| vistos.push((procesados, total)),
    );

    assert!(
        matches!(resultado, ResultadoDelDrenaje::Vacia),
        "el drenaje no termino limpio: {resultado:?}, traza {traza:?}"
    );
    assert!(!vistos.is_empty(), "el testigo no se llamo ni una vez");
    for (i, (procesados, total)) in vistos.iter().enumerate() {
        assert_eq!(
            *procesados,
            i + 1,
            "`procesados` no crece de a uno en la llamada {i}"
        );
        assert!(
            *total >= *procesados,
            "el total quedo por debajo de lo procesado en la llamada {i}: {total} < {procesados}"
        );
    }
    assert!(
        vistos.iter().any(|(_, t)| *t > vistos[0].1),
        "el total nunca subio: si esto pasa, `Observar` dejo de descubrir bytes por subir \
         y el escenario ya no prueba lo que dice probar"
    );
    assert_eq!(
        vistos.last().copied().map(|(p, t)| p == t),
        Some(true),
        "el ultimo aviso no cerro en «N de N»"
    );
    assert_eq!(
        a.colas().hechos_pendientes(&raiz()),
        0,
        "quedaron hechos sin drenar"
    );
    assert_eq!(
        a.colas().bytes_pendientes(&raiz()),
        0,
        "quedaron bytes sin confirmar"
    );
}

#[test]
fn un_trabajo_reintentable_no_mueve_el_contador_de_drenar() {
    // IMPORTA PORQUE: `procesados` cuenta trabajo que de verdad avanzo, no intentos. Un
    // `Reintentable` en el medio del drenaje —la red cae justo al cerrar el barrido, con
    // la apertura y la observacion ya entregadas— no puede sumar al contador: ese trabajo
    // se va a repetir la proxima vuelta, y contarlo ahora mostraria progreso que todavia
    // no paso.
    let (p, mut a) = escenario();
    ciclo::barrer(&raiz(), BarridoId::nuevo("b1"), &p, &mut a, &politica());
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b2"), &p, &mut a, &politica());

    let servidor = Mini::nuevo(|clave| match clave {
        "POST /sweep/open" => (
            200,
            "{\"sweepId\":\"s-1\",\"padronRequerido\":false}".into(),
        ),
        "POST /presence/observed" => {
            let decisiones = (0..ARCHIVOS)
                .map(|i| format!("{{\"path\":\"carpeta/nota-{i}.md\",\"decision\":\"known\"}}"))
                .collect::<Vec<_>>()
                .join(",");
            (200, format!("{{\"decisions\":[{decisiones}]}}"))
        }
        // EL FALLO ESTA ACA: el cierre —el ultimo trabajo del segmento— sale 500.
        "POST /sweep/close" => (500, "{\"error\":\"caida simulada\"}".into()),
        _ => (200, "{}".into()),
    });
    let cliente = Cliente::nuevo(
        BaseDeApi::nueva(&format!("http://127.0.0.1:{}", servidor.puerto)).unwrap(),
        Credencial::SinAutenticar,
        tiempos_del_banco(),
    );
    let mut traza = Vec::new();
    let mut vistos: Vec<(usize, usize)> = Vec::new();
    let resultado = ciclo::drenar_reportando(
        &raiz(),
        &p,
        &mut a,
        &cliente,
        &mut traza,
        &mut |procesados, total| vistos.push((procesados, total)),
    );

    assert!(
        matches!(resultado, ResultadoDelDrenaje::Vacia),
        "un drenaje que corta por reintentable devuelve `Vacia`, no `{resultado:?}`"
    );
    assert_eq!(
        vistos.len(),
        2,
        "el testigo tiene que haber sonado por AbrirBarrido y por Observar, y NINGUNA vez \
         mas: {vistos:?}"
    );
    assert_eq!(
        a.colas().hechos_pendientes(&raiz()),
        ARCHIVOS as u64,
        "el cierre que fallo no puede haber sacado los hechos de la cola: la proxima \
         vuelta tiene que volver a encontrarlos"
    );
}
