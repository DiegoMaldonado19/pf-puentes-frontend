import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth';

export const sesionGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await firstValueFrom(auth.hidratarAlArrancar());
  return auth.autenticado() ? true : router.createUrlTree(['/login']);
};
