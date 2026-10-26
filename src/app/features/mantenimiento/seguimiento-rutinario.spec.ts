import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TEXTOS } from '../../shared/textos';
import { SeguimientoRutinario } from './seguimiento-rutinario';
import { OrdenMantenimientoDTO, SeguimientoRutinarioDTO } from './modelos';

const orden: OrdenMantenimientoDTO = {
  id: 'orden-a',
  puente_id: 'puente-a',
  inspeccion_id: null,
  tipo: 'RUTINARIO',
  estado: 'PROGRAMADA',
  descripcion: 'Limpieza ficticia',
  elemento_ref: null,
  prioridad_sugerida: null,
  prioridad: 'MEDIA',
  justificacion_prioridad: null,
  fecha_programada: '2026-03-01',
  fecha_ejecucion: null,
  responsable: null,
  motivo: null,
  creado_en: '2026-01-01T00:00:00Z',
  actualizado_en: '2026-01-01T00:00:00Z',
};
const datos: SeguimientoRutinarioDTO = {
  puente_id: 'puente-a',
  fecha_evaluacion: '2026-02-28',
  fecha_referencia: '2025-03-01',
  origen_referencia: 'EJECUCION_RUTINARIA',
  fecha_limite: '2026-03-01',
  programadas_en_plazo: 1,
  sin_fecha: 0,
  fechas_pasadas: 0,
  posteriores_al_limite: 0,
  ordenes: {
    puente_id: 'puente-a',
    content: [orden],
    page: 0,
    size: 20,
    total_elements: 1,
    total_pages: 1,
  },
};
const t = TEXTOS.mantenimiento.rutinarioAnual;
const ruta = (puente = 'puente-a', page = 0) =>
  `/api/v1/puentes/${puente}/ordenes-mantenimiento/rutinario-anual?page=${page}&size=20`;

describe('SeguimientoRutinario', () => {
  let fixture: ComponentFixture<SeguimientoRutinario>;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SeguimientoRutinario],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(SeguimientoRutinario);
    http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('puenteId', 'puente-a');
    fixture.componentRef.setInput('puedeConsultar', true);
  });
  afterEach(() => http.verify());
  const html = () => fixture.nativeElement as HTMLElement;
  const texto = () => html().textContent ?? '';
  const boton = (nombre: string) =>
    [...html().querySelectorAll('button')].find((b) => b.textContent?.trim() === nombre)!;
  function cargar(respuesta = datos) {
    fixture.detectChanges();
    http.expectOne(ruta()).flush(respuesta);
    fixture.detectChanges();
  }

  it('muestra fechas civiles, fuente y conteos del servidor sin acreditar ejecución', () => {
    cargar();
    expect(texto()).toContain('28/02/2026');
    expect(texto()).toContain('01/03/2026');
    expect(texto()).toContain(t.origenes.EJECUCION_RUTINARIA);
    expect(texto()).toContain(t.explicacion);
    expect(html().querySelectorAll('th[scope="col"]')).toHaveLength(4);
  });
  it('sin permiso no consulta ni conserva datos anteriores', () => {
    cargar();
    fixture.componentRef.setInput('puedeConsultar', false);
    fixture.detectChanges();
    expect(texto()).not.toContain(orden.descripcion);
    expect(texto()).toContain(t.sinPermiso);
    http.expectNone(() => true);
  });
  it('una página vacía conserva registro y plazo, sin inventar programación', () => {
    cargar({
      ...datos,
      origen_referencia: 'REGISTRO_PUENTE',
      programadas_en_plazo: 0,
      ordenes: { ...datos.ordenes, content: [], total_elements: 0, total_pages: 0 },
    });
    expect(texto()).toContain(t.origenes.REGISTRO_PUENTE);
    expect(texto()).toContain(t.sinProgramacion);
    expect(texto()).toContain(t.sinOrdenes);
    expect(html().querySelector('table')).toBeNull();
  });
  it('permite seleccionar para abrir detalle, sin escribir ni programar automáticamente', () => {
    cargar();
    const seleccionada = vi.fn();
    fixture.componentInstance.ordenSeleccionada.subscribe(seleccionada);
    boton(t.ver).click();
    expect(seleccionada).toHaveBeenCalledExactlyOnceWith(orden);
    http.expectNone((req) => req.method !== 'GET');
  });
  it('bloquea navegación, selección y recarga durante una escritura del host', () => {
    cargar();
    fixture.componentRef.setInput('bloqueada', true);
    fixture.detectChanges();
    const seleccionada = vi.fn();
    fixture.componentInstance.ordenSeleccionada.subscribe(seleccionada);
    boton(t.ver).click();
    boton(t.actualizar).click();
    expect(seleccionada).not.toHaveBeenCalled();
    http.expectNone(() => true);
  });
  it('pagina de verdad sin calcular conteos desde las filas visibles', () => {
    cargar({ ...datos, ordenes: { ...datos.ordenes, total_pages: 2, total_elements: 21 } });
    boton(t.siguiente).click();
    fixture.detectChanges();
    const req = http.expectOne(ruta('puente-a', 1));
    expect(req.request.method).toBe('GET');
    req.flush({
      ...datos,
      ordenes: { ...datos.ordenes, page: 1, total_pages: 2, total_elements: 21 },
    });
    fixture.detectChanges();
    expect(boton(t.anterior).disabled).toBe(false);
    expect(boton(t.siguiente).disabled).toBe(true);
  });
  it('cambio de puente cancela lectura previa y elimina información obsoleta', () => {
    fixture.detectChanges();
    const anterior = http.expectOne(ruta());
    fixture.componentRef.setInput('puenteId', 'puente-b');
    fixture.detectChanges();
    expect(anterior.cancelled).toBe(true);
    http.expectOne(ruta('puente-b')).flush({
      ...datos,
      puente_id: 'puente-b',
      ordenes: { ...datos.ordenes, puente_id: 'puente-b', content: [] },
    });
    fixture.detectChanges();
    expect(texto()).not.toContain(orden.descripcion);
  });
  it('recarga tras una operación confirmada por el host', () => {
    cargar();
    fixture.componentRef.setInput('actualizacion', 1);
    fixture.detectChanges();
    http.expectOne(ruta()).flush({ ...datos, programadas_en_plazo: 0 });
    fixture.detectChanges();
    expect(texto()).toContain(t.sinProgramacion);
  });
  it.each([401, 403])(
    'acceso rechazado %s retira datos y avisa al host sin reintentar',
    (status) => {
      const denegado = vi.fn();
      fixture.componentInstance.accesoDenegado.subscribe(denegado);
      fixture.detectChanges();
      http.expectOne(ruta()).flush({}, { status, statusText: 'Denied' });
      fixture.detectChanges();
      expect(denegado).toHaveBeenCalledExactlyOnceWith(status);
      expect(html().querySelector('table')).toBeNull();
      expect(html().querySelector('button')).toBeNull();
      http.expectNone(() => true);
    },
  );
  it.each([404, 500, 0])('error %s permite recarga explícita por GET', (status) => {
    fixture.detectChanges();
    const req = http.expectOne(ruta());
    if (status === 0) req.error(new ProgressEvent('error'));
    else req.flush({}, { status, statusText: 'Error' });
    fixture.detectChanges();
    boton(t.actualizar).click();
    fixture.detectChanges();
    http.expectOne(ruta()).flush(datos);
    fixture.detectChanges();
    expect(texto()).toContain(orden.descripcion);
  });
  it.each([
    { ...datos, puente_id: 'otro' },
    { ...datos, ordenes: { ...datos.ordenes, puente_id: 'otro' } },
    { ...datos, ordenes: { ...datos.ordenes, content: [{ ...orden, tipo: 'CORRECTIVO' }] } },
    { ...datos, ordenes: { ...datos.ordenes, content: [{ ...orden, estado: 'PROPUESTA' }] } },
  ])('rechaza respuesta ajena al alcance de la consulta', (respuesta) => {
    fixture.detectChanges();
    http.expectOne(ruta()).flush(respuesta);
    fixture.detectChanges();
    expect(texto()).toContain(t.incompatible);
    expect(html().querySelector('table')).toBeNull();
  });
  it('destruir la vista cancela su lectura', () => {
    fixture.detectChanges();
    const req = http.expectOne(ruta());
    fixture.destroy();
    expect(req.cancelled).toBe(true);
  });
});
