//! El doble configurable.
//!
//! Existe por la misma razon que `apps/folder-agent/sim/server.ts`: sin el,
//! `PoliticaDeDeshidratacion::SeAbreSinHidratar` y el brazo de arranque de Windows no
//! los ejerce NADIE en el unico sistema operativo donde hoy se desarrolla.
//!
//! Y ademas **CUENTA LAS LLAMADAS**, que es lo que vuelve acreditables dos invariantes
//! que de otro modo serian afirmaciones: «un deshidratado nunca se lee» (contador de
//! lecturas) y «un disco montado no puede costar una enumeracion por archivo»
//! (contador de sondeos de raiz).

use super::{
    Clase, CursorDurable, EntradaEnumerada, EvidenciaDeRaiz, FalloDeEnumeracion, FalloDeLectura,
    Ficha, Hidratacion, HuellaDeRaiz, IdDeVolumen, MotivoDeBarrido, MotivoIndeterminado,
    PlanDeArranque, Plataforma, PoliticaDeDeshidratacion, RaizRegistrada, ResultadoDeEnumeracion,
};
use crate::dominio::{HashAfirmado, IdDeArchivoDelSO, Instante, Mtime, Observacion, RutaRelativa};
use std::collections::BTreeMap;
use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;

/// Un archivo del arbol de mentira.
#[derive(Clone, Debug)]
pub struct ArchivoFalso {
    pub observacion: Observacion,
    pub hidratacion: Hidratacion,
    pub contenido: Vec<u8>,
}

#[derive(Default, Debug)]
struct Contadores {
    lecturas: u64,
    sondeos_de_raiz: u64,
    fichas: u64,
}

pub struct Falsa {
    arbol: Mutex<BTreeMap<RutaRelativa, ArchivoFalso>>,
    ilegibles: Mutex<BTreeMap<RutaRelativa, MotivoIndeterminado>>,
    reloj: Mutex<u64>,
    evidencia: Mutex<Option<EvidenciaDeRaiz>>,
    granularidad: Mutex<Duration>,
    deshidratacion: PoliticaDeDeshidratacion,
    arranque: MotivoDeBarrido,
    contadores: Mutex<Contadores>,
}

impl Falsa {
    /// Un arbol en memoria mas las DOS politicas elegibles. Con `SeAbreSinHidratar` y
    /// `BarridoCompleto{LaPlataformaNoLoTiene}`, la maquina corre su camino de Windows
    /// entero sobre un Mac.
    pub fn nueva(deshidratacion: PoliticaDeDeshidratacion, arranque: MotivoDeBarrido) -> Self {
        Self {
            arbol: Mutex::new(BTreeMap::new()),
            ilegibles: Mutex::new(BTreeMap::new()),
            reloj: Mutex::new(0),
            evidencia: Mutex::new(None),
            // Cero por omision: sin granularidad declarada, dos `mtime` distintos son
            // distintos. Es el lado seguro — comparar exacto cuesta un rehash de mas,
            // nunca una edicion perdida.
            granularidad: Mutex::new(Duration::ZERO),
            deshidratacion,
            arranque,
            contadores: Mutex::new(Contadores::default()),
        }
    }

    /// El doble de macOS: lee materializando, y arranca por replay.
    pub fn como_macos() -> Self {
        Self::nueva(
            PoliticaDeDeshidratacion::LeerMaterializa,
            MotivoDeBarrido::SinInventario,
        )
    }

    /// El doble de Windows: abre sin hidratar, y el arranque es SIEMPRE un barrido
    /// completo. Este constructor es el que hace que el brazo de Windows corra en un
    /// Mac todos los dias.
    pub fn como_windows() -> Self {
        Self::nueva(
            PoliticaDeDeshidratacion::SeAbreSinHidratar,
            MotivoDeBarrido::LaPlataformaNoLoTiene,
        )
    }

    pub fn poner(&self, ruta: &str, contenido: &[u8], mtime_s: i64, id: Option<u128>) {
        self.poner_con(
            ruta,
            contenido,
            mtime_s,
            id,
            Hidratacion::Materializado,
            contenido.len() as u64,
        );
    }

    /// El caso peor de la salvaguarda 5: un deshidratado cuyo TAMANO cambio (el
    /// placeholder queda en 0 bytes), asi que la tripleta se ve «cambiada» y un arbol
    /// que preguntara la hidratacion despues de comparar seguiria derecho a HASH.
    pub fn poner_deshidratado(&self, ruta: &str, mtime_s: i64, id: Option<u128>) {
        self.poner_con(ruta, &[], mtime_s, id, Hidratacion::Deshidratado, 0);
    }

    pub fn poner_con(
        &self,
        ruta: &str,
        contenido: &[u8],
        mtime_s: i64,
        id: Option<u128>,
        hidratacion: Hidratacion,
        tamano: u64,
    ) {
        let r = RutaRelativa::canonica(ruta).expect("ruta del banco");
        self.arbol.lock().unwrap().insert(
            r,
            ArchivoFalso {
                observacion: Observacion {
                    tamano,
                    mtime: Mtime {
                        segundos: mtime_s,
                        nanos: 0,
                    },
                    id_de_archivo: id.map(IdDeArchivoDelSO),
                },
                hidratacion,
                contenido: contenido.to_vec(),
            },
        );
    }

    pub fn sacar(&self, ruta: &str) {
        let r = RutaRelativa::canonica(ruta).expect("ruta del banco");
        self.arbol.lock().unwrap().remove(&r);
    }

    /// Una ruta que existe y no se puede mirar. Es el caso que ROOT no atrapa: la
    /// carpeta se enumera perfecto y aun asi lo de adentro es ilegible.
    pub fn poner_ilegible(&self, ruta: &str, motivo: MotivoIndeterminado) {
        let r = RutaRelativa::canonica(ruta).expect("ruta del banco");
        self.ilegibles.lock().unwrap().insert(r, motivo);
    }

    /// Mueve el reloj a mano, **incluyendo saltos que imitan una suspension**. Es lo que
    /// permite ejercer el asentamiento sin dormir la laptop.
    pub fn avanzar(&self, cuanto: Duration) {
        let mut r = self.reloj.lock().unwrap();
        *r += cuanto.as_nanos() as u64;
    }

    pub fn con_granularidad(&self, g: Duration) {
        *self.granularidad.lock().unwrap() = g;
    }

    /// Fuerza la evidencia de raiz. Sin esto, la falsa contesta que la raiz esta viva y
    /// coincide, que es el caso normal.
    pub fn forzar_evidencia(&self, e: EvidenciaDeRaiz) {
        *self.evidencia.lock().unwrap() = Some(e);
    }

    /// El disco desmontado, dicho en una linea de banco.
    pub fn desmontar(&self) {
        self.forzar_evidencia(EvidenciaDeRaiz {
            enumeracion: ResultadoDeEnumeracion::Fallo(FalloDeEnumeracion::NoMontado),
            volumen: None,
            directorio: None,
        });
    }

    pub fn lecturas(&self) -> u64 {
        self.contadores.lock().unwrap().lecturas
    }
    pub fn sondeos_de_raiz(&self) -> u64 {
        self.contadores.lock().unwrap().sondeos_de_raiz
    }
    pub fn fichas(&self) -> u64 {
        self.contadores.lock().unwrap().fichas
    }
    pub fn reiniciar_contadores(&self) {
        *self.contadores.lock().unwrap() = Contadores::default();
    }

    /// La huella que la falsa registra al enrolar. Publica para que el banco pueda
    /// construir una `RaizRegistrada` sin tocar disco.
    pub fn huella_del_banco() -> HuellaDeRaiz {
        HuellaDeRaiz {
            volumen: IdDeVolumen::Uuid([7u8; 16]),
            directorio: IdDeArchivoDelSO(1),
        }
    }
}

impl Plataforma for Falsa {
    fn politica_de_deshidratacion(&self) -> PoliticaDeDeshidratacion {
        self.deshidratacion
    }

    fn plan_de_arranque(
        &self,
        _raiz: &RaizRegistrada,
        _cursor: Option<&CursorDurable>,
    ) -> PlanDeArranque {
        PlanDeArranque::BarridoCompleto {
            porque: self.arranque,
        }
    }

    fn huella_de_raiz(&self, _ruta: &Path) -> Result<HuellaDeRaiz, FalloDeEnumeracion> {
        Ok(Falsa::huella_del_banco())
    }

    fn evidencia_de_raiz(&self, _raiz: &RaizRegistrada) -> EvidenciaDeRaiz {
        self.contadores.lock().unwrap().sondeos_de_raiz += 1;
        if let Some(e) = self.evidencia.lock().unwrap().clone() {
            return e;
        }
        let h = Falsa::huella_del_banco();
        let entradas = self
            .arbol
            .lock()
            .unwrap()
            .iter()
            .map(|(ruta, a)| EntradaEnumerada {
                ruta: ruta.clone(),
                clase: Clase::Archivo,
                observacion: a.observacion,
                hidratacion: a.hidratacion,
            })
            .collect();
        EvidenciaDeRaiz {
            enumeracion: ResultadoDeEnumeracion::Listada {
                entradas,
                errores: Vec::new(),
            },
            volumen: Some(h.volumen),
            directorio: Some(h.directorio),
        }
    }

    fn ficha(&self, _raiz: &RaizRegistrada, ruta: &RutaRelativa) -> Ficha {
        self.contadores.lock().unwrap().fichas += 1;
        if let Some(m) = self.ilegibles.lock().unwrap().get(ruta) {
            return Ficha::Indeterminada(*m);
        }
        match self.arbol.lock().unwrap().get(ruta) {
            Some(a) => Ficha::Presente {
                observacion: a.observacion,
                hidratacion: a.hidratacion,
            },
            None => Ficha::NoExiste,
        }
    }

    fn hashear(
        &self,
        _raiz: &RaizRegistrada,
        ruta: &RutaRelativa,
    ) -> Result<(HashAfirmado, Observacion), FalloDeLectura> {
        // El contador sube ANTES de mirar la hidratacion, a proposito: si subiera
        // despues, un arbol que se colara hasta aca sobre un deshidratado quedaria sin
        // contar y el invariante «cero lecturas» pasaria verde estando roto.
        self.contadores.lock().unwrap().lecturas += 1;
        let arbol = self.arbol.lock().unwrap();
        let a = arbol.get(ruta).ok_or(FalloDeLectura::YaNoEsta)?;
        if a.hidratacion != Hidratacion::Materializado
            && self.deshidratacion == PoliticaDeDeshidratacion::LeerMaterializa
        {
            return Err(FalloDeLectura::HidratacionRequerida);
        }
        Ok((crate::hash::sha256(&a.contenido), a.observacion))
    }

    fn leer_para_subir(
        &self,
        _raiz: &RaizRegistrada,
        ruta: &RutaRelativa,
    ) -> Result<Vec<u8>, FalloDeLectura> {
        self.contadores.lock().unwrap().lecturas += 1;
        let arbol = self.arbol.lock().unwrap();
        let a = arbol.get(ruta).ok_or(FalloDeLectura::YaNoEsta)?;
        if a.hidratacion != Hidratacion::Materializado
            && self.deshidratacion == PoliticaDeDeshidratacion::LeerMaterializa
        {
            return Err(FalloDeLectura::HidratacionRequerida);
        }
        Ok(a.contenido.clone())
    }

    fn granularidad_de_mtime(&self, _raiz: &RaizRegistrada) -> Duration {
        *self.granularidad.lock().unwrap()
    }

    fn ahora(&self) -> Instante {
        Instante::desde_nanos(*self.reloj.lock().unwrap())
    }
}
