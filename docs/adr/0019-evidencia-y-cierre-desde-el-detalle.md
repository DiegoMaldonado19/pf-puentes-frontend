# 0019. Evidencia y cierre desde el detalle de órdenes

- Estado: implementado; acceso integrado pendiente de P2/P3
- Fecha: 20/10/2026
- Trazabilidad: HU-P8-MTO-05, RN-MTO-04/05, captura P1, DT-FE y autorización efectiva backend

## Acuerdo y decisión

El equipo confirmó Catedrático/Admin para subir/consultar fotografías y cerrar. La carga se permite en PROGRAMADA y EN_EJECUCION; la consulta continúa después del cierre. Estos permisos se aportan explícitamente desde la futura sesión del host, no se infieren de poder leer el historial.

`MantenimientoService` añade GET paginado y POST multipart de evidencia, más POST JSON de cierre. Pasa por HttpClient y sus interceptores globales; no administra tokens ni configura el boundary multipart manualmente. Las rutas codifican ambos IDs.

`EvidenciaYCierre`, incrustado en `ConsultaOrdenes`, reutiliza `CapturaFoto` de P1, sus blobs comprimidos/miniatura, captura UTC y GPS opcional. El UUID v7 se genera una vez por foto preparada y se conserva para reintentar manualmente una subida incierta sin duplicarla. La selección no es una foto guardada. El éxito solo se presenta al confirmar el ID esperado; entonces se relee la página real. No hay datos ficticios, persistencia offline de órdenes ni reintentos automáticos de POST.

La galería paginada abre las URL firmadas y miniaturas del servidor. Se actualiza explícitamente para renovarlas. Rechaza páginas con puente/orden ajenos y cancela lecturas obsoletas. No conserva datos privados al perder permiso o recibir 401/403; el error se propaga al contenedor para retirar también el historial y detalle.

El formulario requiere fecha civil ISO, responsable no blanco (máximo 150 caracteres Unicode) y evidencia guardada confirmada por GET. No fija fecha por defecto ni máximos temporales inventados. El servidor vuelve a validar y contar; la UI nunca envía un contador o estado de destino. Solo EN_EJECUCION con permiso ofrece cierre. Un DTO EJECUTADA confirmado actualiza fila/detalle y emite `cerrada`; la galería se consulta de nuevo y queda disponible.

## Integración y resultados inciertos

`ConsultaOrdenes` añade inputs `puedeConsultarEvidencia`, `puedeSubirEvidencia` y `puedeCerrar` (todos false por defecto), output `cerrada`, y `operacionPendiente()` que agrega inicio/carga/cierre para bloquear también el selector externo del host. `inicioPendiente()` conserva su significado original. Los botones y manejadores locales bloquean navegación, recarga e inicio mientras se sube o cierra; el hijo bloquea cierre/carga durante inicio.

Cambiar de orden destruye la captura anterior para que un procesamiento tardío no cruce padres. Los callbacks de escrituras comparan el contexto y permisos originales; destruir o cambiar la vista no garantiza rollback de una escritura ya recibida por el servidor. Conflicto/orden ausente al subir y resultado incierto del cierre fuerzan relectura del historial; errores de validación conservan formulario y renuevan evidencia. Nunca se repite automáticamente una escritura. Un fallo de red de carga conserva UUID/blobs para reconciliar mediante consulta o reenvío manual.

No se agrega ruta pública, autenticación alternativa o datos de demostración. P2 debe integrar sesión/interceptores/guardias/ruta diferida y P3 proporcionar el puente real. La HU no se declara cerrada de extremo a extremo por estar probado el componente.

## Verificación

186 unitarios aprobados (28 nuevos entre componente, cliente y contenedor), lint, Prettier, compilación estricta de app/pruebas/plantillas y build. Las pruebas comprueban contratos, estados/permisos, multipart, UUID estable, evidencia guardada frente a elegida, validación Unicode, bloqueo, cierre confirmado, errores/retirada de datos, contexto, galería posterior y relectura sin repetición de POST. Se reutilizan las pruebas propias de compresión de P1. El build inicial conserva 67.85 kB de transferencia; estos componentes esperan su ruta real y no se consideran un flujo ya accesible desde la página inicial. No se acredita CI remoto ni recorrido autenticado de P2.
