import { computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth';
import { IntegracionSesionCursos } from './sesion-cursos';

/** Adapta la autenticación sin duplicar almacenamiento, renovación ni interceptores. */
export function crearSesionCursosAuth(): IntegracionSesionCursos {
  const auth = inject(AuthService);
  return {
    actual: computed(() => {
      const usuario = auth.usuario();
      const token = auth.accessToken();
      return usuario && token ? { id: usuario.id, rol: usuario.rol, token } : null;
    }),
    preparar: () => firstValueFrom(auth.hidratarAlArrancar()),
    urlAcceso: '/login',
  };
}
