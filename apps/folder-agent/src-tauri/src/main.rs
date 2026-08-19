//! EL BINARIO: corre el ciclo entero contra `apps/folder-agent/sim/server.ts`.
//!
//! No es Tauri y no tiene interfaz. Es «la unica parte que no espera a nada» del
//! borrador: el protocolo esta completamente especificado, asi que el agente se
//! construye contra un servidor simulado y se enchufa despues.
//!
//! Uso:
//! ```text
//!   node apps/folder-agent/sim/server.ts        # en otra terminal
//!   cargo run -- <ruta-de-la-raiz> [http://127.0.0.1:4477]
//! ```
//!
//! **LOS NUMEROS DE ESTE ARCHIVO SON PARAMETROS DEL BANCO, NO DEL PRODUCTO**, igual que
//! los de `sim/server.ts`. Van rotulados para que nadie los lea como una medicion: los
//! cuatro del canal siguen en `None` en `parametros.rs`, y este binario los provee
//! explicitamente porque `Politica` no tiene `Default` y no deja saltearlo.

use savia_folder_nucleo::almacen::Almacen;
use savia_folder_nucleo::ciclo;
use savia_folder_nucleo::colas::ParametrosDeCola;
use savia_folder_nucleo::dominio::{BarridoId, RaizId, SensibilidadAMayusculas};
// LA PLATAFORMA SE ELIGE POR `cfg`, Y NO ES ADORNO: con `Macos` cableado, este
// binario NO CRUZABA a Windows y el guardian que lo cross-chequea no podia existir.
// La biblioteca si cruzaba —verificado— asi que el hueco era del demo, no del nucleo.
#[cfg(target_os = "macos")]
use savia_folder_nucleo::plataforma::Macos as PlataformaLocal;
#[cfg(target_os = "windows")]
use savia_folder_nucleo::plataforma::Windows as PlataformaLocal;
use savia_folder_nucleo::plataforma::{Plataforma, RaizRegistrada};
use savia_folder_nucleo::protocolo::{BaseDeApi, Cliente, Credencial, Tiempos};
use savia_folder_nucleo::salvaguardas::Politica;

/// Parametros del BANCO. Chicos para que una corrida termine en segundos.
mod banco {
    use std::time::Duration;
    /// ms — el intervalo de asentamiento. **Producto: SIN MEDIR** (ver
    /// `parametros::ASENTAMIENTO`). Aca vale 300 ms para que el demo no tarde.
    pub const ASENTAMIENTO: Duration = Duration::from_millis(300);
    pub const TIEMPO_DE_CONEXION: Duration = Duration::from_secs(5);
    pub const TIEMPO_POR_LLAMADA: Duration = Duration::from_secs(30);
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
    let mut almacen = Almacen::nuevo(ParametrosDeCola {
        // Los dos en `None`: ver `parametros.rs`. Ninguno descarta nada.
        max_intentos: None,
        max_entradas_por_lote: None,
    });
    almacen.enrolar(registrada);

    let cliente = Cliente::nuevo(
        BaseDeApi::nueva(&base)?,
        // El token de dispositivo no existe todavia y el simulador ignora headers.
        Credencial::SinAutenticar,
        Tiempos {
            conexion: banco::TIEMPO_DE_CONEXION,
            por_llamada: banco::TIEMPO_POR_LLAMADA,
            envio_de_cuerpo: None,
        },
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
