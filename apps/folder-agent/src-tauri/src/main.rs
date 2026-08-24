//! EL BINARIO: corre el ciclo entero contra `apps/folder-agent/sim/server.ts`.
//!
//! No es Tauri y no tiene interfaz. Es «la unica parte que no espera a nada» del
//! borrador: el protocolo esta completamente especificado, asi que el agente se
//! construye contra un servidor simulado y se enchufa despues.
//!
//! Uso:
//! ```text
//!   node apps/folder-agent/sim/server.ts        # en otra terminal
//!   cargo run --bin folder-agent --features demo -- <ruta-de-la-raiz> [http://127.0.0.1:4477]
//! ```
//!
//! **LOS NUMEROS DE ESTE ARCHIVO SON PARAMETROS DEL BANCO, NO DEL PRODUCTO**, igual que
//! los de `sim/server.ts`. Van rotulados para que nadie los lea como una medicion: los
//! cuatro del canal siguen en `None` en `parametros.rs`, y este binario los provee
//! explicitamente porque `Politica` no tiene `Default` y no deja saltearlo.

use savia_folder_aplicacion::ciclo;
use savia_folder_contrato::dominio::{BarridoId, RaizId, SensibilidadAMayusculas};
// LA PLATAFORMA SE ELIGE POR `cfg`, Y NO ES ADORNO: con `Macos` cableado, este
// binario NO CRUZABA a Windows y el guardian que lo cross-chequea no podia existir.
// La biblioteca si cruzaba —verificado— asi que el hueco era del demo, no del nucleo.
use savia_folder_contrato::plataforma::{Plataforma, RaizRegistrada};
use savia_folder_contrato::protocolo::{Credencial, Reclamo, Secreto};
use savia_folder_estado::almacen::Almacen;
use savia_folder_estado::colas::ParametrosDeCola;
use savia_folder_persistencia::persistencia::Deposito;
#[cfg(target_os = "macos")]
use savia_folder_plataforma_adaptadores::macos::Macos as PlataformaLocal;
#[cfg(target_os = "windows")]
use savia_folder_plataforma_adaptadores::windows::Windows as PlataformaLocal;
use savia_folder_politica::salvaguardas::Politica;
use savia_folder_protocolo::{BaseDeApi, Cliente, Tiempos};

/// Parametros del BANCO. Chicos para que una corrida termine en segundos.
mod banco {
    use std::time::Duration;
    /// ms — el intervalo de asentamiento. **Producto: SIN MEDIR** (ver
    /// `parametros::ASENTAMIENTO`). Aca vale 300 ms para que el demo no tarde.
    pub const ASENTAMIENTO: Duration = Duration::from_millis(300);
    pub const TIEMPO_DE_CONEXION: Duration = Duration::from_secs(5);
    pub const TIEMPO_POR_LLAMADA: Duration = Duration::from_secs(30);
    /// Cuantas veces el demo pregunta si ya lo aprobaron, y cada cuanto. **Parametros del
    /// demo**: la app de bandeja espera indefinidamente, porque la persona puede tardar
    /// lo que quiera en abrir su cuenta.
    pub const INTENTOS_DE_VINCULACION: u32 = 30;
    pub const ESPERA_DE_VINCULACION: Duration = Duration::from_secs(2);
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut args = std::env::args().skip(1);
    let Some(ruta) = args.next() else {
        eprintln!("uso: folder-agent <ruta-de-la-raiz> [base-de-api]");
        eprintln!("     (levanta antes: node apps/folder-agent/sim/server.ts)");
        std::process::exit(2);
    };
    let base = args
        .next()
        .unwrap_or_else(|| "http://127.0.0.1:4477".into());

    let plataforma = PlataformaLocal::nueva()?;
    let ruta_absoluta = std::fs::canonicalize(&ruta)?;

    // ENROLAMIENTO. `RaizId` se acuna aca y NO es la ruta: si lo fuera, mover la carpeta
    // cambiaria la identidad de todo lo que hay adentro. La huella —volumen + directorio—
    // es lo que se vuelve a exigir en cada apertura de barrido.
    let huella = plataforma
        .huella_de_raiz(&ruta_absoluta)
        .map_err(|e| format!("no se puede enrolar {ruta}: {e:?}"))?;
    let raiz = RaizId::nueva("root-1");
    let registrada = RaizRegistrada {
        id: raiz.clone(),
        huella,
        ruta_absoluta: ruta_absoluta.clone(),
        // APFS por omision es INSENSIBLE. La decision 9 deja esto del lado del agente
        // porque es el unico que sabe si su sistema de archivos las distingue; la sonda
        // que lo mide al enrolar todavia no existe, asi que esto es una suposicion
        // rotulada y no una medicion.
        sensibilidad: SensibilidadAMayusculas::NoDistingue,
    };

    let politica = Politica::con_asentamiento(banco::ASENTAMIENTO)
        .expect("el banco provee un intervalo no nulo a proposito");

    // ── EL DEPOSITO ──────────────────────────────────────────────────────────
    //
    // **NUNCA ADENTRO DE UNA RAIZ VIGILADA**, y quien lo puede verificar es este archivo
    // porque es el unico que conoce las dos rutas. Un deposito adentro de la carpeta se
    // observa a si mismo: cada escritura produce un evento, que produce un barrido, que
    // produce una escritura.
    let deposito_ruta = std::env::temp_dir().join("savia-folder-agent.redb");
    if deposito_ruta.starts_with(&ruta_absoluta) {
        return Err(format!(
            "el deposito ({}) no puede vivir adentro de la raiz vigilada ({})",
            deposito_ruta.display(),
            ruta_absoluta.display()
        )
        .into());
    }
    let deposito = Deposito::abrir(&deposito_ruta).map_err(|e| e.to_string())?;

    // UN DEPOSITO ILEGIBLE PARA EL ARRANQUE. No se absorbe como «empiezo de cero»: sin
    // lapidas, lo borrado mientras el agente estuvo apagado no lo ve faltar nadie.
    let rescatado = deposito.cargar().map_err(|e| e.to_string())?;
    let (mut almacen, credencial_guardada) = match rescatado {
        Some(r) => {
            println!("deposito  {} (recuperado)", deposito_ruta.display());
            (r.almacen, r.credencial)
        }
        None => {
            println!("deposito  {} (nuevo)", deposito_ruta.display());
            let mut a = Almacen::nuevo(ParametrosDeCola {
                // Los dos en `None`: ver `parametros.rs`. Ninguno descarta nada.
                max_intentos: None,
                max_entradas_por_lote: None,
            });
            a.enrolar(registrada);
            (a, None)
        }
    };

    let tiempos = Tiempos {
        conexion: banco::TIEMPO_DE_CONEXION,
        por_llamada: banco::TIEMPO_POR_LLAMADA,
        envio_de_cuerpo: None,
    };

    // ── LA CREDENCIAL ────────────────────────────────────────────────────────
    let credencial = match credencial_guardada {
        Some(s) => {
            println!("token     recuperado del deposito\n");
            Some(s)
        }
        None => vincular(&base, tiempos)?,
    };
    let Some(token) = credencial else {
        // Se guarda igual: puede haber estado que valga la pena conservar.
        deposito
            .guardar(&almacen, None)
            .map_err(|e| e.to_string())?;
        return Ok(());
    };

    let cliente = Cliente::nuevo(
        BaseDeApi::nueva(&base)?,
        Credencial::TokenDeDispositivo(token.clone()),
        tiempos,
    );

    println!("raiz  {}", ruta_absoluta.display());
    println!("api   {base}\n");

    // DOS VUELTAS, y la primera no reporta nada A PROPOSITO: el asentamiento exige dos
    // observaciones con la misma tripleta separadas por el intervalo. La primera vuelta
    // anota candidatos; la segunda hashea. Es exactamente lo que impide que cada `Cmd+S`
    // en Word mande un par baja/alta al servidor.
    for (n, vuelta) in [
        "1 - primera vuelta: se anotan candidatos, no se hashea nada",
        "2 - segunda vuelta: los candidatos asentaron, recien ahora se lee",
    ]
    .iter()
    .enumerate()
    {
        if n > 0 {
            std::thread::sleep(banco::ASENTAMIENTO);
        }
        println!("{vuelta}");
        let barrido = BarridoId::nuevo(format!("barrido-{}", n + 1));
        let r = ciclo::barrer(&raiz, barrido, &plataforma, &mut almacen, &politica);
        println!(
            "   enumeradas={} apariciones={} bajas={} esperando={} deshidratados={} movimientos={} cierre={:?}",
            r.enumeradas,
            r.apariciones,
            r.bajas,
            r.esperando,
            r.omitidos_por_deshidratacion,
            r.movimientos,
            r.cierre
        );
        let mut traza = Vec::new();
        let d = ciclo::drenar(&raiz, &plataforma, &mut almacen, &cliente, &mut traza);
        for t in &traza {
            println!("   {t}");
        }
        println!("   drenaje: {d:?}\n");

        // **EL PUNTO DE CONTROL VA ACA**, donde un barrido TERMINO algo — no por
        // archivo. Escribe las dos mitades juntas, asi que un corte las rebobina al mismo
        // punto y el barrido siguiente vuelve a derivar lo perdido.
        deposito
            .guardar(&almacen, Some(&token))
            .map_err(|e| e.to_string())?;
    }

    if let Some(m) = almacen.colas().detenido() {
        println!("DETENIDA: {m:?}");
    }
    for muerta in almacen.colas().cola_muerta() {
        // Las rutas y los retenidos van en la MISMA linea a proposito: una alerta que no
        // dice de que rutas habla ni cuanto esta reteniendo obliga a leer el log entero, y
        // el panel tiene que decir lo mismo. Sin el contador, todo lo que esas rutas
        // produzcan despues del rechazo es mudo.
        println!(
            "COLA MUERTA {} · rutas={:?} · hechos retenidos={} · {}",
            muerta.status,
            muerta
                .rutas
                .iter()
                .map(|r| r.como_str())
                .collect::<Vec<_>>(),
            muerta.retenidos,
            muerta.respuesta
        );
    }
    Ok(())
}

/// EL PASO 2 DEL ENROLAMIENTO, y este demo **no lo puede completar solo**: aprobar es un
/// acto de la persona desde su cuenta, y ni `Cliente` ni este binario tienen con que
/// hacerlo. Lo que se hace es lo que hara la app de bandeja: mostrar el codigo y esperar.
fn vincular(base: &str, tiempos: Tiempos) -> Result<Option<Secreto>, Box<dyn std::error::Error>> {
    let sin_vincular = Cliente::nuevo(BaseDeApi::nueva(base)?, Credencial::SinAutenticar, tiempos);
    let v = sin_vincular.enrolar().map_err(|e| format!("{e:?}"))?;
    println!("\n  ┌─────────────────────────────────────────────┐");
    println!("  │  codigo de vinculacion:   {}              │", v.codigo);
    println!("  └─────────────────────────────────────────────┘");
    println!("  aprobalo desde tu cuenta. Contra el simulador:\n");
    println!(
        r#"    curl -s -XPOST {base}/enroll/approve -d '{{"code":"{}","userId":"vos"}}'"#,
        v.codigo
    );

    for intento in 1..=banco::INTENTOS_DE_VINCULACION {
        match sin_vincular.reclamar(&v).map_err(|e| format!("{e:?}"))? {
            Reclamo::Aprobado { token, usuario } => {
                println!("  vinculado a {usuario}\n");
                return Ok(Some(token));
            }
            Reclamo::Pendiente => {
                println!("  esperando aprobacion... ({intento})");
                std::thread::sleep(banco::ESPERA_DE_VINCULACION);
            }
            Reclamo::Denegado => {
                println!("  la vinculacion fue DENEGADA");
                return Ok(None);
            }
            Reclamo::Vencido => {
                println!("  el codigo VENCIO: volve a arrancar para pedir otro");
                return Ok(None);
            }
        }
    }
    println!("  nadie aprobo el codigo. Sin token no se habla con la API.");
    Ok(None)
}
