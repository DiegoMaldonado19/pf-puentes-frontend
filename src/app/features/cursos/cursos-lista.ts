import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TEXTOS } from '../../shared/textos';
import { CursosApi, mensajeErrorCursos } from './cursos-api';
import { FormularioCurso } from './formulario-curso';
import { CursoDTO, GuardarCursoDTO, PaginaDTO } from './modelos';
import { PaginacionCursos } from './paginacion';

@Component({
  selector: 'app-cursos-lista',
  imports: [RouterLink, FormularioCurso, PaginacionCursos],
  templateUrl: './cursos-lista.html',
  styleUrl: './cursos.css',
})
export class CursosLista {
  readonly textos = TEXTOS.cursos;
  readonly pagina = signal<PaginaDTO<CursoDTO> | null>(null);
  readonly ocupado = signal(false);
  readonly error = signal('');
  private readonly api = inject(CursosApi);
  private readonly router = inject(Router);

  constructor() {
    void this.cargar();
  }

  async cargar(numero = 0) {
    this.ocupado.set(true);
    this.error.set('');
    try {
      this.pagina.set(await firstValueFrom(this.api.listar(numero)));
    } catch (error) {
      this.error.set(mensajeErrorCursos(error));
    } finally {
      this.ocupado.set(false);
    }
  }

  async crear(datos: GuardarCursoDTO) {
    this.ocupado.set(true);
    this.error.set('');
    try {
      const curso = await firstValueFrom(this.api.crear(datos));
      await this.router.navigate(['/cursos', curso.id]);
    } catch (error) {
      this.error.set(mensajeErrorCursos(error));
    } finally {
      this.ocupado.set(false);
    }
  }
}
