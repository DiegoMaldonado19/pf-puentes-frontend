# Validación de base offline — 05/10/2026

## Ambiente

- Node 24.21.0 / npm 11.19.0 (ejecutados mediante herramientas temporales;
  el host tiene Node 24.14.0 / npm 11.9.0).
- Angular instalado 22.2.1, Dexie 4.4.6, uuid 14.0.2, Playwright 1.63.0.
- Linux x64; Chromium 153.0.8010.12, headless, IndexedDB real y SW activo.
- Código de trabajo sobre frontend, sin commit creado. `package-lock.json`
  fija las versiones; CI identifica su revisión con el árbol Git.
- Build `base-offline`, origen `http://localhost:8090`, sin API/backend.

## Resultados automatizados

| ID  | Evidencia verificada                                                                                                                                                 | Resultado |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| B01 | Cierre de pestaña/reapertura offline, shell precargado, fixtures y UUID v7 antes del transporte                                                                      | Aprobado  |
| B02 | UI de P1 captura cuatro imágenes; JSON, PDF, GPS, anclajes, hashes y dimensiones permanecen tras cierre/reapertura sin red                                           | Aprobado  |
| B03 | `QuotaExceededError` instrumentado sobre escritura nativa: rollback de archivo/cola, mensaje visible; persistencia denegada; migración v1→v2 con Blob/miniatura real | Aprobado  |
| B04 | Cinco fallos con reloj controlado, backoff/clave conservados tras recarga, sin sexto automático, reintento manual con ACK                                            | Aprobado  |
| B05 | Archivo bloqueado, envío dependiente pendiente, otra inspección avanza; archivos seriales y envío último                                                             | Aprobado  |
| B06 | Contadores por entidades distintas, ocupación, último intento, rechazo visible y acción manual hasta cero pendientes                                                 | Aprobado  |
| B07 | Dos pestañas; edición antes de ACK v1 mantiene versión 2; cierre en vuelo, vencimiento real del lease y recuperación                                                 | Aprobado  |
| B08 | Cambio A/B, bases separadas y ausencia de fallback: cola real sin adaptador permanece pendiente                                                                      | Aprobado  |

Además, Vitest comprueba ausencia/error de Storage API, límites, pertenencia,
sesión inválida, ACK incompatible, transacciones, snapshots y disparos del motor.
Formato, lint y build de producción pasan; se registran 18 pruebas
Angular/Vitest y 8 escenarios Playwright aprobados. Los reportes/trazas están
en los directorios indicados en [base-offline.md](base-offline.md).

## Alcance de la evidencia

La cuota se provoca mediante `QuotaExceededError` sobre IndexedDB real, sin
agotar físicamente el disco. El simulador y el reloj controlado no acreditan
API real ni ocho horas físicas. B07 sí espera el vencimiento real del lease.
`/api/**` continúa excluido de navegaciones y no hay `dataGroups` de escrituras.
El build habitual no contiene la ruta demo ni sus fixtures.

El harness fue reproducido por interacción UI automatizada con screenshot y
traza. **Pendiente de cierre humano:** ejecutar y registrar el recorrido manual
de [base-offline.md](base-offline.md). No se marca esa revisión como realizada.
Las pruebas integrales V01..V21 corresponden a entregas posteriores.
