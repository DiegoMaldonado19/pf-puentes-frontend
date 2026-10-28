import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PublicacionesP5 } from './publicaciones-p5';
import { SesionOffline } from './sesion-offline';

const propietario = '019a1234-1234-7000-8000-123456789abc';
const otroAutor = '019a1234-1234-7000-8000-123456789abd';
const puente = '019a1234-1234-7000-8000-123456789abe';
const inspeccion = '019a1234-1234-7000-8000-123456789abf';
const formulario = '019a1234-1234-7000-8000-123456789ac0';
const fecha = '2026-10-05T12:30:00Z';
const rutaPrecarga = `/api/v1/puentes/${puente}/datos-permanentes`;
const rutaInspeccion = `/api/v1/inspecciones/${inspeccion}`;

const precarga = {
  datos: { estructura: { material: 'concreto', extension: [1, null, true] } },
  origen_inspeccion_id: inspeccion,
  anio_construccion: 1988,
  extension_futura: { conservar: true },
};
const sinOrigen = {
  ...precarga,
  origen_inspeccion_id: null,
  anio_construccion: null,
};
const detalle = {
  id: inspeccion,
  puente: { id: puente, codigo: 'P1', nombre: 'Puente 1' },
  formulario: { id: formulario, codigo: 'V1.0.0' },
  estado: 'PUBLICADA',
  version: 4,
  publicada_en: fecha,
  autor_id: otroAutor,
  datos: { estructura: { material: 'concreto', extension: { intacta: true } } },
  extension_futura: ['conservar', { valor: 9 }],
};

describe('consumidor HTTP P5 por propietario', () => {
  let servicio: PublicacionesP5;
  let http: HttpTestingController;
  let propietarioActual: string | null;
  let invalidar: (() => void) | undefined;
  let preparar: ReturnType<typeof vi.fn>;
  const liberar = vi.fn();

  beforeEach(() => {
    propietarioActual = propietario;
    preparar = vi.fn(async () => true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: SesionOffline,
          useValue: {
            propietarioActual: () => propietarioActual,
            preparar,
            alInvalidar: (cancelar: () => void) => {
              invalidar = cancelar;
              return liberar;
            },
          },
        },
      ],
    });
    servicio = TestBed.inject(PublicacionesP5);
    http = TestBed.inject(HttpTestingController);
    liberar.mockClear();
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  async function avanzar(): Promise<void> {
    for (let paso = 0; paso < 5; paso++) await Promise.resolve();
  }

  async function iniciarPrecarga(datos: unknown = precarga) {
    const resultado = servicio.consultar(propietario, puente);
    await avanzar();
    const peticion = http.expectOne(rutaPrecarga);
    expect(peticion.request.method).toBe('GET');
    peticion.flush(datos as object);
    return { resultado };
  }

  it('conserva la precarga y el detalle autorizado íntegros, aunque el autor no sea el dueño local', async () => {
    const { resultado } = await iniciarPrecarga();
    await avanzar();
    const peticion = http.expectOne(rutaInspeccion);
    expect(peticion.request.method).toBe('GET');
    peticion.flush(detalle);

    expect(await resultado).toEqual({
      id: inspeccion,
      propietario_id: propietario,
      modelo_version: 1,
      preparada_en: expect.any(String),
      datos: { precarga, publicacion: detalle },
    });
    expect(preparar).toHaveBeenCalled();
    expect(liberar).toHaveBeenCalledOnce();
  });

  it('conserva una publicación autorizada con revisión cero', async () => {
    const { resultado } = await iniciarPrecarga();
    const observado = resultado.then(
      (valor) => ({ valor }),
      (error: Error) => ({ error: error.message }),
    );
    await avanzar();
    http.expectOne(rutaInspeccion).flush({ ...detalle, version: 0 });
    expect(await observado).toMatchObject({
      valor: {
        propietario_id: propietario,
        datos: { precarga, publicacion: { ...detalle, version: 0 } },
      },
    });
  });

  it('acepta ausencia solo cuando la precarga incluye origen_inspeccion_id explícitamente null', async () => {
    const { resultado } = await iniciarPrecarga(sinOrigen);
    await expect(resultado).resolves.toBeNull();
    http.expectNone(rutaInspeccion);
    expect(liberar).toHaveBeenCalledOnce();
  });

  it.each([
    {},
    { datos: {}, anio_construccion: 1988 },
    { origen_inspeccion_id: null, anio_construccion: null },
    { ...precarga, origen_inspeccion_id: 'id-invalido' },
  ])('rechaza precarga omitida o parcial %#', async (respuesta) => {
    const resultado = servicio.consultar(propietario, puente);
    const rechazo = expect(resultado).rejects.toThrow();
    await avanzar();
    http.expectOne(rutaPrecarga).flush(respuesta);
    await rechazo;
    http.expectNone(rutaInspeccion);
  });

  it.each([401, 403, 404])('no convierte HTTP %s de precarga en ausencia', async (status) => {
    const resultado = servicio.consultar(propietario, puente);
    const rechazo = expect(resultado).rejects.toBeDefined();
    await avanzar();
    http
      .expectOne(rutaPrecarga)
      .flush(
        { type: 'https://sgp.cunoc.usac.edu.gt/errores/denegado' },
        { status, statusText: 'Error' },
      );
    await rechazo;
    http.expectNone(rutaInspeccion);
  });

  it.each([401, 403, 404])(
    'no convierte HTTP %s del detalle autorizado en ausencia',
    async (status) => {
      const { resultado } = await iniciarPrecarga();
      const rechazo = expect(resultado).rejects.toBeDefined();
      await avanzar();
      http
        .expectOne(rutaInspeccion)
        .flush(
          { type: 'https://sgp.cunoc.usac.edu.gt/errores/no-visible' },
          { status, statusText: 'Error' },
        );
      await rechazo;
    },
  );

  it.each([
    { ...detalle, id: puente },
    { ...detalle, puente: { ...detalle.puente, id: inspeccion } },
    { ...detalle, formulario: { id: formulario } },
    { ...detalle, formulario: { ...detalle.formulario, id: 'id-invalido' } },
    { ...detalle, version: undefined },
    { ...detalle, version: -1 },
    { ...detalle, version: 0.5 },
    { ...detalle, estado: 'ENVIADA' },
    { ...detalle, publicada_en: undefined },
    { ...detalle, datos: undefined },
  ])('rechaza detalle incompleto o que no corresponde a la publicación %#', async (respuesta) => {
    const { resultado } = await iniciarPrecarga();
    const rechazo = expect(resultado).rejects.toThrow();
    await avanzar();
    http.expectOne(rutaInspeccion).flush(respuesta);
    await rechazo;
  });

  it('no consulta con otro propietario y libera la invalidación tras un cambio de sesión', async () => {
    await expect(servicio.consultar(otroAutor, puente)).rejects.toThrow();
    http.expectNone(rutaPrecarga);
    expect(liberar).toHaveBeenCalledOnce();
    liberar.mockClear();

    const resultado = servicio.consultar(propietario, puente);
    const rechazo = expect(resultado).rejects.toThrow();
    await avanzar();
    invalidar?.();
    http.expectOne(rutaPrecarga).flush(precarga);
    await rechazo;
    expect(liberar).toHaveBeenCalledOnce();
  });
});
