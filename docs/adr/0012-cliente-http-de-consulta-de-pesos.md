# 0012. Cliente HTTP de consulta de pesos

- Estado: propuesto para revisión; cliente implementado
- Fecha: 19/10/2026
- Historia: HU-P8-IC-04, consumo de la API de consulta
- Reglas/directrices: RN-IC-03; DT-ARQ-01; DT-FE-05/10/11; DT-SEC-02/03

## Contexto

P8 dispone de tres rutas GET de consulta administrativa en el backend. La aplicación frontend aún no tiene sesión, interceptores de P2, guardias ni rutas de funcionalidad. Se puede construir el cliente de dominio que utilizará la pantalla sin inventar esa infraestructura compartida.

## Decisión

`features/admin/pesos/PesosService` consume las rutas reales mediante `HttpClient`: listar juegos de una versión de formulario, obtener un juego y listar sus pesos. Los DTO mantienen snake_case, acta nullable, fecha UTC y contrato explícito de página del backend. Las colecciones aceptan página y tamaño, predeterminados en 0 y 20; el backend valida sus límites y autorización.

Se registra `provideHttpClient()` en la configuración raíz existente. El cliente utiliza la URL relativa `/api/v1`, compatible con el proxy local y nginx por entorno existentes. No incluye direcciones de servidor compiladas ni dependencias nuevas. Las llamadas pasan por la cadena global de interceptores; cuando P2 incorpore los suyos, debe añadirlos al proveedor raíz existente, evitando registrar un cliente aislado en la funcionalidad.

El servicio devuelve observables HTTP y conserva errores y Problem Details para el manejo global y la futura pantalla. No transforma un fallo en una lista vacía ni almacena resultados privados. La sesión, renovación y token en memoria corresponden a P2: no se añade autenticación propia, almacenamiento de tokens ni una ruta administrativa sin guardia. Sin esa sesión, las llamadas a la API protegida recibirán 401.

## Verificación y consecuencias

Las pruebas de transporte comprueban rutas, métodos y paginación reales del contrato, respuestas con acta ausente y fecha UTC, pesos numéricos, propagación de errores 400/401/403/404/500 y caída de red. Otra prueba comprueba que se utiliza la cadena de interceptores global. `HttpTestingController` reemplaza el transporte exclusivamente en pruebas; el código de producción usa `HttpClient`. Estas pruebas no acreditan un recorrido de navegador autenticado contra el backend.

La entrega deja listo el cliente que consumirá la pantalla. Continúan pendientes la vista, ruta diferida con guardia Admin e integración de sesión con P2. La creación HTTP depende además de metadatos confiables de P4 y acuerdos de versiones/completitud. HU-P8-IC-04 continúa en progreso. Los resultados de verificación están en el registro de avance de P8.

Verificación del 19/10: 35 pruebas unitarias aprobadas (11 nuevas), ESLint, Prettier y build de producción correctos; transferencia inicial estimada 67.84 kB. Pasaron los ocho escenarios Playwright del harness offline existente como regresión. El servidor de pruebas requirió autorización para abrir su puerto local; no se modificó el harness. No son pruebas de integración de pesos con sesión real.
