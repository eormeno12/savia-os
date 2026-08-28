//! EL DEPOSITO: que lo que sobrevive al proceso sea lo mismo que habia, y que lo que no
//! se entiende falle en vez de parecer vacio.
//!
//! Estas pruebas NO necesitan el simulador: `redb` escribe un archivo temporal y la
//! plataforma es `Falsa`, asi que corren con `cargo test` a secas.

use savia_folder_aplicacion::ciclo;
use savia_folder_contrato::dominio::{BarridoId, RaizId, RutaRelativa, SensibilidadAMayusculas};
use savia_folder_contrato::inventario::Inventario;
use savia_folder_contrato::plataforma::RaizRegistrada;
use savia_folder_contrato::protocolo::Secreto;
use savia_folder_estado::almacen::Almacen;
use savia_folder_estado::colas::{
    Desenlace, MotivoDeDetencion, ParametrosDeCola, Proximo, Trabajo,
};
use savia_folder_persistencia::persistencia::{Deposito, FORMATO, FalloDePersistencia};
use savia_folder_plataforma_falsa::falsa::Falsa;
use savia_folder_politica::salvaguardas::Politica;
use std::time::Duration;

const ASENTAMIENTO: Duration = Duration::from_secs(30);

fn raiz() -> RaizId {
    RaizId::nueva("root-1")
}

fn r(s: &str) -> RutaRelativa {
    RutaRelativa::canonica(s).expect("ruta del banco")
}

fn archivo_temporal(que: &str) -> std::path::PathBuf {
    std::env::temp_dir().join(format!(
        "savia-deposito-{que}-{}.redb",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ))
}

/// Un estado con filas de verdad: dos archivos observados y asentados, o sea filas
/// `Presente` con hash y un hecho encolado por cada una.
fn estado_con_dos_filas() -> Almacen {
    let p = Falsa::como_macos();
    p.poner(
        "contrato.docx",
        b"el contrato marco",
        1_700_000_000,
        Some(1),
    );
    p.poner("sub/informe.xlsx", b"el informe q3", 1_700_000_000, Some(2));

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
    let pol = Politica::con_asentamiento(ASENTAMIENTO).unwrap();
    // Dos vueltas: la primera anota candidatos, la segunda —ya asentada— hashea.
    ciclo::barrer(&raiz(), BarridoId::nuevo("b1"), &p, &mut a, &pol);
    p.avanzar(ASENTAMIENTO + Duration::from_secs(1));
    ciclo::barrer(&raiz(), BarridoId::nuevo("b2"), &p, &mut a, &pol);
    a
}

#[test]
fn el_inventario_y_la_cola_vuelven_del_disco() {
    // IMPORTA PORQUE: sin esto el agente re-reporta el corpus entero en cada arranque y
    // —peor— pierde las lapidas, asi que lo borrado mientras estuvo apagado no lo ve
    // faltar ningun barrido.
    let ruta = archivo_temporal("ida-y-vuelta");
    let antes = estado_con_dos_filas();

    let vivos_antes = antes.inventario().vivos(&raiz());
    let asiento_antes = antes.inventario().asiento(&raiz(), &r("contrato.docx"));
    assert!(vivos_antes > 0, "el estado de prueba tiene que tener filas");

    let d = Deposito::abrir(&ruta).unwrap();
    d.guardar(&antes, None).unwrap();
    drop(d);

    // OTRO `Deposito` SOBRE EL MISMO ARCHIVO, no el mismo objeto: si se reusara la
    // instancia, un `guardar` que solo tocara memoria pasaria igual.
    let d2 = Deposito::abrir(&ruta).unwrap();
    let vuelto = d2.cargar().unwrap().expect("tenia que haber deposito");

    assert_eq!(vuelto.almacen.inventario().vivos(&raiz()), vivos_antes);
    assert_eq!(
        vuelto
            .almacen
            .inventario()
            .asiento(&raiz(), &r("contrato.docx")),
        asiento_antes,
        "la fila tiene que volver igual, con su hash y su observacion"
    );
    assert!(
        vuelto
            .almacen
            .inventario()
            .asiento(&raiz(), &r("sub/informe.xlsx"))
            .is_some(),
        "las rutas con subdirectorio tambien"
    );
    assert!(
        vuelto.almacen.inventario().raiz(&raiz()).is_some(),
        "la raiz enrolada tambien vuelve: sin su huella no se puede verificar identidad"
    );
    let _ = std::fs::remove_file(&ruta);
}

#[test]
fn la_credencial_sobrevive_al_proceso() {
    // IMPORTA PORQUE: sin esto la app de bandeja le pide al usuario que re-vincule el
    // dispositivo en CADA arranque, que es lo contrario exacto de «no hay que hacer nada».
    let ruta = archivo_temporal("credencial");
    let a = estado_con_dos_filas();
    let d = Deposito::abrir(&ruta).unwrap();
    d.guardar(&a, Some(&Secreto("tok-secreto".into()))).unwrap();
    drop(d);

    let d2 = Deposito::abrir(&ruta).unwrap();
    let v = d2.cargar().unwrap().unwrap();
    assert_eq!(
        v.credencial.map(|s| s.0),
        Some("tok-secreto".to_string()),
        "el token tiene que volver"
    );

    // Y GUARDAR SIN CREDENCIAL LA BORRA. Si el token revocado sobreviviera, el proximo
    // arranque volveria a chocar contra un 401 en vez de pedir enrolamiento.
    d2.guardar(&a, None).unwrap();
    assert!(
        d2.cargar().unwrap().unwrap().credencial.is_none(),
        "guardar sin credencial tiene que dejar el deposito sin credencial"
    );
    let _ = std::fs::remove_file(&ruta);
}

#[test]
fn la_detencion_por_credenciales_tambien_sobrevive() {
    // IMPORTA PORQUE: un dispositivo detenido que al reiniciar se cree sano vuelve a
    // golpear la API con un token invalido en cada barrido, quema el rate limit, y deja
    // el panel diciendo «sincronizando» mientras hace dias que no entra nada.
    let ruta = archivo_temporal("detenido");
    let mut a = estado_con_dos_filas();
    // El primer trabajo de un barrido es abrirlo; se le contesta un 401 y con eso alcanza.
    let id = match a.siguiente(&raiz()) {
        Proximo::Trabajo(t) => match *t {
            Trabajo::AbrirBarrido { id, .. } => id,
            otro => panic!("el primer trabajo tiene que ser abrir el barrido: {otro:?}"),
        },
        otro => panic!("se esperaba trabajo, vino {otro:?}"),
    };
    a.resolver(
        &raiz(),
        &id,
        Desenlace::Credenciales("401 del banco".into()),
    );
    assert_eq!(a.colas().detenido(), Some(MotivoDeDetencion::Credenciales));

    let d = Deposito::abrir(&ruta).unwrap();
    d.guardar(&a, None).unwrap();
    drop(d);
    let d2 = Deposito::abrir(&ruta).unwrap();
    assert_eq!(
        d2.cargar().unwrap().unwrap().almacen.colas().detenido(),
        Some(MotivoDeDetencion::Credenciales),
        "la detencion es estado, no una variable de la corrida"
    );
    let _ = std::fs::remove_file(&ruta);
}

#[test]
fn diez_barridos_sin_drenar_no_pesan_mas_que_cuatro() {
    // IMPORTA PORQUE: es el UNICO test que puede acreditar `padron = None` y `cierre =
    // None` en `superar_los_barridos_que_nunca_abrieron`, porque esos dos campos no
    // tienen observable de comportamiento propio -- nada mas en el protocolo depende de
    // su valor. Sin `superar_los_barridos_que_nunca_abrieron`, cada barrido sin drenar
    // deja un segmento `Barrido` atascado con su padron completo —156 MB de eso en el
    // deposito real medido— y el tamano en disco crece LINEAL con la cantidad de vueltas.
    //
    // DOS asserts, por dos razones distintas:
    //
    // 1. El de BYTES, al final, mide el CRECIMIENTO: compara la vuelta 4 contra la 8 (no
    //    contra la 10 -- ver la nota sobre `proximo_id` mas abajo).
    // 2. El ESTRUCTURAL, dentro del lazo, mide el VALOR: en cada vuelta desde la 3 en
    //    mas, inspecciona el segmento superado y exige `padron: null` y `cierre: null`.
    //    Hace falta el segundo porque el primero es CIEGO a un CORRIMIENTO CONSTANTE:
    //    dos puntos dentro de la misma meseta siguen siendo iguales entre si aunque el
    //    segmento superado cargue su padron entero -- solo cambia DONDE se estabiliza la
    //    meseta, no que se estabilice. Verificado a mano: comentando `s.padron = None;`
    //    o `s.cierre = None;` en `colas.rs`, el assert de bytes de abajo sigue en verde
    //    -- unicamente el assert estructural lo detecta.
    //
    // DIAGNOSTICO (bytes exactos sobre este mismo fixture, tomados del propio `println!`
    // que sigue mas abajo -- `cargo test -p savia-folder-persistencia --test persistencia
    // diez_barridos -- --nocapture`):
    //
    //   vuelta:  1     2     3     4     5     6     7     8     9     10
    //   bytes:   1605  1882  2181  2181  2181  2181  2181  2181  2182  2183
    //
    // El peso se estabiliza en la VUELTA 3 —la primera vez que un barrido supera al
    // anterior, en cuanto se abre b3— y se mantiene CONSTANTE de ahi en mas: queda un
    // `Eventos` superado con los dos hechos del asentamiento (nunca se drena nada en
    // este test, asi que ese segmento no se puede podar) mas el barrido actual, recien
    // cerrado y sin hechos propios (el corpus no vuelve a cambiar).
    //
    // Las vueltas 9 y 10 SUBEN un byte cada una, y no es la fuga: es `Colas::proximo_id`
    // —un contador de proposito general, ajeno a este arreglo— cruzando de un digito a
    // dos (9 -> 10 -> 11) en el JSON. Por eso la comparacion de bytes usa la vuelta 4 y
    // la vuelta 8: las dos caen DENTRO de la meseta y ninguna cruza ese borde de digitos,
    // asi que la igualdad exacta prueba la fuga de segmentos y no un artefacto de
    // formato de otro contador.
    let p = Falsa::como_macos();
    p.poner(
        "contrato.docx",
        b"el contrato marco",
        1_700_000_000,
        Some(1),
    );
    p.poner("sub/informe.xlsx", b"el informe q3", 1_700_000_000, Some(2));
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
    let pol = Politica::con_asentamiento(ASENTAMIENTO).unwrap();

    // `{n:02}` para que "b04" y "b10" pesen lo MISMO en JSON: sin el padding, comparar
    // la vuelta 4 contra la 10 fallaria por un byte que no tiene nada que ver con la
    // fuga que este test mide.
    let mut peso_en = std::collections::BTreeMap::new();
    for n in 1..=10u32 {
        ciclo::barrer(
            &raiz(),
            BarridoId::nuevo(format!("b{n:02}")),
            &p,
            &mut a,
            &pol,
        );
        p.avanzar(ASENTAMIENTO + Duration::from_secs(1));
        let peso = serde_json::to_string(&a.para_guardar()).unwrap().len();
        println!("vuelta {n}: {peso} bytes"); // diagnostico: confirma la meseta en la 3
        peso_en.insert(n, peso);

        if n >= 3 {
            // Estructural: desde la vuelta en que el primer barrido queda superado,
            // tiene que haber EXACTAMENTE dos segmentos -- el `Eventos` superado (con
            // los hechos del asentamiento, que por eso no se poda) y el barrido de esta
            // vuelta -- y el superado tiene que tener `padron` y `cierre` en `null`.
            let valor = serde_json::to_value(a.para_guardar()).unwrap();
            let segmentos = valor["colas"]["segmentos"]
                .as_array()
                .expect("colas.segmentos tiene que ser un arreglo");
            assert_eq!(
                segmentos.len(),
                2,
                "vuelta {n}: se esperaban 2 segmentos (el Eventos superado + el \
                 barrido de esta vuelta), quedaron {}: {segmentos:#?}",
                segmentos.len()
            );
            let superado = segmentos
                .iter()
                .find(|s| s["origen"] == serde_json::json!("Eventos"))
                .unwrap_or_else(|| {
                    panic!("vuelta {n}: no hay ningun segmento Eventos: {segmentos:#?}")
                });
            assert!(
                superado["padron"].is_null(),
                "vuelta {n}: el segmento superado tiene que liberar su padron \
                 (`s.padron = None`), y no lo hizo: {superado:#?}"
            );
            assert!(
                superado["cierre"].is_null(),
                "vuelta {n}: el segmento superado tiene que perder su `cierre` \
                 (`s.cierre = None`) -- es evidencia de un borde que Savia nunca vio: \
                 {superado:#?}"
            );
            assert_eq!(
                superado["apertura_entregada"],
                serde_json::json!(true),
                "vuelta {n}: un segmento superado no espera mas su apertura: {superado:#?}"
            );
            assert_eq!(
                superado["cierre_entregado"],
                serde_json::json!(true),
                "vuelta {n}: un segmento superado no espera mas su cierre: {superado:#?}"
            );
            assert!(
                !superado["hechos"]
                    .as_object()
                    .expect("hechos tiene que ser un objeto")
                    .is_empty(),
                "vuelta {n}: el segmento superado tiene que conservar los hechos del \
                 asentamiento -- supersesion no puede perder trabajo: {superado:#?}"
            );
        }
    }

    assert_eq!(
        peso_en[&4], peso_en[&8],
        "sin drenar nada, el peso tiene que quedar CONSTANTE desde que el primer \
         barrido supera al anterior, no crecer uno por vuelta: {peso_en:?}"
    );
}

#[test]
fn un_deposito_vacio_es_none_y_no_error() {
    let ruta = archivo_temporal("vacio");
    let d = Deposito::abrir(&ruta).unwrap();
    assert!(
        d.cargar().unwrap().is_none(),
        "la primera corrida no es un error"
    );
    let _ = std::fs::remove_file(&ruta);
}

#[test]
fn un_deposito_corrupto_es_error_y_no_deposito_vacio() {
    // **LA MAS IMPORTANTE DE ESTE ARCHIVO.** Absorber un deposito ilegible como «arranco
    // de cero» es la falla silenciosa peor que hay: el agente reporta el corpus entero
    // como nuevo y —porque no tiene lapidas— no ve faltar NADA de lo que se borro. Un
    // error de formato se convertiria en documentos vigentes para siempre.
    let ruta = archivo_temporal("corrupto");
    let a = estado_con_dos_filas();
    let d = Deposito::abrir(&ruta).unwrap();
    d.guardar(&a, None).unwrap();
    drop(d);

    // Se pisa el estado con basura, dejando la version de formato intacta: es el caso
    // realista —el archivo se trunco, o un bug escribio otra cosa— y no un archivo ajeno.
    {
        let db = redb::Database::open(&ruta).unwrap();
        let t = db.begin_write().unwrap();
        {
            let tabla: redb::TableDefinition<&str, &[u8]> = redb::TableDefinition::new("almacen");
            let mut tb = t.open_table(tabla).unwrap();
            tb.insert("estado", &b"{esto no es el estado"[..]).unwrap();
        }
        t.commit().unwrap();
    }

    let d2 = Deposito::abrir(&ruta).unwrap();
    match d2.cargar() {
        Err(FalloDePersistencia::Corrupto(_)) => {}
        Ok(None) => panic!(
            "un deposito ilegible NO puede parecer vacio: se reportaria el corpus entero como nuevo y se perderian todas las lapidas"
        ),
        otro => panic!(
            "se esperaba Corrupto, vino {otro:?}",
            otro = otro.map(|_| "Ok(Some(..))")
        ),
    }
    let _ = std::fs::remove_file(&ruta);
}

#[test]
fn un_deposito_de_otro_formato_es_error_y_no_se_absorbe() {
    let ruta = archivo_temporal("formato");
    let a = estado_con_dos_filas();
    let d = Deposito::abrir(&ruta).unwrap();
    d.guardar(&a, None).unwrap();
    drop(d);
    {
        let db = redb::Database::open(&ruta).unwrap();
        let t = db.begin_write().unwrap();
        {
            let tabla: redb::TableDefinition<&str, &[u8]> = redb::TableDefinition::new("almacen");
            let mut tb = t.open_table(tabla).unwrap();
            tb.insert("formato", &(FORMATO + 1).to_be_bytes()[..])
                .unwrap();
        }
        t.commit().unwrap();
    }
    let d2 = Deposito::abrir(&ruta).unwrap();
    assert!(
        matches!(d2.cargar(), Err(FalloDePersistencia::FormatoAjeno { .. })),
        "un formato ajeno tiene que parar el arranque, no leerse a medias"
    );
    let _ = std::fs::remove_file(&ruta);
}

/// **EL GOLDEN DEL FORMATO, Y ES LO QUE PAGA POR NO HABER ESCRITO ESPEJOS A MANO.**
///
/// El formato en disco sale de los tipos del dominio via `derive`, que es barato y deja
/// una trampa: renombrar un campo cambia el formato SIN QUE NADA AVISE, y un agente
/// actualizado no lee lo que escribio el anterior — que en este canal significa reportar
/// el corpus entero como nuevo y perder todas las lapidas.
///
/// Este archivo fija los bytes. Si cambia, la pregunta no es «actualizo el golden» sino
/// «subo `FORMATO` y escribo la migracion». Para regenerarlo a proposito:
///
/// ```text
///   GOLDEN=reescribir cargo test --test persistencia el_formato_en_disco
/// ```
#[test]
fn el_formato_en_disco_esta_fijado() {
    let a = estado_con_dos_filas();
    let actual = serde_json::to_string_pretty(&a.para_guardar()).unwrap() + "\n";
    let golden = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/golden/estado.json");

    if std::env::var("GOLDEN").as_deref() == Ok("reescribir") {
        std::fs::write(&golden, &actual).unwrap();
        return;
    }
    let esperado = std::fs::read_to_string(&golden).unwrap_or_else(|e| {
        panic!("no se pudo leer el golden ({e}). Para crearlo: GOLDEN=reescribir cargo test --test persistencia el_formato_en_disco")
    });
    assert_eq!(
        actual, esperado,
        "\nEL FORMATO EN DISCO CAMBIO. Un agente actualizado no va a poder leer lo que \
         escribio el anterior: se reportaria el corpus entero como nuevo y se perderian \
         las lapidas de todo lo borrado. Si el cambio es a proposito, sube `FORMATO` y \
         escribi la migracion; recien despues regenera con \
         `GOLDEN=reescribir cargo test --test persistencia el_formato_en_disco`.\n"
    );
}
