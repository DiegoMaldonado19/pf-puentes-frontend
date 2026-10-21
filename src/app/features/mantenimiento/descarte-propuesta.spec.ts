import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TEXTOS } from '../../shared/textos';
import { DescartePropuesta } from './descarte-propuesta';
import { EstadoOrden, OrdenMantenimientoDTO } from './modelos';

const orden: OrdenMantenimientoDTO = {
  id: '019a0031-0000-7000-8000-000000000010',
  puente_id: '019a0031-0000-7000-8000-000000000001',
  inspeccion_id: null,
  tipo: 'CORRECTIVO',
  estado: 'PROPUESTA',
  descripcion: 'Propuesta de prueba',
  elemento_ref: 'elemento-de-prueba',
  prioridad_sugerida: 'MEDIA',
  prioridad: 'ALTA',
  justificacion_prioridad: 'Justificación previa',
  fecha_programada: '2026-10-25',
  fecha_ejecucion: null,
  responsable: null,
  motivo: null,
  creado_en: '2026-10-20T12:00:00Z',
  actualizado_en: '2026-10-20T12:00:00Z',
};
const motivo = '  Ya existe otra propuesta para la misma intervención.  ';
const ruta = `/api/v1/puentes/${orden.puente_id}/ordenes-mantenimiento/${orden.id}/descarte`;
const t = TEXTOS.mantenimiento.descarte;

describe('DescartePropuesta', () => {
  let fixture: ComponentFixture<DescartePropuesta>;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DescartePropuesta],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(DescartePropuesta);
    http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('orden', orden);
    fixture.componentRef.setInput('puedeConsultar', true);
    fixture.componentRef.setInput('puedeDescartar', true);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());
  const html = () => fixture.nativeElement as HTMLElement;
  const texto = () => html().textContent ?? '';
  function escribir(valor = motivo) {
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

  it.each<EstadoOrden>(['PROGRAMADA', 'EN_EJECUCION', 'EJECUTADA', 'DESCARTADA', 'CANCELADA'])(
    'no ofrece descarte para %s',
    (estado) => {
      fixture.componentRef.setInput('orden', { ...orden, estado });
      fixture.detectChanges();
      expect(html().querySelector('form')).toBeNull();
      http.expectNone(() => true);
    },
  );

  it.each(['puedeConsultar', 'puedeDescartar'])('requiere permiso explícito de %s', (permiso) => {
    fixture.componentRef.setInput(permiso, false);
    fixture.detectChanges();
    expect(html().querySelector('form')).toBeNull();
    http.expectNone(() => true);
  });

  it.each(['', ' ', '\t', '\u2003'])('rechaza un motivo no escrito (%j) sin enviar', (valor) => {
    escribir(valor);
    enviar();
    expect(texto()).toContain(t.motivoRequerido);
    expect(html().querySelector('textarea')?.getAttribute('aria-invalid')).toBe('true');
    http.expectNone(() => true);
  });

  it('envía el motivo exacto y solo confirma con el DTO persistido de la misma orden', () => {
    escribir();
    const descartada = vi.fn();
    fixture.componentInstance.descartada.subscribe(descartada);
    enviar();
    const req = http.expectOne(ruta);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ motivo });
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(descartada).not.toHaveBeenCalled();
    const resultado = { ...orden, estado: 'DESCARTADA', motivo };
    req.flush(resultado);
    fixture.detectChanges();
    expect(descartada).toHaveBeenCalledExactlyOnceWith(resultado);
    expect(fixture.componentInstance.envioPendiente()).toBe(false);
  });

  it('no impone al texto de la orden el límite de otra columna de auditoría', () => {
    const largo = 'Motivo 🚧 '.repeat(100);
    escribir(largo);
    enviar();
    const req = http.expectOne(ruta);
    expect(req.request.body).toEqual({ motivo: largo });
    req.flush({ ...orden, estado: 'DESCARTADA', motivo: largo });
    expect(html().querySelector('textarea')?.hasAttribute('maxlength')).toBe(false);
  });

  it('bloquea doble envío y mantiene el motivo de la petición mientras se resuelve', () => {
    escribir();
    enviar();
    expect(fixture.componentInstance.envioPendiente()).toBe(true);
    expect(html().querySelector('button')?.disabled).toBe(true);
    expect(html().querySelector('textarea')?.readOnly).toBe(true);
    enviar();
    const req = http.expectOne(ruta);
    req.flush({ ...orden, estado: 'DESCARTADA', motivo });
    fixture.detectChanges();
    expect(fixture.componentInstance.envioPendiente()).toBe(false);
  });

  it('una operación ajena pendiente impide enviar el descarte', () => {
    escribir();
    fixture.componentRef.setInput('bloqueada', true);
    fixture.detectChanges();
    enviar();
    http.expectNone(() => true);
  });

  it.each([400, 422])(
    'conserva el motivo para corregir un rechazo de datos %s sin repetir el POST',
    (status) => {
      escribir();
      enviar();
      const actualizar = vi.fn();
      fixture.componentInstance.actualizacionRequerida.subscribe(actualizar);
      http.expectOne(ruta).flush({ status }, { status, statusText: 'Invalid' });
      fixture.detectChanges();
      expect(texto()).toContain(t.datosInvalidos);
      expect(html().querySelector('textarea')?.value).toBe(motivo);
      expect(actualizar).not.toHaveBeenCalled();
      http.expectNone(() => true);
    },
  );

  it.each([401, 403, 404, 409, 500, 0])(
    'solicita reconciliar acceso/estado al fallar con %s, sin reintento automático',
    (status) => {
      escribir();
      const actualizar = vi.fn();
      fixture.componentInstance.actualizacionRequerida.subscribe(actualizar);
      enviar();
      const req = http.expectOne(ruta);
      if (status === 0) req.error(new ProgressEvent('error'));
      else req.flush({ status }, { status, statusText: 'Error' });
      fixture.detectChanges();
      expect(actualizar).toHaveBeenCalledExactlyOnceWith(status);
      if (status === 401 || status === 403) expect(html().querySelector('form')).toBeNull();
      http.expectNone(() => true);
    },
  );

  it.each([
    { ...orden, estado: 'DESCARTADA', motivo, id: 'otra' },
    { ...orden, estado: 'DESCARTADA', motivo, puente_id: 'otro' },
    { ...orden, estado: 'PROGRAMADA', motivo },
    { ...orden, estado: 'DESCARTADA', motivo: null },
  ])('no confirma una respuesta incompatible y pide releer', (resultado) => {
    escribir();
    const actualizar = vi.fn();
    const descartada = vi.fn();
    fixture.componentInstance.actualizacionRequerida.subscribe(actualizar);
    fixture.componentInstance.descartada.subscribe(descartada);
    enviar();
    http.expectOne(ruta).flush(resultado);
    fixture.detectChanges();
    expect(descartada).not.toHaveBeenCalled();
    expect(actualizar).toHaveBeenCalledWith(500);
  });

  it('cambiar de orden descarta un resultado tardío y el motivo de la orden anterior', () => {
    escribir();
    enviar();
    const req = http.expectOne(ruta);
    const descartada = vi.fn();
    fixture.componentInstance.descartada.subscribe(descartada);
    fixture.componentRef.setInput('orden', { ...orden, id: 'otra' });
    fixture.detectChanges();
    req.flush({ ...orden, estado: 'DESCARTADA', motivo });
    fixture.detectChanges();
    expect(descartada).not.toHaveBeenCalled();
    expect(html().querySelector('textarea')?.value).toBe('');
  });

  it('perder permiso ignora un resultado tardío de una escritura ya enviada', () => {
    escribir();
    enviar();
    const req = http.expectOne(ruta);
    const descartada = vi.fn();
    fixture.componentInstance.descartada.subscribe(descartada);
    fixture.componentRef.setInput('puedeDescartar', false);
    fixture.detectChanges();
    req.flush({ ...orden, estado: 'DESCARTADA', motivo });
    expect(descartada).not.toHaveBeenCalled();
    expect(html().querySelector('form')).toBeNull();
  });

  it('destruir la vista desuscribe la petición sin afirmar rollback del servidor', () => {
    escribir();
    enviar();
    const req = http.expectOne(ruta);
    fixture.destroy();
    expect(req.cancelled).toBe(true);
  });
});
