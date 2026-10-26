import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TEXTOS } from '../../shared/textos';
import { estabilizar, pagina, puente } from './datos-prueba';
import { ListadoPuentes } from './listado-puentes';
import { ROL_PUENTES, RolPuentes } from './rol-puentes';

describe('ListadoPuentes', () => {
  const t = TEXTOS.puentes;
  let fixture: ComponentFixture<ListadoPuentes>;
  let http: HttpTestingController;
  const rol = signal<RolPuentes | null>(null);

  beforeEach(async () => {
    rol.set(null);
    TestBed.configureTestingModule({
      imports: [ListadoPuentes],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ROL_PUENTES, useValue: rol },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ListadoPuentes);
    await estable();
    http.expectOne('/api/v1/departamentos').flush([
      { codigo: '09', nombre: 'Quetzaltenango' },
      { codigo: '17', nombre: 'Petén' },
    ]);
  });

  afterEach(() => http.verify());

  const estable = () => estabilizar(fixture);

  const html = () => fixture.nativeElement as HTMLElement;
  const select = (id: string) => html().querySelector<HTMLSelectElement>(`#${id}`)!;

  async function elegir(id: string, valor: string) {
    select(id).value = valor;
    select(id).dispatchEvent(new Event('change'));
    await estable();
  }

  function responder(contenido = [puente()], total = contenido.length) {
    const peticion = http.expectOne((r) => r.url === '/api/v1/puentes');
    peticion.flush(pagina(contenido, Number(peticion.request.params.get('page')), total));
    return peticion.request.params;
  }

  it('muestra el estado siempre con texto: sin inspección es "Sin evaluar"', async () => {
    responder([puente(), puente({ id: 'b', codigo: 'GT-09-0901-0002', estado_actual: 'MALO' })]);
    await estable();
    const filas = html().querySelectorAll('tbody tr');
    expect(filas).toHaveLength(2);
    expect(filas[0].textContent).toContain('GT-09-0901-0001');
    expect(filas[0].textContent).toContain('Quetzaltenango');
    expect(filas[0].textContent).toContain('CA-1');
    expect(filas[0].querySelector('app-estado-puente')?.textContent?.trim()).toBe('Sin evaluar');
    expect(filas[1].querySelector('app-estado-puente')?.textContent?.trim()).toBe('Malo');
    // también como tarjetas para celular
    expect(html().querySelectorAll('ul li app-estado-puente')).toHaveLength(2);
  });

  it('distingue inventario vacío de filtros sin coincidencias', async () => {
    responder([]);
    await estable();
    expect(html().textContent).toContain(t.listado.vacio);

    await elegir('filtro-estado', 'MALO');
    responder([]);
    await estable();
    expect(html().textContent).toContain(t.listado.sinCoincidencias);
  });

  it('el departamento carga sus municipios y ambos filtran el listado desde la primera página', async () => {
    responder([puente()], 45);
    await estable();
    expect(select('filtro-municipio').disabled).toBe(true);
    html().querySelectorAll<HTMLButtonElement>('nav button')[1].click();
    await estable();
    expect(responder([puente()], 45).get('page')).toBe('1');
    await estable();

    await elegir('filtro-departamento', '09');
    http
      .expectOne('/api/v1/departamentos/09/municipios')
      .flush([{ codigo: '0913', nombre: 'Almolonga', departamento_codigo: '09' }]);
    const params = responder();
    expect(params.get('departamento')).toBe('09');
    expect(params.get('page')).toBe('0');
    await estable();
    expect(select('filtro-municipio').disabled).toBe(false);

    await elegir('filtro-municipio', '0913');
    expect(responder().get('municipio')).toBe('0913');
  });

  it('filtra por Sin evaluar y busca texto tras una pausa al escribir', async () => {
    responder();
    await elegir('filtro-estado', 'SIN_EVALUAR');
    expect(responder().get('estado')).toBe('SIN_EVALUAR');

    const buscador = html().querySelector<HTMLInputElement>('#filtro-texto')!;
    buscador.value = 'rosas';
    buscador.dispatchEvent(new Event('input'));
    await estable();
    http.expectNone((r) => r.params.get('q') === 'rosas');
    await new Promise((listo) => setTimeout(listo, 350));
    await estable();
    const params = responder();
    expect(params.get('q')).toBe('rosas');
    expect(params.get('estado')).toBe('SIN_EVALUAR');
  });

  it('muestra un error claro y permite reintentar', async () => {
    http.expectOne((r) => r.url === '/api/v1/puentes').error(new ProgressEvent('error'));
    await estable();
    expect(html().querySelector('[role="alert"]')?.textContent).toContain(t.errores.sinConexion);
    html().querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await estable();
    responder();
  });

  it('solo muestra las acciones privadas al rol que corresponde', async () => {
    responder();
    await estable();
    const enlaces = () =>
      [...html().querySelectorAll('header a')].map((a) => a.textContent?.trim());
    expect(enlaces()).toEqual([t.listado.verMapa]);
    rol.set('ADMINISTRADOR');
    await estable();
    expect(enlaces()).toEqual([t.listado.verMapa, t.listado.registrar, t.listado.solicitudes]);
    rol.set('CATEDRATICO');
    await estable();
    expect(enlaces()).toEqual([t.listado.verMapa, t.listado.solicitar, t.listado.solicitudes]);
  });
});
