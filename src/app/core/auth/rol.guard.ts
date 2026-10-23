import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth';
import { Rol } from './modelos';

export function rolGuard(...roles: Rol[]): CanActivateFn {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    await firstValueFrom(auth.hidratarAlArrancar());
    if (!auth.autenticado()) return router.createUrlTree(['/login']);
    const actual = auth.rol();
    return actual && roles.includes(actual) ? true : router.createUrlTree(['/puentes']);
  };
}
