import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnInit,
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

  private readonly http = inject(HttpClient);
  private readonly destruir = inject(DestroyRef);

  protected readonly ciclo = signal<CicloRevision | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly ocupadas = signal<ReadonlySet<string>>(new Set());
  protected readonly pendientes = computed(
    () => this.ciclo()?.observaciones.filter((o) => !o.resuelta_en).length ?? 0,
  );

  ngOnInit(): void {
    this.cargar();
  }

  protected irAlCampo(referencia: string | null): void {
    const id = campoDeReferencia(referencia);
    const elemento = id ? document.getElementById(id) : null;
    if (elemento) {
      elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
      elemento.focus({ preventScroll: true });
      this.aviso.set(null);
    } else {
      this.aviso.set(this.t.buscarCampo);
    }
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
        next: (pagina) => this.ciclo.set(ultimoCicloConCorrecciones(pagina.content)),
        error: () => this.ciclo.set(null),
      });
  }

  private reemplazar(resuelta: ObservacionCorreccion): void {
    const actual = this.ciclo();
    if (!actual) return;
    this.ciclo.set({
      ...actual,
      observaciones: actual.observaciones.map((o) => (o.id === resuelta.id ? resuelta : o)),
    });
  }

  private liberar(id: string): void {
    const siguientes = new Set(this.ocupadas());
    siguientes.delete(id);
    this.ocupadas.set(siguientes);
  }
}
