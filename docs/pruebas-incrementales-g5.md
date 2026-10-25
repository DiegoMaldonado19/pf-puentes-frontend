# G5 — Preparar pruebas sin acreditar integraciones ausentes

G5 entrega herramientas de prueba aisladas. **Ningún V01–V21 queda aprobado** por ejecutar este material. La base conserva su proyecto `base-offline`; no se agrega un job integral verde con escenarios omitidos.

## Ejecutar la preparación

Desde el repositorio frontend:

```sh
node --test scripts/pruebas-g5/*.test.mjs
npm run test:e2e:base -- --grep 'G2|G3|G4'
```

La primera orden verifica las herramientas y la coherencia del inventario, no ejecuta aceptación remota. La segunda ejecuta regresiones del harness con IndexedDB aislada por contexto Playwright, sesión HTTP sustituida y sin transporte productivo. `npm run test:e2e` todavía ejecuta únicamente la base; G12 incorporará integración real cuando estén sus precondiciones.

## Adaptadores y fixtures

| Pieza                                  | Uso                                                     | Límite                                                                                                                |
| -------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `e2e/fixtures/sesion-offline.ts`       | Identidades A/B, auth ficticia, apertura y espera de SW | Solo imports de E2E; token en memoria, no login remoto. Reutilizada por G2–G4.                                        |
| `offline/demo/preparacion-fixtures.ts` | Proveedores ficticios P4/P5 y asignaciones              | Solo harness; ausencia de publicación válida no equivale a fallo.                                                     |
| `offline/demo/transporte-simulado.ts`  | ACK, errores, demora y coordinación                     | No acredita idempotencia, permisos ni almacenamiento remotos.                                                         |
| `scripts/pruebas-g5/catalogo.mjs`      | Inventario V01–V21, decisiones y casos parametrizados   | Todos los V integrales permanecen `no_ejecutable` en este catálogo preparatorio. No invalida evidencia parcial G2–G4. |

## Conflictos y permisos pendientes

`casosConflicto` separa divergencia, replay, rollback, publicada, borrador ajeno, puente sin asignar, asignación vencida y lectura sin permiso. Cada caso enlaza V10 o V15, invariantes y parámetros referenciados por ID en `decisiones`.

Los valores siguen en `null`: revisión/ACK P5, contenido de snapshot, perfiles/API de consulta #18, códigos/ProblemDetail y políticas de huella/concurrencia/retención. Son **pendientes**, no acuerdos ni valores por defecto. Al acordarlos, actualizar contratos/ADR en la aplicación responsable y agregar pruebas reales; no rellenarlos para conseguir verde.

Ya está requerido que prevalezca el cliente solo en borrador propio editable, que snapshot y aplicación sean atómicos y que el replay devuelva código/cuerpo originales exactos. Preparar estos casos no implementa esa conducta en el servidor.

## Evidencia y siguiente paso

Distinguir siempre **herramienta aislada verificada**, **escenario simulado ejecutado** y **aceptación integral no ejecutable**. Registrar comando, revisión, salida/código y reportes; no guardar cookies, JWT ni cabeceras autenticadas.

Ver [validación P6](../../specs/2026-10-05-offline-y-sincronizacion/validation.md) para cada resultado obligatorio. G6 resuelve acuerdos por integración; G7–G11 aportan servicios reales; G12 verifica conteos/hashes PostgreSQL/MinIO, permisos, PWA y jornada física. Los dobles nunca son fallback de producción.
