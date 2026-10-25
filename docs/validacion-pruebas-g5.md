# G5 — Evidencia de herramientas y pruebas incrementales

## Alcance

Entrega preparatoria del grupo 5: catálogo V01–V21, casos parametrizados V10/V15, fixtures de sesión reutilizadas por G2–G4 e instrumentación determinista de red aislada. **No acredita sincronización remota ni aceptación integral.** Guía: [pruebas-incrementales-g5.md](pruebas-incrementales-g5.md).

Base local: frontend `1e39bbd`. Unidades locales: `bc51cf1` (catálogo/fixtures) y `fb6b6ab` (instrumentación). Fecha: 25/10/2026. Node 24.21.0; Chromium de Playwright. No se modificaron backend, dependencias, configuración CI ni código productivo.

## Pruebas focalizadas observadas

| Comando                                                               | Resultado            | Evidencia / límite                                                                                   |
| --------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------- |
| `node --test scripts/pruebas-g5/catalogo.test.mjs` antes del catálogo | RED, salida 1        | Módulo ausente; no aceptación pendiente convertida en skip.                                          |
| `node --test scripts/pruebas-g5/catalogo.test.mjs` después            | GREEN, salida 0, 2/2 | Inventario completo y parámetros pendientes/casos trazables.                                         |
| `npm run test:e2e:base -- --grep 'G2\|G3\|G4'`                        | Salida 0, 4/4        | Regresiones de sesión/revocación, snapshot/captura y diagnóstico; HTTP ficticio e IndexedDB aislada. |
| `node --test scripts/pruebas-g5/red.test.mjs` antes del adaptador     | RED, salida 1        | Módulo de instrumentación ausente.                                                                   |
| `node --test scripts/pruebas-g5/*.test.mjs` después                   | GREEN, salida 0, 4/4 | Calendario, dos abortos por diez rutas, registro defensivo y sin lectura de credenciales.            |
| `npm run test:e2e:base -- --grep 'G5'`                                | Salida 0, 1/1        | Cuatro respuestas 404 y un aborto previo; espera inyectada, no latencia real de aceptación.          |

La extracción de helpers mantiene las aserciones G2–G4. La prueba G5 adjunta `G5-herramienta-aislada-no-V05-V06-V07` al reporte de base. Reportes y trazas: `playwright-report/base-offline/` y `test-results/base-offline/`; se regeneran en cada ejecución. No contienen credenciales reales.

## Checks completos

| Check                       | Código / resultado                                                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `npx prettier --check .`    | 1: detectó seis archivos locales ignorados; detalle debajo.                                                                        |
| `npx ng lint`               | 0, aprobado.                                                                                                                       |
| `npm run build`             | 0, aprobado; advertencia de bundle inicial: 501,52 kB frente al presupuesto de advertencia de 500 kB. No se cambió el presupuesto. |
| `npx ng test --watch=false` | 0, 641/641 en 67 archivos.                                                                                                         |
| `npm run test:e2e:base`     | 0, 13/13; B01–B08 existentes, G2–G4 y herramienta G5. No acredita ampliación B02 de fotos generales ni recorrido humano.           |

Formato global: `.atl/.skill-registry.cache.json`, `.atl/skill-registry.md`, `.review-g2-t2a/odd/tasks/sesion-offline-p2.md`, `.review-g2-t2a/src/app/offline/sesion-offline.spec.ts`, `odd/tasks/offline-diagnostico-g4.md` y el documento de seguimiento G5. Se formatea únicamente el seguimiento propio; no se alteran artefactos ajenos. La comprobación de archivos versionados se registra por separado; no se reejecuta ni se declara verde el comando global fallido. Su primera invocación explícita incluyó binarios y archivos sin parser (salida 123 de `xargs`, 16 errores de parser); el comando corregido `git ls-files -z | xargs -0 npx prettier --check --ignore-unknown` terminó con salida 0, sin modificar esos archivos. El check explícito del registro G5 y de su documento de seguimiento también terminó con salida 0.

El harness emitió mensajes de recursos 404/504 durante los casos de desconexión y su servidor estático; Playwright terminó con 13 aprobados y cero omitidos. No se ejecutó backend ni aceptación integral; no eran checks aplicables a una entrega sin cambios productivos/backend.

## No ejecutable como aceptación integral

El catálogo indica bloqueadores y evidencia necesaria para cada V01–V21. En particular:

- V10/V15: revisión/ACK P5, snapshot y permisos #18, códigos de rechazo e idempotencia siguen pendientes; los casos no materializan políticas provisionales.
- V05: falta corte después de observar bytes de una subida real e integridad MinIO.
- V06: falta confirmación backend observable y descarte posterior de respuesta; no se simula un commit real.
- V07: calendario verificado con espera sustituida no demuestra red efectiva ni vaciado/integridad remotos.
- V18/V19: no hubo jornada física ni Safari/iOS real. Demo humana G1 y fotos generales siguen fuera de G5.

No hay tests integrales vacíos, `skip` ni job integral anunciado como verde. `test:e2e` conserva el proyecto autónomo. G12 agregará ejecución integral con precondiciones reales. No se aceptan ADR externos; las propuestas y decisiones pendientes siguen identificadas en el inventario.

## Entrega local

Se eligió cadena sobre rama predeterminada verificada (`origin/HEAD` apunta a `main`). Las unidades se preservan sobre la base `develop` que contiene G2–G4. `origin/main` local aún no contiene esa base: su diferencia acumulada incluye decenas de commits ajenos a G5 y **no es el alcance de esta entrega**. Antes de publicar PR hacia `main` habrá que disponer de la base requerida o reubicar las unidades; no se hizo push, PR, merge ni reescritura de historia.

Evaluación nativa de cada unidad: riesgo `medium`, `reviewDue=false`; no se abrió revisión nativa. El escritor delegado no estuvo disponible y se trabajó inline. Riesgo del cambio: no modifica contratos productivos, datos almacenados ni políticas; únicamente material de pruebas y documentación.
