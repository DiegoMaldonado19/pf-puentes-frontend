# Uso local de la bandeja de revisión

1. Inicia backend y frontend con sus respectivos `compose.local.yaml`.
2. Inicia sesión como Catedrático y pulsa **Revisión académica**, o abre `/revisiones`.
3. Consulta el total y las páginas; filtra por Enviada o En revisión.
4. Pulsa **Abrir revisión** en una inspección enviada. Se muestra el ciclo creado y la fila pasa a En revisión. Usa **Continuar revisión** para abrir `/revisiones/:revisionId`.
5. Si existe un conflicto, actualiza para comprobar el estado. No se reenvía automáticamente una escritura incierta.

La bandeja puede estar vacía: requiere inspecciones reales enviadas por estudiantes matriculados en un curso del catedrático y con `curso_id` persistido. No crea datos de demostración. Un Estudiante no puede acceder, ni un Catedrático consultar estudiantes ajenos o abrir su propia inspección.

## Formulario original, observaciones y decisión

El detalle muestra el motor de formulario compartido en modo lectura, seguido de campos con su referencia, valor original y `app-marcador-anclado`. Elegir una marca muestra su texto. Para agregar una observación selecciona el campo, escribe el texto y guarda; no se cambia la respuesta del estudiante.

Selecciona Aprobar y publicar, Solicitar cambios o Rechazar. Cambios/rechazo requieren observación general. La aprobación usa el estado calculado por defecto; si eliges otro estado explícito, escribe su justificación. Backend valida la discrepancia y calcula el IC oficial. Sin configuración de cálculo válida no se confirma la aprobación.

La escritura bloquea acciones y salida de la ruta. No se reintenta automáticamente un POST incierto. Tras confirmar se muestra el veredicto y el ciclo queda en lectura. Los errores de conflicto requieren actualizar para consultar el estado real. Perder sesión limpia los datos privados y descarta respuestas tardías.

El detalle del revisor también permite registrar una calificación opcional privada y consultar todos los ciclos. La nota admite 0–100 con hasta dos decimales y puede retirarse guardando el campo vacío; no se modifica el veredicto. [ADR 0035](adr/0035-detalle-veredictos-y-marcadores-de-revision.md).

## Pendientes del estudiante e historial

Como Estudiante, abre **Mis pendientes de revisión** (`/mis-revisiones`). Solo aparecen observaciones emitidas, no notas de ciclos aún en revisión. Tras corregir el borrador, pulsa **Ya corregí: marcar resuelta**. Resolver no cambia el formulario ni lo reenvía: la edición y el envío corresponden a Inspecciones. Para estados no editables se muestra el aviso y no se ofrece resolución.

La misma pantalla lista las inspecciones con revisión, aun cuando ya no queden pendientes. **Ver historial** abre `/historial-revisiones/:inspeccionId`: cada ciclo conserva su decisión, observaciones y fechas de resolución. La calificación se consulta de forma privada por ciclo, solo para autor y revisor; no se obtiene del historial público a los autorizados del curso.

El catedrático recibe en la campana compartida un aviso de revisión vencida a partir de los 15 días naturales. El enlace abre `/revisiones`; no se duplica para el mismo envío y destinatario.

Pendiente: fotos/documentos firmados y recorrido completo con edición/reenvío en la pantalla de Inspecciones. Las capturas reales para el manual quedan pendientes; no se incluyen imágenes simuladas. [ADR 0036](adr/0036-pendientes-historial-y-calificacion-privada.md).

Pruebas: `bandeja-revision.spec.ts` cubre cliente HTTP, paginación/filtro, guardia, apertura única, recarga y descarte por cambio de identidad. [ADR 0037](adr/0037-bandeja-y-apertura-de-revision-academica.md).

Uso:

- Desde la bandeja, abrir revisión crea el ciclo y bloquea la inspección.
- El detalle muestra el formulario original en lectura, marcadores anclados y la opción “Ir a inspección” con `?ref=` para saltar al campo observado.
- Resolver observación marca `resuelta_en` y no edita ni reenvía el borrador; la edición/reenvío es responsabilidad de P5.
- Confirmación de estado en aprobación usa el componente compartido `ConfirmacionEstado`; el cálculo oficial sigue en backend.

## Validación local — 27/10/2026

- 51 pruebas aprobadas en nueve archivos: revisión, seguimiento, nota privada, detalle, cabecera y autenticación (diecinueve casos propios de revisión).
- ESLint de archivos modificados y Prettier aprobados.
- Build de producción aprobado; advertencia de presupuesto inicial: 541.75 kB frente a 500 kB. No se ampliaron presupuestos para ocultarla.
- Se usó Node 24.21.0. La instalación local incompleta de MapLibre se resolvió para validar con dependencias aisladas en `/tmp/opencode`, sin cambiar `package.json` ni el lockfile. Para una instalación normal usar las dependencias del lockfile mediante `npm ci`.
- No equivale a toda la suite frontend ni a un recorrido de navegador con backend real. Capturas y comprobación visual quedan pendientes.
