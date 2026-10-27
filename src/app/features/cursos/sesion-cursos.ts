import { effect, inject, InjectionToken, Provider, Signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CanActivateFn, Router } from '@angular/router';

export interface SesionCursos {
  id: string;
  rol: 'CATEDRATICO' | 'ESTUDIANTE' | 'ADMINISTRADOR' | 'PROFESIONAL_EXTERNO';
  token: string;
}

/** Puerto de P7. P2 aporta su sesión reactiva y restaura/renueva en su propio AuthService.
 * Con este proveedor, Authorization y el reintento de 401 pertenecen al interceptor de P2.
 */
export interface IntegracionSesionCursos {
  actual: Signal<SesionCursos | null>;
  preparar: () => Promise<void>;
  urlAcceso: string;
}

export const INTEGRACION_SESION_CURSOS = new InjectionToken<IntegracionSesionCursos | null>(
  'INTEGRACION_SESION_CURSOS',
  { providedIn: 'root', factory: () => null },
);

/** La fábrica permite inject(AuthService) sin importar ni implementar ese servicio desde P7. */
export function proveerSesionCursos(fabrica: () => IntegracionSesionCursos): Provider {
  return { provide: INTEGRACION_SESION_CURSOS, useFactory: fabrica };
}

// Compatible con el contrato inicial; sin proveedor no habilita rutas privadas.
export const SESION_CURSOS = new InjectionToken<() => SesionCursos | null>('SESION_CURSOS', {
  providedIn: 'root',
  factory: () => inject(INTEGRACION_SESION_CURSOS)?.actual ?? (() => null),
});

export function destinoCursos(rol: SesionCursos['rol']): string | null {
  if (rol === 'CATEDRATICO') return '/cursos';
  if (rol === 'ESTUDIANTE') return '/mis-asignaciones';
  return null;
}

export const rolCursosGuard: CanActivateFn = async (ruta) => {
  const actual = inject(SESION_CURSOS);
  const integracion = inject(INTEGRACION_SESION_CURSOS);
  const router = inject(Router);
  try {
    await integracion?.preparar();
  } catch {
    return router.createUrlTree(['/acceso-cursos'], { queryParams: { motivo: 'sesion' } });
  }
  const sesion = actual();
  if (sesion && sesion.rol === ruta.data['rol'] && sesion.token) return true;
  return router.createUrlTree(['/acceso-cursos'], {
    queryParams: integracion ? { motivo: sesion?.token ? 'permiso' : 'sesion' } : {},
  });
};

/** Entrada que P2 puede usar tras el login, sin que P7 defina una pantalla de autenticación. */
export const entradaCursosGuard: CanActivateFn = async (ruta) => {
  const integracion = inject(INTEGRACION_SESION_CURSOS);
  const actual = inject(SESION_CURSOS);
  const router = inject(Router);
  // Un rechazo terminal no debe restaurar y volver a la misma ruta en un bucle.
  if (!integracion || ruta.queryParamMap.has('motivo')) return true;
  try {
    await integracion.preparar();
  } catch {
    return true;
  }
  const sesion = actual();
  const destino = sesion?.token ? destinoCursos(sesion.rol) : null;
  return destino ? router.parseUrl(destino) : true;
};

/** Evita mantener datos del usuario anterior en pantalla después de cerrar/cambiar sesión. */
export function vigilarSesionCursos(
  rol: SesionCursos['rol'],
  limpiar: () => void,
): (error: unknown) => void {
  const integracion = inject(INTEGRACION_SESION_CURSOS);
  const router = inject(Router, { optional: true });
  const salir = (motivo: string) => {
    limpiar();
    if (integracion) void router?.navigate(['/acceso-cursos'], { queryParams: { motivo } });
  };
  if (integracion) {
    let propietario = integracion.actual()?.id;
    effect(() => {
      const sesion = integracion.actual();
      if (!sesion?.token || sesion.rol !== rol || sesion.id !== propietario) {
        propietario = sesion?.id;
        salir(sesion?.token ? 'permiso' : 'sesion');
      }
    });
  }
  // Se ejecuta solo sobre el error final, después del interceptor de P2. P7 no renueva.
  return (error) => {
    if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
      salir(error.status === 401 ? 'sesion' : 'permiso');
    }
  };
}
