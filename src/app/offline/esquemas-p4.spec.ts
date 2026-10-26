import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { EsquemasP4 } from './esquemas-p4';
import { SesionOffline } from './sesion-offline';

const formularioP4 = {
  id: '019a1234-1234-7000-8000-123456789abc',
  codigo: 'V1.0.0',
  esquema: { type: 'object', properties: {}, 'x-metadatos': { unidad: 'm' } },
  mapeo: { anterior: { campo: 'nuevo' } },
  estado: 'ACTIVA',
  publicada_en: '2026-10-05T00:00:00Z',
  creado_en: '2026-10-04T00:00:00Z',
  actualizado_en: '2026-10-05T00:00:00Z',
  extension_futura: { valores: [1, null, true] },
};

describe('adaptador P4 por propietario', () => {
  let servicio: EsquemasP4, http: HttpTestingController;
  let owner: string, invalidar: () => void;
  let preparar: ReturnType<typeof vi.fn>;
  const liberar = vi.fn();
  beforeEach(() => {
    owner = 'ana';
    preparar = vi.fn(async () => true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: SesionOffline,
          useValue: {
            propietarioActual: () => owner,
            preparar,
            alInvalidar: (fn: () => void) => {
              invalidar = fn;
              return liberar;
            },
          },
        },
      ],
    });
    servicio = TestBed.inject(EsquemasP4);
    http = TestBed.inject(HttpTestingController);
    liberar.mockClear();
  });
  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });
  async function responder(datos: unknown = formularioP4) {
    const resultado = servicio.descargar('ana');
    await Promise.resolve();
    const peticion = http.expectOne('/api/v1/formularios/activo');
    expect(peticion.request.method).toBe('GET');
    peticion.flush(datos as object);
    return resultado;
  }
  it('conserva DTO completo, código y metadatos sin persistencia sistema', async () => {
    expect(await responder()).toEqual({
      id: formularioP4.id,
      propietario_id: 'ana',
      modelo_version: 1,
      preparada_en: expect.any(String),
      datos: formularioP4,
    });
    expect(preparar).toHaveBeenCalledTimes(2);
    expect(liberar).toHaveBeenCalledOnce();
  });
  it.each(['codigo', 'id'] as const)(
    'recupera versión exacta por %s con segmento codificado',
    async (tipo) => {
      const selector = tipo === 'id' ? formularioP4.id : 'V1 /?';
      const resultado =
        tipo === 'id' ? servicio.porId('ana', selector) : servicio.porCodigo('ana', selector);
      await Promise.resolve();
      const url =
        tipo === 'id'
          ? `/api/v1/formularios/${selector}`
          : `/api/v1/formularios/versiones/${encodeURIComponent(selector)}`;
      const datos = {
        ...formularioP4,
        codigo: tipo === 'codigo' ? selector : formularioP4.codigo,
        estado: 'RETIRADA',
      };
      http.expectOne(url).flush(datos);
      expect((await resultado).datos).toEqual(datos);
    },
  );
  it('no acepta otra versión en una consulta exacta', async () => {
    const resultado = servicio.porCodigo('ana', 'V2');
    const rechazo = expect(resultado).rejects.toThrow();
    await Promise.resolve();
    http.expectOne('/api/v1/formularios/versiones/V2').flush(formularioP4);
    await rechazo;
  });
  it.each([
    null,
    { ...formularioP4, esquema: null },
    { ...formularioP4, codigo: '' },
    { ...formularioP4, actualizado_en: undefined },
    { ...formularioP4, estado: 'BORRADOR' },
  ])('rechaza respuesta parcial o activa inválida %#', async (datos) => {
    await expect(responder(datos)).rejects.toThrow();
  });
  it.each([
    [404, 'formulario-activo-no-encontrado', true],
    [404, 'formulario-no-encontrado', false],
    [403, 'formulario-activo-no-encontrado', false],
    [503, 'servicio-no-disponible', false],
  ] as const)('distingue HTTP %s %s', async (status, codigo, ausencia) => {
    const resultado = servicio.descargar('ana');
    const observado = ausencia
      ? expect(resultado).resolves.toBeNull()
      : expect(resultado).rejects.toBeDefined();
    await Promise.resolve();
    http
      .expectOne('/api/v1/formularios/activo')
      .flush(
        { type: `https://sgp.cunoc.usac.edu.gt/errores/${codigo}` },
        { status, statusText: 'Error' },
      );
    await observado;
    expect(liberar).toHaveBeenCalledOnce();
  });
  it('un 404 histórico no se convierte en ausencia de activo', async () => {
    const resultado = servicio.porId('ana', formularioP4.id);
    const rechazo = expect(resultado).rejects.toBeDefined();
    await Promise.resolve();
    http.expectOne(`/api/v1/formularios/${formularioP4.id}`).flush(
      {
        type: 'https://sgp.cunoc.usac.edu.gt/errores/formulario-activo-no-encontrado',
      },
      { status: 404, statusText: 'Not Found' },
    );
    await rechazo;
  });
  it('no devuelve datos si falla la renovación final', async () => {
    preparar.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(responder()).rejects.toThrow();
    expect(liberar).toHaveBeenCalledOnce();
  });
  it('otro propietario no inicia HTTP', async () => {
    await expect(servicio.descargar('bea')).rejects.toThrow();
    http.expectNone('/api/v1/formularios/activo');
  });
  it.each(['cambio', 'invalidacion'] as const)('rechaza respuesta tardía tras %s', async (caso) => {
    const resultado = servicio.descargar('ana');
    const rechazo = expect(resultado).rejects.toThrow();
    await Promise.resolve();
    if (caso === 'cambio') owner = 'bea';
    else invalidar();
    http.expectOne('/api/v1/formularios/activo').flush(formularioP4);
    await rechazo;
  });
});
