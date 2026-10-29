import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FotoCapturada } from '../../shared/captura-foto/captura-foto';
import { InspeccionApi } from './inspeccion-api';

describe('InspeccionApi', () => {
  let api: InspeccionApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(InspeccionApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('crear: POST con Idempotency-Key y sin X-Sgp-Sync (las pantallas en línea no son la cola)', () => {
    const cuerpo = {
      id: 'id',
      puente_id: 'p',
      fecha_inspeccion: '2026-10-27',
      dispositivo_id: 'd',
    };
    api.crear(cuerpo, { clave: 'clave-1' }).subscribe();
    const req = http.expectOne('/api/v1/inspecciones');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('clave-1');
    expect(req.request.headers.has('X-Sgp-Sync')).toBe(false);
    expect(req.request.body).toBe(cuerpo);
    req.flush({});
  });

  it('recorta la clave de idempotencia a 100 caracteres', () => {
    api.eliminar('i1', { clave: 'x'.repeat(150) }).subscribe();
    const req = http.expectOne('/api/v1/inspecciones/i1');
    expect(req.request.headers.get('Idempotency-Key')).toHaveLength(100);
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('un GET nunca manda Idempotency-Key', () => {
    api.detalle('i1').subscribe();
    const req = http.expectOne('/api/v1/inspecciones/i1');
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.has('Idempotency-Key')).toBe(false);
    req.flush({});
  });

  it('lista archivos remotos con url_miniatura y URL nullable', () => {
    const archivos = [{ id: 'pdf', tipo: 'PDF', url: null, url_miniatura: null }];
    api.archivos('i1').subscribe((respuesta) => expect(respuesta).toEqual(archivos));
    const req = http.expectOne('/api/v1/inspecciones/i1/archivos');
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.has('Idempotency-Key')).toBe(false);
    req.flush(archivos);
  });

  it('listar: paginación, orden por fecha y solo los filtros con valor', () => {
    api.listar({ estado: 'BORRADOR', puente_id: undefined, fecha_desde: '' }, 2, 10).subscribe();
    const req = http.expectOne((r) => r.url === '/api/v1/inspecciones');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('10');
    expect(req.request.params.get('sort')).toBe('fechaInspeccion,desc');
    expect(req.request.params.get('estado')).toBe('BORRADOR');
    expect(req.request.params.has('puente_id')).toBe(false);
    expect(req.request.params.has('fecha_desde')).toBe(false);
    req.flush({ content: [], number: 2, size: 10, total_elements: 0, total_pages: 0 });
  });

  it('guardarAvance: PUT con el cuerpo tal cual, sin campos inmutables', () => {
    api.guardarAvance('i1', { datos: { a: 1 }, version: 4 }, { clave: 'k' }).subscribe();
    const req = http.expectOne('/api/v1/inspecciones/i1');
    expect(req.request.method).toBe('PUT');
    expect(Object.keys(req.request.body as object).sort()).toEqual(['datos', 'version']);
    req.flush({});
  });

  it('la cola es la única que manda X-Sgp-Sync', () => {
    api.guardarAvance('i1', { datos: {}, version: 1 }, { clave: 'k', sync: true }).subscribe();
    const req = http.expectOne('/api/v1/inspecciones/i1');
    expect(req.request.headers.get('X-Sgp-Sync')).toBe('true');
    req.flush({});
  });

  it('enviar: POST /envio con cuerpo vacío permitido', () => {
    api.enviar('i1').subscribe();
    const req = http.expectOne('/api/v1/inspecciones/i1/envio');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({});
  });

  it('reemplazarAcompanantes: PUT con la lista completa', () => {
    api.reemplazarAcompanantes('i1', [{ nombre: 'Ana', usuario_id: null }]).subscribe();
    const req = http.expectOne('/api/v1/inspecciones/i1/acompanantes');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ acompanantes: [{ nombre: 'Ana', usuario_id: null }] });
    req.flush({});
  });

  it('confirmarPermanentes, historial y datos permanentes usan las rutas del contrato', () => {
    api.confirmarPermanentes('i1', { datos: {} }).subscribe();
    http.expectOne('/api/v1/inspecciones/i1/confirmacion-datos-permanentes').flush({});
    api.historial('i1').subscribe();
    http.expectOne('/api/v1/inspecciones/i1/historial').flush([]);
    api.datosPermanentes('i1').subscribe();
    http.expectOne('/api/v1/inspecciones/i1/datos-permanentes').flush({});
    api.datosPermanentesDePuente('p1').subscribe();
    http.expectOne('/api/v1/puentes/p1/datos-permanentes').flush({});
    api.deUnPuente('p1').subscribe();
    http.expectOne((r) => r.url === '/api/v1/puentes/p1/inspecciones').flush({});
    api.puentesInspeccionables().subscribe();
    http.expectOne((r) => r.url === '/api/v1/puentes-inspeccionables').flush({});
  });

  it('subirFoto: multipart con id UUID, foto, miniatura, GPS y capturada_en', () => {
    const foto: FotoCapturada = {
      archivo: new Blob(['a'], { type: 'image/webp' }),
      miniatura: new Blob(['m'], { type: 'image/webp' }),
      latitud: 14.8,
      longitud: -91.5,
      capturada_en: '2026-10-27T18:00:00.000Z',
    };
    api.subirFoto('i1', 'foto-id', foto, 'subestructura.estribo', { clave: 'k' }).subscribe();
    const req = http.expectOne('/api/v1/inspecciones/i1/fotos');
    const datos = req.request.body as FormData;
    expect(datos.get('id')).toBe('foto-id');
    expect((datos.get('foto') as File).name).toBe('foto-id.webp');
    expect((datos.get('miniatura') as File).name).toBe('foto-id-miniatura.webp');
    expect(datos.get('elemento_ref')).toBe('subestructura.estribo');
    expect(datos.get('latitud')).toBe('14.8');
    expect(datos.get('capturada_en')).toBe('2026-10-27T18:00:00.000Z');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    req.flush({});
  });

  it('subirFoto sin GPS ni elemento no manda esos campos', () => {
    const foto: FotoCapturada = {
      archivo: new Blob(['a'], { type: 'image/jpeg' }),
      miniatura: new Blob(['m'], { type: 'image/jpeg' }),
      latitud: null,
      longitud: null,
      capturada_en: '2026-10-27T18:00:00.000Z',
    };
    api.subirFoto('i1', 'f2', foto, null).subscribe();
    const datos = http.expectOne('/api/v1/inspecciones/i1/fotos').request.body as FormData;
    expect(datos.has('latitud')).toBe(false);
    expect(datos.has('elemento_ref')).toBe(false);
    expect((datos.get('foto') as File).name).toBe('f2.jpg');
    http.match('/api/v1/inspecciones/i1/fotos').forEach((r) => r.flush({}));
  });

  it('subirDocumento y eliminarArchivo apuntan a P1', () => {
    api.subirDocumento('i1', 'doc', new File(['%PDF'], 'informe.pdf')).subscribe();
    const req = http.expectOne('/api/v1/inspecciones/i1/documentos');
    expect((req.request.body as FormData).get('id')).toBe('doc');
    req.flush({});
    api.eliminarArchivo('doc').subscribe();
    const baja = http.expectOne('/api/v1/archivos/doc');
    expect(baja.request.method).toBe('DELETE');
    baja.flush(null, { status: 204, statusText: 'No Content' });
  });
});
