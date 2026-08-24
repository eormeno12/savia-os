//! EL GUARDIAN DE TIPOS DE LA FASE 2(a): que `ciclo::drenar`/`ejecutar` acepten
//! cualquier `CanalDeSavia`, no el struct `Cliente` por nombre. Ver
//! docs/product/savia-b2b/plan-rediseno-agente.md, Fase 2, criterio de aceptacion.
//!
//! **A PROPOSITO NO ES UN GREP.** Un `grep` de "Cliente" en `ciclo.rs` es evadible (un
//! alias) y fragil (un comentario legitimo lo dispara). La garantia real la da el
//! compilador: `CanalFalso` de abajo implementa el trait y NO es `Cliente`, y si
//! `drenar`/`ejecutar` volvieran a pedir `&Cliente` concreto, este archivo DEJA DE
//! COMPILAR — no de pasar en verde, deja de compilar.
//!
//! `CanalFalso` no es un doble de HTTP: sus siete metodos son `unreachable!()`. Eso es
//! valido porque la raiz de este test nunca se enrola, asi que `Almacen::siguiente`
//! devuelve `Proximo::Nada` antes de que `ejecutar` llame ningun metodo del canal — el
//! test es sobre TIPOS, no sobre comportamiento. La cobertura de fallas de transporte
//! real la sigue dando `pruebas-integracion/tests/contra_el_simulador.rs`, contra un
//! socket de verdad y sobre el `Cliente` concreto, sin ningun doble de este trait.

use savia_folder_aplicacion::ciclo::{self, ResultadoDelDrenaje};
use savia_folder_contrato::colas::{Permiso, PermisoId, SweepId, Veredicto};
use savia_folder_contrato::dominio::{EstadoDelBarrido, HashAfirmado, RaizId, RutaRelativa};
use savia_folder_contrato::protocolo::{BarridoAbierto, CierreAplicado, Confirmacion, Cuarentena};
use savia_folder_estado::almacen::Almacen;
use savia_folder_estado::colas::ParametrosDeCola;
use savia_folder_plataforma_falsa::falsa::Falsa;
use savia_folder_politica::salvaguardas::{Desaparicion, EstadoDeRaiz};
use savia_folder_protocolo::{CanalDeSavia, FalloDeProtocolo, Subido};

struct CanalFalso;

impl CanalDeSavia for CanalFalso {
    fn abrir_barrido(
        &self,
        _raiz: &RaizId,
        _total: u64,
    ) -> Result<BarridoAbierto, FalloDeProtocolo> {
        unreachable!("el almacen vacio no encola trabajo: este metodo no deberia llamarse")
    }
    fn enviar_padron(
        &self,
        _barrido: &SweepId,
        _entradas: &[(String, Option<String>)],
    ) -> Result<u64, FalloDeProtocolo> {
        unreachable!()
    }
    fn reportar_observados(
        &self,
        _raiz: &RaizId,
        _entradas: &[(RutaRelativa, HashAfirmado)],
    ) -> Result<Vec<Veredicto>, FalloDeProtocolo> {
        unreachable!()
    }
    fn subir(&self, _permiso: &Permiso, _bytes: &[u8]) -> Result<Subido, FalloDeProtocolo> {
        unreachable!()
    }
    fn confirmar_subida_reanudada(
        &self,
        _permiso: &PermisoId,
    ) -> Result<Confirmacion, FalloDeProtocolo> {
        unreachable!()
    }
    fn reportar_desaparecidos(
        &self,
        _raiz: &RaizId,
        _entradas: &[Desaparicion],
        _viva: &EstadoDeRaiz,
    ) -> Result<Cuarentena, FalloDeProtocolo> {
        unreachable!()
    }
    fn cerrar_barrido(
        &self,
        _barrido: &SweepId,
        _cierre: EstadoDelBarrido,
    ) -> Result<CierreAplicado, FalloDeProtocolo> {
        unreachable!()
    }
}

#[test]
fn ciclo_drenar_acepta_un_canal_que_no_es_cliente() {
    let raiz = RaizId::nueva("guardian-canal-de-savia");
    let plataforma = Falsa::como_macos();
    let mut almacen = Almacen::nuevo(ParametrosDeCola {
        max_intentos: None,
        max_entradas_por_lote: None,
    });
    let canal = CanalFalso;
    let mut traza = Vec::new();

    // Si esta linea no compila, `drenar`/`ejecutar` volvieron a pedir `&Cliente`
    // concreto: ESE es el guardian. Si compila y corre, ademas confirma que una raiz
    // sin trabajo encolado vuelve `Vacia` sin tocar el canal.
    let resultado = ciclo::drenar(&raiz, &plataforma, &mut almacen, &canal, &mut traza);
    assert!(matches!(resultado, ResultadoDelDrenaje::Vacia));
}
