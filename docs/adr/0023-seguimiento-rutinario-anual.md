# 0023. Seguimiento rutinario anual en el historial

- Estado: implementado; acceso privado P2 y automatización anual pendientes
- Fecha: 21/10/2026
- Trazabilidad: HU-P8-MTO-08, RN-MTO-07; ADR backend 0035

El grupo confirmó la fecha de referencia reportada por el usuario: última ejecución rutinaria o registro sin ejecuciones. El usuario delegó el criterio de consulta para Catedrático/Admin. La API calcula el año y los conteos; el frontend presenta esos valores sin recrear una evaluación anual alternativa.

`MantenimientoService.consultarRutinarioAnual` usa GET real con ID codificado y página/tamaño. `SeguimientoRutinario` presenta fecha de evaluación/referencia/límite, fuente, conteos globales y página de rutinarias abiertas. Fechas civiles sin conversión a UTC/Date; textos centralizados y controles nativos con foco/tamaño del diseño existente.

Los conteos distinguen programación dentro del plazo, ausencia de fecha, fecha pasada y fecha posterior al límite; una orden puede coincidir en los dos últimos. Se explica que no deben sumarse y que programación no acredita ejecución. La ausencia de programación en la ventana no se rotula automáticamente como incumplimiento anual, porque el límite puede ser futuro.

El host activa `ConsultaOrdenes.mostrarSeguimientoRutinario` (false por defecto como opción de presentación, no como permiso adicional). La lectura conserva Catedrático/Admin y el servidor autoriza. La selección del panel abre el detalle existente; sus acciones conservan permisos/ventanas. Fecha guardada, inicio y cierre confirmados invalidan el resumen y provocan GET nuevo. No se repiten escrituras ni se actualizan conteos de forma optimista. El bloqueo de operaciones del historial se comparte con selección/paginación/recarga del panel.

Cambiar puente/permiso o versión de actualización cancela la lectura anterior y elimina información obsoleta. 401/403 notifican al host para retirar todos los datos privados; los demás errores permiten reintento explícito de GET. Se rechazan páginas de otro puente o filas de otro tipo/estado. No se crean propuestas, jobs, rutas públicas ni cuentas ficticias para mostrar el panel. Sesión/interceptores/guardias P2 y conexión al inventario P3 siguen pendientes.

Verificación de cliente/DOM/host: selección, recarga real tras programar, resumen y fechas, contexto, permisos, errores, respuestas incompatibles, destrucción y paginación. Resultados globales en README. El proceso anual y el recorrido autenticado completo no se consideran terminados por esta vista.
