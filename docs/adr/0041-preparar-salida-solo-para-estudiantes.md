# 0041 — "Preparar salida" solo para estudiantes

- Estado: aceptado.
- Fecha: 28/10/2026
- Trazabilidad: RN-OFF-02, RN-CUR (asignaciones de curso).
- Precisa [0025](0025-preparacion-local-referencia.md), que ya limita la acción al rol
  Estudiante sin dar el motivo.

## Contexto

RN-OFF-02 pide que, antes de salir a campo, el usuario descargue "la versión activa
del formulario, los datos de los puentes **asignados** y su última inspección
publicada". En el sistema, solo el Estudiante tiene puentes asignados: la asignación
vive en el curso (`/api/v1/mis-asignaciones`). El Catedrático, el Administrador y el
Profesional externo no tienen asignaciones; inspeccionan cualquier puente activo.

## Decisión

`/offline/local` ofrece **Preparar para uso sin conexión** solo al rol Estudiante.
La descarga se arma desde sus asignaciones vigentes, como describe 0025. Los demás
roles inspeccionan en línea.

## Consecuencias

- Se cumple RN-OFF-02 tal como está escrita: la preparación descarga los puentes
  asignados.
- Un Profesional externo no puede capturar sin conexión. Habilitarlo requiere que
  elija los puentes que va a descargar: es una lista de referencia nueva en la
  preparación, no un cambio de permisos.
- El manual de usuario explica esta limitación.
