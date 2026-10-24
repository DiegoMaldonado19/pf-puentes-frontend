import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TEXTOS } from '../../../shared/textos';
import { FormularioService } from '../../formulario/formulario.service';
import { FormularioVersionDTO } from '../../formulario/modelos';

@Component({
  selector: 'app-modal-publicar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
        <div
          class="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700"
        >
          <h3 class="text-lg font-bold text-gray-900 dark:text-white">
            {{ textos.publicarBorrador }}: {{ version.codigo }}
          </h3>
          <button (click)="cancelar.emit()" class="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div
          class="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200 text-xs leading-relaxed"
        >
          ⚠️ <strong>{{ textos.advertenciaInmutable }}</strong>
        </div>

        <div class="space-y-2">
          <label
            for="mapeo-json-input"
            class="block text-sm font-semibold text-gray-900 dark:text-white"
          >
            {{ textos.declararMapeo }}
          </label>
          <p class="text-xs text-gray-600 dark:text-gray-300">
            Define equivalencias JSON para conservar la comparabilidad histórica (ej.
            &#123;&quot;antiguo_campo&quot;: &quot;nuevo_campo&quot;&#125;).
          </p>
          <textarea
            id="mapeo-json-input"
            [(ngModel)]="mapeoJson"
            rows="4"
            class="w-full px-3 py-2 text-xs font-mono rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            [placeholder]="'{&quot;subestructura.viga_1&quot;: &quot;subestructura.viga_entrada&quot;}'"
          >
          </textarea>
          @if (errorFormato) {
            <p class="text-xs text-rose-600 font-semibold">{{ errorFormato }}</p>
          }
        </div>

        <div
          class="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700"
        >
          <button
            type="button"
            (click)="cancelar.emit()"
            [disabled]="publicando"
            class="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {{ textos.cancelar }}
          </button>
          <button
            type="button"
            (click)="confirmarPublicacion()"
            [disabled]="publicando"
            class="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {{ publicando ? 'Publicando…' : textos.publicar }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ModalPublicar {
  @Input({ required: true }) version!: FormularioVersionDTO;
  @Output() publicado = new EventEmitter<void>();
  @Output() cancelar = new EventEmitter<void>();

  private readonly formularioService = inject(FormularioService);
  readonly textos = TEXTOS.formulario.admin;

  mapeoJson = '';
  errorFormato = '';
  publicando = false;

  confirmarPublicacion(): void {
    let mapeoObj: Record<string, string> | undefined;

    if (this.mapeoJson.trim()) {
      try {
        mapeoObj = JSON.parse(this.mapeoJson);
      } catch {
        this.errorFormato = 'El mapeo debe ser un JSON válido.';
        return;
      }
    }

    this.publicando = true;
    this.errorFormato = '';

    this.formularioService.publicar(this.version.id, { mapeo: mapeoObj }).subscribe({
      next: () => {
        this.publicando = false;
        this.publicado.emit();
      },
      error: (err) => {
        this.publicando = false;
        this.errorFormato =
          err?.error?.detail || 'Ocurrió un error al intentar publicar la versión.';
      },
    });
  }
}
