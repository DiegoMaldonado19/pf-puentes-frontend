# pf-puentes-frontend

SPA en Angular del Sistema de Gestión de Puentes (SGP). No usa SSR: en dev, stage y prod la sirve nginx ([ADR 0001](docs/adr/0001-spa-sin-ssr-servida-por-nginx.md)).

## Estado (20/10/2026)

| Parte                     | Qué hay                                                                                                                                                                                                                                                                                                                                                                         | Responsable      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `shared/captura-foto/`    | `<app-captura-foto>`: comprime la foto, genera la miniatura y registra ubicación y hora (contrato 9)                                                                                                                                                                                                                                                                            | P1               |
| `shared/estado-puente/`   | `<app-estado-puente>`: Bueno/Regular/Malo/Sin evaluar con texto y color; integración con P3 pendiente ([ADR 0011](docs/adr/0011-componente-compartido-de-estado-del-puente.md))                                                                                                                                                                                                 | P8               |
| PWA                       | Manifiesto, íconos de Angular y service worker; la lógica offline es de `offline/`                                                                                                                                                                                                                                                                                              | P1 (base) y P6   |
| Infraestructura           | nginx con TLS en los tres entornos, encabezados de seguridad y URL firmadas en `/archivos/`                                                                                                                                                                                                                                                                                     | P1               |
| `offline/`                | Base de persistencia y cola con harness de prueba ([documentación](docs/base-offline.md))                                                                                                                                                                                                                                                                                       | P6               |
| `features/admin/pesos/`   | Cliente HTTP y vista de consulta de juegos/pesos, con paginación; ruta y sesión P2 pendientes ([ADR 0012](docs/adr/0012-cliente-http-de-consulta-de-pesos.md), [ADR 0013](docs/adr/0013-vista-de-consulta-de-pesos.md))                                                                                                                                                         | P8               |
| `features/mantenimiento/` | Cliente HTTP, componente de revisión/aceptación contra el POST real y bandeja controlada por página/selección; contenedores HTTP de propuestas e historial/detalle con inicio de ejecución opcional; sesión y ruta protegida pendientes ([ADR 0014](docs/adr/0014-aceptacion-de-propuestas-de-mantenimiento.md), [ADR 0015](docs/adr/0015-bandeja-controlada-de-propuestas.md)) | P8               |
| `core/`, rutas            | `core/` aún no existe; rutas vacías y `app.html` sigue siendo el de Angular                                                                                                                                                                                                                                                                                                     | Cada responsable |

### Integración de la aceptación de propuestas (P8)

`<app-aceptacion-propuesta>` recibe `orden: OrdenMantenimientoDTO` y `puedeAceptar: boolean`, ambos obligatorios. El contenedor deriva el permiso de la sesión de P2 (cuenta activa Catedrático/Admin), entrega una orden real y maneja:

- `aceptada`: DTO devuelto por el servidor para actualizar la fila/detalle.
- `actualizacionRequerida`: `{ puente_id, id }` que debe releerse tras conflictos, resultado incierto o cambio de selección durante el envío. La consulta HTTP de órdenes sigue pendiente; no se inventa su URL en el cliente.

La acción usa `MantenimientoService` y el POST real de aceptación, sin cuerpo. Presenta el resumen y conserva fecha/prioridades; no calcula IC, sugiere prioridades ni repite escrituras automáticamente. Cada recarga debe entregar un DTO nuevo; cancelar una petición al salir no revierte una aceptación ya confirmada en servidor.

Aún no aparece en `localhost:4200`: falta su ruta diferida con selección real de puente, sesión, interceptores y guardias de P2. No se añade un acceso público ni datos de demostración a la aplicación. Las pruebas DOM/HTTP permiten verificar la pieza; el recorrido autenticado queda pendiente. Ver [ADR 0014](docs/adr/0014-aceptacion-de-propuestas-de-mantenimiento.md).

### Bandeja de propuestas preparada para integrar (P8)

`<app-bandeja-propuestas>` recibe `puenteId`, `pagina: PaginaPropuestas | null`, `puedeAceptar` y, opcionalmente, `cargando`/`codigoError`. La página corresponde al GET de propuestas habilitado y conserva `puente_id` de origen junto con los campos paginados. El contenedor debe conservar ese puente incluso si la respuesta está vacía y entregar una nueva referencia por respuesta.

`consultaSolicitada` indica qué puente/página/tamaño consultar; `aceptada` devuelve el DTO confirmado. La bandeja reutiliza la aceptación y pide recarga tras éxito/conflicto, vuelve a la página anterior si acepta la última fila y oculta datos obsoletos mientras espera. Bloquea navegación durante una aceptación. Ver [ADR 0015](docs/adr/0015-bandeja-controlada-de-propuestas.md).

La lectura HTTP espera confirmación de lectores por el grupo; no se inventó una URL/proveedor de lectura ni se añadieron datos ficticios. Falta conectar GET, cliente/contenedor y acceso P2 antes de registrar una ruta diferida. Esta pieza aún no aparece en la página inicial de Angular.

## Desarrollo local

Requisitos: Docker con Compose 2.32 o superior. En Windows, Docker Desktop con la integración de WSL activada.

```bash
docker compose -f compose.local.yaml up --watch
```

- Abre http://localhost:4200.
- Al guardar en `src/` o `public/`, el navegador se recarga en un segundo aproximadamente. Si cambias `package.json`, se reconstruye la imagen.
- `/api` se reenvía al backend local (`host.docker.internal:8080`): levanta también el `compose.local.yaml` del backend.
- Para apagar: `docker compose -f compose.local.yaml down`.
- En local no hace falta `.env`: el `.env.example` es solo para la EC2.

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

| Evento             | Entorno | URL                                                    |
| ------------------ | ------- | ------------------------------------------------------ |
| PR hacia `develop` | dev     | `https://pf-puentes.duckdns.org:8082`                  |
| push a `develop`   | stage   | `https://pf-puentes.duckdns.org:8081`                  |
| push a `main`      | prod    | `https://pf-puentes.duckdns.org` (el 80 redirige aquí) |

- **Imagen:** `<DOCKERHUB_USERNAME>/pf-puentes-frontend:<número de build>`, más el tag `:tree-<hash>` que la identifica por contenido.
- **Promoción:** la misma imagen pasa de dev a stage y a prod sin reconstruirse. Prod solo acepta imágenes que pasaron por stage. Esto funciona porque la imagen no lleva la URL de la API compilada adentro.
- **En la EC2:** cada entorno vive en `~/puentes/<entorno>/pf-puentes-frontend` y comparte la red `puentes-<entorno>` con el backend del mismo entorno.
- **Puertos:** cada Environment necesita el secreto `HTTPS_PORT` (dev 8082, stage 8081, prod 443); si falta o está vacío, el deploy se detiene. Prod suma `compose.prod.yaml`, que publica además el 80 solo para redirigir a https.

Las decisiones están en [docs/adr](docs/adr/) y los secretos y variables en el [ADR 0005](docs/adr/0005-configuracion-por-entorno-con-github-environments.md).

### Qué hace nginx

| Petición                                              | Respuesta                                                                              |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `http://...`                                          | `301` a la misma URL con `https://`                                                    |
| `/api/...`                                            | Se reenvía al `backend:8080` del mismo entorno. Tiene prioridad sobre las demás reglas |
| `/archivos/...` (GET)                                 | URL firmada de una foto: se reenvía a MinIO con el mismo `Host` (ADR 0013 del backend) |
| `/index.html` y `/ngsw.json`                          | Sin caché, para que la PWA reciba actualizaciones                                      |
| Archivos con huella (`main-XXXXXXXX.js`)              | Caché de 1 año (`immutable`)                                                           |
| Cualquier otra ruta (`/puentes/123`, `/actuator/...`) | `index.html`, porque son rutas de la SPA. El actuator del backend no queda expuesto    |
| Cuerpo de más de 25 MB                                | `413`                                                                                  |

Además:

- Todas las respuestas llevan HSTS, `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy` ([ADR 0008](docs/adr/0008-tls-con-lets-encrypt-y-encabezados-en-nginx.md)). Si un feature necesita un origen externo (p. ej. los mosaicos del mapa), agrégalo a la CSP en `nginx.conf`.
- JS, CSS, JSON y SVG viajan comprimidos con gzip.
- nginx resuelve `backend` en cada petición: arranca aunque el backend no exista todavía y no pierde la conexión cuando el backend se redespliega.

## PWA

- El service worker solo se registra en el build de producción y en un contexto seguro (HTTPS o `localhost`).
- `ngsw-config.json` precarga todo el JS y CSS para que la app arranque sin red.
- Las navegaciones a `/api/**` van al backend, no a la SPA: así se pueden abrir un PDF o `/api/docs` en una pestaña. Los datos de inspección, fotos y sincronización los maneja `offline/`, no el service worker (DT-OFF-02).
- Para probarla en local: `npx ng build && python3 -m http.server -d dist/pf-puentes-frontend/browser 8090` y abre http://localhost:8090 (DevTools → Application). `localhost` cuenta como contexto seguro.
- Los íconos de `public/icons/` son los de Angular. Para cambiarlos, se reemplazan los PNG con el mismo nombre.

### TLS

Un solo certificado de Let's Encrypt para `pf-puentes.duckdns.org` sirve a los tres entornos: cada nginx atiende https en su puerto ([ADR 0008](docs/adr/0008-tls-con-lets-encrypt-y-encabezados-en-nginx.md)). Vive en `~/puentes/tls` de la EC2 y lo emite y renueva `scripts/certificado-tls.sh` (lego, validación por DNS de DuckDNS).

Primera vez, en la EC2:

```bash
install -m 600 /dev/null ~/puentes/duckdns.env   # DUCKDNS_TOKEN=<token de duckdns.org> y CORREO_TLS=<correo>
sudo install -d -o 101 -g 101 ~/puentes/tls      # 101 = usuario de nginx-unprivileged
sh scripts/certificado-tls.sh                    # desde un clon del repo
```

Renovación diaria (`crontab -e`); lego solo renueva cuando faltan 30 días:

```
0 4 * * * $HOME/puentes/prod/pf-puentes-frontend/scripts/certificado-tls.sh >> $HOME/puentes/tls-renovacion.log 2>&1
```

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

| Imagen                                      | Uso                                                                          |
| ------------------------------------------- | ---------------------------------------------------------------------------- |
| `node:24.21.0-alpine`                       | Compilación y desarrollo local                                               |
| `nginxinc/nginx-unprivileged:1.30.5-alpine` | Runtime: sirve la SPA y hace de proxy de `/api` y `/archivos`                |
| `goacme/lego:v4.35.2`                       | Emite y renueva el certificado TLS en el host (`scripts/certificado-tls.sh`) |

**GitHub Actions**

| Action                       | Versión |
| ---------------------------- | ------- |
| `actions/checkout`           | v7.0.1  |
| `actions/setup-node`         | v7.0.0  |
| `docker/login-action`        | v4.6.0  |
| `docker/setup-buildx-action` | v4.4.1  |
| `docker/build-push-action`   | v7.4.0  |

### Contenedor conectado a la API (P8)

`<app-consulta-propuestas [puenteId]="idReal" [puedeConsultar]="permisoLectura" [puedeAceptar]="permisoAceptacion" (aceptada)="actualizarResumen($event)" />` carga la bandeja mediante el GET real, pagina y recarga tras aceptar. El host de P2 debe proporcionar los permisos de la sesión (lectura y aceptación: Catedrático/Admin), el ID real seleccionado y los interceptores globales. Backend verifica los roles; estos inputs no conceden acceso por sí solos. Cambiar de puente o perder permiso cancela la lectura y retira datos. No hay ruta pública, sesión paralela ni datos ficticios en producción. Ver [ADR 0016](docs/adr/0016-conexion-http-de-la-bandeja-de-propuestas.md).

### Historial y detalle de órdenes (P8)

`<app-consulta-ordenes [puenteId]="idReal" [puedeConsultar]="permisoLectura" />` carga el historial paginado desde la API y consulta el detalle real al seleccionar una orden. Conserva todos los estados, prioridades, origen, fechas y motivos. Por defecto funciona en modo consulta. Puede habilitar inicio de ejecución mediante el permiso explícito descrito debajo. El permiso debe proceder de P2 (lectores confirmados: Catedrático/Admin); el servidor lo comprueba.

Cancela lecturas al cambiar de contexto y retira listado/detalle ante errores de acceso. Sigue pendiente abrirla mediante sesión/interceptores/guardias, ruta diferida y selección real del puente. No aparece todavía desde la página inicial ni agrega datos ficticios en producción. Ver [ADR 0017](docs/adr/0017-consulta-http-del-historial-de-ordenes.md).

### Iniciar ejecución desde el detalle (P8)

`<app-consulta-ordenes [puenteId]="idReal" [puedeConsultar]="permisoLectura" [puedeIniciar]="permisoInicio" (iniciada)="actualizarResumen($event)" />` ofrece iniciar solo en PROGRAMADA. `permisoInicio` debe derivarse de la sesión de P2 (Catedrático/Admin confirmado); por defecto es false. Backend valida autorización y estado en cada POST. El host puede consultar `inicioPendiente()` para bloquear también su selector externo de puente.

La respuesta confirmada actualiza fila/detalle. Durante el envío se bloquean acciones locales/doble clic; conflictos o resultados inciertos fuerzan relectura, sin repetir escrituras automáticamente. El componente conserva textos en español y controles accesibles. Siguen pendientes sesión/interceptores/guardias y ruta/selección de puente reales; no aparece aún desde la página inicial. Ver [ADR 0018](docs/adr/0018-inicio-de-ejecucion-desde-el-detalle.md). Verificación: 158 unitarios y controles aprobados.

### Evidencia y cierre desde el detalle (P8)

`ConsultaOrdenes` integra captura P1, carga multipart real, galería paginada y formulario de fecha/responsable para cerrar EN_EJECUCION. El host habilita `[puedeConsultarEvidencia]`, `[puedeSubirEvidencia]` y `[puedeCerrar]` desde la sesión (Catedrático/Admin confirmados); por defecto son false. La carga admite PROGRAMADA/EN_EJECUCION; después del cierre se conserva consulta. Elegir una foto no basta: debe guardarse y el servidor cuenta las fotos de esa orden.

`(cerrada)` entrega el DTO confirmado, que también actualiza fila/detalle. `operacionPendiente()` incluye inicio/carga/cierre para bloquear el selector externo de puente. Errores de acceso retiran también historial/detalle; resultados inciertos se reconcilian sin repetir POST automáticamente. Las URL firmadas se renuevan consultando las fotos. No se añaden sesión ni rutas públicas; sigue pendiente la integración protegida con P2 y el puente real de P3. [ADR 0019](docs/adr/0019-evidencia-y-cierre-desde-el-detalle.md). Verificación actual: 186 unitarios y controles aprobados.

### Descartar propuestas desde el historial (P8)

`ConsultaOrdenes` añade `[puedeDescartar]` (false por defecto) y `(descartada)`. Con permiso real Catedrático/Admin, una PROPUESTA ofrece formulario de motivo y confirmación; consume el POST `/descarte`. Solo el DTO confirmado actualiza fila y detalle; la orden permanece en el historial. El envío se incluye en `operacionPendiente()` para bloquear navegación local/otras operaciones. Los rechazos de acceso retiran datos y los resultados inciertos fuerzan relectura sin repetir POST. [ADR 0020](docs/adr/0020-descarte-de-propuestas-desde-el-detalle.md).

Tras el merge de P3 ya existen `/puentes`, mapa y ficha pública con el componente de estado de P8. Mantenimiento todavía requiere conectarse a ese inventario y a la sesión/interceptores/guardias P2; el puerto `ROL_PUENTES` vale null por defecto. Verificación actual: 280 unitarios y controles aprobados, incluidos los de P3 recibidos.
