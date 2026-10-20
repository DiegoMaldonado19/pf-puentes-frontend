import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TEXTOS } from '../../shared/textos';
import { ConsultaOrdenes } from './consulta-ordenes';
import { EstadoOrden, OrdenMantenimientoDTO, PaginaOrdenes } from './modelos';

describe('ConsultaOrdenes', () => {
  const puente = '019a0022-0000-7000-8000-000000000001';
  const otro = '019a0022-0000-7000-8000-000000000002';
  const orden: OrdenMantenimientoDTO = {
    id: '019a0026-0000-7000-8000-000000000012',
    puente_id: puente,
    inspeccion_id: null,
    tipo: 'CORRECTIVO',
    estado: 'CANCELADA',
    descripcion: 'Orden histórica ficticia de prueba',
    elemento_ref: null,
    prioridad_sugerida: 'MEDIA',
    prioridad: 'ALTA',
    justificacion_prioridad: 'Justificación de prueba',
    fecha_programada: null,
    fecha_ejecucion: null,
    responsable: null,
    motivo: 'Motivo histórico de prueba',
    creado_en: '2026-10-19T12:00:00Z',
    actualizado_en: '2026-10-19T12:00:00Z',
  };
  const segunda = {
    ...orden,
    id: '019a0026-0000-7000-8000-000000000011',
    descripcion: 'Segunda orden de prueba',
  };
  const ruta = (id = puente, page = 0, size = 20) =>
    `/api/v1/puentes/${id}/ordenes-mantenimiento?page=${page}&size=${size}`;
  const rutaDetalle = (id = orden.id, bridge = puente) =>
    `/api/v1/puentes/${bridge}/ordenes-mantenimiento/${id}`;
  const pagina = (
    content: readonly OrdenMantenimientoDTO[] = [orden],
    bridge = puente,
  ): PaginaOrdenes => ({
    puente_id: bridge,
    content,
    page: 0,
    size: 20,
    total_elements: content.length,
    total_pages: content.length ? 1 : 0,
  });
  const h = TEXTOS.mantenimiento.historial;
  let fixture: ComponentFixture<ConsultaOrdenes>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ConsultaOrdenes],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ConsultaOrdenes);
    fixture.componentRef.setInput('puenteId', puente);
    fixture.componentRef.setInput('puedeConsultar', true);
  });
  afterEach(() => http.verify());
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  function boton(nombre: string, indice = 0): HTMLButtonElement {
    const encontrados = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ].filter((b) => b.textContent?.trim() === nombre);
    expect(encontrados[indice]).toBeDefined();
    return encontrados[indice];
  }
  function cargar(content: readonly OrdenMantenimientoDTO[] = [orden]) {
    fixture.detectChanges();
    const req = http.expectOne(ruta());
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(pagina(content));
    fixture.detectChanges();
  }
  function abrir() {
    boton(h.ver).click();
    fixture.detectChanges();
  }

  it('presenta todos los estados con tabla semántica y solo consulta el servidor', () => {
    const estados: EstadoOrden[] = [
      'PROPUESTA',
      'PROGRAMADA',
      'EN_EJECUCION',
      'EJECUTADA',
      'DESCARTADA',
      'CANCELADA',
    ];
    cargar(estados.map((estado, i) => ({ ...orden, id: `${orden.id}-${i}`, estado })));
    for (const estado of estados) expect(texto()).toContain(TEXTOS.mantenimiento.estados[estado]);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('th[scope="col"]')).toHaveLength(
      5,
    );
    expect((fixture.nativeElement as HTMLElement).querySelector('caption')?.textContent).toContain(
      h.tabla,
    );
    http.expectNone((req) => req.method !== 'GET');
  });

  it('consulta el detalle real y conserva datos históricos, nulls y fechas civiles', () => {
    cargar();
    abrir();
    expect(texto()).toContain(h.cargandoDetalle);
    const req = http.expectOne(rutaDetalle());
    expect(req.request.method).toBe('GET');
    req.flush({
      ...orden,
      estado: 'EJECUTADA',
      inspeccion_id: 'inspeccion-origen',
      elemento_ref: 'elemento-de-prueba',
      fecha_programada: '2026-10-25',
      fecha_ejecucion: '2026-10-26',
      responsable: 'Responsable de prueba',
      creado_en: '2026-10-19T01:00:00Z',
    });
    fixture.detectChanges();
    expect(texto()).toContain('25/10/2026');
    expect(texto()).toContain('26/10/2026');
    expect(texto()).toContain('18/10/2026 19:00');
    expect(texto()).toContain('Responsable de prueba');
    expect(texto()).toContain('inspeccion-origen');
    expect(texto()).toContain('elemento-de-prueba');
    expect(texto()).toContain('Motivo histórico de prueba');
    expect(texto()).toContain(orden.justificacion_prioridad!);
    expect(texto()).not.toContain('null');
    expect(texto()).not.toContain(TEXTOS.mantenimiento.aceptar);
  });

  it('muestra ausencias explícitas sin inventar prioridad, origen ni fechas', () => {
    cargar();
    abrir();
    http
      .expectOne(rutaDetalle())
      .flush({ ...orden, prioridad_sugerida: null, fecha_programada: null, fecha_ejecucion: null });
    fixture.detectChanges();
    expect(texto()).toContain(TEXTOS.mantenimiento.sinSugerencia);
    expect(texto()).toContain(h.sinInspeccion);
    expect(texto()).toContain(h.sinDato);
  });

  it('pagina en servidor y restablece el detalle al cambiar de página', () => {
    fixture.detectChanges();
    http.expectOne(ruta()).flush({ ...pagina(), size: 1, total_elements: 2, total_pages: 2 });
    fixture.detectChanges();
    abrir();
    const detalle = http.expectOne(rutaDetalle());
    boton(h.siguiente).click();
    fixture.detectChanges();
    expect(detalle.cancelled).toBe(true);
    http
      .expectOne(ruta(puente, 1, 1))
      .flush({ ...pagina([segunda]), page: 1, size: 1, total_elements: 2, total_pages: 2 });
    fixture.detectChanges();
    expect(texto()).toContain(segunda.descripcion);
    expect(texto()).not.toContain(h.detalle);
  });

  it('cancela la selección anterior cuando se consulta otra orden', () => {
    cargar([orden, segunda]);
    abrir();
    const anterior = http.expectOne(rutaDetalle());
    boton(h.ver, 1).click();
    fixture.detectChanges();
    expect(anterior.cancelled).toBe(true);
    http.expectOne(rutaDetalle(segunda.id)).flush(segunda);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.detalle')?.textContent).toContain(
      segunda.descripcion,
    );
  });

  it.each([401, 403])(
    'retira lista y detalle si el detalle devuelve %s y no reintenta',
    (status) => {
      cargar();
      abrir();
      http.expectOne(rutaDetalle()).flush({ status }, { status, statusText: 'Error' });
      fixture.detectChanges();
      expect(texto()).not.toContain(orden.descripcion);
      expect((fixture.nativeElement as HTMLElement).querySelector('table')).toBeNull();
      expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
      expect(texto()).toContain(status === 401 ? h.sinSesion : h.sinPermiso);
      http.expectNone(ruta());
    },
  );

  it.each([401, 403, 404, 500])(
    'maneja error de listado %s sin conservar resultados anteriores',
    (status) => {
      cargar();
      boton(h.actualizar).click();
      fixture.detectChanges();
      http.expectOne(ruta()).flush({ status }, { status, statusText: 'Error' });
      fixture.detectChanges();
      expect(texto()).not.toContain(orden.descripcion);
      expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).not.toBeNull();
      http.expectNone(ruta());
    },
  );

  it('permite reintentar el listado explícitamente después de perder la conexión', () => {
    fixture.detectChanges();
    http.expectOne(ruta()).error(new ProgressEvent('error'));
    fixture.detectChanges();
    expect(texto()).toContain(h.sinConexion);
    boton(h.actualizar).click();
    fixture.detectChanges();
    http.expectOne(ruta()).flush(pagina());
    fixture.detectChanges();
    expect(texto()).toContain(orden.descripcion);
  });

  it.each([404, 500])('retira el detalle ante %s y permite volver a consultarlo', (status) => {
    cargar();
    abrir();
    http.expectOne(rutaDetalle()).flush({ status }, { status, statusText: 'Error' });
    fixture.detectChanges();
    const detalle = (fixture.nativeElement as HTMLElement).querySelector('.detalle');
    expect(detalle?.textContent).not.toContain(orden.descripcion);
    expect(detalle?.textContent).toContain(status === 404 ? h.noOrden : h.errorDetalle);
    boton(h.actualizarDetalle).click();
    fixture.detectChanges();
    http.expectOne(rutaDetalle()).flush(orden);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.detalle')?.textContent).toContain(
      orden.descripcion,
    );
  });

  it('cancela la lectura de detalle al cambiar de puente y no muestra datos viejos', () => {
    cargar();
    abrir();
    const anterior = http.expectOne(rutaDetalle());
    fixture.componentRef.setInput('puenteId', otro);
    fixture.detectChanges();
    expect(anterior.cancelled).toBe(true);
    http.expectOne(ruta(otro)).flush(pagina([], otro));
    fixture.detectChanges();
    expect(texto()).toContain(h.vacia);
    expect(texto()).not.toContain(orden.descripcion);
    expect(texto()).not.toContain(h.detalle);
  });

  it('cancela una lista pendiente y no reutiliza su respuesta en otro puente', () => {
    fixture.detectChanges();
    const anterior = http.expectOne(ruta());
    fixture.componentRef.setInput('puenteId', otro);
    fixture.detectChanges();
    expect(anterior.cancelled).toBe(true);
    http.expectOne(ruta(otro)).flush(pagina([], otro));
    fixture.detectChanges();
  });

  it('no consulta sin permiso, y al revocarlo cancela detalle y limpia datos', () => {
    fixture.componentRef.setInput('puedeConsultar', false);
    fixture.detectChanges();
    http.expectNone(ruta());
    fixture.componentRef.setInput('puedeConsultar', true);
    fixture.detectChanges();
    http.expectOne(ruta()).flush(pagina());
    fixture.detectChanges();
    abrir();
    const detalle = http.expectOne(rutaDetalle());
    fixture.componentRef.setInput('puedeConsultar', false);
    fixture.detectChanges();
    expect(detalle.cancelled).toBe(true);
    expect(texto()).not.toContain(orden.descripcion);
    expect(texto()).toContain(h.sinPermiso);
  });

  it('distingue colección vacía de página fuera de rango conservando los totales', () => {
    fixture.detectChanges();
    http.expectOne(ruta()).flush(pagina([]));
    fixture.detectChanges();
    expect(texto()).toContain(h.vacia);
    boton(h.actualizar).click();
    fixture.detectChanges();
    http.expectOne(ruta()).flush({ ...pagina([]), page: 3, total_elements: 1, total_pages: 1 });
    fixture.detectChanges();
    expect(texto()).toContain(h.paginaVacia);
    expect(texto()).not.toContain('Página 4 de 1');
  });

  it('rechaza listado y detalle que no corresponden al contexto solicitado', () => {
    fixture.detectChanges();
    http.expectOne(ruta()).flush(pagina([], otro));
    fixture.detectChanges();
    expect(texto()).toContain(h.incompatibles);
    boton(h.actualizar).click();
    fixture.detectChanges();
    http.expectOne(ruta()).flush(pagina());
    fixture.detectChanges();
    abrir();
    http.expectOne(rutaDetalle()).flush({ ...orden, puente_id: otro });
    fixture.detectChanges();
    expect(texto()).toContain(h.incompatibles);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.detalle')?.textContent,
    ).not.toContain(orden.descripcion);
  });

  it('cancela una lectura al destruirse', () => {
    fixture.detectChanges();
    const req = http.expectOne(ruta());
    fixture.destroy();
    expect(req.cancelled).toBe(true);
  });
  it('vuelve a una página existente si disminuye el historial mientras se consulta', () => {
    fixture.detectChanges();
    http.expectOne(ruta()).flush({ ...pagina([]), page: 3, total_elements: 1, total_pages: 1 });
    fixture.detectChanges();
    boton(h.anterior).click();
    fixture.detectChanges();
    http.expectOne(ruta()).flush(pagina());
    fixture.detectChanges();
    expect(texto()).toContain(orden.descripcion);
  });
  function cargarProgramada(permiso = true) {
    const programada: OrdenMantenimientoDTO = { ...orden, estado: 'PROGRAMADA', motivo: null };
    fixture.componentRef.setInput('puedeIniciar', permiso);
    cargar([programada]);
    abrir();
    http.expectOne(rutaDetalle()).flush(programada);
    fixture.detectChanges();
    return programada;
  }
  const rutaInicio = `/api/v1/puentes/${puente}/ordenes-mantenimiento/${orden.id}/inicio-ejecucion`;
  const inicio = TEXTOS.mantenimiento.inicio;

  it('mantiene la consulta sin acción si el host no concede permiso de inicio', () => {
    cargarProgramada(false);
    expect(texto()).not.toContain(inicio.accion);
    http.expectNone(rutaInicio);
  });

  it.each<EstadoOrden>(['PROPUESTA', 'EN_EJECUCION', 'EJECUTADA', 'DESCARTADA', 'CANCELADA'])(
    'no ofrece inicio desde %s aunque el actor tenga permiso',
    (estado) => {
      fixture.componentRef.setInput('puedeIniciar', true);
      const registro = { ...orden, estado };
      cargar([registro]);
      abrir();
      http.expectOne(rutaDetalle()).flush(registro);
      fixture.detectChanges();
      expect(texto()).not.toContain(inicio.accion);
      http.expectNone(rutaInicio);
    },
  );

  it('inicia una sola vez, bloquea navegación y actualiza lista/detalle con la respuesta confirmada', () => {
    const programada = cargarProgramada();
    const eventos: OrdenMantenimientoDTO[] = [];
    fixture.componentInstance.iniciada.subscribe((dto) => eventos.push(dto));
    const accion = boton(inicio.accion);
    accion.click();
    accion.click();
    fixture.detectChanges();
    const peticiones = http.match(rutaInicio);
    expect(peticiones).toHaveLength(1);
    expect(peticiones[0].request.method).toBe('POST');
    expect(peticiones[0].request.body).toBeNull();
    expect(boton(inicio.enviando).disabled).toBe(true);
    expect(boton(h.ver).disabled).toBe(true);
    expect(boton(h.actualizar).disabled).toBe(true);
    expect(boton(h.actualizarDetalle).disabled).toBe(true);
    expect(texto()).not.toContain(inicio.confirmada);
    const resultado: OrdenMantenimientoDTO = {
      ...programada,
      estado: 'EN_EJECUCION',
      actualizado_en: '2026-10-20T16:00:00Z',
    };
    peticiones[0].flush(resultado);
    fixture.detectChanges();
    expect(eventos).toEqual([resultado]);
    expect(texto()).toContain(inicio.confirmada);
    expect((fixture.nativeElement as HTMLElement).querySelector('tbody')?.textContent).toContain(
      'En ejecución',
    );
    expect((fixture.nativeElement as HTMLElement).querySelector('.detalle')?.textContent).toContain(
      'En ejecución',
    );
    expect(texto()).not.toContain(inicio.accion);
    http.expectNone(rutaInicio);
  });

  it.each([401, 403])(
    'un inicio rechazado con %s retira lista y detalle sin volver a enviar',
    (status) => {
      cargarProgramada();
      boton(inicio.accion).click();
      fixture.detectChanges();
      http.expectOne(rutaInicio).flush({ status }, { status, statusText: 'Error' });
      fixture.detectChanges();
      expect(texto()).not.toContain(orden.descripcion);
      expect(texto()).not.toContain(inicio.confirmada);
      expect(texto()).toContain(status === 401 ? h.sinSesion : h.sinPermiso);
      expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
      http.expectNone(ruta());
      http.expectNone(rutaInicio);
    },
  );

  it.each([409, 404, 422, 500])(
    'un inicio con error %s obliga a releer y nunca reintenta el POST',
    (status) => {
      const programada = cargarProgramada();
      boton(inicio.accion).click();
      fixture.detectChanges();
      http.expectOne(rutaInicio).flush({ status }, { status, statusText: 'Error' });
      fixture.detectChanges();
      expect(texto()).not.toContain(inicio.confirmada);
      expect(texto()).not.toContain(inicio.accion);
      const esperada =
        status === 409
          ? inicio.conflicto
          : status === 404
            ? inicio.noEncontrada
            : status === 422
              ? inicio.datosInvalidos
              : inicio.resultadoDesconocido;
      expect(texto()).toContain(esperada);
      http.expectOne(ruta()).flush(pagina(status === 404 ? [] : [programada]));
      fixture.detectChanges();
      expect(texto()).not.toContain(inicio.accion);
      http.expectNone(rutaInicio);
    },
  );

  it('ante fallo de conexión relee el estado sin simular éxito ni repetir el inicio', () => {
    cargarProgramada();
    boton(inicio.accion).click();
    fixture.detectChanges();
    http.expectOne(rutaInicio).error(new ProgressEvent('error'));
    fixture.detectChanges();
    expect(texto()).toContain(inicio.resultadoDesconocido);
    http.expectOne(ruta()).flush(pagina([{ ...orden, estado: 'EN_EJECUCION' }]));
    fixture.detectChanges();
    expect(texto()).not.toContain(inicio.confirmada);
    expect(texto()).not.toContain(inicio.accion);
    http.expectNone(rutaInicio);
  });

  it('no aplica la respuesta de inicio a otro puente seleccionado mientras se enviaba', () => {
    const programada = cargarProgramada();
    const eventos: OrdenMantenimientoDTO[] = [];
    fixture.componentInstance.iniciada.subscribe((dto) => eventos.push(dto));
    boton(inicio.accion).click();
    fixture.detectChanges();
    const post = http.expectOne(rutaInicio);
    fixture.componentRef.setInput('puenteId', otro);
    fixture.detectChanges();
    http.expectOne(ruta(otro)).flush(pagina([], otro));
    fixture.detectChanges();
    post.flush({ ...programada, estado: 'EN_EJECUCION' });
    fixture.detectChanges();
    expect(texto()).toContain(h.vacia);
    expect(texto()).not.toContain(orden.descripcion);
    expect(texto()).not.toContain(inicio.confirmada);
    expect(eventos).toEqual([]);
  });

  it('no vuelve a mostrar datos privados si se pierde acceso mientras el inicio está pendiente', () => {
    const programada = cargarProgramada();
    boton(inicio.accion).click();
    fixture.detectChanges();
    const post = http.expectOne(rutaInicio);
    fixture.componentRef.setInput('puedeConsultar', false);
    fixture.detectChanges();
    post.flush({ ...programada, estado: 'EN_EJECUCION' });
    fixture.detectChanges();
    expect(texto()).not.toContain(orden.descripcion);
    expect(texto()).not.toContain(inicio.confirmada);
    expect(texto()).toContain(h.sinPermiso);
  });

  it('no concede acciones nuevas si se retira el permiso de inicio durante la respuesta', () => {
    const programada = cargarProgramada();
    boton(inicio.accion).click();
    fixture.detectChanges();
    const post = http.expectOne(rutaInicio);
    fixture.componentRef.setInput('puedeIniciar', false);
    fixture.detectChanges();
    post.flush({ ...programada, estado: 'EN_EJECUCION' });
    fixture.detectChanges();
    expect(texto()).toContain(inicio.confirmada);
    expect(texto()).not.toContain(inicio.accion);
  });

  it('rechaza una respuesta de inicio que no identifica la orden solicitada', () => {
    const programada = cargarProgramada();
    boton(inicio.accion).click();
    fixture.detectChanges();
    http.expectOne(rutaInicio).flush({ ...programada, puente_id: otro, estado: 'EN_EJECUCION' });
    fixture.detectChanges();
    expect(texto()).not.toContain(inicio.confirmada);
    expect(texto()).toContain(inicio.resultadoDesconocido);
    http.expectOne(ruta()).flush(pagina([programada]));
    fixture.detectChanges();
  });

  it('desuscribe la petición de inicio al destruirse sin suponer un rollback del servidor', () => {
    cargarProgramada();
    boton(inicio.accion).click();
    fixture.detectChanges();
    const post = http.expectOne(rutaInicio);
    fixture.destroy();
    expect(post.cancelled).toBe(true);
  });
});
