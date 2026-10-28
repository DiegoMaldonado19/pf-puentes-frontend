# Discusión de una inspección publicada (P9)

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

Las menciones se escriben directamente como `@usuario` en el texto y las procesa
el backend. No se monta el compositor de menciones porque no existe un endpoint
para listar usuarios mencionables; no se simula una lista de usuarios.
