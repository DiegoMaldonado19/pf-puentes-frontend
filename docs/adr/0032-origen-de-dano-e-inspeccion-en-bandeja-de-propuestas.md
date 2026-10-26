# 0032 — Origen de daño e inspección en bandeja y aceptación de propuestas

- Estado: implementado
- Fecha: 25/10/2026
- Trazabilidad: HU-P8-MTO-02, RN-MTO-02, RN-MTO-06
- Contrato backend relacionado: [ADR 0045](../../../pf-puentes-backend/docs/adr/0045-generacion-de-propuestas-por-dano-y-deteccion-de-anulaciones.md)

## Decisión

1. **Trazabilidad visual en `<app-bandeja-propuestas>`:**
   - En la tabla de propuestas pendientes de revisión, cuando una propuesta proviene de un daño detectado en un elemento específico (`orden.elemento_ref !== null`), se muestra `({{ orden.elemento_ref }})` junto a la descripción de la intervención, conservando intactas las 4 columnas de la tabla (`Tipo`, `Prioridad`, `Intervención`, `Fecha programada`).

2. **Trazabilidad de origen en `<app-aceptacion-propuesta>`:**
   - En el panel de revisión y aceptación de una propuesta seleccionada, se muestran explícitamente `<dt>Elemento afectado</dt><dd>{{ orden().elemento_ref }}</dd>` y `<dt>Inspección de origen</dt><dd>{{ orden().inspeccion_id }}</dd>` cuando están presentes en el DTO (`OrdenMantenimientoDTO`), permitiendo al Catedrático o Administrador verificar qué elemento e inspección originaron la propuesta automática antes de aceptarla.

## Verificación

- Pruebas unitarias actualizadas en `bandeja-propuestas.spec.ts` y `aceptacion-propuesta.spec.ts` (43 pruebas en verde).
- Formato `Prettier` y linter `ESLint` en verde.
