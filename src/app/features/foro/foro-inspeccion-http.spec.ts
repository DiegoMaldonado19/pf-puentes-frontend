import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FormularioService } from '../formulario/formulario.service';
import { InspeccionApi } from '../inspecciones/inspeccion-api';
import { ForoInspeccionHttp } from './foro-inspeccion-http';
import { FORO_INSPECCION_API, FORO_INSPECCION_MUTACIONES_API } from './puertos';

const comentario = {
  id: 'comentario',
  hilo_id: 'hilo',
  autor_id: 'autor',
  autor_nombre: 'Ana',
  texto: 'Revisar @docente',
  creado_en: '2026-10-28T12:00:00Z',
  padre_id: null,
  eliminado: false,
  elemento_ref: 'estribo',
};

describe('ForoInspeccionHttp', () => {
  let api: ForoInspeccionHttp;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: InspeccionApi,
          useValue: { detalle: () => of({ formulario: { id: 'historico' } }) },
        },
        {
          provide: FormularioService,
          useValue: {
            detalle: vi.fn(() =>
              of({
                esquema: {
                  type: 'object',
                  properties: { estribo: { type: 'number', 'x-elemento-ref': 'estribo' } },
                },
              }),
            ),
          },
        },
      ],
    });
    api = TestBed.inject(ForoInspeccionHttp);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('ambos puertos resuelven al adaptador HTTP real por defecto', () => {
    expect(TestBed.inject(FORO_INSPECCION_API)).toBe(api);
    expect(TestBed.inject(FORO_INSPECCION_MUTACIONES_API)).toBe(api);
    expect(api.disponible).toBe(true);
  });

  it('lee hilo y página de inspección, transforma DTO y usa anclajes del esquema histórico', () => {
    const recibir = vi.fn();
    api.leer('inspeccion', '1').subscribe(recibir);
    http
      .expectOne('/api/v1/inspecciones/inspeccion/hilo')
      .flush({ id: 'hilo', puente_id: 'puente', cerrado: false });
    const solicitud = http.expectOne(
      (req) => req.url === '/api/v1/inspecciones/inspeccion/comentarios',
    );
    expect(solicitud.request.params.get('page')).toBe('1');
    expect(solicitud.request.params.get('size')).toBe('50');
    solicitud.flush({ contenido: [comentario], pagina: 1, total_paginas: 3 });
    expect(recibir).toHaveBeenCalledWith({
      estado: 'PUBLICADA',
      contexto: { inspeccionId: 'inspeccion', puenteId: 'puente', hiloId: 'hilo', cerrado: false },
      pagina: {
        comentarios: [
          {
            id: 'comentario',
            autorId: 'autor',
            autorNombre: 'Ana',
            texto: 'Revisar @docente',
            creadoEn: comentario.creado_en,
            padreId: null,
            eliminado: false,
            elementoRef: 'estribo',
          },
        ],
        siguienteCursor: '2',
        anclajesDisponibles: [{ elementoRef: 'estribo', etiqueta: 'estribo' }],
      },
    });
    expect(TestBed.inject(FormularioService).detalle).toHaveBeenCalledWith('historico');
  });

  it('publica comentario y respuesta con elemento_ref y padre_id sin cambiar @menciones', () => {
    api.crear('inspeccion', { texto: 'Revisar @docente', elementoRef: 'estribo' }).subscribe();
    const raiz = http.expectOne('/api/v1/inspecciones/inspeccion/comentarios');
    expect(raiz.request.method).toBe('POST');
    expect(raiz.request.body).toEqual({ texto: 'Revisar @docente', elemento_ref: 'estribo' });
    raiz.flush(comentario);
    api.responder('inspeccion', 'comentario', { texto: 'Respuesta' }).subscribe();
    const respuesta = http.expectOne('/api/v1/inspecciones/inspeccion/comentarios');
    expect(respuesta.request.body).toEqual({
      texto: 'Respuesta',
      elemento_ref: null,
      padre_id: 'comentario',
    });
    respuesta.flush({ ...comentario, id: 'respuesta', padre_id: 'comentario' });
  });

  it('agrega las menciones elegidas como @uuid al final del texto publicado', () => {
    const persona = '019a0000-0000-7000-8000-000000000001';
    api.crear('inspeccion', { texto: 'Revisar', menciones: [persona] }).subscribe();
    const solicitud = http.expectOne('/api/v1/inspecciones/inspeccion/comentarios');
    expect(solicitud.request.body).toEqual({ texto: `Revisar @${persona}`, elemento_ref: null });
    solicitud.flush(comentario);
  });

  it('reutiliza endpoints genéricos para editar, borrar y moderar', () => {
    api.editar('inspeccion', 'comentario', 'Corregido').subscribe();
    const editar = http.expectOne('/api/v1/comentarios/comentario');
    expect(editar.request.method).toBe('PATCH');
    expect(editar.request.body).toEqual({ texto: 'Corregido' });
    editar.flush(comentario);
    api.borrar('inspeccion', 'comentario').subscribe();
    const borrar = http.expectOne('/api/v1/comentarios/comentario');
    expect(borrar.request.method).toBe('DELETE');
    borrar.flush(null, { status: 204, statusText: 'No Content' });
    api.ocultarComentario('inspeccion', 'comentario', '  Motivo  ').subscribe();
    const ocultar = http.expectOne('/api/v1/comentarios/comentario/ocultamiento');
    expect(ocultar.request.method).toBe('PATCH');
    expect(ocultar.request.body).toEqual({ motivo: 'Motivo' });
    ocultar.flush(null, { status: 204, statusText: 'No Content' });
    api.cerrarHilo('inspeccion', 'Motivo').subscribe();
    http.expectOne('/api/v1/inspecciones/inspeccion/hilo').flush({ id: 'hilo' });
    const cerrar = http.expectOne('/api/v1/hilos/hilo/cierre');
    expect(cerrar.request.method).toBe('PATCH');
    expect(cerrar.request.body).toEqual({ motivo: 'Motivo' });
    cerrar.flush(null, { status: 204, statusText: 'No Content' });
  });

  it.each([
    [401, 'SIN_PERMISOS'],
    [403, 'SIN_PERMISOS'],
    [404, 'NO_PUBLICADA'],
    [409, 'CERRADO'],
    [500, 'ERROR'],
  ])('expone el fallo de publicación %s como %s', (status, estado) => {
    const recibir = vi.fn();
    api.crear('inspeccion', { texto: 'Texto' }).subscribe(recibir);
    http.expectOne('/api/v1/inspecciones/inspeccion/comentarios').flush(
      {},
      {
        status: status as number,
        statusText: 'Error',
      },
    );
    expect(recibir).toHaveBeenCalledWith(expect.objectContaining({ estado }));
  });

  it('exige motivo de moderación sin enviar peticiones', () => {
    const recibir = vi.fn();
    api.cerrarHilo('inspeccion', ' ').subscribe(recibir);
    expect(recibir).toHaveBeenCalledWith({ estado: 'MOTIVO_REQUERIDO' });
    http.expectNone(() => true);
  });
});
