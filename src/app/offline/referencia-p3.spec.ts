import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../core/auth/auth';
import { puente } from '../features/puentes/datos-prueba';
import { AsignacionP7DTO } from './asignaciones-p7';
import { ReferenciaP3 } from './referencia-p3';
import { SesionOffline } from './sesion-offline';

const contexto = (id = 'a1', curso_id = 'c1'): AsignacionP7DTO => ({
  id,
  curso_id,
  inscripcion_id: `i-${curso_id}`,
  estudiante_id: 'ana',
  puente_id: 'p1',
  curso_nombre: curso_id,
  puente_codigo: 'GT-01',
  puente_nombre: 'Puente',
  creado_en: '2026-10-05T12:00:00Z',
});

describe('referencia P3/P7 con sesión remota G2', () => {
  let servicio: ReferenciaP3;
  let http: HttpTestingController;
  let propietario: string | null;
  let invalidar: (() => void) | undefined;
  let preparar: ReturnType<typeof vi.fn>;
  let liberar: ReturnType<typeof vi.fn>;
  let rol: string;
  beforeEach(() => {
    propietario = 'ana';
    rol = 'ESTUDIANTE';
    preparar = vi.fn().mockResolvedValue(true);
    liberar = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { rol: () => rol } },
        {
          provide: SesionOffline,
          useValue: {
            propietarioActual: () => propietario,
            preparar,
            alInvalidar: (cancelar: () => void) => {
              invalidar = cancelar;
              return liberar;
            },
          },
        },
      ],
    });
    servicio = TestBed.inject(ReferenciaP3);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  async function responderAsignaciones(contextos = [contexto(), contexto('a2', 'c2')]) {
    await vi.waitFor(() => {
      http.expectOne('/api/v1/mis-asignaciones?page=0&size=20').flush({
        content: contextos,
        number: 0,
        size: 20,
        total_elements: contextos.length,
        total_pages: contextos.length ? 1 : 0,
      });
    });
  }

  it.each(['CATEDRATICO', 'PROFESIONAL_EXTERNO'])(
    'prepara %s con contextos reales inspeccionables sin inventar asignaciones',
    async (actual) => {
      rol = actual;
      const resultado = servicio.descargar('ana');
      const inspeccionable = {
        id: 'p1',
        codigo: 'GT-01',
        nombre: 'Puente',
        curso_id: null,
        curso_nombre: null,
        borrador_en_curso: false,
      };
      await vi.waitFor(() =>
        http
          .expectOne('/api/v1/puentes-inspeccionables?page=0&size=100')
          .flush({ content: [inspeccionable], number: 0, total_pages: 1 }),
      );
      await vi.waitFor(() => http.expectOne('/api/v1/puentes/p1').flush(puente({ id: 'p1' })));
      expect(await resultado).toEqual({
        asignaciones: [],
        inspeccionables: [inspeccionable],
        puentes: [puente({ id: 'p1' })],
      });
      http.expectNone((r) => r.url === '/api/v1/mis-asignaciones');
    },
  );

  it('conserva contextos y descarga una ficha P3 por puente sin usar el catálogo activo', async () => {
    const resultado = servicio.descargar('ana');
    await responderAsignaciones();
    await vi.waitFor(() => http.expectOne('/api/v1/puentes/p1').flush(puente({ id: 'p1' })));
    expect(await resultado).toEqual({
      asignaciones: [contexto(), contexto('a2', 'c2')],
      puentes: [puente({ id: 'p1' })],
    });
    expect(preparar.mock.calls).toEqual([['ana'], ['ana']]);
    expect(liberar).toHaveBeenCalledOnce();
    http.expectNone('/api/v1/puentes');
  });

  it('lista vacía no consulta fichas pero vuelve a comprobar sesión', async () => {
    const resultado = servicio.descargar('ana');
    await responderAsignaciones([]);
    expect(await resultado).toEqual({ asignaciones: [], puentes: [] });
    expect(preparar).toHaveBeenCalledTimes(2);
    http.expectNone((r) => r.url.startsWith('/api/v1/puentes'));
  });

  it('rechaza sin descargar cuando G2 no permite preparar', async () => {
    preparar.mockResolvedValue(false);
    await expect(servicio.descargar('ana')).rejects.toThrow();
    http.expectNone((r) => r.url.startsWith('/api/v1/'));
    expect(liberar).toHaveBeenCalledOnce();
  });

  it.each([500, 401, 403])('no devuelve resultado parcial tras fallo P3 %s', async (status) => {
    const resultado = servicio.descargar('ana');
    const rechazo = expect(resultado).rejects.toMatchObject({ status });
    await responderAsignaciones();
    await vi.waitFor(() =>
      http.expectOne('/api/v1/puentes/p1').flush(null, {
        status,
        statusText: 'Error',
      }),
    );
    await rechazo;
    expect(liberar).toHaveBeenCalledOnce();
  });

  it.each(['cambio', 'invalidacion', 'comprobacion'] as const)(
    'descarta fichas descargadas ante %s de sesión',
    async (tipo) => {
      const resultado = servicio.descargar('ana');
      const rechazo = expect(resultado).rejects.toThrow();
      await responderAsignaciones();
      if (tipo === 'cambio') propietario = 'bea';
      if (tipo === 'invalidacion') invalidar?.();
      if (tipo === 'comprobacion') preparar.mockResolvedValue(false);
      await vi.waitFor(() => http.expectOne('/api/v1/puentes/p1').flush(puente()));
      await rechazo;
      expect(liberar).toHaveBeenCalledOnce();
    },
  );

  it('integra G2 y AuthService reales: renueva antes y después sin duplicar autenticación', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthService);
    servicio = TestBed.inject(ReferenciaP3);
    await expect(servicio.descargar('ana')).rejects.toThrow();
    http.expectNone((r) => r.url.startsWith('/api/v1/'));
    const sesion = {
      access_token: 'solo-prueba',
      token_type: 'Bearer',
      expires_in: 900,
      usuario: { id: 'ana', nombre: 'Ana', rol: 'ESTUDIANTE' },
    };
    const login = firstValueFrom(auth.iniciarSesion('ana@ejemplo.test', 'solo-prueba'));
    http.expectOne('/api/v1/auth/login').flush(sesion);
    await login;
    const resultado = servicio.descargar('ana');
    http.expectOne('/api/v1/auth/renovar').flush(sesion);
    await responderAsignaciones([]);
    await vi.waitFor(() => http.expectOne('/api/v1/auth/renovar').flush(sesion));
    expect(await resultado).toEqual({ asignaciones: [], puentes: [] });
    expect(auth.usuario()?.id).toBe('ana');
  });
});
