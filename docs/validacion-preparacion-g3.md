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

## Verificación real aprobada — S7

Ejecución del **25/10/2026, 02:19 UTC**, backend `develop`
`f9e9a5a52cd087b77900217e23dd38d906aae526`. Se usó el origen
`http://localhost:4200/api/v1`, proxy del frontend hacia `localhost:8080`,
con HTTP real y sesión emitida por P2, sin sustitución de respuestas.
El fallo de conexión anterior queda como evidencia histórica, ya resuelto.

El usuario autorizó crear datos mínimos locales mediante APIs. Como no había
docentes activos, estudiantes activos ni puentes, se crearon:

| Recurso                                          | Identificador                          |
| ------------------------------------------------ | -------------------------------------- |
| Docente por invitación aceptada                  | `01a170db-7766-7a81-86ce-5d69e40a58c7` |
| Estudiante por registro y verificación de correo | `01a170db-7977-7b85-b837-f8e37ec95c9a` |
| Puente prueba G3 (`GT-16-1612-0001`)             | `01a170db-7a11-744c-afea-5740c29b3e80` |
| Curso prueba G3                                  | `01a170db-7b3f-7d99-a27c-68698eae47f9` |
| Inscripción                                      | `01a170db-7b62-7615-8e39-330d2f1a8943` |
| Asignación                                       | `01a170db-7b7a-7eed-b0b3-8901cef48442` |

### Preparación de datos, separada de la consulta de contrato

Invitación y aceptación del docente, registro del estudiante, puente, curso,
inscripción y asignación: HTTP 201. Verificación de correo: HTTP 204.
La inscripción activó al estudiante pendiente con correo verificado mediante
el servicio productivo existente; login del estudiante HTTP 200 con rol
`ESTUDIANTE`, y consulta administrativa HTTP 200 con estado `ACTIVO`.
No se usó SQL, cambio directo de roles/estado ni bypass de activación.

### Resultado del contrato

- `GET /mis-asignaciones?page=0&size=1`: HTTP 200. Claves exactas
  `content`, `number`, `size`, `total_elements`, `total_pages`;
  `number=0`, `size=1`, `total_elements=1`, `total_pages=1`.
- El único elemento conserva los diez campos `snake_case` de P7 y los ids
  de estudiante, curso, inscripción y puente creados, sin perder contexto.
- `GET /mis-asignaciones?page=1&size=1`: HTTP 200, contenido vacío.
- `GET /puentes/{id}`: HTTP 200, id y nombre coinciden con la asignación.
- Runner HTTP: exit 0, 17 peticiones exitosas. Registro saneado en el workspace:
  `odd/evidence/offline-referencia-g3-real.json`.

Las credenciales administrativas se leyeron del `.env` en memoria. Contraseñas
aleatorias, tokens y enlaces de correo no se imprimieron ni guardaron en los
artefactos de evidencia. Se usó la entrega legítima de correo por consola del
entorno local. Los recursos de prueba permanecen para trazabilidad; las cuentas
pueden recuperarse mediante el flujo normal de restablecimiento de contraseña.

Esta prueba acredita el contrato HTTP real a través del proxy, **no** un recorrido
visual Angular ni Preparar salida productivo. El dataset mínimo real tiene una
sola asignación; múltiples páginas no vacías, dos cursos por puente y errores
intermedios/401/403 están acreditados por las pruebas HTTP aisladas, no por este
dataset. P4/P5 y V01/V02/V16 completos siguen fuera de esta evidencia.

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
