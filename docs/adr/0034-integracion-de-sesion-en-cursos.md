# 0033. Integración de sesión en cursos mediante un proveedor explícito

- Estado: aceptado e integrado con la autenticación compartida
- Fecha: 07/10/2026
- Actualización: 18/10/2026, puerto reactivo/restauración delegada y separación de Authorization
- Actualización: 27/10/2026, adaptador real y navegación por rol; renumerado desde 0011 para conservar el ADR de estado del puente.
- Reglas/directrices: DT-FE-02/03/06/10/11/12, DT-SEC-02/03, RN-USR-02

## Contexto

El módulo de cursos necesita identidad, rol y token actual. Al 18/10 ya existen login/renovación/cierre y perfil propio por HTTP, pero todavía no AuthService ni interceptores Angular de P2. La base del frontend ofrece standalone, PWA y textos centralizados. P7 no debe asumir las responsabilidades de autenticación de P2.

## Decisión

Implementar las vistas en `features/cursos/`, con rutas diferidas, signals, formularios reactivos y API tipada snake_case. Agregar HttpClient y conservar el trabajo offline existente.

Mantener `SESION_CURSOS` como compatibilidad del contrato inicial e introducir `IntegracionSesionCursos`/`proveerSesionCursos` para la integración compartida. P2 aporta una Signal de sesión, una operación de preparación idempotente y su ruta de login. Las guardias esperan esa preparación antes de comprobar rol/token. Una entrada `/acceso-cursos` sin motivo dirige a la vista del rol; tras errores terminales un motivo evita bucles de restauración/redirección.

Con el puerto registrado, CursosApi no adjunta Bearer: esa responsabilidad y el único reintento de 401 son del interceptor P2. P7 observa cambios de identidad/rol, limpia sus vistas y presenta 401/403 finales sin modificar el estado global de P2 ni llamar a auth HTTP. No se persisten tokens ni se incluye un AuthService, login o interceptor ficticio. Sin proveedor las rutas privadas siguen cerradas.

## Consecuencias

Las vistas y contratos pueden probarse con proveedores exclusivos de tests. La operación real requiere que P2 conecte el proveedor y sus interceptores de renovación/errores. El backend siempre comprueba permisos; las guardias solo controlan navegación. Este límite evita acoplar P7 a una firma de AuthService inventada y debe simplificarse al acordar la API definitiva de P2.

## Estado actual (27/10/2026)

El contexto y las consecuencias anteriores describen el punto de partida. Ahora `sesion-cursos-auth.ts` adapta `AuthService.usuario`, `accessToken` e `hidratarAlArrancar`; `app.config.ts` registra `proveerSesionCursos(crearSesionCursosAuth)` junto con los interceptores compartidos. El acceso usa `/login`, sin duplicar renovación ni persistencia de tokens. La navegación muestra Cursos al Catedrático y Mis asignaciones al Estudiante.

Las pantallas usan panel de creación/listado, tarjetas por curso y secciones de configuración, matrícula y asignaciones, con la paleta azul/slate del inventario. No incluyen métricas ficticias ni filtros locales sobre una página del servidor.

Contrato: [integración de sesión](../P7/integracion-sesion.md). La validación completa de navegador sigue pendiente; la ejecución frontend reciente se bloqueó por `maplibre-gl` ausente en las dependencias instaladas.
