# 0040 — Captura local y sincronización productiva

- Estado: implementado; validación integrada delegada al recorrido aislado.
- Fecha: 28/10/2026
- Trazabilidad: RN-INS-06/09/10/12, RN-ARC-01, DT-OFF-05/10, DT-FE-10.
- Complementa [0033](0033-transporte-http-de-la-cola-offline.md) y
  [0024](0024-acceso-local-sesion-offline.md).

## Decisión

La captura sin conexión vive en `offline/`, no en un `offlineInterceptor`.
Es una desviación explícita de DT-FE-10, punto 3: se encolan operaciones de
dominio y snapshots, **nunca peticiones con tokens**. `PersistenciaOffline`
guarda respuestas/metadatos, fotos, PDF e intención de envío junto con su
operación en una transacción IndexedDB. No se eliminan pendientes al salir,
cerrar sesión, perder la red ni recibir un rechazo.

`/offline/local` permite iniciar desde una preparación completa de estudiante;
`/offline/captura/:id` revalida el propietario habilitado sin exigir sesión
remota mientras no hay conexión. Usa la versión exacta del esquema guardado,
`MotorFormularioComponent`, `CapturaFoto` y las funciones de P5. Los permanentes
históricos se filtran; los daños no se heredan. La identificación de inventario
preparado completa los campos SIECA de solo lectura incluso sin publicación.
El resto del editor queda bloqueado hasta la confirmación local.

Se conserva día de Guatemala, asignación, curso y GPS del inicio. La distancia
haversine mayor de 500 m produce un aviso, no un bloqueo; sin coordenadas del
puente no se calcula distancia y sin permiso GPS se continúa explícitamente.
No se envía `grupos_sin_danos`: el motor ya escribe los ceros y un daño posterior
no debe convertir esa marca histórica en un rechazo terminal.

Las ediciones se guardan tras 350 ms y al navegar mediante `canDeactivate`;
un error de escritura bloquea la salida y queda visible. El cierre normal
del navegador avisa si todavía hay trabajo no guardado. Las objectURL se
reutilizan por archivo y se revocan al ocultar el propietario o destruir la vista.
El envío requiere permanentes confirmados, formulario válido y cuatro fotos;
la validación definitiva sigue siendo del servidor. Una intención encolada
deja el editor en lectura para no perder ediciones mientras se envía.

`proveedores-sync.ts` compone `MotorSync`, `SesionOffline` y `TransporteHttp`;
un initializer independiente lo inicia y `DestroyRef` lo detiene. Antes del
lease y de renovar sesión se usa el mismo predicado de operación reclamable
que al reclamar: pendiente, vencida y con todas las dependencias confirmadas.
Una cola vacía, con backoff futuro o con dependencias bloqueadas no renueva.
El intervalo no borra pausas; `online` y un login explícito las reanudan.
La cancelación aborta HTTP y libera únicamente el lease de su token; las
operaciones vuelven a pendiente con sus claves intactas.

Después del PUT, si el snapshot confirma permanentes y la respuesta aún no los
declara confirmados, el transporte hace POST de `{datos: permanentes}` a
`confirmacion-datos-permanentes`, con `${clave}:permanentes`. Con claves UUID
v7 mide 48 caracteres. Se conserva el resultado del POST como ACK para usar su
versión nueva. Al perder una respuesta se repiten cuerpo y claves; no se
regenera ninguna clave. Las subidas se deduplican por el UUID local del archivo.

## Verificación y límites

Las pruebas unitarias cubren autorización, guardado/rollback, permanentes,
cuatro fotos, PDF, estados, objectURL, cola vacía/bloqueada, pausa y reintentos
de confirmación. `playwright.offline.config.ts` usa un worker, sin paralelo,
sin trazas con credenciales, y el servidor P8 contra el backend temporal.
El recorrido degrada la red, corta una foto antes del servidor y pierde
respuestas después de procesar confirmación y foto; espera cero pendientes.

Ejecutar desde el backend: `./mvnw -Dtest=RecorridoOfflineNavegador test`.
El arnés aporta `P8_BACKEND_URL`, ambas banderas de aislamiento y las variables
`OFFLINE_CORREO`, `OFFLINE_CLAVE`, `OFFLINE_PUENTE`. No se ha ejecutado build,
tests ni Docker durante esta implementación; esos resultados deben registrarse
por separado, no se presuponen verdes.

La prueba real bloquea service workers para probar IndexedDB/HTTP sin caché de
API. No acredita por sí sola el arranque en frío de un navegador sin shell
precargado; producción conserva el precache del SW. Tampoco puede garantizarse
la última pulsación si el proceso del navegador se mata antes del autoguardado.
