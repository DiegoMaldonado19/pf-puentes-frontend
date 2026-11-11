import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TEXTOS } from '../../shared/textos';
import { CursosApi, mensajeErrorCursos } from './cursos-api';
import { CursoDTO, PaginaDTO } from './modelos';
import { PaginacionCursos } from './paginacion';
import { vigilarSesionCursos } from './sesion-cursos';

@Component({
  selector: 'app-cursos-lista',
  imports: [RouterLink, PaginacionCursos],
  templateUrl: './cursos-lista.html',
  styleUrl: './cursos.css',
})
export class CursosLista {
  readonly textos = TEXTOS.cursos;
  readonly pagina = signal<PaginaDTO<CursoDTO> | null>(null);
  readonly ocupado = signal(false);
  readonly error = signal('');
  readonly busqueda = signal('');
  readonly cursosFiltrados = computed(() => {
    const datos = this.pagina()?.content ?? [];
    const termino = this.busqueda().trim().toLowerCase();
    if (!termino) return datos;
    return datos.filter((curso) =>
      [curso.nombre, String(curso.anio), String(curso.semestre)]
        .join(' ')
        .toLowerCase()
        .includes(termino),
    );
  });
  private readonly api = inject(CursosApi);
  private readonly errorAcceso = vigilarSesionCursos('CATEDRATICO', () => this.pagina.set(null));

  constructor() {
    void this.cargar();
  }

  async cargar(numero = 0) {
    this.ocupado.set(true);
    this.error.set('');
    try {
      this.pagina.set(await firstValueFrom(this.api.listar(numero)));
    } catch (error) {
      this.errorAcceso(error);
      this.error.set(mensajeErrorCursos(error));
    } finally {
      this.ocupado.set(false);
    }
  }

  actualizarBusqueda(valor: string): void {
    this.busqueda.set(valor);
  }
}
