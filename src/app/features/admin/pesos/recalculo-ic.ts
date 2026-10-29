import { DatePipe, DecimalPipe, registerLocaleData } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import localeEsGt from '@angular/common/locales/es-GT';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  linkedSignal,
  LOCALE_ID,
  output,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { EstadoPuente } from '../../../shared/estado-puente/estado-puente';
import { TEXTOS } from '../../../shared/textos';
import { AnulacionIc, ComparacionRecalculoIcDTO, JuegoPesosDTO, RecalculoIcDTO } from './modelos';
import { PesosService } from './pesos.service';

registerLocaleData(localeEsGt);

@Component({
  selector: 'app-recalculo-ic',
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, EstadoPuente],
  providers: [{ provide: LOCALE_ID, useValue: 'es-GT' }],
  templateUrl: './recalculo-ic.html',
  styleUrls: ['./consulta-pesos.css'],
  styles: `
    .recalculos-ic {
      margin-block: 1.5rem;
      padding: 1rem;
      border: 1px solid #cbd5e1;
      border-radius: 0.5rem;
    }
    h3 {
      font-weight: 600;
      margin-block: 1.25rem 0.5rem;
    }
    label {
      display: block;
      font-weight: 500;
      margin-bottom: 0.25rem;
    }
    select {
      min-height: 2.75rem;
      margin: 0 0.75rem 0.75rem 0;
      padding: 0.5rem;
      border: 1px solid #94a3b8;
      border-radius: 0.375rem;
    }
  `,
})
export class RecalculoIc {
  readonly inspeccionId = input.required<string>();
  readonly puedeRecalcular = input(false);
  readonly juegosDisponibles = input<readonly JuegoPesosDTO[]>([]);
  readonly recalculado = output<RecalculoIcDTO>();

  protected readonly t = TEXTOS.pesos;
  protected readonly tr = TEXTOS.pesos.recalculo;
  protected readonly comparacion = signal<ComparacionRecalculoIcDTO | null>(null);
  protected readonly cargando = signal(false);
  protected readonly enviando = signal(false);
  protected readonly errorConsulta = signal('');
  protected readonly errorEnvio = signal('');
  protected readonly confirmacion = signal('');
  protected readonly formulario = new FormGroup({
    versionPesosId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  readonly operacionPendiente = computed(() => this.enviando());

  private readonly servicio = inject(PesosService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pagina = linkedSignal({ source: this.inspeccionId, computation: () => 0 });
  private readonly intento = signal(0);
  private envioEnCurso: Subscription | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.envioEnCurso?.unsubscribe());

    effect((limpiar) => {
      const inspeccion = this.inspeccionId().trim();
      const paginaActual = this.pagina();
      this.intento();
      this.comparacion.set(null);
      this.errorConsulta.set('');
      if (!inspeccion) {
        this.cargando.set(false);
        return;
      }
      this.cargando.set(true);
      const sub = this.servicio.consultarRecalculos(inspeccion, paginaActual).subscribe({
        next: (resultado) => {
          this.comparacion.set(resultado);
          this.cargando.set(false);
        },
        error: (error: unknown) => {
          this.errorConsulta.set(this.mensajeErrorConsulta(error));
          this.cargando.set(false);
        },
      });
      limpiar(() => sub.unsubscribe());
    });
  }

  protected solicitarRecalculo() {
    if (this.enviando() || !this.puedeRecalcular()) return;
    const versionPesosId = this.formulario.controls.versionPesosId.value.trim();
    if (!versionPesosId) {
      this.formulario.markAllAsTouched();
      return;
    }
    const inspeccion = this.inspeccionId().trim();
    if (!inspeccion) return;

    this.errorEnvio.set('');
    this.confirmacion.set('');
    this.enviando.set(true);
    this.formulario.disable({ emitEvent: false });

    this.envioEnCurso?.unsubscribe();
    this.envioEnCurso = this.servicio
      .recalcularIc(inspeccion, { version_pesos_id: versionPesosId })
      .subscribe({
        next: (resultado) => {
          this.enviando.set(false);
          this.formulario.enable({ emitEvent: false });
          this.confirmacion.set(this.tr.confirmado);
          this.recalculado.emit(resultado);
          this.pagina.set(0);
          this.intento.update((valor) => valor + 1);
        },
        error: (error: unknown) => {
          this.enviando.set(false);
          this.formulario.enable({ emitEvent: false });
          if (error instanceof HttpErrorResponse && [401, 403].includes(error.status)) {
            this.comparacion.set(null);
            this.errorConsulta.set(this.mensajeErrorConsulta(error));
            return;
          }
          this.errorEnvio.set(this.mensajeErrorEnvio(error));
        },
      });
  }

  protected cambiarPagina(nuevaPagina: number) {
    if (this.enviando()) return;
    const actual = this.comparacion()?.recalculos;
    if (actual && nuevaPagina >= 0 && nuevaPagina < actual.total_pages) {
      this.pagina.set(nuevaPagina);
    }
  }

  protected actualizar() {
    if (this.enviando()) return;
    this.confirmacion.set('');
    this.errorEnvio.set('');
    this.intento.update((valor) => valor + 1);
  }

  protected etiquetaAnulacion(anulacion: AnulacionIc | null): string {
    return anulacion ? this.tr.anulaciones[anulacion] : this.tr.sinAnulacion;
  }

  protected variacionRespectoOriginal(recalculo: RecalculoIcDTO): number {
    const base = this.comparacion()?.original.indice_condicion ?? 0;
    return recalculo.indice_condicion - base;
  }

  private mensajeErrorConsulta(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return this.t.error;
    switch (error.status) {
      case 0:
        return this.t.sinConexion;
      case 401:
        return this.t.sinSesion;
      case 403:
        return this.t.sinPermiso;
      case 404:
        return this.tr.noEncontrada;
      case 409:
        return this.tr.noPublicada;
      default:
        return this.t.error;
    }
  }

  private mensajeErrorEnvio(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return this.tr.incierto;
    switch (error.status) {
      case 400:
      case 422:
        return this.tr.incompatible;
      case 404:
        return this.tr.noEncontrada;
      case 409:
        return this.tr.noPublicada;
      default:
        return this.tr.incierto;
    }
  }
}
