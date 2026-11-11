import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, forwardRef, inject, Input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TEXTOS } from '../../../shared/textos';

@Component({
  selector: 'app-control-dano',
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ControlDanoComponent),
      multi: true,
    },
  ],
  template: `
    <div
      class="flex flex-wrap items-center gap-2"
      role="radiogroup"
      [attr.aria-label]="etiqueta || 'Calificación de daño'"
    >
      @for (valor of valores; track valor) {
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="valorSeleccionado === valor"
          [attr.aria-label]="obtenerDescripcion(valor)"
          [disabled]="deshabilitado"
          (click)="seleccionar(valor)"
          class="min-w-[44px] min-h-[44px] px-3.5 py-2 rounded-lg font-bold text-sm border-2 transition-all flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primario-700 shadow-xs cursor-pointer disabled:cursor-not-allowed"
          [ngClass]="obtenerClase(valor)"
        >
          {{ valor }}
        </button>
      }
      @if (valorSeleccionado !== null && valorSeleccionado !== undefined) {
        <span class="text-xs font-semibold ml-2 text-texto-secundario ">
          {{ obtenerDescripcion(valorSeleccionado) }}
        </span>
      }
    </div>
  `,
})
export class ControlDanoComponent implements ControlValueAccessor {
  @Input() etiqueta = '';
  @Input() deshabilitado = false;

  readonly valores = [0, 1, 2, 3, 4] as const;
  valorSeleccionado: number | null = null;

  private cdr = inject(ChangeDetectorRef);
  private onChange: (valor: number | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(valor: unknown): void {
    this.valorSeleccionado = valor !== null && valor !== undefined ? Number(valor) : null;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (valor: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.deshabilitado = isDisabled;
    this.cdr.markForCheck();
  }

  seleccionar(valor: number): void {
    if (this.deshabilitado) return;
    this.valorSeleccionado = valor;
    this.onChange(this.valorSeleccionado);
    this.onTouched();
    this.cdr.markForCheck();
  }

  obtenerDescripcion(valor: number): string {
    const escala = TEXTOS.formulario.motor.escalaDanos as Record<number, string>;
    return escala[valor] ?? `Nivel ${valor}`;
  }

  obtenerClase(valor: number): string {
    const esSeleccionado = this.valorSeleccionado === valor;

    if (this.deshabilitado) {
      return esSeleccionado
        ? 'bg-texto-secundario text-superficie border-texto-secundario cursor-not-allowed shadow-xs'
        : 'bg-lienzo text-texto-atenuado border-borde    cursor-not-allowed';
    }

    switch (valor) {
      case 0:
        return esSeleccionado
          ? 'bg-bueno text-superficie border-bueno shadow-sm'
          : 'bg-bueno-tinte text-bueno-texto border-bueno hover:bg-bueno-tinte    ';
      case 1:
        return esSeleccionado
          ? 'bg-regular-tinte text-regular-texto border-2 border-regular ring-2 ring-regular shadow-sm font-black'
          : 'bg-regular-tinte text-regular-texto border-regular hover:bg-regular-tinte    ';
      case 2:
        return esSeleccionado
          ? 'bg-regular text-superficie border-regular shadow-sm'
          : 'bg-regular-tinte text-regular-texto border-regular hover:bg-regular-tinte    ';
      case 3:
        return esSeleccionado
          ? 'bg-malo text-superficie border-malo shadow-sm'
          : 'bg-malo-tinte text-malo-texto border-malo hover:bg-malo-tinte    ';
      case 4:
        return esSeleccionado
          ? 'bg-primario-700 text-superficie border-primario-900 shadow-sm ring-1 ring-primario-900'
          : 'bg-primario-50 text-primario-900 border-primario-300 hover:bg-primario-100    ';
      default:
        return '';
    }
  }
}
