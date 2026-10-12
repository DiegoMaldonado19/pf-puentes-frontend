import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TEXTOS } from '../../shared/textos';
import { CursosApi, mensajeErrorCursos } from './cursos-api';
import { FormularioCurso } from './formulario-curso';
import {
  AsignacionDTO,
  CursoDTO,
  EstudianteElegibleDTO,
  GuardarCursoDTO,
  InscripcionDTO,
  PaginaDTO,
  PuenteDisponibleDTO,
} from './modelos';
import { PaginacionCursos } from './paginacion';

@Component({
  selector: 'app-curso-detalle',
  imports: [RouterLink, ReactiveFormsModule, FormularioCurso, PaginacionCursos],
  templateUrl: './curso-detalle.html',
  styleUrl: './cursos.css',
})
export class CursoDetalle {
  readonly textos = TEXTOS.cursos;
  readonly curso = signal<CursoDTO | null>(null);
  readonly inscritos = signal<PaginaDTO<InscripcionDTO> | null>(null);
  readonly estudiantes = signal<PaginaDTO<EstudianteElegibleDTO> | null>(null);
  readonly puentes = signal<PaginaDTO<PuenteDisponibleDTO> | null>(null);
  readonly asignaciones = signal<PaginaDTO<AsignacionDTO> | null>(null);
  readonly seleccionada = signal<InscripcionDTO | null>(null);
  readonly ocupado = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');
  private readonly api = inject(CursosApi);
  private readonly cursoId = inject(ActivatedRoute).snapshot.paramMap.get('cursoId')!;
  private readonly fb = inject(FormBuilder);
  readonly inscripcion = this.fb.nonNullable.group({ estudiante: ['', Validators.required] });
  readonly asignacion = this.fb.nonNullable.group({ puente: ['', Validators.required] });
  readonly buscarEstudiante = this.fb.nonNullable.group({ texto: ['', Validators.maxLength(120)] });
  readonly buscarPuente = this.fb.nonNullable.group({ texto: ['', Validators.maxLength(120)] });
  private filtroEstudiantes = '';
  private filtroPuentes = '';

  constructor() {
    void this.cargar();
  }

  async cargar() {
    await this.operar(async () => {
      this.curso.set(null);
      this.inscritos.set(null);
      this.estudiantes.set(null);
      this.puentes.set(null);
      this.seleccionada.set(null);
      this.asignaciones.set(null);
      this.inscripcion.reset();
      this.asignacion.reset();
      this.curso.set(await firstValueFrom(this.api.obtener(this.cursoId)));
      const [inscritos, estudiantes, puentes] = await Promise.all([
        firstValueFrom(this.api.inscripciones(this.cursoId)),
        firstValueFrom(this.api.estudiantes(0, this.filtroEstudiantes)),
        firstValueFrom(this.api.puentes(0, this.filtroPuentes)),
      ]);
      this.inscritos.set(inscritos);
      this.estudiantes.set(estudiantes);
      this.puentes.set(puentes);
    });
  }

  async guardar(datos: GuardarCursoDTO) {
    await this.operar(async () => {
      this.curso.set(await firstValueFrom(this.api.actualizar(this.cursoId, datos)));
      this.mensaje.set(this.textos.guardado);
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

  async seleccionar(inscripcion: InscripcionDTO) {
    await this.operar(async () => {
      this.seleccionada.set(null);
      this.asignaciones.set(null);
      this.asignacion.reset();
      const datos = await firstValueFrom(this.api.asignaciones(this.cursoId, inscripcion.id));
      this.seleccionada.set(inscripcion);
      this.asignaciones.set(datos);
    });
  }

  async asignar() {
    const inscrito = this.seleccionada();
    if (!inscrito || this.asignacion.invalid || !this.curso()?.vigente || this.ocupado()) return;
    await this.operar(async () => {
      await firstValueFrom(
        this.api.asignar(this.cursoId, inscrito.id, this.asignacion.controls.puente.value),
      );
      this.asignacion.reset();
      this.asignaciones.set(await firstValueFrom(this.api.asignaciones(this.cursoId, inscrito.id)));
      this.mensaje.set(this.textos.asignado);
    });
  }

  async paginar(tipo: 'inscritos' | 'estudiantes' | 'puentes' | 'asignaciones', numero: number) {
    await this.operar(async () => {
      switch (tipo) {
        case 'inscritos':
          this.inscritos.set(await firstValueFrom(this.api.inscripciones(this.cursoId, numero)));
          break;
        case 'estudiantes':
          this.estudiantes.set(
            await firstValueFrom(this.api.estudiantes(numero, this.filtroEstudiantes)),
          );
          this.inscripcion.reset();
          break;
        case 'puentes':
          this.puentes.set(await firstValueFrom(this.api.puentes(numero, this.filtroPuentes)));
          this.asignacion.reset();
          break;
        case 'asignaciones': {
          const seleccionada = this.seleccionada();
          if (seleccionada)
            this.asignaciones.set(
              await firstValueFrom(this.api.asignaciones(this.cursoId, seleccionada.id, numero)),
            );
        }
      }
    });
  }

  async buscar(tipo: 'estudiantes' | 'puentes') {
    const formulario = tipo === 'estudiantes' ? this.buscarEstudiante : this.buscarPuente;
    formulario.markAllAsTouched();
    if (formulario.invalid) return;
    const texto = formulario.controls.texto.value.trim();
    await this.operar(async () => {
      if (tipo === 'estudiantes') {
        this.estudiantes.set(await firstValueFrom(this.api.estudiantes(0, texto)));
        this.filtroEstudiantes = texto;
        this.inscripcion.reset();
      } else {
        this.puentes.set(await firstValueFrom(this.api.puentes(0, texto)));
        this.filtroPuentes = texto;
        this.asignacion.reset();
      }
    });
  }

  private async operar(accion: () => Promise<void>) {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.error.set('');
    this.mensaje.set('');
    try {
      await accion();
    } catch (error) {
      this.error.set(mensajeErrorCursos(error));
    } finally {
      this.ocupado.set(false);
    }
  }
}
