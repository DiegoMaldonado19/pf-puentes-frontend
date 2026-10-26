import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TEXTOS } from '../../shared/textos';
import { ForoService } from './foro.service';

describe('ForoService', () => {
  const usuarioId = '00000000-0000-4000-8000-000000000001';
  let servicio: ForoService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(ForoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('no envía escrituras sin sesión', async () => {
    expect(
      await servicio.crearHilo('puente-prueba', {
        titulo: 'Consulta ficticia',
        categoria: 'consulta',
      }),
    ).toBeNull();
    http.expectNone(() => true);
  });

  it('habilita moderación solo para los roles autorizados', () => {
    servicio.establecerUsuario(usuarioId, ['ESTUDIANTE']);
    expect(servicio.puedeModerar()).toBe(false);
    servicio.establecerUsuario(usuarioId, ['CATEDRATICO']);
    expect(servicio.puedeModerar()).toBe(true);
    servicio.establecerUsuario(null, ['ADMINISTRADOR']);
    expect(servicio.puedeModerar()).toBe(false);
  });

  it('evita duplicar una publicación mientras está en curso', async () => {
    servicio.establecerUsuario(usuarioId);
    const entrada = { titulo: 'Consulta ficticia', categoria: 'consulta' } as const;
    const pendiente = servicio.crearHilo('puente-prueba', entrada);
    const peticion = http.expectOne('/api/v1/puentes/puente-prueba/hilos');
    expect(servicio.creandoHilo()).toBe(true);
    expect(await servicio.crearHilo('puente-prueba', entrada)).toBeNull();
    http.expectNone(() => true);
    peticion.flush({ id: 'hilo-prueba', ...entrada });
    expect((await pendiente)?.id).toBe('hilo-prueba');
    expect(servicio.creandoHilo()).toBe(false);
  });

  it('cancela una publicación cuando se cierra la sesión', async () => {
    servicio.establecerUsuario(usuarioId);
    const pendiente = servicio.crearHilo('puente-prueba', {
      titulo: 'Consulta ficticia',
      categoria: 'consulta',
    });
    const peticion = http.expectOne('/api/v1/puentes/puente-prueba/hilos');
    servicio.establecerUsuario(null);
    expect(peticion.cancelled).toBe(true);
    expect(await pendiente).toBeNull();
    expect(servicio.creandoHilo()).toBe(false);
    expect(servicio.escriturasEnCurso().size).toBe(0);
  });

  it('invalida la sesión ante una escritura no autorizada', async () => {
    servicio.establecerUsuario(usuarioId);
    const pendiente = servicio.crearHilo('puente-prueba', {
      titulo: 'Consulta ficticia',
      categoria: 'consulta',
    });
    http
      .expectOne('/api/v1/puentes/puente-prueba/hilos')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(await pendiente).toBeNull();
    expect(servicio.sesionActiva()).toBe(false);
    expect(servicio.errorEscritura()).toBe(TEXTOS.foro.sesionInvalida);
  });
});
