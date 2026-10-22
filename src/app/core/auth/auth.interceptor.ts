import {
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth';
import { rutaExigeSesion } from './rutas-sesion';

const REINTENTO_TRAS_RENOVAR = new HttpContextToken(() => false);

function esApi(url: string): boolean {
  return url.startsWith('/api');
}

function noRenovar(url: string): boolean {
  return /\/api\/v1\/auth\/(login|renovar|cerrar-sesion)(?:\?|$)/.test(url);
}

function preparar(
  req: HttpRequest<unknown>,
  auth: AuthService,
  reintento = false,
): HttpRequest<unknown> {
  let siguiente = req;
  if (esApi(req.url) && !req.withCredentials) {
    siguiente = siguiente.clone({ withCredentials: true });
  }
  const token = auth.accessToken();
  if (token) {
    siguiente = siguiente.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  if (reintento) {
    siguiente = siguiente.clone({ context: siguiente.context.set(REINTENTO_TRAS_RENOVAR, true) });
  }
  return siguiente;
}

/** Bearer + withCredentials. El offlineInterceptor de P6, si llega, va después de errores. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const enviada = preparar(req, auth);
  return next(enviada).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        noRenovar(enviada.url) ||
        enviada.context.get(REINTENTO_TRAS_RENOVAR) ||
        !enviada.headers.has('Authorization')
      ) {
        return throwError(() => error);
      }
      return auth.renovar().pipe(
        switchMap((sesion) => {
          if (!sesion) {
            if (rutaExigeSesion(router.url)) void router.navigateByUrl('/login');
            return throwError(() => error);
          }
          return next(preparar(req, auth, true));
        }),
      );
    }),
  );
};
