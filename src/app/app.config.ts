import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth';
import { authInterceptor } from './core/auth/auth.interceptor';
import { erroresInterceptor } from './core/errores/errores.interceptor';
import { ROL_PUENTES } from './features/puentes/rol-puentes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(
      withInterceptors([
        authInterceptor,
        erroresInterceptor,
        // offlineInterceptor (P6) va después, cuando exista; no se inventa aquí.
      ]),
    ),
    provideRouter(routes, withComponentInputBinding()),
    provideAppInitializer(() => firstValueFrom(inject(AuthService).hidratarAlArrancar())),
    { provide: ROL_PUENTES, useFactory: () => inject(AuthService).rol },
    provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode() }),
  ],
};
