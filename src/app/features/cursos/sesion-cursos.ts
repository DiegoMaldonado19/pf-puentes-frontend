import { inject, InjectionToken } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export interface SesionCursos {
  id: string;
  rol: 'CATEDRATICO' | 'ESTUDIANTE' | 'ADMINISTRADOR' | 'PROFESIONAL_EXTERNO';
  token: string;
}

// P2 conecta aquí su AuthService. Sin proveedor de sesión no se habilita una ruta privada.
export const SESION_CURSOS = new InjectionToken<() => SesionCursos | null>('SESION_CURSOS', {
  providedIn: 'root',
  factory: () => () => null,
});

export const rolCursosGuard: CanActivateFn = (ruta) => {
  const sesion = inject(SESION_CURSOS)();
  return (
    (sesion?.rol === ruta.data['rol'] && !!sesion?.token) ||
    inject(Router).createUrlTree(['/acceso-cursos'])
  );
};
