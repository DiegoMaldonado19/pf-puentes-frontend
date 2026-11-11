import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TEXTOS } from '../../shared/textos';
import { MantenimientoService } from './mantenimiento.service';
import { OrdenMantenimientoDTO, PrioridadOrden, TipoOrden } from './modelos';

/** Descripción con texto real: un campo de solo espacios cuenta como vacío. */
function noEnBlanco(control: AbstractControl): ValidationErrors | null {
  const valor = typeof control.value === 'string' ? control.value.trim() : '';
  return valor.length === 0 ? { requerido: true } : null;
}

/**
 * Alta y edición de una orden de mantenimiento (B9). Al enviar se marcan todos los campos y cada
 * error aparece junto a su campo; el botón nunca queda deshabilitado por la validez del formulario.
 * En edición solo se envían el tipo y la descripción, que son lo único que el backend corrige.
 */
@Component({
  selector: 'app-formulario-orden',
  imports: [ReactiveFormsModule],
  templateUrl: './formulario-orden.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormularioOrden implements OnInit {
  readonly puenteId = input.required<string>();
  /** Sin orden: alta. Con orden: edición de tipo y descripción. */
  readonly orden = input<OrdenMantenimientoDTO | null>(null);
  readonly guardada = output<OrdenMantenimientoDTO>();
  readonly cancelada = output<void>();

  protected readonly t = TEXTOS.formularioOrden;
  protected readonly etiquetasTipo = TEXTOS.mantenimientoGlobal.tipos;
  protected readonly etiquetasPrioridad = TEXTOS.mantenimientoGlobal.prioridades;
  protected readonly tipos = Object.keys(this.etiquetasTipo) as TipoOrden[];
  protected readonly prioridades = Object.keys(this.etiquetasPrioridad) as PrioridadOrden[];

  private readonly servicio = inject(MantenimientoService);
  private readonly destruir = inject(DestroyRef);
  protected readonly enviando = signal(false);
  protected readonly errorEnvio = signal<string | null>(null);

  protected readonly formulario = inject(FormBuilder).nonNullable.group({
    tipo: ['CORRECTIVO' as TipoOrden, Validators.required],
    prioridad: ['MEDIA' as PrioridadOrden, Validators.required],
    elementoRef: ['', Validators.maxLength(200)],
    descripcion: ['', [noEnBlanco, Validators.maxLength(2000)]],
  });

  ngOnInit(): void {
    const actual = this.orden();
    if (actual) {
      this.formulario.patchValue({ tipo: actual.tipo, descripcion: actual.descripcion });
      this.formulario.controls.prioridad.disable();
      this.formulario.controls.elementoRef.disable();
    }
  }

  protected errorDescripcion(): string | null {
    const control = this.formulario.controls.descripcion;
    return control.touched && control.invalid ? this.t.errorDescripcion : null;
  }

  protected errorTipo(): string | null {
    const control = this.formulario.controls.tipo;
    return control.touched && control.invalid ? this.t.errorTipo : null;
  }

  protected errorPrioridad(): string | null {
    const control = this.formulario.controls.prioridad;
    return control.touched && control.invalid ? this.t.errorPrioridad : null;
  }

  protected enviar(): void {
    if (this.enviando()) return;
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid) return;

    const valor = this.formulario.getRawValue();
    const descripcion = valor.descripcion.trim();
    const actual = this.orden();
    this.enviando.set(true);
    this.errorEnvio.set(null);
    const peticion = actual
      ? this.servicio.editarOrden(this.puenteId(), actual.id, { tipo: valor.tipo, descripcion })
      : this.servicio.crearOrden(this.puenteId(), {
          tipo: valor.tipo,
          descripcion,
          elemento_ref: valor.elementoRef.trim() || null,
          prioridad: valor.prioridad,
        });
    peticion.pipe(takeUntilDestroyed(this.destruir)).subscribe({
      next: (guardada) => {
        this.enviando.set(false);
        this.guardada.emit(guardada);
      },
      error: () => {
        this.enviando.set(false);
        this.errorEnvio.set(this.t.errorGuardar);
      },
    });
  }
}
