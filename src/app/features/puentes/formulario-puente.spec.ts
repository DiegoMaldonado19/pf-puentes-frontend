import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { TEXTOS } from '../../shared/textos';
import { estabilizar, PROBLEMA_DUPLICADO, puente, solicitud } from './datos-prueba';
import { crearFormularioPuente, FormularioPuente, ModoFormulario } from './formulario-puente';
import { CARGADOR_MAPLIBRE } from './mapa/maplibre';
import { MapLibreFalso } from './mapa/maplibre-falso';

describe('crearFormularioPuente', () => {
  it('exige los obligatorios de RN-INV-04 y deja el año opcional', () => {
    const form = crearFormularioPuente();
    expect(form.valid).toBe(false);
    for (const campo of ['nombre', 'departamento', 'municipio', 'ruta', 'latitud', 'longitud']) {
      expect(form.get(campo)?.hasError('required'), campo).toBe(true);
    }
    expect(form.controls.anio.valid).toBe(true);
    form.setValue({
      nombre: 'Las Rosas',
      departamento: '09',
      municipio: '0901',
      ruta: 'CA-1',
      latitud: 14.8,
      longitud: -91.5,
      anio: null,
    });
    expect(form.valid).toBe(true);
  });

  it.each([
    ['latitud', 12],
    ['latitud', 18.5],
    ['longitud', -93],
    ['longitud', -87],
    ['anio', 1799],
    ['anio', 2101],
    ['anio', 1990.5],
  ] as const)('rechaza %s = %s', (campo, valor) => {
    const form = crearFormularioPuente();
    form.controls[campo].setValue(valor);
    expect(form.controls[campo].valid).toBe(false);
  });

  it('no acepta un nombre o una ruta de solo espacios', () => {
    const form = crearFormularioPuente();
    form.controls.nombre.setValue('   ');
    form.controls.ruta.setValue('  ');
    expect(form.controls.nombre.valid).toBe(false);
    expect(form.controls.ruta.valid).toBe(false);
  });
});

describe('FormularioPuente', () => {
  const t = TEXTOS.puentes;
  let fixture: ComponentFixture<FormularioPuente>;
  let http: HttpTestingController;
  let mapa: MapLibreFalso;

  async function crear(modo: ModoFormulario, id?: string) {
    mapa = new MapLibreFalso();
    TestBed.configureTestingModule({
      imports: [FormularioPuente],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CARGADOR_MAPLIBRE, useValue: () => Promise.resolve(mapa.modulo()) },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FormularioPuente);
    fixture.componentRef.setInput('modo', modo);
    if (id) fixture.componentRef.setInput('id', id);
    await estabilizar(fixture);
    http.expectOne('/api/v1/departamentos').flush([{ codigo: '09', nombre: 'Quetzaltenango' }]);
    await estabilizar(fixture);
  }

  afterEach(() => http.verify());

  const html = () => fixture.nativeElement as HTMLElement;
  const campo = <T extends HTMLElement>(id: string) => html().querySelector<T>(`#${id}`)!;

  async function escribir(id: string, valor: string) {
    const control = campo<HTMLInputElement | HTMLSelectElement>(id);
    control.value = valor;
    control.dispatchEvent(new Event(control instanceof HTMLSelectElement ? 'change' : 'input'));
    await estabilizar(fixture);
  }

  async function llenar() {
    await escribir('nombre', ' Las Rosas ');
    await escribir('departamento', '09');
    http
      .expectOne('/api/v1/departamentos/09/municipios')
      .flush([{ codigo: '0901', nombre: 'Quetzaltenango', departamento_codigo: '09' }]);
    await estabilizar(fixture);
    await escribir('municipio', '0901');
    await escribir('ruta', 'CA-1');
    await escribir('latitud', '14.8347');
    await escribir('longitud', '-91.518');
  }

  async function enviar() {
    html().querySelector('form')!.dispatchEvent(new Event('submit'));
    await estabilizar(fixture);
  }

  it('sin datos no envía y marca cada obligatorio con su mensaje asociado', async () => {
    await crear('alta');
    await enviar();
    http.expectNone('/api/v1/puentes');
    expect(campo('nombre').getAttribute('aria-invalid')).toBe('true');
    expect(campo('nombre').getAttribute('aria-describedby')).toBe('error-nombre');
    expect(campo('error-nombre').textContent).toContain(t.formulario.errores.requerido);
    expect(campo('error-latitud').textContent).toContain(t.formulario.errores.requerido);
    expect(html().querySelector('#error-anio')).toBeNull();
  });

  it('el 409 de duplicado muestra los puentes cercanos y confirmar reenvía con confirmar_duplicado', async () => {
    await crear('alta');
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await llenar();
    await enviar();

    const primera = http.expectOne('/api/v1/puentes');
    expect(primera.request.body).toEqual({
      nombre: 'Las Rosas',
      ruta: 'CA-1',
      latitud: 14.8347,
      longitud: -91.518,
      confirmar_duplicado: false,
      departamento_codigo: '09',
      municipio_codigo: '0901',
      anio_construccion: null,
    });
    primera.flush(PROBLEMA_DUPLICADO, { status: 409, statusText: 'Conflict' });
    await estabilizar(fixture);

    const advertencia = html().querySelector('app-advertencia-duplicado [role="alert"]')!;
    expect(advertencia.textContent).toContain('GT-09-0901-0003');
    expect(advertencia.textContent).toContain('42.5');
    const botonConfirmar = [...advertencia.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === t.duplicado.confirmar,
    )!;
    botonConfirmar.click();
    await estabilizar(fixture);

    const segunda = http.expectOne('/api/v1/puentes');
    expect(segunda.request.body.confirmar_duplicado).toBe(true);
    segunda.flush(puente({ id: 'nuevo' }));
    await estabilizar(fixture);
    expect(navegar).toHaveBeenCalledWith(['/puentes', 'nuevo']);
  });

  it('muestra el Problem Details de otros errores sin ofrecer confirmar', async () => {
    await crear('alta');
    await llenar();
    await enviar();
    http
      .expectOne('/api/v1/puentes')
      .flush(
        { detail: 'El municipio no pertenece al departamento indicado.' },
        { status: 422, statusText: 'Unprocessable' },
      );
    await estabilizar(fixture);
    expect(html().querySelector('[role="alert"]')?.textContent).toContain(
      'El municipio no pertenece',
    );
    expect(html().querySelector('app-advertencia-duplicado')).toBeNull();
  });

  it('el clic en el mapa llena latitud y longitud', async () => {
    await crear('alta');
    await new Promise((listo) => setTimeout(listo));
    mapa.mapas[0].eventos.get('click')!({ lngLat: { lat: 14.1234567, lng: -90.7654321 } });
    await estabilizar(fixture);
    expect(campo<HTMLInputElement>('latitud').value).toBe('14.123457');
    expect(campo<HTMLInputElement>('longitud').value).toBe('-90.765432');
  });

  it('en edición el código, el municipio y los derivados son de solo lectura y no se envían', async () => {
    const id = '019a0050-0000-7000-8000-000000000001';
    await crear('edicion', id);
    http
      .expectOne(`/api/v1/puentes/${id}`)
      .flush(
        puente({ estado_actual: 'MALO', indice_condicion_actual: 30, anio_construccion: null }),
      );
    await estabilizar(fixture);
    http
      .expectOne('/api/v1/departamentos/09/municipios')
      .flush([{ codigo: '0901', nombre: 'Quetzaltenango', departamento_codigo: '09' }]);
    await estabilizar(fixture);

    expect(html().textContent).toContain('GT-09-0901-0001');
    expect(campo<HTMLSelectElement>('departamento').disabled).toBe(true);
    expect(campo<HTMLSelectElement>('municipio').disabled).toBe(true);
    expect(campo('municipio').getAttribute('aria-describedby')).toBe('nota-ubicacion-fija');
    expect(html().querySelector('#estado_actual, [formcontrolname="estado_actual"]')).toBeNull();

    await escribir('anio', '1950');
    await enviar();
    const peticion = http.expectOne(`/api/v1/puentes/${id}`);
    expect(peticion.request.method).toBe('PUT');
    expect(peticion.request.body).toEqual({
      nombre: 'Puente Las Rosas',
      ruta: 'CA-1',
      latitud: 14.8347,
      longitud: -91.518,
      confirmar_duplicado: false,
      anio_construccion: 1950,
    });
    peticion.flush(puente());
  });

  it('el Catedrático envía una solicitud sin año y ve la confirmación', async () => {
    await crear('solicitud');
    expect(html().querySelector('#anio')).toBeNull();
    await llenar();
    await enviar();
    const peticion = http.expectOne('/api/v1/solicitudes-puente');
    expect(peticion.request.body.anio_construccion).toBeUndefined();
    expect(peticion.request.body.municipio_codigo).toBe('0901');
    peticion.flush(solicitud());
    await estabilizar(fixture);
    expect(html().querySelector('[role="status"]')?.textContent).toContain(
      t.formulario.solicitudEnviada,
    );
  });
});
