import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TEXTOS } from '../../shared/textos';
import { CursosApi, mensajeErrorCursos } from './cursos-api';
import { FormularioCurso } from './formulario-curso';
import { CursoDTO, GuardarCursoDTO } from './modelos';
import { vigilarSesionCursos } from './sesion-cursos';

@Component({
  selector: 'app-curso-detalle',
  imports: [RouterLink, FormularioCurso],
  templateUrl: './curso-detalle.html',
  styleUrl: './cursos.css',
})
export class CursoDetalle {
  readonly textos = TEXTOS.cursos;
  readonly curso = signal<CursoDTO | null>(null);
  readonly ocupado = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');
  private readonly api = inject(CursosApi);
  private readonly cursoId = inject(ActivatedRoute).snapshot.paramMap.get('cursoId')!;
  private readonly errorAcceso = vigilarSesionCursos('CATEDRATICO', () => this.curso.set(null));

  constructor() {
    void this.cargar();
  }

  async cargar() {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.error.set('');
    this.mensaje.set('');
    try {
      this.curso.set(await firstValueFrom(this.api.obtener(this.cursoId)));
    } catch (error) {
      this.errorAcceso(error);
      this.error.set(mensajeErrorCursos(error));
    } finally {
      this.ocupado.set(false);
    }
  }

  async guardar(datos: GuardarCursoDTO) {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.error.set('');
    this.mensaje.set('');
    try {
      this.curso.set(await firstValueFrom(this.api.actualizar(this.cursoId, datos)));
      this.mensaje.set(this.textos.guardado);
    } catch (error) {
      this.errorAcceso(error);
      this.error.set(mensajeErrorCursos(error));
    } finally {
      this.ocupado.set(false);
    }
  }
}
