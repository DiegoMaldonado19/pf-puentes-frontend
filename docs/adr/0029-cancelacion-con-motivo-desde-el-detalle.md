# 0029 — Cancelación con motivo desde el detalle de la orden

- Estado: implementado
- Fecha: 25/10/2026
- Trazabilidad: HU-P8-MTO-06 (cancelación), RN-MTO-04, RN-MTO-09, DT-FE-06/10/11
- Contrato backend relacionado: [ADR 0042](../../../pf-puentes-backend/docs/adr/0042-cancelacion-auditada-de-ordenes-programadas.md)

## Decisión

Se unifica el formulario de descarte y cancelación en `DecisionConMotivoOrden` (`<app-decision-con-motivo-orden>`), parametrizado por `operacion: 'descarte' | 'cancelacion'`.

- Cuando `operacion === 'descarte'`, exige estado `PROPUESTA` y consume `MantenimientoService.descartar` (`POST .../descarte` → `DESCARTADA`).
- Cuando `operacion === 'cancelacion'`, exige estado `PROGRAMADA` y consume `MantenimientoService.cancelar` (`POST .../cancelacion` → `CANCELADA`).

`ConsultaOrdenes` incorpora `[puedeCancelar]` (`false` por defecto, alimentado desde `GestionMantenimiento` con el permiso de sesión Catedrático/Admin de P2) y emite `(cancelada)` con el `OrdenMantenimientoDTO` confirmado por el servidor.

## Comportamiento, concurrencia y errores

- Exige motivo no blanco; conserva el texto exacto sin recortarlo.
- Mientras el `POST` está en vuelo, `envioPendiente` forma parte de `operacionPendiente()` del contenedor, bloqueando cambio de selección, paginación, recargas, salida de vista y otras acciones sobre la orden (`programar`, `iniciar`, `prioridad`, `evidencia`).
- Al confirmar `CANCELADA`, actualiza la fila del historial y el detalle, recarga el resumen de seguimiento rutinario anual y mantiene la orden consultable en el historial (con sus evidencias previas en modo solo lectura, sin permitir nuevas subidas ni inicio de ejecución).
- `400/422` conservan el texto escrito para corrección; `401/403` retiran el formulario y los datos privados del contenedor; `404/409/5xx` o respuesta incompatible exigen reconciliación por `GET` sin reenviar el `POST` automáticamente.

## Verificación

Pruebas unitarias y de integración DOM/HTTP en `decision-con-motivo-orden.spec.ts`, `consulta-ordenes.spec.ts`, `gestion-mantenimiento.spec.ts` y `mantenimiento.service.spec.ts`, además del recorrido E2E de Playwright (`e2e/p8/recorrido.spec.ts`) verificando cancelación para Administrador (con foto previa conservada en solo lectura) y Catedrático, y rechazo `403` para Estudiante y Profesional.
