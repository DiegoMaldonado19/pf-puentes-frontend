import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TEXTOS } from '../../shared/textos';
import { MencionesForoHttp } from './menciones-foro-http';
import { SESION_P2 } from './puertos';

const url = '/api/v1/usuarios/mencionables';
const ana = '019a0000-0000-7000-8000-000000000001';
const luis = '019a0000-0000-7000-8000-000000000002';

describe('MencionesForoHttp', () => {
  let menciones: MencionesForoHttp;
  let http: HttpTestingController;
  let usuarioId: WritableSignal<string | null>;

  beforeEach(() => {
    usuarioId = signal<string | null>('autor');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SESION_P2, useValue: { disponible: true, usuarioId, roles: signal([]) } },
      ],
    });
    menciones = TestBed.inject(MencionesForoHttp);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('carga una sola vez y mapea nombre a etiqueta', () => {
    menciones.cargar();
    menciones.cargar();
    expect(menciones.cargando()).toBe(true);
    http.expectOne(url).flush([
      { id: ana, nombre: 'Ana Pérez' },
      { id: luis, nombre: 'Luis Gómez' },
    ]);
    expect(menciones.personas()).toEqual([
      { id: ana, etiqueta: 'Ana Pérez' },
      { id: luis, etiqueta: 'Luis Gómez' },
    ]);
    expect(menciones.cargando()).toBe(false);
  });

  it('no pide las menciones sin sesión', () => {
    usuarioId.set(null);
    menciones.cargar();
    http.expectNone(url);
  });

  it('expone el fallo sin propagarlo y no vuelve a pedir', () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    menciones.cargar();
    http.expectOne(url).flush(null, { status: 500, statusText: 'Error' });
    menciones.cargar();
    http.expectNone(url);
    expect(menciones.error()).toBe(TEXTOS.menciones.error);
    expect(menciones.personas()).toEqual([]);
    expect(menciones.cargando()).toBe(false);
    expect(consola).toHaveBeenCalled();
  });
});
