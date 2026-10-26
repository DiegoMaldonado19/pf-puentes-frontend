import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TEXTOS } from '../../../shared/textos';
import { estabilizar } from '../../puentes/datos-prueba';
import { CreacionPesos } from './creacion-pesos';

describe('Creación de juegos completos de pesos', () => {
  const id = 'version-prueba';
  const ruta = `/api/v1/formularios/${id}/juegos-pesos`;
  const campos = `/api/v1/formularios/${id}/elementos-dano?page=0&size=100`;
  const t = TEXTOS.pesos.creacion;
  let fixture: ComponentFixture<CreacionPesos>;
  let http: HttpTestingController;
  const html = () => fixture.nativeElement as HTMLElement;
  const pagina = (content: string[], page = 0, total = content.length) => ({
    content,
    page,
    size: 100,
    total_elements: total,
    total_pages: Math.ceil(total / 100),
  });
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CreacionPesos],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CreacionPesos);
    fixture.componentRef.setInput('formularioVersionId', id);
    fixture.componentRef.setInput('permitido', true);
  });
  afterEach(() => {
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });
  async function cargar(referencias = ['elemento.a', 'elemento.b']) {
    await estabilizar(fixture);
    http.expectOne(campos).flush(pagina(referencias));
    await estabilizar(fixture);
  }
  function llenar(valor = '1.25') {
    for (const input of html().querySelectorAll<HTMLInputElement>('input[type=number]')) {
      input.value = valor;
      input.dispatchEvent(new Event('input'));
    }
  }
  async function guardar() {
    html()
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await estabilizar(fixture);
  }

  it('no precarga pesos y no permite guardar un juego incompleto', async () => {
    await cargar();
    expect(
      Array.from(html().querySelectorAll<HTMLInputElement>('input[type=number]')).map(
        (v) => v.value,
      ),
    ).toEqual(['', '']);
    await guardar();
    http.expectNone(ruta);
    expect(html().textContent).toContain(t.invalidos);
  });
  it('crea una sola vez, envía referencias reales y emite solo después de confirmar', async () => {
    await cargar();
    llenar();
    const acta = html().querySelector<HTMLInputElement>('#acta-nuevo-juego')!;
    acta.value = ' Acta calibración ';
    acta.dispatchEvent(new Event('input'));
    const emitido = vi.fn();
    fixture.componentInstance.creado.subscribe(emitido);
    await guardar();
    expect(fixture.componentInstance.envioPendiente()).toBe(true);
    const envio = http.expectOne(ruta);
    expect(envio.request.body).toEqual({
      acta: 'Acta calibración',
      pesos: [
        { elemento_ref: 'elemento.a', peso: 1.25 },
        { elemento_ref: 'elemento.b', peso: 1.25 },
      ],
    });
    await guardar();
    http.expectNone(ruta);
    expect(emitido).not.toHaveBeenCalled();
    const juego = {
      id: 'nuevo',
      formulario_version_id: id,
      acta: 'Acta calibración',
      vigente_desde: '2026-10-25T10:00:00Z',
    };
    envio.flush(juego);
    await estabilizar(fixture);
    expect(emitido).toHaveBeenCalledExactlyOnceWith(juego);
    expect(fixture.componentInstance.envioPendiente()).toBe(false);
    await guardar();
    http.expectNone(ruta);
  });
  it('envía null para acta ausente, identificando configuración provisional', async () => {
    await cargar();
    llenar();
    await guardar();
    const envio = http.expectOne(ruta);
    expect(envio.request.body.acta).toBeNull();
    envio.flush({}, { status: 400, statusText: 'Bad Request' });
  });
  it.each(['0', '-1', '1000', '1.2345'])(
    'rechaza peso inválido %s antes del envío',
    async (valor) => {
      await cargar();
      llenar(valor);
      await guardar();
      http.expectNone(ruta);
      expect(html().textContent).toContain(t.invalidos);
    },
  );
  it('admite límites exactos y tres decimales sin errores de punto flotante', async () => {
    await cargar();
    llenar('1.001');
    await guardar();
    const envio = http.expectOne(ruta);
    expect(envio.request.body.pesos[0].peso).toBe(1.001);
    envio.flush({}, { status: 400, statusText: 'Bad Request' });
  });
  it('rechaza acta demasiado larga y conserva campos para corregir', async () => {
    await cargar();
    llenar();
    const acta = html().querySelector<HTMLInputElement>('#acta-nuevo-juego')!;
    acta.value = 'a'.repeat(301);
    acta.dispatchEvent(new Event('input'));
    await guardar();
    http.expectNone(ruta);
    expect(html().textContent).toContain(t.invalidos);
  });
  it.each([0, 401, 403, 404, 422, 500])(
    'explica el error %s y bloquea el reenvío automático',
    async (status) => {
      await cargar();
      llenar();
      await guardar();
      http.expectOne(ruta).flush({}, { status, statusText: 'Error' });
      await estabilizar(fixture);
      expect(fixture.componentInstance.envioPendiente()).toBe(false);
      expect(html().querySelector('[role=alert]')).not.toBeNull();
      await guardar();
      http.expectNone(ruta);
      if (status === 0 || status === 500) expect(html().textContent).toContain(t.incierto);
    },
  );
  it('permite corregir un 400 sin reintentar automáticamente', async () => {
    await cargar();
    llenar();
    await guardar();
    http.expectOne(ruta).flush({}, { status: 400, statusText: 'Bad Request' });
    await estabilizar(fixture);
    http.expectNone(ruta);
    llenar('2');
    await guardar();
    http.expectOne(ruta).flush({}, { status: 400, statusText: 'Bad Request' });
  });
  it('consulta todas las páginas antes de ofrecer un juego completo', async () => {
    await estabilizar(fixture);
    const referencias = Array.from({ length: 100 }, (_, i) => `ref.${i}`);
    http.expectOne(campos).flush(pagina(referencias, 0, 101));
    await estabilizar(fixture);
    expect(html().querySelector('form')).toBeNull();
    http.expectOne(campos.replace('page=0', 'page=1')).flush(pagina(['ref.100'], 1, 101));
    await estabilizar(fixture);
    expect(html().querySelectorAll('input[type=number]')).toHaveLength(101);
  });
  it('rechaza referencias duplicadas entre páginas en vez de ofrecer un juego parcial', async () => {
    await estabilizar(fixture);
    http.expectOne(campos).flush(pagina(['duplicada'], 0, 101));
    await estabilizar(fixture);
    http.expectOne(campos.replace('page=0', 'page=1')).flush(pagina(['duplicada'], 1, 101));
    await estabilizar(fixture);
    expect(html().querySelector('form')).toBeNull();
    expect(html().textContent).toContain(t.esquemaCambio);
  });
  it('muestra ausencia de campos y no ofrece guardar', async () => {
    await cargar([]);
    expect(html().textContent).toContain(t.sinCampos);
    expect(html().querySelector('form')).toBeNull();
  });
  it.each([
    [0, TEXTOS.pesos.sinConexion],
    [401, TEXTOS.pesos.sinSesion],
    [403, TEXTOS.pesos.sinPermiso],
    [404, t.esquemaCambio],
    [422, t.esquemaCambio],
    [500, TEXTOS.pesos.error],
  ] as const)(
    'explica el fallo %s al cargar y no ofrece una configuración parcial',
    async (status, mensaje) => {
      await estabilizar(fixture);
      http.expectOne(campos).flush({}, { status, statusText: 'Error' });
      await estabilizar(fixture);
      expect(html().textContent).toContain(mensaje);
      expect(html().querySelector('form')).toBeNull();
      http.expectNone(ruta);
    },
  );

  it('no solicita datos ni guarda sin permiso', async () => {
    fixture.componentRef.setInput('permitido', false);
    await estabilizar(fixture);
    http.expectNone(campos);
    expect(html().textContent).toContain(TEXTOS.pesos.sinPermiso);
  });
});
