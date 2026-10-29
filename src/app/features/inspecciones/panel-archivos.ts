import { Component, computed, input, output, signal } from '@angular/core';
import { CapturaFoto, FotoCapturada } from '../../shared/captura-foto/captura-foto';
import { TEXTOS } from '../../shared/textos';
import { ArchivoLocal } from './inspeccion-store';
import { MAXIMO_BYTES_PDF, MAXIMO_DOCUMENTOS, MAXIMO_FOTOS } from './modelos';

export interface FotoParaSubir {
  readonly foto: FotoCapturada;
  readonly elementoRef: string | null;
}

/** Fotos y PDF remotos y de la sesión; CapturaFoto comprime las nuevas imágenes. */
@Component({
  selector: 'app-panel-archivos',
  imports: [CapturaFoto],
  template: `
    <section class="hvc-card" aria-labelledby="titulo-archivos">
      <h2 id="titulo-archivos" class="text-lg font-semibold">{{ t.titulo }}</h2>
      <p class="text-muted mt-1">{{ t.sugerencia }}</p>

      @if (editable()) {
        @if (referencias().length) {
          <label class="mt-3 block text-sm font-medium" for="elemento-foto">{{ t.elemento }}</label>
          <select
            id="elemento-foto"
            class="hvc-input mt-1 w-full max-w-md"
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
            <p role="status" class="text-muted">
              {{ t.limiteFotos.replace('{maximo}', maximoFotos) }}
            </p>
          }
          @if (puedeDocumento()) {
            <div>
              <label class="btn-hvc-secondary inline-flex items-center" for="entrada-pdf">{{
                t.agregarPdf
              }}</label>
              <input
                id="entrada-pdf"
                type="file"
                accept="application/pdf"
                class="sr-only"
                (change)="alElegirPdf($event)"
              />
            </div>
          } @else {
            <p role="status" class="text-muted">
              {{ t.limiteDocumentos.replace('{maximo}', maximoDocumentos) }}
            </p>
          }
        </div>
        @if (errorPdf()) {
          <p role="alert" class="hvc-error mt-2">{{ errorPdf() }}</p>
        }
      }

      <ul class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" [attr.aria-label]="t.titulo">
        @for (archivo of archivos(); track archivo.id) {
          <li class="hvc-card flex items-start gap-3">
            @if (archivo.miniaturaUrl || (archivo.tipo === 'FOTO' && archivo.url)) {
              <img
                [src]="archivo.miniaturaUrl || archivo.url"
                alt=""
                class="size-16 shrink-0 rounded object-cover"
              />
            } @else {
              <span
                class="flex size-16 shrink-0 items-center justify-center rounded bg-slate-100 text-sm font-bold"
                aria-hidden="true"
                >{{ archivo.tipo === 'DOCUMENTO' ? 'PDF' : 'FOTO' }}</span
              >
            }
            <div class="min-w-0 flex-1">
              <p class="break-all text-sm font-medium">
                {{ archivo.tipo === 'FOTO' ? t.fotos : t.documentos }} · {{ archivo.nombre }}
              </p>
              @if (archivo.url) {
                <a [href]="archivo.url" target="_blank" rel="noopener noreferrer" class="hvc-link"
                  >Abrir archivo</a
                >
              } @else if (archivo.estado === 'subida') {
                <p class="text-muted">Archivo no disponible.</p>
              }
              @if (archivo.elemento_ref) {
                <p class="text-muted break-all">{{ archivo.elemento_ref }}</p>
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
                    <button type="button" class="hvc-link" (click)="reintentar.emit(archivo.id)">
                      {{ t.reintentar }}
                    </button>
                  }
                  <button
                    type="button"
                    class="btn-hvc-danger"
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
          <li class="text-muted sm:col-span-2 lg:col-span-3">{{ t.sinArchivos }}</li>
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
