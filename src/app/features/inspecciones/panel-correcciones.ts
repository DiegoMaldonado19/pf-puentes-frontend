import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { TEXTOS } from '../../shared/textos';

export interface ObservacionCorreccion {
  readonly id: string;
  readonly elemento_ref: string | null;
  readonly texto: string;
  readonly resuelta_en: string | null;
}

export interface CicloRevision {
  readonly id: string;
  readonly veredicto: string;
  readonly observacion: string | null;
  readonly emitida_en: string | null;
  readonly creado_en: string;
  readonly observaciones: ObservacionCorreccion[];
}

interface PaginaCiclos {
  readonly content: CicloRevision[];
}

/** Último ciclo con cambios solicitados: lo que el autor debe corregir (B3). */
export function ultimoCicloConCorrecciones(ciclos: readonly CicloRevision[]): CicloRevision | null {
  const pedidos = ciclos.filter((c) => c.veredicto === 'CAMBIOS_SOLICITADOS');
  if (pedidos.length === 0) return null;
  return pedidos.reduce((ultimo, ciclo) =>
    (ciclo.emitida_en ?? ciclo.creado_en) > (ultimo.emitida_en ?? ultimo.creado_en)
      ? ciclo
      : ultimo,
  );
}

/** Nombre corto del campo para mostrar: el último segmento de la ruta (p. ej. estribo_entrada). */
export function campoDeReferencia(referencia: string | null): string {
  if (!referencia) return '';
  return referencia.split('.').pop() ?? referencia;
}

@Component({
  selector: 'app-panel-correcciones',
  imports: [DatePipe],
  templateUrl: './panel-correcciones.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanelCorrecciones implements OnInit {
  protected readonly t = TEXTOS.correcciones;
  protected readonly campoDeReferencia = campoDeReferencia;

  readonly inspeccionId = input.required<string>();
  readonly editable = input(false);
  /** Aviso del padre cuando «Ir al campo» no encuentra el campo en el formulario. */
  readonly avisoCampo = input<string | null>(null);
  /** «Ir al campo»: el padre enfoca el campo en el motor, que puede estar en otra pestaña. */
  readonly irAlCampo = output<string>();
  /** Observaciones sin resolver del último ciclo: el padre las muestra junto a cada campo. */
  readonly pendientesCambian = output<readonly ObservacionCorreccion[]>();

  private readonly http = inject(HttpClient);
  private readonly destruir = inject(DestroyRef);

  protected readonly ciclo = signal<CicloRevision | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly ocupadas = signal<ReadonlySet<string>>(new Set());
  protected readonly pendientes = computed(
    () => this.ciclo()?.observaciones.filter((o) => !o.resuelta_en).length ?? 0,
  );

  ngOnInit(): void {
    this.cargar();
  }

  protected pedirIrAlCampo(referencia: string | null): void {
    if (referencia) this.irAlCampo.emit(referencia);
  }

  protected marcarResuelta(observacion: ObservacionCorreccion): void {
    if (this.ocupadas().has(observacion.id)) return;
    this.ocupadas.set(new Set([...this.ocupadas(), observacion.id]));
    this.error.set(null);
    this.http
      .patch<ObservacionCorreccion>(`/api/v1/observaciones/${observacion.id}/resolucion`, {})
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: (resuelta) => {
          this.reemplazar(resuelta);
          this.liberar(observacion.id);
        },
        error: (error: HttpErrorResponse) => {
          this.liberar(observacion.id);
          this.error.set(error.status === 409 ? this.t.noEditable : this.t.errorResolver);
        },
      });
  }

  private cargar(): void {
    this.http
      .get<PaginaCiclos>(`/api/v1/inspecciones/${this.inspeccionId()}/revisiones`, {
        params: { page: 0, size: 50 },
      })
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: (pagina) => this.mostrar(ultimoCicloConCorrecciones(pagina.content)),
        error: () => this.mostrar(null),
      });
  }

  private reemplazar(resuelta: ObservacionCorreccion): void {
    const actual = this.ciclo();
    if (!actual) return;
    this.mostrar({
      ...actual,
      observaciones: actual.observaciones.map((o) => (o.id === resuelta.id ? resuelta : o)),
    });
  }

  private mostrar(ciclo: CicloRevision | null): void {
    this.ciclo.set(ciclo);
    this.pendientesCambian.emit(ciclo?.observaciones.filter((o) => !o.resuelta_en) ?? []);
  }

  private liberar(id: string): void {
    const siguientes = new Set(this.ocupadas());
    siguientes.delete(id);
    this.ocupadas.set(siguientes);
  }
}
