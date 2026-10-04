# 0006. Desarrollo local con hot reload

- Estado: aceptado
- Fecha: 03/10/2026
- Directriz o regla relacionada: DT-DEP-06

## Contexto

En local se quiere recarga en caliente sin instalar Node. Dev, stage y prod no llevan hot reload.

## Decisión

- `compose.local.yaml` construye la etapa `dev` del `Dockerfile` y corre `ng serve`.
- `docker compose -f compose.local.yaml up --watch` sincroniza `src/` y `public/` con el contenedor y reconstruye la imagen si cambia `package.json`.
- `proxy.conf.mjs` reenvía `/api` a `API_URL`: en Docker apunta a `host.docker.internal:8080`, el backend local, y fuera de Docker a `localhost:8080`.

## Consecuencias

- El navegador se recarga al guardar, y `/api` funciona igual que en la nube, en el mismo origen.
- Para usar `/api`, el backend tiene que estar levantado con su propio `compose.local.yaml`.
