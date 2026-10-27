# Uso local de la bandeja de revisión

1. Inicia backend y frontend con sus respectivos `compose.local.yaml`.
2. Inicia sesión como Catedrático y pulsa **Revisión académica**, o abre `/revisiones`.
3. Consulta el total y las páginas; filtra por Enviada o En revisión.
4. Pulsa **Abrir revisión** en una inspección enviada. Se muestra el ciclo creado y la fila pasa a En revisión.
5. Si existe un conflicto, actualiza para comprobar el estado. No se reenvía automáticamente una escritura incierta.

La bandeja puede estar vacía: requiere inspecciones reales enviadas por estudiantes matriculados en un curso del catedrático y con `curso_id` persistido. No crea datos de demostración. Un Estudiante no puede acceder, ni un Catedrático consultar estudiantes ajenos o abrir su propia inspección.

Este incremento no ofrece todavía revisión de evidencia ni emisión de veredictos. Las capturas reales para el manual quedan pendientes de ejecutar el recorrido local; no se incluyen imágenes simuladas.

Pruebas: `bandeja-revision.spec.ts` cubre cliente HTTP, paginación/filtro, guardia, apertura única, recarga y descarte por cambio de identidad. [ADR 0034](adr/0034-bandeja-y-apertura-de-revision-academica.md).

## Validación local — 27/10/2026

- 39 pruebas aprobadas en siete archivos: revisión, cabecera y autenticación (siete casos propios de revisión).
- ESLint de archivos modificados y Prettier aprobados.
- Build de producción aprobado; advertencia de presupuesto inicial: 537.54 kB frente a 500 kB. No se ampliaron presupuestos para ocultarla.
- Se usó Node 24.21.0. La instalación local incompleta de MapLibre se resolvió para validar con dependencias aisladas en `/tmp/opencode`, sin cambiar `package.json` ni el lockfile. Para una instalación normal usar las dependencias del lockfile mediante `npm ci`.
- No equivale a toda la suite frontend ni a un recorrido de navegador con backend real. Capturas y comprobación visual quedan pendientes.
