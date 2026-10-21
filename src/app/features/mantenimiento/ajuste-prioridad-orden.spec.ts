import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TEXTOS } from '../../shared/textos';
import { AjustePrioridadOrden } from './ajuste-prioridad-orden';
import { EstadoOrden, OrdenMantenimientoDTO, PrioridadOrden } from './modelos';

const orden: OrdenMantenimientoDTO = {
  id: '019a0032-0000-7000-8000-000000000010',
  puente_id: '019a0032-0000-7000-8000-000000000001',
  inspeccion_id: null,
  tipo: 'CORRECTIVO',
  estado: 'PROPUESTA',
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
const justificacion = '  Se cambia la urgencia tras revisar la intervención.  ';
const ruta = `/api/v1/puentes/${orden.puente_id}/ordenes-mantenimiento/${orden.id}/prioridad`;
const t = TEXTOS.mantenimiento.ajustePrioridad;
const resultado = { ...orden, prioridad: 'BAJA' as const, justificacion_prioridad: justificacion };

describe('AjustePrioridadOrden', () => {
  let fixture: ComponentFixture<AjustePrioridadOrden>;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AjustePrioridadOrden],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(AjustePrioridadOrden);
    http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('orden', orden);
    fixture.componentRef.setInput('puedeConsultar', true);
    fixture.componentRef.setInput('puedeAjustar', true);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());
  const html = () => fixture.nativeElement as HTMLElement;
  const texto = () => html().textContent ?? '';
  function escribir(valor = justificacion, prioridad: PrioridadOrden = 'BAJA') {
    const selector = html().querySelector('select')!;
    selector.value = prioridad;
    selector.dispatchEvent(new Event('change'));
    const campo = html().querySelector('textarea')!;
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

  it('inicializa la vigente y muestra opciones sin modificar la sugerencia', () => {
    expect(html().querySelector('select')?.value).toBe('ALTA');
    expect([...html().querySelectorAll('option')].map((opcion) => opcion.value)).toEqual([
      'BAJA',
      'MEDIA',
      'ALTA',
    ]);
    expect(texto()).toContain(t.explicacion);
    http.expectNone(() => true);
  });

  it.each<EstadoOrden>(['PROPUESTA', 'PROGRAMADA', 'EN_EJECUCION'])(
    'permite ajustar solo con permiso en %s',
    (estado) => {
      fixture.componentRef.setInput('orden', { ...orden, estado });
      fixture.detectChanges();
      escribir();
      enviar();
      http.expectOne(ruta).flush({ ...resultado, estado });
    },
  );

  it.each<EstadoOrden>(['EJECUTADA', 'DESCARTADA', 'CANCELADA'])(
    'no ofrece ajuste en %s',
    (estado) => {
      fixture.componentRef.setInput('orden', { ...orden, estado });
      fixture.detectChanges();
      expect(html().querySelector('form')).toBeNull();
      http.expectNone(() => true);
    },
  );

  it.each(['puedeConsultar', 'puedeAjustar'])('requiere permiso explícito de %s', (permiso) => {
    fixture.componentRef.setInput(permiso, false);
    fixture.detectChanges();
    expect(html().querySelector('form')).toBeNull();
    http.expectNone(() => true);
  });

  it.each(['', ' ', '\t', '\u2003'])(
    'rechaza justificación no escrita (%j) sin enviar',
    (valor) => {
      escribir(valor);
      enviar();
      expect(texto()).toContain(t.justificacionRequerida);
      expect(html().querySelector('textarea')?.getAttribute('aria-invalid')).toBe('true');
      http.expectNone(() => true);
    },
  );

  it('repetir la vigente no envía una petición para editar la justificación previa', () => {
    escribir(justificacion, 'ALTA');
    enviar();
    expect(texto()).toContain(t.sinCambio);
    http.expectNone(() => true);
  });

  it('volver a la sugerida también requiere justificación', () => {
    escribir('', 'MEDIA');
    enviar();
    expect(texto()).toContain(t.justificacionRequerida);
    http.expectNone(() => true);
  });

  it('envía PATCH con texto exacto y solo confirma el DTO persistido', () => {
    escribir();
    const ajustada = vi.fn();
    fixture.componentInstance.ajustada.subscribe(ajustada);
    enviar();
    const req = http.expectOne(ruta);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ prioridad: 'BAJA', justificacion });
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(ajustada).not.toHaveBeenCalled();
    req.flush(resultado);
    fixture.detectChanges();
    expect(ajustada).toHaveBeenCalledExactlyOnceWith(resultado);
    expect(fixture.componentInstance.envioPendiente()).toBe(false);
  });

  it('no impone el límite de otra columna a la justificación de la orden', () => {
    const largo = 'Justificación 🚧 '.repeat(100);
    escribir(largo);
    enviar();
    const req = http.expectOne(ruta);
    expect(req.request.body).toEqual({ prioridad: 'BAJA', justificacion: largo });
    req.flush({ ...resultado, justificacion_prioridad: largo });
    expect(html().querySelector('textarea')?.hasAttribute('maxlength')).toBe(false);
  });

  it('admite una sugerencia ausente sin inventarla al ajustar', () => {
    fixture.componentRef.setInput('orden', { ...orden, prioridad_sugerida: null });
    fixture.detectChanges();
    escribir();
    const ajustada = vi.fn();
    fixture.componentInstance.ajustada.subscribe(ajustada);
    enviar();
    http.expectOne(ruta).flush({ ...resultado, prioridad_sugerida: null });
    expect(ajustada).toHaveBeenCalledOnce();
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
    expect(html().querySelector('textarea')?.value).toBe(justificacion);
    expect(html().querySelector('select')?.value).toBe('BAJA');
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
    { ...resultado, estado: 'EJECUTADA' },
    { ...resultado, prioridad: 'ALTA' },
    { ...resultado, justificacion_prioridad: null },
    { ...resultado, prioridad_sugerida: 'BAJA' },
  ])('no confirma respuesta incompatible y exige relectura', (respuesta) => {
    escribir();
    const actualizar = vi.fn();
    const ajustada = vi.fn();
    fixture.componentInstance.actualizacionRequerida.subscribe(actualizar);
    fixture.componentInstance.ajustada.subscribe(ajustada);
    enviar();
    http.expectOne(ruta).flush(respuesta);
    fixture.detectChanges();
    expect(ajustada).not.toHaveBeenCalled();
    expect(actualizar).toHaveBeenCalledWith(500);
  });

  it('ignora resultados de otro contexto y limpia formulario al cambiar de orden', () => {
    escribir();
    enviar();
    const req = http.expectOne(ruta);
    const ajustada = vi.fn();
    fixture.componentInstance.ajustada.subscribe(ajustada);
    fixture.componentRef.setInput('orden', { ...orden, id: 'otra', prioridad: 'MEDIA' });
    fixture.detectChanges();
    req.flush(resultado);
    expect(ajustada).not.toHaveBeenCalled();
    expect(html().querySelector('textarea')?.value).toBe('');
    expect(html().querySelector('select')?.value).toBe('MEDIA');
  });

  it('perder permiso invalida un resultado tardío de una escritura ya enviada', () => {
    escribir();
    enviar();
    const req = http.expectOne(ruta);
    const ajustada = vi.fn();
    fixture.componentInstance.ajustada.subscribe(ajustada);
    fixture.componentRef.setInput('puedeAjustar', false);
    fixture.detectChanges();
    req.flush(resultado);
    expect(ajustada).not.toHaveBeenCalled();
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
