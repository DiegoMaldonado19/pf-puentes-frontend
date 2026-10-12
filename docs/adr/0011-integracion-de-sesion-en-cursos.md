# 0011. Integración de sesión en cursos mediante un proveedor explícito

- Estado: aceptado; contrato propuesto para P2
- Fecha: 07/10/2026
- Reglas/directrices: DT-FE-02/03/06/10/11/12, DT-SEC-02/03, RN-USR-02

## Contexto

El módulo de cursos necesita la identidad, el rol y el token actual, pero aún no existe AuthService ni login/interceptores de P2. La base del frontend sí ofrece standalone, PWA y textos centralizados.

## Decisión

Implementar las vistas en `features/cursos/`, con rutas diferidas, signals, formularios reactivos y API tipada snake_case. Agregar HttpClient y conservar el trabajo offline existente.

Definir `SESION_CURSOS` como proveedor de una función que devuelve la sesión vigente o null. Su valor por defecto es null; las guardias redirigen a una pantalla de acceso requerido. P2 conecta su AuthService al proveedor cuando esté disponible. La API consulta el proveedor en cada petición para adjuntar el token actual en memoria. No se persiste un token ni se implementa autenticación ficticia.

## Consecuencias

Las vistas y contratos pueden probarse con proveedores exclusivos de tests. La operación real requiere que P2 conecte el proveedor y sus interceptores de renovación/errores. El backend siempre comprueba permisos; las guardias solo controlan navegación. Este límite evita acoplar P7 a una firma de AuthService inventada y debe simplificarse al acordar la API definitiva de P2.
