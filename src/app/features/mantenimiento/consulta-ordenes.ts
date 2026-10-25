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
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { TEXTOS } from '../../shared/textos';
import { AjustePrioridadOrden } from './ajuste-prioridad-orden';
import { ProgramacionOrden } from './programacion-orden';
import { SeguimientoRutinario } from './seguimiento-rutinario';
import { DecisionConMotivoOrden } from './decision-con-motivo-orden';
import { EvidenciaYCierre } from './evidencia-y-cierre';
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
  imports: [
    DatePipe,
    EvidenciaYCierre,
    DecisionConMotivoOrden,
    AjustePrioridadOrden,
    ProgramacionOrden,
    SeguimientoRutinario,
  ],
  providers: [{ provide: LOCALE_ID, useValue: 'es-GT' }],
  templateUrl: './consulta-ordenes.html',
  styleUrls: ['./bandeja-propuestas.css', './consulta-ordenes.css'],
})
export class ConsultaOrdenes {
  readonly puenteId = input.required<string>();
  readonly puedeConsultar = input.required<boolean>();
  /** Opción de presentación del host; conserva el permiso de lectura del historial. */
  readonly mostrarSeguimientoRutinario = input(false);
  protected readonly versionSeguimiento = signal(0);
  // Mantiene el modo de solo lectura si el host todavía no aporta este permiso de P2.
  readonly puedeIniciar = input(false);
  readonly iniciada = output<OrdenMantenimientoDTO>();
  readonly puedeConsultarEvidencia = input(false);
  readonly puedeSubirEvidencia = input(false);
  readonly puedeCerrar = input(false);
  readonly cerrada = output<OrdenMantenimientoDTO>();
  readonly puedeDescartar = input(false);
  readonly descartada = output<OrdenMantenimientoDTO>();
  readonly puedeCancelar = input(false);
  readonly cancelada = output<OrdenMantenimientoDTO>();
  readonly puedeAjustarPrioridad = input(false);
  readonly prioridadAjustada = output<OrdenMantenimientoDTO>();
  readonly puedeProgramar = input(false);
  readonly fechaProgramada = output<OrdenMantenimientoDTO>();
  private readonly programacion = viewChild(ProgramacionOrden);
  protected readonly programando = computed(() => this.programacion()?.envioPendiente() ?? false);
  protected readonly bloqueoDeProgramacion = computed(
    () =>
      this.iniciando() ||
      this.ajustando() ||
      this.decidiendo() ||
      (this.evidencia()?.envioPendiente() ?? false),
  );
  private readonly ajuste = viewChild(AjustePrioridadOrden);
  protected readonly ajustando = computed(() => this.ajuste()?.envioPendiente() ?? false);
  private readonly decision = viewChild(DecisionConMotivoOrden);
  protected readonly decidiendo = computed(() => this.decision()?.envioPendiente() ?? false);
  private readonly evidencia = viewChild(EvidenciaYCierre);
  protected readonly otraOperacionPendiente = computed(
    () =>
      this.iniciando() ||
      this.programando() ||
      this.ajustando() ||
      (this.evidencia()?.envioPendiente() ?? false),
  );
  protected readonly bloqueoDePrioridad = computed(
    () =>
      this.iniciando() ||
      this.programando() ||
      this.decidiendo() ||
      (this.evidencia()?.envioPendiente() ?? false),
  );
  readonly operacionPendiente = computed(() => this.otraOperacionPendiente() || this.decidiendo());
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
      this.operacionPendiente() ||
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
      this.operacionPendiente() ||
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
      this.operacionPendiente() ||
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
      this.operacionPendiente() ||
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
          this.versionSeguimiento.update((v) => v + 1);
        },
        error: (error: unknown) => {
          if (this.contexto() !== contexto || !this.puedeConsultar()) return;
          this.falloInicio(error instanceof HttpErrorResponse ? error.status : 500);
        },
      });
  }

  protected cierreConfirmado(resultado: OrdenMantenimientoDTO) {
    const actual = this.detalle().datos;
    if (
      !this.puedeConsultar() ||
      !this.puedeCerrar() ||
      !actual ||
      this.accesoDenegado() !== null ||
      resultado.id !== actual.id ||
      resultado.puente_id !== this.puenteId() ||
      resultado.estado !== 'EJECUTADA'
    )
      return;
    this.detalle.set({ datos: resultado, cargando: false, error: null });
    this.lista.update((lista) => ({
      ...lista,
      datos: lista.datos
        ? {
            ...lista.datos,
            content: lista.datos.content.map((fila) =>
              fila.id === resultado.id ? resultado : fila,
            ),
          }
        : null,
    }));
    this.avisoInicio.set({ mensaje: this.t.evidencia.confirmada, error: false });
    this.cerrada.emit(resultado);
    this.versionSeguimiento.update((v) => v + 1);
  }

  protected decisionConfirmada(resultado: OrdenMantenimientoDTO) {
    const actual = this.detalle().datos;
    const cancelando = actual?.estado === 'PROGRAMADA';
    const permiso = cancelando ? this.puedeCancelar() : this.puedeDescartar();
    const destino = cancelando ? 'CANCELADA' : 'DESCARTADA';
    if (
      !this.puedeConsultar() ||
      !permiso ||
      this.accesoDenegado() !== null ||
      !actual ||
      (actual.estado !== 'PROPUESTA' && actual.estado !== 'PROGRAMADA') ||
      resultado.id !== actual.id ||
      resultado.puente_id !== this.puenteId() ||
      resultado.estado !== destino ||
      !resultado.motivo?.trim()
    )
      return;
    this.detalle.set({ datos: resultado, cargando: false, error: null });
    this.lista.update((lista) => ({
      ...lista,
      datos: lista.datos
        ? {
            ...lista.datos,
            content: lista.datos.content.map((fila) =>
              fila.id === resultado.id ? resultado : fila,
            ),
          }
        : null,
    }));
    this.avisoInicio.set({
      mensaje: this.t[cancelando ? 'cancelacion' : 'descarte'].confirmada,
      error: false,
    });
    if (cancelando) {
      this.cancelada.emit(resultado);
      this.versionSeguimiento.update((v) => v + 1);
    } else this.descartada.emit(resultado);
  }

  protected falloDecision(status: number) {
    if (status === 401 || status === 403) {
      this.accesoDenegado.set(status);
      this.avisoInicio.set(null);
      return;
    }
    const textos =
      this.t[this.detalle().datos?.estado === 'PROGRAMADA' ? 'cancelacion' : 'descarte'];
    this.avisoInicio.set({
      mensaje:
        status === 409
          ? textos.conflicto
          : status === 404
            ? textos.noEncontrada
            : textos.resultadoDesconocido,
      error: true,
    });
    this.solicitud.update((actual) => ({ ...actual, intento: actual.intento + 1 }));
  }

  protected ajusteConfirmado(resultado: OrdenMantenimientoDTO) {
    const actual = this.detalle().datos;
    if (
      !this.puedeConsultar() ||
      !this.puedeAjustarPrioridad() ||
      this.accesoDenegado() !== null ||
      !actual ||
      resultado.id !== actual.id ||
      resultado.puente_id !== this.puenteId() ||
      !['PROPUESTA', 'PROGRAMADA', 'EN_EJECUCION'].includes(resultado.estado)
    )
      return;
    this.detalle.set({ datos: resultado, cargando: false, error: null });
    this.lista.update((lista) => ({
      ...lista,
      datos: lista.datos
        ? {
            ...lista.datos,
            content: lista.datos.content.map((fila) =>
              fila.id === resultado.id ? resultado : fila,
            ),
          }
        : null,
    }));
    this.avisoInicio.set({ mensaje: this.t.ajustePrioridad.confirmada, error: false });
    this.prioridadAjustada.emit(resultado);
  }

  protected falloAjustePrioridad(status: number) {
    if (status === 401 || status === 403) {
      this.accesoDenegado.set(status);
      this.avisoInicio.set(null);
      return;
    }
    this.avisoInicio.set({
      mensaje:
        status === 409
          ? this.t.ajustePrioridad.conflicto
          : status === 404
            ? this.t.ajustePrioridad.noEncontrada
            : this.t.ajustePrioridad.resultadoDesconocido,
      error: true,
    });
    this.solicitud.update((actual) => ({ ...actual, intento: actual.intento + 1 }));
  }

  protected programacionConfirmada(resultado: OrdenMantenimientoDTO) {
    const actual = this.detalle().datos;
    if (
      !this.puedeConsultar() ||
      !this.puedeProgramar() ||
      this.accesoDenegado() !== null ||
      !actual ||
      resultado.id !== actual.id ||
      resultado.puente_id !== this.puenteId() ||
      actual.estado !== 'PROGRAMADA' ||
      resultado.estado !== 'PROGRAMADA' ||
      !resultado.fecha_programada
    )
      return;
    this.detalle.set({ datos: resultado, cargando: false, error: null });
    this.lista.update((lista) => ({
      ...lista,
      datos: lista.datos
        ? {
            ...lista.datos,
            content: lista.datos.content.map((fila) =>
              fila.id === resultado.id ? resultado : fila,
            ),
          }
        : null,
    }));
    this.avisoInicio.set({ mensaje: this.t.programacion.confirmada, error: false });
    this.fechaProgramada.emit(resultado);
    this.versionSeguimiento.update((v) => v + 1);
  }

  protected seleccionarRutina(orden: OrdenMantenimientoDTO) {
    if (
      !this.puedeConsultar() ||
      this.accesoDenegado() !== null ||
      this.operacionPendiente() ||
      !this.mostrarSeguimientoRutinario() ||
      orden.puente_id !== this.puenteId() ||
      orden.tipo !== 'RUTINARIO' ||
      !['PROGRAMADA', 'EN_EJECUCION'].includes(orden.estado)
    )
      return;
    this.seleccion.set({ id: orden.id, intento: 0 });
  }

  protected falloProgramacion(status: number) {
    if (status === 401 || status === 403) {
      this.accesoDenegado.set(status);
      this.avisoInicio.set(null);
      return;
    }
    this.avisoInicio.set({
      mensaje:
        status === 409
          ? this.t.programacion.conflicto
          : status === 404
            ? this.t.programacion.noEncontrada
            : this.t.programacion.resultadoDesconocido,
      error: true,
    });
    this.solicitud.update((actual) => ({ ...actual, intento: actual.intento + 1 }));
  }

  protected denegarEvidencia(status: number) {
    if (status === 401 || status === 403) this.accesoDenegado.set(status);
  }

  protected releerTrasEscritura(operacion: 'foto' | 'cierre') {
    // Puede invocarse desde el POST aún en curso: solo dispara lecturas, nunca otra escritura.
    this.avisoInicio.set({
      mensaje: operacion === 'foto' ? this.t.evidencia.errorSubida : this.t.evidencia.errorCierre,
      error: true,
    });
    this.solicitud.update((actual) => ({ ...actual, intento: actual.intento + 1 }));
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
