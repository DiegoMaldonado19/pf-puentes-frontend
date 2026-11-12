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
    <div class="fixed inset-0 bg-texto/50 z-50 flex items-center justify-center p-4">
      <div class="bg-superficie  rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
        <div class="flex items-center justify-between pb-3 border-b border-borde ">
          <h3 class="text-lg font-bold text-texto ">
            {{ textos.publicarBorrador }}: {{ version.codigo }}
          </h3>
          <button (click)="cancelar.emit()" class="text-texto-atenuado hover:text-texto-secundario">
            ✕
          </button>
        </div>

        <div class="hvc-alert hvc-alert--warn bg-regular-tinte  border-regular  ">
          ⚠️ <strong>{{ textos.advertenciaInmutable }}</strong>
        </div>

        <div class="space-y-2">
          <label for="mapeo-json-input" class="block text-sm font-semibold text-texto ">
            {{ textos.declararMapeo }}
          </label>
          <p class="text-xs text-texto-secundario ">
            Define equivalencias JSON para conservar la comparabilidad histórica (ej.
            &#123;&quot;antiguo_campo&quot;: &quot;nuevo_campo&quot;&#125;).
          </p>
          <textarea
            id="mapeo-json-input"
            [(ngModel)]="mapeoJson"
            rows="4"
            class="w-full px-3 py-2 text-xs font-mono rounded-lg border border-borde  bg-lienzo  text-texto  focus:ring-2 focus:ring-primario-700"
            [placeholder]="'{&quot;subestructura.viga_1&quot;: &quot;subestructura.viga_entrada&quot;}'"
          >
          </textarea>
          @if (errorFormato) {
            <p class="text-xs text-malo font-semibold">{{ errorFormato }}</p>
          }
        </div>

        <div class="flex items-center justify-end gap-3 pt-4 border-t border-borde ">
          <button
            type="button"
            (click)="cancelar.emit()"
            [disabled]="publicando"
            class="px-4 py-2 text-sm font-medium rounded-lg border border-borde  text-texto-secundario  hover:bg-lienzo "
          >
            {{ textos.cancelar }}
          </button>
          <button
            type="button"
            (click)="confirmarPublicacion()"
            [disabled]="publicando"
            class="btn-hvc-primary"
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
