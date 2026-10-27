# 0033 — Transporte HTTP y multipart de la cola offline

- Estado: implementado
- Fecha: 27/10/2026
- Trazabilidad: RN-OFF-05, RN-OFF-08, RN-OFF-09, DT-OFF-05; contratos 9 y 15
- Contrato backend relacionado: [ADR 0046](../../../pf-puentes-backend/docs/adr/0046-idempotencia-del-put-de-borrador.md) y [ADR 0047](../../../pf-puentes-backend/docs/adr/0047-idempotencia-del-post-de-envio.md)

## Contexto

La cola offline (`MotorSync`) solo tenía `TransporteSimulado`. [base-offline.md](../base-offline.md) le asigna a P1 el transporte HTTP/multipart "con las claves y UUID originales". El servidor ya acepta `Idempotency-Key` en el PUT de borrador y en el envío, y las fotos y documentos son idempotentes por su `id`.

## Decisión

1. `TransporteHttp` (`offline/transporte-http.ts`) implementa `TransporteSync` con `HttpClient`. Así pasa por el `authInterceptor`: Bearer y una renovación ante 401 (escenario 7 de Frontend/06).
2. Cada operación de la cola va a un endpoint que ya existe:

   | Operación       | Petición                                                                                                                                         |
   | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
   | `datos`         | `PUT /api/v1/inspecciones/{id}` con `Idempotency-Key: clave` y `X-Sgp-Sync: true`; cuerpo `{datos, version, fecha_inspeccion, grupos_sin_danos}` |
   | `datos` con 404 | `POST /api/v1/inspecciones` (alta idempotente por el UUID v7 del cliente) y después el mismo PUT                                                 |
   | `foto`          | `POST /api/v1/inspecciones/{id}/fotos`, multipart del contrato 9 con el `id` local                                                               |
   | `documento`     | `POST /api/v1/inspecciones/{id}/documentos`, multipart con `id` y `pdf`                                                                          |
   | `envio`         | `POST /api/v1/inspecciones/{id}/envio` con la misma clave y `X-Sgp-Sync`; cuerpo `{enviada_en: intencion_envio_en}`                              |

3. **Versión determinista.** La huella del PUT incluye el DTO completo. Por eso `version` es la última `resultado.version` confirmada de esa inspección en `cola_sync`, o 0: un reintento manda los mismos bytes y el servidor reproduce la respuesta en lugar de responder `409 clave-idempotencia-incompatible`.
4. **Rechazos:**
   - transitorios: 0, 408, 429, 5xx y `409 operacion-en-proceso`;
   - de sesión: 401, después de la renovación;
   - de negocio: el resto.

   El mensaje es el que adjunta el `erroresInterceptor` o, si no hay, el `detail` del problema.

5. **Aborto.** Si el motor aborta (cambio de propietario o cierre), la petición en vuelo se cancela y se lanza `AbortError`.
6. **Contrato de `metadatos` con la captura de P5** (`MetadatosInspeccion`):
   - `fecha_inspeccion`; si falta, se usa la fecha de Guatemala de `creada_en`;
   - `asignacion_id` y `curso_id`;
   - `latitud` y `longitud`;
   - `grupos_sin_danos`;
   - `supersede_a_id` y `motivo_correccion`.
7. **`dispositivo_id`.** Un UUID v7 por navegador, guardado en `localStorage` (`sgp.dispositivo`). Si el almacenamiento falla, vive en memoria.

## Consecuencias

- Conectar el transporte al motor real le toca a P6: `new MotorSync(db, sesion, inject(TransporteHttp))`.
- Si otra acción del servidor sube la versión (por ejemplo, confirmar los datos permanentes), el siguiente PUT llega desactualizado. Con `X-Sgp-Sync`, el servidor fusiona y guarda la copia previa (RN-OFF-09).
- `X-Sgp-Sync` no está en los encabezados permitidos de CORS del backend (`CorsConfig`). No afecta a los entornos desplegados, porque nginx sirve la API en el mismo origen. Si se usa desde otro origen, hay que agregarlo (P1).

## Verificación

- `transporte-http.spec.ts`: 16 pruebas. Cubren el mapeo, la versión determinista, el alta tras 404, el multipart, el envío, la tabla de rechazos, el aborto y la foto sin archivo local.
- Prettier, ESLint, pruebas unitarias y build en verde.
