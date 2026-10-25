# Base offline autónoma — P6, grupo 1

## Ejecutar la demo

Desde este repositorio, con Node 24.21.0 y npm 11.19.0:

```sh
npm ci
npm run build:base-offline
node scripts/serve-base-offline.mjs
```

Abrir <http://localhost:8090/offline/demo>. El servidor es estático con fallback
para esa ruta; no requiere API. La ruta se habilita únicamente mediante la
sustitución de rutas del build `base-offline`. `npm run build` no la incluye.

### Recorrido reproducible

1. Esperar el registro del SW y su precarga. En DevTools → Application →
   Service Workers, comprobar activación; una petición a `/index.html` atendida
   por el SW espera la precarga completa. `navigator.serviceWorker.ready` por
   sí solo no acredita que todos los recursos estén almacenados.
2. Elegir «Fallo transitorio» y crear una inspección ficticia. Editar el JSON y
   guardar. Solo «Guardado local confirmado» acredita que terminó la transacción.
3. Desconectar, elegir cuatro fotos y un PDF. Comprobar los anclajes, los
   contadores y el mensaje de cuota/persistencia. Las fotos pasan por el
   componente de P1; esta base almacena sus blobs sin comprimirlos de nuevo.
4. Cerrar y reabrir la pestaña sin red: respuestas, versión, fotos y PDF siguen
   disponibles. Reconectar y observar reintentos; tras cinco fallos queda
   `requiere_intervencion`. Seleccionar «Confirmación simulada» y reintentar.
5. Registrar intención de envío: datos → archivos uno por uno → envío. Un
   rechazo de negocio bloquea los dependientes, pero otra inspección avanza.
6. Cambiar al propietario B: no muestra ni procesa los registros de A. Volver
   a A permite recuperar su captura. Los resultados simulados están rotulados
   y se limitan a `puentes-offline-demo`.

El parámetro `?automatico=0` desactiva arranque/eventos/polling del simulador
para pruebas deterministas; el botón manual sigue operativo. Sin ese parámetro
se ejecuta al arrancar, al volver online y cuando vence el backoff.

**Demostración realizada:** B02 reproduce los controles de captura/guardado y
reapertura en Chromium real; B06 reproduce diagnóstico y reintento. Se conserva
captura de pantalla, estado y trazas. Esta evidencia es una interacción UI
automatizada, no una revisión humana manual. El recorrido humano anterior
queda pendiente de ejecución y registro por el equipo.

## API local e integración posterior

- `BaseLocal`: base `puentes-offline` por defecto; versión 1 con seis almacenes
  de dominio, versión 2 añade `bloqueos`, versión 3 añade `acceso_local` y
  versión 4 añade snapshots completos `preparaciones`, sin borrar capturas. Cada registro
  declara `modelo_version`. Referencia usa clave compuesta propietario/id.
- `PersistenciaOffline`: `crear`, `editar`, `foto`, `documento`, `enviar`,
  `inspeccion`, `operaciones` y `guardarReferencias`. Todas reciben propietario
  explícito. Las mutaciones validan UUID y pertenencia y guardan registro/cola
  en la misma transacción. Cada edición/archivo incrementa `version_local`;
  nunca modifica una operación ya encolada. Una nueva intención pertenece a
  esa versión. Los esquemas con id existente no se sobrescriben.
- Respuestas y metadatos son JSON opaco ligado a `formulario_version_id`;
  no se impone un formulario de P4. P5 podrá proporcionar creación/GPS/autor/
  dispositivo en `metadatos`. No se renombran propiedades JSON.
- `TransporteSync.ejecutar`: recibe snapshot, archivo local cuando corresponde
  y `AbortSignal`. Devuelve ACK (propietario/id/versión/JSON), error transitorio,
  negocio o sesión. El resultado del ACK queda durable en la operación.
  El adaptador debe respetar cancelación e idempotencia; el núcleo ignora ACK
  con versión/identidad incompatible o token de ejecución vencido.
- `SesionOffline`: UUID actual y `preparar` antes de drenar; no almacena tokens.
  `ReferenciaOffline` delimita lecturas de referencia sin asumir endpoints.
- `MotorSync`: `iniciar`, `detener`, `drenar`, `reintentar`; `pausa` es signal.
  Lease de 15 s, renovación de 3 s. Tras cierre de pestaña se recupera trabajo
  al vencer el lease, con ids/claves/contador anteriores. El reintento manual
  reinicia el ciclo conservando snapshot y clave. Los fallos esperan
  2/4/8/16 s; el quinto requiere intervención. Sin red no consume fallos.
- `IndicadorOffline`: componente standalone independiente para navegación,
  con entrada de operaciones del propietario actual y contadores computed.
- `DiagnosticoOffline`: componente standalone reusable con entradas base,
  propietario y motor opcional. Cuenta entidades distintas, no filas ni intentos.
  Sin motor consulta con `AccesoLocal.consultarPropias` y es de solo lectura; el
  harness G1 recibe el motor simulado explícitamente. La ocupación/cuota corresponde
  al origen completo, no solo a esta base.
- `consultarAlmacenamiento(true)`: solicitar persistencia al entrar en captura;
  resultado/denegación/ausencia visibles. `mensajeEscritura` distingue cuota y
  validaciones. No se purgan pendientes ni blobs automáticamente.

No hay adaptador real por defecto: `new MotorSync(db, sesion)` conserva la
cola pendiente. El simulador se importa solo desde el harness y las pruebas.
Los límites locales son 60 fotos, 10 PDF y 20 MiB por PDF; el contrato de P1
garantiza el formato/dimensiones de `FotoCapturada`. El objetivo de 200–400 KB
no es un rechazo por tamaño de una imagen simple ya comprimida por P1.

### Acceso local G2 — navegación separada y sesión P2

`AccesoLocal(db, auth, sesionRemota)` conserva la última identidad preparada y
las revocaciones por propietario sin credenciales. `habilitarPreparada` requiere
una sesión remota vigente del mismo dueño; su llamador deberá acreditar la
preparación completa. `propietarioActual` e `inspecciones` consultan la política
durable y devuelven únicamente capturas de ese propietario. Un UUID no desbloquea
una revocación: hace falta login online de su dueño, no una renovación.

El arranque instancia el servicio antes de hidratar P2 y después reconcilia
la identidad inicial contra la preparada. Cierre/cambio revocan durablemente;
fallo de red y renovación inválida no equivalen a cierre explícito. Las lecturas
no modifican la habilitación: una pestaña antigua con otra sesión no puede
revocar repetidamente un login legítimo del dueño, ni consultar sus capturas.
`liveQuery` notifica cambios durables y limpia/actualiza la vista; el adaptador
remoto comprueba revocación y cancela ejecuciones del motor existente.

La navegación ofrece **Capturas locales**, ruta diferida `/offline/local`,
independiente de roles y `AuthService.autenticado()`. Solo consulta las capturas
del propietario preparado habilitado; no acepta UUID para desbloquear. Es una
vista consultiva: la edición productiva espera la captura de P5. No crea
capturas, no prepara salidas ni drena operaciones. Sin preparación real previa
no hay capturas habilitadas; no existe un fallback ficticio productivo.

#### Harness de sesión G2

Abrir `/offline/demo?sesion=1` en el build `base-offline`. Usa exclusivamente
`puentes-offline-sesion-demo`; no comparte capturas con producción ni con
`puentes-offline-demo`. El botón **Preparar captura ficticia** exige sesión P2
válida y coordina los tres proveedores ficticios mediante `PreparacionLocal`.
La captura consume puente, contexto de asignación y versión exacta del snapshot
completo; no crea otra captura si la preparación falla. Muestra progreso por
proveedor y un resultado explícitamente ficticio. Los dos contextos de curso se
conservan aunque compartan puente; no tener publicación previa es válido.
La sesión es `AuthService`;
Playwright sustituye sus respuestas HTTP de login/renovación/cierre. Sin ese
HTTP de prueba, el servidor estático no proporciona una sesión ficticia.

Los casos G2 cierran y reabren sin red, editan con `PersistenciaOffline`,
comprueban que no se persisten tokens ni se drena remotamente y prueban cierre,
cambio y recuperación por login del propietario entre pestañas. Las pruebas
unitarias con dos sesiones/instancias de base y `TransporteSimulado` acreditan
cancelación en vuelo: señal abortada, datos/cola conservados y ninguna operación
siguiente enviada. Ejecutar estos casos separados con:

```sh
npm run test:e2e:base -- --grep 'G2'
```

La demo histórica sin `sesion=1` conserva selección libre de propietarios y
simulación B01–B08; no acredita por sí sola la revocación de G2. No hay transporte
real, edición P5 productiva ni aceptación V09 completa. El acceso presupone
control del navegador/perfil y no protege frente al acceso directo a IndexedDB.
Decisión propuesta, sin acuerdo externo de P2: [ADR 0024](adr/0024-acceso-local-sesion-offline.md).

### Diagnóstico local G4 — integración parcial de solo lectura

La navegación de la aplicación muestra los conteos pendientes del propietario
que devuelve `AccesoLocal.propietarioActual()`. `EstadoLocal` consulta la cola a
través de `AccesoLocal.consultarPropias`, vuelve a validar las emisiones vivas y
vacía la vista al invalidar o cambiar esa identidad; nunca toma un UUID de la UI
ni lee la cola de otro propietario. `/offline/local` conserva la ruta G2 y
compone las capturas autorizadas con `DiagnosticoOffline` para ese mismo dueño.
El indicador cuenta inspecciones y archivos distintos pendientes, no filas ni
intentos. El diagnóstico muestra estados, errores, dependencias, último intento
y uso/cuota del origen, con estados y errores como texto accesible (no solo
color). El estado de almacenamiento sigue visible incluso sin dueño habilitado;
en ese caso no consulta la cola.

La ruta productiva omite la entrada `MotorSync`: no muestra acciones de reintento
ni conecta el simulador o un transporte HTTP. Las operaciones no confirmadas,
capturas, fotos y PDF permanecen en IndexedDB; cerrar sesión o cambiar de cuenta
solo oculta el acceso y no las purga. Se explicitan la falta de edición P5,
Preparar salida productivo, transporte/reintento productivos, los acuerdos de
conflictos/permisos y la política de caché privada pendiente de G11. La demo G1
sigue pasando su motor simulado de forma explícita y mantiene sus acciones de
prueba.

Verificación G4 y escenarios observados: [validacion-diagnostico-g4.md](validacion-diagnostico-g4.md).

### Adaptadores pendientes (grupos 2..7)

P2: coordinación externa del acceso local y futuro interceptor offline/replay;
la adaptación de sesión y renovación usa ya `AuthService`.
P3/P7: consumidores disponibles; ver [referencia-offline.md](referencia-offline.md).
G3: coordinación durable disponible; ver [preparacion-local.md](preparacion-local.md).
P4/P5: faltan proveedores productivos de esquema activo y última publicación;
P4: validación offline del formulario. P5: borrador, revisión base y transición editable/envío.
P1: transporte HTTP/multipart con las claves y UUID originales. Los rechazos
de editabilidad conservarán las versiones nuevas locales; esta base no fuerza
una transición remota ni sustituye la máquina de estados de P5. El ACK JSON
versionado permite añadir revisiones sin reconstruir IndexedDB.

## Pruebas y evidencia

```sh
npx prettier --check .
npx ng lint
npm run build
npx ng test --watch=false
npx playwright install --with-deps chromium
npm run test:e2e:base
# Entrada general, actualmente el mismo proyecto autónomo:
npm run test:e2e
```

Playwright inicia build y servidor por sí mismo. No mantener otro servidor en
8090 al ejecutar las pruebas. Contextos independientes aíslan cada escenario.
Vitest/fake-indexeddb verifica lógica; los blobs de jsdom no sirven para
acreditar integridad, por eso las pruebas reales comparan hashes SHA-256,
dimensiones, metadatos y reapertura en Chromium.

Resultados: [validación de la base](validacion-base-offline.md).
Reportes: `playwright-report/base-offline/index.html`; trazas y snapshots:
`test-results/base-offline/`. Se generan localmente (ignorados por Git) y CI
los conserva como artifact `base-offline-evidencia`. Cada escenario adjunta
estado inicial/final; B02 añade hashes antes/después y screenshot sin red.

ADR: [0009](adr/0009-persistencia-y-cola-offline.md) y
[0010](adr/0010-playwright-y-harness-offline.md).
