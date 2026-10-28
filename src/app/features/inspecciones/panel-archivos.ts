import { Component, computed, input, output, signal } from '@angular/core';
import { CapturaFoto, FotoCapturada } from '../../shared/captura-foto/captura-foto';
import { TEXTOS } from '../../shared/textos';
import { ArchivoLocal } from './inspeccion-store';
import { MAXIMO_BYTES_PDF, MAXIMO_DOCUMENTOS, MAXIMO_FOTOS } from './modelos';

export interface FotoParaSubir {
  readonly foto: FotoCapturada;
  readonly elementoRef: string | null;
}

/**
 * Fotos y PDF de la inspección (P1). El servidor no lista lo ya subido, así que se muestra el
 * inventario de la sesión. La compresión y la miniatura las hace `<app-captura-foto>`.
 */
@Component({
  selector: 'app-panel-archivos',
  imports: [CapturaFoto],
  template: `
    <section class="rounded border border-slate-300 p-4" aria-labelledby="titulo-archivos">
      <h2 id="titulo-archivos" class="text-lg font-semibold">{{ t.titulo }}</h2>
      <p class="mt-1 text-sm text-slate-700">{{ t.sugerencia }}</p>
      <p class="mt-1 text-sm text-slate-600">{{ t.noListadas }}</p>

      @if (editable()) {
        @if (referencias().length) {
          <label class="mt-3 block text-sm font-medium" for="elemento-foto">{{ t.elemento }}</label>
          <select
            id="elemento-foto"
            class="mt-1 min-h-11 w-full max-w-md rounded border border-slate-400 px-2"
            (change)="elemento.set($any($event.target).value)"
          >
            <option value="">{{ t.sinElemento }}</option>
            @for (referencia of referencias(); track referencia) {
              <option [value]="referencia">{{ referencia }}</option>
            }
          </select>
        }
        <div class="mt-3 flex flex-wrap items-start gap-3">
          @if (puedeFoto()) {
            <app-captura-foto (capturada)="subirFoto($event)" />
          } @else {
            <p role="status" class="text-sm text-slate-700">
              {{ t.limiteFotos.replace('{maximo}', maximoFotos) }}
            </p>
          }
          @if (puedeDocumento()) {
            <div>
              <label
                class="inline-flex min-h-11 cursor-pointer items-center rounded border border-blue-700 px-4 py-2 font-medium text-blue-800"
                for="entrada-pdf"
                >{{ t.agregarPdf }}</label
              >
              <input
                id="entrada-pdf"
                type="file"
                accept="application/pdf"
                class="sr-only"
                (change)="alElegirPdf($event)"
              />
            </div>
          } @else {
            <p role="status" class="text-sm text-slate-700">
              {{ t.limiteDocumentos.replace('{maximo}', maximoDocumentos) }}
            </p>
          }
        </div>
        @if (errorPdf()) {
          <p role="alert" class="mt-2 text-sm text-red-800">{{ errorPdf() }}</p>
        }
      }

      <ul class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" [attr.aria-label]="t.titulo">
        @for (archivo of archivos(); track archivo.id) {
          <li class="flex items-start gap-3 rounded border border-slate-300 p-3">
            @if (archivo.miniaturaUrl) {
              <img
                [src]="archivo.miniaturaUrl"
                alt=""
                class="size-16 shrink-0 rounded object-cover"
              />
            } @else {
              <span
                class="flex size-16 shrink-0 items-center justify-center rounded bg-slate-100 text-sm font-bold"
                aria-hidden="true"
                >PDF</span
              >
            }
            <div class="min-w-0 flex-1">
              <p class="break-all text-sm font-medium">
                {{ archivo.tipo === 'FOTO' ? t.fotos : t.documentos }} · {{ archivo.nombre }}
              </p>
              @if (archivo.elemento_ref) {
                <p class="break-all text-xs text-slate-600">{{ archivo.elemento_ref }}</p>
              }
              <p
                class="text-sm"
                [class.text-green-800]="archivo.estado === 'subida'"
                [class.text-red-800]="archivo.estado === 'error'"
                [attr.role]="archivo.estado === 'error' ? 'alert' : 'status'"
              >
                {{ etiquetaEstado(archivo) }}
              </p>
              @if (editable()) {
                <div class="mt-1 flex gap-3">
                  @if (archivo.estado === 'error') {
                    <button
                      type="button"
                      class="min-h-11 text-blue-800 underline"
                      (click)="reintentar.emit(archivo.id)"
                    >
                      {{ t.reintentar }}
                    </button>
                  }
                  <button
                    type="button"
                    class="min-h-11 text-red-800 underline disabled:opacity-50"
                    [disabled]="archivo.estado === 'subiendo'"
                    (click)="quitar.emit(archivo.id)"
                  >
                    {{ t.quitar }}
                  </button>
                </div>
              }
            </div>
          </li>
        } @empty {
          <li class="text-sm text-slate-600 sm:col-span-2 lg:col-span-3">{{ t.sinArchivos }}</li>
        }
      </ul>
    </section>
  `,
})
export class PanelArchivos {
  readonly archivos = input.required<readonly ArchivoLocal[]>();
  readonly editable = input.required<boolean>();
  readonly referencias = input<readonly string[]>([]);
  readonly puedeFoto = input(true);
  readonly puedeDocumento = input(true);

  readonly foto = output<FotoParaSubir>();
  readonly documento = output<File>();
  readonly reintentar = output<string>();
  readonly quitar = output<string>();

  protected readonly t = TEXTOS.inspecciones.archivos;
  protected readonly maximoFotos = String(MAXIMO_FOTOS);
  protected readonly maximoDocumentos = String(MAXIMO_DOCUMENTOS);
  protected readonly elemento = signal('');
  protected readonly errorPdf = signal('');
  private readonly etiquetas = computed(() => ({
    subiendo: this.t.subiendo,
    subida: this.t.subida,
    error: this.t.error,
  }));

  protected etiquetaEstado(archivo: ArchivoLocal): string {
    return archivo.mensaje || this.etiquetas()[archivo.estado];
  }

  protected subirFoto(foto: FotoCapturada): void {
    this.foto.emit({ foto, elementoRef: this.elemento() || null });
  }

  protected alElegirPdf(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (!archivo) return;
    // La comprobación real es del servidor (413/422); aquí solo se evita el viaje inútil.
    const esPdf = archivo.type === 'application/pdf';
    if (!esPdf || archivo.size > MAXIMO_BYTES_PDF) {
      this.errorPdf.set(this.t.pdfInvalido);
      return;
    }
    this.errorPdf.set('');
    this.documento.emit(archivo);
  }
}
