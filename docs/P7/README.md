# P7 — Uso e integración del frontend de cursos

Rutas diferidas:

- `/cursos`: lista y creación de cursos del catedrático.
- `/cursos/:cursoId`: edición, inscripciones y asignaciones del curso propio.
- `/mis-asignaciones`: consulta de asignaciones vigentes del estudiante.
- `/acceso-cursos`: acceso requerido si falta sesión/rol.

## Uso

Las rutas privadas conservan sus guardias y dependen de la sesión real de P2. Se retiró la vista previa temporal sin login, incluidos sus datos simulados y configuración de ejecución. No existe un modo alternativo de P7 para omitir la autenticación.

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

## Ejecución local y entrega

Si estabas usando la vista previa, detén ese proceso con Ctrl+C y recrea el frontend desde este repositorio con su configuración normal:

```bash
docker compose -f compose.local.yaml up --build --force-recreate --watch
```

La reconstrucción evita conservar rutas/archivos de la imagen temporal. No requiere borrar volúmenes ni cambiar el backend. Sin el proveedor P2, `/cursos`, `/cursos/:cursoId` y `/mis-asignaciones` llevan a `/acceso-cursos`; esto es el comportamiento esperado, no un fallo del despliegue. Las pruebas usan proveedores exclusivos de tests y no habilitan sesiones en producción.

Verificación después de retirar la vista previa: **58 pruebas correctas** (incluidas las guardias sin proveedor P2), compilación de producción, lint y formato correctos. El código/configuración de ejecución vuelve al estado protegido de `c554b92`; se conserva la integración consumidora de sesión P7, sin implementar AuthService de P2.

Las entregas siguen el flujo compartido: rama `feature/…` basada en `develop` → PR hacia `develop` (dev) → merge aprobado en GitHub (stage) → PR de `develop` hacia `main` para promover a producción tras validar stage. **Stage es un entorno, no una rama adicional en este flujo.** No integrar mediante `git merge` desde la consola. El PR puede crearse en GitHub; crear un commit local no publica cambios ni abre un PR. Este ajuste se entrega solo como commit local, sin push ni PR automático.
