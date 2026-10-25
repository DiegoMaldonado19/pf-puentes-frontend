# 0026. Acceso protegido al mantenimiento por puente

- Fecha: 23/10/2026
- Renumerado: 24/10/2026, para resolver la colisión con el ADR 0024 de sesión offline recibido de P2. No cambia la decisión.
- Estado: implementado; verificación local en README
- Trazabilidad: RN-USR-10, RN-MTO-02/04/05/06/07/09, DT-FE-02/03/04/05/06/10/11, acuerdos de permisos P8

## Contexto

El merge frontend `704ddae` incorpora sesión, renovación, interceptores, login y guardias de P2. El proveedor de `ROL_PUENTES` ya conecta la ficha de P3 con esa sesión. Las consultas y acciones P8 existentes aún no tenían ruta ni contenedor que les aportara permisos reales. No se certifica todo P2 por revisar su contrato con P8.

## Decisión

Se añade `/puentes/:id/mantenimiento`, con carga diferida y `rolGuard` de P2 para Catedrático/Admin, los lectores y ejecutores acordados para las operaciones implementadas. El backend mantiene su autorización en cada petición. La ficha pública muestra un enlace únicamente a esos roles; la ruta se reconoce también como privada al fallar la renovación del token.

`GestionMantenimiento` valida la sesión y consulta el puente real antes de montar componentes privados. Muestra nombre/código y enlace de regreso. La vista inicial contiene historial, detalle, seguimiento anual y las acciones existentes: programación, inicio, evidencia/cierre, descarte y ajuste justificado de prioridad. La segunda vista muestra propuestas pendientes y aceptación. Cada hijo recibe permisos derivados de `AuthService`; conserva las restricciones de estado del dominio. No se añaden roles, transiciones, cálculo local ni datos ficticios en producción.

Solo se monta una consulta por vez. Cambiar de vista reconstruye la consulta para releer datos actuales; una aceptación no deja un historial antiguo en memoria. Durante una escritura se bloquean cambio de vista y salida mediante `canDeactivate`, con estado visible. Al perder sesión o permiso se retiran las consultas y cancelan lecturas. La baja de un puente no elimina su historial ni añade una exclusión no acordada.

Se reutilizan endpoints existentes y `authInterceptor`; no se desarrolla otro login ni otra autenticación. El token permanece en memoria. La cancelación de una petición al abandonar sesión no garantiza deshacer una escritura confirmada en servidor; los componentes existentes exigen releer ante resultados inciertos.

## Verificación y límites

Pruebas DOM/HTTP con `AuthService`, interceptor y guardia reales, respuestas API controladas: ambos roles autorizados, exclusión de estudiantes/profesionales/visitantes, Bearer/cookie, carga por puente, seguimiento, cambio de vista, pérdida de sesión, 404/reintento y bloqueo mientras el POST de aceptación está pendiente. La ficha y clasificación de rutas privadas también se prueban. No equivalen a ejecutar un navegador contra un backend real.

Para probar manualmente: levantar backend/frontend, iniciar sesión con una cuenta real Catedrático/Admin, abrir una ficha desde `/puentes` y pulsar **Gestionar mantenimiento**. Se necesitan órdenes existentes para ejecutar acciones; una consulta vacía es válida. No se crean órdenes de demostración para rellenar la pantalla.

Quedan fuera de este incremento: ruta administrativa de pesos, metadatos P4, publicación P5/generación automática, catálogo/prioridad sugerida, confirmación/recálculo y presentación P9 de avisos. El recordatorio anual y su API de seguimiento no garantizan programación efectiva. Los acuerdos de cancelación pendientes no se completan mediante esta pantalla.
