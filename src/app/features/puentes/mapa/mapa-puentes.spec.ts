import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { TEXTOS } from '../../../shared/textos';
import { estabilizar, pagina, puente } from '../datos-prueba';
import { CARGADOR_MAPLIBRE, MapLibre } from './maplibre';
import { MapLibreFalso } from './maplibre-falso';
import { contenidoPopup, elementoMarcador, MapaPuentes } from './mapa-puentes';

describe('MapaPuentes', () => {
  const t = TEXTOS.puentes;
  let fixture: ComponentFixture<MapaPuentes>;
  let http: HttpTestingController;
  let mapa: MapLibreFalso;

  async function crear(cargador: () => Promise<MapLibre>) {
    TestBed.configureTestingModule({
      imports: [MapaPuentes],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CARGADOR_MAPLIBRE, useValue: cargador },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MapaPuentes);
    await estabilizar(fixture);
  }

  beforeEach(() => (mapa = new MapLibreFalso()));
  afterEach(() => http.verify());

  const html = () => fixture.nativeElement as HTMLElement;
  const esperar = () => new Promise((listo) => setTimeout(listo));

  it('recorre todas las páginas y dibuja un marcador accesible por puente', async () => {
    await crear(() => Promise.resolve(mapa.modulo()));
    const primeros = Array.from({ length: 100 }, (_, i) =>
      puente({ id: `p${i}`, estado_actual: 'BUENO' }),
    );
    http.expectOne('/api/v1/puentes?page=0&size=100').flush(pagina(primeros, 0, 101, 100));
    http
      .expectOne('/api/v1/puentes?page=1&size=100')
      .flush(
        pagina([puente({ id: 'ultimo', nombre: 'Último', estado_actual: 'MALO' })], 1, 101, 100),
      );
    await esperar();
    await estabilizar(fixture);

    expect(mapa.marcadores).toHaveLength(101);
    const ultimo = mapa.marcadores[100];
    expect(ultimo.posicion).toEqual([-91.518, 14.8347]);
    expect(ultimo.elemento?.getAttribute('aria-label')).toBe('Último (GT-09-0901-0001): Malo');
    expect(ultimo.elemento?.textContent).toBe('M');
    expect(ultimo.popup?.contenido?.textContent).toContain('Estado: Malo');
    expect(html().querySelector('[role="status"]')).toBeNull();
  });

  it('muestra la leyenda con texto para cada color, incluido Sin evaluar', async () => {
    await crear(() => Promise.resolve(mapa.modulo()));
    http.expectOne('/api/v1/puentes?page=0&size=100').flush(pagina([], 0, 0, 100));
    await esperar();
    await estabilizar(fixture);
    const leyenda = [...html().querySelectorAll('ul li')].map((li) => li.textContent?.trim());
    expect(leyenda).toEqual(['BBueno', 'RRegular', 'MMalo', 'SSin evaluar']);
    expect(html().textContent).toContain(t.mapa.sinPuentes);
  });

  it('si MapLibre no carga, lo dice y ofrece el listado', async () => {
    await crear(() => Promise.reject(new Error('sin WebGL')));
    http.expectOne('/api/v1/puentes?page=0&size=100').flush(pagina([puente()], 0, 1, 100));
    await esperar();
    await estabilizar(fixture);
    expect(html().querySelector('[role="alert"]')?.textContent).toContain(t.mapa.errorMapa);
    expect(html().querySelector('a[href="/puentes"]')?.textContent).toContain(t.mapa.verListado);
  });

  it('el popup no interpreta HTML del nombre y su enlace navega dentro de la SPA', async () => {
    await crear(() => Promise.resolve(mapa.modulo()));
    http.expectOne('/api/v1/puentes?page=0&size=100').flush(pagina([], 0, 0, 100));
    const abrir = vi.fn();
    const contenido = contenidoPopup(puente({ nombre: '<img src=x onerror=alert(1)>' }), abrir);
    expect(contenido.querySelector('img')).toBeNull();
    expect(contenido.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(contenido.textContent).toContain('Sin evaluar');
    contenido.querySelector('a')!.click();
    expect(abrir).toHaveBeenCalledWith('019a0050-0000-7000-8000-000000000001');
    expect(TestBed.inject(Router)).toBeDefined();
  });

  it('el marcador es un botón con la letra del estado', () => {
    const boton = elementoMarcador(puente({ estado_actual: 'REGULAR' }));
    expect(boton.tagName).toBe('BUTTON');
    expect(boton.textContent).toBe('R');
    expect(boton.getAttribute('aria-label')).toContain('Regular');
  });
});
