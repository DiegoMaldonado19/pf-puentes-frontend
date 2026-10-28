import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import Dexie from 'dexie';
import { v7 } from 'uuid';
import { BaseLocal } from './base-local';
import { ArchivoLocal, Json, Operacion } from './modelos';
import { TransporteHttp } from './transporte-http';

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

describe('transporte HTTP de la cola (P1)', () => {
  const propietario = v7();
  const inspeccion = v7();
  const ruta = `/api/v1/inspecciones/${inspeccion}`;
  let db: BaseLocal, transporte: TransporteHttp, http: HttpTestingController;
  let senal: AbortSignal;

  const operacion = (tipo: Operacion['tipo'], payload: Json, extra: Partial<Operacion> = {}) =>
    ({
      id: v7(),
      propietario_id: propietario,
      modelo_version: 1,
      inspeccion_id: inspeccion,
      entidad_id: inspeccion,
      tipo,
      version_local: 1,
      payload,
      clave: v7(),
      dependencias: [],
      estado: 'en_proceso',
      intentos: 0,
      proximo_intento: 0,
      ultimo_intento: null,
      error: null,
      ejecucion: null,
      resultado: null,
      ...extra,
    }) satisfies Operacion;

  const datos = (metadatos: Json = {}, extra: Partial<Operacion> = {}) =>
    operacion(
      'datos',
      {
        respuestas: { 'identificacion.nombre': 'Puente Samalá' },
        formulario_version_id: 'formulario-1',
        puente_id: 'puente-1',
        metadatos,
        creada_en: '2026-10-27T03:00:00.000Z',
        modificada_en: '2026-10-27T03:00:00.000Z',
      },
      extra,
    );

  const archivo = (mime: string, extra: Partial<ArchivoLocal> = {}): ArchivoLocal => ({
    id: v7(),
    propietario_id: propietario,
    modelo_version: 1,
    inspeccion_id: inspeccion,
    archivo: new Blob(['contenido'], { type: mime }),
    miniatura: new Blob(['miniatura'], { type: mime }),
    elemento_ref: 'subestructura.estribo_entrada',
    latitud: 14.83,
    longitud: -91.52,
    capturada_en: '2026-10-27T15:00:00.000Z',
    mime,
    tamano: 9,
    confirmado: false,
    ...extra,
  });

  /** La versión del PUT se lee de Dexie antes de enviar: la petición llega después de un tick. */
  async function esperar(method: string, url: string) {
    for (let i = 0; i < 200; i++) {
      const [peticion] = http.match({ method, url });
      if (peticion) return peticion;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    throw new Error(`No llegó ${method} ${url}`);
  }

  beforeEach(() => {
    db = new BaseLocal(`test-${v7()}`);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BaseLocal, useValue: db },
      ],
    });
    transporte = TestBed.inject(TransporteHttp);
    http = TestBed.inject(HttpTestingController);
    senal = new AbortController().signal;
  });

  afterEach(async () => {
    http.verify();
    await db.delete();
  });

  it('guarda el borrador con la clave de la operación, X-Sgp-Sync y versión 0 sin confirmadas', async () => {
    const o = datos({ fecha_inspeccion: '2026-10-26', grupos_sin_danos: ['cauce'] });
    const promesa = transporte.ejecutar(o, undefined, senal);
    const put = await esperar('PUT', ruta);
    expect(put.request.headers.get('Idempotency-Key')).toBe(o.clave);
    expect(put.request.headers.get('X-Sgp-Sync')).toBe('true');
    expect(put.request.body).toEqual({
      datos: { 'identificacion.nombre': 'Puente Samalá' },
      version: 0,
      fecha_inspeccion: '2026-10-26',
      grupos_sin_danos: ['cauce'],
    });
    put.flush({ id: inspeccion, version: 1 });
    await expect(promesa).resolves.toEqual({
      tipo: 'ack',
      propietario_id: propietario,
      operacion_id: o.id,
      version_local: 1,
      resultado: { id: inspeccion, version: 1 },
    });
  });

  it('usa la última versión confirmada antes de la operación, la misma en cada reintento', async () => {
    const confirmada = datos({}, { estado: 'confirmada', resultado: { version: 3 } });
    const fallida = datos({}, { estado: 'requiere_intervencion', resultado: { version: 7 } });
    const o = datos();
    const posterior = datos({}, { estado: 'confirmada', resultado: { version: 9 } });
    await db.cola_sync.bulkAdd([confirmada, fallida, o, posterior]);
    for (let intento = 0; intento < 2; intento++) {
      const promesa = transporte.ejecutar(o, undefined, senal);
      const put = await esperar('PUT', ruta);
      expect((put.request.body as { version: number }).version).toBe(3);
      put.flush({ id: inspeccion, version: 4 });
      await promesa;
    }
  });

  it('da de alta el borrador nacido sin conexión si el servidor no lo conoce y repite el guardado', async () => {
    const o = datos({ asignacion_id: 'asignacion-1', curso_id: 'curso-1', latitud: 14.8 });
    const promesa = transporte.ejecutar(o, undefined, senal);
    (await esperar('PUT', ruta)).flush(
      { type: 'https://sgp/problemas/inspeccion-no-encontrada' },
      { status: 404, statusText: 'Not Found' },
    );
    const alta = await esperar('POST', '/api/v1/inspecciones');
    // 03:00 UTC del 27/10 todavía es el 26/10 en Guatemala.
    expect(alta.request.body).toEqual({
      id: inspeccion,
      puente_id: 'puente-1',
      asignacion_id: 'asignacion-1',
      curso_id: 'curso-1',
      fecha_inspeccion: '2026-10-26',
      dispositivo_id: localStorage.getItem('sgp.dispositivo'),
      latitud: 14.8,
      creada_en_dispositivo: '2026-10-27T03:00:00.000Z',
    });
    expect(localStorage.getItem('sgp.dispositivo')).toBeTruthy();
    alta.flush({ id: inspeccion, version: 0 }, { status: 201, statusText: 'Created' });
    const repetido = await esperar('PUT', ruta);
    expect(repetido.request.headers.get('Idempotency-Key')).toBe(o.clave);
    repetido.flush({ id: inspeccion, version: 1 });
    await expect(promesa).resolves.toMatchObject({ tipo: 'ack', resultado: { version: 1 } });
  });

  it('sube la foto en multipart con su UUID local, la miniatura y los metadatos del contrato 9', async () => {
    const foto = archivo('image/webp');
    const promesa = transporte.ejecutar(
      operacion('foto', null, { entidad_id: foto.id }),
      foto,
      senal,
    );
    const post = await esperar('POST', `${ruta}/fotos`);
    const cuerpo = post.request.body as FormData;
    expect(cuerpo.get('id')).toBe(foto.id);
    expect((cuerpo.get('foto') as File).name).toBe(`${foto.id}.webp`);
    expect((cuerpo.get('miniatura') as File).name).toBe(`${foto.id}-miniatura.webp`);
    expect(cuerpo.get('elemento_ref')).toBe('subestructura.estribo_entrada');
    expect(cuerpo.get('latitud')).toBe('14.83');
    expect(cuerpo.get('longitud')).toBe('-91.52');
    expect(cuerpo.get('capturada_en')).toBe('2026-10-27T15:00:00.000Z');
    expect(post.request.headers.has('Idempotency-Key')).toBe(false);
    post.flush({ id: foto.id }, { status: 201, statusText: 'Created' });
    await expect(promesa).resolves.toMatchObject({ tipo: 'ack', resultado: { id: foto.id } });
  });

  it('sube el PDF como documento sin campos de foto', async () => {
    const pdf = archivo('application/pdf', {
      miniatura: undefined,
      elemento_ref: null,
      latitud: null,
      longitud: null,
    });
    const o = operacion('documento', null, { entidad_id: pdf.id });
    const promesa = transporte.ejecutar(o, pdf, senal);
    const post = await esperar('POST', `${ruta}/documentos`);
    const cuerpo = post.request.body as FormData;
    expect(cuerpo.get('id')).toBe(pdf.id);
    expect((cuerpo.get('pdf') as File).name).toBe(`${pdf.id}.pdf`);
    expect(cuerpo.has('foto')).toBe(false);
    post.flush({ id: pdf.id }, { status: 201, statusText: 'Created' });
    await expect(promesa).resolves.toMatchObject({ tipo: 'ack' });
  });

  it('envía con la misma clave, X-Sgp-Sync y la fecha de la intención de envío', async () => {
    const o = operacion('envio', { intencion_envio_en: '2026-10-27T16:00:00.000Z' });
    const promesa = transporte.ejecutar(o, undefined, senal);
    const post = await esperar('POST', `${ruta}/envio`);
    expect(post.request.headers.get('Idempotency-Key')).toBe(o.clave);
    expect(post.request.headers.get('X-Sgp-Sync')).toBe('true');
    expect(post.request.body).toEqual({ enviada_en: '2026-10-27T16:00:00.000Z' });
    post.flush({ id: inspeccion, estado: 'ENVIADA' });
    await expect(promesa).resolves.toMatchObject({ tipo: 'ack', resultado: { estado: 'ENVIADA' } });
  });

  it.each([
    ['sin red', 0, null, 'transitorio'],
    ['servidor caído', 503, null, 'transitorio'],
    ['demasiadas solicitudes', 429, null, 'transitorio'],
    ['operación en proceso', 409, 'operacion-en-proceso', 'transitorio'],
    ['clave incompatible', 409, 'clave-idempotencia-incompatible', 'negocio'],
    ['no publicable', 422, 'inspeccion-no-publicable', 'negocio'],
    ['sin permiso', 403, null, 'negocio'],
    ['sesión vencida tras renovar', 401, null, 'sesion'],
  ] as const)('%s (%i) es un rechazo %s', async (_caso, status, problema, esperado) => {
    const o = operacion('envio', { intencion_envio_en: '2026-10-27T16:00:00.000Z' });
    const promesa = transporte.ejecutar(o, undefined, senal);
    const post = await esperar('POST', `${ruta}/envio`);
    if (status === 0) post.error(new ProgressEvent('error'));
    else
      post.flush(
        problema ? { type: `https://sgp/problemas/${problema}`, detail: problema } : null,
        {
          status,
          statusText: 'Error',
        },
      );
    const resultado = await promesa;
    expect(resultado.tipo).toBe(esperado);
    if (problema && resultado.tipo !== 'ack') expect(resultado.mensaje).toBe(problema);
  });

  it('cancela la petición en vuelo y rechaza con AbortError si el motor aborta', async () => {
    const controlador = new AbortController();
    const foto = archivo('image/jpeg');
    const o = operacion('foto', null, { entidad_id: foto.id });
    const promesa = transporte.ejecutar(o, foto, controlador.signal);
    const post = await esperar('POST', `${ruta}/fotos`);
    controlador.abort();
    await expect(promesa).rejects.toMatchObject({ name: 'AbortError' });
    expect(post.cancelled).toBe(true);
  });

  it('rechaza como negocio una foto sin archivo local', async () => {
    const resultado = await transporte.ejecutar(operacion('foto', null), undefined, senal);
    expect(resultado.tipo).toBe('negocio');
  });

  it('confirma permanentes después del PUT y usa su versión nueva en la siguiente operación', async () => {
    const permanentes = { identificacion: { nombre: 'Puente' } };
    const o = datos({
      permanentes_confirmados_en: '2026-10-28T15:00:00Z',
      permanentes,
    });
    const promesa = transporte.ejecutar(o, undefined, senal);
    (await esperar('PUT', ruta)).flush({ version: 1 });
    const confirmar = await esperar('POST', `${ruta}/confirmacion-datos-permanentes`);
    expect(confirmar.request.body).toEqual({ datos: permanentes });
    expect(confirmar.request.headers.get('Idempotency-Key')).toBe(`${o.clave}:permanentes`);
    expect(confirmar.request.headers.get('X-Sgp-Sync')).toBe('true');
    confirmar.flush({ version: 2, datos_permanentes_confirmados_en: '2026-10-28T15:00:01Z' });
    const resultado = await promesa;
    expect(resultado).toMatchObject({ tipo: 'ack', resultado: { version: 2 } });
    if (resultado.tipo !== 'ack') throw new Error('No hubo confirmación');
    await db.cola_sync.add({ ...o, estado: 'confirmada', resultado: resultado.resultado });
    const siguiente = transporte.ejecutar(datos(), undefined, senal);
    const put = await esperar('PUT', ruta);
    expect(put.request.body.version).toBe(2);
    put.flush({ version: 3 });
    await siguiente;
  });

  it('repite PUT y confirmación con los mismos cuerpos y claves tras perder la respuesta de confirmación', async () => {
    const o = datos({
      permanentes_confirmados_en: '2026-10-28T15:00:00Z',
      permanentes: { identificacion: { nombre: 'Precargado' } },
    });
    let cuerpoPut: unknown, cuerpoConfirmar: unknown;
    for (let intento = 0; intento < 2; intento++) {
      const promesa = transporte.ejecutar(o, undefined, senal);
      const put = await esperar('PUT', ruta);
      expect(put.request.headers.get('Idempotency-Key')).toBe(o.clave);
      if (intento === 0) cuerpoPut = structuredClone(put.request.body);
      else expect(put.request.body).toEqual(cuerpoPut);
      // Reproduce el resultado idempotente original, anterior a la confirmación.
      put.flush({ version: 1 });
      const confirmar = await esperar('POST', `${ruta}/confirmacion-datos-permanentes`);
      expect(confirmar.request.headers.get('Idempotency-Key')).toBe(`${o.clave}:permanentes`);
      if (intento === 0) {
        cuerpoConfirmar = structuredClone(confirmar.request.body);
        confirmar.error(new ProgressEvent('error'));
        await expect(promesa).resolves.toMatchObject({ tipo: 'transitorio' });
      } else {
        expect(confirmar.request.body).toEqual(cuerpoConfirmar);
        confirmar.flush({ version: 2, datos_permanentes_confirmados_en: '2026-10-28T15:00:01Z' });
        await expect(promesa).resolves.toMatchObject({ tipo: 'ack', resultado: { version: 2 } });
      }
    }
  });

  it('no repite confirmación cuando el PUT ya devuelve permanentes confirmados', async () => {
    const promesa = transporte.ejecutar(
      datos({
        permanentes_confirmados_en: '2026-10-28T15:00:00Z',
        permanentes: {},
      }),
      undefined,
      senal,
    );
    (await esperar('PUT', ruta)).flush({
      version: 4,
      datos_permanentes_confirmados_en: '2026-10-28T15:00:01Z',
    });
    await expect(promesa).resolves.toMatchObject({ tipo: 'ack', resultado: { version: 4 } });
    http.expectNone(`${ruta}/confirmacion-datos-permanentes`);
  });

  it('una confirmación rechazada no produce ACK ni oculta el error de negocio', async () => {
    const promesa = transporte.ejecutar(
      datos({
        permanentes_confirmados_en: '2026-10-28T15:00:00Z',
        permanentes: {},
      }),
      undefined,
      senal,
    );
    (await esperar('PUT', ruta)).flush({ version: 1 });
    (await esperar('POST', `${ruta}/confirmacion-datos-permanentes`)).flush(
      { detail: 'Revisa la identificación.' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await expect(promesa).resolves.toMatchObject({
      tipo: 'negocio',
      mensaje: 'Revisa la identificación.',
    });
  });
});
