//! LA PERSISTENCIA. `redb`, una sola transaccion por punto de control, y **el I/O vive
//! aca** — `inventario.rs` esta en la lista de modulos PUROS y el guardian lo verifica.
//!
//! # Por que no es SQLite, teniendo el diseno escrito que lo pedia
//!
//! `rusqlite` con `bundled` compila `sqlite3.c` con `cc`, y eso rompe
//! `cargo check --target x86_64-pc-windows-msvc` desde un Mac: no hay headers de MSVC
//! (`fatal error: 'stdlib.h' file not found`). Ese cross-check es lo unico que sostiene
//! que `plataforma/windows.rs` compila —los cuerpos estan en `unimplemented!()`, asi que
//! sin el no queda nada verificando ni las firmas—, y cambiarlo por SQLite era pagarlo
//! con eso. `redb` es Rust puro, cruza limpio a los dos targets, y su unica dependencia
//! transitiva es `libc`, que el crate ya tenia.
//!
//! # Punto de control, no delta
//!
//! Se escribe el estado ENTERO, y no un delta por efecto. Es una decision de correccion
//! antes que de rendimiento: **un corte de luz rebobina las dos mitades al mismo punto**,
//! que es exactamente el invariante que `almacen.rs` existe para sostener. El barrido
//! siguiente vuelve a derivar los hechos perdidos, porque las filas que los habrian
//! silenciado se rebobinaron con ellos.
//!
//! **Y EL COSTO HAY QUE DECIRLO**: escribir todo cuesta O(corpus) por punto de control,
//! asi que los puntos de control van donde un barrido TERMINA algo —al cerrar y al
//! drenar—, nunca por archivo. Un corpus de 50.000 archivos son unos pocos MB por
//! escritura y un puñado de escrituras por barrido; el dia que eso moleste, el camino es
//! una fila por archivo en su propia tabla, y `EfectoDeInventario` ya nombra exactamente
//! que filas toco cada paso. No se hace ahora porque duplicaria en este modulo la
//! semantica que hoy vive solo en `InventarioEnMemoria`.
//!
//! # El formato es un contrato
//!
//! Los tipos del dominio derivan `serde` y se guardan como JSON. Que el formato salga de
//! los tipos y no de un espejo escrito a mano es barato, pero deja una trampa: renombrar
//! un campo cambia el formato en disco SIN QUE NADA AVISE, y un agente actualizado no lee
//! lo que escribio el anterior. Lo que cierra esa trampa es el golden de
//! `tests/persistencia.rs`, que fija los bytes de un estado representativo — igual que
//! `alambre.rs` fija el cable.
#![forbid(unsafe_code)]

use redb::{Database, TableDefinition};
use savia_folder_contrato::protocolo::Secreto;
use savia_folder_estado::almacen::{Almacen, EstadoLeido};
use std::path::Path;

/// **LA VERSION DEL FORMATO, Y SE COMPARA CON `!=` Y NO CON `<`.** Un agente viejo que
/// abra un deposito nuevo tiene que negarse igual que uno nuevo con un deposito viejo:
/// leer con la version equivocada no es un error que se pueda absorber, es una fila que
/// se interpreta mal en silencio.
pub const FORMATO: u32 = 3;

// ── Historia del formato ────────────────────────────────────────────────────
//
//   1 → 2   `Colas` gana `congeladas`: las raices cuyo ultimo `sweep.close` vino con
//           `frozen`. **No lleva migracion, y la razon es que el 1 no existe en ningun
//           disco fuera de este repo** — el agente no se instalo en ninguna maquina
//           todavia (no hay instalador ni firma). Un deposito 1 solo puede ser el de una
//           corrida de desarrollo, y para ese caso `FormatoAjeno` es la respuesta
//           correcta: se borra y se vuelve a barrer.
//
//   2 → 3   `Colas` gana `completaron_barrido`: las raices que cerraron al menos un
//           barrido alguna vez — sin esto el panel no puede distinguir «carpeta recien
//           enrolada, todavia no se sabe nada» de «carpeta genuinamente vacia» (ver
//           `panel::de_una_carpeta`). Misma excusa que 1 → 2, todavia vigente: **no
//           lleva migracion** porque el agente sigue sin instalarse en ninguna maquina.
//
//           **Esta excusa se agota el dia que el agente se instale en la primera
//           maquina.** A partir de ahi, subir este numero sin escribir la conversion
//           significa que alguien pierde sus lapidas.

const TABLA: TableDefinition<&str, &[u8]> = TableDefinition::new("almacen");
const K_FORMATO: &str = "formato";
const K_ESTADO: &str = "estado";
const K_CREDENCIAL: &str = "credencial";

#[derive(Debug)]
pub enum FalloDePersistencia {
    /// El archivo no se pudo abrir, leer o escribir.
    Disco(String),
    /// Hay deposito, pero de otra version del formato.
    FormatoAjeno { encontrado: u32, esperado: u32 },
    /// El deposito existe y lo que hay adentro no tiene la forma esperada. **No se
    /// absorbe como «arranco de cero»**: un deposito ilegible puede ser un bug de
    /// formato, y tratarlo como vacio significa reportar todo el corpus como nuevo y
    /// olvidar las lapidas de todo lo que se borro.
    Corrupto(String),
}

impl std::fmt::Display for FalloDePersistencia {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Disco(d) => write!(f, "no se pudo usar el deposito: {d}"),
            Self::FormatoAjeno {
                encontrado,
                esperado,
            } => write!(
                f,
                "el deposito es de formato {encontrado} y este agente habla {esperado}"
            ),
            Self::Corrupto(d) => write!(f, "el deposito no se pudo interpretar: {d}"),
        }
    }
}

/// Lo que hay que reconstruir al arrancar: el estado, y la credencial si ya se enrolo.
pub struct Rescatado {
    pub almacen: Almacen,
    pub credencial: Option<Secreto>,
}

pub struct Deposito {
    db: Database,
}

impl Deposito {
    /// **NUNCA ADENTRO DE UNA RAIZ VIGILADA**, y quien elige la ruta es el llamador. Este
    /// modulo no la puede verificar —no conoce las raices— asi que lo impone `main`, que
    /// la arma en el directorio de datos de la app. Un deposito adentro de una carpeta
    /// vigilada se observa a si mismo: cada escritura produce un evento, que produce un
    /// barrido, que produce una escritura.
    pub fn abrir(ruta: &Path) -> Result<Self, FalloDePersistencia> {
        let db = Database::create(ruta).map_err(|e| FalloDePersistencia::Disco(e.to_string()))?;
        Ok(Self { db })
    }

    /// Reescribe el deposito entero en un archivo nuevo y lo deja en lugar del viejo.
    /// Devuelve `(bytes antes, bytes despues)`. Un deposito vacio o ilegible se deja
    /// intacto y devuelve el mismo tamano dos veces.
    ///
    /// # Por que existe, y por que NO es `Database::compact`
    ///
    /// `redb` reutiliza sus paginas libres —comprobado: con el agente guardando cada
    /// 30 s el archivo no crece— pero **nunca baja de su marca de agua historica**. Basta
    /// un periodo indexando algo que despues se excluyo para dejar esa marca puesta, y
    /// nada la vuelve a bajar.
    ///
    /// **Las mediciones que llevaron a esta forma y no a la otra**, sobre el deposito de
    /// desarrollo de esta rama:
    ///
    /// | | |
    /// |---|---|
    /// | archivo encontrado | 1216 MB |
    /// | JSON de estado adentro (`K_ESTADO`, volcado y pesado) | 170 MB |
    /// | `Database::compact()`, 1ra pasada | 1216 MB -> 864 MB en 451 ms |
    /// | `Database::compact()`, 5 pasadas mas | 864 MB -> 864 MB, sin mover un byte |
    /// | deposito RECONSTRUIDO con el mismo contenido | **513 MB** |
    ///
    /// O sea: la compactacion de `redb` recupero el 29% y despues se planto —devuelve
    /// `Ok(true)` cada vez, pero el archivo no baja—, mientras que reescribir el mismo
    /// contenido de cero baja a 513 MB. El sobrante de 1216 sobre 170 es sobre todo que
    /// `redb` conserva la version anterior de un valor de ese tamano ademas de la nueva;
    /// reescribir deja una sola.
    ///
    /// **Lo que esto NO arregla, y hay que decirlo aca para que nadie lo confunda:** de
    /// esos 170 MB, 169 son `colas.segmentos` y 156 son padrones de segmentos que ya se
    /// entregaron. El estado que de verdad sirve —el inventario— pesa 0,68 MB. Esto
    /// achica el envase; el contenido lo infla una fuga aparte, en `Colas`, donde cada
    /// barrido hace `push` de un segmento que nadie saca nunca.
    ///
    /// # Por que es seguro
    ///
    /// El nuevo se escribe en un archivo TEMPORAL y recien al final se hace `rename`
    /// sobre el viejo, que en POSIX es atomico. Un corte de luz a mitad deja el deposito
    /// viejo intacto: o esta el viejo entero, o esta el nuevo entero, nunca una mezcla.
    /// Es el mismo criterio de «las dos mitades entran juntas o no entran» que sostiene
    /// `guardar`.
    pub fn reconstruir(ruta: &Path) -> Result<(u64, u64), FalloDePersistencia> {
        let pesa = |p: &Path| std::fs::metadata(p).map(|m| m.len()).unwrap_or(0);
        let antes = pesa(ruta);

        let rescatado = {
            let viejo = Self::abrir(ruta)?;
            match viejo.cargar()? {
                // Deposito vacio: no hay nada que reconstruir, y crear un archivo nuevo
                // solo para dejarlo igual de vacio es trabajo sin ganancia.
                None => return Ok((antes, antes)),
                Some(r) => r,
            }
        }; // el `Database` viejo se cierra ACA — antes de tocar el archivo.

        let temporal = ruta.with_extension("reconstruyendo");
        // Un temporal de una reconstruccion anterior interrumpida no es un error: es
        // basura, y lo unico correcto es pisarla.
        let _ = std::fs::remove_file(&temporal);
        {
            let nuevo = Self::abrir(&temporal)?;
            nuevo.guardar(&rescatado.almacen, rescatado.credencial.as_ref())?;
        } // y el nuevo se cierra ACA, para que el `rename` no mueva un archivo abierto.

        std::fs::rename(&temporal, ruta).map_err(|e| FalloDePersistencia::Disco(e.to_string()))?;
        Ok((antes, pesa(ruta)))
    }

    /// **UNA SOLA TRANSACCION PARA LAS TRES CLAVES.** El estado, la cola y la credencial
    /// entran o no entran juntos: es la misma regla de `almacen.rs`, sostenida en disco.
    pub fn guardar(
        &self,
        almacen: &Almacen,
        credencial: Option<&Secreto>,
    ) -> Result<(), FalloDePersistencia> {
        let estado = serde_json::to_vec(&almacen.para_guardar())
            .map_err(|e| FalloDePersistencia::Corrupto(e.to_string()))?;
        let t = self
            .db
            .begin_write()
            .map_err(|e| FalloDePersistencia::Disco(e.to_string()))?;
        {
            let mut tabla = t
                .open_table(TABLA)
                .map_err(|e| FalloDePersistencia::Disco(e.to_string()))?;
            let disco = |e: redb::StorageError| FalloDePersistencia::Disco(e.to_string());
            tabla
                .insert(K_FORMATO, &FORMATO.to_be_bytes()[..])
                .map_err(disco)?;
            tabla.insert(K_ESTADO, &estado[..]).map_err(disco)?;
            match credencial {
                Some(s) => tabla.insert(K_CREDENCIAL, s.0.as_bytes()).map_err(disco)?,
                // SE BORRA, no se deja lo viejo. Guardar sin credencial despues de una
                // revocacion tiene que dejar el deposito sin credencial: si el token
                // revocado sobreviviera, el proximo arranque volveria a chocar contra un
                // 401 en vez de pedir enrolamiento.
                None => tabla.remove(K_CREDENCIAL).map_err(disco)?,
            };
        }
        t.commit()
            .map_err(|e| FalloDePersistencia::Disco(e.to_string()))
    }

    /// `Ok(None)` es «deposito vacio», que es lo normal en la primera corrida. Un
    /// deposito con contenido que no se entiende es `Err`, nunca `None`.
    pub fn cargar(&self) -> Result<Option<Rescatado>, FalloDePersistencia> {
        let t = self
            .db
            .begin_read()
            .map_err(|e| FalloDePersistencia::Disco(e.to_string()))?;
        let tabla = match t.open_table(TABLA) {
            Ok(t) => t,
            // Tabla inexistente = deposito recien creado.
            Err(redb::TableError::TableDoesNotExist(_)) => return Ok(None),
            Err(e) => return Err(FalloDePersistencia::Disco(e.to_string())),
        };
        let disco = |e: redb::StorageError| FalloDePersistencia::Disco(e.to_string());

        let Some(v) = tabla.get(K_FORMATO).map_err(disco)? else {
            return Ok(None);
        };
        let bytes: [u8; 4] = v
            .value()
            .try_into()
            .map_err(|_| FalloDePersistencia::Corrupto("version de formato ilegible".into()))?;
        let encontrado = u32::from_be_bytes(bytes);
        if encontrado != FORMATO {
            return Err(FalloDePersistencia::FormatoAjeno {
                encontrado,
                esperado: FORMATO,
            });
        }

        let Some(v) = tabla.get(K_ESTADO).map_err(disco)? else {
            return Err(FalloDePersistencia::Corrupto(
                "hay version de formato y no hay estado".into(),
            ));
        };
        let estado: EstadoLeido = serde_json::from_slice(v.value())
            .map_err(|e| FalloDePersistencia::Corrupto(e.to_string()))?;

        let credencial = match tabla.get(K_CREDENCIAL).map_err(disco)? {
            Some(v) => Some(Secreto(
                String::from_utf8(v.value().to_vec())
                    .map_err(|e| FalloDePersistencia::Corrupto(e.to_string()))?,
            )),
            None => None,
        };

        Ok(Some(Rescatado {
            almacen: Almacen::desde(estado),
            credencial,
        }))
    }
}
