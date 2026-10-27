import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TEXTOS } from '../../shared/textos';
import { CursosApi, mensajeErrorCursos } from './cursos-api';
import { AsignacionDTO, PaginaDTO } from './modelos';
import { PaginacionCursos } from './paginacion';
import { vigilarSesionCursos } from './sesion-cursos';

@Component({
  selector: 'app-mis-asignaciones',
  imports: [DatePipe, PaginacionCursos],
  template: `
    <section [attr.aria-busy]="ocupado()">
      <h1>{{ textos.misAsignaciones }}</h1>
      <p class="descripcion">{{ textos.asignacionesPropiasDescripcion }}</p>
      @if (error()) {
        <p role="alert">{{ error() }}</p>
        <button type="button" [disabled]="ocupado()" (click)="cargar()">
          {{ textos.reintentar }}
        </button>
      }
      @if (ocupado()) {
        <p role="status">{{ textos.cargando }}</p>
      }
      @if (pagina(); as datos) {
        <ul class="tarjetas-cursos">
          @for (asignacion of datos.content; track asignacion.id) {
            <li>
              <h2>
                {{ asignacion.puente_nombre || asignacion.puente_codigo || asignacion.puente_id }}
              </h2>
              <p class="codigo-puente">{{ asignacion.puente_codigo || asignacion.puente_id }}</p>
              <dl>
                <div>
                  <dt>{{ textos.cursoId }}</dt>
                  <dd>{{ asignacion.curso_nombre || asignacion.curso_id }}</dd>
                </div>
                <div>
                  <dt>{{ textos.fechaAsignacion }}</dt>
                  <dd>{{ asignacion.creado_en | date: 'dd/MM/yyyy' : '-0600' }}</dd>
                </div>
              </dl>
            </li>
          } @empty {
            <li>{{ textos.sinAsignaciones }}</li>
          }
        </ul>
        <app-paginacion-cursos
          [etiqueta]="textos.misAsignaciones"
          [pagina]="datos.number"
          [paginas]="datos.total_pages"
          [ocupado]="ocupado()"
          (cambio)="cargar($event)"
        />
      }
    </section>
  `,
  styleUrl: './cursos.css',
})
export class MisAsignaciones {
  readonly textos = TEXTOS.cursos;
  readonly pagina = signal<PaginaDTO<AsignacionDTO> | null>(null);
  readonly ocupado = signal(false);
  readonly error = signal('');
  private readonly api = inject(CursosApi);
  private readonly errorAcceso = vigilarSesionCursos('ESTUDIANTE', () => this.pagina.set(null));
  constructor() {
    void this.cargar();
  }
  async cargar(numero = 0) {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.error.set('');
    try {
      this.pagina.set(await firstValueFrom(this.api.propias(numero)));
    } catch (error) {
      this.errorAcceso(error);
      this.error.set(mensajeErrorCursos(error));
    } finally {
      this.ocupado.set(false);
    }
  }
}
