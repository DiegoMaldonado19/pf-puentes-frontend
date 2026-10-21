import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { CapturaFoto } from '../../shared/captura-foto/captura-foto';
import { AjustePrioridadOrden } from './ajuste-prioridad-orden';
import { DescartePropuesta } from './descarte-propuesta';
import { EvidenciaYCierre } from './evidencia-y-cierre';
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
  function abrirConEvidencia(estado: EstadoOrden = 'EN_EJECUCION') {
    fixture.componentRef.setInput('puedeConsultarEvidencia', true);
    fixture.componentRef.setInput('puedeSubirEvidencia', true);
    fixture.componentRef.setInput('puedeCerrar', true);
    const actual = { ...orden, estado };
    cargar([actual]);
    abrir();
    http.expectOne(rutaDetalle()).flush(actual);
    fixture.detectChanges();
    http.expectOne(`${rutaDetalle()}/evidencias?page=0&size=20`).flush({
      puente_id: puente,
      orden_id: orden.id,
      content: [],
      page: 0,
      size: 20,
      total_elements: 0,
      total_pages: 0,
    });
    fixture.detectChanges();
    return actual;
  }

  it('inserta evidencia únicamente con permiso explícito, conservando el host de solo lectura', () => {
    cargar();
    abrir();
    http.expectOne(rutaDetalle()).flush(orden);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.directive(EvidenciaYCierre))).toBeNull();
    http.expectNone((req) => req.url.endsWith('/evidencias'));
  });

  it('cierre confirmado actualiza fila y detalle desde el servidor y conserva consulta de evidencia', () => {
    const actual = abrirConEvidencia();
    const recibida = vi.fn();
    fixture.componentInstance.cerrada.subscribe(recibida);
    const hijo = fixture.debugElement.query(By.directive(EvidenciaYCierre))
      .componentInstance as EvidenciaYCierre;
    const resultado: OrdenMantenimientoDTO = {
      ...actual,
      estado: 'EJECUTADA',
      fecha_ejecucion: '2026-10-20',
      responsable: 'Cuadrilla de prueba',
    };
    hijo.cerrada.emit(resultado);
    fixture.detectChanges();
    expect(recibida).toHaveBeenCalledWith(resultado);
    expect(texto()).toContain(TEXTOS.mantenimiento.evidencia.confirmada);
    expect(texto()).toContain('Cuadrilla de prueba');
    http.expectOne(`${rutaDetalle()}/evidencias?page=0&size=20`).flush({
      puente_id: puente,
      orden_id: orden.id,
      content: [],
      page: 0,
      size: 20,
      total_elements: 0,
      total_pages: 0,
    });
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.directive(CapturaFoto))).toBeNull();
  });

  it.each([401, 403])('un error %s de evidencia retira también listado y detalle', (status) => {
    abrirConEvidencia();
    const hijo = fixture.debugElement.query(By.directive(EvidenciaYCierre))
      .componentInstance as EvidenciaYCierre;
    hijo.accesoDenegado.emit(status);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('table')).toBeNull();
    expect(fixture.debugElement.query(By.directive(EvidenciaYCierre))).toBeNull();
  });

  it('una carga pendiente bloquea selección, inicio y recargas del contenedor', () => {
    fixture.componentRef.setInput('puedeIniciar', true);
    abrirConEvidencia('PROGRAMADA');
    const captura = fixture.debugElement.query(By.directive(CapturaFoto))
      .componentInstance as CapturaFoto;
    captura.capturada.emit({
      archivo: new Blob(['foto'], { type: 'image/jpeg' }),
      miniatura: new Blob(['mini'], { type: 'image/jpeg' }),
      latitud: null,
      longitud: null,
      capturada_en: '2026-10-20T12:00:00Z',
    });
    fixture.detectChanges();
    boton(TEXTOS.mantenimiento.evidencia.guardar).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.operacionPendiente()).toBe(true);
    expect(boton(TEXTOS.mantenimiento.inicio.accion).disabled).toBe(true);
    expect(boton(h.ver).disabled).toBe(true);
    expect(boton(h.actualizar).disabled).toBe(true);
    const req = http.expectOne(`${rutaDetalle()}/evidencias`);
    req.flush({}, { status: 422, statusText: 'Invalid' });
    fixture.detectChanges();
    expect(fixture.componentInstance.operacionPendiente()).toBe(false);
    http.expectNone((req) => req.url.endsWith('/inicio-ejecucion'));
  });

  it('un resultado incierto del hijo recarga el historial sin repetir escrituras', () => {
    abrirConEvidencia();
    const hijo = fixture.debugElement.query(By.directive(EvidenciaYCierre))
      .componentInstance as EvidenciaYCierre;
    hijo.actualizarOrden.emit('cierre');
    fixture.detectChanges();
    http.expectOne(ruta()).flush(pagina([{ ...orden, estado: 'EJECUTADA' }]));
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.directive(EvidenciaYCierre))).toBeNull();
    http.expectNone((req) => req.method !== 'GET');
  });
  function abrirParaDescarte(habilitado = true, estado: EstadoOrden = 'PROPUESTA') {
    fixture.componentRef.setInput('puedeDescartar', habilitado);
    const actual = { ...orden, estado, motivo: null };
    cargar([actual, segunda]);
    abrir();
    http.expectOne(rutaDetalle()).flush(actual);
    fixture.detectChanges();
    return actual;
  }
  function enviarDescarte(motivo = 'Intervención duplicada') {
    const campo = (fixture.nativeElement as HTMLElement).querySelector(
      'app-descarte-propuesta textarea',
    ) as HTMLTextAreaElement;
    campo.value = motivo;
    campo.dispatchEvent(new Event('input'));
    (fixture.nativeElement as HTMLElement)
      .querySelector('app-descarte-propuesta form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  }

  it('no habilita descarte con el permiso de lectura por sí solo', () => {
    abrirParaDescarte(false);
    expect(fixture.debugElement.query(By.directive(DescartePropuesta))).toBeNull();
    http.expectNone((req) => req.method !== 'GET');
  });

  it('descarte confirmado actualiza historial y detalle conservando el motivo y emite al host', () => {
    const actual = abrirParaDescarte();
    const motivo = 'Intervención duplicada';
    const descartada = vi.fn();
    fixture.componentInstance.descartada.subscribe(descartada);
    enviarDescarte(motivo);
    expect(fixture.componentInstance.operacionPendiente()).toBe(true);
    expect(boton(h.ver).disabled).toBe(true);
    expect(boton(h.actualizar).disabled).toBe(true);
    const resultado = { ...actual, estado: 'DESCARTADA', motivo };
    http.expectOne(`${rutaDetalle()}/descarte`).flush(resultado);
    fixture.detectChanges();
    expect(descartada).toHaveBeenCalledExactlyOnceWith(resultado);
    expect(texto()).toContain(TEXTOS.mantenimiento.descarte.confirmada);
    expect(texto()).toContain(motivo);
    expect(fixture.debugElement.query(By.directive(DescartePropuesta))).toBeNull();
    expect(fixture.componentInstance.operacionPendiente()).toBe(false);
    http.expectNone((req) => req.method !== 'GET');
  });

  it.each([401, 403])('descarte rechazado por acceso %s retira historial y detalle', (status) => {
    abrirParaDescarte();
    enviarDescarte();
    http.expectOne(`${rutaDetalle()}/descarte`).flush({}, { status, statusText: 'Denied' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('table')).toBeNull();
    expect(fixture.debugElement.query(By.directive(DescartePropuesta))).toBeNull();
  });

  it.each([404, 409, 500])(
    'fallo de descarte %s fuerza relectura sin repetir el POST',
    (status) => {
      abrirParaDescarte();
      enviarDescarte();
      http.expectOne(`${rutaDetalle()}/descarte`).flush({}, { status, statusText: 'Error' });
      fixture.detectChanges();
      http.expectOne(ruta()).flush(pagina([{ ...orden, estado: 'PROGRAMADA' }]));
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.directive(DescartePropuesta))).toBeNull();
      http.expectNone((req) => req.method === 'POST');
    },
  );
  function abrirParaAjuste(estado: EstadoOrden = 'PROGRAMADA', habilitado = true) {
    fixture.componentRef.setInput('puedeAjustarPrioridad', habilitado);
    const actual = { ...orden, estado, motivo: null };
    cargar([actual, segunda]);
    abrir();
    http.expectOne(rutaDetalle()).flush(actual);
    fixture.detectChanges();
    return actual;
  }
  function enviarAjuste() {
    const panel = (fixture.nativeElement as HTMLElement).querySelector(
      'app-ajuste-prioridad-orden',
    )!;
    const selector = panel.querySelector('select')!;
    selector.value = 'BAJA';
    selector.dispatchEvent(new Event('change'));
    const campo = panel.querySelector('textarea')!;
    campo.value = 'Urgencia revisada';
    campo.dispatchEvent(new Event('input'));
    panel.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  }

  it('lectura no concede ajuste de prioridad', () => {
    abrirParaAjuste('PROGRAMADA', false);
    expect(fixture.debugElement.query(By.directive(AjustePrioridadOrden))).toBeNull();
    http.expectNone((r) => r.method !== 'GET');
  });

  it('confirma ajuste desde el servidor y bloquea inicio, selección y recargas durante PATCH', () => {
    fixture.componentRef.setInput('puedeIniciar', true);
    const actual = abrirParaAjuste();
    const ajustada = vi.fn();
    fixture.componentInstance.prioridadAjustada.subscribe(ajustada);
    enviarAjuste();
    expect(fixture.componentInstance.operacionPendiente()).toBe(true);
    expect(boton(TEXTOS.mantenimiento.inicio.accion).disabled).toBe(true);
    expect(boton(h.ver).disabled).toBe(true);
    expect(boton(h.actualizar).disabled).toBe(true);
    const resultado = {
      ...actual,
      prioridad: 'BAJA',
      justificacion_prioridad: 'Urgencia revisada',
    };
    http.expectOne(`${rutaDetalle()}/prioridad`).flush(resultado);
    fixture.detectChanges();
    expect(ajustada).toHaveBeenCalledExactlyOnceWith(resultado);
    expect(texto()).toContain(TEXTOS.mantenimiento.ajustePrioridad.confirmada);
    expect(texto()).toContain('Urgencia revisada');
    expect(fixture.componentInstance.operacionPendiente()).toBe(false);
  });

  it('un ajuste pendiente también bloquea descarte de la propuesta', () => {
    fixture.componentRef.setInput('puedeDescartar', true);
    const actual = abrirParaAjuste('PROPUESTA');
    enviarAjuste();
    expect(boton(TEXTOS.mantenimiento.descarte.accion).disabled).toBe(true);
    http
      .expectOne(`${rutaDetalle()}/prioridad`)
      .flush({ ...actual, prioridad: 'BAJA', justificacion_prioridad: 'Urgencia revisada' });
    fixture.detectChanges();
    expect(boton(TEXTOS.mantenimiento.descarte.accion).disabled).toBe(false);
  });

  it.each([401, 403])('rechazo de acceso al ajustar %s retira historial y detalle', (status) => {
    abrirParaAjuste();
    enviarAjuste();
    http.expectOne(`${rutaDetalle()}/prioridad`).flush({}, { status, statusText: 'Denied' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('table')).toBeNull();
    expect(fixture.debugElement.query(By.directive(AjustePrioridadOrden))).toBeNull();
  });

  it.each([404, 409, 500])('fallo de ajuste %s exige relectura y no repite PATCH', (status) => {
    abrirParaAjuste();
    enviarAjuste();
    http.expectOne(`${rutaDetalle()}/prioridad`).flush({}, { status, statusText: 'Error' });
    fixture.detectChanges();
    http.expectOne(ruta()).flush(pagina([orden]));
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.directive(AjustePrioridadOrden))).toBeNull();
    http.expectNone((r) => r.method === 'PATCH');
  });
});
