import { Component, output, signal } from '@angular/core';
import { TEXTOS } from '../textos';

/** Contrato 9: lo que recibe quien usa `<app-captura-foto>` (P5, P6 y P8). */
export interface FotoCapturada {
  /** Lado mayor de 1600 px como máximo, en WebP o JPEG (RN-ARC-02). */
  archivo: Blob;
  /** Lado mayor de 300 px, en el mismo formato (DT-ALM-04). */
  miniatura: Blob;
  latitud: number | null;
  longitud: number | null;
  /** ISO 8601 en UTC (RN-ARC-03). */
  capturada_en: string;
}

const LADO_FOTO = 1600;
const LADO_MINIATURA = 300;
const CALIDAD = 0.8;

@Component({
  selector: 'app-captura-foto',
  template: `
    <button
      type="button"
      class="rounded bg-blue-700 px-4 py-3 font-medium text-white disabled:opacity-50"
      [disabled]="procesando()"
      (click)="selector.click()"
    >
      {{ textos.boton }}
    </button>
    <input #selector type="file" accept="image/*" hidden (change)="alElegir(selector)" />
    @if (procesando()) {
      <p role="status">{{ textos.procesando }}</p>
    }
    @if (error()) {
      <p role="alert">{{ error() }}</p>
    }
  `,
})
export class CapturaFoto {
  readonly capturada = output<FotoCapturada>();

  protected readonly textos = TEXTOS.capturaFoto;
  protected readonly procesando = signal(false);
  protected readonly error = signal('');

  protected async alElegir(selector: HTMLInputElement): Promise<void> {
    const original = selector.files?.[0];
    selector.value = ''; // sin esto, elegir la misma foto otra vez no dispara (change)
    if (!original) {
      return;
    }
    this.procesando.set(true);
    this.error.set('');
    try {
      // DT-OFF-08: se comprime antes de que nadie la guarde
      const [imagen, ubicacion] = await Promise.all([
        createImageBitmap(original),
        ubicacionActual(),
      ]);
      const archivo = await comprimir(imagen, LADO_FOTO);
      const miniatura = await comprimir(imagen, LADO_MINIATURA);
      imagen.close();
      this.capturada.emit({
        archivo,
        miniatura,
        latitud: ubicacion?.latitude ?? null,
        longitud: ubicacion?.longitude ?? null,
        capturada_en: new Date(original.lastModified).toISOString(),
      });
    } catch (causa) {
      console.error('No se pudo procesar la foto', causa);
      this.error.set(this.textos.error);
    } finally {
      this.procesando.set(false);
    }
  }
}

async function comprimir(imagen: ImageBitmap, ladoMayor: number): Promise<Blob> {
  const escala = Math.min(1, ladoMayor / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  lienzo.getContext('2d')!.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  const webp = await aBlob(lienzo, 'image/webp');
  // Safari no codifica WebP y devuelve PNG
  return webp.type === 'image/webp' ? webp : aBlob(lienzo, 'image/jpeg');
}

function aBlob(lienzo: HTMLCanvasElement, tipo: string): Promise<Blob> {
  return new Promise((resolver, rechazar) =>
    lienzo.toBlob(
      (blob) => (blob ? resolver(blob) : rechazar(new Error(`El navegador no codificó ${tipo}`))),
      tipo,
      CALIDAD,
    ),
  );
}

// ponytail: GPS del dispositivo al elegir la foto, no el EXIF; si se suben fotos viejas de la
// galería, leer la ubicación del EXIF (p. ej. con exifr)
function ubicacionActual(): Promise<GeolocationCoordinates | null> {
  return new Promise((resolver) => {
    if (!navigator.geolocation) {
      resolver(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (posicion) => resolver(posicion.coords),
      () => resolver(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}
