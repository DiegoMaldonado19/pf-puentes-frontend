# 0022. Programación de fecha desde el detalle

- Estado: implementado; sesión/ruta protegida P2 y conexión con inventario P3 pendientes
- Fecha: 21/10/2026
- Trazabilidad: HU-P8-MTO-03, RN-MTO-04/07; ADR backend 0033

## Decisión y uso

El usuario adoptó Catedrático/Admin, solo PROGRAMADA, fecha obligatoria y sin restricciones temporales adicionales. La UI aplica esa ventana; el servidor vuelve a autorizar y comprobarla. No se interpreta como cumplimiento automático de la programación rutinaria anual.

`MantenimientoService.programarFecha` consume el PATCH real `.../ordenes-mantenimiento/{ordenId}/fecha-programada` con una fecha civil ISO, sin enviar estado ni datos de cierre. Los IDs se codifican y la sesión corresponde a la cadena HTTP global de P2. No convierte la fecha en Date/UTC ni agrega mínimo/máximo temporal.

`ProgramacionOrden` incorpora input date, etiqueta, fecha requerida y textos en español centralizados. Inicializa con la fecha existente o vacío, sin inventar hoy ni eliminar fechas. Evita enviar la misma fecha y bloqueará controles/doble envío durante el PATCH. Solo emite `programada` al recibir DTO compatible con orden, puente, PROGRAMADA y la fecha solicitada.

`ConsultaOrdenes` lo inserta en el detalle mediante `puedeProgramar` (false por defecto) y emite `fechaProgramada` después de actualizar fila/detalle con la respuesta del servidor. La lectura por sí sola no concede escritura. `operacionPendiente()` agrega el envío; se bloquean selección, recargas, inicio, ajuste de prioridad y carga/cierre de evidencia. Cada hijo recibe únicamente el bloqueo de las otras operaciones.

## Fallos, contexto y acceso

400/422 conservan la fecha para corregirla. 401/403 retiran datos privados del contenedor; 404/409 y resultados inciertos requieren GET sin repetir PATCH. Respuesta incompatible no se confirma; cambios de orden/permiso invalidan callbacks y limpian controles. Destruir desuscribe, sin prometer rollback del servidor.

El inventario de P3 está disponible y ya usa estado P8. El pull frontend de a067dff solo incorpora una fusión; aún no trae AuthService, interceptores ni guardias de P2. Se espera esa sesión para habilitar acceso a los componentes privados, sin exponer una ruta pública o cuentas de prueba. La API y cliente son funcionales; el recorrido integrado aún no está terminado.

## Verificación

Pruebas DOM/HTTP del formulario, cliente y contenedor: contrato y fecha civil exacta, inicio vacío/existente, estado/permisos, nulidad, no-op, fechas pasadas/futuras, confirmación, bloqueos cruzados, errores, respuestas incompatibles, cambio de contexto/permiso y destrucción. Resultado de suite y controles en README. No acredita navegación con sesión P2 ni CI remoto.

Suite final: **366 unitarios**, 41 nuevos; lint, Prettier, compilación estricta app/pruebas/plantillas y build aprobados (~90.36 kB iniciales de transferencia, MapLibre diferido).
