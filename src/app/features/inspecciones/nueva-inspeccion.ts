import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { erroresDeCampo } from '../../core/errores/problema';
import { TEXTOS } from '../../shared/textos';
import { mensajeDeError } from '../puentes/errores';
import { PuentesService } from '../puentes/puentes.service';
import { hoyGuatemala, idDispositivo, nuevaClave, nuevoId, ubicacionActual } from './dispositivo';
import { mensajeInspeccion, tipoDeError } from './errores';
import { InspeccionApi } from './inspeccion-api';
import { CrearInspeccionDTO, MAXIMO_MOTIVO_CORRECCION } from './modelos';

type EstadoUbicacion = 'pendiente' | 'obteniendo' | 'obtenida' | 'no-disponible';

/** US-P5-04: fecha, GPS (opcional) y, si es corrección, su motivo. */
@Component({
  selector: 'app-nueva-inspeccion',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="mx-auto max-w-2xl p-4" aria-labelledby="titulo-nueva">
      <a routerLink="/inspecciones/puentes" class="text-blue-800 underline">← {{ comun.volver }}</a>
      <h1 id="titulo-nueva" class="mt-3 text-2xl font-bold">
        {{ esCorreccion() ? t.tituloCorreccion : t.titulo }}
      </h1>

      @if (puente.isLoading()) {
        <p role="status" class="mt-4">{{ comun.cargando }}</p>
      } @else if (puente.error()) {
        <p role="alert" class="mt-4 rounded border border-red-700 bg-red-50 p-3 text-red-900">
          {{ t.puenteNoDisponible }} {{ errorPuente() }}
        </p>
      } @else if (puente.value(); as p) {
        <p class="mt-2">
          <span class="font-mono text-sm text-slate-700">{{ p.codigo }}</span>
          <span class="ml-2 text-lg font-semibold">{{ p.nombre }}</span>
        </p>
        <p class="my-3 text-slate-700">{{ t.descripcion }}</p>
        @if (esCorreccion()) {
          <p class="mb-3 rounded border border-blue-700 bg-blue-50 p-3 text-blue-900">
            {{ t.corrige.replace('{id}', corrige() ?? '') }}
          </p>
        }

        <form [formGroup]="formulario" class="grid gap-5" (ngSubmit)="iniciar()">
          <div class="grid gap-1">
            <label class="font-medium" for="fecha">{{ t.fecha }}</label>
            <input
              id="fecha"
              type="date"
              class="min-h-11 rounded border border-slate-400 px-2"
              formControlName="fecha"
              [min]="minimo()"
              [max]="hoy"
              aria-describedby="ayuda-fecha"
            />
            <p id="ayuda-fecha" class="text-sm text-slate-600">{{ t.fechaAyuda }}</p>
            @if (errorFecha(); as mensaje) {
              <p role="alert" class="text-sm text-red-800">{{ mensaje }}</p>
            }
          </div>

          <div class="grid gap-2 rounded border border-slate-300 p-3" aria-live="polite">
            <p class="font-medium">{{ t.ubicacion }}</p>
            <p class="text-sm" [class.text-red-800]="ubicacion() === 'no-disponible'">
              {{ textoUbicacion() }}
            </p>
            <button
              type="button"
              class="min-h-11 w-fit rounded border border-blue-700 px-4 text-blue-800 disabled:opacity-50"
              [disabled]="ubicacion() === 'obteniendo'"
              (click)="obtenerUbicacion()"
            >
              {{ ubicacion() === 'pendiente' ? t.obtenerUbicacion : t.reintentarUbicacion }}
            </button>
          </div>

          @if (esCorreccion()) {
            <div class="grid gap-1">
              <label class="font-medium" for="motivo">{{ t.motivo }}</label>
              <textarea
                id="motivo"
                rows="3"
                class="rounded border border-slate-400 p-2"
                formControlName="motivo"
                [attr.maxlength]="maximoMotivo"
                aria-describedby="ayuda-motivo"
              ></textarea>
              <p id="ayuda-motivo" class="text-sm text-slate-600">{{ t.motivoAyuda }}</p>
              @if (formulario.controls.motivo.touched && formulario.controls.motivo.invalid) {
                <p role="alert" class="text-sm text-red-800">{{ t.motivoObligatorio }}</p>
              }
            </div>
          }

          @if (error()) {
            <p role="alert" class="rounded border border-red-700 bg-red-50 p-3 text-red-900">
              {{ error() }}
            </p>
          }

          <button
            type="submit"
            class="min-h-11 w-fit rounded bg-blue-700 px-6 font-medium text-white disabled:opacity-50"
            [disabled]="enviando()"
          >
            {{ enviando() ? t.iniciando : t.iniciar }}
          </button>
        </form>
      }
    </section>
  `,
})
export class NuevaInspeccion implements OnInit {
  /** Parámetro :puenteId de la ruta; `curso` y `corrige` llegan como query params. */
  readonly puenteId = input.required<string>();
  readonly curso = input<string | undefined>(undefined);
  readonly corrige = input<string | undefined>(undefined);

  protected readonly t = TEXTOS.inspecciones.nueva;
  protected readonly comun = TEXTOS.inspecciones.comun;
  protected readonly hoy = hoyGuatemala();
  protected readonly maximoMotivo = MAXIMO_MOTIVO_CORRECCION;
  protected readonly esCorreccion = computed(() => !!this.corrige());
  protected readonly ubicacion = signal<EstadoUbicacion>('pendiente');
  protected readonly enviando = signal(false);
  protected readonly error = signal('');
  protected readonly errorFechaServidor = signal('');

  protected readonly formulario = new FormGroup({
    fecha: new FormControl(this.hoy, { nonNullable: true, validators: [Validators.required] }),
    motivo: new FormControl('', { nonNullable: true }),
  });

  private readonly api = inject(InspeccionApi);
  private readonly puentes = inject(PuentesService);
  private readonly router = inject(Router);
  private coordenadas: { latitud: number; longitud: number } | null = null;
  // El id y la clave nacen una vez: reintentar el alta con ellos no crea otra inspección.
  private idInspeccion = nuevoId();
  private claveAlta = nuevaClave();

  protected readonly puente = rxResource({
    params: () => this.puenteId(),
    stream: ({ params }) => this.puentes.detalle(params),
  });
  protected readonly errorPuente = computed(() =>
    this.puente.error() ? mensajeDeError(this.puente.error()) : '',
  );
  protected readonly minimo = computed(() => {
    const anio = this.puente.value()?.anio_construccion;
    return anio ? `${anio}-01-01` : '';
  });
  /** Método y no `computed`: el estado de un FormControl no es una señal. */
  protected errorFecha(): string {
    const control = this.formulario.controls.fecha;
    const valor = control.value;
    if (this.errorFechaServidor()) return this.errorFechaServidor();
    if (!control.touched && !control.dirty) return '';
    if (!valor || valor > this.hoy) return this.t.fechaInvalida;
    const minimo = this.minimo();
    if (minimo && valor < minimo) {
      return this.t.fechaAnterior.replace('{anio}', minimo.slice(0, 4));
    }
    return '';
  }

  ngOnInit(): void {
    if (this.corrige()) {
      this.formulario.controls.motivo.addValidators([
        Validators.required,
        Validators.pattern(/\S/),
        Validators.maxLength(MAXIMO_MOTIVO_CORRECCION),
      ]);
    }
    void this.obtenerUbicacion();
  }

  protected textoUbicacion(): string {
    const coordenadas = this.coordenadas;
    switch (this.ubicacion()) {
      case 'obteniendo':
        return this.t.obteniendo;
      case 'obtenida':
        return this.t.ubicacionObtenida
          .replace('{latitud}', coordenadas!.latitud.toFixed(5))
          .replace('{longitud}', coordenadas!.longitud.toFixed(5));
      case 'no-disponible':
        return this.t.ubicacionNoDisponible;
      default:
        return this.t.ubicacionPendiente;
    }
  }

  protected async obtenerUbicacion(): Promise<void> {
    this.ubicacion.set('obteniendo');
    this.coordenadas = await ubicacionActual();
    this.ubicacion.set(this.coordenadas ? 'obtenida' : 'no-disponible');
  }

  protected async iniciar(): Promise<void> {
    this.formulario.markAllAsTouched();
    this.errorFechaServidor.set('');
    if (this.formulario.invalid || this.errorFecha() || this.enviando()) return;
    this.enviando.set(true);
    this.error.set('');
    try {
      const creada = await firstValueFrom(this.api.crear(this.cuerpo(), { clave: this.claveAlta }));
      await this.router.navigate(['/inspecciones', creada.id, 'permanentes']);
    } catch (error) {
      this.alFallar(error);
    } finally {
      this.enviando.set(false);
    }
  }

  private cuerpo(): CrearInspeccionDTO {
    const { fecha, motivo } = this.formulario.getRawValue();
    const corrige = this.corrige();
    return {
      id: this.idInspeccion,
      puente_id: this.puenteId(),
      fecha_inspeccion: fecha,
      dispositivo_id: idDispositivo(),
      creada_en_dispositivo: new Date().toISOString(),
      // El curso solo viaja si vino de la lista; si no, el servidor lo resuelve por usuario.
      ...(this.curso() ? { curso_id: this.curso() } : {}),
      ...(this.coordenadas ?? {}),
      ...(corrige ? { supersede_a_id: corrige, motivo_correccion: motivo.trim() } : {}),
    };
  }

  private alFallar(error: unknown): void {
    const tipo = tipoDeError(error);
    if (tipo === 'fecha-inspeccion-invalida') {
      this.errorFechaServidor.set(mensajeInspeccion(error));
      return;
    }
    if (tipo === 'inspeccion-en-conflicto') {
      // El id pertenece a otro autor: se genera otro y la clave de la operación cambia con él.
      this.idInspeccion = nuevoId();
      this.claveAlta = nuevaClave();
    }
    const campos = erroresDeCampo(error);
    const fecha = campos.find((c) => c.campo === 'fecha_inspeccion');
    if (fecha) this.errorFechaServidor.set(fecha.mensaje);
    this.error.set(mensajeInspeccion(error));
  }
}
