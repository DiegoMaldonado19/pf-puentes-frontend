import { computed, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth';
import { SesionP2 } from './puertos';

export function crearSesionForo(): SesionP2 {
  const auth = inject(AuthService);
  return {
    disponible: true,
    usuarioId: computed(() => auth.usuario()?.id ?? null),
    roles: computed(() => {
      const rol = auth.rol();
      return rol ? [rol] : [];
    }),
  };
}
