# 0030 — Comparación y solicitud de recálculo fechado del IC

- Estado: implementado
- Fecha: 25/10/2026
- Trazabilidad: HU-P8-IC-07, RN-IC-08, DT-FE-06/10/11/12/13
- Contrato backend relacionado: [ADR 0043](../../../pf-puentes-backend/docs/adr/0043-recalculo-fechado-del-indice-de-condicion.md)

## Decisión

Se amplía `PesosService` (`consultarRecalculos` y `recalcularIc`) con los contratos tipados `ComparacionRecalculoIcDTO`, `ResultadoOriginalIcDTO`, `RecalculoIcDTO` y `SolicitarRecalculoIcDTO`, y se incorpora el componente standalone `RecalculoIc` (`<app-recalculo-ic>`) en `src/app/features/admin/pesos/`.

## Comportamiento y accesibilidad

- **Distinción explícita (`RN-IC-08`):** presenta en secciones separadas el resultado original publicado (inmutable, con su fecha de publicación, vigencia/acta de pesos original, IC, estado calculado, estado confirmado, justificación y condición crítica de anulación) y la tabla paginada de recálculos fechados (con fecha del recálculo en `America/Guatemala`, vigencia/acta del juego aplicado, IC recalculado, variación firmada respecto al original, estado calculado y anulación).
- **Representación accesible (`RN-IC-04`, `DT-FE-13`):** reutiliza `<app-estado-puente>` tanto para el resultado original como para cada recálculo.
- **Solicitud controlada:** cuando `[puedeRecalcular]="true"` y existen `juegosDisponibles`, permite elegir un juego de pesos de la versión del formulario y ejecutar `POST /api/v1/inspecciones/{inspeccionId}/recalculos-ic`. Expone `operacionPendiente()` mientras el envío está en curso, emite `(recalculado)` al confirmar y recarga la vista comparativa desde la primera página.
- **Manejo de errores y sesión:** ante `401` o `403` retira inmediatamente los datos privados mostrados; traduce `404`, `409` (inspección no publicada) y `400/422` (juego o datos incompatibles) con textos centralizados en `TEXTOS.pesos.recalculo` sin reenviar automáticamente peticiones de resultado incierto.

## Verificación

Pruebas unitarias y de integración DOM/HTTP en `pesos.service.spec.ts` y `recalculo-ic.spec.ts` cubriendo consulta comparativa, solicitud de recálculo, variación positiva y negativa, anulaciones críticas, paginación, actualización y manejo de errores `401/403/404/409/422`.
