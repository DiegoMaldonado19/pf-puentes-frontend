import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  catchError,
  defer,
  finalize,
  map,
  Observable,
  of,
  shareReplay,
  Subject,
  tap,
  throwError,
} from 'rxjs';
import { Rol, SesionDTO, UsuarioSesionDTO } from './modelos';

const API_AUTH = '/api/v1/auth';

export interface EventoSesion {
  tipo: 'login' | 'cierre' | 'cambio' | 'red' | 'invalida';
  propietario_id: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  readonly accessToken = signal<string | null>(null);
  readonly usuario = signal<UsuarioSesionDTO | null>(null);
  readonly rol = computed<Rol | null>(() => this.usuario()?.rol ?? null);
  readonly autenticado = computed(() => this.accessToken() !== null && this.usuario() !== null);
  readonly esGestorMantenimiento = computed(
    () => this.rol() === 'ADMINISTRADOR' || this.rol() === 'CATEDRATICO',
  );
  readonly listo = signal(false);
  readonly errorRenovacion = signal<string | null>(null);
  private readonly eventos = new Subject<EventoSesion>();
  /** Eventos síncronos; acceso local y autorización remota son responsabilidades separadas. */
  readonly eventosSesion = this.eventos.asObservable();
  private generacion = 0;
  private renovacion: Observable<SesionDTO | null> | null = null;
  private hidratacion: Observable<void> | null = null;

  iniciarSesion(correo: string, contrasena: string): Observable<SesionDTO> {
    return this.http
      .post<SesionDTO>(
        `${API_AUTH}/login`,
        { correo: correo.trim().toLowerCase(), contrasena },
        { withCredentials: true },
      )
      .pipe(
        tap((sesion) => {
          this.guardar(sesion);
          this.eventos.next({ tipo: 'login', propietario_id: sesion.usuario.id });
        }),
      );
  }

  renovar(): Observable<SesionDTO | null> {
    if (!this.renovacion) {
      const generacion = this.generacion;
      const renovacion = this.http
        .post<SesionDTO>(`${API_AUTH}/renovar`, {}, { withCredentials: true })
        .pipe(
          map((sesion) => {
            if (generacion !== this.generacion) return null;
            this.guardar(sesion);
            return sesion;
          }),
          catchError((error: unknown) => {
            if (generacion !== this.generacion) return of(null);
            if (error instanceof HttpErrorResponse && [401, 403].includes(error.status)) {
              this.invalidar('invalida');
              return of(null);
            }
            this.errorRenovacion.set(
              'No se pudo renovar la sesión. Se conserva el acceso local; reintenta al recuperar la conexión.',
            );
            this.eventos.next({ tipo: 'red', propietario_id: this.usuario()?.id ?? null });
            return throwError(() => error);
          }),
          finalize(() => {
            if (this.renovacion === renovacion) this.renovacion = null;
          }),
          shareReplay(1),
        );
      this.renovacion = renovacion;
    }
    return this.renovacion;
  }

  hidratarAlArrancar(): Observable<void> {
    if (this.listo()) return of(undefined);
    if (!this.hidratacion) {
      this.hidratacion = this.renovar().pipe(
        catchError(() => of(null)),
        map(() => undefined),
        tap(() => this.listo.set(true)),
        tap({
          complete: () => {
            this.hidratacion = null;
          },
        }),
        shareReplay(1),
      );
    }
    return this.hidratacion;
  }

  cerrarSesion(): Observable<void> {
    return defer(() => {
      this.cerrarSesionLocal();
      return this.http.post(`${API_AUTH}/cerrar-sesion`, {}, { withCredentials: true }).pipe(
        catchError(() => of(null)),
        tap(() => void this.router.navigateByUrl('/puentes')),
        map(() => undefined),
      );
    });
  }

  cerrarSesionLocal(): void {
    this.invalidar('cierre');
  }

  private invalidar(tipo: EventoSesion['tipo']): void {
    this.errorRenovacion.set(null);
    const propietario_id = this.usuario()?.id ?? null;
    this.generacion++;
    this.renovacion = null;
    this.accessToken.set(null);
    this.usuario.set(null);
    this.eventos.next({ tipo, propietario_id });
  }

  destinoTrasLogin(): string {
    return this.rol() === 'ADMINISTRADOR' ? '/admin/usuarios' : '/puentes';
  }

  private guardar(sesion: SesionDTO): void {
    this.errorRenovacion.set(null);
    const anterior = this.usuario()?.id;
    // Un login también invalida renovaciones previas, aunque sea del mismo propietario.
    this.generacion++;
    this.renovacion = null;
    if (anterior && anterior !== sesion.usuario.id)
      this.eventos.next({ tipo: 'cambio', propietario_id: anterior });
    this.accessToken.set(sesion.access_token);
    this.usuario.set(sesion.usuario);
    this.listo.set(true);
  }
}
