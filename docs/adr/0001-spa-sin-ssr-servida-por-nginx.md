# 0001. SPA sin SSR servida por nginx

- Estado: aceptado
- Fecha: 03/10/2026
- Directriz o regla relacionada: DT-ARQ-01, DT-DEP-02, DT-DEP-03

## Contexto

El proyecto se generó con SSR (Express + `server.ts`). DT-ARQ-01 prohíbe el renderizado en el servidor y DT-DEP-02 pide que nginx sirva los estáticos de Angular. Además, el SSR complica la PWA offline (P6).

## Decisión

- Se quita el SSR: archivos `*.server.ts`, `server.ts`, la hidratación y las dependencias `@angular/ssr`, `@angular/platform-server` y `express`.
- La imagen final es `nginx-unprivileged`, que sirve `dist/pf-puentes-frontend/browser` y pasa `/api/` al backend.

`nginx.conf`:

- `client_max_body_size 25m` y gzip;
- caché de un año (`immutable`) para los archivos con huella;
- `index.html` sin caché;
- fallback de la SPA a `index.html`;
- `resolver` de Docker con `proxy_pass` por variable, para que nginx arranque aunque el backend todavía no exista y siga su IP después de cada redeploy.

## Consecuencias

- El frontend llama a `/api` en su mismo origen: no hay URL de API compilada y la misma imagen sirve para los tres entornos.
- nginx corre sin root (DT-DEP-11) y escucha en el 8080.
- Quedan pendientes TLS (DT-DEP-04), brotli y los encabezados de seguridad (DT-SEC-10/11), previstos para el nginx de producción.
