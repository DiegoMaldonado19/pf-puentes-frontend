import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FormularioService } from './formulario.service';
import { CrearFormularioVersionDTO, FormularioVersionDTO } from './modelos';

describe('FormularioService', () => {
  let service: FormularioService;
  let httpTesting: HttpTestingController;

  const versionMock: FormularioVersionDTO = {
    id: '0192b000-0000-7000-8000-000000000001',
    codigo: 'V1.0.0',
    estado: 'ACTIVA',
    esquema: {
      title: 'SIECA V1.0.0',
      type: 'object',
      properties: {
        identificacion: { type: 'object' },
      },
    },
    publicada_en: '2026-10-23T10:00:00Z',
    creado_en: '2026-10-23T10:00:00Z',
    actualizado_en: '2026-10-23T10:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), FormularioService],
    });
    service = TestBed.inject(FormularioService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('obtenerActivo debe realizar GET /api/v1/formularios/activo y retornar la versión activa', () => {
    service.obtenerActivo().subscribe((res) => {
      expect(res.codigo).toBe('V1.0.0');
      expect(res.estado).toBe('ACTIVA');
    });

    const req = httpTesting.expectOne('/api/v1/formularios/activo');
    expect(req.request.method).toBe('GET');
    req.flush(versionMock);
  });

  it('obtenerPorCodigo debe realizar GET a /api/v1/formularios/versiones/:codigo codificando la URL', () => {
    service.obtenerPorCodigo('V1.0.0').subscribe((res) => {
      expect(res.codigo).toBe('V1.0.0');
    });

    const req = httpTesting.expectOne('/api/v1/formularios/versiones/V1.0.0');
    expect(req.request.method).toBe('GET');
    req.flush(versionMock);
  });

  it('listar debe realizar GET con parámetros de paginación', () => {
    service.listar(1, 10).subscribe((res) => {
      expect(res.contenido.length).toBe(1);
    });

    const req = httpTesting.expectOne('/api/v1/formularios?page=1&size=10');
    expect(req.request.method).toBe('GET');
    req.flush({
      contenido: [versionMock],
      pagina: 1,
      tamano: 10,
      total_elementos: 1,
      total_paginas: 1,
    });
  });

  it('crearBorrador debe realizar POST con el payload del nuevo borrador', () => {
    const payload: CrearFormularioVersionDTO = {
      codigo: 'V2.0.0',
      esquema: {
        title: 'SIECA V2.0.0',
        type: 'object',
        properties: {},
      },
    };

    service.crearBorrador(payload).subscribe((res) => {
      expect(res.codigo).toBe('V2.0.0');
    });

    const req = httpTesting.expectOne('/api/v1/formularios');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ ...versionMock, codigo: 'V2.0.0', estado: 'BORRADOR' });
  });

  it('publicar debe realizar POST al endpoint de publicación con el mapeo declarado', () => {
    const mapeo = { mapeo: { 'campo.viejo': 'campo.nuevo' } };

    service.publicar('v1', mapeo).subscribe((res) => {
      expect(res.estado).toBe('ACTIVA');
    });

    const req = httpTesting.expectOne('/api/v1/formularios/v1/publicar');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(mapeo);
    req.flush(versionMock);
  });
});
