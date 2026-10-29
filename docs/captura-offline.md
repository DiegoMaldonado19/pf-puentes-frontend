# Captura offline productiva

La aplicación registra el motor real en `app.config.ts`; no es necesario
activar la demo. Con sesión de estudiante, catedrático o profesional externo
habilitado por el backend, entrar en `/offline/local`, preparar la salida e
iniciar una inspección. Estudiantes usan sus asignaciones; los demás descargan
las páginas reales de `GET /api/v1/puentes-inspeccionables`, sin fabricar
asignaciones. La verificación profesional debe ser autorizada por el backend:
el token actual solo informa id, nombre y rol, no acredita colegiado.
La preparación conserva
puentes, asignaciones, precarga y la versión exacta de SIECA.

En `/offline/captura/:id`, confirmar permanentes antes del resto; después se
pueden completar daños, guardar fotos generales o ancladas y adjuntar PDF.
El envío se encola al tener formulario válido y cuatro fotos. Guardar no
significa enviar: la intención y los estados pendientes/sincronizada/intervención
son visibles junto con el diagnóstico. Los errores nunca purgan capturas.

El autoguardado espera 350 ms y la navegación espera su transacción; si falla,
corregir el error y guardar antes de salir. No cerrar a la fuerza mientras se
guarda. El almacenamiento depende de cuota y permisos del navegador, visibles
en el diagnóstico. GPS denegado no impide capturar; sin coordenadas preparadas
del puente no existe aviso local de distancia.

Las escrituras de respuestas comparan la versión leída dentro de la misma
transacción IndexedDB. Una pestaña limpia recibe cambios externos; una con
edición pendiente conserva sus respuestas y muestra el conflicto al guardar.
Copiar esos cambios antes de recargar y conciliarlos con la versión guardada;
no se sobrescribe silenciosamente ni se fusionan respuestas incompatibles.

Una foto o PDF rechazado permanentemente ofrece «Retirar … para corregir».
Con el motor sin operación en curso, la retirada elimina únicamente ese archivo
local no confirmado, reconstruye las dependencias y retira el envío aún no
confirmado en una transacción. Después se puede adjuntar el contenido corregido
(nuevo UUID y nueva clave de operación) y volver a encolar envío. No elimina
archivos confirmados ni ejecuta eliminaciones remotas.

Al reconectar, el motor puede recuperar la cookie desde la última habilitación
local no revocada si la identidad remota está vacía. Solo renueva con trabajo
reclamable, valida el propietario devuelto y reintenta fallos transitorios sin
cerrar sesión ni pausar permanentemente. Una identidad remota distinta nunca
sincroniza la cola del propietario anterior.

## Copias obsoletas y diagnóstico

En **Capturas locales**, **Eliminar copia local** permite descartar una copia
obsoleta o liberar una copia confirmada. Antes de aceptar se informa cuántas
operaciones sin confirmar se perderán. Es una acción irreversible y explícita:
no se elimina nada del servidor ni se purgan automáticamente los pendientes.
La captura, sus fotos, PDF y cola se eliminan juntos; preparación y formularios
compartidos permanecen intactos. Si otra pestaña edita o encola trabajo después
de abrir la confirmación, hay que revisar y confirmar de nuevo. Un lease vigente
o una operación en proceso impiden el descarte.

Un `404` de avance no autoriza a recrear una inspección que ya tiene confirmación
remota local. Se conserva como intervención para que el usuario decida qué hacer:
el recurso puede estar eliminado o no ser accesible. Las capturas nuevas sin
confirmación conservan el alta de respaldo. Un `404` o `409` nunca borra la copia
automáticamente ni cambia su UUID.

El diagnóstico muestra una barra por **operaciones confirmadas**, no por bytes.
El lote empieza con los pendientes observados, conserva sus ids durante los
reintentos y suma el trabajo nuevo mientras está pendiente. Al terminar, un lote
nuevo no hereda las confirmaciones históricas. **Ver detalle de sincronización**
despliega el flujo completo agrupado por inspección; los errores siguen visibles
cuando está plegado. Las actualizaciones no vacían la lista ni reinician el
detalle; cierre/cambio de propietario siguen retirando la información.

Verificación de esta corrección en `feature/offline-descarte-y-progreso`:
73/73 pruebas focalizadas, 1052/1052 unitarias y 15/15 E2E base Chromium;
Prettier, lint y build aprobados. El build avisa de 608,88 kB frente al presupuesto
de advertencia de 500 kB. El nuevo E2E verifica progreso/detalle estables,
descarte mediante la UI y reapertura offline con IndexedDB/SW reales, preservando
otra captura y los esquemas. Usa el harness aislado: no acredita una nueva
ejecución contra backend ni aceptación integral de P6.

## Recorrido real aislado

Desde el repositorio backend:

```sh
./mvnw -Dtest=RecorridoOfflineNavegador test
```

El arnés inicia Playwright con `playwright.offline.config.ts`; reutiliza
`serve-p8.mjs`, puerto frontend 8093 y un puerto backend aleatorio de localhost.
Requiere `P8_RECORRIDO_AISLADO=1`, `OFFLINE_RECORRIDO_AISLADO=1`,
`P8_BACKEND_URL`, `OFFLINE_CORREO`, `OFFLINE_CLAVE`, `OFFLINE_PUENTE`.
No ejecutar contra una base compartida. Un worker, sin paralelo ni reintentos
de toda la prueba; solo se reintentan operaciones de dominio con sus claves.

Opcionalmente, `PLAYWRIGHT_CHROMIUM_EXECUTABLE` indica la ruta de Chromium
del sistema (por ejemplo, `/usr/bin/chromium` en el runtime Alpine aislado).
Sin esa variable se usa el navegador instalado por Playwright o el canal configurado.
El recorrido aislado incorpora `--no-sandbox` y `--disable-dev-shm-usage`.

Se prueba login real → preparación → editor ya cargado → sin red → permanentes,
SIECA y cuatro fotos → encolar → reconexión con 2,1 s por escritura, corte de
foto y pérdida de respuestas ya procesadas → cero pendientes. El backend
verifica una inspección ENVIADA, identificación, permanentes y cuatro archivos.
Esto no sustituye la prueba del SW/arranque en frío. Véase
[ADR 0040](adr/0040-captura-offline-y-sincronizacion-productiva.md).
