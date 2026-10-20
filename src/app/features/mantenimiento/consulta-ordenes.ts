import { DatePipe, registerLocaleData } from '@angular/common';
import localeEsGt from '@angular/common/locales/es-GT';
import { HttpErrorResponse } from '@angular/common/http';
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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { TEXTOS } from '../../shared/textos';
import { MantenimientoService } from './mantenimiento.service';
import { OrdenMantenimientoDTO, PaginaOrdenes } from './modelos';

registerLocaleData(localeEsGt);

interface EstadoConsulta<T> {
  datos: T | null;
  cargando: boolean;
  error: number | null;
}

/** Historial e inicio de ejecución; el host de P2 aporta permiso/sesión y P3 el puente seleccionado. */
@Component({
  selector: 'app-consulta-ordenes',
  imports: [DatePipe],
  providers: [{ provide: LOCALE_ID, useValue: 'es-GT' }],
  templateUrl: './consulta-ordenes.html',
  styleUrls: ['./bandeja-propuestas.css', './consulta-ordenes.css'],
})
export class ConsultaOrdenes {
  readonly puenteId = input.required<string>();
  readonly puedeConsultar = input.required<boolean>();
  // Mantiene el modo de solo lectura si el host todavía no aporta este permiso de P2.
  readonly puedeIniciar = input(false);
  readonly iniciada = output<OrdenMantenimientoDTO>();
  protected readonly iniciando = signal(false);
  /** El host puede bloquear también la selección externa del puente durante el envío. */
  readonly inicioPendiente = this.iniciando.asReadonly();
  private readonly destruccion = inject(DestroyRef);
  protected readonly t = TEXTOS.mantenimiento;
  protected readonly h = this.t.historial;
  private readonly servicio = inject(MantenimientoService);
  private readonly contexto = computed(() => ({
    puente: this.puenteId(),
    permiso: this.puedeConsultar(),
  }));
  protected readonly avisoInicio = linkedSignal({
    source: this.contexto,
    computation: (): { mensaje: string; error: boolean } | null => null,
  });
  protected readonly accesoDenegado = linkedSignal({
    source: this.contexto,
    computation: (): number | null => null,
  });
  private readonly solicitud = linkedSignal({
    source: this.contexto,
    computation: () => ({ page: 0, size: 20, intento: 0 }),
  });
  protected readonly seleccion = linkedSignal({
    source: this.solicitud,
    computation: (): { id: string; intento: number } | null => null,
  });
  protected readonly lista = linkedSignal({
    source: this.contexto,
    computation: (): EstadoConsulta<PaginaOrdenes> => ({
      datos: null,
      cargando: false,
      error: null,
    }),
  });
  protected readonly detalle = linkedSignal({
    source: this.seleccion,
    computation: (): EstadoConsulta<OrdenMantenimientoDTO> => ({
      datos: null,
      cargando: false,
      error: null,
    }),
  });

  constructor() {
    effect((limpiar) => {
      const contexto = this.contexto();
      const solicitud = this.solicitud();
      const denegado = this.accesoDenegado();
      if (!contexto.permiso || denegado !== null) {
        this.lista.set({ datos: null, cargando: false, error: denegado ?? 403 });
        return;
      }
      this.lista.set({ datos: null, cargando: true, error: null });
      const peticion = this.servicio
        .listarOrdenes(contexto.puente, solicitud.page, solicitud.size)
        .subscribe({
          next: (pagina) => {
            if (this.contexto() !== contexto || this.solicitud() !== solicitud) return;
            const compatible =
              pagina.puente_id === contexto.puente &&
              pagina.content.every((o) => o.puente_id === contexto.puente);
            this.lista.set({
              datos: compatible ? pagina : null,
              cargando: false,
              error: compatible ? null : -1,
            });
          },
          error: (error: unknown) => {
            if (this.contexto() !== contexto || this.solicitud() !== solicitud) return;
            const status = error instanceof HttpErrorResponse ? error.status : 500;
            this.lista.set({ datos: null, cargando: false, error: status });
            if ([401, 403].includes(status)) this.accesoDenegado.set(status);
          },
        });
      limpiar(() => peticion.unsubscribe());
    });
    effect((limpiar) => {
      const contexto = this.contexto();
      const seleccion = this.seleccion();
      const denegado = this.accesoDenegado();
      this.detalle.set({ datos: null, cargando: false, error: null });
      if (!contexto.permiso || denegado !== null || !seleccion) return;
      this.detalle.set({ datos: null, cargando: true, error: null });
      const peticion = this.servicio.obtenerOrden(contexto.puente, seleccion.id).subscribe({
        next: (orden) => {
          if (this.contexto() !== contexto || this.seleccion() !== seleccion) return;
          const compatible = orden.puente_id === contexto.puente && orden.id === seleccion.id;
          this.detalle.set({
            datos: compatible ? orden : null,
            cargando: false,
            error: compatible ? null : -1,
          });
        },
        error: (error: unknown) => {
          if (this.contexto() !== contexto || this.seleccion() !== seleccion) return;
          const status = error instanceof HttpErrorResponse ? error.status : 500;
          this.detalle.set({ datos: null, cargando: false, error: status });
          if ([401, 403].includes(status)) this.accesoDenegado.set(status);
        },
      });
      limpiar(() => peticion.unsubscribe());
    });
  }

  protected consultar(page = this.lista().datos?.page ?? 0) {
    if (
      !this.puedeConsultar() ||
      this.accesoDenegado() !== null ||
      this.iniciando() ||
      this.lista().cargando ||
      page < 0
    )
      return;
    const pagina = this.lista().datos;
    if (pagina && page > 0 && page >= pagina.total_pages) return;
    this.avisoInicio.set(null);
    this.solicitud.update((actual) => ({
      page,
      size: pagina?.size ?? actual.size,
      intento: actual.intento + 1,
    }));
  }

  protected anterior() {
    const pagina = this.lista().datos;
    if (!pagina || pagina.page === 0) return;
    // Si disminuyeron los registros, vuelve a una página existente del servidor.
    this.consultar(Math.min(pagina.page - 1, Math.max(0, pagina.total_pages - 1)));
  }

  protected seleccionar(orden: OrdenMantenimientoDTO) {
    if (
      this.iniciando() ||
      this.lista().cargando ||
      this.lista().error !== null ||
      this.accesoDenegado() !== null ||
      !this.puedeConsultar()
    )
      return;
    if (!this.lista().datos?.content.includes(orden)) return;
    this.avisoInicio.set(null);
    this.seleccion.set({ id: orden.id, intento: 0 });
  }

  protected actualizarDetalle() {
    if (
      !this.puedeConsultar() ||
      this.accesoDenegado() !== null ||
      this.iniciando() ||
      this.detalle().cargando
    )
      return;
    this.seleccion.update((actual) =>
      actual ? { id: actual.id, intento: actual.intento + 1 } : null,
    );
  }

  protected iniciarEjecucion() {
    const orden = this.detalle().datos;
    const contexto = this.contexto();
    if (
      !orden ||
      !contexto.permiso ||
      !this.puedeIniciar() ||
      this.iniciando() ||
      this.accesoDenegado() !== null ||
      this.lista().cargando ||
      this.detalle().cargando ||
      orden.estado !== 'PROGRAMADA' ||
      orden.puente_id !== contexto.puente ||
      this.seleccion()?.id !== orden.id
    )
      return;
    this.avisoInicio.set(null);
    this.iniciando.set(true);
    this.servicio
      .iniciarEjecucion(orden.puente_id, orden.id)
      .pipe(
        takeUntilDestroyed(this.destruccion),
        finalize(() => this.iniciando.set(false)),
      )
      .subscribe({
        next: (resultado) => {
          if (
            this.contexto() !== contexto ||
            !this.puedeConsultar() ||
            this.seleccion()?.id !== orden.id
          )
            return;
          if (
            resultado.id !== orden.id ||
            resultado.puente_id !== orden.puente_id ||
            resultado.estado !== 'EN_EJECUCION'
          ) {
            this.falloInicio(500);
            return;
          }
          // El POST confirmado es la fuente del nuevo estado, sin actualización optimista.
          this.detalle.set({ datos: resultado, cargando: false, error: null });
          this.lista.update((actual) => ({
            ...actual,
            datos: actual.datos
              ? {
                  ...actual.datos,
                  content: actual.datos.content.map((fila) =>
                    fila.id === resultado.id ? resultado : fila,
                  ),
                }
              : null,
          }));
          this.avisoInicio.set({ mensaje: this.t.inicio.confirmada, error: false });
          this.iniciada.emit(resultado);
        },
        error: (error: unknown) => {
          if (this.contexto() !== contexto || !this.puedeConsultar()) return;
          this.falloInicio(error instanceof HttpErrorResponse ? error.status : 500);
        },
      });
  }

  private falloInicio(status: number) {
    if (status === 401 || status === 403) {
      this.accesoDenegado.set(status);
      this.avisoInicio.set(null);
      return;
    }
    const mensaje =
      status === 409
        ? this.t.inicio.conflicto
        : status === 404
          ? this.t.inicio.noEncontrada
          : status === 400 || status === 422
            ? this.t.inicio.datosInvalidos
            : this.t.inicio.resultadoDesconocido;
    this.avisoInicio.set({ mensaje, error: true });
    // Solo se vuelve a leer: nunca se reintenta automáticamente el POST.
    this.solicitud.update((actual) => ({ ...actual, intento: actual.intento + 1 }));
  }

  protected fechaCivil(valor: string | null): string {
    return valor
      ? `${valor.slice(8, 10)}/${valor.slice(5, 7)}/${valor.slice(0, 4)}`
      : this.h.sinDato;
  }

  protected mensaje(status: number, detalle = false): string {
    switch (status) {
      case 401:
        return this.h.sinSesion;
      case 403:
        return this.h.sinPermiso;
      case 404:
        return detalle ? this.h.noOrden : this.h.noPuente;
      case 0:
        return this.h.sinConexion;
      case -1:
        return this.h.incompatibles;
      default:
        return detalle ? this.h.errorDetalle : this.h.error;
    }
  }
}
