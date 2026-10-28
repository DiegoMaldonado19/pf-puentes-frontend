import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { map } from 'rxjs';
import { TEXTOS } from '../../shared/textos';
import { MencionesP2, PersonaMencion, SESION_P2 } from './puertos';

@Injectable({ providedIn: 'root' })
export class MencionesForoHttp implements MencionesP2 {
  readonly disponible = true;
  readonly personas = signal<readonly PersonaMencion[]>([]);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  private readonly http = inject(HttpClient);
  private readonly sesion = inject(SESION_P2);
  private solicitada = false;

  cargar(): void {
    if (this.solicitada || !this.sesion.usuarioId()) {
      return;
    }
    this.solicitada = true;
    this.cargando.set(true);
    this.http
      .get<{ id: string; nombre: string }[]>('/api/v1/usuarios/mencionables')
      .pipe(map((usuarios) => usuarios.map(({ id, nombre }) => ({ id, etiqueta: nombre }))))
      .subscribe({
        next: (personas) => {
          this.personas.set(personas);
          this.cargando.set(false);
        },
        error: (causa: unknown) => {
          console.error('No se pudieron cargar los usuarios mencionables', causa);
          this.error.set(TEXTOS.menciones.error);
          this.cargando.set(false);
        },
      });
  }
}
