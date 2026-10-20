import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TEXTOS } from '../../shared/textos';
import { BandejaPropuestas } from './bandeja-propuestas';
import { OrdenMantenimientoDTO, PaginaPropuestas } from './modelos';

describe('BandejaPropuestas', () => {
  const t = TEXTOS.mantenimiento;
  const b = t.bandeja;
  const puente = '019a0022-0000-7000-8000-000000000001';
  const otroPuente = '019a0022-0000-7000-8000-000000000002';
  const orden: OrdenMantenimientoDTO = {
    id: '019a0026-0000-7000-8000-000000000012',
    puente_id: puente,
    inspeccion_id: null,
    tipo: 'CORRECTIVO',
    estado: 'PROPUESTA',
    descripcion: 'Propuesta A ficticia de prueba',
    elemento_ref: null,
    prioridad_sugerida: 'MEDIA',
    prioridad: 'ALTA',
    justificacion_prioridad: 'Justificación de prueba',
    fecha_programada: null,
    fecha_ejecucion: null,
    responsable: null,
    motivo: null,
    creado_en: '2026-10-19T12:00:00Z',
    actualizado_en: '2026-10-19T12:00:00Z',
  };
  const segunda: OrdenMantenimientoDTO = {
    ...orden,
    id: '019a0026-0000-7000-8000-000000000011',
    descripcion: 'Propuesta B ficticia de prueba',
  };
  const ruta = `/api/v1/puentes/${puente}/ordenes-mantenimiento/${orden.id}/aceptacion`;
  let fixture: ComponentFixture<BandejaPropuestas>;
  let http: HttpTestingController;

  function pagina(
    content: readonly OrdenMantenimientoDTO[],
    page = 0,
    total = content.length,
    size = 20,
  ): PaginaPropuestas {
    return {
      puente_id: content[0]?.puente_id ?? puente,
      content,
      page,
      size,
      total_elements: total,
      total_pages: Math.ceil(total / size),
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BandejaPropuestas],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BandejaPropuestas);
    fixture.componentRef.setInput('puenteId', puente);
    fixture.componentRef.setInput('pagina', pagina([orden, segunda]));
    fixture.componentRef.setInput('puedeAceptar', true);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function boton(nombre: string, indice = 0): HTMLButtonElement {
    const encontrados = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ].filter((elemento) => elemento.textContent?.trim() === nombre);
    expect(encontrados[indice]).toBeDefined();
    return encontrados[indice];
  }

  function seleccionar() {
    boton(b.revisar).click();
    fixture.detectChanges();
  }

  it('presenta tabla semántica, prioridades y selección sin inventar una consulta GET', () => {
    expect(texto()).toContain(orden.descripcion);
    expect(texto()).toContain(segunda.descripcion);
    expect(texto()).toContain(t.prioridades.ALTA);
    expect((fixture.nativeElement as HTMLElement).querySelector('caption')?.textContent).toContain(
      b.tabla,
    );
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('th[scope="col"]')).toHaveLength(
      4,
    );
    seleccionar();
    expect(boton(b.seleccionada).getAttribute('aria-pressed')).toBe('true');
    expect(boton(t.aceptar).type).toBe('button');
    http.expectNone(() => true);
  });

  it('solicita la página inicial cuando todavía no se entregaron datos', () => {
    fixture.componentRef.setInput('pagina', null);
    fixture.detectChanges();
    const consultar = vi.fn();
    fixture.componentInstance.consultaSolicitada.subscribe(consultar);
    boton(b.cargar).click();
    fixture.detectChanges();
    expect(consultar).toHaveBeenCalledExactlyOnceWith({ puente_id: puente, page: 0, size: 20 });
    expect(texto()).toContain(b.esperando);
    http.expectNone(() => true);
  });

  it('pagina por servidor mediante evento, conservando tamaño y esperando datos nuevos', () => {
    fixture.componentRef.setInput('pagina', pagina([orden], 0, 2, 1));
    fixture.detectChanges();
    const consultar = vi.fn();
    fixture.componentInstance.consultaSolicitada.subscribe(consultar);
    expect(boton(b.anterior).disabled).toBe(true);
    boton(b.siguiente).click();
    fixture.detectChanges();
    expect(consultar).toHaveBeenCalledExactlyOnceWith({ puente_id: puente, page: 1, size: 1 });
    expect(texto()).not.toContain(orden.descripcion);
    fixture.componentRef.setInput('pagina', pagina([segunda], 1, 2, 1));
    fixture.detectChanges();
    expect(texto()).toContain(segunda.descripcion);
    expect(boton(b.siguiente).disabled).toBe(true);
    expect(boton(b.anterior).disabled).toBe(false);
  });

  it('acepta mediante el hijo real y solicita recarga antes de mostrar nuevos totales', () => {
    const consultar = vi.fn();
    const aceptada = vi.fn();
    fixture.componentInstance.consultaSolicitada.subscribe(consultar);
    fixture.componentInstance.aceptada.subscribe(aceptada);
    seleccionar();
    boton(t.aceptar).click();
    fixture.detectChanges();
    expect(boton(b.seleccionada).disabled).toBe(true);
    expect(boton(b.actualizar).disabled).toBe(true);
    const resultado = { ...orden, estado: 'PROGRAMADA' };
    http.expectOne(ruta).flush(resultado);
    fixture.detectChanges();
    expect(aceptada).toHaveBeenCalledExactlyOnceWith(resultado);
    expect(consultar).toHaveBeenCalledExactlyOnceWith({ puente_id: puente, page: 0, size: 20 });
    expect(texto()).toContain(t.confirmada);
    expect(texto()).toContain(b.esperando);
    expect((fixture.nativeElement as HTMLElement).querySelector('table')).toBeNull();
    fixture.componentRef.setInput('pagina', pagina([segunda]));
    fixture.detectChanges();
    expect(texto()).not.toContain(orden.descripcion);
    expect(texto()).toContain(segunda.descripcion);
    expect(texto()).not.toContain(b.esperando);
  });

  it('vuelve a la página anterior al aceptar la única propuesta de la última página', () => {
    fixture.componentRef.setInput('pagina', pagina([orden], 1, 2, 1));
    fixture.detectChanges();
    const consultar = vi.fn();
    fixture.componentInstance.consultaSolicitada.subscribe(consultar);
    seleccionar();
    boton(t.aceptar).click();
    http.expectOne(ruta).flush({ ...orden, estado: 'PROGRAMADA' });
    expect(consultar).toHaveBeenCalledExactlyOnceWith({ puente_id: puente, page: 0, size: 1 });
  });

  it('conserva la explicación del conflicto y pide datos nuevos sin repetir el POST', () => {
    const consultar = vi.fn();
    fixture.componentInstance.consultaSolicitada.subscribe(consultar);
    seleccionar();
    boton(t.aceptar).click();
    http.expectOne(ruta).flush({}, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(texto()).toContain(t.conflicto);
    expect(texto()).toContain(b.esperando);
    expect((fixture.nativeElement as HTMLElement).querySelector('table')).toBeNull();
    expect(boton(t.aceptar).disabled).toBe(true);
    expect(consultar).toHaveBeenCalledTimes(1);
    http.expectNone(ruta);
    fixture.componentRef.setInput('pagina', pagina([segunda]));
    fixture.detectChanges();
    expect(texto()).not.toContain(t.conflicto);
    expect(texto()).not.toContain(orden.descripcion);
  });

  it.each([401, 403])(
    'retira también la tabla cuando la aceptación pierde el acceso (%s)',
    (status) => {
      seleccionar();
      boton(t.aceptar).click();
      http.expectOne(ruta).flush({}, { status, statusText: 'Error' });
      fixture.detectChanges();
      expect(texto()).not.toContain(orden.descripcion);
      expect(texto()).not.toContain(segunda.descripcion);
      expect(texto()).toContain(status === 401 ? t.sinSesion : t.sinPermiso);
    },
  );

  it('cambiar de puente retira la selección anterior y rechaza una página del otro puente', () => {
    seleccionar();
    fixture.componentRef.setInput('puenteId', otroPuente);
    fixture.detectChanges();
    expect(texto()).toContain(b.datosIncompatibles);
    expect(texto()).not.toContain(orden.descripcion);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('app-aceptacion-propuesta'),
    ).toBeNull();
    fixture.componentRef.setInput('pagina', pagina([{ ...segunda, puente_id: otroPuente }]));
    fixture.detectChanges();
    expect(texto()).toContain(segunda.descripcion);
    expect(texto()).not.toContain(b.datosIncompatibles);
  });

  it('una página vacía del puente anterior no se presenta como ausencia de propuestas del nuevo', () => {
    const vacia = pagina([]);
    fixture.componentRef.setInput('pagina', vacia);
    fixture.componentRef.setInput('puenteId', otroPuente);
    fixture.detectChanges();
    expect(texto()).toContain(b.datosIncompatibles);
    expect(texto()).not.toContain(b.vacia);
    fixture.componentRef.setInput('pagina', { ...vacia, puente_id: otroPuente });
    fixture.detectChanges();
    expect(texto()).toContain(b.vacia);
    expect(texto()).not.toContain(b.datosIncompatibles);
  });

  it('una nueva página cancela la selección de un registro que dejó de pertenecer a ella', () => {
    seleccionar();
    fixture.componentRef.setInput('pagina', pagina([segunda]));
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('app-aceptacion-propuesta'),
    ).toBeNull();
  });

  it('no presenta estados históricos como pendientes', () => {
    fixture.componentRef.setInput('pagina', pagina([{ ...orden, estado: 'EJECUTADA' }]));
    fixture.detectChanges();
    expect(texto()).toContain(b.datosIncompatibles);
    expect(texto()).not.toContain(orden.descripcion);
  });

  it('distingue bandeja vacía y página fuera de rango sin mostrar un contador imposible', () => {
    fixture.componentRef.setInput('pagina', pagina([]));
    fixture.detectChanges();
    expect(texto()).toContain(b.vacia);
    fixture.componentRef.setInput('pagina', pagina([], 1, 1, 20));
    fixture.detectChanges();
    expect(texto()).toContain(b.paginaVacia);
    expect(texto()).not.toContain(`${b.pagina} 2 ${b.de} 1`);
  });

  it('muestra carga retirando los datos y la acción mientras se consulta', () => {
    seleccionar();
    fixture.componentRef.setInput('cargando', true);
    fixture.detectChanges();
    expect(texto()).toContain(b.cargando);
    expect(texto()).not.toContain(orden.descripcion);
    expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
  });

  it.each([0, 401, 403, 404, 500])(
    'maneja el error de lectura %s sin conservar la selección privada',
    (status) => {
      seleccionar();
      fixture.componentRef.setInput('codigoError', status);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).not.toBeNull();
      expect(texto()).not.toContain(orden.descripcion);
      if (status === 401 || status === 403) {
        expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
      } else {
        expect(boton(b.actualizar).disabled).toBe(false);
      }
    },
  );

  it('puede mostrar el resumen sin habilitar aceptación cuando el contenedor no concede ese permiso', () => {
    fixture.componentRef.setInput('puedeAceptar', false);
    fixture.detectChanges();
    seleccionar();
    expect(texto()).toContain(orden.descripcion);
    expect(texto()).not.toContain(t.aceptar);
    http.expectNone(() => true);
  });
});
