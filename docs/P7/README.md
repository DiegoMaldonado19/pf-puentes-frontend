# P7 — Uso e integración del frontend de cursos

Rutas diferidas:

- `/cursos`: lista y creación de cursos del catedrático.
- `/cursos/:cursoId`: edición, inscripciones y asignaciones del curso propio.
- `/mis-asignaciones`: consulta de asignaciones vigentes del estudiante.
- `/acceso-cursos`: acceso requerido si falta sesión/rol.

## Uso

Crear curso con nombre/año/semestre/vigencia. En detalle, inscribir un estudiante elegible; seleccionar su inscripción con «Ver asignaciones» y asignar un puente activo. Los selectores/listados están paginados. Un curso cerrado conserva la consulta, pero bloquea nuevas inscripciones y asignaciones. El estudiante ve sus puentes vigentes; captura y preparación de salida se integran con P5/P6.

Actualizado al 11/10: búsquedas por nombre de estudiante y por nombre/código de puente (máximo 120 caracteres). Buscar reinicia la página y la selección; la paginación conserva el filtro aplicado. Los listados presentan nombres/códigos enviados por el backend, con fallback a UUID para compatibilidad. Una recarga limpia las selecciones/asignaciones anteriores y los controles de mutación se deshabilitan mientras hay una operación o el curso está cerrado.

## Dependencia de P2

Al 18/10, P7 ofrece `IntegracionSesionCursos` y `proveerSesionCursos`: sesión reactiva, restauración delegada antes de guardias y ruta de acceso de P2. Con el puerto conectado, Authorization/renovación pertenecen exclusivamente al interceptor P2. El proveedor anterior `SESION_CURSOS` se conserva como compatibilidad. No hay sesión por defecto ni tokens persistidos. [Contrato, ejemplo de conexión y pruebas](integracion-sesion.md).

Las cuentas pendientes necesitan el adaptador de activación de P2 en backend. La UI muestra 503 como dependencia de activación, sin anunciar éxito ni borrar la selección.

El backend ya entrega login, renovación, cierre y perfil propio por HTTP. **AuthService e interceptores Angular siguen siendo responsabilidad pendiente de P2**: no se implementan ni se simulan desde P7. Sin ese proveedor las rutas privadas siguen cerradas. Al cerrar/cambiar sesión o recibir un rechazo de acceso final, P7 limpia sus datos y selecciones; no intenta renovar por su cuenta.

Se corrigió la regresión del merge de `shared/textos.ts`: `estadoPuente`, `offline` y `capturaFoto` vuelven a la raíz junto a `cursos`, conservando los contratos de otros compañeros.

Código y pruebas: `src/app/features/cursos/`. Textos en `shared/textos.ts`; fechas dd/MM/yyyy UTC−6. [ADR 0011](../adr/0011-integracion-de-sesion-en-cursos.md).

Chequeos: `npx prettier --check .`, `npm run lint`, `npm run build`, `npx ng test --watch=false`.

[Resultados posteriores al pull — 18/10/2026](verificacion-2026-10-18.md).
