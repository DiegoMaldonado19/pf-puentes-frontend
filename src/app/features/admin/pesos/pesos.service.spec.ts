import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  ComparacionRecalculoIcDTO,
  JuegoPesosDTO,
  PaginaPesosDTO,
  PesoElementoDTO,
  RecalculoIcDTO,
} from './modelos';
import { PesosService } from './pesos.service';

describe('PesosService', () => {
  const formulario = '019a0019-0000-7000-8000-000000000001';
  const juegoId = '019a0019-0000-7000-8000-000000000011';
  const juego: JuegoPesosDTO = {
    id: juegoId,
    formulario_version_id: formulario,
    acta: 'actas/prueba.pdf',
    vigente_desde: '2026-10-19T12:00:00Z',
  };
  let servicio: PesosService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(PesosService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('consulta los juegos del formulario con la paginación predeterminada del contrato', async () => {
    const respuesta = firstValueFrom(servicio.listarJuegos(formulario));
    const peticion = http.expectOne(
      `/api/v1/formularios/${formulario}/juegos-pesos?page=0&size=20`,
    );
    expect(peticion.request.method).toBe('GET');
    const pagina: PaginaPesosDTO<JuegoPesosDTO> = {
      content: [juego],
      page: 0,
      size: 20,
      total_elements: 1,
      total_pages: 1,
    };
    peticion.flush(pagina);
    expect(await respuesta).toEqual(pagina);
  });

  it('consulta una página posterior sin perder los totales ni cambiar los nombres JSON', async () => {
    const respuesta = firstValueFrom(servicio.listarJuegos(formulario, 2, 1));
    const peticion = http.expectOne(`/api/v1/formularios/${formulario}/juegos-pesos?page=2&size=1`);
    peticion.flush({ content: [], page: 2, size: 1, total_elements: 2, total_pages: 2 });
    expect(await respuesta).toEqual({
      content: [],
      page: 2,
      size: 1,
      total_elements: 2,
      total_pages: 2,
    });
  });

  it('consulta un juego conservando el acta ausente y la fecha UTC', async () => {
    const respuesta = firstValueFrom(servicio.obtenerJuego(juegoId));
    const peticion = http.expectOne(`/api/v1/juegos-pesos/${juegoId}`);
    expect(peticion.request.method).toBe('GET');
    peticion.flush({ ...juego, acta: null });
    expect(await respuesta).toEqual({ ...juego, acta: null });
  });

  it('consulta pesos numéricos del juego con su propia paginación', async () => {
    const respuesta = firstValueFrom(servicio.listarPesos(juegoId, 1, 100));
    const peticion = http.expectOne(`/api/v1/juegos-pesos/${juegoId}/pesos?page=1&size=100`);
    expect(peticion.request.method).toBe('GET');
    const pagina: PaginaPesosDTO<PesoElementoDTO> = {
      content: [{ id: 'peso-de-prueba', elemento_ref: 'elemento-a', peso: 1.25 }],
      page: 1,
      size: 100,
      total_elements: 101,
      total_pages: 2,
    };
    peticion.flush(pagina);
    expect(await respuesta).toEqual(pagina);
  });

  it.each([400, 401, 403, 404, 500])(
    'conserva el error HTTP %s y Problem Details para el manejo global',
    async (status) => {
      const respuesta = firstValueFrom(servicio.obtenerJuego(juegoId));
      const rechazo = expect(respuesta).rejects.toMatchObject({ status });
      const problema = { type: 'about:blank', title: 'Error de prueba', status, detail: 'Detalle' };
      http.expectOne(`/api/v1/juegos-pesos/${juegoId}`).flush(problema, {
        status,
        statusText: 'Error',
        headers: { 'Content-Type': 'application/problem+json' },
      });
      await rechazo;
      await expect(respuesta).rejects.toMatchObject({ error: problema });
    },
  );

  it('una caída de red es un error y no una lista vacía de pesos', async () => {
    const respuesta = firstValueFrom(servicio.listarPesos(juegoId));
    const rechazo = expect(respuesta).rejects.toBeInstanceOf(HttpErrorResponse);
    http
      .expectOne(`/api/v1/juegos-pesos/${juegoId}/pesos?page=0&size=20`)
      .error(new ProgressEvent('error'));
    await rechazo;
    await expect(respuesta).rejects.toMatchObject({ status: 0 });
  });

  it('utiliza la cadena global de interceptores al efectuar la petición', async () => {
    // Interceptor exclusivamente de prueba: comprueba compatibilidad, no implementa sesión P2.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(
          withInterceptors([
            (req, next) => next(req.clone({ setHeaders: { 'X-Integracion-Prueba': 'presente' } })),
          ]),
        ),
        provideHttpClientTesting(),
      ],
    });
    servicio = TestBed.inject(PesosService);
    http = TestBed.inject(HttpTestingController);
    const respuesta = firstValueFrom(servicio.obtenerJuego(juegoId));
    const peticion = http.expectOne(`/api/v1/juegos-pesos/${juegoId}`);
    expect(peticion.request.headers.get('X-Integracion-Prueba')).toBe('presente');
    peticion.flush(juego);
    await respuesta;
  });

  it('consulta la comparación de recálculos de una inspección publicada con paginación', async () => {
    const inspeccionId = '019a0040-0000-7000-8000-000000000021';
    const respuesta = firstValueFrom(servicio.consultarRecalculos(inspeccionId, 0, 20));
    const peticion = http.expectOne(
      `/api/v1/inspecciones/${inspeccionId}/recalculos-ic?page=0&size=20`,
    );
    expect(peticion.request.method).toBe('GET');
    const comparacion: ComparacionRecalculoIcDTO = {
      original: {
        inspeccion_id: inspeccionId,
        puente_id: '019a0040-0000-7000-8000-000000000001',
        formulario_version_id: formulario,
        version_pesos_id: juegoId,
        acta: 'Acta inicial',
        vigente_desde: '2026-10-01T12:00:00Z',
        indice_condicion: 80.0,
        estado_calculado: 'BUENO',
        anulacion: null,
        estado_confirmado: 'BUENO',
        justificacion_estado: null,
        publicada_en: '2026-10-02T15:00:00Z',
      },
      recalculos: {
        content: [],
        page: 0,
        size: 20,
        total_elements: 0,
        total_pages: 0,
      },
    };
    peticion.flush(comparacion);
    expect(await respuesta).toEqual(comparacion);
  });

  it('solicita un recálculo fechado bajo otro juego de pesos mediante POST', async () => {
    const inspeccionId = '019a0040-0000-7000-8000-000000000021';
    const respuesta = firstValueFrom(
      servicio.recalcularIc(inspeccionId, { version_pesos_id: juegoId }),
    );
    const peticion = http.expectOne(`/api/v1/inspecciones/${inspeccionId}/recalculos-ic`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ version_pesos_id: juegoId });
    const recalculo: RecalculoIcDTO = {
      id: '019a0040-0000-7000-8000-000000000050',
      inspeccion_id: inspeccionId,
      version_pesos_id: juegoId,
      formulario_version_id: formulario,
      acta: 'Acta calibrada v2',
      vigente_desde: '2026-10-20T12:00:00Z',
      indice_condicion: 66.67,
      estado_calculado: 'REGULAR',
      anulacion: null,
      creado_en: '2026-10-25T18:00:00Z',
    };
    peticion.flush(recalculo);
    expect(await respuesta).toEqual(recalculo);
  });

  it('estima el IC preliminar por formulario mediante POST (RN-IC-07)', async () => {
    const solicitud = {
      version_pesos_id: juegoId,
      datos: { a: 0, b: 2 },
    };
    const respuesta = firstValueFrom(
      servicio.estimarIcPreliminarPorFormulario(formulario, solicitud),
    );
    const peticion = http.expectOne(`/api/v1/formularios/${formulario}/ic-preliminar`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual(solicitud);

    const estimacion = {
      indice_condicion: 75.0,
      estado_calculado: 'BUENO' as const,
      anulaciones: [],
      version_pesos_id: juegoId,
      preliminar: true,
      rotulo: 'IC PRELIMINAR',
      advertencia: 'Estimación preliminar',
    };
    peticion.flush(estimacion);
    expect(await respuesta).toEqual(estimacion);
  });

  it('estima el IC preliminar para un borrador de inspección mediante POST', async () => {
    const inspeccionId = '019a0040-0000-7000-8000-000000000022';
    const respuesta = firstValueFrom(
      servicio.estimarIcPreliminarPorInspeccion(inspeccionId, juegoId),
    );
    const peticion = http.expectOne(
      `/api/v1/inspecciones/${inspeccionId}/ic-preliminar?versionPesosId=${juegoId}`,
    );
    expect(peticion.request.method).toBe('POST');

    const estimacion = {
      indice_condicion: 100.0,
      estado_calculado: 'BUENO' as const,
      anulaciones: [],
      version_pesos_id: juegoId,
      preliminar: true,
      rotulo: 'IC PRELIMINAR',
      advertencia: 'Estimación preliminar',
    };
    peticion.flush(estimacion);
    expect(await respuesta).toEqual(estimacion);
  });

  it('valida la confirmación de estado con justificación mediante POST (RN-IC-06)', async () => {
    const solicitud = {
      estado_calculado: 'BUENO' as const,
      estado_confirmado: 'REGULAR' as const,
      justificacion_estado: 'Criterio técnico evaluador',
    };
    const respuesta = firstValueFrom(servicio.validarConfirmacionEstado(solicitud));
    const peticion = http.expectOne('/api/v1/inspecciones/confirmacion-estado/validacion');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual(solicitud);

    const resultado = {
      estado_calculado: 'BUENO' as const,
      estado_confirmado: 'REGULAR' as const,
      justificacion_estado: 'Criterio técnico evaluador',
      anulacion: null,
      tiene_discrepancia: true,
      es_elevacion_de_anulacion_critica: false,
      estado_efectivo: 'REGULAR' as const,
    };
    peticion.flush(resultado);
    expect(await respuesta).toEqual(resultado);
  });
});
