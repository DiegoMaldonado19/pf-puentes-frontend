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

## Instrumentación de red aislada

`crearRedDePrueba` en `scripts/pruebas-g5/red.mjs` se conecta a `context.route(patron, route => red.atender(route))` en pruebas. Su calendario es fijo: demoras 2000/2500/3000 ms cíclicas y aborto de cada quinta petición **antes** del envío (20 % por bloque de cinco). Crear una instancia por prueba y registrar el orden real de peticiones; no usar aleatoriedad ni aplicarlo globalmente a auth o producción.

`registro()` devuelve copias con orden, demora y acción, sin URL, cabeceras, cuerpos o tokens. El adaptador acepta `esperar` inyectable: las pruebas aisladas no esperan segundos reales y no acreditan V07. La prueba de navegador `instrumentacion-g5.spec.ts` comprueba cuatro respuestas 404 y un error de red sobre una sonda inexistente, sin endpoints productivos de prueba ni mutaciones. Adjunta únicamente el calendario saneado.

Ese contexto de instrumentación bloquea SW para observar las rutas; **solo ese contexto**. Las pruebas PWA existentes mantienen SW activo. G12 debe aplicar degradación a la capa de red efectiva y conservar una prueba real de PWA.

No implementamos corte de subida después de bytes observados ni descarte de respuesta después de commit: **V05/V06 siguen no ejecutables** hasta disponer de proxy/instrumentación y confirmación backend verificables. `route.abort()` previo no sustituye ninguna de esas pruebas. Tampoco el calendario aislado acredita la terminación remota de V07.

No cambia arquitectura productiva ni configuración CI; no corresponde aceptar un ADR externo. Los ADR existentes de persistencia/Playwright siguen vigentes.

## Evidencia y siguiente paso

Distinguir siempre **herramienta aislada verificada**, **escenario simulado ejecutado** y **aceptación integral no ejecutable**. Registrar comando, revisión, salida/código y reportes; no guardar cookies, JWT ni cabeceras autenticadas.

Ver [validación P6](../../specs/2026-10-05-offline-y-sincronizacion/validation.md) para cada resultado obligatorio. G6 resuelve acuerdos por integración; G7–G11 aportan servicios reales; G12 verifica conteos/hashes PostgreSQL/MinIO, permisos, PWA y jornada física. Los dobles nunca son fallback de producción.
