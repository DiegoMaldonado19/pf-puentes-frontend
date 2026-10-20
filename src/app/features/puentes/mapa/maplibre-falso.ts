import { MapLibre } from './maplibre';

/** MapLibre de mentira para pruebas: jsdom no tiene WebGL. Registra lo que la pantalla crea. */
export class MapLibreFalso {
  readonly mapas: MapaFalso[] = [];
  readonly marcadores: MarcadorFalso[] = [];

  modulo(): MapLibre {
    const { mapas, marcadores } = this;
    class Mapa extends MapaFalso {
      constructor(opciones: unknown) {
        super(opciones);
        mapas.push(this);
      }
    }
    class Marcador extends MarcadorFalso {
      constructor(opciones?: { element?: HTMLElement }) {
        super(opciones);
        marcadores.push(this);
      }
    }
    return {
      Map: Mapa,
      Marker: Marcador,
      Popup: PopupFalso,
      LngLatBounds: LimitesFalsos,
      NavigationControl: class {},
    } as unknown as MapLibre;
  }
}

export class MapaFalso {
  readonly eventos = new Map<string, (evento: unknown) => void>();
  limites: unknown;
  constructor(readonly opciones: unknown) {}
  addControl() {
    return this;
  }
  on(evento: string, manejador: (evento: unknown) => void) {
    this.eventos.set(evento, manejador);
    return this;
  }
  fitBounds(limites: unknown) {
    this.limites = limites;
    return this;
  }
  setCenter() {
    return this;
  }
  setZoom() {
    return this;
  }
  easeTo() {
    return this;
  }
  remove() {
    return this;
  }
}

export class MarcadorFalso {
  readonly elemento?: HTMLElement;
  posicion?: [number, number];
  popup?: PopupFalso;
  constructor(opciones?: { element?: HTMLElement }) {
    this.elemento = opciones?.element;
  }
  setLngLat(posicion: [number, number]) {
    this.posicion = posicion;
    return this;
  }
  setPopup(popup: PopupFalso) {
    this.popup = popup;
    return this;
  }
  addTo() {
    return this;
  }
  remove() {
    return this;
  }
}

export class PopupFalso {
  contenido?: HTMLElement;
  setDOMContent(contenido: HTMLElement) {
    this.contenido = contenido;
    return this;
  }
}

class LimitesFalsos {
  readonly puntos: [number, number][] = [];
  extend(punto: [number, number]) {
    this.puntos.push(punto);
    return this;
  }
}
