# Discusión de una inspección publicada (P9)

La discusión permite editar comentarios propios durante la ventana de edición y eliminar
comentarios propios. Catedráticos y administradores pueden ocultar comentarios y cerrar
el hilo mediante el diálogo de moderación existente, con motivo obligatorio. Los cambios
se envían por `FORO_INSPECCION_MUTACIONES_API` y recargan esta misma discusión, sin
navegar al detalle genérico de hilos (que excluye los hilos de inspección).
Los errores conservan el borrador y el motivo para reintentar; el servidor valida permisos
y plazo nuevamente.

La pantalla del foro de una inspección usa HTTP real:

- `GET /api/v1/inspecciones/{id}/hilo`.
- `GET /api/v1/inspecciones/{id}/comentarios?page=0&size=50`, con carga de páginas adicionales.
- `POST /api/v1/inspecciones/{id}/comentarios` con `texto`, `elemento_ref` opcional
  y, para respuestas, `padre_id`.

Los anclajes del formulario de comentario se obtienen de `x-elemento-ref` del
esquema histórico de la inspección, nunca del formulario activo. El comentario se
conserva si falla el envío. El formulario no se ofrece sin sesión ni con el hilo
cerrado; el servidor sigue validando permisos y estado al publicar.

Los puertos de mutación reutilizan las rutas genéricas existentes para editar,
borrar y ocultar comentarios y cerrar hilos. La moderación exige motivo.

Las menciones se eligen con `<app-compositor-menciones>` en el hilo del puente y
en la discusión de la inspección. La lista sale de `GET /api/v1/usuarios/mencionables`
(`MencionesForoHttp`, solo con sesión). Al enviar, cada persona elegida se agrega
al texto como `@<id>`, que el backend convierte en notificación (ADR 0065 del
backend). Al mostrar un comentario, `@<id>` se ve como `@Nombre`, o `@usuario`
si la persona no está en la lista (por ejemplo, para un visitante sin sesión).
