# P7 — Uso e integración del frontend de cursos

Rutas diferidas:

- `/cursos`: lista y creación de cursos del catedrático.
- `/cursos/:cursoId`: edición, inscripciones y asignaciones del curso propio.
- `/mis-asignaciones`: consulta de asignaciones vigentes del estudiante.
- `/acceso-cursos`: acceso requerido si falta sesión/rol.

## Uso

Crear curso con nombre/año/semestre/vigencia. En detalle, inscribir un estudiante elegible; seleccionar su inscripción con «Ver asignaciones» y asignar un puente activo. Los selectores/listados están paginados. Un curso cerrado conserva la consulta, pero bloquea nuevas inscripciones y asignaciones. El estudiante ve sus puentes vigentes; captura y preparación de salida se integran con P5/P6.

## Dependencia de P2

`SESION_CURSOS` debe recibir una función que lea el AuthService de P2 y devuelva `{id, rol, token}` o null. No existe sesión por defecto y no se guardan tokens en localStorage. HttpClient se configura en `app.config.ts`; conectar allí los interceptores reales de P2 cuando existan. El backend autoriza cada operación.

Las cuentas pendientes necesitan el adaptador de activación de P2 en backend. La UI muestra 503 como dependencia de activación, sin anunciar éxito ni borrar la selección.

Código y pruebas: `src/app/features/cursos/`. Textos en `shared/textos.ts`; fechas dd/MM/yyyy UTC−6. [ADR 0011](../adr/0011-integracion-de-sesion-en-cursos.md).

Chequeos: `npx prettier --check .`, `npm run lint`, `npm run build`, `npx ng test --watch=false`.
