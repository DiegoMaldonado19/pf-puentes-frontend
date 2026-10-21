# 0017. Consulta HTTP del historial de órdenes

- Estado: implementado; acceso integrado pendiente de P2/P3
- Fecha: 20/10/2026
- Historia: HU-P8-MTO-01; RN-MTO-01/03/04/09; DT-FE-10/11/12, accesibilidad y contrato REST del proyecto

## Contexto y decisión

El usuario confirmó Catedrático y Administrador como lectores del historial/detalle, incluidos estados terminales. Backend expone GET de colección y detalle bajo `/api/v1/puentes/{puenteId}/ordenes-mantenimiento`.

`MantenimientoService.listarOrdenes` envía paginación y `obtenerOrden` consulta por ambos IDs escapados. El contrato `PaginaOrdenes` comparte forma con propuestas; `PaginaPropuestas` se conserva como alias para sus consumidores. No se crean credenciales ni sesiones propias.

`<app-consulta-ordenes>` recibe `puenteId` y `puedeConsultar` del futuro host protegido. Carga la primera página, pagina en servidor y obtiene el detalle al seleccionar, en lugar de presentar una copia potencialmente vieja del listado. Muestra tipo/estado/prioridades, intervención, origen, fechas, responsable y motivo disponibles. Los estados terminales permanecen visibles y no hay botones de transición.

Se cancelan lecturas al cambiar puente, selección, página, permiso o al destruirse la vista. Cambiar página/recargar retira el detalle anterior. Respuestas de otro puente/orden se rechazan. Un 401/403 en detalle retira también el listado y detiene lecturas hasta que cambie el contexto de acceso; otros errores permiten recuperación explícita sin reintentos automáticos. La autorización efectiva sigue en servidor.

Las fechas civiles se muestran sin convertirlas desde UTC, para no cambiar de día; las marcas de tiempo se presentan en es-GT, UTC−06:00. Textos centralizados, HTML semántico, tabla desplazable, botones nativos, foco visible y mensajes de carga/error. Se reutilizan estilos de la bandeja y se adapta el detalle para móvil.

## Límites y comprobación

Faltan sesión/interceptores/guardias y ruta diferida de P2, más selección real del puente de P3. No se añade una ruta sin protección ni datos de demostración a la aplicación. No es una API de evidencia, gestión de fechas ni de cambios de estado.

Las pruebas DOM/HTTP verifican contrato real de lectura, todos los estados, detalle seleccionado, datos ausentes, fechas civiles/UTC, paginación y recuperación si disminuyen los registros, ausencia de mutaciones, cancelación de lecturas, contexto de puente/orden y retirada completa ante 401/403. Los mocks de transporte existen solo en pruebas; las vistas consumen las rutas reales.

Verificación final local: **138 unitarios** (23 nuevos), lint, Prettier, compilación estricta de fuentes/pruebas/plantillas y build de producción aprobados. No se repitieron los e2e offline ajenos al cambio ni se acredita integración autenticada con P2.
