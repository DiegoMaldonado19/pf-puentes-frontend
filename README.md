# pf-puentes-frontend

SPA en Angular del Sistema de Gestión de Puentes (SGP). No usa SSR: en dev, stage y prod la sirve nginx ([ADR 0001](docs/adr/0001-spa-sin-ssr-servida-por-nginx.md)).

## Desarrollo local

Requisitos: Docker con Compose 2.32 o superior. En Windows, Docker Desktop con la integración de WSL activada.

```bash
docker compose -f compose.local.yaml up --watch
```

- Abre http://localhost:4200.
- Al guardar en `src/` o `public/`, el navegador se recarga en un segundo aproximadamente. Si cambias `package.json`, se reconstruye la imagen.
- `/api` se reenvía al backend local (`host.docker.internal:8080`): levanta también el `compose.local.yaml` del backend.
- Para apagar: `docker compose -f compose.local.yaml down`.

Sin Docker: `npm ci` y luego `npm start`. En ese caso el proxy apunta a `localhost:8080`.

## Antes de abrir un PR

Son los mismos chequeos que corre el CI, en el mismo orden:

```bash
npx prettier --check .   # para corregir: npx prettier --write .
npx ng lint
npm run build
npx ng test --watch=false
```

## Despliegue

GitHub Actions (`.github/workflows/ci-cd.yml`) corre cuatro etapas: build → test → push → deploy.

| Evento             | Entorno | URL                 |
| ------------------ | ------- | ------------------- |
| PR hacia `develop` | dev     | `http://<EC2>:8082` |
| push a `develop`   | stage   | `http://<EC2>:8081` |
| push a `main`      | prod    | `http://<EC2>`      |

- **Imagen:** `<DOCKERHUB_USERNAME>/pf-puentes-frontend:<número de build>`, más el tag `:tree-<hash>` que la identifica por contenido.
- **Promoción:** la misma imagen pasa de dev a stage y a prod sin reconstruirse. Prod solo acepta imágenes que pasaron por stage. Esto funciona porque la imagen no lleva la URL de la API compilada adentro.
- **En la EC2:** cada entorno vive en `~/puentes/<entorno>/pf-puentes-frontend` y comparte la red `puentes-<entorno>` con el backend del mismo entorno.

Las decisiones están en [docs/adr](docs/adr/) y los secretos y variables en el [ADR 0005](docs/adr/0005-configuracion-por-entorno-con-github-environments.md).

### Qué hace nginx

| Petición                                              | Respuesta                                                                              |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `/api/...`                                            | Se reenvía al `backend:8080` del mismo entorno. Tiene prioridad sobre las demás reglas |
| `/index.html` y `/ngsw.json`                          | Sin caché, para que la PWA reciba actualizaciones                                      |
| Archivos con huella (`main-XXXXXXXX.js`)              | Caché de 1 año (`immutable`)                                                           |
| Cualquier otra ruta (`/puentes/123`, `/actuator/...`) | `index.html`, porque son rutas de la SPA. El actuator del backend no queda expuesto    |
| Cuerpo de más de 25 MB                                | `413`                                                                                  |

Además:

- JS, CSS, JSON y SVG viajan comprimidos con gzip.
- nginx resuelve `backend` en cada petición: arranca aunque el backend no exista todavía y no pierde la conexión cuando el backend se redespliega.

## PWA

- El service worker solo se registra en el build de producción y en un contexto seguro (HTTPS o `localhost`). Mientras dev, stage y prod sigan en HTTP, ahí no se instala.
- `ngsw-config.json` precarga todo el JS y CSS para que la app arranque sin red.
- Las navegaciones a `/api/**` van al backend, no a la SPA: así se pueden abrir un PDF o `/api/docs` en una pestaña. Los datos de inspección, fotos y sincronización los maneja `offline/`, no el service worker (DT-OFF-02).
- Para probarla en local: `docker build -t pf-puentes-frontend:pwa . && docker run --rm -p 8090:8080 pf-puentes-frontend:pwa` y abre http://localhost:8090 (DevTools → Application).
- Los íconos de `public/icons/` son los de Angular. Para cambiarlos, se reemplazan los PNG con el mismo nombre.

## Problemas conocidos

**npm falla en WSL con `ERR_SSL_CIPHER_OPERATION_FAILED`**

En algunas instalaciones, la red de WSL corrompe las descargas HTTPS grandes. Dentro de Docker no pasa. Instala desde un contenedor con tu usuario:

```bash
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD":/app -w /app -e HOME=/tmp \
  node:24.21.0-trixie-slim npm install <paquete>
```

Para `ng add`, cambia el último comando por `npx ng add <paquete> --skip-confirmation`.

## Tecnologías y versiones

**Runtime y framework**

| Tecnología                                                        | Versión |
| ----------------------------------------------------------------- | ------- |
| Node.js                                                           | 24.21.0 |
| npm                                                               | 11.19.0 |
| Angular (core, common, compiler, forms, platform-browser, router) | 22.2.1  |
| @angular/service-worker                                           | 22.2.1  |
| Angular CLI / @angular/build                                      | 22.2.1  |
| TypeScript                                                        | 6.0.3   |
| RxJS                                                              | 7.8.2   |
| tslib                                                             | 2.8.1   |
| Tailwind CSS (+ @tailwindcss/postcss)                             | 4.3.3   |
| PostCSS                                                           | 8.5.28  |

**Pruebas y calidad**

| Herramienta       | Versión  |
| ----------------- | -------- |
| Vitest            | 4.1.11   |
| jsdom             | 28.1.0   |
| Prettier          | 3.9.9    |
| ESLint            | 10.12.0  |
| @eslint/js        | 10.0.1   |
| angular-eslint    | 22.5.0   |
| typescript-eslint | 8.69.0   |
| @types/node       | 20.19.43 |

**Imágenes Docker**

| Imagen                                      | Uso                                             |
| ------------------------------------------- | ----------------------------------------------- |
| `node:24.21.0-alpine`                       | Compilación y desarrollo local                  |
| `nginxinc/nginx-unprivileged:1.30.5-alpine` | Runtime: sirve la SPA y hace de proxy de `/api` |

**GitHub Actions**

| Action                       | Versión |
| ---------------------------- | ------- |
| `actions/checkout`           | v7.0.1  |
| `actions/setup-node`         | v7.0.0  |
| `docker/login-action`        | v4.6.0  |
| `docker/setup-buildx-action` | v4.4.1  |
| `docker/build-push-action`   | v7.4.0  |
