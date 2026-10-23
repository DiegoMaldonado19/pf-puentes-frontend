import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, linkedSignal, signal, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import { TEXTOS } from '../../shared/textos';
import { PuentesService } from '../puentes/puentes.service';
import { ConsultaOrdenes } from './consulta-ordenes';
import { ConsultaPropuestas } from './consulta-propuestas';

/** Conecta los permisos ya acordados de P8 con la sesión real de P2 y el inventario P3. */
@Component({
  selector: 'app-gestion-mantenimiento',
  imports: [RouterLink, ConsultaOrdenes, ConsultaPropuestas],
  templateUrl: './gestion-mantenimiento.html',
})
export class GestionMantenimiento {
  readonly id = input.required<string>();
  private readonly auth = inject(AuthService);
  private readonly puentes = inject(PuentesService);
  protected readonly t = TEXTOS.mantenimiento.gestion;
  protected readonly permitido = computed(
    () => this.auth.listo() && this.auth.autenticado() && this.auth.esGestorMantenimiento(),
  );
  private readonly contexto = computed(() => ({ id: this.id(), permiso: this.permitido() }));
  protected readonly vista = linkedSignal({
    source: this.contexto,
    computation: (): 'ordenes' | 'propuestas' => 'ordenes',
  });
  protected readonly intento = signal(0);
  protected readonly puente = rxResource({
    params: () => (this.permitido() ? { id: this.id(), intento: this.intento() } : undefined),
    stream: ({ params }) => this.puentes.detalle(params.id),
  });
  protected readonly error = computed(() => {
    const error = this.puente.error();
    return error instanceof HttpErrorResponse && error.status === 404
      ? this.t.noPuente
      : this.t.error;
  });
  private readonly ordenes = viewChild(ConsultaOrdenes);
  private readonly propuestas = viewChild(ConsultaPropuestas);
  readonly operacionPendiente = computed(
    () =>
      this.permitido() &&
      ((this.ordenes()?.operacionPendiente() ?? false) ||
        (this.propuestas()?.operacionPendiente() ?? false)),
  );

  protected cambiar(vista: 'ordenes' | 'propuestas') {
    if (this.permitido() && !this.operacionPendiente()) this.vista.set(vista);
  }

  protected recargar() {
    if (this.permitido() && !this.operacionPendiente()) this.intento.update((v) => v + 1);
  }
}
