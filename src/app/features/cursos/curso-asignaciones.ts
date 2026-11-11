import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TEXTOS } from '../../shared/textos';
import { CursosApi, mensajeErrorCursos } from './cursos-api';
import {
  AsignacionDTO,
  CursoDTO,
  InscripcionDTO,
  PaginaDTO,
  PuenteDisponibleDTO,
} from './modelos';
import { PaginacionCursos } from './paginacion';
import { vigilarSesionCursos } from './sesion-cursos';

@Component({
  selector: 'app-curso-asignaciones',
  imports: [RouterLink, ReactiveFormsModule, PaginacionCursos],
  templateUrl: './curso-asignaciones.html',
  styleUrl: './cursos.css',
})
export class CursoAsignaciones {
  readonly textos = TEXTOS.cursos;
  readonly curso = signal<CursoDTO | null>(null);
  readonly inscritos = signal<PaginaDTO<InscripcionDTO> | null>(null);
  readonly puentes = signal<PaginaDTO<PuenteDisponibleDTO> | null>(null);
  readonly asignaciones = signal<PaginaDTO<AsignacionDTO> | null>(null);
  readonly seleccionada = signal<InscripcionDTO | null>(null);
  readonly ocupado = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');
  private readonly api = inject(CursosApi);
  private readonly cursoId = inject(ActivatedRoute).snapshot.paramMap.get('cursoId')!;
  private readonly fb = inject(FormBuilder);
  readonly asignacion = this.fb.nonNullable.group({ puente: ['', Validators.required] });
  readonly buscarPuente = this.fb.nonNullable.group({ texto: ['', Validators.maxLength(120)] });
  private filtroPuentes = '';
  private readonly errorAcceso = vigilarSesionCursos('CATEDRATICO', () => this.limpiar());

  constructor() {
    void this.cargar();
  }

  async cargar() {
    await this.operar(async () => {
      this.limpiar();
      this.curso.set(await firstValueFrom(this.api.obtener(this.cursoId)));
      const [inscritos, puentes] = await Promise.all([
        firstValueFrom(this.api.inscripciones(this.cursoId)),
        firstValueFrom(this.api.puentes(0, this.filtroPuentes)),
      ]);
      this.inscritos.set(inscritos);
      this.puentes.set(puentes);
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

  async paginar(tipo: 'inscritos' | 'puentes' | 'asignaciones', numero: number) {
    await this.operar(async () => {
      switch (tipo) {
        case 'inscritos':
          this.inscritos.set(await firstValueFrom(this.api.inscripciones(this.cursoId, numero)));
          break;
        case 'puentes':
          this.puentes.set(await firstValueFrom(this.api.puentes(numero, this.filtroPuentes)));
          this.asignacion.reset();
          break;
        case 'asignaciones': {
          const seleccionada = this.seleccionada();
          if (seleccionada) {
            this.asignaciones.set(
              await firstValueFrom(this.api.asignaciones(this.cursoId, seleccionada.id, numero)),
            );
          }
        }
      }
    });
  }

  async buscar() {
    this.buscarPuente.markAllAsTouched();
    if (this.buscarPuente.invalid) return;
    const texto = this.buscarPuente.controls.texto.value.trim();
    await this.operar(async () => {
      this.puentes.set(await firstValueFrom(this.api.puentes(0, texto)));
      this.filtroPuentes = texto;
      this.asignacion.reset();
    });
  }

  private limpiar() {
    this.curso.set(null);
    this.inscritos.set(null);
    this.puentes.set(null);
    this.seleccionada.set(null);
    this.asignaciones.set(null);
    this.asignacion.reset();
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
