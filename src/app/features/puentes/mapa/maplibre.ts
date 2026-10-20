import { InjectionToken } from '@angular/core';
import type { StyleSpecification } from 'maplibre-gl';
import { EstadoCondicion } from '../../../shared/estado-puente/estado-puente';

export type MapLibre = typeof import('maplibre-gl');

/**
 * MapLibre pesa ~200 kB comprimido: se importa solo al abrir un mapa, nunca en el paquete inicial
 * (DT-FE-06). Su CSS sale aparte (maplibre.css, inject: false en angular.json) y su worker se copia a
 * /maplibre/ para que se cargue desde el mismo origen (CSP worker-src 'self').
 */
export async function importarMapLibre(): Promise<MapLibre> {
  if (!document.querySelector('link[data-maplibre]')) {
    const hoja = document.createElement('link');
    hoja.rel = 'stylesheet';
    hoja.href = 'maplibre.css';
    hoja.dataset['maplibre'] = '';
    document.head.append(hoja);
  }
  const maplibre = await import('maplibre-gl');
  maplibre.setWorkerUrl(new URL('maplibre/maplibre-gl-worker.mjs', document.baseURI).href);
  return maplibre;
}

/** Se sustituye en las pruebas: jsdom no tiene WebGL. */
export const CARGADOR_MAPLIBRE = new InjectionToken<() => Promise<MapLibre>>('CARGADOR_MAPLIBRE', {
  providedIn: 'root',
  factory: () => importarMapLibre,
});

/** DT-FE-14: teselas de OpenStreetMap sin API key; la licencia exige la atribución. */
export const ESTILO_OSM: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

export const CENTRO_GUATEMALA: [number, number] = [-90.35, 15.75];

type ClaveEstado = EstadoCondicion | 'SIN_EVALUAR';

/**
 * DT-FE-13: el marcador lleva color y letra (B, R, M, S) y su aria-label dice el estado; nunca
 * solo color. Letras oscuras sobre amarillo para mantener el contraste.
 */
export const MARCADOR_ESTADO: Record<ClaveEstado, { fondo: string; texto: string; letra: string }> =
  {
    BUENO: { fondo: '#15803d', texto: '#ffffff', letra: 'B' },
    REGULAR: { fondo: '#facc15', texto: '#422006', letra: 'R' },
    MALO: { fondo: '#b91c1c', texto: '#ffffff', letra: 'M' },
    SIN_EVALUAR: { fondo: '#6b7280', texto: '#ffffff', letra: 'S' },
  };

export function claveEstado(estado: EstadoCondicion | null): ClaveEstado {
  return estado ?? 'SIN_EVALUAR';
}
