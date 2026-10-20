import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TEXTOS } from '../../shared/textos';
import { estabilizar, puente } from './datos-prueba';
import { FichaPuente } from './ficha-puente';
import { fechaSinHora } from './formato';
import { CARGADOR_MAPLIBRE } from './mapa/maplibre';
import { MapLibreFalso } from './mapa/maplibre-falso';
import { ROL_PUENTES, RolPuentes } from './rol-puentes';

describe('FichaPuente', () => {
  const t = TEXTOS.puentes;
  const id = '019a0050-0000-7000-8000-000000000001';
  let fixture: ComponentFixture<FichaPuente>;
  let http: HttpTestingController;
  const rol = signal<RolPuentes | null>(null);

  beforeEach(async () => {
    rol.set(null);
    const mapa = new MapLibreFalso();
    TestBed.configureTestingModule({
      imports: [FichaPuente],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ROL_PUENTES, useValue: rol },
        { provide: CARGADOR_MAPLIBRE, useValue: () => Promise.resolve(mapa.modulo()) },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FichaPuente);
    fixture.componentRef.setInput('id', id);
    await estabilizar(fixture);
  });

  afterEach(() => http.verify());

  const html = () => fixture.nativeElement as HTMLElement;
  const texto = () => html().textContent?.replace(/\s+/g, ' ') ?? '';

  async function cargar(cambios = {}) {
    http.expectOne(`/api/v1/puentes/${id}`).flush(puente(cambios));
    await estabilizar(fixture);
  }

  it('muestra WGS84, UTM con su zona y "Sin evaluar" sin inspección publicada', async () => {
    expect(texto()).toContain(t.ficha.cargando);
    await cargar();
    expect(texto()).toContain('14.834700');
    expect(texto()).toContain('-91.518000');
    expect(texto()).toContain('15N');
    expect(texto()).toContain('659,463.36 m');
    expect(texto()).toContain('1,640,571.32 m');
    expect(html().querySelector('app-estado-puente')?.textContent?.trim()).toBe('Sin evaluar');
    expect(texto()).toContain(t.ficha.sinInspeccion);
    expect(texto()).toContain(t.ficha.derivadosNota);
  });

  it('muestra IC y la fecha de la última inspección sin correrla de día', async () => {
    await cargar({
      estado_actual: 'REGULAR',
      indice_condicion_actual: 62.5,
      fecha_ultima_inspeccion: '2026-10-15',
    });
    expect(texto()).toContain('62.50');
    expect(texto()).toContain('15/10/2026');
    expect(fechaSinHora(null)).toBeNull();
  });

  it('un puente dado de baja muestra su motivo', async () => {
    await cargar({ activo: false, motivo_baja: 'Demolido por la crecida' });
    expect(texto()).toContain(t.ficha.dadoDeBaja);
    expect(texto()).toContain('Demolido por la crecida');
  });

  it('un 404 se explica al usuario', async () => {
    http
      .expectOne(`/api/v1/puentes/${id}`)
      .flush({ detail: 'x' }, { status: 404, statusText: 'Not Found' });
    await estabilizar(fixture);
    expect(html().querySelector('[role="alert"]')?.textContent).toContain(t.errores.noEncontrado);
  });

  it('el público no ve acciones; el Administrador da de baja con motivo obligatorio', async () => {
    await cargar();
    expect(html().querySelector('header button')).toBeNull();

    rol.set('ADMINISTRADOR');
    await estabilizar(fixture);
    const abrir = html().querySelector<HTMLButtonElement>('header button')!;
    expect(abrir.textContent?.trim()).toBe(t.ficha.darDeBaja);
    expect(abrir.getAttribute('aria-expanded')).toBe('false');
    abrir.click();
    await estabilizar(fixture);

    const form = html().querySelector<HTMLFormElement>('#panel-baja')!;
    form.dispatchEvent(new Event('submit'));
    await estabilizar(fixture);
    http.expectNone(`/api/v1/puentes/${id}/baja`);
    expect(texto()).toContain(t.formulario.errores.requerido);

    const motivo = html().querySelector<HTMLTextAreaElement>('#motivo-baja')!;
    motivo.value = '  Sustituido  ';
    motivo.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit'));
    await estabilizar(fixture);
    const baja = http.expectOne(`/api/v1/puentes/${id}/baja`);
    expect(baja.request.body).toEqual({ motivo: 'Sustituido' });
    baja.flush(puente({ activo: false, motivo_baja: 'Sustituido' }));
    await estabilizar(fixture);
    expect(texto()).toContain(t.baja.hecha);
    expect(texto()).toContain(t.ficha.dadoDeBaja);
    expect(html().querySelector('header button')).toBeNull();
  });
});
