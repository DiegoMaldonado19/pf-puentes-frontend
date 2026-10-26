# 0014. Aceptación de propuestas de mantenimiento

- Estado: propuesto para revisión; cliente y componente implementados, integración de sesión/bandeja pendiente
- Fecha: 19/10/2026
- Historia: HU-P8-MTO-03, aceptación; presentación parcial de MTO-01
- Reglas/directrices: RN-MTO-02/04/06; DT-ARQ-01/06; DT-FE-01/02/03/04/05/10/11/12/13; DT-SEC-02/03

## Contexto

El backend dispone del POST de aceptación para Catedrático/Admin, con auditoría y control de concurrencia. El checkout frontend aún no tiene `core/` de sesión ni guardias de P2; tampoco tiene bandeja/GET de órdenes. Se implementa la acción visual sobre una selección real suministrada por su futuro contenedor, sin inventar consultas o datos de producción.

## Decisión

`features/mantenimiento/MantenimientoService.aceptar(puenteId, ordenId)` envía un POST sin cuerpo a `/api/v1/puentes/{puenteId}/ordenes-mantenimiento/{ordenId}/aceptacion`. Utiliza el HttpClient global, con la misma base relativa del proxy/nginx. No administra tokens, reemplaza interceptores, agrega autenticación paralela ni reintenta escrituras. El modelo TypeScript reproduce los 16 campos snake_case de `OrdenMantenimientoDTO`, sus enums y nulls.

`AceptacionPropuesta` es standalone, con entradas obligatorias `orden` y `puedeAceptar`. El contenedor protegido entregará un DTO real e inmutable y derivará el permiso de la cuenta activa de P2: Catedrático/Admin, conforme a RN-MTO-02. Este booleano controla la interfaz; no reemplaza la autorización backend ni la guardia de ruta. El resumen presenta intervención, tipo, estado, prioridades, justificación y fecha; no calcula prioridad ni IC. Los textos están centralizados y el control usa botón nativo, foco visible y mensajes de estado/error. Las fechas civiles `LocalDate` se presentan como dd/MM/yyyy sin convertirlas a instantes: aplicar UTC−6 cambiaría indebidamente el día.

La acción aparece solo con permiso y estado PROPUESTA. Bloquea doble clic y otros envíos mientras haya una petición pendiente. Mantiene el estado anterior hasta recibir el DTO confirmado; entonces muestra Programada y emite `aceptada` con ese DTO. No genera ni programa una fecha ausente.

Ante 401/403 oculta el resumen privado y muestra el mensaje correspondiente. Ante 400/404/409/422 pide actualizar los datos; ante fallo de red/servidor informa que el resultado es incierto, ya que el servidor pudo confirmar la aceptación antes de perderse la respuesta. Ningún error provoca reenvío automático ni permite insistir con el mismo DTO. `actualizacionRequerida` emite únicamente los IDs de puente/orden para que el contenedor actualice esa fila mediante su futura consulta autorizada.

Una respuesta tardía no se aplica a otra selección. Se mantiene un solo envío pendiente incluso al cambiar de orden; si la selección o el permiso cambió, se solicita refrescar el registro original en vez de confirmar la nueva selección. Al destruir se libera la suscripción: cancelar el transporte **no revierte** una operación que ya llegó al backend. El contenedor debe releer el estado al volver, y entregar nuevas referencias de DTO al recargar datos.

## Integración pendiente

No se registra una ruta pública ni se sustituye `app.html`. La incorporación se hará en la bandeja protegida con carga diferida, sesión/interceptores/guardias de P2 y selección real de propuestas. El contenedor debe manejar ambos outputs; aún no existe la consulta HTTP de órdenes para implementar allí la recarga. `npm start` conserva la página inicial y no acredita un recorrido autenticado de aceptación.

La generación desde daños sigue dependiendo del catálogo y P5. El formulario/API para registrar o cambiar fecha programada, los demás cambios de estado y la evidencia se implementarán en entregas separadas. Esta pieza no completa MTO-03 ni la pantalla de MTO-01.

## Verificación

Las pruebas HTTP/DOM usan datos ficticios solo en archivos de prueba. Verifican ruta/método/cuerpo, DTO e interceptores, errores sin reintentos, resumen y fechas, visibilidad por permiso/estado, doble clic, confirmación del servidor, retiro de datos por 401/403, resultados inciertos, actualización de selección, permiso perdido y limpieza al destruir. Verificación del 19/10: 84 unitarios aprobados (31 nuevos), ESLint, Prettier, build de producción y compilación estricta de fuentes/pruebas/plantillas mediante `ngc -p tsconfig.spec.json --noEmit`. Transferencia inicial estimada: 67.84 kB; el componente aún no está registrado en rutas. No se repitieron los e2e offline porque este incremento no modifica ese flujo. No equivalen a un recorrido con sesión y backend reales.
