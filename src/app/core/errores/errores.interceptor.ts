import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { mensajeDeProblema } from './problema';

/** Adjunta el mensaje de UI sin sustituir el HttpErrorResponse (P3 y P8 leen status). */
export const mensajeAdjuntado = new WeakMap<HttpErrorResponse, string>();

export const erroresInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        mensajeAdjuntado.set(error, mensajeDeProblema(error));
      }
      return throwError(() => error);
    }),
  );
