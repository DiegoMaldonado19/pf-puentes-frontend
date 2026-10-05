# 0010. Playwright y harness offline aislado

- Estado: aceptado
- Fecha: 05/10/2026
- Directriz: DT-CAL-04, DT-OFF-01, grupo 1 P6

## Contexto

jsdom no acredita IndexedDB, blobs ni arranque PWA offline en navegador real.

## Decisión

Playwright Chromium, proyecto `base-offline`, prueba el build `base-offline`
con SW habilitado. Una sustitución de rutas habilita `/offline/demo` solo en
ese build. Fixtures y ACK simulados usan exclusivamente `puentes-offline-demo`.
Vitest usa fake-indexeddb para probar lógica determinista; Playwright usa
IndexedDB real. CI conserva reportes y trazas, sin backend.

## Consecuencias

`test:e2e` es la entrada extensible general; `test:e2e:base` sigue autónoma.
La producción habitual no incluye rutas ni transporte del harness. Estas pruebas
no acreditan contratos externos, Safari físico ni jornada de ocho horas.
