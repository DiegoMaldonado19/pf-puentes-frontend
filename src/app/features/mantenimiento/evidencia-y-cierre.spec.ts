import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CapturaFoto, FotoCapturada } from '../../shared/captura-foto/captura-foto';
import { TEXTOS } from '../../shared/textos';
import { EvidenciaYCierre } from './evidencia-y-cierre';
import { EstadoOrden, EvidenciaDTO, OrdenMantenimientoDTO, PaginaEvidencias } from './modelos';

const orden: OrdenMantenimientoDTO = {
  id: '019a0030-0000-7000-8000-000000000012',
  puente_id: '019a0030-0000-7000-8000-000000000001',
  inspeccion_id: null,
  tipo: 'CORRECTIVO',
  estado: 'EN_EJECUCION',
  descripcion: 'Orden de prueba',
  elemento_ref: 'subestructura.estribo',
  prioridad_sugerida: 'MEDIA',
  prioridad: 'ALTA',
  justificacion_prioridad: 'Justificación de prueba',
  fecha_programada: null,
  fecha_ejecucion: null,
  responsable: null,
  motivo: null,
  creado_en: '2026-10-20T12:00:00Z',
  actualizado_en: '2026-10-20T12:00:00Z',
};
const evidencia: EvidenciaDTO = {
  id: '019a0030-0000-7000-8000-000000000020',
  tipo: 'JPEG',
  elemento_ref: null,
  latitud: null,
  longitud: null,
  capturada_en: '2026-10-20T12:00:00Z',
  tamano: 123,
  url: 'https://almacen.test/foto?firma=temporal',
  url_miniatura: 'https://almacen.test/mini?firma=temporal',
};
const captura: FotoCapturada = {
  archivo: new Blob(['foto'], { type: 'image/webp' }),
  miniatura: new Blob(['miniatura'], { type: 'image/webp' }),
  latitud: 14.62,
  longitud: -90.51,
  capturada_en: '2026-10-20T12:00:00Z',
};
const pagina = (content: readonly EvidenciaDTO[] = []): PaginaEvidencias => ({
  puente_id: orden.puente_id,
  orden_id: orden.id,
  content,
  page: 0,
  size: 20,
  total_elements: content.length,
  total_pages: content.length ? 1 : 0,
});
const ruta = `/api/v1/puentes/${orden.puente_id}/ordenes-mantenimiento/${orden.id}`;
const t = TEXTOS.mantenimiento.evidencia;

describe('EvidenciaYCierre', () => {
  let fixture: ComponentFixture<EvidenciaYCierre>;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [EvidenciaYCierre],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(EvidenciaYCierre);
    http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('orden', orden);
    fixture.componentRef.setInput('puedeConsultar', true);
    fixture.componentRef.setInput('puedeSubir', true);
    fixture.componentRef.setInput('puedeCerrar', true);
  });
  afterEach(() => http.verify());
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  function boton(nombre: string): HTMLButtonElement {
    const encontrado = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === nombre,
    );
    expect(encontrado).toBeDefined();
    return encontrado!;
  }
  function cargar(content: readonly EvidenciaDTO[] = []) {
    fixture.detectChanges();
    const req = http.expectOne(`${ruta}/evidencias?page=0&size=20`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(pagina(content));
    fixture.detectChanges();
  }
  function capturar(foto = captura) {
    const componente = fixture.debugElement.query(By.directive(CapturaFoto))
      .componentInstance as CapturaFoto;
    componente.capturada.emit(foto);
    fixture.detectChanges();
  }
  function llenar(responsable = 'Cuadrilla de prueba') {
    const fecha = (fixture.nativeElement as HTMLElement).querySelector(
      'input[type=date]',
    ) as HTMLInputElement;
    const persona = (fixture.nativeElement as HTMLElement).querySelector(
      'input[type=text]',
    ) as HTMLInputElement;
    fecha.value = '2026-10-20';
    fecha.dispatchEvent(new Event('input'));
    persona.value = responsable;
    persona.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('consulta evidencia paginada y permite renovar las URL firmadas sin almacenar tokens', () => {
    cargar([evidencia]);
    const enlace = (fixture.nativeElement as HTMLElement).querySelector('a')!;
    expect(enlace.getAttribute('href')).toBe(evidencia.url);
    expect(enlace.getAttribute('rel')).toContain('noopener');
    expect((fixture.nativeElement as HTMLElement).querySelector('img')?.getAttribute('src')).toBe(
      evidencia.url_miniatura,
    );
    boton(t.actualizar).click();
    fixture.detectChanges();
    http.expectOne(`${ruta}/evidencias?page=0&size=20`).flush(pagina([evidencia]));
  });

  it('sin permiso no consulta ni captura ni ofrece el cierre', () => {
    fixture.componentRef.setInput('puedeConsultar', false);
    fixture.detectChanges();
    http.expectNone(() => true);
    expect(texto().trim()).toBe('');
  });

  it.each<EstadoOrden>(['PROGRAMADA', 'EN_EJECUCION'])(
    'permite capturar y guardar evidencia en %s',
    (estado) => {
      fixture.componentRef.setInput('orden', { ...orden, estado });
      cargar();
      capturar();
      expect(texto()).toContain(t.elegida);
      boton(t.guardar).click();
      fixture.detectChanges();
      const req = http.expectOne(`${ruta}/evidencias`);
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.has('Content-Type')).toBe(false);
      const datos = req.request.body as FormData;
      const id = datos.get('id') as string;
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(datos.get('foto')).toBeInstanceOf(Blob);
      expect(datos.get('miniatura')).toBeInstanceOf(Blob);
      expect(datos.get('capturada_en')).toBe(captura.capturada_en);
      expect(datos.get('elemento_ref')).toBe(orden.elemento_ref);
      expect(datos.get('latitud')).toBe('14.62');
      expect(fixture.componentInstance.envioPendiente()).toBe(true);
      req.flush({ ...evidencia, id });
      fixture.detectChanges();
      expect(fixture.componentInstance.envioPendiente()).toBe(false);
      http.expectOne(`${ruta}/evidencias?page=0&size=20`).flush(pagina([{ ...evidencia, id }]));
      fixture.detectChanges();
      expect(texto()).toContain(t.guardada);
    },
  );

  it.each<EstadoOrden>(['PROPUESTA', 'EJECUTADA', 'DESCARTADA', 'CANCELADA'])(
    'consulta fotos conservadas pero no agrega ni cierra en %s',
    (estado) => {
      fixture.componentRef.setInput('orden', { ...orden, estado });
      cargar([evidencia]);
      expect(fixture.debugElement.query(By.directive(CapturaFoto))).toBeNull();
      expect((fixture.nativeElement as HTMLElement).querySelector('form')).toBeNull();
      expect(texto()).toContain(t.foto);
    },
  );

  it('no envía coordenadas ausentes y conserva UUID al reintentar manualmente una carga incierta', () => {
    cargar();
    capturar({ ...captura, latitud: null, longitud: null });
    boton(t.guardar).click();
    fixture.detectChanges();
    const primera = http.expectOne(`${ruta}/evidencias`);
    const datos = primera.request.body as FormData;
    expect(datos.has('latitud')).toBe(false);
    expect(datos.has('longitud')).toBe(false);
    primera.flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(texto()).toContain(t.errorSubida);
    http.expectNone((r) => r.method === 'POST');
    boton(t.guardar).click();
    fixture.detectChanges();
    const segunda = http.expectOne(`${ruta}/evidencias`);
    expect((segunda.request.body as FormData).get('id')).toBe(datos.get('id'));
    segunda.flush({}, { status: 422, statusText: 'Invalid' });
    fixture.detectChanges();
    expect(texto()).toContain(t.archivoInvalido);
  });

  it('una foto elegida no sustituye a una guardada para el cierre', () => {
    cargar();
    capturar();
    llenar();
    boton(t.cerrar).click();
    fixture.detectChanges();
    expect(texto()).toContain(t.faltaFoto);
    http.expectNone((r) => r.url.endsWith('/cierre'));
  });

  it('valida fecha y responsable antes de cerrar y cuenta caracteres Unicode', () => {
    cargar([evidencia]);
    boton(t.cerrar).click();
    fixture.detectChanges();
    expect(texto()).toContain(t.camposInvalidos);
    llenar('a'.repeat(151));
    boton(t.cerrar).click();
    fixture.detectChanges();
    http.expectNone((r) => r.method === 'POST');
    llenar('🚧'.repeat(150));
    boton(t.cerrar).click();
    fixture.detectChanges();
    const req = http.expectOne(`${ruta}/cierre`);
    expect(req.request.body).toEqual({
      fecha_ejecucion: '2026-10-20',
      responsable: '🚧'.repeat(150),
    });
    req.flush({}, { status: 422, statusText: 'Invalid' });
    fixture.detectChanges();
    http.expectOne(`${ruta}/evidencias?page=0&size=20`).flush(pagina([evidencia]));
  });

  it('confirma cierre solo con DTO persistido y bloquea doble envío', () => {
    cargar([evidencia]);
    llenar();
    const recibida = vi.fn();
    fixture.componentInstance.cerrada.subscribe(recibida);
    boton(t.cerrar).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.envioPendiente()).toBe(true);
    boton(t.cerrando).click();
    const req = http.expectOne(`${ruta}/cierre`);
    const resultado = {
      ...orden,
      estado: 'EJECUTADA',
      fecha_ejecucion: '2026-10-20',
      responsable: 'Cuadrilla de prueba',
    };
    req.flush(resultado);
    fixture.detectChanges();
    expect(recibida).toHaveBeenCalledExactlyOnceWith(resultado);
    expect(fixture.componentInstance.envioPendiente()).toBe(false);
    http.expectNone((r) => r.method === 'POST');
  });

  it.each([401, 403])(
    'retira datos y avisa al contenedor si la sesión o el permiso fallan (%s)',
    (status) => {
      cargar([evidencia]);
      capturar();
      const denegada = vi.fn();
      fixture.componentInstance.accesoDenegado.subscribe(denegada);
      boton(t.guardar).click();
      fixture.detectChanges();
      http.expectOne(`${ruta}/evidencias`).flush({}, { status, statusText: 'Denied' });
      fixture.detectChanges();
      expect(denegada).toHaveBeenCalledWith(status);
      expect((fixture.nativeElement as HTMLElement).querySelector('a')).toBeNull();
      expect(fixture.debugElement.query(By.directive(CapturaFoto))).toBeNull();
    },
  );

  it('un cierre incierto solicita releer la orden y nunca reintenta el POST', () => {
    cargar([evidencia]);
    llenar();
    const actualizar = vi.fn();
    fixture.componentInstance.actualizarOrden.subscribe(actualizar);
    boton(t.cerrar).click();
    fixture.detectChanges();
    http.expectOne(`${ruta}/cierre`).flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(actualizar).toHaveBeenCalledOnce();
    http.expectNone((r) => r.method === 'POST');
  });

  it('una respuesta de cierre de otra orden no se aplica', () => {
    cargar([evidencia]);
    llenar();
    const cerrar = vi.fn();
    const actualizar = vi.fn();
    fixture.componentInstance.cerrada.subscribe(cerrar);
    fixture.componentInstance.actualizarOrden.subscribe(actualizar);
    boton(t.cerrar).click();
    fixture.detectChanges();
    http.expectOne(`${ruta}/cierre`).flush({ ...orden, id: 'otra', estado: 'EJECUTADA' });
    expect(cerrar).not.toHaveBeenCalled();
    expect(actualizar).toHaveBeenCalledOnce();
  });

  it('cambiar de orden cancela lecturas y descarta respuestas tardías de escritura', () => {
    cargar([evidencia]);
    capturar();
    boton(t.guardar).click();
    fixture.detectChanges();
    const envio = http.expectOne(`${ruta}/evidencias`);
    fixture.componentRef.setInput('orden', { ...orden, id: 'otra' });
    fixture.detectChanges();
    http
      .expectOne(
        `/api/v1/puentes/${orden.puente_id}/ordenes-mantenimiento/otra/evidencias?page=0&size=20`,
      )
      .flush({ ...pagina(), orden_id: 'otra' });
    envio.flush({ ...evidencia, id: (envio.request.body as FormData).get('id') });
    fixture.detectChanges();
    expect(texto()).not.toContain(t.guardada);
    expect(texto()).not.toContain(t.elegida);
    http.expectNone(() => true);
  });

  it('pérdida de permiso cancela la lectura y retira evidencia privada', () => {
    fixture.detectChanges();
    const req = http.expectOne(`${ruta}/evidencias?page=0&size=20`);
    fixture.componentRef.setInput('puedeConsultar', false);
    fixture.detectChanges();
    expect(req.cancelled).toBe(true);
    expect(texto().trim()).toBe('');
  });

  it('rechaza una página de evidencia que corresponde a otra orden', () => {
    fixture.detectChanges();
    http
      .expectOne(`${ruta}/evidencias?page=0&size=20`)
      .flush({ ...pagina([evidencia]), orden_id: 'otra' });
    fixture.detectChanges();
    expect(texto()).toContain(t.incompatible);
    expect((fixture.nativeElement as HTMLElement).querySelector('a')).toBeNull();
  });
});
