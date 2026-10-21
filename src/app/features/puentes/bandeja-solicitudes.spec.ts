import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TEXTOS } from '../../shared/textos';
import { BandejaSolicitudes } from './bandeja-solicitudes';
import { estabilizar, pagina, PROBLEMA_DUPLICADO, solicitud } from './datos-prueba';
import { ROL_PUENTES, RolPuentes } from './rol-puentes';

describe('BandejaSolicitudes', () => {
  const s = TEXTOS.puentes.solicitudes;
  const pendientes = '/api/v1/solicitudes-puente?page=0&size=20&estado=PENDIENTE';
  const id = '019a0050-0000-7000-8000-000000000101';
  let fixture: ComponentFixture<BandejaSolicitudes>;
  let http: HttpTestingController;
  const rol = signal<RolPuentes | null>('ADMINISTRADOR');

  beforeEach(async () => {
    rol.set('ADMINISTRADOR');
    TestBed.configureTestingModule({
      imports: [BandejaSolicitudes],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ROL_PUENTES, useValue: rol },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BandejaSolicitudes);
    await estabilizar(fixture);
    http.expectOne(pendientes).flush(pagina([solicitud()]));
    await estabilizar(fixture);
  });

  afterEach(() => http.verify());

  const html = () => fixture.nativeElement as HTMLElement;
  const boton = (texto: string) =>
    [...html().querySelectorAll('button')].find((b) => b.textContent?.trim() === texto)!;

  it('lista las pendientes con su ubicación, UTM y fecha en hora de Guatemala', () => {
    const fila = html().querySelector('li')!.textContent!.replace(/\s+/g, ' ');
    expect(fila).toContain('Puente solicitado');
    expect(fila).toContain('Almolonga, Quetzaltenango');
    expect(fila).toContain('UTM 15N');
    // 03:00 UTC del 19/10 todavía es 18/10 en Guatemala
    expect(fila).toContain('18/10/2026');
    expect(fila).toContain(s.estados.PENDIENTE);
  });

  it('rechazar exige motivo escrito', async () => {
    boton(s.rechazar).click();
    await estabilizar(fixture);
    const form = html().querySelector('form')!;
    form.dispatchEvent(new Event('submit'));
    await estabilizar(fixture);
    http.expectNone(`/api/v1/solicitudes-puente/${id}/rechazo`);

    const motivo = html().querySelector<HTMLTextAreaElement>(`#motivo-${id}`)!;
    expect(html().querySelector(`label[for="motivo-${id}"]`)).not.toBeNull();
    motivo.value = 'Ya existe en el inventario';
    motivo.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit'));
    await estabilizar(fixture);
    const rechazo = http.expectOne(`/api/v1/solicitudes-puente/${id}/rechazo`);
    expect(rechazo.request.body).toEqual({ motivo: 'Ya existe en el inventario' });
    rechazo.flush(solicitud({ estado: 'RECHAZADA', motivo_rechazo: 'Ya existe en el inventario' }));
    await estabilizar(fixture);
    http.expectOne(pendientes).flush(pagina([]));
    await estabilizar(fixture);
    expect(html().querySelector('[role="status"]')?.textContent).toContain(s.rechazada);
  });

  it('aprobar con un puente cercano advierte y confirmar aprueba de todos modos', async () => {
    boton(s.aprobar).click();
    await estabilizar(fixture);
    const primera = http.expectOne(`/api/v1/solicitudes-puente/${id}/aprobacion`);
    expect(primera.request.body).toEqual({ confirmar_duplicado: false });
    primera.flush(PROBLEMA_DUPLICADO, { status: 409, statusText: 'Conflict' });
    await estabilizar(fixture);

    expect(html().textContent).toContain('GT-09-0901-0003');
    boton(TEXTOS.puentes.duplicado.confirmarAprobacion).click();
    await estabilizar(fixture);
    const segunda = http.expectOne(`/api/v1/solicitudes-puente/${id}/aprobacion`);
    expect(segunda.request.body).toEqual({ confirmar_duplicado: true });
    segunda.flush(solicitud({ estado: 'APROBADA', puente_id: 'puente-nuevo' }));
    await estabilizar(fixture);
    http.expectOne(pendientes).flush(pagina([]));
    await estabilizar(fixture);
    expect(html().querySelector('[role="status"] a')?.getAttribute('href')).toBe(
      '/puentes/puente-nuevo',
    );
  });

  it('el Catedrático ve sus solicitudes sin botones para resolverlas', async () => {
    rol.set('CATEDRATICO');
    await estabilizar(fixture);
    expect(boton(s.aprobar)).toBeUndefined();
    expect(html().querySelector('a[href="/puentes/solicitudes/nueva"]')).not.toBeNull();
  });

  it('cambiar el estado vuelve a consultar', async () => {
    const filtro = html().querySelector<HTMLSelectElement>('#estado-solicitud')!;
    filtro.value = 'RECHAZADA';
    filtro.dispatchEvent(new Event('change'));
    await estabilizar(fixture);
    http.expectOne('/api/v1/solicitudes-puente?page=0&size=20&estado=RECHAZADA').flush(pagina([]));
    await estabilizar(fixture);
    expect(html().textContent).toContain(s.vacia);
  });
});
