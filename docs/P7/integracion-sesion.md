# P7 — Integración con sesión P2 (18/10/2026)

## Alcance y estado

P7 **no implementa AuthService, login, renovación, cierre ni interceptores**. P2 ya ofrece backend HTTP para esas operaciones, pero todavía no existe su integración Angular en la copia local. Este cambio prepara el lado consumidor P7. No se registra un proveedor ficticio en `app.config.ts`; sin P2 las rutas privadas continúan cerradas.

## Puerto público de P7

`src/app/features/cursos/sesion-cursos.ts` exporta:

```ts
interface IntegracionSesionCursos {
  actual: Signal<SesionCursos | null>;
  preparar: () => Promise<void>;
  urlAcceso: string;
}
interface SesionCursos {
  id: string;
  rol: 'CATEDRATICO' | 'ESTUDIANTE' | 'ADMINISTRADOR' | 'PROFESIONAL_EXTERNO';
  token: string;
}
```

P2 registra `proveerSesionCursos(() => ({ actual, preparar, urlAcceso }))` junto con su `provideHttpClient(withInterceptors(...))`. La fábrica admite `inject(...)`; P7 no importa clases de P2. Esquema de conexión, **pseudocódigo**, no nombres de un AuthService existente:

```ts
proveerSesionCursos(() => {
  const auth = inject(AuthService); // pertenece a P2; adaptar sus métodos reales
  return {
    actual: computed(() => {
      const s = auth.sesion();
      return s ? { id: s.usuario.id, rol: s.usuario.rol, token: s.access_token } : null;
    }),
    preparar: () => auth.asegurarSesion(),
    urlAcceso: '/ruta-real-de-login-de-p2',
  };
});
```

- `actual` debe notificar login, logout, cambio de identidad/rol y renovación. No persistir JWT en localStorage ni IndexedDB.
- `preparar` resuelve cuando P2 termina de restaurar o validar la sesión. Debe ser idempotente y compartir restauraciones concurrentes en P2; P7 la llama antes de evaluar cada acceso, no llama a HTTP de auth. Una sesión no recuperable debe quedar en null. Ante fallo no se habilita la ruta, aunque exista un token anterior.
- `urlAcceso` debe ser una ruta interna existente de P2, nunca `/acceso-cursos` (evitar un enlace circular).
- Con este puerto, `CursosApi` **no escribe Authorization**: lo hace solo el interceptor P2 con el token vigente. Tampoco renueva ni reintenta errores. No registrar a la vez otro proveedor de `SESION_CURSOS` que contradiga `actual`.
- Se conserva `SESION_CURSOS` como compatibilidad del contrato inicial: sin el puerto, un proveedor antiguo sigue adjuntando Bearer por petición. No es el mecanismo nuevo ni una sesión de producción incluida.

## Navegación y datos visibles

- `/acceso-cursos`, sin motivo, es una entrada que P2 puede usar tras login: catedrático → `/cursos`; estudiante → `/mis-asignaciones`. Otros roles no adquieren permisos de cursos.
- Las guardias esperan `preparar`, luego comprueban rol y token. La autorización definitiva de rol/propiedad sigue en backend.
- Cierre, cambio de cuenta/rol o 401/403 final: P7 borra sus listados, detalle y selecciones, y muestra `/acceso-cursos?motivo=sesion|permiso`. El aviso enlaza a la ruta de acceso de P2.
- Una renovación del mismo usuario no limpia la vista. Ante errores finales P7 no borra el estado global de P2: solo sus propios datos y navegación.
- El parámetro `motivo` evita restaurar y volver automáticamente a la vista que acaba de rechazar el acceso. Después de autenticar, P2 puede navegar a `/acceso-cursos` sin ese parámetro.
- P2 mantiene el único reintento de 401 y su política de errores. Un 403 no debe causar renovación. Los errores transitorios o de negocio (409/422/503) conservan la presentación/selección P7 y no expulsan al usuario.

## Backend P2 disponible

| Operación                         | Contrato                                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/auth/login`         | `{correo, contrasena}` → `{access_token, token_type, expires_in, usuario:{id,nombre,rol}}`; cookie refresh HttpOnly |
| `POST /api/v1/auth/renovar`       | Cookie `refresh_token` → mismo DTO de sesión; refresh no rota ni se devuelve en el cuerpo                           |
| `POST /api/v1/auth/cerrar-sesion` | Revoca refresh de ese dispositivo y borra cookie, 204                                                               |
| `GET /api/v1/usuarios/me`         | Bearer → `{id,nombre,correo,rol,estado}`                                                                            |

La cookie es HttpOnly, SameSite=Strict y acotada a `/api/v1/auth`; P2 usa credenciales del navegador, no lee la cookie desde JS. Mantener el proxy/origen y configuración Secure existentes. Al cerrar sesión P2 debe borrar el token en memoria: un JWT emitido puede seguir vigente hasta expirar; la baja sí se comprueba por petición.

## Pruebas y límites

- `sesion-cursos.spec.ts`: restauración asíncrona, navegación por rol, fallo de restauración, pérdida de identidad/permisos, limpieza, renovación del mismo usuario y propiedad de Authorization. Los dobles P2 existen solo en pruebas.
- `textos.spec.ts`: preserva bloques raíz de P1/P6/estado-puente después del merge.
- Backend `CursoSesionIntegracionTest`: login real → curso → inscripción activa → asignación → consulta propia; acceso vencido → renovación HTTP; cierre/baja y activación todavía ausente. No usa `@WithMockUser` ni adaptador de activación simulado.
- La renovación automática de extremo a extremo **en Angular queda pendiente de P2**. P7 prueba que no la duplica, no sustituye sus pruebas de interceptor.
- Activación productiva, vínculo histórico con inspección, captura, publicación y sincronización real no se implementan en este cambio.

# Estado de integración — 27/10/2026

El contrato descrito abajo ya está conectado: `sesion-cursos-auth.ts` expone `crearSesionCursosAuth`, registrado con `proveerSesionCursos` en `app.config.ts`. Adapta los signals de usuario/token y delega la preparación a `hidratarAlArrancar`; el destino de acceso es `/login`. No requiere implementar otro AuthService ni interceptores. Las referencias posteriores a una conexión futura describen el diseño original. La validación completa de navegador permanece pendiente.
