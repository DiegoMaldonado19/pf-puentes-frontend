# 0018. Inicio de ejecución desde el detalle de órdenes

- Estado: implementado; acceso integrado pendiente de P2/P3
- Fecha: 20/10/2026
- Historia: HU-P8-MTO-04; RN-MTO-04; contrato REST, autorización efectiva backend y textos/accesibilidad del proyecto

## Contexto y decisión

El grupo autorizó Catedrático y Administrador para iniciar ejecución, según confirmación del usuario. `MantenimientoService.iniciarEjecucion` consume el POST real `.../ordenes-mantenimiento/{ordenId}/inicio-ejecucion`, sin cuerpo, sin token propio y sin elegir un estado arbitrario.

Se amplía `<app-consulta-ordenes>` con `puedeIniciar` (false por defecto), `iniciada` (DTO confirmado) e `inicioPendiente()` de solo lectura. El host de P2 deriva el permiso; el backend lo comprueba. Los hosts anteriores conservan el modo de consulta. Solo el detalle de una PROGRAMADA con permiso ofrece «Iniciar ejecución».

Durante el POST se bloquean acciones locales de selección/paginación/recarga y el doble envío, tanto en botones como en manejadores. El host puede usar `inicioPendiente()` para bloquear además la selección externa de puente. Un cambio externo de contexto no garantiza cancelar una escritura ya recibida por el servidor: las respuestas de otro puente o de un contexto cuyo acceso se perdió se ignoran. Destruir la vista desuscribe HTTP, sin afirmar rollback del servidor.

El estado de fila y detalle cambia solo con el DTO confirmado EN_EJECUCION de la orden/puente correctos. No se calculan fechas ni se cambian totales/ordenación: el POST no mueve una orden fuera del historial. Se emite `iniciada` para refrescar otros consumidores del host.

401/403 retiran lista/detalle mediante el mecanismo de acceso existente. Un 409/404/422, fallo de red o resultado incierto muestra explicación y vuelve a leer el listado; requiere seleccionar y consultar la orden otra vez antes de un nuevo intento. **No se reintenta el POST automáticamente.** Una respuesta incompatible tampoco se presenta como éxito.

## Límites y verificación

No se agrega una ruta pública, sesión alternativa ni notificación de inicio. Cierre/evidencia conservan permisos pendientes. P2/P3 deben integrar sesión/interceptores/guardias, ruta diferida, puente real y el nuevo permiso para usarlo desde la aplicación.

158 unitarios aprobados (20 nuevos entre vista/cliente), además de lint, Prettier, compilación estricta de fuentes/pruebas/plantillas y build. Casos nuevos: contrato POST, permiso/estado, doble clic, bloqueo de controles, resultado confirmado, errores, relectura, contexto externo, retirada de acceso, respuesta incompatible y destrucción. Los mocks de transporte están solo en pruebas. No se repitieron e2e offline ajenos al cambio ni se acredita recorrido autenticado con P2.
