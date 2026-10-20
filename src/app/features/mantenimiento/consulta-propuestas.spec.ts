import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TEXTOS } from '../../shared/textos';
import { ConsultaPropuestas } from './consulta-propuestas';
import { OrdenMantenimientoDTO, PaginaPropuestas } from './modelos';

describe('ConsultaPropuestas', () => {
  const puente = '019a0022-0000-7000-8000-000000000001';
  const otro = '019a0022-0000-7000-8000-000000000002';
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
  let fixture: ComponentFixture<ConsultaPropuestas>;
  let http: HttpTestingController;
  const ruta = (id = puente, page = 0, size = 20) =>
    `/api/v1/puentes/${id}/ordenes-mantenimiento/propuestas?page=${page}&size=${size}`;
  const pagina = (
    content: readonly OrdenMantenimientoDTO[] = [orden],
    id = puente,
  ): PaginaPropuestas => ({
    puente_id: id,
    content,
    page: 0,
    size: 20,
    total_elements: content.length,
    total_pages: content.length ? 1 : 0,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ConsultaPropuestas],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ConsultaPropuestas);
    fixture.componentRef.setInput('puenteId', puente);
    fixture.componentRef.setInput('puedeConsultar', true);
    fixture.componentRef.setInput('puedeAceptar', true);
  });
  afterEach(() => http.verify());
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  function boton(nombre: string) {
    const encontrado = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === nombre,
    );
    expect(encontrado).toBeDefined();
    return encontrado!;
  }
  function cargar() {
    fixture.detectChanges();
    const req = http.expectOne(ruta());
    expect(req.request.method).toBe('GET');
    req.flush(pagina());
    fixture.detectChanges();
  }

  it('carga propuestas reales sin añadir credenciales propias y muestra la respuesta', () => {
    fixture.detectChanges();
    const req = http.expectOne(ruta());
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(texto()).toContain(TEXTOS.mantenimiento.bandeja.cargando);
    req.flush(pagina());
    fixture.detectChanges();
    expect(texto()).toContain(orden.descripcion);
  });

  it('consulta la siguiente página del servidor con el tamaño recibido', () => {
    fixture.detectChanges();
    http.expectOne(ruta()).flush({ ...pagina(), size: 1, total_elements: 2, total_pages: 2 });
    fixture.detectChanges();
    boton(TEXTOS.mantenimiento.bandeja.siguiente).click();
    fixture.detectChanges();
    http
      .expectOne(ruta(puente, 1, 1))
      .flush({ ...pagina([]), page: 1, size: 1, total_elements: 2, total_pages: 2 });
    fixture.detectChanges();
  });

  it('acepta mediante POST y recarga el GET sin simular totales ni generar propuestas', () => {
    cargar();
    const recibidas: OrdenMantenimientoDTO[] = [];
    fixture.componentInstance.aceptada.subscribe((dto) => recibidas.push(dto));
    boton(TEXTOS.mantenimiento.bandeja.revisar).click();
    fixture.detectChanges();
    boton(TEXTOS.mantenimiento.aceptar).click();
    fixture.detectChanges();
    const post = http.expectOne(
      `/api/v1/puentes/${puente}/ordenes-mantenimiento/${orden.id}/aceptacion`,
    );
    expect(post.request.method).toBe('POST');
    const aceptada = { ...orden, estado: 'PROGRAMADA' as const };
    post.flush(aceptada);
    fixture.detectChanges();
    expect(recibidas).toEqual([aceptada]);
    http.expectOne(ruta()).flush(pagina([]));
    fixture.detectChanges();
    expect(texto()).toContain(TEXTOS.mantenimiento.bandeja.vacia);
    expect(texto()).not.toContain(orden.descripcion);
  });

  it.each([401, 403, 404, 500])(
    'muestra el error %s y retira datos privados sin reintento automático',
    (status) => {
      cargar();
      boton(TEXTOS.mantenimiento.bandeja.actualizar).click();
      fixture.detectChanges();
      http.expectOne(ruta()).flush({ status }, { status, statusText: 'Error' });
      fixture.detectChanges();
      expect(texto()).not.toContain(orden.descripcion);
      expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).not.toBeNull();
      http.expectNone(ruta());
      if (status === 401 || status === 403) {
        expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
      }
    },
  );

  it('permite recuperar un fallo de red mediante una recarga explícita', () => {
    fixture.detectChanges();
    http.expectOne(ruta()).error(new ProgressEvent('error'));
    fixture.detectChanges();
    expect(texto()).toContain(TEXTOS.mantenimiento.bandeja.sinConexion);
    boton(TEXTOS.mantenimiento.bandeja.actualizar).click();
    fixture.detectChanges();
    http.expectOne(ruta()).flush(pagina());
    fixture.detectChanges();
    expect(texto()).toContain(orden.descripcion);
  });

  it('cancela la lectura anterior al cambiar de puente y conserva origen aun vacío', () => {
    fixture.detectChanges();
    const anterior = http.expectOne(ruta());
    fixture.componentRef.setInput('puenteId', otro);
    fixture.detectChanges();
    expect(anterior.cancelled).toBe(true);
    http.expectOne(ruta(otro)).flush(pagina([], otro));
    fixture.detectChanges();
    expect(texto()).toContain(TEXTOS.mantenimiento.bandeja.vacia);
    expect(texto()).not.toContain(orden.descripcion);
  });

  it('no consulta sin permiso y cancela una lectura si se revoca', () => {
    fixture.componentRef.setInput('puedeConsultar', false);
    fixture.detectChanges();
    http.expectNone(ruta());
    expect(texto()).toContain(TEXTOS.mantenimiento.bandeja.sinPermiso);
    fixture.componentRef.setInput('puedeConsultar', true);
    fixture.detectChanges();
    const req = http.expectOne(ruta());
    fixture.componentRef.setInput('puedeConsultar', false);
    fixture.detectChanges();
    expect(req.cancelled).toBe(true);
    expect(texto()).not.toContain(orden.descripcion);
  });

  it('desuscribe la lectura cuando se destruye el contenedor', () => {
    fixture.detectChanges();
    const req = http.expectOne(ruta());
    fixture.destroy();
    expect(req.cancelled).toBe(true);
  });
});
