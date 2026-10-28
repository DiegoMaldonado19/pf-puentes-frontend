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
import { AccesoLocal, crearAccesoLocal } from './offline/acceso-local';
import { proveerPreparacionLocal } from './offline/proveedores-preparacion';
import { proveerSync } from './offline/proveedores-sync';
import { MotorSync } from './offline/motor-sync';
import { ROL_PUENTES } from './features/puentes/rol-puentes';
import { MENCIONES_P2, SESION_P2 } from './features/foro/puertos';
import { MencionesForoHttp } from './features/foro/menciones-foro-http';
import { crearSesionForo } from './features/foro/sesion-foro';
import { proveerSesionCursos } from './features/cursos/sesion-cursos';
import { crearSesionCursosAuth } from './features/cursos/sesion-cursos-auth';

export async function inicializarSesion(): Promise<void> {
  // Suscribir revocación antes de que la hidratación pueda cambiar la identidad.
  const acceso = inject(AccesoLocal);
  const auth = inject(AuthService);
  await firstValueFrom(auth.hidratarAlArrancar());
  // Al arrancar P2 aún no tenía usuario anterior para emitir «cambio».
  await acceso.reconciliarAlArrancar();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor, erroresInterceptor])),
    provideRouter(routes, withComponentInputBinding()),
    { provide: AccesoLocal, useFactory: crearAccesoLocal },
    proveerPreparacionLocal,
    proveerSync,
    provideAppInitializer(inicializarSesion),
    provideAppInitializer(() => inject(MotorSync).iniciar()),
    { provide: ROL_PUENTES, useFactory: () => inject(AuthService).rol },
    { provide: SESION_P2, useFactory: crearSesionForo },
    { provide: MENCIONES_P2, useExisting: MencionesForoHttp },
    proveerSesionCursos(crearSesionCursosAuth),
    provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode() }),
  ],
};
