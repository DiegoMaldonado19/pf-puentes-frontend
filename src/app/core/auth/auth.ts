import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, map, Observable, of, shareReplay, tap } from 'rxjs';
import { Rol, SesionDTO, UsuarioSesionDTO } from './modelos';

const API_AUTH = '/api/v1/auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  readonly accessToken = signal<string | null>(null);
  readonly usuario = signal<UsuarioSesionDTO | null>(null);
  readonly rol = computed<Rol | null>(() => this.usuario()?.rol ?? null);
  readonly autenticado = computed(() => this.accessToken() !== null && this.usuario() !== null);
  readonly listo = signal(false);
  private renovacion: Observable<SesionDTO | null> | null = null;
  private hidratacion: Observable<void> | null = null;

  iniciarSesion(correo: string, contrasena: string): Observable<SesionDTO> {
    return this.http
      .post<SesionDTO>(
        `${API_AUTH}/login`,
        { correo: correo.trim().toLowerCase(), contrasena },
        { withCredentials: true },
      )
      .pipe(tap((sesion) => this.guardar(sesion)));
  }

  renovar(): Observable<SesionDTO | null> {
    if (!this.renovacion) {
      this.renovacion = this.http
        .post<SesionDTO>(`${API_AUTH}/renovar`, {}, { withCredentials: true })
        .pipe(
          tap((sesion) => this.guardar(sesion)),
          catchError(() => {
            this.cerrarSesionLocal();
            return of(null);
          }),
          tap({
            complete: () => {
              this.renovacion = null;
            },
          }),
          shareReplay(1),
        );
    }
    return this.renovacion;
  }

  hidratarAlArrancar(): Observable<void> {
    if (this.listo()) return of(undefined);
    if (!this.hidratacion) {
      this.hidratacion = this.renovar().pipe(
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
    return this.http.post(`${API_AUTH}/cerrar-sesion`, {}, { withCredentials: true }).pipe(
      catchError(() => of(null)),
      tap(() => this.cerrarSesionLocal()),
      tap(() => void this.router.navigateByUrl('/puentes')),
      map(() => undefined),
    );
  }

  cerrarSesionLocal(): void {
    this.accessToken.set(null);
    this.usuario.set(null);
  }

  destinoTrasLogin(): string {
    return this.rol() === 'ADMINISTRADOR' ? '/admin/usuarios' : '/puentes';
  }

  private guardar(sesion: SesionDTO): void {
    this.accessToken.set(sesion.access_token);
    this.usuario.set(sesion.usuario);
    this.listo.set(true);
  }
}
