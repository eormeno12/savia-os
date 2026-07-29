# Plan de corrección — priorización

Backlog accionable de los 116 hallazgos verificados, ordenado por severidad. Pensado para que quien retoque el archivo `Savia - Mockup.dc.html` en Claude Design sepa qué resolver primero. Cada línea enlaza al detalle completo en [01-huecos-cobertura.md](01-huecos-cobertura.md) o [02-errores-diseno.md](02-errores-diseno.md).

**Alta: 32 · Media: 56 · Baja: 28 · Total: 116**

## 🔴 Alta — resolver antes de pasar el mockup a desarrollo

Estados core ausentes en flujos críticos (login, onboarding, suscripción), contradicciones de arquitectura de información (P2 bajo Conexiones vs. Pulso), y promesas de copy que el propio mockup contradice en otra pantalla (retención de archivos originales, fechas de gracia). Si esto llega a desarrollo sin resolver, alguien va a implementar el bug tal cual está dibujado.

| # | Sección | Pantalla | Hallazgo | Tipo | Detalle |
|---|---|---|---|---|---|
| 1 | Auth | A2 (móvil) | Falta el estado "Verificando" (validating) en A2 móvil | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 2 | Suscripción | SB1 (móvil) | Solo 1 de los 5 estados obligatorios de SB1 tiene versión móvil | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 3 | Suscripción | SB1 | El estado 'cancelada / reactivar' rompe el patrón de modal-con-contexto-preservado y no... | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 4 | Shell | S1 (móvil) | Falta el estado móvil "sin conexiones" | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 5 | Shell | S1 (móvil) | El estado móvil "default" no tiene ningún disparador para abrir el drawer | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 6 | Onboarding | O5 | Falta el estado "O5 (sin IA)" que el propio flujo v2 define como alcanzable | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 7 | Onboarding | O2 / O3 | No existe ninguna variante móvil de Importar (O2) ni de Rescatar (O3); O4 móvil solo cu... | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 8 | Onboarding | O2 | Los números de la celebración de éxito no cuadran entre sí | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 9 | Memoria | M1 | No existe ningún estado que muestre el mapa "anidándose" (drill-down con migas de pan s... | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 10 | Memoria | M1 / M2 | El área "Recetas" tiene tres conteos de recuerdos contradictorios entre mapa, lista y p... | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 11 | Memoria | M1 | La vista de lista de M1 no incluye todas las áreas que muestra el mapa del mismo estado | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 12 | Memoria | M2 | M2 "sin recuerdos" omite por completo el panel de Acceso (Personas/IAs) y las acciones ... | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 13 | Pulso | P2 (nav) | P2 ("¿Qué ve cada IA?") vive bajo la sección de navegación Conexiones, contradiciendo l... | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 14 | Pulso | P2 (mobile) | P2 móvil no tiene ninguna forma de volver a otras secciones (sin bottom nav, sin flecha... | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 15 | Conexiones | C3 | Selector de cliente incompleto: faltan Windsurf y "otro cliente compatible" | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 16 | Conexiones | C3 | Falta el estado "sin cliente elegido" | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 17 | Conexiones | C1 / C2 / C3 | "Acceso" vive dentro de Conexiones, contradiciendo la arquitectura de información del b... | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 18 | Fuentes | F1 (vacío/absorbiendo) | Falta la sugerencia opcional de área al soltar | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 19 | Fuentes | F1 (con fuentes) | Falta la acción "re-sugerir área" por fuente | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 20 | Fuentes | F1 (con fuentes) | Falta selección múltiple y eliminar por fuente | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 21 | Fuentes | F1 (vacío/absorbiendo) | Contradicción directa: "no guardamos los archivos originales" vs. el micro-mensaje de c... | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 22 | Bandeja | N1 | Falta el tipo de notificación "exportación lista", requerido por v2 y por el propio dia... | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 23 | Colectivo | CO6 | El wizard de conversión solo tiene el paso 1; los pasos 2 y 3 no existen en el mockup | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 24 | Colectivo | CO7 | Falta por completo el estado de invitación vencida/revocada | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 25 | Cuenta | CT4 | Faltan los estados 'enviando', 'enviado (nº de ticket)' y 'error de envío' del formular... | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 26 | Cuenta | CT3 | No existe el estado 'sin exportaciones previas' (primera exportación, sin historial) | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 27 | Cuenta | CT1 | El flujo de 'confirmación en dos pasos' para eliminar cuenta no tiene un control final ... | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 28 | Patrones | Patrones (Confirmar · Procesando fuente) vs O2/F1/CT3 | El micro-mensaje "Procesando fuente" promete guardar el archivo original y poder export... | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 29 | Navegación | C1/F1/P2/N1 (mobile) | La barra de navegación inferior móvil (Memoria/Pulso/Conexiones/Fuentes) solo existe en... | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 30 | Navegación | P2 (nav) | P2 ("¿Qué ve cada IA?") vive bajo el rail de Conexiones, no bajo Pulso — contradice la ... | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 31 | Freemium | C1 / S1 / P1 | No existe ningún estado visual para 'IAs desconectadas por falta de suscripción' (disti... | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 32 | Freemium | SB1 / CT2 | Fecha de fin de gracia por cancelación inconsistente entre SB1 y CT2 (19 jul vs 14 jul) | Error | [02-errores-diseno.md](02-errores-diseno.md) |

## 🟡 Media — resolver antes de considerar el mockup 'listo para handoff'

Inconsistencias de copy entre breakpoints, acciones documentadas en el brief que faltan en una variante, y desviaciones del modelo freemium que no rompen el flujo pero sí la confianza en los datos de ejemplo.

| # | Sección | Pantalla | Hallazgo | Tipo | Detalle |
|---|---|---|---|---|---|
| 1 | Cover + Flujos | SB1 (Flujo 1 y Flujo 3) | El badge de SB1 usa lima como superficie dominante sobre fondo claro, contradiciendo la... | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 2 | Cover + Flujos | M2 → M3 (Flujo 2, Uso diario) | El flujo 'Uso diario' enruta la apertura de un recuerdo desde M2 hacia M3 (Crear área) ... | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 3 | Auth | A1 | No existe un estado de error "de red" (envío fallido por servidor/conexión) en A1, solo... | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 4 | Auth | A2 | El estado "Reenviar habilitado" tras terminar la cuenta regresiva no existe de forma in... | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 5 | Auth | A2 (desktop + móvil, todas las variantes) | El indicador "Paso 1 de 2" nunca avanza a "Paso 2 de 2" al pasar de A1 a A2 | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 6 | Auth | A1 | El copy de error de email contradice el propio dato de ejemplo que lo dispara | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 7 | Auth | A2 | El foco inicial de las celdas del código OTP recae en la 2ª celda, no en la 1ª | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 8 | Suscripción | SB1 (móvil) | El gate móvil omite el bloque 'Qué sigue siendo gratis' (transparencia del modelo freem... | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 9 | Suscripción | SB1 | No se ilustra la variante 'cancelada sin período de gracia' | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 10 | Shell | S1 | No hay UI dedicada para la paleta de comandos ⌘K | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 11 | Shell | S1 (móvil) | "Acceso a cuenta" no existe en el estado móvil por defecto | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 12 | Shell | S1 | El gate de suscripción sobre "Conectar IA" (Flujo 3 de v2) no se refleja en el shell | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 13 | Shell | S1 | Triple CTA redundante para "conectar tu primera IA" en el estado sin conexiones | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 14 | Onboarding | O2 | La "guía de cómo exportar" nunca muestra contenido real, solo un menú de navegación | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 15 | Onboarding | O3 | Falta el estado "procesando" que el brief pide explícitamente para O3 | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 16 | Onboarding | O3 | El botón "Copiar prompt" no tiene ningún estado de confirmación | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 17 | Onboarding | O4 | El copy visible para el usuario expone el código interno de pantalla "(SB1)" | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 18 | Onboarding | O4 | El selector de cliente de O4 no reutiliza completamente la lista de C3 | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 19 | Onboarding | O1-O5 | El stepper de progreso pierde pasos ya completados a medida que avanza el recorrido | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 20 | Onboarding | O1 | En mobile, ninguna de las 3 tarjetas de O1 conserva el botón de acción que tiene en des... | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 21 | Memoria | M1 | No hay forma visible de llegar a la pantalla completa de Búsquedas guardadas (M4) desde M1 | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 22 | Memoria | M1 (móvil) | Solo se ilustra la vista de lista en móvil; no hay ningún estado que muestre el mapa ad... | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 23 | Memoria | M4 | Ningún ítem de "Búsquedas guardadas — Con varias" expone editar la búsqueda en lenguaje... | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 24 | Memoria | M2 | La pestaña "Personas" se muestra activa y con contador en áreas privadas, contradiciend... | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 25 | Pulso | P1 | Falta el elemento "Recientes" (últimos recuerdos agregados, navegables) como pieza dist... | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 26 | Pulso | P2 | Ausente el elemento "Sugerencias de Savia" en las cuatro variantes de P2 | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 27 | Pulso | P1 | No se cubre el gate de suscripción para las acciones "Conectar IA" que viven dentro de ... | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 28 | Pulso | P2 | "Historial / auditoría" no tiene contenido propio visible en ninguna variante de P2 | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 29 | Pulso | P2 | El control "Puede contribuir (escribir recuerdos)" solo existe para Claude, no para Cur... | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 30 | Conexiones | C3 | No hay referencia visual de dónde pegar el bloque de configuración | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 31 | Conexiones | C1 | "Sin conexiones" (v1) y "sin suscripción" (v2) se muestran como un único estado sin dis... | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 32 | Conexiones | C2 | El paso 1 de C2 no incluye elegir cliente, pese a que el diagrama de flujo v2 lo rotula... | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 33 | Conexiones | C1 | "Revocar" no tiene paso de confirmación en ningún estado mostrado | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 34 | Conexiones | C1 (mobile) | En móvil, las tarjetas de Claude y Cursor no exponen ninguna acción ("Ver guía"/"Revocar") | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 35 | Fuentes | F1 (todas) | No se representa la opción de importar por URL | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 36 | Fuentes | F1 móvil | Cobertura móvil incompleta: un solo frame híbrido en vez de los estados declarados | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 37 | Fuentes | F1 (con fuentes) | Conteo incorrecto: el grupo "Lecturas" dice "1 fuente" pero muestra 2 tarjetas | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 38 | Bandeja | N1 | Falta la acción "vaciar" en todos los estados de la bandeja | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 39 | Bandeja | N1 | Los ítems de "Al día" (procesos terminados / hitos de actividad) no muestran ninguna se... | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 40 | Bandeja | N1 (mobile) | La variante móvil solo cubre el estado "con notificaciones"; no hay móvil para "sin not... | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 41 | Bandeja | N1 | El badge de "no leídas" (4) es inconsistente con los 5 ítems mostrados, y ningún ítem t... | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 42 | Colectivo | CO3 | No existe la advertencia de "área sensible + modo abierto" que pide el brief | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 43 | Colectivo | CO4 | Solo se maqueta el estado "con aprobación / pendiente"; faltan "abierto" y "bloqueado" | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 44 | Colectivo | CO1 (área unificada, variante colectiva) | El estado vacío específico de área colectiva ("invitar gente, conectar fuentes") no se ... | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 45 | Colectivo | CO2 | El badge "Personas · 5" no coincide con la lista real de miembros, que solo tiene 4 | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 46 | Cuenta | CT2 | Los micro-mensajes de confianza específicos de cancelación y reactivación nunca aparecen | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 47 | Cuenta | CT2 | Los estados 'Cancelada con gracia' y 'Cancelada sin gracia' de Bloque 1 no tienen págin... | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 48 | Cuenta | CT2 | Falta el modal de confirmación de reactivación ('¿Reactivar por $11.99/mes?') | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 49 | Cuenta | CT4 | El slide-over de ayuda omite por completo el control 'Adjuntar screenshot' | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 50 | Cuenta | CT2 | La pantalla 'Pago fallido' omite el Bloque 2 ('Qué incluye tu plan') pese a etiquetarse... | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 51 | Cuenta | CT2 | El CTA del estado 'Cancelada' (sin gracia) no incluye el precio que exige el brief | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 52 | Patrones | Patrones (Confirmar) | La tarjeta "Procesando fuente" usa un spinner (acción en curso) dentro de la columna "C... | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 53 | Copy/tono | CO7 | Metáfora ajena al léxico de marca: "el cerebro del equipo" | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 54 | Copy/tono | F1 / O2 | Cuatro verbos distintos para la misma acción de "absorber" un archivo | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 55 | Freemium | CT2 | Fecha de facturación inconsistente dentro de la propia pantalla de Cuenta (día 1 vs día... | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 56 | Freemium | O1/O4/C1/M1/M2/P2 (icono) | El mismo ícono de candado significa tres cosas distintas: 'requiere suscripción', 'área... | Error | [02-errores-diseno.md](02-errores-diseno.md) |

## ⚪ Baja — pulido, resolver en una pasada de limpieza

Microcopy inconsistente, iconografía mixta (SVG vs. emoji), pequeñas discrepancias aritméticas en datos de ejemplo. No bloquean el entendimiento del flujo.

| # | Sección | Pantalla | Hallazgo | Tipo | Detalle |
|---|---|---|---|---|---|
| 1 | Cover + Flujos | CT2 (Flujo 5) | El diagrama de 'Gestionar suscripción' omite la rama 'mantiene suscripción' | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 2 | Cover + Flujos | P1/P2 (Flujo 9) | El diagrama de 'Pulso' omite la rama de evento de acceso de IA en el feed | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 3 | Suscripción | SB1 | Nunca se muestra el gate sobre el contexto de Onboarding (O4), solo sobre Conexiones — ... | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 4 | Suscripción | SB1 | La reactivación cobra 'de inmediato' al primer clic, sin el paso de confirmación que de... | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 5 | Shell | S1 | Copy inconsistente entre escritorio y móvil para los mismos elementos globales | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 6 | Shell | S1 | El ícono de campana no tiene etiqueta accesible, a diferencia del ícono de ayuda contiguo | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 7 | Onboarding | O2 | Falta el estado "pendiente" en la cola de procesamiento de archivos | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 8 | Onboarding | O1-O5 | Ninguna pantalla de onboarding ofrece un control explícito de "volver atrás" | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 9 | Onboarding | O4 | "Hacerlo más tarde" no reafirma que se puede conectar después desde Conexiones | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 10 | Onboarding | O2 | Se usa la misma inicial "G" para representar a ChatGPT y a Gemini | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 11 | Memoria | M2 | El estado "sin recuerdos" promete la acción de mover recuerdos desde otra área pero no ... | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 12 | Memoria | M2 | El buscador de M2 usa el placeholder genérico de toda la app en vez del placeholder con... | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 13 | Pulso | P2 (mobile) | Inconsistencia de iconografía: la señal de "sensible" usa un ícono SVG en desktop pero ... | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 14 | Conexiones | C1 | El estado "con problema" solo ilustra el caso "token inválido" | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 15 | Fuentes | F1 (vacío) | No se representa el overlay de "soltar sobre toda la app" | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 16 | Fuentes | F1 (absorbiendo → con fuentes) | El nombre del archivo cambia entre el frame "absorbiendo" y el frame "con fuentes" | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 17 | Bandeja | N1 (mobile) | La variante móvil omite el tipo de notificación "hitos de actividad" | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 18 | Bandeja | N1 | El estado "cargando" no tiene forma de cerrarse, a diferencia de los otros dos estados ... | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 19 | Colectivo | CO2–CO7 | Ninguna pantalla de Colectivo tiene variante móvil, a pesar de la promesa general del p... | Hueco | [01-huecos-cobertura.md](01-huecos-cobertura.md) |
| 20 | Cuenta | CT4 (slide-over) | Las categorías del ticket tienen copy distinto entre el slide-over y la pantalla comple... | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 21 | Cuenta | CT1 | El chip de usuario en el pie de la barra lateral aparece resaltado solo en Perfil, no e... | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 22 | Copy/tono | CT2 | "Actualizar" vs "Cambiar" método de pago en la misma pantalla | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 23 | Copy/tono | O1 (móvil) | "Guardar y salir" (desktop) se convierte en solo "Salir" en móvil | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 24 | Copy/tono | M2 | El copy de vacío de un área la llama "tema" en vez de "área" | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 25 | Copy/tono | M1 / O4 / C3 | "Cliente" nombra dos conceptos distintos y no relacionados en el mismo producto | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 26 | Copy/tono | M1 | "A medida que creces" roza la metáfora de crecimiento/naturaleza que el proyecto pide e... | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 27 | Copy/tono | O2 / C2 / CO6 | Etiqueta de "avanzar" inconsistente entre asistentes multi-paso: "Continuar" vs "Siguie... | Error | [02-errores-diseno.md](02-errores-diseno.md) |
| 28 | Freemium | SB1 / CT2 | El orden de los 3 beneficios de la suscripción no coincide entre SB1 y CT2 | Error | [02-errores-diseno.md](02-errores-diseno.md) |
