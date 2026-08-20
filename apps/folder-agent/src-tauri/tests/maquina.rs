//! EL BANCO DE LA MAQUINA. El arbol de decision contra puertos falsos, **sin tocar el
//! disco y sin dormir la laptop**: el reloj de `Falsa` se mueve a mano, incluyendo
//! saltos que imitan una suspension.
//!
//! Cada afirmacion dice QUE prueba y POR QUE importa —al estilo de
//! `apps/folder-agent/sim/ejercicio.ts`—, porque una prueba que no dice que rompe si
//! falla es una prueba que alguien borra cuando molesta.

use savia_folder_nucleo::almacen::Almacen;
use savia_folder_nucleo::ciclo;
use savia_folder_nucleo::colas::{
    Decision, ParametrosDeCola, Permiso, PermisoId, Proximo, RangoDeTamano, Recibido, Trabajo,
    Veredicto, aparicion,
};
use savia_folder_nucleo::dominio::{
    BarridoId, EstadoDelBarrido, HashVerificado, Instante, RaizId, Reloj, RutaRelativa,
    SensibilidadAMayusculas,
};
use savia_folder_nucleo::inventario::Inventario;
use savia_folder_nucleo::maquina::{self, Nodo, OrigenDeSenal, Senal};
use savia_folder_nucleo::plataforma::{Falsa, Plataforma, RaizRegistrada, RelojDePlataforma};
use savia_folder_nucleo::salvaguardas::{self, Hecho, Politica};
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

/// Barre y ademas CONFIRMA todo contra un servidor de mentira, para que las filas queden
/// con hash verificado — que es lo unico que despues puede viajar en una baja.
fn barrer_y_confirmar(p: &Falsa, a: &mut Almacen, n: u32) {
    let barrido = BarridoId::nuevo(format!("b{n}"));
    ciclo::barrer(&raiz(), barrido, p, a, &politica());
    confirmar_todo(a);
}

fn confirmar_todo(a: &mut Almacen) {
    loop {
        let Proximo::Trabajo(t) = a.siguiente(&raiz()) else {
            return;
        };
        let (id, recibido) = match *t {
            Trabajo::AbrirBarrido { id, .. } => (
                id,
                Recibido::Barrido {
                    sweep: savia_folder_nucleo::colas::SweepId("sweep-1".into()),
                    padron_requerido: false,
                },
            ),
            // El servidor de mentira acusa recibo del padron como el de verdad: sin
            // cuerpo. Ningun test de este archivo lo dispara —ninguno pide el padron—
            // pero el driver hace de servidor y un servidor lo contesta.
            Trabajo::EnviarPadron { id, .. } => (id, Recibido::Nada),
            Trabajo::Observar { id, entradas, .. } => {
                let vs = entradas
                    .into_iter()
                    .map(|(ruta, afirmado)| Veredicto {
                        ruta,
                        afirmado,
                        // `known` es una de las tres puertas del verificado, y es
                        // legitima: una coincidencia solo puede direccionar un objeto
                        // que ese lado YA escribio y YA verifico.
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
        a.resolver(
            &raiz(),
            &id,
            savia_folder_nucleo::colas::Desenlace::Entregado(recibido),
        );
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// 1 · UN MOVIMIENTO NO REPORTA BAJA
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn un_movimiento_no_reporta_baja_ni_cuesta_una_enumeracion_por_archivo() {
    // IMPORTA PORQUE: mover un archivo de carpeta le costaria al usuario la mitad del
    // valor de su memoria — Savia retira el documento de A con sus `ElementId` y su
    // indice de reconciliacion, y crea uno nuevo en B: re-agregar deja de ser una
    // edicion y pasa a ser una primera ingesta, con el `selladoEn` movido a hoy.
    let p = Falsa::como_macos();
    p.poner("a/contrato.docx", b"el contrato", 100, Some(1));
    let mut a = almacen();

    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 1);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 2);
    assert_eq!(
        a.inventario().vivos(&raiz()),
        1,
        "el archivo entro al inventario"
    );

    // El movimiento: MISMOS bytes, ruta nueva.
    p.sacar("a/contrato.docx");
    p.poner("b/contrato.docx", b"el contrato", 100, Some(1));
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    p.reiniciar_contadores();

    let barrido = BarridoId::nuevo("b3");
    let resumen = ciclo::barrer(&raiz(), barrido, &p, &mut a, &politica());

    assert_eq!(
        resumen.bajas, 0,
        "un hash que reaparece en una ruta NUEVA del arbol es un MOVIMIENTO y muere en el agente"
    );
    let mut hubo_baja = false;
    while let Proximo::Trabajo(t) = a.siguiente(&raiz()) {
        if let Trabajo::Desvanecer { entradas, .. } = &*t {
            hubo_baja = !entradas.is_empty();
        }
        let id = match &*t {
            Trabajo::AbrirBarrido { id, .. }
            | Trabajo::Observar { id, .. }
            | Trabajo::Desvanecer { id, .. }
            | Trabajo::EnviarPadron { id, .. }
            | Trabajo::CerrarBarrido { id, .. }
            | Trabajo::Subir { id, .. }
            | Trabajo::ConfirmarSubida { id, .. } => id.clone(),
        };
        let recibido = match &*t {
            Trabajo::AbrirBarrido { .. } => Recibido::Barrido {
                sweep: savia_folder_nucleo::colas::SweepId("s".into()),
                padron_requerido: false,
            },
            Trabajo::Observar { entradas, .. } => Recibido::Decisiones(
                entradas
                    .iter()
                    .map(|(ruta, af)| Veredicto {
                        ruta: ruta.clone(),
                        afirmado: *af,
                        decision: Decision::Known {
                            verificado: HashVerificado::rehidratar_del_inventario(*af.bytes()),
                        },
                    })
                    .collect(),
            ),
            _ => Recibido::Nada,
        };
        a.resolver(
            &raiz(),
            &id,
            savia_folder_nucleo::colas::Desenlace::Entregado(recibido),
        );
    }
    assert!(
        !hubo_baja,
        "ninguna `presence.vanished` sale de la cola: el movimiento no llega nunca al servidor"
    );
}

#[test]
fn move_va_antes_que_root_asi_que_un_movimiento_no_cuesta_un_sondeo_de_raiz() {
    // IMPORTA PORQUE: consultar la raiz antes de MOVE convierte cada archivo faltante en
    // una enumeracion del arbol. En «se desmonto el disco» son 40.000 recorridos de un
    // arbol que no esta.
    let p = Falsa::como_macos();
    p.poner("a/x.txt", b"contenido", 100, Some(1));
    let mut a = almacen();
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 1);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 2);

    p.sacar("a/x.txt");
    p.poner("b/x.txt", b"contenido", 100, Some(1));
    p.avanzar(ASENTAMIENTO_DEL_BANCO);

    // El destino se procesa primero (orden canonico: "a/x.txt" < "b/x.txt" no aplica,
    // asi que se fuerza la senal suelta sobre el origen con el destino ya dado de alta).
    let barrido = BarridoId::nuevo("b3");
    let (_s, _t) = a.abrir_barrido(&raiz(), barrido.clone());
    let reloj = RelojDePlataforma(&p);
    // El destino se procesa primero. La tripleta es la MISMA —mismo tamano, mismo mtime,
    // mismo `fileId`— asi que se reconoce como movimiento SIN LEER UN BYTE.
    p.reiniciar_contadores();
    let paso = maquina::decidir(
        &Senal {
            raiz: raiz(),
            ruta: r("b/x.txt"),
            origen: OrigenDeSenal::TurnoDelBarrido,
        },
        Some(&barrido),
        &p,
        a.inventario(),
        &reloj,
        &politica(),
    );
    assert!(
        matches!(paso.nodo, Nodo::Movimiento { .. }),
        "el destino de un movimiento es MOV, no un alta: salio {:?}",
        paso.nodo
    );
    assert_eq!(
        p.lecturas(),
        0,
        "«renombrar y mover cuestan CERO I/O»: mover una carpeta de 2 GB no puede costar leer 2 GB"
    );
    assert!(paso.hecho.is_none(), "y no llega nunca al servidor");
    a.marcar_vista(&raiz(), &r("b/x.txt"), &barrido);
    a.comprometer(&raiz(), Some(&barrido), paso);

    // Y el origen, ya reubicada su fila, no tiene contra que compararse: ni baja, ni
    // sondeo de la raiz.
    p.reiniciar_contadores();
    let paso = maquina::decidir(
        &Senal {
            raiz: raiz(),
            ruta: r("a/x.txt"),
            origen: OrigenDeSenal::TurnoDelBarrido,
        },
        Some(&barrido),
        &p,
        a.inventario(),
        &reloj,
        &politica(),
    );
    assert!(paso.hecho.is_none(), "el origen no produce una baja");
    assert_eq!(
        p.sondeos_de_raiz(),
        0,
        "MOVE va ANTES que ROOT: un movimiento no puede costar una enumeracion"
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// 2 · UNA RAIZ MUERTA NO REPORTA BAJA
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn una_raiz_muerta_no_reporta_ni_una_baja() {
    // IMPORTA PORQUE: un disco desmontado produce EXACTAMENTE el mismo conjunto de
    // ausencias que un borrado masivo. Con el retiro silencioso, el usuario perderia de
    // la busqueda todo lo que habia en ese disco sin que nadie le pregunte nada.
    let p = Falsa::como_macos();
    for i in 0..5 {
        p.poner(
            &format!("f{i}.txt"),
            format!("contenido {i}").as_bytes(),
            100,
            Some(i as u128),
        );
    }
    let mut a = almacen();
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 1);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 2);
    assert_eq!(a.inventario().vivos(&raiz()), 5);

    // El disco se desmonta: la enumeracion falla.
    p.desmontar();
    let resumen = ciclo::barrer(&raiz(), BarridoId::nuevo("b3"), &p, &mut a, &politica());

    assert_eq!(
        resumen.bajas, 0,
        "NINGUNA baja con la raiz ausente, sin importar cuantas"
    );
    assert_eq!(
        resumen.cierre,
        Some(EstadoDelBarrido::Interrumpido),
        "y el barrido cierra INTERRUMPIDO: un cierre completo le daria a la cuarentena la evidencia que le falta"
    );
}

#[test]
fn una_raiz_suplantada_cuenta_como_no_viva() {
    // IMPORTA PORQUE: es el caso peor. El volumen no monto y quedo, en el mismo path, un
    // directorio VACIO haciendo de suplente. Un `stat` da exito y la enumeracion da cero
    // archivos: sin comparar identidad, se reportan las bajas de todo el disco de golpe.
    use savia_folder_nucleo::dominio::IdDeArchivoDelSO;
    use savia_folder_nucleo::plataforma::{EvidenciaDeRaiz, IdDeVolumen, ResultadoDeEnumeracion};

    let p = Falsa::como_macos();
    p.poner("f.txt", b"algo", 100, Some(1));
    let mut a = almacen();
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 1);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 2);

    // Mismo path, se enumera perfecto, y es OTRO volumen y OTRO directorio.
    p.sacar("f.txt");
    p.forzar_evidencia(EvidenciaDeRaiz {
        enumeracion: ResultadoDeEnumeracion::Listada {
            entradas: Vec::new(),
            errores: Vec::new(),
        },
        volumen: Some(IdDeVolumen::Uuid([99u8; 16])),
        directorio: Some(IdDeArchivoDelSO(42)),
    });
    let resumen = ciclo::barrer(&raiz(), BarridoId::nuevo("b3"), &p, &mut a, &politica());
    assert_eq!(resumen.bajas, 0, "`Suplantada` NO es viva");
    assert_eq!(resumen.cierre, Some(EstadoDelBarrido::Interrumpido));
}

#[test]
fn identidad_de_volumen_ilegible_nunca_da_viva() {
    // IMPORTA PORQUE: `IdDeVolumen` no deriva `PartialEq` justamente para que dos
    // `NoPublicada` no comparen iguales. Si compararan, un directorio suplente sobre otro
    // volumen sin UUID pasaria la salvaguarda 2 entera.
    use savia_folder_nucleo::dominio::IdDeArchivoDelSO;
    use savia_folder_nucleo::plataforma::{EvidenciaDeRaiz, IdDeVolumen, ResultadoDeEnumeracion};
    let evidencia = EvidenciaDeRaiz {
        enumeracion: ResultadoDeEnumeracion::Listada {
            entradas: Vec::new(),
            errores: Vec::new(),
        },
        volumen: Some(IdDeVolumen::NoPublicada {
            fstype: "smbfs".into(),
        }),
        directorio: Some(IdDeArchivoDelSO(1)),
    };
    let estado = salvaguardas::raiz_viva(&registrada(), &evidencia);
    assert!(
        !estado.permite_reportar_bajas(),
        "ausencia de evidencia no es evidencia: una raiz cuya identidad no se puede leer no reporta bajas"
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// 3 · UN ARCHIVO SIN ASENTAR NO SE REPORTA
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn un_archivo_sin_asentar_no_se_reporta_y_no_se_lee() {
    // IMPORTA PORQUE: sin asentamiento, cada `Cmd+S` en Word manda un par baja/alta al
    // servidor, y cada alta es un hash del archivo entero. En un `.pptx` de 200 MB son
    // segundos de CPU y de disco POR PULSACION.
    let p = Falsa::como_macos();
    p.poner("informe.xlsx", b"a medio guardar", 100, Some(1));
    let a = almacen();
    let reloj = RelojDePlataforma(&p);

    let paso = maquina::decidir(
        &Senal {
            raiz: raiz(),
            ruta: r("informe.xlsx"),
            origen: OrigenDeSenal::TurnoDelBarrido,
        },
        Some(&BarridoId::nuevo("b1")),
        &p,
        a.inventario(),
        &reloj,
        &politica(),
    );
    assert!(paso.hecho.is_none(), "no asentado ⇒ NINGUN hecho");
    assert_eq!(
        p.lecturas(),
        0,
        "no asentado ⇒ CERO lecturas: no se hashea a medio guardar"
    );
    match paso.nodo {
        Nodo::Esperando { reintentar_en } => assert!(
            reintentar_en > Duration::ZERO,
            "WAIT tiene que decir CUANDO volver: sin eso, un archivo guardado una sola vez queda invisible hasta el proximo barrido completo"
        ),
        otro => panic!("se esperaba WAIT, salio {otro:?}"),
    }
}

#[test]
fn la_primera_mirada_nunca_asienta_por_temprana_que_sea() {
    // IMPORTA PORQUE: hacen falta DOS observaciones con la misma tripleta separadas por
    // el intervalo. Con una sola, «estable» significaria «lo vi una vez».
    let p = Falsa::como_macos();
    p.poner("x.txt", b"algo", 100, Some(1));
    let a = almacen();
    let reloj = RelojDePlataforma(&p);
    p.avanzar(Duration::from_secs(3600));
    let paso = maquina::decidir(
        &Senal {
            raiz: raiz(),
            ruta: r("x.txt"),
            origen: OrigenDeSenal::TurnoDelBarrido,
        },
        Some(&BarridoId::nuevo("b1")),
        &p,
        a.inventario(),
        &reloj,
        &politica(),
    );
    assert!(matches!(paso.nodo, Nodo::Esperando { .. }));
    assert_eq!(p.lecturas(), 0);
}

#[test]
fn el_asentamiento_no_toca_la_rama_de_las_bajas() {
    // IMPORTA PORQUE: con el asentamiento sobre las bajas, la cuarentena efectiva pasa a
    // ser `asentamiento + ventana`, un numero que nadie eligio, repartido entre dos
    // duenos y dos maquinas. Y peor: se mandaria `sweep.close(completo)` mientras el
    // agente todavia retiene hechos de ese barrido, que destruye justo lo que ese cierre
    // prueba.
    //
    // Se barre el parametro por todo su rango y se exige que el `Paso` de la rama
    // `NoExiste` no se mueva ni un bit.
    let mut pasos = Vec::new();
    for intervalo in [
        Duration::from_secs(1),
        Duration::from_secs(30),
        Duration::from_secs(3600),
        Duration::from_secs(86_400),
    ] {
        let p = Falsa::como_macos();
        p.poner("x.txt", b"algo", 100, Some(1));
        let mut a = almacen();
        p.avanzar(Duration::from_secs(86_400 * 2));
        barrer_y_confirmar(&p, &mut a, 1);
        p.avanzar(Duration::from_secs(86_400 * 2));
        barrer_y_confirmar(&p, &mut a, 2);
        p.sacar("x.txt");

        let barrido = BarridoId::nuevo("b3");
        let reloj = RelojDePlataforma(&p);
        let paso = maquina::decidir(
            &Senal {
                raiz: raiz(),
                ruta: r("x.txt"),
                origen: OrigenDeSenal::TurnoDelBarrido,
            },
            Some(&barrido),
            &p,
            a.inventario(),
            &reloj,
            &Politica::con_asentamiento(intervalo).unwrap(),
        );
        assert_eq!(
            paso.nodo,
            Nodo::Desaparecio,
            "la baja sale igual, con cualquier intervalo"
        );
        pasos.push(paso);
    }
    let primero = &pasos[0];
    for otro in &pasos[1..] {
        assert_eq!(
            primero, otro,
            "el `Paso` de la rama de las bajas es identico para todo el rango del asentamiento"
        );
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// 4 · UN DESHIDRATADO NO SE LEE NI SE REPORTA AUSENTE
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn un_deshidratado_no_se_lee_ni_se_reporta_ausente() {
    // IMPORTA PORQUE: en macOS no hay forma de leer sin materializar. Un OneDrive o un
    // iCloud de 400 GB baja entero, en la conexion del usuario, en silencio y sin un solo
    // error: PARECE QUE FUNCIONA. Es el error mas caro del nucleo.
    //
    // Y el caso es el PEOR a proposito: la tripleta CAMBIO —el placeholder queda en 0
    // bytes— asi que un arbol que preguntara la hidratacion despues de comparar seguiria
    // derecho a HASH.
    let p = Falsa::como_macos();
    p.poner("nube.pptx", b"doscientos megas", 100, Some(1));
    let mut a = almacen();
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 1);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 2);

    // OneDrive lo desaloja: mismo nombre, 0 bytes, marcado.
    p.poner_deshidratado("nube.pptx", 200, Some(1));
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    p.reiniciar_contadores();

    let reloj = RelojDePlataforma(&p);
    let paso = maquina::decidir(
        &Senal {
            raiz: raiz(),
            ruta: r("nube.pptx"),
            origen: OrigenDeSenal::TurnoDelBarrido,
        },
        Some(&BarridoId::nuevo("b3")),
        &p,
        a.inventario(),
        &reloj,
        &politica(),
    );
    assert_eq!(
        paso.nodo,
        Nodo::Omitido,
        "DEHY va ANTES que SAME, no solo antes que HASH"
    );
    assert_eq!(
        p.lecturas(),
        0,
        "CERO lecturas sobre un deshidratado, con la tripleta cambiada"
    );
    assert!(
        paso.hecho.is_none(),
        "y deshidratado NO ES AUSENTE: no sale ninguna baja"
    );
}

#[test]
fn la_hidratacion_desconocida_se_resuelve_como_no_se_abre() {
    // IMPORTA PORQUE: colapsar `Desconocida` a `Materializado` es lo que descarga el
    // drive entero. El costo de equivocarse hacia el otro lado es que un archivo espere.
    use savia_folder_nucleo::plataforma::Hidratacion;
    assert!(!salvaguardas::se_puede_abrir(Hidratacion::Desconocida));
    assert!(!salvaguardas::se_puede_abrir(Hidratacion::Deshidratado));
    assert!(salvaguardas::se_puede_abrir(Hidratacion::Materializado));
}

#[test]
fn un_deshidratado_enumerado_no_entra_al_conjunto_de_ausencias() {
    // IMPORTA PORQUE: la salvaguarda 5 tiene que llegar hasta el final del recorrido, no
    // solo hasta el `open`. Un deshidratado se registra como PRESENTE y sin hash nuevo.
    let p = Falsa::como_macos();
    p.poner("nube.pptx", b"contenido", 100, Some(1));
    let mut a = almacen();
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 1);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 2);

    p.poner_deshidratado("nube.pptx", 200, Some(1));
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    let resumen = ciclo::barrer(&raiz(), BarridoId::nuevo("b3"), &p, &mut a, &politica());
    assert_eq!(resumen.omitidos_por_deshidratacion, 1);
    assert_eq!(resumen.bajas, 0, "sigue estando: no es una baja");
    assert_eq!(resumen.cierre, Some(EstadoDelBarrido::Completo));
}

// ══════════════════════════════════════════════════════════════════════════════
// 5 · EL ORDEN desaparecio → aparecio SE CONSERVA POR RAIZ
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn el_orden_desaparecio_aparecio_se_conserva_por_raiz() {
    // IMPORTA PORQUE: `desaparecio(P,H1)` seguido de `aparecio(P,H2)` es una EDICION.
    // Entregado al reves es el borrado de la version nueva: a Savia le llega la aparicion
    // antes que la baja, retira el documento RECIEN EDITADO, y al usuario le desaparece
    // de la busqueda el archivo que acaba de guardar.
    //
    // Los dos hechos van en SEGMENTOS distintos —la compactacion no cruza un borde de
    // barrido— y el drenaje respeta el orden de apertura por raiz.
    let p = Falsa::como_macos();
    p.poner("informe.xlsx", b"version vieja", 100, Some(1));
    let mut a = almacen();
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 1);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 2);

    // Barrido 3: el archivo se fue. Sale la BAJA.
    p.sacar("informe.xlsx");
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    let r3 = ciclo::barrer(&raiz(), BarridoId::nuevo("b3"), &p, &mut a, &politica());
    assert_eq!(
        r3.bajas, 1,
        "la baja sale: la raiz esta viva y el contenido no reaparece"
    );

    // Barrido 4 y 5: vuelve con OTRO contenido. Sale el ALTA, en otro segmento.
    p.poner("informe.xlsx", b"version nueva", 300, Some(2));
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b4"), &p, &mut a, &politica());
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b5"), &p, &mut a, &politica());

    // Se drena todo y se anota el orden en que los dos hechos salen.
    let mut orden = Vec::new();
    while let Proximo::Trabajo(t) = a.siguiente(&raiz()) {
        let id = match &*t {
            Trabajo::AbrirBarrido { id, .. }
            | Trabajo::Observar { id, .. }
            | Trabajo::Desvanecer { id, .. }
            | Trabajo::EnviarPadron { id, .. }
            | Trabajo::CerrarBarrido { id, .. }
            | Trabajo::Subir { id, .. }
            | Trabajo::ConfirmarSubida { id, .. } => id.clone(),
        };
        let recibido = match &*t {
            Trabajo::AbrirBarrido { .. } => Recibido::Barrido {
                sweep: savia_folder_nucleo::colas::SweepId("s".into()),
                padron_requerido: false,
            },
            Trabajo::Observar { entradas, .. } => {
                for (ruta, _) in entradas {
                    orden.push(format!("aparecio {}", ruta.como_str()));
                }
                Recibido::Decisiones(
                    entradas
                        .iter()
                        .map(|(ruta, af)| Veredicto {
                            ruta: ruta.clone(),
                            afirmado: *af,
                            decision: Decision::Known {
                                verificado: HashVerificado::rehidratar_del_inventario(*af.bytes()),
                            },
                        })
                        .collect(),
                )
            }
            Trabajo::Desvanecer { entradas, .. } => {
                for (ruta, _) in entradas {
                    orden.push(format!("desaparecio {}", ruta.como_str()));
                }
                Recibido::Nada
            }
            _ => Recibido::Nada,
        };
        a.resolver(
            &raiz(),
            &id,
            savia_folder_nucleo::colas::Desenlace::Entregado(recibido),
        );
    }

    let i_baja = orden
        .iter()
        .position(|x| x.starts_with("desaparecio informe"));
    let i_alta = orden
        .iter()
        .enumerate()
        .filter(|(_, x)| x.starts_with("aparecio informe"))
        .map(|(i, _)| i)
        .next_back();
    let (Some(i_baja), Some(i_alta)) = (i_baja, i_alta) else {
        panic!("faltan hechos: {orden:?}");
    };
    assert!(
        i_baja < i_alta,
        "la BAJA sale antes que el ALTA de la version nueva. orden observado: {orden:?}"
    );
}

#[test]
fn la_compactacion_no_cruza_un_borde_de_barrido() {
    // IMPORTA PORQUE: si una baja migrara al segmento siguiente, el `sweep.close(complete)`
    // del segmento donde ya no esta le dice a Savia «barri entero y ese archivo estaba».
    // Es evidencia FABRICADA sobre la unica pregunta que la cuarentena hace.
    use savia_folder_nucleo::colas::{Colas, SegmentoId};
    let mut c = Colas::nuevas(ParametrosDeCola {
        max_intentos: None,
        max_entradas_por_lote: None,
    });
    let raiz = raiz();
    let s1: SegmentoId = c.abrir_barrido(&raiz, BarridoId::nuevo("b1"), 1);
    let h = savia_folder_nucleo::hash::sha256(b"v1");
    c.encolar(&raiz, aparicion(r("x.txt"), h));
    c.cerrar_barrido(s1, EstadoDelBarrido::Completo);

    let s2 = c.abrir_barrido(&raiz, BarridoId::nuevo("b2"), 1);
    let h2 = savia_folder_nucleo::hash::sha256(b"v2");
    c.encolar(&raiz, aparicion(r("x.txt"), h2));
    c.cerrar_barrido(s2, EstadoDelBarrido::Completo);

    assert_eq!(
        c.hechos_pendientes(&raiz),
        2,
        "los dos sobreviven: la compactacion deja uno por ruta DENTRO de un segmento, nunca a traves del borde"
    );
}

#[test]
fn la_compactacion_deja_uno_por_ruta_dentro_del_segmento() {
    // IMPORTA PORQUE: es lo que vuelve legal batchear `presence.observed`. Sin dos hechos
    // sobre la misma ruta en un lote, el orden dentro del lote no significa nada. Y es
    // seguro porque los bytes de las versiones intermedias YA NO EXISTEN en ningun lado.
    use savia_folder_nucleo::colas::{Colas, Encolado};
    let mut c = Colas::nuevas(ParametrosDeCola {
        max_intentos: None,
        max_entradas_por_lote: None,
    });
    let raiz = raiz();
    let s = c.abrir_barrido(&raiz, BarridoId::nuevo("b1"), 1);
    assert_eq!(
        c.encolar(
            &raiz,
            aparicion(r("x.txt"), savia_folder_nucleo::hash::sha256(b"v1"))
        ),
        Encolado::Nuevo
    );
    assert_eq!(
        c.encolar(
            &raiz,
            aparicion(r("x.txt"), savia_folder_nucleo::hash::sha256(b"v2"))
        ),
        Encolado::Compactado
    );
    c.cerrar_barrido(s, EstadoDelBarrido::Completo);
    assert_eq!(c.hechos_pendientes(&raiz), 1);
}

#[test]
fn los_hechos_van_antes_que_los_bytes() {
    // IMPORTA PORQUE: subir bytes antes de terminar de drenar hechos convierte una semana
    // desconectado en un backlog de subida de archivos que ya no estan o que Savia ya
    // tiene — y en muchos casos que SOLO SE MOVIERON.
    use savia_folder_nucleo::colas::{Colas, Desenlace, TrabajoId};
    let mut c = Colas::nuevas(ParametrosDeCola {
        max_intentos: None,
        max_entradas_por_lote: None,
    });
    let raiz = raiz();
    let s1 = c.abrir_barrido(&raiz, BarridoId::nuevo("b1"), 1);
    c.encolar(
        &raiz,
        aparicion(r("a.txt"), savia_folder_nucleo::hash::sha256(b"a")),
    );
    c.cerrar_barrido(s1, EstadoDelBarrido::Completo);

    // Se entrega la apertura y el observado; el servidor pide `upload`.
    let Proximo::Trabajo(t) = c.siguiente(&raiz) else {
        panic!("falta la apertura")
    };
    let Trabajo::AbrirBarrido { id, .. } = *t else {
        panic!("el primero es sweep.open")
    };
    c.resolver(
        &id,
        Desenlace::Entregado(Recibido::Barrido {
            sweep: savia_folder_nucleo::colas::SweepId("s".into()),
            padron_requerido: false,
        }),
    );

    let Proximo::Trabajo(t) = c.siguiente(&raiz) else {
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

    // Queda el `sweep.close` sin entregar: NO puede salir un `Subir` antes.
    let Proximo::Trabajo(t) = c.siguiente(&raiz) else {
        panic!("falta el cierre")
    };
    assert!(
        matches!(*t, Trabajo::CerrarBarrido { .. }),
        "mientras quede un hecho sin entregar en esta raiz, no sale un `Subir`"
    );
    let Trabajo::CerrarBarrido { id, .. } = *t else {
        unreachable!()
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
    assert!(
        matches!(*t, Trabajo::Subir { .. }),
        "recien ahora, los bytes"
    );
    let TrabajoId::Byte(_) = (match &*t {
        Trabajo::Subir { id, .. } => id.clone(),
        _ => unreachable!(),
    }) else {
        panic!("el trabajo de bytes se identifica como tal")
    };
}

// ══════════════════════════════════════════════════════════════════════════════
// Los otros invariantes del arbol
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn ningun_hecho_sale_de_una_senal_el_origen_no_cambia_el_paso() {
    // IMPORTA PORQUE: un evento NUNCA produce un reporte. Es una senal para volver a
    // mirar; el hecho sale del `stat` y del hash. Para el mismo estado de disco, los dos
    // origenes tienen que dar el MISMO `Paso`.
    let p = Falsa::como_macos();
    p.poner("x.txt", b"algo", 100, Some(1));
    let a = almacen();
    let reloj = RelojDePlataforma(&p);
    let barrido = BarridoId::nuevo("b1");
    let uno = maquina::decidir(
        &Senal {
            raiz: raiz(),
            ruta: r("x.txt"),
            origen: OrigenDeSenal::EventoDelSistema,
        },
        Some(&barrido),
        &p,
        a.inventario(),
        &reloj,
        &politica(),
    );
    let otro = maquina::decidir(
        &Senal {
            raiz: raiz(),
            ruta: r("x.txt"),
            origen: OrigenDeSenal::TurnoDelBarrido,
        },
        Some(&barrido),
        &p,
        a.inventario(),
        &reloj,
        &politica(),
    );
    assert_eq!(uno, otro, "el origen no entra en la decision");
}

#[test]
fn un_evento_sobre_una_ruta_que_falta_agenda_un_barrido_y_no_produce_baja() {
    // IMPORTA PORQUE: es la resolucion de la contradiccion entre el flujograma y el
    // diseno de la maquina, y se resuelve con la frase del borrador — «el barrido es lo
    // unico que establece verdad de campo, y por lo tanto la unica fuente legitima de un
    // conjunto de bajas». Un `rename(A→B)` cuyo evento de A llega antes que el de B no
    // puede emitir una baja falsa.
    let p = Falsa::como_macos();
    p.poner("x.txt", b"algo", 100, Some(1));
    let mut a = almacen();
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 1);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 2);

    p.sacar("x.txt");
    p.reiniciar_contadores();
    let nodo = ciclo::atender_evento(&raiz(), r("x.txt"), &p, &mut a, &politica());
    assert_eq!(nodo, Nodo::AgendaBarrido, "un evento agenda, no reporta");
    assert_eq!(p.sondeos_de_raiz(), 0, "y no cuesta ni una enumeracion");
}

#[test]
fn tripleta_igual_cero_lecturas_y_cero_efectos() {
    // IMPORTA PORQUE: es el camino mas caliente del barrido. Y con granularidad de 2 s y
    // un `mtime` que difiere en 1 s, sigue siendo «sin cambio»: en FAT/exFAT y en SMB la
    // igualdad exacta hace ver TODO archivo cambiado en cada vuelta.
    let p = Falsa::como_macos();
    p.con_granularidad(Duration::from_secs(2));
    p.poner("x.txt", b"algo", 100, Some(1));
    let mut a = almacen();
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 1);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 2);

    // Mismo tamano, mismo id, `mtime` a 1 s — dentro de la granularidad.
    p.poner("x.txt", b"algo", 101, Some(1));
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    p.reiniciar_contadores();
    let reloj = RelojDePlataforma(&p);
    let paso = maquina::decidir(
        &Senal {
            raiz: raiz(),
            ruta: r("x.txt"),
            origen: OrigenDeSenal::TurnoDelBarrido,
        },
        Some(&BarridoId::nuevo("b3")),
        &p,
        a.inventario(),
        &reloj,
        &politica(),
    );
    assert_eq!(paso.nodo, Nodo::SinCambio);
    assert_eq!(p.lecturas(), 0, "cero lecturas");
    assert!(paso.efectos.is_empty(), "y cero efectos");
    assert!(paso.hecho.is_none());
}

#[test]
fn el_fileid_es_el_tercer_termino_del_and() {
    // IMPORTA PORQUE: el guardado atomico de Office borra y recrea con el mismo tamano y
    // un `fileId` NUEVO. Sin ese termino, la edicion pasa como «sin cambios», se pierde
    // en silencio, y Savia sirve la version vieja indefinidamente.
    let p = Falsa::como_macos();
    p.con_granularidad(Duration::from_secs(2));
    p.poner("x.docx", b"aaaa", 100, Some(1));
    let mut a = almacen();
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 1);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 2);

    // Mismo tamano, `mtime` dentro de la granularidad, id NUEVO.
    p.poner("x.docx", b"bbbb", 101, Some(777));
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    let reloj = RelojDePlataforma(&p);
    let paso = maquina::decidir(
        &Senal {
            raiz: raiz(),
            ruta: r("x.docx"),
            origen: OrigenDeSenal::TurnoDelBarrido,
        },
        Some(&BarridoId::nuevo("b3")),
        &p,
        a.inventario(),
        &reloj,
        &politica(),
    );
    assert_ne!(
        paso.nodo,
        Nodo::SinCambio,
        "el `fileId` nuevo saca del camino NOOP"
    );
}

#[test]
fn indeterminada_nunca_produce_hecho_ni_efecto() {
    // IMPORTA PORQUE: es el caso que ROOT NO PUEDE atrapar — la carpeta se enumera
    // perfecto y aun asi lo de adentro es ilegible. Un Full Disk Access revocado por una
    // actualizacion de macOS produciria el conjunto COMPLETO de ausencias de la raiz con
    // la raiz viva.
    use savia_folder_nucleo::plataforma::MotivoIndeterminado;
    let p = Falsa::como_macos();
    p.poner("x.txt", b"algo", 100, Some(1));
    let mut a = almacen();
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 1);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 2);

    p.poner_ilegible("x.txt", MotivoIndeterminado::PermisoDenegado);
    let reloj = RelojDePlataforma(&p);
    let paso = maquina::decidir(
        &Senal {
            raiz: raiz(),
            ruta: r("x.txt"),
            origen: OrigenDeSenal::TurnoDelBarrido,
        },
        Some(&BarridoId::nuevo("b3")),
        &p,
        a.inventario(),
        &reloj,
        &politica(),
    );
    assert_eq!(
        paso.nodo,
        Nodo::Indeterminado(MotivoIndeterminado::PermisoDenegado),
        "y el motivo sobrevive: el panel tiene que decir «dale acceso a disco», no «carpeta ausente»"
    );
    assert!(paso.hecho.is_none());
    assert!(paso.efectos.is_empty());
}

#[test]
fn una_fila_ausente_no_tiene_observacion_comparable() {
    // IMPORTA PORQUE: un archivo que se va, se reporta la baja, y VUELVE con la MISMA
    // tripleta. Con la fila como struct plano, la comparacion dice «iguales», no sale
    // ningun `aparecio`, y Savia lo retira con el archivo ahi, en la carpeta, a la vista.
    // Es reversible por diseno, pero nadie sabe que hay algo que revertir.
    let p = Falsa::como_macos();
    p.poner("x.txt", b"identico", 100, Some(1));
    let mut a = almacen();
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 1);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 2);

    p.sacar("x.txt");
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    let baja = ciclo::barrer(&raiz(), BarridoId::nuevo("b3"), &p, &mut a, &politica());
    assert_eq!(baja.bajas, 1);
    confirmar_todo(&mut a);

    // Vuelve IDENTICO: mismo tamano, mismo mtime, mismo id.
    p.poner("x.txt", b"identico", 100, Some(1));
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b4"), &p, &mut a, &politica());
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    let vuelta = ciclo::barrer(&raiz(), BarridoId::nuevo("b5"), &p, &mut a, &politica());
    assert_eq!(
        vuelta.apariciones, 1,
        "vuelve identico y SE REPORTA IGUAL: una fila ausente no tiene tripleta contra la cual comparar"
    );
}

#[test]
fn una_ausencia_ya_reportada_no_se_reporta_dos_veces() {
    // IMPORTA PORQUE: una tormenta de eventos por desmontaje mandaria N copias de la
    // misma baja, y la fraccion del corte por volumen se calcularia sobre un conteo que
    // supera su propio denominador.
    let p = Falsa::como_macos();
    p.poner("x.txt", b"algo", 100, Some(1));
    let mut a = almacen();
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 1);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 2);

    p.sacar("x.txt");
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    assert_eq!(
        ciclo::barrer(&raiz(), BarridoId::nuevo("b3"), &p, &mut a, &politica()).bajas,
        1
    );
    confirmar_todo(&mut a);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    assert_eq!(
        ciclo::barrer(&raiz(), BarridoId::nuevo("b4"), &p, &mut a, &politica()).bajas,
        0,
        "la lapida sobrevive y no se re-reporta"
    );
}

#[test]
fn borrar_una_de_dos_copias_identicas_si_produce_una_baja() {
    // IMPORTA PORQUE: es el refinamiento sobre la letra del borrador. Tomado literal —«un
    // hash que reaparece en CUALQUIER punto del arbol»— la otra copia suprime la baja y
    // el documento de la copia borrada queda vigente PARA SIEMPRE apuntando a una ruta
    // que ya no existe. Correlacionar contra un ALTA de este barrido lo arregla sin
    // contradecir la idea: reaparecer es aparecer donde antes no estaba.
    let p = Falsa::como_macos();
    p.poner("a/doc.txt", b"el mismo contenido", 100, Some(1));
    p.poner("b/doc.txt", b"el mismo contenido", 100, Some(2));
    let mut a = almacen();
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 1);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 2);
    assert_eq!(a.inventario().vivos(&raiz()), 2);

    p.sacar("a/doc.txt");
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    let resumen = ciclo::barrer(&raiz(), BarridoId::nuevo("b3"), &p, &mut a, &politica());
    assert_eq!(
        resumen.bajas, 1,
        "la copia que se borro SI se retira: la que queda no es un alta de este barrido"
    );
}

#[test]
fn una_ruta_sin_hash_confirmado_no_produce_una_baja() {
    // IMPORTA PORQUE: mandar bajas de rutas que Savia nunca confirmo infla el numerador
    // del corte por volumen con archivos que del otro lado NO EXISTEN, y congela una raiz
    // sin causa. El sintoma es un `Congelado` que no se resuelve con mas barridos, porque
    // los archivos fantasma nunca van a aparecer.
    let p = Falsa::como_macos();
    p.poner("x.txt", b"algo", 100, Some(1));
    let mut a = almacen();
    // Dos barridos SIN confirmar nada: la fila queda con hash afirmado, no verificado.
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b1"), &p, &mut a, &politica());
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b2"), &p, &mut a, &politica());

    p.sacar("x.txt");
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    let reloj = RelojDePlataforma(&p);
    let paso = maquina::decidir(
        &Senal {
            raiz: raiz(),
            ruta: r("x.txt"),
            origen: OrigenDeSenal::TurnoDelBarrido,
        },
        Some(&BarridoId::nuevo("b3")),
        &p,
        a.inventario(),
        &reloj,
        &politica(),
    );
    assert_eq!(paso.nodo, Nodo::BajaNoReportable);
    assert!(paso.hecho.is_none(), "Savia no tiene documento que retirar");
}

#[test]
fn determinismo_mismos_puertos_misma_senal_mismo_paso() {
    // IMPORTA PORQUE: el reloj se muestrea UNA vez por invocacion. Si dos aristas vieran
    // instantes distintos, el asentamiento seria irreproducible.
    let p = Falsa::como_macos();
    p.poner("x.txt", b"algo", 100, Some(1));
    let a = almacen();
    let reloj = RelojDePlataforma(&p);
    let senal = Senal {
        raiz: raiz(),
        ruta: r("x.txt"),
        origen: OrigenDeSenal::TurnoDelBarrido,
    };
    let barrido = BarridoId::nuevo("b1");
    let primero = maquina::decidir(
        &senal,
        Some(&barrido),
        &p,
        a.inventario(),
        &reloj,
        &politica(),
    );
    for _ in 0..100 {
        let otro = maquina::decidir(
            &senal,
            Some(&barrido),
            &p,
            a.inventario(),
            &reloj,
            &politica(),
        );
        assert_eq!(primero, otro);
    }
}

#[test]
fn el_reloj_avanza_durante_la_suspension() {
    // IMPORTA PORQUE: el caso que decide es «pasaron seis horas y cinco la laptop estuvo
    // dormida». Con `mach_absolute_time`, un asentamiento de 30 s no vence NUNCA en una
    // maquina que se cierra: los archivos no se reportan jamas y el agente PARECE estar
    // funcionando.
    let p = Falsa::como_macos();
    p.poner("x.txt", b"algo", 100, Some(1));
    let mut a = almacen();
    let reloj = RelojDePlataforma(&p);
    let barrido = BarridoId::nuevo("b1");
    let senal = Senal {
        raiz: raiz(),
        ruta: r("x.txt"),
        origen: OrigenDeSenal::TurnoDelBarrido,
    };

    let paso = maquina::decidir(
        &senal,
        Some(&barrido),
        &p,
        a.inventario(),
        &reloj,
        &politica(),
    );
    assert!(matches!(paso.nodo, Nodo::Esperando { .. }));
    a.comprometer(&raiz(), Some(&barrido), paso);

    // Seis horas, y cinco la laptop estuvo dormida. El reloj continuo las cuenta todas.
    p.avanzar(Duration::from_secs(6 * 3600));
    let paso = maquina::decidir(
        &senal,
        Some(&barrido),
        &p,
        a.inventario(),
        &reloj,
        &politica(),
    );
    assert_eq!(
        paso.nodo,
        Nodo::Aparecio,
        "el intervalo vencio: el reloj no se detuvo mientras la maquina dormia"
    );
}

#[test]
fn el_instante_no_retrocede_ni_entra_en_panico() {
    // IMPORTA PORQUE: un reloj monotonico no deberia retroceder, y si lo hace, un panico
    // en el observador es peor que un cero.
    let antes = Instante::desde_nanos(1_000);
    let despues = Instante::desde_nanos(500);
    assert_eq!(despues.transcurrido_desde(antes), Duration::ZERO);
}

#[test]
fn la_particion_de_las_salvaguardas_es_disjunta_y_cubriente() {
    // IMPORTA PORQUE: las cinco salvaguardas son SEIS variantes, y esa aritmetica es el
    // diseno. Una salvaguarda nueva no compila hasta que alguien diga de que lado cae.
    use savia_folder_nucleo::salvaguardas::{
        DELEGADAS_A_SAVIA, IMPLEMENTADAS, Lado, Salvaguarda, lado,
    };
    let todas = [
        Salvaguarda::Asentamiento,
        Salvaguarda::Cuarentena,
        Salvaguarda::RaizViva,
        Salvaguarda::CortePorVolumen,
        Salvaguarda::CorrelacionPorContenido,
        Salvaguarda::DeshidratadoNoEsAusente,
    ];
    assert_eq!(IMPLEMENTADAS.len() + DELEGADAS_A_SAVIA.len(), todas.len());
    for s in todas {
        let en_una = IMPLEMENTADAS.contains(&s);
        let en_otra = DELEGADAS_A_SAVIA.contains(&s);
        assert!(en_una ^ en_otra, "{s:?} tiene que estar en exactamente una");
        assert_eq!(
            en_una,
            lado(s) == Lado::Agente,
            "lo que el agente evalua es exactamente lo que cae del lado del agente"
        );
    }
}

#[test]
fn una_desaparicion_solo_se_construye_pasando_por_la_puerta() {
    // IMPORTA PORQUE: con campos publicos, «si la raiz no esta viva no se reporta ni una
    // baja» seria una convencion, y cualquier camino nuevo —un reintento de la cola
    // muerta, el replay del cursor durable de macOS— podria emitir una baja sin pasar por
    // la puerta.
    use savia_folder_nucleo::plataforma::FalloDeEnumeracion;
    use savia_folder_nucleo::salvaguardas::{EstadoDeRaiz, PorQueAusente, puerta_de_baja};
    let h = HashVerificado::rehidratar_del_inventario([1u8; 32]);
    assert!(puerta_de_baja(&EstadoDeRaiz::Viva, r("x.txt"), Some(h)).is_ok());
    assert!(
        puerta_de_baja(
            &EstadoDeRaiz::Ausente(PorQueAusente::NoSePudoEnumerar(
                FalloDeEnumeracion::NoMontado
            )),
            r("x.txt"),
            Some(h)
        )
        .is_err(),
        "con la raiz ausente no hay forma de fabricar una `Desaparicion`"
    );
}

#[test]
fn una_enumeracion_vacia_no_es_una_raiz_ausente() {
    // IMPORTA PORQUE: vaciar una carpeta es legitimo, y el caso masivo lo separa el corte
    // por volumen, que es de Savia. Al suplente lo atrapa la IDENTIDAD, nunca el conteo.
    use savia_folder_nucleo::plataforma::{EvidenciaDeRaiz, ResultadoDeEnumeracion};
    let e = EvidenciaDeRaiz {
        enumeracion: ResultadoDeEnumeracion::Listada {
            entradas: Vec::new(),
            errores: Vec::new(),
        },
        volumen: Some(Falsa::huella_del_banco().volumen),
        directorio: Some(Falsa::huella_del_banco().directorio),
    };
    assert!(salvaguardas::raiz_viva(&registrada(), &e).permite_reportar_bajas());
}

#[test]
fn un_recorrido_con_huecos_no_cierra_completo() {
    // IMPORTA PORQUE: si la raiz muere a mitad de barrido y el barrido igual cierra
    // `completo`, Savia toma un recorrido parcial como prueba de que los archivos siguen
    // sin estar, y la cuarentena vence sobre evidencia falsa.
    use savia_folder_nucleo::plataforma::{
        ErrorDeEntrada, EvidenciaDeRaiz, ResultadoDeEnumeracion,
    };
    let p = Falsa::como_macos();
    let mut a = almacen();
    p.forzar_evidencia(EvidenciaDeRaiz {
        enumeracion: ResultadoDeEnumeracion::Listada {
            entradas: Vec::new(),
            errores: vec![ErrorDeEntrada {
                ruta: None,
                errno: 13,
            }],
        },
        volumen: Some(Falsa::huella_del_banco().volumen),
        directorio: Some(Falsa::huella_del_banco().directorio),
    });
    let resumen = ciclo::barrer(&raiz(), BarridoId::nuevo("b1"), &p, &mut a, &politica());
    assert_eq!(resumen.cierre, Some(EstadoDelBarrido::Interrumpido));
}

#[test]
fn el_brazo_de_windows_corre_en_un_mac_todos_los_dias() {
    // IMPORTA PORQUE: `#[cfg(windows)]` no se compila aca, asi que el unico camino de
    // Windows que se puede ejercer es el que sale como VALOR. `Falsa::como_windows`
    // devuelve `SeAbreSinHidratar` y `BarridoCompleto{LaPlataformaNoLoTiene}`: es el
    // mismo `match` total, tomando el otro brazo.
    use savia_folder_nucleo::plataforma::{
        MotivoDeBarrido, PlanDeArranque, PoliticaDeDeshidratacion,
    };
    let p = Falsa::como_windows();
    assert_eq!(
        p.politica_de_deshidratacion(),
        PoliticaDeDeshidratacion::SeAbreSinHidratar
    );
    match p.plan_de_arranque(&registrada(), None) {
        PlanDeArranque::BarridoCompleto { porque } => {
            assert_eq!(porque, MotivoDeBarrido::LaPlataformaNoLoTiene)
        }
        PlanDeArranque::Replay { .. } => panic!("Windows no tiene cursor durable"),
    }
    // Y en Windows un deshidratado SI se puede leer, que es la otra mitad de la politica.
    p.poner_con(
        "nube.docx",
        b"contenido",
        100,
        Some(1),
        savia_folder_nucleo::plataforma::Hidratacion::Deshidratado,
        9,
    );
    assert!(
        p.hashear(&registrada(), &r("nube.docx")).is_ok(),
        "`SeAbreSinHidratar`: en Windows leer un deshidratado no cuesta materializarlo"
    );
}

#[test]
fn el_reloj_del_puente_es_el_de_la_plataforma() {
    // IMPORTA PORQUE: si la maquina recibiera dos relojes podrian discrepar, y el
    // asentamiento y la cadencia del barrido mediriamos cosas distintas.
    let p = Falsa::como_macos();
    p.avanzar(Duration::from_secs(7));
    let reloj = RelojDePlataforma(&p);
    assert_eq!(reloj.ahora(), p.ahora());
}

#[test]
fn la_ruta_relativa_es_canonica_y_no_puede_ser_absoluta() {
    // IMPORTA PORQUE: con rutas absolutas, mover `~/Savia` a `~/Documents/Savia` hace que
    // TODOS los archivos parezcan desaparecer a la vez.
    use savia_folder_nucleo::dominio::RutaInvalida;
    assert_eq!(
        RutaRelativa::canonica("/etc/passwd"),
        Err(RutaInvalida::Absoluta)
    );
    assert_eq!(
        RutaRelativa::canonica("a/../../b"),
        Err(RutaInvalida::Escapa)
    );
    assert_eq!(RutaRelativa::canonica(""), Err(RutaInvalida::Vacia));
    assert_eq!(
        r("a\\b\\c.txt").como_str(),
        "a/b/c.txt",
        "el separador es parte del contrato"
    );
    assert_eq!(r("a//./b.txt").como_str(), "a/b.txt");
    // La composicion latina: NFD y NFC dan la MISMA ruta, asi que el mismo archivo no
    // aparece con dos grafias.
    assert_eq!(r("an\u{0303}o/informe.txt"), r("año/informe.txt"));
}

#[test]
fn el_sha256_coincide_con_el_de_node() {
    // IMPORTA PORQUE: de esa coincidencia depende el dedupe previo a la transferencia. Si
    // difiriera, TODO saldria `upload` y el sintoma pareceria un problema de servidor.
    // Vectores conocidos de FIPS 180-4.
    assert_eq!(
        savia_folder_nucleo::hash::sha256(b"").hex(),
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
    assert_eq!(
        savia_folder_nucleo::hash::sha256(b"abc").hex(),
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
}

#[test]
fn un_hecho_por_senal_como_maximo() {
    // IMPORTA PORQUE: `desaparecio(P,H1)` y `aparecio(P,H2)` emitidos juntos y drenados
    // al reves son el borrado de la version nueva. `Option<Hecho>` lo hace inexpresable,
    // y esta prueba solo documenta que el tipo es el que es.
    let p = Falsa::como_macos();
    p.poner("x.txt", b"algo", 100, Some(1));
    let mut a = almacen();
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    let reloj = RelojDePlataforma(&p);
    let senal = Senal {
        raiz: raiz(),
        ruta: r("x.txt"),
        origen: OrigenDeSenal::TurnoDelBarrido,
    };
    let barrido = BarridoId::nuevo("b1");
    let paso = maquina::decidir(
        &senal,
        Some(&barrido),
        &p,
        a.inventario(),
        &reloj,
        &politica(),
    );
    a.comprometer(&raiz(), Some(&barrido), paso);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    let paso = maquina::decidir(
        &senal,
        Some(&barrido),
        &p,
        a.inventario(),
        &reloj,
        &politica(),
    );
    assert!(matches!(paso.hecho, Some(Hecho::Aparecio(_))));
}

// ══════════════════════════════════════════════════════════════════════════════
// 12 · EL PADRON — lo que el agente VE, cuando Savia dice que no coinciden
// ══════════════════════════════════════════════════════════════════════════════

/// Drena la raiz haciendo de servidor y devuelve el ORDEN en que salieron los trabajos.
/// `padron_requerido` es lo que ese servidor contesta al `sweep.open`.
fn drenar_anotando(a: &mut Almacen, padron_requerido: bool) -> Vec<String> {
    use savia_folder_nucleo::colas::Desenlace;
    let mut orden = Vec::new();
    while let Proximo::Trabajo(t) = a.siguiente(&raiz()) {
        let id = match &*t {
            Trabajo::AbrirBarrido { id, .. }
            | Trabajo::Observar { id, .. }
            | Trabajo::Desvanecer { id, .. }
            | Trabajo::EnviarPadron { id, .. }
            | Trabajo::CerrarBarrido { id, .. }
            | Trabajo::Subir { id, .. }
            | Trabajo::ConfirmarSubida { id, .. } => id.clone(),
        };
        let recibido = match &*t {
            Trabajo::AbrirBarrido { .. } => {
                orden.push("abrir".to_string());
                Recibido::Barrido {
                    sweep: savia_folder_nucleo::colas::SweepId("s".into()),
                    padron_requerido,
                }
            }
            Trabajo::Observar { entradas, .. } => {
                orden.push(format!("observar x{}", entradas.len()));
                Recibido::Decisiones(
                    entradas
                        .iter()
                        .map(|(ruta, af)| Veredicto {
                            ruta: ruta.clone(),
                            afirmado: *af,
                            decision: Decision::Known {
                                verificado: HashVerificado::rehidratar_del_inventario(*af.bytes()),
                            },
                        })
                        .collect(),
                )
            }
            Trabajo::Desvanecer { entradas, .. } => {
                orden.push(format!("desvanecer x{}", entradas.len()));
                Recibido::Nada
            }
            Trabajo::EnviarPadron { entradas, .. } => {
                orden.push(format!(
                    "padron x{} ({} sin hash)",
                    entradas.len(),
                    entradas.iter().filter(|(_, h)| h.is_none()).count()
                ));
                Recibido::Nada
            }
            Trabajo::CerrarBarrido { .. } => {
                orden.push("cerrar".to_string());
                Recibido::Retirados {
                    rutas: Vec::new(),
                    congelada: false,
                }
            }
            _ => Recibido::Nada,
        };
        a.resolver(&raiz(), &id, Desenlace::Entregado(recibido));
    }
    orden
}

/// La primera vuelta solo registra CANDIDATOS: un archivo recien visto no esta asentado,
/// asi que no hay aparicion hasta el barrido siguiente. Todos los tests de aca abajo
/// necesitan un segmento con hechos de verdad, y este es el camino corto.
fn dejar_asentado(p: &Falsa, a: &mut Almacen) {
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b1"), p, a, &politica());
    drenar_anotando(a, false);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
}

#[test]
fn el_padron_sale_entre_las_bajas_y_el_cierre() {
    // IMPORTA PORQUE: la diferencia de conjuntos se aplica en `sweep.close`. Un padron
    // que sale DESPUES del cierre no lo lee nadie, y el desfase que lo motivo sigue ahi
    // — con la diferencia de que ahora los dos lados creen que se resolvio.
    let p = Falsa::como_macos();
    p.poner("a.txt", b"el a", 100, Some(1));
    p.poner("b.txt", b"el b", 100, Some(2));
    let mut a = almacen();
    dejar_asentado(&p, &mut a);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b2"), &p, &mut a, &politica());

    let orden = drenar_anotando(&mut a, true);
    assert!(
        orden.contains(&"observar x2".to_string()),
        "el segmento lleva hechos de verdad, o el test no prueba ningun orden: {orden:?}"
    );
    let i_padron = orden.iter().position(|x| x.starts_with("padron"));
    let i_observar = orden.iter().position(|x| x.starts_with("observar"));
    let i_cierre = orden.iter().position(|x| x == "cerrar");
    assert!(
        i_padron.is_some(),
        "con la bandera puesta el padron SALE: {orden:?}"
    );
    assert!(
        i_observar < i_padron && i_padron < i_cierre,
        "los hechos, despues el padron, y el cierre ultimo: {orden:?}"
    );
}

#[test]
fn sin_bandera_el_padron_no_sale_y_no_cuesta_una_llamada() {
    // IMPORTA PORQUE: coincidir es el caso NORMAL. Mandar el arbol entero en cada barrido
    // convierte un protocolo incremental en uno que retransmite el inventario completo
    // cada vez, y el ahorro de las dos colas era la razon entera del diseno.
    let p = Falsa::como_macos();
    p.poner("a.txt", b"el a", 100, Some(1));
    let mut a = almacen();
    dejar_asentado(&p, &mut a);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b2"), &p, &mut a, &politica());

    let orden = drenar_anotando(&mut a, false);
    assert!(
        orden.contains(&"observar x1".to_string()),
        "hubo barrido con hechos: {orden:?}"
    );
    assert!(
        !orden.iter().any(|x| x.starts_with("padron")),
        "y sin desfase no se manda nada: {orden:?}"
    );
}

#[test]
fn un_deshidratado_sin_fila_previa_entra_al_padron() {
    // IMPORTA PORQUE: **el padron NO se puede derivar del inventario**, y este es el caso
    // que lo prueba. Un archivo de nube que el agente ve por primera vez sale por
    // `Nodo::Omitido` con CERO efectos: no se lee, y no deja fila. Un padron armado desde
    // las filas lo omitiria, omitir es decir «no esta», y Savia retiraria un archivo que
    // esta perfectamente ahi. En macOS leerlo para probar que existe significa descargar
    // el drive entero, asi que «leelo y listo» no es una salida.
    let p = Falsa::como_macos();
    p.poner("local.txt", b"el local", 100, Some(1));
    p.poner_deshidratado("nube.pptx", 100, Some(2));
    let mut a = almacen();
    dejar_asentado(&p, &mut a);
    // Segunda vuelta: `local.txt` aparece y queda con hash VERIFICADO.
    ciclo::barrer(&raiz(), BarridoId::nuevo("b2"), &p, &mut a, &politica());
    drenar_anotando(&mut a, false);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);

    let resumen = ciclo::barrer(&raiz(), BarridoId::nuevo("b3"), &p, &mut a, &politica());
    assert_eq!(
        resumen.omitidos_por_deshidratacion, 1,
        "el de nube no se leyo"
    );
    assert!(
        a.inventario().asiento(&raiz(), &r("nube.pptx")).is_none(),
        "y NO dejo fila: es exactamente por eso que el inventario no alcanza"
    );

    let orden = drenar_anotando(&mut a, true);
    assert!(
        orden.contains(&"padron x2 (1 sin hash)".to_string()),
        "las DOS rutas viajan: la local con su hash confirmado, y el deshidratado SIN \
         hash —presente con hash desconocido, que no es lo mismo que ausente—: {orden:?}"
    );
}

#[test]
fn un_recorrido_interrumpido_no_registra_padron() {
    // IMPORTA PORQUE: un padron parcial presentado como el universo de lo presente retira
    // TODO lo que el recorrido no llego a mirar. Savia tambien lo exige —solo aplica la
    // diferencia sobre un `sweep.close(complete)`— y sostenerlo de los dos lados es a
    // proposito: asi ninguno de los dos solo puede convertir un disco a medio montar en
    // un borrado masivo.
    use savia_folder_nucleo::plataforma::{
        ErrorDeEntrada, EvidenciaDeRaiz, ResultadoDeEnumeracion,
    };
    let p = Falsa::como_macos();
    p.poner("a.txt", b"el a", 100, Some(1));
    let mut a = almacen();
    dejar_asentado(&p, &mut a);
    p.forzar_evidencia(EvidenciaDeRaiz {
        enumeracion: ResultadoDeEnumeracion::Listada {
            entradas: Vec::new(),
            errores: vec![ErrorDeEntrada {
                ruta: None,
                errno: 13,
            }],
        },
        volumen: Some(Falsa::huella_del_banco().volumen),
        directorio: Some(Falsa::huella_del_banco().directorio),
    });
    let resumen = ciclo::barrer(&raiz(), BarridoId::nuevo("b2"), &p, &mut a, &politica());
    assert_eq!(resumen.cierre, Some(EstadoDelBarrido::Interrumpido));

    let orden = drenar_anotando(&mut a, true);
    assert!(
        !orden.iter().any(|x| x.starts_with("padron")),
        "la bandera esta puesta y el padron IGUAL no sale: {orden:?}"
    );
}

#[test]
fn el_padron_no_se_trunca_por_el_limite_de_lote() {
    // IMPORTA PORQUE: truncar un lote de HECHOS demora —lo que quedo afuera sale en la
    // vuelta siguiente—; truncar un PADRON miente. El padron afirma «esto es todo lo que
    // veo», asi que la mitad que no viajo se lee del otro lado como ausente y se retira.
    // Son dos cosas distintas y el mismo numero no puede gobernar las dos.
    //
    // El test afirma SOLO sobre el padron a proposito. `max_entradas_por_lote` en `Some`
    // tiene un defecto propio y anterior a esto —`lote()` trunca, se entregan `n`, y
    // `observados_entregados` marca el segmento como listo, con lo que el resto de los
    // hechos no sale nunca—, y nadie lo pone en `Some` en todo el crate. Apoyarse en ese
    // camino seria fijar un bug.
    let p = Falsa::como_macos();
    for i in 0..5u128 {
        p.poner(
            &format!("f{i}.txt"),
            format!("el {i}").as_bytes(),
            100,
            Some(i + 1),
        );
    }
    let mut a = Almacen::nuevo(ParametrosDeCola {
        max_intentos: None,
        max_entradas_por_lote: Some(2),
    });
    a.enrolar(registrada());
    dejar_asentado(&p, &mut a);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b2"), &p, &mut a, &politica());

    let orden = drenar_anotando(&mut a, true);
    let linea = orden
        .iter()
        .find(|x| x.starts_with("padron"))
        .expect("el padron salio");
    assert!(
        linea.starts_with("padron x5"),
        "las cinco rutas viajan aunque el limite de lote sea dos: {orden:?}"
    );
}

#[test]
fn un_padron_ambiguo_no_bloquea_el_cierre() {
    // IMPORTA PORQUE: es el UNICO trabajo cuya perdida repara el mecanismo que lo
    // produjo. Si no llega, el proximo `sweep.open` vuelve a detectar el desfase y vuelve
    // a pedirlo. Bloquear el segmento en cambio SI cuesta: el cierre no sale, el barrido
    // queda abierto del otro lado, y la cuarentena nunca recibe el barrido completo que
    // exige para resolver una sola ausencia.
    use savia_folder_nucleo::colas::Desenlace;
    let p = Falsa::como_macos();
    p.poner("a.txt", b"el a", 100, Some(1));
    let mut a = almacen();
    dejar_asentado(&p, &mut a);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b2"), &p, &mut a, &politica());

    let mut vio_padron = false;
    let mut vio_cierre = false;
    let mut vueltas = 0;
    while let Proximo::Trabajo(t) = a.siguiente(&raiz()) {
        vueltas += 1;
        assert!(vueltas < 20, "no gira: el padron ambiguo sale de la cola");
        let (id, desenlace) = match &*t {
            Trabajo::AbrirBarrido { id, .. } => (
                id.clone(),
                Desenlace::Entregado(Recibido::Barrido {
                    sweep: savia_folder_nucleo::colas::SweepId("s".into()),
                    padron_requerido: true,
                }),
            ),
            // El padron se pierde en la ambiguedad, una vez y otra y otra.
            Trabajo::EnviarPadron { id, .. } => {
                vio_padron = true;
                (id.clone(), Desenlace::Ambiguo)
            }
            Trabajo::CerrarBarrido { id, .. } => {
                vio_cierre = true;
                (
                    id.clone(),
                    Desenlace::Entregado(Recibido::Retirados {
                        rutas: Vec::new(),
                        congelada: false,
                    }),
                )
            }
            Trabajo::Observar { id, entradas, .. } => (
                id.clone(),
                Desenlace::Entregado(Recibido::Decisiones(
                    entradas
                        .iter()
                        .map(|(ruta, af)| Veredicto {
                            ruta: ruta.clone(),
                            afirmado: *af,
                            decision: Decision::Known {
                                verificado: HashVerificado::rehidratar_del_inventario(*af.bytes()),
                            },
                        })
                        .collect(),
                )),
            ),
            Trabajo::Desvanecer { id, .. }
            | Trabajo::Subir { id, .. }
            | Trabajo::ConfirmarSubida { id, .. } => {
                (id.clone(), Desenlace::Entregado(Recibido::Nada))
            }
        };
        a.resolver(&raiz(), &id, desenlace);
    }
    assert!(vio_padron, "el padron se pidio");
    assert!(vio_cierre, "y el cierre salio igual");
}

// ══════════════════════════════════════════════════════════════════════════════
// 13 · EL RESUMEN — lo que el panel puede mostrar
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn el_resumen_cuenta_lo_que_no_cambio() {
    // IMPORTA PORQUE: sin este numero, «de 40.000 rutas no cambio ninguna» y «de 40.000
    // rutas no se pudo mirar ninguna» producen exactamente el mismo resumen vacio, y son
    // la vuelta sana y la vuelta rota.
    let p = Falsa::como_macos();
    p.poner("a.txt", b"el a", 100, Some(1));
    p.poner("b.txt", b"el b", 100, Some(2));
    let mut a = almacen();
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 1);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 2);

    // Tercera vuelta: nadie toco nada. Los contadores se reinician para medir SOLO esta.
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    p.reiniciar_contadores();
    let resumen = ciclo::barrer(&raiz(), BarridoId::nuevo("b3"), &p, &mut a, &politica());
    assert_eq!(resumen.sin_cambio, 2, "las dos rutas quedaron contadas");
    assert_eq!(resumen.apariciones, 0);
    assert_eq!(resumen.bajas, 0);
    assert_eq!(p.lecturas(), 0, "y ninguna costo abrir el archivo");
}

#[test]
fn una_ausencia_sin_documento_deja_de_desaparecer_del_resumen() {
    // IMPORTA PORQUE: esta ruta se va, no produce baja —Savia nunca confirmo su hash, asi
    // que del otro lado no hay documento que retirar— y **la fila se OLVIDA**. Sin este
    // contador, el archivo entra al inventario, se va, se borra el rastro, y el resumen
    // de esa vuelta es idéntico al de una vuelta en la que no paso nada.
    let p = Falsa::como_macos();
    p.poner("x.txt", b"algo", 100, Some(1));
    let mut a = almacen();
    // Dos barridos SIN confirmar nada: la fila queda con hash afirmado, nunca verificado.
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b1"), &p, &mut a, &politica());
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b2"), &p, &mut a, &politica());

    p.sacar("x.txt");
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    let resumen = ciclo::barrer(&raiz(), BarridoId::nuevo("b3"), &p, &mut a, &politica());

    assert_eq!(
        resumen.bajas, 0,
        "no viaja ninguna baja, que es lo correcto"
    );
    assert_eq!(
        resumen.retenidas_sin_hash_confirmado, 1,
        "pero el cierre YA sabia por que la retuvo, y ahora ese motivo llega al resumen en vez de tirarse"
    );
}

#[test]
fn una_mudanza_descubierta_al_cerrar_queda_contada() {
    // IMPORTA PORQUE: el cierre anula bajas que resultaron ser mudanzas, y esa anulacion
    // es la diferencia entre «el usuario reorganizo su carpeta» y «el usuario borro
    // cuarenta archivos». Sin contarla, las dos vueltas se ven igual desde afuera.
    let p = Falsa::como_macos();
    p.poner("viejo.txt", b"el mismo contenido", 100, Some(7));
    let mut a = almacen();
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 1);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 2);

    // La misma tripleta en otra ruta: es una mudanza, no una baja mas un alta.
    p.sacar("viejo.txt");
    p.poner("nuevo.txt", b"el mismo contenido", 100, Some(7));
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    let resumen = ciclo::barrer(&raiz(), BarridoId::nuevo("b3"), &p, &mut a, &politica());

    assert_eq!(resumen.bajas, 0, "ninguna baja: se mudo");
    assert!(
        resumen.movimientos + resumen.retenidas_por_movimiento > 0,
        "y la mudanza queda contada, la vea el recorrido o la descubra el cierre: {resumen:?}"
    );
}
