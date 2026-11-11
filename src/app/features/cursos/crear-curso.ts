import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TEXTOS } from '../../shared/textos';
import { CursosApi, mensajeErrorCursos } from './cursos-api';
import { FormularioCurso } from './formulario-curso';
import { GuardarCursoDTO } from './modelos';
import { vigilarSesionCursos } from './sesion-cursos';

@Component({
  selector: 'app-crear-curso',
  imports: [RouterLink, FormularioCurso],
  templateUrl: './crear-curso.html',
  styleUrl: './cursos.css',
})
export class CrearCurso {
  readonly textos = TEXTOS.cursos;
  readonly ocupado = signal(false);
  readonly error = signal('');
  private readonly api = inject(CursosApi);
  private readonly router = inject(Router);
  private readonly errorAcceso = vigilarSesionCursos('CATEDRATICO', () => {
    this.ocupado.set(false);
  });

  async crear(datos: GuardarCursoDTO) {
    this.ocupado.set(true);
    this.error.set('');
    try {
      const curso = await firstValueFrom(this.api.crear(datos));
      await this.router.navigate(['/cursos', curso.id]);
    } catch (error) {
      this.errorAcceso(error);
      this.error.set(mensajeErrorCursos(error));
    } finally {
      this.ocupado.set(false);
    }
  }
}
