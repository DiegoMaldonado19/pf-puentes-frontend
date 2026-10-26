import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { CatalogoService } from './catalogo.service';

describe('CatalogoService', () => {
  let servicio: CatalogoService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(CatalogoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide los departamentos una sola vez aunque varias pantallas los usen', async () => {
    const primero = firstValueFrom(servicio.departamentos());
    const segundo = firstValueFrom(servicio.departamentos());
    http.expectOne('/api/v1/departamentos').flush([{ codigo: '09', nombre: 'Quetzaltenango' }]);
    expect(await primero).toEqual(await segundo);
    expect(await firstValueFrom(servicio.departamentos())).toHaveLength(1);
  });

  it('pide los municipios de cada departamento por separado y los recuerda', async () => {
    const xela = firstValueFrom(servicio.municipios('09'));
    http
      .expectOne('/api/v1/departamentos/09/municipios')
      .flush([{ codigo: '0901', nombre: 'Quetzaltenango', departamento_codigo: '09' }]);
    expect((await xela)[0].codigo).toBe('0901');
    await firstValueFrom(servicio.municipios('09'));

    servicio.municipios('17').subscribe();
    http.expectOne('/api/v1/departamentos/17/municipios').flush([]);
  });
});
