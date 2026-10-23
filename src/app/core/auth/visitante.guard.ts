import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth';

export const visitanteGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await firstValueFrom(auth.hidratarAlArrancar());
  return auth.autenticado() ? router.createUrlTree([auth.destinoTrasLogin()]) : true;
};
