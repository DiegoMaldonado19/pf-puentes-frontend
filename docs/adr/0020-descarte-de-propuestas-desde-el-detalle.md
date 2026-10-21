# 0020. Descarte de propuestas desde el detalle

- Estado: implementado; acceso integrado pendiente de P2 y conexión con inventario disponible de P3
- Fecha: 20/10/2026
- Trazabilidad: HU-P8-MTO-06 (descarte), RN-MTO-04/09; autorización efectiva backend, textos y accesibilidad

## Acuerdo y decisión

El usuario confirmó Catedrático/Admin para PROPUESTA → DESCARTADA con motivo. El cliente `MantenimientoService.descartar` consume el POST real `.../ordenes-mantenimiento/{ordenId}/descarte`, con JSON `motivo`, ambos IDs codificados y mediante la cadena HttpClient global. No envía un estado arbitrario ni repite escrituras automáticamente.

`DescartePropuesta`, incrustado en el detalle de `ConsultaOrdenes`, requiere permisos de lectura/descarte, estado PROPUESTA y motivo escrito. La confirmación es explícita mediante formulario; se conserva el texto exacto y no se impone un máximo ajeno a TEXT del backend. El textarea tiene etiqueta, estado inválido y errores accesibles. Durante el POST se bloquean doble envío y edición, y la señal `envioPendiente` se agrega a `operacionPendiente()` del host para bloquear selección/paginación/recargas y otras mutaciones locales.

El contenedor añade `[puedeDescartar]` (false por defecto) y `(descartada)` con DTO confirmado. Solo actualiza fila/detalle con DESCARTADA de la misma orden/puente y motivo esperado; conserva totales porque el historial incluye terminales. El host puede usar el evento para actualizar otros consumidores, como la bandeja de propuestas. Permisos explícitos del frontend no conceden autorización: el backend la comprueba.

## Errores y contexto

400/422 conservan el motivo para corregirlo o actualizar el detalle. 401/403 retiran el formulario y propagan la denegación al contenedor, que retira listado/detalle. Orden ausente, conflicto o resultado incierto fuerzan relectura por GET antes de decidir de nuevo, sin repetir POST. Una respuesta con IDs, estado o motivo incompatibles no se presenta como éxito.

Cambiar orden o permisos limpia el formulario e ignora callbacks del contexto anterior. Destruir la vista desuscribe HTTP; no implica rollback de un POST ya recibido por el servidor.

No se habilitan cancelación, programación de fecha ni cambios de prioridad. No se crean rutas públicas de mantenimiento, login alternativo ni datos ficticios en producción. P3 ya incorporó inventario/listado/mapa/ficha públicos y usa `EstadoPuente`; `ROL_PUENTES` es un puerto aún sin proveedor de sesión P2. P8 sigue pendiente de conectarse con esa ficha/selección y el acceso real; este incremento no presenta la pantalla privada como accesible desde la raíz.

## Verificación

El merge P3 `514c884` pasó 242 unitarios; con este incremento pasan **280** (38 nuevos), además de lint, formato, compilación estricta y build. Casos nuevos: contrato HTTP, estados/permisos, motivo blanco/largo/exacto, confirmación real, doble envío, bloqueo del contenedor, errores y reconciliación, motivo persistido en historial, cambios de contexto y destrucción. Se conservan las pruebas P3; el build mantiene rutas diferidas. No se acredita recorrido autenticado con P2 ni CI remoto.
