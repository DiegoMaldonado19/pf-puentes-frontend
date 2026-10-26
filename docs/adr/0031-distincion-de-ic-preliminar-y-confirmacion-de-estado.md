# 0031 — Distinción de IC preliminar y confirmación de estado con justificación

- Estado: implementado
- Fecha: 25/10/2026
- Trazabilidad: HU-P8-IC-05, HU-P8-IC-06, RN-IC-06, RN-IC-07, DT-ARQ-06, DT-FE-12/13
- Contrato backend relacionado: [ADR 0044](../../../pf-puentes-backend/docs/adr/0044-estimacion-preliminar-del-ic-y-confirmacion-con-justificacion.md)

## Decisión

1. **Cliente HTTP en `PesosService`:**
   - `estimarIcPreliminarPorFormulario(formularioId, solicitud)`: invoca `POST /api/v1/formularios/{formularioId}/ic-preliminar`.
   - `estimarIcPreliminarPorInspeccion(inspeccionId, versionPesosId)`: invoca `POST /api/v1/inspecciones/{inspeccionId}/ic-preliminar` para borradores sin alterar el estado persistido.
   - `validarConfirmacionEstado(solicitud)`: invoca `POST /api/v1/inspecciones/confirmacion-estado/validacion` para validar y normalizar la justificación previa a publicación.

2. **Componente reutilizable `IcPreliminar` (`<app-ic-preliminar>`):**
   - Presenta visualmente el IC estimado para borradores e inspecciones no publicadas (`RN-IC-07`).
   - Muestra de manera prominente el rótulo "IC preliminar", la advertencia explícita de no oficialidad ("No altera el inventario ni el mapa"), el puntaje a dos decimales y el componente accesible `<app-estado-puente>`.
   - Soporta bandera de `datosIncompletos` alertando si aún faltan respuestas de daño en el formulario.
   - Despliega un banner de advertencia si existen causas de anulación crítica estructural de `RN-IC-05` (`SOCAVACION`, `ASENTAMIENTO`, `PERDIDA_SECCION`, `AUSENCIA_PORTANTE`).

3. **Componente interactivo `ConfirmacionEstado` (`<app-confirmacion-estado>`):**
   - Permite al evaluador confirmar el estado de condición calculado automáticamente o elegir uno diferente (`RN-IC-06`).
   - Si el estado confirmado coincide con el calculado, muestra indicador de conformidad sin requerir justificación.
   - Si el estado confirmado difiere del calculado, despliega un campo de texto para la justificación obligatoria con validación de contenido no vacío, advertencia de obligatoriedad y conteo.
   - Detecta y alerta si se pretende subir a Regular o Bueno una inspección con anulación crítica estructural forzada a Malo (`RN-IC-05`).
   - Emite el evento `(cambio)` con la tupla `{ estadoConfirmado, justificacion, valida, tieneDiscrepancia, esElevacionCritica }`.

## Verificación

- Pruebas unitarias de `PesosService` para los tres nuevos endpoints HTTP (`pesos.service.spec.ts`).
- Pruebas unitarias completas de renderizado, accesibilidad y estados de `IcPreliminar` (`ic-preliminar.spec.ts`).
- Pruebas unitarias completas de interacción, discrepancia, elevación crítica, validación y deshabilitación en `ConfirmacionEstado` (`confirmacion-estado.spec.ts`).
- Formato `Prettier` y linter `ESLint` en verde.

