//! **ESTADO Y COLA SON UNA SOLA ESCRITURA.**
//!
//! La unica mentira intolerable de este canal es que el agente crea que Savia sabe algo
//! que no sabe. Si `estadoDeReporte` pasa a confirmado y el hecho no sale de la cola en
//! el mismo commit, nadie se entera nunca: no hay reintento, no hay alerta, el archivo
//! simplemente no existe en Savia.
//!
//! Por eso **no hay un metodo publico que escriba el estado sin tocar la cola ni al
//! reves**. Lo que hay son los eventos que legitimamente lo cambian, y cada uno hace las
//! dos escrituras en una sola llamada `&mut self`.
//!
//! `&mut self` EN TODA ESCRITURA es la disciplina de un solo escritor, impuesta por el
//! compilador en vez de por un mutex que se puede omitir.
//!
//! DONDE ESTA LA TRANSACCION, DICHO SIN ADORNOS: en que las dos mitades viven en la misma
//! estructura y se escriben en la misma llamada. En disco eso se sostiene con una sola
//! transaccion de `redb` que escribe **las dos juntas** (ver `persistencia.rs`); si la
//! cola se guardara aparte harian falta dos fases, que es exactamente la razon por la que
//! no se guarda aparte.
//!
//! **EL DISENO DECIA SQLITE Y NO ES SQLITE, y el disparador esta medido**: `rusqlite` con
//! `bundled` compila `sqlite3.c` con `cc`, y eso rompe
//! `cargo check --target x86_64-pc-windows-msvc` desde un Mac —no hay headers de MSVC—.
//! Ese cross-check es lo unico que sostiene que `plataforma/windows.rs` compila, asi que
//! el precio de SQLite era quedarse sin el. `redb` es Rust puro, cruza limpio, y su unica
//! dependencia transitiva es `libc`, que el crate ya tenia.
#![forbid(unsafe_code)]

use crate::colas::{
    Colas, Confirmacion, Desenlace, Encolado, ParametrosDeCola, Proximo, SegmentoId, TrabajoId,
};
use crate::inventario::InventarioEnMemoria;
use savia_folder_contrato::dominio::{
    BarridoId, EstadoDelBarrido, HashVerificado, RaizId, RutaRelativa,
};
use savia_folder_contrato::inventario::{EfectoDeInventario, Inventario};
use savia_folder_contrato::plataforma::RaizRegistrada;
use savia_folder_maquina::maquina::{Cierre, Paso};
use savia_folder_politica::salvaguardas::Hecho;

pub struct Almacen {
    inventario: InventarioEnMemoria,
    colas: Colas,
}

/// **LA UNIDAD QUE SE PERSISTE, Y ES UNA SOLA A PROPOSITO.** Las dos mitades salen y
/// entran juntas porque separarlas reintroduce en disco justo la mentira que este modulo
/// existe para impedir: un estado que dice «Savia sabe esto» y una cola que no tiene el
/// hecho.
///
/// Los campos son PRIVADOS, asi que fuera de este modulo no se puede armar un `Estado`
/// con mitades que no se correspondan.
#[derive(serde::Serialize)]
pub struct EstadoParaGuardar<'a> {
    inventario: &'a InventarioEnMemoria,
    colas: &'a Colas,
}

#[derive(serde::Deserialize)]
pub struct EstadoLeido {
    inventario: InventarioEnMemoria,
    colas: Colas,
}

impl Almacen {
    /// Por REFERENCIA y no por clon: el estado de un corpus grande no se copia entero
    /// cada vez que se hace un punto de control.
    pub fn para_guardar(&self) -> EstadoParaGuardar<'_> {
        EstadoParaGuardar {
            inventario: &self.inventario,
            colas: &self.colas,
        }
    }

    /// **NO VALIDA NADA, Y NO PUEDE**: lo que entra es lo que salio de una sola
    /// transaccion, asi que las dos mitades ya se corresponden por construccion. Si
    /// alguna vez se guardaran por separado, aca haria falta una reconciliacion — que es
    /// otra razon para no guardarlas por separado.
    pub fn desde(estado: EstadoLeido) -> Self {
        Self {
            inventario: estado.inventario,
            colas: estado.colas,
        }
    }

    pub fn nuevo(parametros: ParametrosDeCola) -> Self {
        Self {
            inventario: InventarioEnMemoria::nuevo(),
            colas: Colas::nuevas(parametros),
        }
    }

    /// Lectura. El puerto que la maquina consume es `&dyn Inventario`, y no tiene un solo
    /// metodo de escritura.
    pub fn inventario(&self) -> &InventarioEnMemoria {
        &self.inventario
    }

    pub fn colas(&self) -> &Colas {
        &self.colas
    }

    /// Delegacion directa a `Colas::reanudar` — ver su doc. El unico llamador legitimo es
    /// el hilo de trabajo, en el mismo punto donde adopta una credencial nueva.
    pub fn reanudar(&mut self) {
        self.colas.reanudar();
    }

    pub fn enrolar(&mut self, r: RaizRegistrada) {
        self.inventario.enrolar(r);
    }

    /// **DEJAR DE MIRAR: las dos mitades, o ninguna.** Saca la raiz del registro y suelta
    /// todo lo que tenia encolado, en una sola llamada, por la misma razon que `aplicar`
    /// escribe inventario y cola juntos: una mitad sin la otra deja al agente subiendo
    /// archivos de una carpeta que ya no esta en la lista, o mostrando una carpeta que ya
    /// no tiene cola.
    ///
    /// Lo que NO hace: dar de baja nada en Savia. Ver
    /// `docs/product/savia-b2b/onboarding-agente-carpeta.md` — «Retirar todo» necesita un
    /// llamado que todavia no existe, porque el corte por volumen es de Savia y no puede
    /// distinguir una baja pedida de un disco que monto mal.
    ///
    /// Devuelve `None` si la raiz no estaba enrolada, y `Some(n)` con los trabajos
    /// soltados si estaba.
    pub fn desenrolar(&mut self, raiz: &savia_folder_contrato::dominio::RaizId) -> Option<usize> {
        if !self.inventario.desenrolar(raiz) {
            return None;
        }
        Some(self.colas.olvidar(raiz))
    }

    /// **EL COMMIT.** Aplica los efectos del `Paso` y encola su hecho, juntos. No existe
    /// forma de hacer una mitad sin la otra: son una sola afirmacion —«Savia sabe
    /// esto»— escrita en dos lugares.
    pub fn comprometer(
        &mut self,
        raiz: &RaizId,
        barrido: Option<&BarridoId>,
        paso: Paso,
    ) -> Option<Encolado> {
        for e in &paso.efectos {
            self.inventario.aplicar(raiz, e, barrido);
        }
        paso.hecho.map(|h| self.colas.encolar(raiz, h))
    }

    /// El cierre del barrido, tambien de una pieza: se anulan las bajas que resultaron
    /// movimientos ANTES de transmitir, se aplican los efectos, se encolan las bajas que
    /// el recorrido descubrio, y se cierra el segmento.
    pub fn comprometer_cierre(
        &mut self,
        raiz: &RaizId,
        barrido: &BarridoId,
        segmento: crate::colas::SegmentoId,
        cierre: Cierre,
    ) -> EstadoDelBarrido {
        self.colas.anular_bajas(raiz, &cierre.anular);
        for e in &cierre.efectos {
            self.inventario.aplicar(raiz, e, Some(barrido));
        }
        for baja in cierre.bajas {
            self.colas.encolar(raiz, Hecho::Desaparecio(baja));
        }
        self.colas.cerrar_barrido(segmento, cierre.estado);
        cierre.estado
    }

    pub fn abrir_barrido(
        &mut self,
        raiz: &RaizId,
        barrido: BarridoId,
    ) -> (crate::colas::SegmentoId, u64) {
        // El denominador que el corte por volumen necesita: el tamano del inventario de
        // esa raiz. Es lo unico conocido AL ABRIR — lo enumerado en este barrido todavia
        // no se sabe.
        let total = self.inventario.vivos(raiz);
        let s = self.colas.abrir_barrido(raiz, barrido, total);
        (s, total)
    }

    /// **NO ES UN HECHO, ASI QUE NO LLEVA LA OTRA MITAD.** El padron no cambia nada de
    /// lo que el agente cree que Savia sabe —no toca `estadoDeReporte` ni una fila—: es
    /// la lista de lo que el recorrido vio, guardada al lado del segmento que la vio. Por
    /// eso puede escribir la cola sola sin romper la regla de arriba, igual que
    /// `abrir_barrido`.
    pub fn registrar_padron(
        &mut self,
        segmento: SegmentoId,
        entradas: Vec<(RutaRelativa, Option<HashVerificado>)>,
    ) {
        self.colas.registrar_padron(segmento, entradas);
    }

    pub fn marcar_vista(&mut self, raiz: &RaizId, ruta: &RutaRelativa, barrido: &BarridoId) {
        self.inventario.marcar_vista(raiz, ruta, barrido);
    }

    pub fn siguiente(&self, raiz: &RaizId) -> Proximo {
        self.colas.siguiente(raiz)
    }

    /// La otra mitad del commit: lo que vuelve del servidor mueve el estado del
    /// inventario Y saca el trabajo de la cola, en una sola llamada. **Es el unico
    /// mecanismo por el que el agente pasa a creer que Savia sabe algo.**
    pub fn resolver(
        &mut self,
        raiz: &RaizId,
        trabajo: &TrabajoId,
        desenlace: Desenlace,
    ) -> Vec<Confirmacion> {
        let confirmaciones = self.colas.resolver(trabajo, desenlace);
        for c in &confirmaciones {
            match c {
                Confirmacion::HashConfirmado { ruta, hash } => {
                    self.inventario.aplicar(
                        raiz,
                        &EfectoDeInventario::CorregirHash {
                            ruta: ruta.clone(),
                            verificado: *hash,
                        },
                        None,
                    );
                }
                // **LA DUDA SE ESCRIBE, Y ESA ES LA MITAD QUE FALTABA.** «Se cura por el
                // camino normal» no ocurre sola: la tripleta del archivo no cambio, asi
                // que sin marcar la fila el barrido siguiente toma la rama NOOP y esa ruta
                // no se re-observa NUNCA. Queda `Afirmado` para siempre, y
                // `puerta_de_baja` exige el confirmado: su baja no sale jamas.
                Confirmacion::HashEnDuda { ruta } => {
                    self.inventario.aplicar(
                        raiz,
                        &EfectoDeInventario::MarcarHashEnDuda { ruta: ruta.clone() },
                        None,
                    );
                }
                // Las otras dos no escriben el inventario: `BajaEntregada` ya tiene su
                // lapida puesta por el `Paso` que la produjo, y `Retirados` es informativo
                // para el panel, nunca fuente de verdad.
                Confirmacion::BajaEntregada { .. } => {}
                Confirmacion::Retirados { .. } => {}
            }
        }
        confirmaciones
    }
}
