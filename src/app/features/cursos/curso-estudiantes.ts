import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TEXTOS } from '../../shared/textos';
import { CursosApi, mensajeErrorCursos } from './cursos-api';
import { CursoDTO, EstudianteElegibleDTO, InscripcionDTO, PaginaDTO } from './modelos';
import { PaginacionCursos } from './paginacion';
import { vigilarSesionCursos } from './sesion-cursos';

@Component({
  selector: 'app-curso-estudiantes',
  imports: [RouterLink, ReactiveFormsModule, PaginacionCursos],
  templateUrl: './curso-estudiantes.html',
  styleUrl: './cursos.css',
})
export class CursoEstudiantes {
  readonly textos = TEXTOS.cursos;
  readonly curso = signal<CursoDTO | null>(null);
  readonly inscritos = signal<PaginaDTO<InscripcionDTO> | null>(null);
  readonly estudiantes = signal<PaginaDTO<EstudianteElegibleDTO> | null>(null);
  readonly ocupado = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');
  private readonly api = inject(CursosApi);
  private readonly cursoId = inject(ActivatedRoute).snapshot.paramMap.get('cursoId')!;
  private readonly fb = inject(FormBuilder);
  readonly inscripcion = this.fb.nonNullable.group({ estudiante: ['', Validators.required] });
  readonly buscarEstudiante = this.fb.nonNullable.group({ texto: ['', Validators.maxLength(120)] });
  private filtroEstudiantes = '';
  private readonly errorAcceso = vigilarSesionCursos('CATEDRATICO', () => this.limpiar());

  constructor() {
    void this.cargar();
  }

  async cargar() {
    await this.operar(async () => {
      this.limpiar();
      this.curso.set(await firstValueFrom(this.api.obtener(this.cursoId)));
      const [inscritos, estudiantes] = await Promise.all([
        firstValueFrom(this.api.inscripciones(this.cursoId)),
        firstValueFrom(this.api.estudiantes(0, this.filtroEstudiantes)),
      ]);
      this.inscritos.set(inscritos);
      this.estudiantes.set(estudiantes);
    });
  }

  async inscribir() {
    if (this.inscripcion.invalid || !this.curso()?.vigente || this.ocupado()) return;
    await this.operar(async () => {
      await firstValueFrom(
        this.api.inscribir(this.cursoId, this.inscripcion.controls.estudiante.value),
      );
      this.inscripcion.reset();
      this.inscritos.set(await firstValueFrom(this.api.inscripciones(this.cursoId)));
      this.estudiantes.set(
        await firstValueFrom(
          this.api.estudiantes(this.estudiantes()?.number ?? 0, this.filtroEstudiantes),
        ),
      );
      this.mensaje.set(this.textos.inscrito);
    });
  }

  async paginar(tipo: 'inscritos' | 'estudiantes', numero: number) {
    await this.operar(async () => {
      if (tipo === 'inscritos') {
        this.inscritos.set(await firstValueFrom(this.api.inscripciones(this.cursoId, numero)));
      } else {
        this.estudiantes.set(
          await firstValueFrom(this.api.estudiantes(numero, this.filtroEstudiantes)),
        );
        this.inscripcion.reset();
      }
    });
  }

  async buscar() {
    this.buscarEstudiante.markAllAsTouched();
    if (this.buscarEstudiante.invalid) return;
    const texto = this.buscarEstudiante.controls.texto.value.trim();
    await this.operar(async () => {
      this.estudiantes.set(await firstValueFrom(this.api.estudiantes(0, texto)));
      this.filtroEstudiantes = texto;
      this.inscripcion.reset();
    });
  }

  private limpiar() {
    this.curso.set(null);
    this.inscritos.set(null);
    this.estudiantes.set(null);
    this.inscripcion.reset();
    this.mensaje.set('');
  }

  private async operar(accion: () => Promise<void>) {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.error.set('');
    this.mensaje.set('');
    try {
      await accion();
    } catch (error) {
      this.errorAcceso(error);
      this.error.set(mensajeErrorCursos(error));
    } finally {
      this.ocupado.set(false);
    }
  }
}
