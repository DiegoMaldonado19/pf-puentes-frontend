import { Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { EMPTY, expand, Observable, reduce, switchMap } from 'rxjs';
import { TEXTOS } from '../../shared/textos';
import { InspeccionApi } from '../inspecciones/inspeccion-api';
import { MantenimientoService } from './mantenimiento.service';

const TAMANO_PAGINA = 100;

/**
 * Aviso «N propuestas generadas» (B9). Cuenta las propuestas de mantenimiento que la publicación
 * de esta inspección creó: cada una lleva el id de su inspección de origen.
 */
@Component({
  selector: 'app-aviso-propuestas-generadas',
  imports: [RouterLink],
  template: `
    <section class="hvc-note mt-4" aria-live="polite" [attr.aria-busy]="cargando()">
      @if (cargando()) {
        <p role="status">{{ t.calculando }}</p>
      } @else if (error()) {
        <p role="alert">{{ t.error }}</p>
      } @else {
        <p role="status">
          {{ mensaje() }}
          @if (puenteId() && total() > 0) {
            <a class="hvc-link" [routerLink]="['/puentes', puenteId(), 'mantenimiento']">{{
              t.verPropuestas
            }}</a>
          }
        </p>
      }
    </section>
  `,
})
export class AvisoPropuestasGeneradas implements OnInit {
  readonly inspeccionId = input.required<string>();

  private readonly inspecciones = inject(InspeccionApi);
  private readonly mantenimiento = inject(MantenimientoService);
  private readonly destruir = inject(DestroyRef);

  protected readonly t = TEXTOS.avisoPropuestas;
  protected readonly cargando = signal(true);
  protected readonly error = signal(false);
  protected readonly puenteId = signal<string | null>(null);
  protected readonly total = signal(0);
  protected readonly mensaje = computed(() => {
    const cuantas = this.total();
    if (cuantas === 0) return this.t.ninguna;
    if (cuantas === 1) return this.t.una;
    return this.t.varias.replace('{n}', String(cuantas));
  });

  ngOnInit(): void {
    this.inspecciones
      .detalle(this.inspeccionId())
      .pipe(
        switchMap((inspeccion) => {
          this.puenteId.set(inspeccion.puente.id);
          return this.contar(inspeccion.puente.id);
        }),
        takeUntilDestroyed(this.destruir),
      )
      .subscribe({
        next: (cuantas) => {
          this.total.set(cuantas);
          this.cargando.set(false);
        },
        error: () => {
          this.error.set(true);
          this.cargando.set(false);
        },
      });
  }

  /** Recorre las páginas de órdenes del puente y cuenta las que vienen de esta inspección. */
  private contar(puenteId: string): Observable<number> {
    const origen = this.inspeccionId();
    return this.mantenimiento.listarOrdenes(puenteId, 0, TAMANO_PAGINA).pipe(
      expand((pagina) =>
        pagina.page + 1 < pagina.total_pages
          ? this.mantenimiento.listarOrdenes(puenteId, pagina.page + 1, TAMANO_PAGINA)
          : EMPTY,
      ),
      reduce(
        (total, pagina) => total + pagina.content.filter((o) => o.inspeccion_id === origen).length,
        0,
      ),
    );
  }
}
