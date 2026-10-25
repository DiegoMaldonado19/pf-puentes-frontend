# pf-puentes-frontend

### Cancelar órdenes programadas desde el detalle (P8, 25/10/2026)

En `/puentes/:id/mantenimiento`, al seleccionar una orden en estado `PROGRAMADA` con cuenta activa de Catedrático o Administrador, el detalle ofrece el formulario de cancelación con motivo obligatorio (`<app-decision-con-motivo-orden operacion="cancelacion">`), consumiendo `POST /api/v1/puentes/{puenteId}/ordenes-mantenimiento/{ordenId}/cancelacion`. Mientras se envía, bloquea navegación y demás acciones de la orden; al confirmar `CANCELADA`, actualiza fila/detalle, recarga el seguimiento rutinario anual y mantiene la orden y sus evidencias previas consultables en modo solo lectura. [ADR frontend 0029](docs/adr/0029-cancelacion-con-motivo-desde-el-detalle.md) y [ADR backend 0042](../pf-puentes-backend/docs/adr/0042-cancelacion-auditada-de-ordenes-programadas.md).

### Guardar juegos nuevos de pesos (P8, 25/10/2026)

Como Administrador: `/admin/pesos` → **Consultar campos de daño del formulario** → elegir versión → **Configurar nuevo juego de pesos**. Introduce un peso para cada referencia y, si corresponde, la referencia de acta; **Guardar juego nuevo** crea una configuración completa, actualiza las consultas y conserva las anteriores. Los pesos empiezan vacíos; no se sugieren valores de calibración. Sin acta, el juego es provisional; escribir una referencia no verifica firma/calibración.

Se bloquean doble envío, cambios de versión/cierre y salida durante el POST. Si se pierde la respuesta, consulta los juegos guardados antes de abrir otra configuración: no se reenvía automáticamente. La política aceptada por el responsable P8 está en el [ADR backend 0040](../pf-puentes-backend/docs/adr/0040-creacion-completa-y-versionada-de-pesos.md), dentro del repositorio compartido. [ADR frontend 0028](docs/adr/0028-creacion-de-juegos-completos-de-pesos.md). Guardado disponible; calibración y selección al publicar con P5 siguen pendientes.

Verificación de creación: **595 pruebas aprobadas**, 27 nuevas; ESLint, Prettier y TypeScript estricto aprobados. La repetición aislada pasó tras timeouts de una corrida concurrente, sin modificar suites ajenas ni aumentar sus tiempos de espera.

Build de producción y **siete escenarios Playwright aprobados** contra backend/BD/MinIO reales en entorno aislado. El caso nuevo guarda dos juegos completos de 19 campos, consulta tras recargar y verifica conservación del primero; el ejecutor backend confirma en SQL históricos, esquema, inspecciones y auditoría. Los pesos del recorrido son de prueba, no calibrados.

### Campos reales del formulario para pesos (P8, 24/10/2026)

Como Administrador, abre `/admin/pesos` y pulsa **Consultar campos de daño del formulario**. Elige una versión por código/estado desde el listado real P4; también aparecen versiones sin pesos. El panel muestra las referencias canónicas validadas por backend, con paginación, carga/vacío/error y reintento. Cambiar de versión/página, perder sesión u ocultar el panel cancela las lecturas correspondientes. No modifica configuraciones; el guardado espera las decisiones que el usuario consultará con el grupo. [ADR 0027](docs/adr/0027-campos-reales-del-formulario-en-pesos.md).

Verificación 25/10/2026: **568 pruebas aprobadas**, 15 nuevas; ESLint, Prettier y TypeScript estricto aprobados. Una corrida concurrente tuvo tres timeouts y un error de TestBed en otras suites; repetición aislada aprobada sin cambiar esas pruebas ni ampliar sus tiempos.

Build de producción y **seis escenarios Playwright aprobados** contra backend/BD/MinIO reales en entorno aislado. El caso nuevo muestra las 19 referencias de la semilla P4 sin pesos configurados; los cinco anteriores de pesos/mantenimiento/permisos siguen aprobados. [Guía reproducible](../pf-puentes-backend/docs/prueba-navegador-p8.md).

### Verificación P8 tras recibir P4 y sesión offline (24/10/2026)

553 pruebas frontend aprobadas; Prettier, ESLint, TypeScript estricto y build de producción aprobados. El nuevo adaptador P4 → P8 se implementa en backend y no requiere otra pantalla. Se renumeró el ADR propio de acceso a mantenimiento de 0024 a 0026 para conservar el ADR 0024 de sesión offline P2. Creación de pesos y cálculo/publicación con respuestas reales siguen pendientes.

Regresión P8 en Chrome aprobada después del merge: cinco escenarios contra backend, PostgreSQL/PostGIS y MinIO reales en contenedores aislados; pesos, mantenimiento con foto/cierre/descarte y permisos existentes. Se reutiliza el recorrido documentado abajo, sin simular respuestas ni publicar inspecciones.

### Recorrido real de P8 (23/10/2026)

`playwright.p8.config.ts` y `e2e/p8/` verifican aplicación de producción con login, API y almacenamiento reales, contra el backend temporal iniciado por `RecorridoP8Navegador`. Se ejecuta desde el repositorio backend, no contra `localhost:8080` del desarrollador. [Guía del equipo](../pf-puentes-backend/docs/prueba-navegador-p8.md).

**Cinco escenarios aprobados:** consulta de pesos, ciclo de mantenimiento con foto real en MinIO y motivo persistido, y permisos de Catedrático/Estudiante/Profesional. Informe en `playwright-report/p8/index.html`; sin trazas de red para no guardar tokens. El harness offline y su configuración no cambian. Las listas/órdenes del recorrido son fixtures aislados, no generación automática de P4/P5.

### Consulta de pesos integrada (P8, 23/10/2026)

Inicia sesión como Administrador y pulsa **Pesos del índice de condición** o abre `/admin/pesos`. La ruta diferida usa la guardia administrativa e interceptores de P2. El nuevo catálogo P8 permite elegir por código una versión con juegos guardados; después seleccionar un juego para ver elementos/pesos con acta y vigencia. Catálogo, juegos y elementos se paginan; cambios de contexto cancelan lecturas y pérdida de sesión retira datos privados.

Si no hay configuraciones guardadas, la pantalla lo indica: no se crean datos ficticios. La consulta no modifica pesos ni acredita calibración; la creación HTTP sigue pendiente. Las referencias P4 ya se extraen en backend desde el 24/10. Pesos y mantenimiento ya tienen acceso con P2. [ADR 0025](docs/adr/0025-consulta-administrativa-de-pesos-con-sesion.md). Las notas anteriores sobre su ruta pendiente quedan superadas por este incremento.

Verificación local: **495 pruebas frontend aprobadas**, 16 escenarios nuevos; Prettier, ESLint, TypeScript estricto y build de producción aprobados. Paquete inicial **98.68 kB comprimidos**; acceso a pesos diferido ~3.84 kB. AuthService/interceptor/guardia reales y respuestas HTTP controladas; no acredita navegador con backend real ni CI remoto. Backend: nuevo GET y controles aprobados según su README.

### Acceso real a mantenimiento (P8, 23/10/2026)

El pull `704ddae` entregó la sesión/interceptores/guardias de P2. Ahora `/puentes/:id/mantenimiento` conecta esos contratos con las consultas y acciones existentes de P8. Inicia sesión como Catedrático/Admin, abre una ficha desde `/puentes` y pulsa **Gestionar mantenimiento**. La ruta carga de forma diferida y usa la guardia P2; el backend vuelve a autorizar cada operación.

La pantalla carga el puente real, historial/detalle y seguimiento anual; otra vista ofrece propuestas y aceptación. Programación, inicio, evidencia/cierre, descarte y prioridad conservan sus reglas/estados. Cambiar de vista relee datos; durante una escritura se bloquean el cambio y la salida. Perder acceso retira datos privados. Sin órdenes existentes, las listas vacías son correctas: no se generan datos de demostración. [ADR 0026](docs/adr/0026-acceso-protegido-al-mantenimiento-por-puente.md).

La integración de acceso a mantenimiento ya no espera a P2. Pesos aún necesita su ruta administrativa; P4/P5 y la presentación de avisos P9 siguen pendientes. Las secciones anteriores a este incremento conservan evidencia de piezas que entonces estaban aisladas; sus menciones a esperar P2 quedan superadas para mantenimiento.

Verificación local: **479 pruebas frontend aprobadas**, 19 escenarios nuevos; Prettier, ESLint, compilación TypeScript estricta y build de producción aprobados. Paquete inicial: **98.50 kB comprimidos**; mantenimiento diferido: ~13.61 kB. Pruebas DOM/HTTP con sesión/interceptor/guardia reales y respuestas controladas; no acredita navegador con backend real ni CI remoto. Backend sin cambios.

### Seguimiento rutinario anual (P8, 21/10/2026)

`SeguimientoRutinario` consume el GET real y presenta referencia/límite, conteos globales y página de órdenes abiertas. `ConsultaOrdenes` lo incorpora mediante `[mostrarSeguimientoRutinario]="true"`, como opción del host que usa su permiso Catedrático/Admin. Seleccionar abre el detalle real; guardar fecha, iniciar o cerrar recarga el resumen, conservando permisos/estados existentes.

La programación no acredita ejecución ni una fecha pasada implica incumplimiento anual automático. Los indicadores de pasada y posterior al límite pueden coincidir; la UI lo explica. Fechas civiles, paginación, bloqueos y errores respetan el contrato. No se crean propuestas/jobs ni se habilita ruta pública. Acceso P2 y conexión privada P3 integrados en la ruta de mantenimiento (ADR 0026). [ADR 0023](docs/adr/0023-seguimiento-rutinario-anual.md).

Verificación: **387 unitarios aprobados**, 21 nuevos entre panel/cliente/host. Pasan lint, Prettier, compilación estricta y build (~90.73 kB iniciales, MapLibre diferido). No acredita CI remoto ni recorrido autenticado completo.

SPA en Angular del Sistema de Gestión de Puentes (SGP). No usa SSR: en dev, stage y prod la sirve nginx ([ADR 0001](docs/adr/0001-spa-sin-ssr-servida-por-nginx.md)).

## Estado (21/10/2026)

| Parte                     | Qué hay                                                                                                                                                                                                                                                                                                                                                                                    | Responsable      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| `shared/captura-foto/`    | `<app-captura-foto>`: comprime la foto, genera la miniatura y registra ubicación y hora (contrato 9)                                                                                                                                                                                                                                                                                       | P1               |
| `shared/estado-puente/`   | `<app-estado-puente>`: Bueno/Regular/Malo/Sin evaluar con texto y color; integrado en listado/ficha de P3; falta publicación real P5 ([ADR 0011](docs/adr/0011-componente-compartido-de-estado-del-puente.md))                                                                                                                                                                             | P8               |
| PWA                       | Manifiesto, íconos de Angular y service worker; la lógica offline es de `offline/`                                                                                                                                                                                                                                                                                                         | P1 (base) y P6   |
| Infraestructura           | nginx con TLS en los tres entornos, encabezados de seguridad y URL firmadas en `/archivos/`                                                                                                                                                                                                                                                                                                | P1               |
| `offline/`                | Base de persistencia y cola con harness de prueba ([documentación](docs/base-offline.md))                                                                                                                                                                                                                                                                                                  | P6               |
| `features/admin/pesos/`   | Cliente HTTP y vista de consulta de juegos/pesos, con paginación; ruta /admin/pesos y sesión P2 conectadas ([ADR 0012](docs/adr/0012-cliente-http-de-consulta-de-pesos.md), [ADR 0013](docs/adr/0013-vista-de-consulta-de-pesos.md))                                                                                                                                                       | P8               |
| `features/mantenimiento/` | Cliente HTTP, componente de revisión/aceptación contra el POST real y bandeja controlada por página/selección; contenedores HTTP de propuestas e historial/detalle con inicio de ejecución opcional; sesión y ruta protegida conectadas (ADR 0024) ([ADR 0014](docs/adr/0014-aceptacion-de-propuestas-de-mantenimiento.md), [ADR 0015](docs/adr/0015-bandeja-controlada-de-propuestas.md)) | P8               |
| `core/`, rutas            | Inventario P3 y autenticación P2 disponibles; mantenimiento P8 conectado mediante ruta protegida por puente                                                                                                                                                                                                                                                                                | Cada responsable |

### Integración de la aceptación de propuestas (P8)

`<app-aceptacion-propuesta>` recibe `orden: OrdenMantenimientoDTO` y `puedeAceptar: boolean`, ambos obligatorios. El contenedor deriva el permiso de la sesión de P2 (cuenta activa Catedrático/Admin), entrega una orden real y maneja:

- `aceptada`: DTO devuelto por el servidor para actualizar la fila/detalle.
- `actualizacionRequerida`: `{ puente_id, id }` que debe releerse tras conflictos, resultado incierto o cambio de selección durante el envío. La consulta HTTP de órdenes está implementada y descrita debajo.

La acción usa `MantenimientoService` y el POST real de aceptación, sin cuerpo. Presenta el resumen y conserva fecha/prioridades; no calcula IC, sugiere prioridades ni repite escrituras automáticamente. Cada recarga debe entregar un DTO nuevo; cancelar una petición al salir no revierte una aceptación ya confirmada en servidor.

Aún no aparece en `localhost:4200`: falta su ruta diferida con selección real de puente, sesión, interceptores y guardias de P2. No se añade un acceso público ni datos de demostración a la aplicación. Las pruebas DOM/HTTP permiten verificar la pieza; el recorrido autenticado queda pendiente. Ver [ADR 0014](docs/adr/0014-aceptacion-de-propuestas-de-mantenimiento.md).

### Bandeja de propuestas preparada para integrar (P8)

`<app-bandeja-propuestas>` recibe `puenteId`, `pagina: PaginaPropuestas | null`, `puedeAceptar` y, opcionalmente, `cargando`/`codigoError`. La página corresponde al GET de propuestas habilitado y conserva `puente_id` de origen junto con los campos paginados. El contenedor debe conservar ese puente incluso si la respuesta está vacía y entregar una nueva referencia por respuesta.

`consultaSolicitada` indica qué puente/página/tamaño consultar; `aceptada` devuelve el DTO confirmado. La bandeja reutiliza la aceptación y pide recarga tras éxito/conflicto, vuelve a la página anterior si acepta la última fila y oculta datos obsoletos mientras espera. Bloquea navegación durante una aceptación. Ver [ADR 0015](docs/adr/0015-bandeja-controlada-de-propuestas.md).

La lectura HTTP ya está conectada mediante ConsultaPropuestas para Catedrático/Admin, confirmados por el grupo. Falta el acceso protegido y la sesión de P2 para incorporar la bandeja al inventario público disponible de P3; las secciones siguientes documentan la conexión HTTP actual.

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

### Ajustar prioridad desde el detalle (P8)

`ConsultaOrdenes` añade `[puedeAjustarPrioridad]` (false por defecto) y `(prioridadAjustada)`. El host aporta el permiso real de sesión Catedrático/Admin. La acción se ofrece en PROPUESTA/PROGRAMADA/EN_EJECUCION según decisión del usuario; terminales conservan prioridad. El selector exige valor distinto y justificación, consume PATCH y actualiza fila/detalle solo desde el DTO confirmado. Se conserva sugerida y no se modifica el cálculo/pesos del IC.

El envío se agrega a `operacionPendiente()` para bloquear selección y otras acciones. Acceso denegado retira datos; conflictos/resultados inciertos se reconcilian por GET, sin repetir escrituras. Siguen pendientes acceso P2 y conexión de P8 con el inventario real P3. [ADR 0021](docs/adr/0021-ajuste-manual-de-prioridad-en-el-detalle.md). Verificación actual: 325 unitarios y controles aprobados.

### Programar fecha desde el detalle (P8)

`ConsultaOrdenes` incorpora `ProgramacionOrden` cuando recibe `[puedeProgramar]="permisoDeSesion"` y la orden está PROGRAMADA. El permiso está deshabilitado por defecto; debe proceder de la cuenta activa Catedrático/Admin de P2. El formulario registra o cambia una fecha obligatoria mediante el PATCH real, conserva fecha civil exacta y no impone límites temporales nuevos. Solo confirma y actualiza fila/detalle desde la respuesta compatible; `(fechaProgramada)` permite informar a otros consumidores.

Durante el envío se bloquean selección/recargas y otras acciones de la orden. Errores de validación conservan datos; acceso denegado retira información privada; conflictos/resultados inciertos requieren relectura sin repetir escrituras. API/cliente/formulario listos; aún falta habilitar el recorrido desde la sesión/ruta protegida de P2 y el inventario P3 disponible. Ver [ADR 0022](docs/adr/0022-programacion-de-fecha-desde-el-detalle.md).

Verificación del incremento de programación (21/10/2026): **366 unitarios aprobados**, 41 nuevos entre formulario, cliente y contenedor. Pasan lint, Prettier, compilación estricta de app/pruebas/plantillas y build (~90.36 kB de transferencia inicial; MapLibre diferido). Pruebas DOM/HTTP no equivalen a recorrido autenticado completo ni a CI remoto.
