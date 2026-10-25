import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { MantenimientoService } from './mantenimiento.service';
import { OrdenMantenimientoDTO } from './modelos';

describe('MantenimientoService', () => {
  const puente = '019a0025-0000-7000-8000-000000000001';
  const id = '019a0025-0000-7000-8000-000000000010';
  const ruta = `/api/v1/puentes/${puente}/ordenes-mantenimiento/${id}/aceptacion`;
  const aceptada: OrdenMantenimientoDTO = {
    id,
    puente_id: puente,
    inspeccion_id: null,
    tipo: 'CORRECTIVO',
    estado: 'PROGRAMADA',
    descripcion: 'Intervención ficticia solo para prueba',
    elemento_ref: null,
    prioridad_sugerida: 'MEDIA',
    prioridad: 'ALTA',
    justificacion_prioridad: 'Justificación de prueba',
    fecha_programada: '2026-10-25',
    fecha_ejecucion: null,
    responsable: null,
    motivo: null,
    creado_en: '2026-10-19T12:00:00Z',
    actualizado_en: '2026-10-19T13:00:00Z',
  };
  let servicio: MantenimientoService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(MantenimientoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('envía un solo POST sin cuerpo y conserva el DTO real snake_case y sus nulls', async () => {
    const respuesta = firstValueFrom(servicio.aceptar(puente, id));
    const peticion = http.expectOne(ruta);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toBeNull();
    expect(peticion.request.headers.has('Authorization')).toBe(false);
    peticion.flush(aceptada);
    expect(await respuesta).toEqual(aceptada);
  });

  it.each([400, 401, 403, 404, 409, 422, 500])(
    'propaga Problem Details %s sin reintentar la aceptación',
    async (status) => {
      const respuesta = firstValueFrom(servicio.aceptar(puente, id));
      const rechazo = expect(respuesta).rejects.toMatchObject({ status, error: { status } });
      http
        .expectOne(ruta)
        .flush({ status, detail: 'Fallo de prueba' }, { status, statusText: 'Error' });
      await rechazo;
      http.expectNone(ruta);
    },
  );

  it('conserva el fallo de transporte sin simular una aceptación ni reintentar', async () => {
    const respuesta = firstValueFrom(servicio.aceptar(puente, id));
    const rechazo = expect(respuesta).rejects.toBeInstanceOf(HttpErrorResponse);
    http.expectOne(ruta).error(new ProgressEvent('error'));
    await rechazo;
    http.expectNone(ruta);
  });

  it('utiliza los interceptores globales sin administrar tokens propios', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(
          withInterceptors([
            (req, next) => next(req.clone({ setHeaders: { 'X-Prueba-P8': 'interceptado' } })),
          ]),
        ),
        provideHttpClientTesting(),
      ],
    });
    servicio = TestBed.inject(MantenimientoService);
    http = TestBed.inject(HttpTestingController);
    const respuesta = firstValueFrom(servicio.aceptar(puente, id));
    const peticion = http.expectOne(ruta);
    expect(peticion.request.headers.get('X-Prueba-P8')).toBe('interceptado');
    peticion.flush(aceptada);
    await respuesta;
  });
  it('consulta historial paginado con los parámetros explícitos y el contrato snake_case', async () => {
    const pagina = {
      puente_id: puente,
      content: [aceptada],
      page: 2,
      size: 1,
      total_elements: 3,
      total_pages: 3,
    };
    const respuesta = firstValueFrom(servicio.listarOrdenes(puente, 2, 1));
    const peticion = http.expectOne(
      `/api/v1/puentes/${puente}/ordenes-mantenimiento?page=2&size=1`,
    );
    expect(peticion.request.method).toBe('GET');
    peticion.flush(pagina);
    expect(await respuesta).toEqual(pagina);
  });

  it('escapa ambos identificadores en el GET de detalle y conserva campos históricos', async () => {
    const respuesta = firstValueFrom(servicio.obtenerOrden('puente/ajeno', 'orden?otra'));
    const peticion = http.expectOne(
      '/api/v1/puentes/puente%2Fajeno/ordenes-mantenimiento/orden%3Fotra',
    );
    expect(peticion.request.method).toBe('GET');
    peticion.flush(aceptada);
    expect(await respuesta).toEqual(aceptada);
  });
  it('envía inicio de ejecución por el POST real sin cuerpo ni estado de destino arbitrario', async () => {
    const respuesta = firstValueFrom(servicio.iniciarEjecucion(puente, id));
    const peticion = http.expectOne(
      `/api/v1/puentes/${puente}/ordenes-mantenimiento/${id}/inicio-ejecucion`,
    );
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toBeNull();
    const iniciada = { ...aceptada, estado: 'EN_EJECUCION' as const };
    peticion.flush(iniciada);
    expect(await respuesta).toEqual(iniciada);
  });
  it('consulta evidencia paginada escapando los identificadores', async () => {
    const respuesta = firstValueFrom(servicio.listarEvidencias('puente/otro', 'orden?otra', 2, 5));
    const req = http.expectOne(
      '/api/v1/puentes/puente%2Fotro/ordenes-mantenimiento/orden%3Fotra/evidencias?page=2&size=5',
    );
    expect(req.request.method).toBe('GET');
    const pagina = {
      puente_id: 'puente/otro',
      orden_id: 'orden?otra',
      content: [],
      page: 2,
      size: 5,
      total_elements: 0,
      total_pages: 0,
    };
    req.flush(pagina);
    expect(await respuesta).toEqual(pagina);
  });

  it('sube multipart por la cadena global y deja que el navegador defina su boundary', async () => {
    const datos = new FormData();
    datos.append('id', id);
    const respuesta = firstValueFrom(servicio.subirEvidencia(puente, id, datos));
    const req = http.expectOne(`/api/v1/puentes/${puente}/ordenes-mantenimiento/${id}/evidencias`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBe(datos);
    expect(req.request.headers.has('Content-Type')).toBe(false);
    req.flush({ id });
    await respuesta;
  });

  it('cierra mediante JSON sin enviar estado de destino ni contador de fotografías', async () => {
    const datos = { fecha_ejecucion: '2026-10-20', responsable: 'Responsable de prueba' };
    const respuesta = firstValueFrom(servicio.cerrar(puente, id, datos));
    const req = http.expectOne(`/api/v1/puentes/${puente}/ordenes-mantenimiento/${id}/cierre`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(datos);
    req.flush({ ...aceptada, estado: 'EJECUTADA', ...datos });
    expect((await respuesta).estado).toBe('EJECUTADA');
  });
  it('envía descarte con motivo al endpoint real escapando los identificadores', async () => {
    const datos = { motivo: 'Intervención duplicada' };
    const respuesta = firstValueFrom(servicio.descartar('puente/otro', 'orden?otra', datos));
    const req = http.expectOne(
      '/api/v1/puentes/puente%2Fotro/ordenes-mantenimiento/orden%3Fotra/descarte',
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(datos);
    req.flush({ ...aceptada, estado: 'DESCARTADA', motivo: datos.motivo });
    expect((await respuesta).estado).toBe('DESCARTADA');
  });
  it('envía cancelación con motivo al endpoint real escapando identificadores', async () => {
    const datos = { motivo: '  Cancelación documentada  ' };
    const respuesta = firstValueFrom(servicio.cancelar('puente/otro', 'orden?otra', datos));
    const req = http.expectOne(
      '/api/v1/puentes/puente%2Fotro/ordenes-mantenimiento/orden%3Fotra/cancelacion',
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(datos);
    req.flush({ ...aceptada, estado: 'CANCELADA', motivo: datos.motivo });
    expect((await respuesta).estado).toBe('CANCELADA');
  });

  it('ajusta por PATCH enviando solo prioridad/justificación y escapando identificadores', async () => {
    const datos = { prioridad: 'BAJA' as const, justificacion: 'Urgencia revisada' };
    const respuesta = firstValueFrom(servicio.ajustarPrioridad('puente/otro', 'orden?otra', datos));
    const req = http.expectOne(
      '/api/v1/puentes/puente%2Fotro/ordenes-mantenimiento/orden%3Fotra/prioridad',
    );
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(datos);
    req.flush({ ...aceptada, prioridad: 'BAJA', justificacion_prioridad: datos.justificacion });
    expect((await respuesta).prioridad).toBe('BAJA');
  });
  it('programa con PATCH y fecha civil, sin estado ni datos de cierre, escapando identificadores', async () => {
    const datos = { fecha_programada: '2026-11-02' };
    const respuesta = firstValueFrom(servicio.programarFecha('puente/otro', 'orden?otra', datos));
    const req = http.expectOne(
      '/api/v1/puentes/puente%2Fotro/ordenes-mantenimiento/orden%3Fotra/fecha-programada',
    );
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(datos);
    req.flush({ ...aceptada, ...datos });
    expect((await respuesta).fecha_programada).toBe(datos.fecha_programada);
  });

  it('consulta seguimiento anual por GET con IDs codificados y paginación real', async () => {
    const respuesta = firstValueFrom(servicio.consultarRutinarioAnual('puente/otro', 1, 5));
    const req = http.expectOne(
      '/api/v1/puentes/puente%2Fotro/ordenes-mantenimiento/rutinario-anual?page=1&size=5',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.body).toBeNull();
    req.flush({ puente_id: 'puente/otro', programadas_en_plazo: 0 });
    expect((await respuesta).puente_id).toBe('puente/otro');
  });
});
