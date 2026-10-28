# Captura offline productiva

La aplicación registra el motor real en `app.config.ts`; no es necesario
activar la demo. Con sesión de estudiante, entrar en `/offline/local`,
preparar la salida e iniciar una inspección asignada. La preparación conserva
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
