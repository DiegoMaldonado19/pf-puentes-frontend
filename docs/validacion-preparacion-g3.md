# G3 — Referencia y preparación local: evidencia parcial

## Alcance

Base frontend `7fbcd4a`, consumidores `260ddc9`, preparación durable `d867980`.
Backend local en rama `develop`, revisión `f9e9a5a52cd087b77900217e23dd38d906aae526`.
Esta entrega no acredita V01/V02/V16, Preparar salida productivo, sincronización
real ni aceptación integral. P4/P5 siguen sin adaptadores productivos.

## Evidencia observada

- P7/P3: RED antes de implementar; GREEN 15 pruebas HTTP: paginación desde cero,
  vacío, contextos distintos del mismo puente, fallo intermedio, 401/403 y sesión.
- Preparación: 24 pruebas; publicación completa atómica con habilitación G2,
  fallo parcial, proveedor/esquema ausente, ausencia válida de publicación,
  reapertura, aislamiento, invalidación, rollback y migración v3→v4 con captura,
  cola y bytes de foto/miniatura/PDF preservados.
- Verificación independiente: 28 regresiones G2, build y cinco sondas adicionales
  de conservación/identidad aprobados. Detectó expectativa antigua de versión
  en `offline.spec.ts`; se actualizó a v4. Suite posterior: 557/557 aprobadas.
- Navegador G3: RED observó snapshot ausente en el harness anterior. GREEN
  comprobó snapshot con dos asignaciones del mismo puente, publicación ausente
  válida, captura ligada a versión/contexto preparados, JSON, foto/miniatura,
  PDF, intención y operaciones idénticas después de recargar. Usa IndexedDB real
  en Chromium y HTTP P2 sustituido por Playwright; no es evidencia backend real.
- Regresión G2 de navegador: cierre y cambio entre pestañas, reapertura sin red
  y recuperación por login continúan aprobados junto con G3: 3/3.
- Checks globales: formato de todos los archivos versionados y de los nuevos,
  lint, build productivo y suite Angular 557/557 aprobados. El comando literal
  `npx prettier --check .` falla sobre archivos locales preexistentes en `.atl/`
  y el worktree `.review-g2-t2a/`; no se modificaron esos archivos ajenos.
- Primera suite E2E completa: 10/11; B03 conservaba expectativa de versión 3.
  Se corrigió a 4 sin cambiar las aserciones de preservación de blobs/cola;
  ejecución posterior completa aprobada: **11/11** (B01–B08, G2 ×2 y G3).

## Verificación real pendiente — S7

`curl --max-time 3 http://localhost:8080/api/v1/mis-asignaciones` devolvió exit 7,
HTTP 000: no hay API escuchando en ese destino local. No se dispone de una
sesión de estudiante activo con asignaciones acreditada para este recorrido.
No se crearon cuentas, no se activaron pendientes ni se alteraron datos remotos.

Para completar S7 hace falta un backend `develop` accesible y una sesión de
estudiante activo con asignaciones existentes. Consultar mediante la sesión P2
normal, recorrer las páginas desde cero y contrastar contextos con P3; registrar
revisión, entorno, número de páginas/contextos y resultado sin guardar tokens o
credenciales. Esta evidencia es independiente del alta/activación de cuentas.

## Reproducir

```sh
npx ng test --watch=false --include=app/offline/asignaciones-p7.spec.ts
npx ng test --watch=false --include=app/offline/referencia-p3.spec.ts
npx ng test --watch=false --include=app/offline/preparacion.spec.ts
npm run test:e2e:base -- --grep 'G3 —|G2 —'
```

La demo autónoma G1 sigue probando B01–B08. El harness `/offline/demo?sesion=1`
consume preparación G3; sus proveedores ficticios están confinados al build
`base-offline` y a `puentes-offline-sesion-demo`. No se registran en producción.
Los reportes Playwright y trazas se generan en `playwright-report/base-offline/`
y `test-results/base-offline/`; no se versionan como aprobación integral.
