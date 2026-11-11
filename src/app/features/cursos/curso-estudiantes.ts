import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';
import { TEXTOS } from '../../shared/textos';
import { CursosApi, mensajeErrorCursos } from './cursos-api';
import { AsignacionDTO, CursoDTO, EstudianteElegibleDTO, InscripcionDTO } from './modelos';
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
  readonly inscritos = signal<InscripcionDTO[]>([]);
  readonly paginaInscritos = signal(0);
  readonly paginasInscritos = signal(0);
  readonly busquedaInscritos = signal('');
  readonly inscritosFiltrados = computed(() => {
    const termino = this.busquedaInscritos().trim().toLowerCase();
    if (!termino) return this.inscritos();
    return this.inscritos().filter((i) =>
      [i.estudiante_nombre ?? '', i.estudiante_id].join(' ').toLowerCase().includes(termino),
    );
  });
  readonly elegibles = signal<EstudianteElegibleDTO[]>([]);
  readonly textoElegible = signal('');
  readonly mostrarOpcionesElegibles = signal(false);
  readonly ocupado = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');
  readonly modalInscripcionAbierto = signal(false);
  readonly inscritoDetalle = signal<InscripcionDTO | null>(null);
  readonly puentesAsignados = signal<AsignacionDTO[]>([]);
  readonly cargandoDetalle = signal(false);

  private readonly api = inject(CursosApi);
  private readonly cursoId = inject(ActivatedRoute).snapshot.paramMap.get('cursoId')!;
  private readonly fb = inject(FormBuilder);
  readonly inscripcion = this.fb.nonNullable.group({ estudiante: ['', Validators.required] });
  private filtroEstudiantes = '';
  private readonly errorAcceso = vigilarSesionCursos('CATEDRATICO', () => this.limpiar());

  constructor() {
    void this.cargar();
  }

  async cargar() {
    await this.operar(async () => {
      this.limpiar();
      this.curso.set(await firstValueFrom(this.api.obtener(this.cursoId)));
      await this.cargarInscritos();
      await this.buscarElegibles('');
    });
  }

  private async cargarInscritos() {
    const todos = await this.obtenerTodasLasPaginas((p) => this.api.inscripciones(this.cursoId, p));
    this.inscritos.set(todos.content);
    this.paginaInscritos.set(0);
    this.paginasInscritos.set(1);
  }

  private async obtenerTodasLasPaginas<T>(
    cargar: (pagina: number) => Observable<{ content: T[]; number: number; total_pages: number }>,
  ): Promise<{ content: T[]; number: number; total_pages: number }> {
    const primera = await firstValueFrom(cargar(0));
    const contenido = [...primera.content];
    for (let p = 1; p < (primera.total_pages || 0); p++) {
      const sig = await firstValueFrom(cargar(p));
      contenido.push(...sig.content);
    }
    return { content: contenido, number: 0, total_pages: primera.total_pages };
  }

  abrirModalInscripcion(): void {
    if (!this.curso()?.vigente) return;
    this.error.set('');
    this.mensaje.set('');
    this.textoElegible.set('');
    this.inscripcion.reset();
    this.mostrarOpcionesElegibles.set(false);
    this.modalInscripcionAbierto.set(true);
    void this.buscarElegibles('');
  }

  cerrarModalInscripcion(): void {
    this.modalInscripcionAbierto.set(false);
    this.mostrarOpcionesElegibles.set(false);
  }

  async buscarElegibles(texto: string) {
    const valor = texto.trim().slice(0, 120);
    this.textoElegible.set(texto);
    this.filtroEstudiantes = valor;
    this.inscripcion.controls.estudiante.setValue('');
    try {
      const res = await firstValueFrom(this.api.estudiantes(0, valor));
      this.elegibles.set(res.content);
      this.mostrarOpcionesElegibles.set(true);
    } catch (error) {
      this.errorAcceso(error);
      this.error.set(mensajeErrorCursos(error));
    }
  }

  seleccionarElegible(estudiante: EstudianteElegibleDTO) {
    this.inscripcion.controls.estudiante.setValue(estudiante.id);
    this.textoElegible.set(estudiante.nombre);
    this.mostrarOpcionesElegibles.set(false);
  }

  abrirOpcionesElegibles() {
    this.mostrarOpcionesElegibles.set(true);
    if (!this.elegibles().length && !this.textoElegible().trim()) {
      void this.buscarElegibles('');
    }
  }

  ocultarOpcionesElegibles() {
    setTimeout(() => this.mostrarOpcionesElegibles.set(false), 150);
  }

  nombreInscrito(inscrito: InscripcionDTO): string {
    return (inscrito.estudiante_nombre || '').trim() || 'No disponible';
  }

  fechaInscripcion(fecha: string): string {
    if (!fecha) return 'No disponible';
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return fecha;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }

  async inscribir() {
    if (this.inscripcion.invalid || !this.curso()?.vigente || this.ocupado()) return;
    await this.operar(async () => {
      await firstValueFrom(
        this.api.inscribir(this.cursoId, this.inscripcion.controls.estudiante.value),
      );
      this.inscripcion.reset();
      this.textoElegible.set('');
      await this.cargarInscritos();
      await this.buscarElegibles(this.filtroEstudiantes);
      this.mensaje.set(this.textos.inscrito);
      this.modalInscripcionAbierto.set(false);
    });
  }

  async paginar(_tipo: 'inscritos' | 'estudiantes', _numero: number) {
    // Inscritos cargados completos; paginación de elegibles eliminada en modal.
  }

  async buscar() {
    await this.buscarElegibles(this.textoElegible());
  }

  async verDetalleInscrito(inscrito: InscripcionDTO) {
    this.inscritoDetalle.set(inscrito);
    this.puentesAsignados.set([]);
    this.cargandoDetalle.set(true);
    try {
      const todos = await this.obtenerTodasLasPaginas((p) =>
        this.api.asignaciones(this.cursoId, inscrito.id, p),
      );
      this.puentesAsignados.set(todos.content);
    } catch (error) {
      this.errorAcceso(error);
      this.error.set(mensajeErrorCursos(error));
    } finally {
      this.cargandoDetalle.set(false);
    }
  }

  cerrarDetalleInscrito() {
    this.inscritoDetalle.set(null);
    this.puentesAsignados.set([]);
  }

  private limpiar() {
    this.curso.set(null);
    this.inscritos.set([]);
    this.elegibles.set([]);
    this.inscripcion.reset();
    this.mensaje.set('');
    this.modalInscripcionAbierto.set(false);
    this.inscritoDetalle.set(null);
    this.puentesAsignados.set([]);
    this.busquedaInscritos.set('');
    this.textoElegible.set('');
    this.filtroEstudiantes = '';
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
