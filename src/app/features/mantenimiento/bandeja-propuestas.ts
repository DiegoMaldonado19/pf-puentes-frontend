import { Component, computed, input, linkedSignal, output, viewChild } from '@angular/core';
import { TEXTOS } from '../../shared/textos';
import { AceptacionPropuesta } from './aceptacion-propuesta';
import {
  ConsultaPropuestas,
  OrdenMantenimientoDTO,
  PaginaPropuestas,
  ReferenciaOrden,
} from './modelos';

@Component({
  selector: 'app-bandeja-propuestas',
  imports: [AceptacionPropuesta],
  templateUrl: './bandeja-propuestas.html',
  styleUrl: './bandeja-propuestas.css',
})
export class BandejaPropuestas {
  readonly puenteId = input.required<string>();
  readonly pagina = input.required<PaginaPropuestas | null>();
  readonly puedeAceptar = input.required<boolean>();
  readonly cargando = input(false);
  readonly codigoError = input<number | null>(null);
  readonly consultaSolicitada = output<ConsultaPropuestas>();
  readonly aceptada = output<OrdenMantenimientoDTO>();

  protected readonly t = TEXTOS.mantenimiento;
  protected readonly b = this.t.bandeja;
  private readonly contexto = computed(() => ({ puente: this.puenteId(), pagina: this.pagina() }));
  protected readonly seleccionada = linkedSignal({
    source: this.contexto,
    computation: (): OrdenMantenimientoDTO | null => null,
  });
  protected readonly esperandoActualizacion = linkedSignal({
    source: this.contexto,
    computation: () => false,
  });
  protected readonly confirmada = linkedSignal({ source: this.puenteId, computation: () => false });
  private readonly detalle = viewChild(AceptacionPropuesta);
  protected readonly enviando = computed(() => this.detalle()?.envioPendiente() ?? false);
  protected readonly paginaValida = computed(() => {
    const pagina = this.pagina();
    if (!pagina) return null;
    const pertenece =
      pagina.puente_id === this.puenteId() &&
      pagina.content.every(
        (orden) => orden.puente_id === this.puenteId() && orden.estado === 'PROPUESTA',
      );
    return pertenece ? pagina : null;
  });
  protected readonly error = computed(() => {
    const codigo = this.codigoError();
    if (codigo === 401) return this.b.sinSesion;
    if (codigo === 403) return this.b.sinPermiso;
    if (codigo === 404) return this.b.noEncontrado;
    if (codigo === 0) return this.b.sinConexion;
    if (codigo !== null) return this.b.error;
    return this.pagina() && !this.paginaValida() ? this.b.datosIncompatibles : '';
  });

  protected seleccionar(orden: OrdenMantenimientoDTO) {
    if (this.enviando() || this.cargando() || this.esperandoActualizacion() || this.error()) return;
    if (!this.paginaValida()?.content.includes(orden)) return;
    this.seleccionada.set(orden);
    this.confirmada.set(false);
  }

  protected consultar(page = this.paginaValida()?.page ?? 0) {
    if (this.enviando() || this.cargando()) return;
    if (page < 0) return;
    const pagina = this.paginaValida();
    if (pagina && page > 0 && page >= pagina.total_pages) return;
    this.esperandoActualizacion.set(true);
    this.consultaSolicitada.emit({ puente_id: this.puenteId(), page, size: pagina?.size ?? 20 });
  }

  protected confirmar(orden: OrdenMantenimientoDTO) {
    if (orden.puente_id !== this.puenteId() || orden.id !== this.seleccionada()?.id) return;
    const pagina = this.paginaValida();
    const page =
      pagina && pagina.page > 0 && pagina.content.length === 1
        ? pagina.page - 1
        : (pagina?.page ?? 0);
    this.seleccionada.set(null);
    this.confirmada.set(true);
    this.esperandoActualizacion.set(true);
    this.aceptada.emit(orden);
    this.consultaSolicitada.emit({ puente_id: orden.puente_id, page, size: pagina?.size ?? 20 });
  }

  protected actualizar(referencia: ReferenciaOrden) {
    if (referencia.puente_id !== this.puenteId()) return;
    this.esperandoActualizacion.set(true);
    // La escritura ya terminó cuando el hijo emite; finalize aún puede no haberse ejecutado.
    this.consultaSolicitada.emit({
      puente_id: referencia.puente_id,
      page: this.paginaValida()?.page ?? 0,
      size: this.paginaValida()?.size ?? 20,
    });
  }
}
