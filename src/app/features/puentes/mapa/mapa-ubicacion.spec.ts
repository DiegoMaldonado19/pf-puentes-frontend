import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TEXTOS } from '../../../shared/textos';
import { estabilizar } from '../datos-prueba';
import { CARGADOR_MAPLIBRE, MapLibre } from './maplibre';
import { MapLibreFalso } from './maplibre-falso';
import { MapaUbicacion } from './mapa-ubicacion';

describe('MapaUbicacion', () => {
  let fixture: ComponentFixture<MapaUbicacion>;
  let mapa: MapLibreFalso;

  async function crear(cargador: () => Promise<MapLibre>, lat: number | null, lon: number | null) {
    TestBed.configureTestingModule({
      imports: [MapaUbicacion],
      providers: [{ provide: CARGADOR_MAPLIBRE, useValue: cargador }],
    });
    fixture = TestBed.createComponent(MapaUbicacion);
    fixture.componentRef.setInput('latitud', lat);
    fixture.componentRef.setInput('longitud', lon);
    await estabilizar(fixture);
    await new Promise((listo) => setTimeout(listo));
    await estabilizar(fixture);
  }

  beforeEach(() => (mapa = new MapLibreFalso()));

  it('coloca el marcador del puente en sus coordenadas y centra el mapa ahí', async () => {
    await crear(() => Promise.resolve(mapa.modulo()), 14.8347, -91.518);
    expect(mapa.mapas[0].opciones).toMatchObject({ center: [-91.518, 14.8347], zoom: 14 });
    expect(mapa.marcadores).toHaveLength(1);
    expect(mapa.marcadores[0].posicion).toEqual([-91.518, 14.8347]);
    expect(mapa.marcadores[0].enMapa).toBe(true);
  });

  it('mueve el marcador cuando cambian las coordenadas y lo quita si se borran', async () => {
    await crear(() => Promise.resolve(mapa.modulo()), null, null);
    expect(mapa.marcadores[0].enMapa).toBe(false);
    fixture.componentRef.setInput('latitud', 15.1);
    fixture.componentRef.setInput('longitud', -90.2);
    await estabilizar(fixture);
    expect(mapa.marcadores[0].posicion).toEqual([-90.2, 15.1]);
    expect(mapa.marcadores[0].enMapa).toBe(true);
    fixture.componentRef.setInput('latitud', null);
    await estabilizar(fixture);
    expect(mapa.marcadores[0].enMapa).toBe(false);
  });

  it('si MapLibre o su CSS no cargan, avisa en vez de dejar un mapa sin marcador', async () => {
    await crear(() => Promise.reject(new Error('No se pudo cargar maplibre.css')), 14.8, -91.5);
    expect(mapa.mapas).toHaveLength(0);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[role="status"]')?.textContent,
    ).toContain(TEXTOS.puentes.mapa.errorMapa);
  });
});
