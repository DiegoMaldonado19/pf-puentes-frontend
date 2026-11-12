import { DatePipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { TEXTOS } from '../../shared/textos';

export type EstadoOrdenGlobal = keyof typeof TEXTOS.mantenimientoGlobal.estados;
export type TipoOrdenGlobal = keyof typeof TEXTOS.mantenimientoGlobal.tipos;
export type PrioridadOrdenGlobal = keyof typeof TEXTOS.mantenimientoGlobal.prioridades;

/** Orden del listado global (B9), con el puente de origen. */
export interface OrdenGlobal {
  readonly id: string;
  readonly puente_id: string;
  readonly puente_codigo: string;
  readonly puente_nombre: string;
  readonly tipo: TipoOrdenGlobal;
  readonly estado: EstadoOrdenGlobal;
  readonly prioridad: PrioridadOrdenGlobal;
  readonly descripcion: string;
  readonly fecha_programada: string | null;
  readonly creado_en: string;
}

export interface PaginaOrdenesGlobal {
  readonly content: OrdenGlobal[];
  readonly page: number;
  readonly size: number;
  readonly total_elements: number;
  readonly total_pages: number;
}

const TAMANO = 20;

@Component({
  selector: 'app-mantenimiento-global',
  imports: [RouterLink, DatePipe],
  templateUrl: './mantenimiento-global.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MantenimientoGlobal {
  protected readonly t = TEXTOS.mantenimientoGlobal;
  protected readonly estados = Object.keys(this.t.estados) as EstadoOrdenGlobal[];
  protected readonly tipos = Object.keys(this.t.tipos) as TipoOrdenGlobal[];
  protected readonly prioridades = Object.keys(this.t.prioridades) as PrioridadOrdenGlobal[];

  private readonly http = inject(HttpClient);
  private readonly destruir = inject(DestroyRef);
  private solicitud: Subscription | null = null;

  protected readonly estado = signal<EstadoOrdenGlobal | ''>('');
  protected readonly tipo = signal<TipoOrdenGlobal | ''>('');
  protected readonly prioridad = signal<PrioridadOrdenGlobal | ''>('');
  protected readonly texto = signal('');
  protected readonly pagina = signal(0);
  protected readonly datos = signal<PaginaOrdenesGlobal | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal(false);

  constructor() {
    this.cargar();
  }

  protected aplicar(): void {
    this.pagina.set(0);
    this.cargar();
  }

  protected limpiar(): void {
    this.estado.set('');
    this.tipo.set('');
    this.prioridad.set('');
    this.texto.set('');
    this.aplicar();
  }

  protected irA(pagina: number): void {
    this.pagina.set(pagina);
    this.cargar();
  }

  protected cambiarEstado(valor: string): void {
    this.estado.set(valor as EstadoOrdenGlobal | '');
  }

  protected cambiarTipo(valor: string): void {
    this.tipo.set(valor as TipoOrdenGlobal | '');
  }

  protected cambiarPrioridad(valor: string): void {
    this.prioridad.set(valor as PrioridadOrdenGlobal | '');
  }

  protected cambiarTexto(valor: string): void {
    this.texto.set(valor);
  }

  private cargar(): void {
    this.solicitud?.unsubscribe();
    this.cargando.set(true);
    this.error.set(false);
    let params = new HttpParams().set('page', this.pagina()).set('size', TAMANO);
    if (this.estado()) params = params.set('estado', this.estado());
    if (this.tipo()) params = params.set('tipo', this.tipo());
    if (this.prioridad()) params = params.set('prioridad', this.prioridad());
    if (this.texto().trim()) params = params.set('q', this.texto().trim());
    this.solicitud = this.http
      .get<PaginaOrdenesGlobal>('/api/v1/ordenes-mantenimiento', { params })
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: (pagina) => {
          this.datos.set(pagina);
          this.cargando.set(false);
        },
        error: () => {
          this.datos.set(null);
          this.error.set(true);
          this.cargando.set(false);
        },
      });
  }
}
