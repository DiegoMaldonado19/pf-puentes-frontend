import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, of } from 'rxjs';
import { TEXTOS } from '../../../shared/textos';
import { JuegoPesosDTO } from './modelos';
import { PesosService } from './pesos.service';

@Component({
  selector: 'app-creacion-pesos',
  imports: [ReactiveFormsModule],
  templateUrl: './creacion-pesos.html',
})
export class CreacionPesos {
  readonly formularioVersionId = input.required<string>();
  readonly permitido = input(false);
  readonly creado = output<JuegoPesosDTO>();
  private readonly servicio = inject(PesosService);
  private readonly destruccion = inject(DestroyRef);
  protected readonly t = TEXTOS.pesos.creacion;
  protected readonly comun = TEXTOS.pesos;
  protected readonly enviando = signal(false);
  readonly envioPendiente = this.enviando.asReadonly();
  protected readonly error = signal('');
  protected readonly bloqueado = signal(false);
  protected readonly referencias = rxResource({
    params: () => ({ id: this.formularioVersionId(), permiso: this.permitido() }),
    stream: ({ params }) =>
      params.permiso ? this.servicio.referenciasParaCrear(params.id) : of([]),
  });
  protected readonly errorCarga = computed(() => {
    const error = this.referencias.error();
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) return this.comun.sinConexion;
      if (error.status === 401) return this.comun.sinSesion;
      if (error.status === 403) return this.comun.sinPermiso;
      if (![404, 422].includes(error.status)) return this.comun.error;
    }
    return this.t.esquemaCambio;
  });
  protected readonly formulario = new FormGroup({
    acta: new FormControl('', {
      nonNullable: true,
      validators: [
        (control) => (Array.from(String(control.value)).length <= 300 ? null : { actaLarga: true }),
      ],
    }),
    pesos: new FormArray<FormControl<number | null>>([]),
  });
  protected readonly disponible = computed(
    () =>
      this.permitido() &&
      this.referencias.hasValue() &&
      !this.referencias.isLoading() &&
      !this.referencias.error(),
  );

  constructor() {
    effect(() => {
      const referencias = this.referencias.hasValue() ? this.referencias.value() : [];
      this.formulario.setControl(
        'pesos',
        new FormArray(
          referencias.map(
            () =>
              new FormControl<number | null>(null, [
                Validators.required,
                Validators.min(0.001),
                Validators.max(999.999),
                Validators.pattern(/^\d+(?:\.\d{1,3})?$/),
              ]),
          ),
        ),
      );
      this.formulario.controls.acta.reset();
      this.error.set('');
      this.bloqueado.set(false);
    });
  }

  protected guardar() {
    if (!this.disponible() || this.enviando() || this.bloqueado()) return;
    const referencias = this.referencias.value()!;
    if (!referencias.length || this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.error.set(this.t.invalidos);
      return;
    }
    const id = this.formularioVersionId();
    const valor = this.formulario.getRawValue();
    this.error.set('');
    this.enviando.set(true);
    this.servicio
      .crearJuego(id, {
        acta: valor.acta.trim() || null,
        pesos: referencias.map((ref, i) => ({ elemento_ref: ref, peso: valor.pesos[i]! })),
      })
      .pipe(
        takeUntilDestroyed(this.destruccion),
        finalize(() => this.enviando.set(false)),
      )
      .subscribe({
        next: (juego) => {
          this.bloqueado.set(true);
          this.enviando.set(false);
          if (this.permitido() && id === this.formularioVersionId()) this.creado.emit(juego);
        },
        error: (error: unknown) => {
          const status = error instanceof HttpErrorResponse ? error.status : 0;
          this.bloqueado.set(status !== 400);
          this.error.set(
            status === 400
              ? this.t.invalidos
              : status === 401
                ? this.comun.sinSesion
                : status === 403
                  ? this.comun.sinPermiso
                  : [404, 422].includes(status)
                    ? this.t.esquemaCambio
                    : this.t.incierto,
          );
        },
      });
  }
}
