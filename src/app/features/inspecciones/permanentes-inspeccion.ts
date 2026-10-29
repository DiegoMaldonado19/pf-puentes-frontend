import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TEXTOS } from '../../shared/textos';
import { MotorFormularioComponent } from '../formulario/motor-formulario/motor-formulario';
import { mensajeInspeccion } from './errores';
import { esquemaSoloPermanentes, extraerPermanentes, fusionarProfundo } from './esquema';
import { InspeccionApi } from './inspeccion-api';
import { InspeccionStore } from './inspeccion-store';
import { DatosPermanentesDTO } from './modelos';

/**
 * US-P5-05 / RN-INS-09: el servidor precarga los permanentes de la última publicada del puente
 * (sin daños). Aquí se muestran con el motor filtrado por `x-permanente` y se confirman.
 */
@Component({
  selector: 'app-permanentes-inspeccion',
  imports: [MotorFormularioComponent, RouterLink],
  providers: [InspeccionStore],
  template: `
    <section class="mx-auto max-w-5xl p-4" aria-labelledby="titulo-permanentes">
      <a [routerLink]="['/inspecciones', id()]" class="hvc-link">← {{ t.volver }}</a>
      <h1 id="titulo-permanentes" class="text-h1 mt-3">{{ t.titulo }}</h1>
      <p class="text-muted my-3">{{ t.descripcion }}</p>

      @if (cargando()) {
        <p role="status">{{ comun.cargando }}</p>
      } @else if (store.noEncontrada()) {
        <p role="alert" class="rounded border border-slate-500 bg-slate-100 p-3">
          {{ capturaTextos.noEncontradaDetalle }}
        </p>
      } @else if (errorCarga()) {
        <p role="alert" class="hvc-alert">
          {{ errorCarga() }}
        </p>
      } @else if (store.inspeccion(); as inspeccion) {
        @if (precarga(); as precargados) {
          <p class="text-muted mb-2">
            @if (precargados.origen_inspeccion_id) {
              {{ t.origen.replace('{id}', precargados.origen_inspeccion_id) }}
            } @else {
              {{ t.sinOrigen }}
            }
            @if (precargados.anio_construccion) {
              <span class="block">
                {{ t.anio.replace('{anio}', '' + precargados.anio_construccion) }}
              </span>
            }
          </p>
        }
        @if (!store.editable()) {
          <p role="note" class="mb-3 rounded border border-slate-500 bg-slate-100 p-3">
            {{ capturaTextos.soloLecturaEstado }}
          </p>
        }
        @if (esquemaPermanentes(); as esquema) {
          @if (hayCampos()) {
            <app-motor-formulario
              [esquema]="esquema"
              [datos]="datosIniciales()"
              [modo]="store.editable() ? 'edicion' : 'lectura'"
              [erroresServidor]="store.erroresMotor()"
              (datosChange)="datosEditados.set($event)"
            />
          } @else {
            <p role="status" class="rounded bg-slate-100 p-4">{{ t.sinCampos }}</p>
          }
        }

        @if (store.errores().length) {
          <ul role="alert" class="hvc-alert mt-3 list-disc pl-8">
            @for (error of store.errores(); track $index) {
              <li>{{ error.campo }}: {{ error.mensaje }}</li>
            }
          </ul>
        } @else if (store.error()) {
          <p role="alert" class="hvc-alert mt-3">
            {{ store.error() }}
          </p>
        }
        @if (store.editable()) {
          <button
            type="button"
            class="btn-hvc-primary mt-5"
            [disabled]="store.confirmando()"
            (click)="confirmar(inspeccion.id)"
          >
            {{ store.confirmando() ? t.confirmando : t.confirmar }}
          </button>
        }
      }
    </section>
  `,
})
export class PermanentesInspeccion {
  readonly id = input.required<string>();

  protected readonly store = inject(InspeccionStore);
  protected readonly t = TEXTOS.inspecciones.permanentes;
  protected readonly comun = TEXTOS.inspecciones.comun;
  protected readonly capturaTextos = TEXTOS.inspecciones.captura;
  protected readonly precarga = signal<DatosPermanentesDTO | null>(null);
  protected readonly datosEditados = signal<Record<string, unknown> | null>(null);
  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal('');

  private readonly api = inject(InspeccionApi);
  private readonly router = inject(Router);

  protected readonly esquemaPermanentes = computed(() => {
    const esquema = this.store.version()?.esquema;
    return esquema ? esquemaSoloPermanentes(esquema) : null;
  });
  protected readonly hayCampos = computed(
    () => Object.keys(this.esquemaPermanentes()?.properties ?? {}).length > 0,
  );
  /** La precarga del servidor, cubierta por lo que el autor ya confirmó o escribió. */
  protected readonly datosIniciales = computed(() => {
    const esquema = this.store.version()?.esquema;
    const propios = this.store.inspeccion()?.datos ?? {};
    const base = this.precarga()?.datos ?? {};
    return esquema ? fusionarProfundo(base, extraerPermanentes(propios, esquema)) : base;
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.cargar(id));
    });
  }

  private async cargar(id: string): Promise<void> {
    this.cargando.set(true);
    this.errorCarga.set('');
    await this.store.cargar(id);
    if (this.store.inspeccion() && this.store.editable()) {
      try {
        this.precarga.set(await firstValueFrom(this.api.datosPermanentes(id)));
      } catch (error) {
        this.errorCarga.set(mensajeInspeccion(error));
      }
    }
    this.cargando.set(false);
  }

  protected async confirmar(id: string): Promise<void> {
    // Sin ediciones se confirma la precarga tal como llegó.
    const datos = this.datosEditados() ?? this.datosIniciales();
    if (await this.store.confirmarPermanentes(datos)) {
      await this.router.navigate(['/inspecciones', id]);
    }
  }
}
