import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TEXTOS } from '../../shared/textos';
import { AceptacionPropuesta } from './aceptacion-propuesta';
import { EstadoOrden, OrdenMantenimientoDTO } from './modelos';

describe('AceptacionPropuesta', () => {
  const t = TEXTOS.mantenimiento;
  const orden: OrdenMantenimientoDTO = {
    id: '019a0025-0000-7000-8000-000000000010',
    puente_id: '019a0025-0000-7000-8000-000000000001',
    inspeccion_id: null,
    tipo: 'CORRECTIVO',
    estado: 'PROPUESTA',
    descripcion: 'Intervención ficticia para prueba de componente',
    elemento_ref: null,
    prioridad_sugerida: 'MEDIA',
    prioridad: 'ALTA',
    justificacion_prioridad: 'Justificación previa',
    fecha_programada: '2026-10-25',
    fecha_ejecucion: null,
    responsable: null,
    motivo: null,
    creado_en: '2026-10-19T12:00:00Z',
    actualizado_en: '2026-10-19T12:00:00Z',
  };
  const ruta = (registro = orden) =>
    `/api/v1/puentes/${registro.puente_id}/ordenes-mantenimiento/${registro.id}/aceptacion`;
  let fixture: ComponentFixture<AceptacionPropuesta>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AceptacionPropuesta],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AceptacionPropuesta);
    fixture.componentRef.setInput('orden', orden);
    fixture.componentRef.setInput('puedeAceptar', true);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function texto() {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function boton(): HTMLButtonElement {
    const resultado = (fixture.nativeElement as HTMLElement).querySelector('button');
    expect(resultado).not.toBeNull();
    return resultado as HTMLButtonElement;
  }

  it('presenta intervención, estado, prioridades y día civil en español sin consultar al cargar', () => {
    expect(texto()).toContain(orden.descripcion);
    expect(texto()).toContain(t.tipos.CORRECTIVO);
    expect(texto()).toContain(t.estados.PROPUESTA);
    expect(texto()).toContain(t.prioridades.MEDIA);
    expect(texto()).toContain(t.prioridades.ALTA);
    expect(texto()).toContain('Justificación previa');
    expect(texto()).toContain('25/10/2026');
    expect(boton().type).toBe('button');
    expect(boton().disabled).toBe(false);
    http.expectNone(() => true);
  });

  it('distingue la ausencia de fecha y sugerencia sin inventar valores', () => {
    fixture.componentRef.setInput('orden', {
      ...orden,
      fecha_programada: null,
      prioridad_sugerida: null,
      justificacion_prioridad: null,
    });
    fixture.detectChanges();
    expect(texto()).toContain(t.sinFecha);
    expect(texto()).toContain(t.sinSugerencia);
    expect(texto()).not.toContain(t.justificacion);
  });

  it('bloquea dobles clics y espera respuesta antes de mostrar Programada y emitir el DTO', () => {
    const evento = vi.fn();
    fixture.componentInstance.aceptada.subscribe(evento);
    boton().click();
    boton().click();
    fixture.detectChanges();
    expect(boton().disabled).toBe(true);
    expect(texto()).toContain(t.enviando);
    expect(texto()).not.toContain(t.confirmada);
    expect(evento).not.toHaveBeenCalled();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('section')?.getAttribute('aria-busy'),
    ).toBe('true');

    const resultado = { ...orden, estado: 'PROGRAMADA', actualizado_en: '2026-10-19T13:00:00Z' };
    http.expectOne(ruta()).flush(resultado);
    fixture.detectChanges();
    expect(evento).toHaveBeenCalledExactlyOnceWith(resultado);
    expect(texto()).toContain(t.confirmada);
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="status"]')).not.toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
    http.expectNone(ruta());
  });

  it('oculta la acción sin permiso explícito del contenedor', () => {
    fixture.componentRef.setInput('puedeAceptar', false);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
    http.expectNone(ruta());
  });

  it.each<EstadoOrden>(['PROGRAMADA', 'EN_EJECUCION', 'EJECUTADA', 'DESCARTADA', 'CANCELADA'])(
    'no ofrece aceptar una orden en %s',
    (estado) => {
      fixture.componentRef.setInput('orden', { ...orden, estado });
      fixture.detectChanges();
      expect(texto()).toContain(t.estados[estado]);
      expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
      http.expectNone(ruta());
    },
  );

  it.each([401, 403])(
    'retira los datos privados ante %s y solicita actualizar la orden',
    (status) => {
      const actualizar = vi.fn();
      fixture.componentInstance.actualizacionRequerida.subscribe(actualizar);
      boton().click();
      http.expectOne(ruta()).flush({}, { status, statusText: 'Error' });
      fixture.detectChanges();
      expect(texto()).not.toContain(orden.descripcion);
      expect(texto()).not.toContain(orden.justificacion_prioridad);
      expect(texto()).toContain(status === 401 ? t.sinSesion : t.sinPermiso);
      expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
      expect(actualizar).toHaveBeenCalledExactlyOnceWith({
        puente_id: orden.puente_id,
        id: orden.id,
      });
    },
  );

  it.each([400, 404, 409, 422])(
    'explica el error %s sin repetir una mutación con datos viejos',
    (status) => {
      const actualizar = vi.fn();
      fixture.componentInstance.actualizacionRequerida.subscribe(actualizar);
      boton().click();
      http.expectOne(ruta()).flush({}, { status, statusText: 'Error' });
      fixture.detectChanges();
      const esperado =
        status === 404 ? t.noEncontrada : status === 409 ? t.conflicto : t.datosInvalidos;
      expect(texto()).toContain(esperado);
      expect(boton().disabled).toBe(true);
      boton().click();
      http.expectNone(ruta());
      expect(actualizar).toHaveBeenCalledTimes(1);
      expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).not.toBeNull();
    },
  );

  it.each([0, 500])(
    'no afirma éxito ni reintenta automáticamente cuando el resultado es incierto (%s)',
    (status) => {
      boton().click();
      const peticion = http.expectOne(ruta());
      if (status === 0) peticion.error(new ProgressEvent('error'));
      else peticion.flush({}, { status, statusText: 'Error' });
      fixture.detectChanges();
      expect(texto()).toContain(t.resultadoDesconocido);
      expect(texto()).not.toContain(t.confirmada);
      expect(boton().disabled).toBe(true);
      http.expectNone(ruta());
    },
  );

  it('una nueva lectura del contenedor reemplaza el error y permite evaluar el estado actualizado', () => {
    boton().click();
    http.expectOne(ruta()).flush({}, { status: 409, statusText: 'Conflict' });
    fixture.componentRef.setInput('orden', { ...orden, estado: 'PROGRAMADA' });
    fixture.detectChanges();
    expect(texto()).not.toContain(t.conflicto);
    expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
  });

  it('no aplica una respuesta tardía a otra selección ni permite un segundo envío simultáneo', () => {
    const aceptada = vi.fn();
    const actualizar = vi.fn();
    fixture.componentInstance.aceptada.subscribe(aceptada);
    fixture.componentInstance.actualizacionRequerida.subscribe(actualizar);
    boton().click();
    const peticion = http.expectOne(ruta());
    const otra = {
      ...orden,
      id: '019a0025-0000-7000-8000-000000000016',
      descripcion: 'Otra propuesta',
    };
    fixture.componentRef.setInput('orden', otra);
    fixture.detectChanges();
    expect(boton().disabled).toBe(true);
    expect(boton().textContent).toContain(t.otroEnvio);
    peticion.flush({ ...orden, estado: 'PROGRAMADA' });
    fixture.detectChanges();
    expect(texto()).toContain('Otra propuesta');
    expect(texto()).not.toContain(t.confirmada);
    expect(boton().disabled).toBe(false);
    expect(aceptada).not.toHaveBeenCalled();
    expect(actualizar).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: orden.id }));
  });

  it('una pérdida del permiso durante el envío no emite la confirmación para la vista', () => {
    const aceptada = vi.fn();
    const actualizar = vi.fn();
    fixture.componentInstance.aceptada.subscribe(aceptada);
    fixture.componentInstance.actualizacionRequerida.subscribe(actualizar);
    boton().click();
    fixture.componentRef.setInput('puedeAceptar', false);
    fixture.detectChanges();
    http.expectOne(ruta()).flush({ ...orden, estado: 'PROGRAMADA' });
    expect(aceptada).not.toHaveBeenCalled();
    expect(actualizar).toHaveBeenCalledTimes(1);
  });

  it('destruir la vista libera la suscripción sin emitir confirmaciones', () => {
    const evento = vi.fn();
    fixture.componentInstance.aceptada.subscribe(evento);
    boton().click();
    const peticion = http.expectOne(ruta());
    fixture.destroy();
    expect(peticion.cancelled).toBe(true);
    expect(evento).not.toHaveBeenCalled();
  });

  it('muestra la referencia del elemento y la inspección de origen cuando la propuesta proviene de daños publicados', () => {
    fixture.componentRef.setInput('orden', {
      ...orden,
      elemento_ref: 'subestructura.estribo_entrada.socavacion',
      inspeccion_id: '019a0025-0000-7000-8000-000000000099',
    });
    fixture.detectChanges();
    expect(texto()).toContain(t.historial.elemento);
    expect(texto()).toContain('subestructura.estribo_entrada.socavacion');
    expect(texto()).toContain(t.historial.origen);
    expect(texto()).toContain('019a0025-0000-7000-8000-000000000099');
  });
});
