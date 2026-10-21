import {
  Component,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { Map as MapaMapLibre, Marker } from 'maplibre-gl';
import { TEXTOS } from '../../../shared/textos';
import { CARGADOR_MAPLIBRE, CENTRO_GUATEMALA, ESTILO_OSM } from './maplibre';

export interface Coordenadas {
  readonly latitud: number;
  readonly longitud: number;
}

/** Mapa pequeño: muestra la ubicación (ficha) o permite elegirla con un clic (formulario). */
@Component({
  selector: 'app-mapa-ubicacion',
  template: `
    <div
      #contenedor
      role="region"
      [attr.aria-label]="t.ubicacion"
      class="h-64 w-full overflow-hidden rounded border border-slate-300 bg-slate-100"
    ></div>
    @if (error()) {
      <p role="status" class="mt-1 text-sm text-slate-700">{{ t.errorMapa }}</p>
    } @else if (seleccionable()) {
      <p class="mt-1 text-sm text-slate-700">{{ t.elegir }}</p>
    }
  `,
})
export class MapaUbicacion implements OnDestroy {
  readonly latitud = input<number | null>(null);
  readonly longitud = input<number | null>(null);
  readonly seleccionable = input(false);
  readonly elegido = output<Coordenadas>();
  protected readonly t = TEXTOS.puentes.mapa;
  protected readonly error = signal(false);

  private readonly contenedor = viewChild.required<ElementRef<HTMLElement>>('contenedor');
  private readonly cargar = inject(CARGADOR_MAPLIBRE);
  private readonly listo = signal(false);
  private mapa?: MapaMapLibre;
  private marcador?: Marker;
  private destruido = false;

  constructor() {
    void this.iniciar();
    effect(() => {
      const lat = this.latitud();
      const lon = this.longitud();
      if (!this.listo() || !this.mapa || !this.marcador) return;
      if (lat === null || lon === null || Number.isNaN(lat) || Number.isNaN(lon)) {
        this.marcador.remove();
        return;
      }
      this.marcador.setLngLat([lon, lat]).addTo(this.mapa);
      this.mapa.easeTo({ center: [lon, lat] });
    });
  }

  private async iniciar(): Promise<void> {
    try {
      const maplibre = await this.cargar();
      if (this.destruido) return;
      const lat = this.latitud();
      const lon = this.longitud();
      const conPunto = lat !== null && lon !== null;
      this.mapa = new maplibre.Map({
        container: this.contenedor().nativeElement,
        style: ESTILO_OSM,
        center: conPunto ? [lon, lat] : CENTRO_GUATEMALA,
        zoom: conPunto ? 14 : 6,
      });
      this.mapa.addControl(new maplibre.NavigationControl({ showCompass: false }));
      this.marcador = new maplibre.Marker({ color: '#1d4ed8' });
      if (this.seleccionable()) {
        this.mapa.on('click', (evento) =>
          this.elegido.emit({
            // ~10 cm de precisión basta y evita decimales sin sentido en el formulario
            latitud: Number(evento.lngLat.lat.toFixed(6)),
            longitud: Number(evento.lngLat.lng.toFixed(6)),
          }),
        );
      }
      this.listo.set(true);
    } catch {
      this.error.set(true);
    }
  }

  ngOnDestroy(): void {
    this.destruido = true;
    this.mapa?.remove();
  }
}
