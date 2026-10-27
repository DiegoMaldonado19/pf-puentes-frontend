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

Pendiente: fotos/documentos firmados, calificación, historial entre ciclos, resolución del estudiante y alertas. Las capturas reales para el manual quedan pendientes de ejecutar el recorrido local; no se incluyen imágenes simuladas. [ADR 0035](adr/0035-detalle-veredictos-y-marcadores-de-revision.md).

Pruebas: `bandeja-revision.spec.ts` cubre cliente HTTP, paginación/filtro, guardia, apertura única, recarga y descarte por cambio de identidad. [ADR 0034](adr/0034-bandeja-y-apertura-de-revision-academica.md).

## Validación local — 27/10/2026

- 44 pruebas aprobadas en ocho archivos: revisión, detalle, cabecera y autenticación (doce casos propios de revisión).
- ESLint de archivos modificados y Prettier aprobados.
- Build de producción aprobado; advertencia de presupuesto inicial: 539.43 kB frente a 500 kB. No se ampliaron presupuestos para ocultarla.
- Se usó Node 24.21.0. La instalación local incompleta de MapLibre se resolvió para validar con dependencias aisladas en `/tmp/opencode`, sin cambiar `package.json` ni el lockfile. Para una instalación normal usar las dependencias del lockfile mediante `npm ci`.
- No equivale a toda la suite frontend ni a un recorrido de navegador con backend real. Capturas y comprobación visual quedan pendientes.
