# 0016. Conexión HTTP de la bandeja de propuestas

- Estado: implementado; sesión y ruta protegida pendientes de P2
- Fecha: 20/10/2026
- Historias: HU-P8-MTO-01/03; RN-MTO-01/02/04

## Contexto

El grupo confirmó Catedrático y Administrador como lectores de propuestas pendientes, según lo comunicado por el usuario. Backend habilitó el GET de propuestas; la bandeja controlada existente ya maneja selección, aceptación y solicitudes de recarga.

## Decisión

`MantenimientoService.listarPropuestas` consume `GET /api/v1/puentes/{puenteId}/ordenes-mantenimiento/propuestas` con `page` y `size`. El DTO de página conserva `puente_id` aun vacío; no hay cálculo local de totales ni filtros de estado en cliente.

`<app-consulta-propuestas>` recibe `puenteId`, `puedeConsultar` y `puedeAceptar` del futuro host protegido de P2. Carga la primera página y atiende las solicitudes de la bandeja (navegación, recarga y resultado de aceptación). Emite `aceptada` para que el host pueda actualizar otras vistas. El permiso de consulta falso impide peticiones y retira datos. Cambios de puente/permisos o destrucción cancelan la lectura anterior; la respuesta corresponde al contexto de esa petición. Los errores se muestran mediante los textos compartidos y no disparan reintentos automáticos de escrituras ni lecturas.

La autorización real permanece en backend. El componente no crea tokens ni sesión, no instala mocks ni expone rutas públicas. La cadena HTTP global incorporará los interceptores de P2. El POST y el GET son operaciones reales; las respuestas simuladas existen únicamente en pruebas.

## Verificación y pendientes

Pruebas DOM/HTTP: carga, paginación, POST → GET y actualización visible, errores 401/403/404/500/red, recuperación explícita, cancelación por cambio de puente, revocación de permiso y destrucción. Las pruebas de la bandeja continúan cubriendo conflicto, selección y navegación durante escrituras.

Faltan guardias/interceptores/sesión, ruta diferida y selección de puente real; no aparece todavía en la página inicial. La generación automática y la programación con fecha siguen pendientes del flujo completo de mantenimiento.

Verificación local: 115 pruebas unitarias (11 nuevas), lint, Prettier, build de producción y compilación estricta de fuentes/pruebas/plantillas aprobados. Los e2e offline existentes no se repitieron porque este cambio no modifica su flujo.
