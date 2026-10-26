import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TEXTOS } from '../../shared/textos';
import { ProgramacionOrden } from './programacion-orden';
import { EstadoOrden, OrdenMantenimientoDTO } from './modelos';

const orden: OrdenMantenimientoDTO = {
  id: '019a0032-0000-7000-8000-000000000010',
  puente_id: '019a0032-0000-7000-8000-000000000001',
  inspeccion_id: null,
  tipo: 'CORRECTIVO',
  estado: 'PROGRAMADA',
  descripcion: 'Orden de prueba',
  elemento_ref: 'elemento-de-prueba',
  prioridad_sugerida: 'MEDIA',
  prioridad: 'ALTA',
  justificacion_prioridad: 'Justificación previa',
  fecha_programada: null,
  fecha_ejecucion: null,
  responsable: null,
  motivo: null,
  creado_en: '2026-10-20T12:00:00Z',
  actualizado_en: '2026-10-20T12:00:00Z',
};
const fecha = '2026-11-02';
const ruta = `/api/v1/puentes/${orden.puente_id}/ordenes-mantenimiento/${orden.id}/fecha-programada`;
const t = TEXTOS.mantenimiento.programacion;
const resultado = { ...orden, fecha_programada: fecha };

describe('ProgramacionOrden', () => {
  let fixture: ComponentFixture<ProgramacionOrden>;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProgramacionOrden],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(ProgramacionOrden);
    http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('orden', orden);
    fixture.componentRef.setInput('puedeConsultar', true);
    fixture.componentRef.setInput('puedeProgramar', true);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());
  const html = () => fixture.nativeElement as HTMLElement;
  const texto = () => html().textContent ?? '';
  function escribir(valor = fecha) {
    const campo = html().querySelector('input')!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }
  function enviar() {
    html()
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  }
  it('no inventa fecha inicial ni límites temporales', () => {
    const campo = html().querySelector('input')!;
    expect(campo.type).toBe('date');
    expect(campo.value).toBe('');
    expect(campo.hasAttribute('min')).toBe(false);
    expect(campo.hasAttribute('max')).toBe(false);
    expect(texto()).toContain(t.explicacion);
    http.expectNone(() => true);
  });
  it('inicializa y permite cambiar una fecha existente', () => {
    fixture.componentRef.setInput('orden', { ...orden, fecha_programada: '2026-10-25' });
    fixture.detectChanges();
    expect(html().querySelector('input')?.value).toBe('2026-10-25');
    escribir();
    enviar();
    http.expectOne(ruta).flush(resultado);
  });
  it.each<EstadoOrden>(['PROPUESTA', 'EN_EJECUCION', 'EJECUTADA', 'DESCARTADA', 'CANCELADA'])(
    'no permite programar en %s',
    (estado) => {
      fixture.componentRef.setInput('orden', { ...orden, estado });
      fixture.detectChanges();
      expect(html().querySelector('form')).toBeNull();
      http.expectNone(() => true);
    },
  );
  it.each(['puedeConsultar', 'puedeProgramar'])('requiere %s explícito', (permiso) => {
    fixture.componentRef.setInput(permiso, false);
    fixture.detectChanges();
    expect(html().querySelector('form')).toBeNull();
    http.expectNone(() => true);
  });
  it('requiere fecha y nunca permite eliminarla', () => {
    escribir('');
    enviar();
    expect(texto()).toContain(t.fechaRequerida);
    expect(html().querySelector('input')?.getAttribute('aria-invalid')).toBe('true');
    http.expectNone(() => true);
  });
  it('la misma fecha no genera escritura', () => {
    fixture.componentRef.setInput('orden', resultado);
    fixture.detectChanges();
    enviar();
    expect(texto()).toContain(t.sinCambio);
    http.expectNone(() => true);
  });
  it.each(['1900-01-01', '2100-12-31', '2028-02-29'])(
    'envía fecha civil %s sin conversiones horarias',
    (fecha_programada) => {
      escribir(fecha_programada);
      enviar();
      const req = http.expectOne(ruta);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ fecha_programada });
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush({ ...orden, fecha_programada });
    },
  );
  it('solo confirma el DTO recibido del servidor', () => {
    const programada = vi.fn();
    fixture.componentInstance.programada.subscribe(programada);
    escribir();
    enviar();
    const req = http.expectOne(ruta);
    expect(programada).not.toHaveBeenCalled();
    req.flush(resultado);
    expect(programada).toHaveBeenCalledExactlyOnceWith(resultado);
  });

  it('bloquea doble envío y una operación ajena impide guardar', () => {
    escribir();
    fixture.componentRef.setInput('bloqueada', true);
    fixture.detectChanges();
    enviar();
    http.expectNone(() => true);
    fixture.componentRef.setInput('bloqueada', false);
    fixture.detectChanges();
    enviar();
    expect(fixture.componentInstance.envioPendiente()).toBe(true);
    expect(html().querySelector('fieldset')?.disabled).toBe(true);
    enviar();
    http.expectOne(ruta).flush(resultado);
    fixture.detectChanges();
    expect(fixture.componentInstance.envioPendiente()).toBe(false);
  });

  it.each([400, 422])('conserva los datos para corregir rechazo %s sin repetir PATCH', (status) => {
    escribir();
    enviar();
    const actualizar = vi.fn();
    fixture.componentInstance.actualizacionRequerida.subscribe(actualizar);
    http.expectOne(ruta).flush({ status }, { status, statusText: 'Invalid' });
    fixture.detectChanges();
    expect(texto()).toContain(t.datosInvalidos);
    expect(html().querySelector('input')?.value).toBe(fecha);
    expect(actualizar).not.toHaveBeenCalled();
    http.expectNone(() => true);
  });

  it.each([401, 403, 404, 409, 500, 0])(
    'propaga acceso/resultado incierto %s y no reintenta',
    (status) => {
      escribir();
      const actualizar = vi.fn();
      fixture.componentInstance.actualizacionRequerida.subscribe(actualizar);
      enviar();
      const req = http.expectOne(ruta);
      if (status === 0) req.error(new ProgressEvent('error'));
      else req.flush({}, { status, statusText: 'Error' });
      fixture.detectChanges();
      expect(actualizar).toHaveBeenCalledExactlyOnceWith(status);
      if (status === 401 || status === 403) expect(html().querySelector('form')).toBeNull();
      http.expectNone(() => true);
    },
  );

  it.each([
    { ...resultado, id: 'otra' },
    { ...resultado, puente_id: 'otro' },
    { ...resultado, estado: 'EN_EJECUCION' },
    { ...resultado, fecha_programada: null },
    { ...resultado, fecha_programada: '2026-11-03' },
  ])('exige relectura ante respuesta incompatible', (respuesta) => {
    escribir();
    const actualizar = vi.fn();
    const programada = vi.fn();
    fixture.componentInstance.actualizacionRequerida.subscribe(actualizar);
    fixture.componentInstance.programada.subscribe(programada);
    enviar();
    http.expectOne(ruta).flush(respuesta);
    expect(programada).not.toHaveBeenCalled();
    expect(actualizar).toHaveBeenCalledWith(500);
  });

  it('ignora resultados de otro contexto y limpia formulario al cambiar de orden', () => {
    escribir();
    enviar();
    const req = http.expectOne(ruta);
    const programada = vi.fn();
    fixture.componentInstance.programada.subscribe(programada);
    fixture.componentRef.setInput('orden', { ...orden, id: 'otra', fecha_programada: null });
    fixture.detectChanges();
    req.flush(resultado);
    expect(programada).not.toHaveBeenCalled();
    expect(html().querySelector('input')?.value).toBe('');
  });

  it('perder permiso invalida un resultado tardío de una escritura ya enviada', () => {
    escribir();
    enviar();
    const req = http.expectOne(ruta);
    const programada = vi.fn();
    fixture.componentInstance.programada.subscribe(programada);
    fixture.componentRef.setInput('puedeProgramar', false);
    fixture.detectChanges();
    req.flush(resultado);
    expect(programada).not.toHaveBeenCalled();
    expect(html().querySelector('form')).toBeNull();
  });

  it('destruir la vista desuscribe HTTP sin afirmar rollback del servidor', () => {
    escribir();
    enviar();
    const req = http.expectOne(ruta);
    fixture.destroy();
    expect(req.cancelled).toBe(true);
  });
});
