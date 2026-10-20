# 0015. Bandeja controlada de propuestas

- Estado: propuesto para revisión; interfaz implementada, lectura HTTP y acceso pendientes
- Fecha: 19/10/2026
- Historias: partes de HU-P8-MTO-01/03
- Reglas/directrices: RN-MTO-01/02/04/09; DT-FE-01/02/03/04/05/11/12/13; DT-SEC-03

## Contexto

Existen consulta interna de órdenes y POST de aceptación. El usuario confirmó que el grupo todavía no respondió quién consultará la bandeja: RN-MTO-02 define aceptantes, pero no enumera expresamente lectores. La sesión/guardias de P2 tampoco está en este checkout. Se puede construir la interfaz y su interacción con la aceptación sin habilitar una lectura HTTP con permisos supuestos.

## Decisión

`BandejaPropuestas` es standalone. Recibe `puenteId`, `pagina` y `puedeAceptar` obligatorios, y `cargando`/`codigoError` para la consulta del contenedor. Muestra tabla semántica de propuestas, tipo, prioridad, selección, paginación, carga, vacío y errores. Reutiliza `AceptacionPropuesta`, que realiza el POST existente. El permiso de aceptación controla la acción; el acceso de lectura deberá resolverlo la futura fachada/guardia, no este booleano.

`PaginaPropuestas` es un modelo de entrada de vista, **no un DTO de un GET existente**. Incluye `puente_id` como contexto de la consulta, además de `content`, `page`, `size`, `total_elements` y `total_pages`. El contenedor conservará el puente de la petición que produjo la página, incluso vacía. Se rechaza visualmente una página ajena o con estados distintos de PROPUESTA; no se pagina localmente un historial completo ni se cambian sus totales mediante un filtro de navegador.

`consultaSolicitada` emite `{ puente_id, page, size }`. No hay una implementación de transporte de lectura, URL GET inventada, proveedor ficticio ni interfaz con una implementación simulada de producción. Cada respuesta de lectura debe reemplazar la referencia de página; así se reinician selección y espera. El contenedor deberá cancelar/descartar lecturas tardías y mantener coherentes página, carga y error.

Durante una aceptación se bloquean selección y navegación mediante el signal público de solo lectura `envioPendiente` del hijo. Tras confirmación, la bandeja emite el DTO aceptado y solicita la página actual; si era el único registro de una página posterior a la primera, solicita la anterior. Retira el listado previo y espera los totales del servidor, sin presentar una eliminación local como recarga confirmada.

Ante un conflicto u otro resultado que exige actualizar, solicita recarga y retira la tabla; conserva la explicación del hijo hasta que llega una nueva página. Esto también retira los datos tabulares tras 401/403 de aceptación. Los errores de lectura 401/403 retiran lista y detalle y no ofrecen reintento sin resolver el acceso. No se añaden reintentos de mutaciones.

## Consecuencias e integración pendiente

La bandeja no se registra como ruta ni se añade al inicio. Falta confirmar lectores, exponer el GET con autorización/OpenAPI/pruebas de rol y conectar su cliente/contenedor; después incorporar sesión/interceptores/guardia de P2 por carga diferida. El POST real se prueba desde el hijo, pero no hay todavía un recorrido completo de navegador con lectura autenticada. La generación desde daños y el formulario de fecha siguen pendientes de sus requisitos propios.

El historial de órdenes programadas, en ejecución, ejecutadas, descartadas o canceladas permanece conservado: esta bandeja solo representa pendientes de aceptación y no decide quién consultará ese historial.

## Verificación

Pruebas DOM y transporte de aceptación: presentación, selección y paginación emitida, aceptación y petición de recarga, última página, conflicto, 401/403, navegación bloqueada durante escritura, cambio de puente con página vacía o con datos, sustitución de página, estados incompatibles, carga/vacío y errores de consulta. Datos de prueba únicamente en `.spec.ts`. Verificación global: 104 unitarios aprobados (20 nuevos), ESLint, Prettier, build de producción y compilación estricta de fuentes/pruebas/plantillas con `ngc -p tsconfig.spec.json --noEmit`. Transferencia inicial estimada: 67.85 kB. No se repitieron los e2e offline, que no cubren esta vista ni cambiaron en esta entrega. No se acredita integración de lectura autenticada.
