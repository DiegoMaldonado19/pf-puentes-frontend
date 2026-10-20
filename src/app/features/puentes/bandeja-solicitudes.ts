import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TEXTOS } from '../../shared/textos';
import { AdvertenciaDuplicado } from './advertencia-duplicado';
import { mensajeDeError, puentesCercanos } from './errores';
import { EstadoSolicitud, PuenteCercanoDTO, SolicitudPuenteDTO } from './modelos';
import { Paginacion } from './paginacion';
import { ROL_PUENTES } from './rol-puentes';
import { SolicitudesService } from './solicitudes.service';

type Accion = { tipo: 'aprobar' | 'rechazar'; id: string } | null;

/** RN-INV-07: el Admin resuelve; el Catedrático consulta las suyas (lo filtra el backend). */
@Component({
  selector: 'app-bandeja-solicitudes',
  imports: [
    AdvertenciaDuplicado,
    DatePipe,
    DecimalPipe,
    Paginacion,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './bandeja-solicitudes.html',
})
export class BandejaSolicitudes {
  protected readonly t = TEXTOS.puentes;
  protected readonly s = TEXTOS.puentes.solicitudes;
  protected readonly estados: readonly EstadoSolicitud[] = ['PENDIENTE', 'APROBADA', 'RECHAZADA'];
  protected readonly rol = inject(ROL_PUENTES);

  protected readonly estado = signal<EstadoSolicitud | ''>('PENDIENTE');
  protected readonly pagina = linkedSignal({ source: this.estado, computation: () => 0 });
  private readonly servicio = inject(SolicitudesService);
  protected readonly resultado = rxResource({
    params: () => ({ estado: this.estado() || null, pagina: this.pagina() }),
    stream: ({ params }) => this.servicio.listar(params.estado, params.pagina),
  });
  protected readonly errorListado = computed(() =>
    this.resultado.error() ? mensajeDeError(this.resultado.error()) : '',
  );

  protected readonly accion = signal<Accion>(null);
  protected readonly enviando = signal(false);
  protected readonly errorAccion = signal('');
  protected readonly cercanos = signal<readonly PuenteCercanoDTO[] | null>(null);
  protected readonly resuelta = signal<SolicitudPuenteDTO | null>(null);
  protected readonly motivo = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(500), Validators.pattern(/\S/)],
  });

  protected leer(evento: Event): string {
    return (evento.target as HTMLSelectElement).value;
  }

  protected abrir(tipo: 'aprobar' | 'rechazar', id: string): void {
    this.accion.set({ tipo, id });
    this.errorAccion.set('');
    this.cercanos.set(null);
    this.motivo.reset();
    if (tipo === 'aprobar') this.aprobar(id, false);
  }

  protected cerrar(): void {
    this.accion.set(null);
    this.cercanos.set(null);
  }

  protected aprobar(id: string, confirmar: boolean): void {
    this.enviando.set(true);
    this.servicio.aprobar(id, confirmar).subscribe({
      next: (solicitud) => this.terminar(solicitud),
      error: (error: unknown) => {
        this.enviando.set(false);
        const cercanos = puentesCercanos(error);
        if (cercanos) this.cercanos.set(cercanos);
        else this.errorAccion.set(mensajeDeError(error, this.t.errores.inesperado));
      },
    });
  }

  protected rechazar(id: string): void {
    if (this.motivo.invalid) {
      this.motivo.markAsTouched();
      return;
    }
    this.enviando.set(true);
    this.servicio.rechazar(id, this.motivo.value.trim()).subscribe({
      next: (solicitud) => this.terminar(solicitud),
      error: (error: unknown) => {
        this.enviando.set(false);
        this.errorAccion.set(mensajeDeError(error, this.t.errores.inesperado));
      },
    });
  }

  private terminar(solicitud: SolicitudPuenteDTO): void {
    this.enviando.set(false);
    this.accion.set(null);
    this.cercanos.set(null);
    this.resuelta.set(solicitud);
    this.resultado.reload();
  }
}
