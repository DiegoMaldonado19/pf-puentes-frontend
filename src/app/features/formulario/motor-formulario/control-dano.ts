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
      [attr.aria-label]="etiqueta || 'Calificación de daño'">
      @for (valor of valores; track valor) {
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="valorSeleccionado === valor"
          [attr.aria-label]="obtenerDescripcion(valor)"
          [disabled]="deshabilitado"
          (click)="seleccionar(valor)"
          class="min-w-[44px] min-h-[44px] px-3.5 py-2 rounded-lg font-bold text-sm border-2 transition-all flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-xs cursor-pointer disabled:cursor-not-allowed"
          [ngClass]="obtenerClase(valor)">
          {{ valor }}
        </button>
      }
      @if (valorSeleccionado !== null && valorSeleccionado !== undefined) {
        <span class="text-xs font-semibold ml-2 text-gray-700 dark:text-gray-200">
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
  private onChange: (valor: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(valor: any): void {
    this.valorSeleccionado = valor !== null && valor !== undefined ? Number(valor) : null;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
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
        ? 'bg-gray-600 text-white border-gray-700 cursor-not-allowed shadow-xs'
        : 'bg-gray-100 text-gray-500 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 cursor-not-allowed';
    }

    switch (valor) {
      case 0:
        return esSeleccionado
          ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
          : 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-700 dark:hover:bg-emerald-900/50';
      case 1:
        return esSeleccionado
          ? 'bg-amber-400 text-amber-950 border-amber-500 shadow-sm font-black'
          : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-700 dark:hover:bg-amber-900/50';
      case 2:
        return esSeleccionado
          ? 'bg-orange-600 text-white border-orange-700 shadow-sm'
          : 'bg-orange-50 text-orange-900 border-orange-300 hover:bg-orange-100 dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-700 dark:hover:bg-orange-900/50';
      case 3:
        return esSeleccionado
          ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
          : 'bg-rose-50 text-rose-900 border-rose-300 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-700 dark:hover:bg-rose-900/50';
      case 4:
        return esSeleccionado
          ? 'bg-purple-700 text-white border-purple-800 shadow-sm ring-1 ring-purple-900'
          : 'bg-purple-50 text-purple-950 border-purple-300 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-700 dark:hover:bg-purple-900/50';
      default:
        return '';
    }
  }
}
