# 0021. Ajuste manual de prioridad en el detalle

- Estado: implementado; acceso integrado con P2 e inventario P3 pendiente
- Fecha: 20/10/2026
- Trazabilidad: HU-P8-MTO-07 (ajuste), RN-MTO-06, RN-USR-09

## Decisión y contrato

El usuario adoptó la recomendación de permitir ajuste manual a Catedrático/Admin en PROPUESTA, PROGRAMADA y EN_EJECUCION; las terminales conservan su prioridad. Es una decisión del usuario para el vacío del enunciado, no una afirmación de confirmación del grupo.

`MantenimientoService.ajustarPrioridad` consume el PATCH real `.../ordenes-mantenimiento/{ordenId}/prioridad` con `prioridad` y `justificacion`, ambos IDs codificados y HttpClient global. No envía estado, sugerencia ni pesos. El servidor conserva la autorización efectiva y comprueba la ventana editable.

`AjustePrioridadOrden` se inserta en el detalle de `ConsultaOrdenes` mediante `puedeAjustarPrioridad` (false por defecto). Inicia el selector con la vigente, presenta opciones ALTA/MEDIA/BAJA y exige justificar un valor distinto, incluso al volver a la sugerida. No envía el mismo valor para editar la justificación previa. Conserva texto exacto sin máximo artificial; no calcula sugerencias ni inventa una cuando falta.

Durante PATCH bloquea formulario/doble envío y expone `envioPendiente`; el host lo agrega a `operacionPendiente()` y bloquea selección, recargas e inicio/descarte/evidencia/cierre. Cada hijo recibe únicamente el bloqueo de las otras operaciones para evitar depender de su propio estado de envío.

El éxito requiere DTO de la orden/puente correctos, estado abierto, prioridad solicitada, justificación y sugerida compatibles. El contenedor actualiza fila/detalle desde el servidor y emite `prioridadAjustada`; no calcula estado ni totales. Otro consumidor del host puede usar ese evento para refrescarse.

## Errores y contexto

400/422 conservan el formulario para corrección o recarga de detalle. 401/403 retiran datos privados del contenedor. Conflicto, orden ausente o resultado incierto fuerzan relectura por GET sin repetir PATCH automáticamente. Una respuesta incompatible tampoco se presenta como éxito. Cambiar orden/permiso limpia controles e ignora callbacks anteriores; destruir desuscribe, sin prometer rollback del servidor.

No se añaden rutas públicas, sesión alternativa ni datos ficticios de producción. El inventario P3 ya existe y muestra estado; el acceso P2 y la conexión P8 con ese inventario permanecen pendientes. MTO-07 no queda completa: falta fórmula/insumos de la sugerencia y su explicación en la vista, además de integración/revisión/entrega.

## Verificación

325 unitarios aprobados, 45 nuevos entre componente/cliente/host: contrato PATCH, estados/permisos, motivo blanco/largo/exacto, regreso a sugerida, no-op, ausencia de sugerencia, confirmación, bloqueos cruzados, errores, contexto y destrucción. Pasan lint, Prettier, compilación estricta de app/pruebas/plantillas y build; inicial ~90.24 kB de transferencia, MapLibre diferido. No se acredita recorrido autenticado ni CI remoto.
