import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpRequest,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { routes } from '../../app.routes';
import { TEXTOS } from '../../shared/textos';
import { CursosApi } from './cursos-api';
import { MisAsignaciones } from './mis-asignaciones';
import { CursoDetalle } from './curso-detalle';
import { destinoCursos, proveerSesionCursos, SESION_CURSOS, SesionCursos } from './sesion-cursos';

@Component({ template: 'Acceso de P2 (solo prueba)' })
class AccesoP2DePrueba {}

const pagina = { content: [], number: 0, size: 20, total_elements: 0, total_pages: 0 };
const estudiante: SesionCursos = { id: 'alumno', rol: 'ESTUDIANTE', token: 'acceso-en-memoria' };
const docente: SesionCursos = { id: 'docente', rol: 'CATEDRATICO', token: 'acceso-docente' };

describe('Integración P7 con el proveedor de sesión de P2', () => {
  const preparar = (
    inicial: SesionCursos | null = estudiante,
    restaurar = () => Promise.resolve(),
  ) => {
    const actual = signal(inicial);
    const prepararSesion = vi.fn(restaurar);
    const api = { propias: vi.fn(() => of(pagina)), listar: vi.fn(() => of(pagina)) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([...routes, { path: 'ingresar-p2', component: AccesoP2DePrueba }]),
        proveerSesionCursos(() => ({
          actual,
          preparar: prepararSesion,
          urlAcceso: '/ingresar-p2',
        })),
        { provide: CursosApi, useValue: api },
      ],
    });
    return { actual, prepararSesion, api };
  };

  it('espera la restauración antes de autorizar o consultar asignaciones', async () => {
    let terminar!: () => void;
    const pendiente = new Promise<void>((resolve) => {
      terminar = resolve;
    });
    const { actual, api } = preparar(null, () => pendiente);
    const harness = await RouterTestingHarness.create();
    const navegacion = harness.navigateByUrl('/mis-asignaciones');
    await vi.waitFor(() => expect(TestBed.inject(Router).getCurrentNavigation()).not.toBeNull());
    expect(api.propias).not.toHaveBeenCalled();
    actual.set(estudiante);
    terminar();
    await navegacion;
    expect(TestBed.inject(Router).url).toBe('/mis-asignaciones');
    expect(api.propias).toHaveBeenCalledOnce();
  });

  it.each([docente, estudiante])('la entrada de P7 dirige al rol $rol', async (sesion) => {
    preparar(sesion);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/acceso-cursos');
    expect(TestBed.inject(Router).url).toBe(destinoCursos(sesion.rol));
  });

  it('sin sesión restaurada ofrece el acceso real de P2, no una sesión ficticia', async () => {
    preparar(null);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/cursos');
    expect(TestBed.inject(Router).url).toBe('/acceso-cursos?motivo=sesion');
    const enlace = harness.routeNativeElement?.querySelector('a');
    expect(enlace?.getAttribute('href')).toBe('/ingresar-p2');
  });

  it('si restaurar falla no autoriza aunque quede un token anterior en memoria', async () => {
    const { api } = preparar(docente, async () => {
      throw new Error('Restauración rechazada');
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/cursos');
    expect(TestBed.inject(Router).url).toBe('/acceso-cursos?motivo=sesion');
    expect(api.listar).not.toHaveBeenCalled();
  });

  it('un rol ajeno no administra cursos ni se redirige en un bucle', async () => {
    const { prepararSesion, api } = preparar(estudiante);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/cursos');
    expect(TestBed.inject(Router).url).toBe('/acceso-cursos?motivo=permiso');
    expect(harness.routeNativeElement?.textContent).toContain(TEXTOS.cursos.sinPermiso);
    expect(prepararSesion).toHaveBeenCalledOnce();
    expect(api.listar).not.toHaveBeenCalled();
    expect(destinoCursos('ADMINISTRADOR')).toBeNull();
    expect(destinoCursos('PROFESIONAL_EXTERNO')).toBeNull();
  });

  it.each(['cierre', 'cambio de cuenta', 'cambio de rol'])(
    'limpia la vista activa ante %s notificado por P2',
    async (cambio) => {
      const { actual } = preparar(estudiante);
      const harness = await RouterTestingHarness.create();
      const vista = await harness.navigateByUrl('/mis-asignaciones', MisAsignaciones);
      expect(vista.pagina()).not.toBeNull();
      actual.set(
        cambio === 'cierre'
          ? null
          : cambio === 'cambio de rol'
            ? docente
            : { ...estudiante, id: 'otro-alumno' },
      );
      await vi.waitFor(() =>
        expect(TestBed.inject(Router).url).toContain('/acceso-cursos?motivo='),
      );
      expect(vista.pagina()).toBeNull();
    },
  );

  it('renovar el token del mismo usuario no borra la página ni la sesión', async () => {
    const { actual } = preparar(estudiante);
    const harness = await RouterTestingHarness.create();
    const vista = await harness.navigateByUrl('/mis-asignaciones', MisAsignaciones);
    actual.set({ ...estudiante, token: 'acceso-renovado-por-p2' });
    TestBed.tick();
    expect(TestBed.inject(Router).url).toBe('/mis-asignaciones');
    expect(vista.pagina()).not.toBeNull();
    expect(TestBed.inject(SESION_CURSOS)()?.token).toBe('acceso-renovado-por-p2');
  });

  it.each([401, 403])(
    'un %s final limpia datos sin renovar ni reintentar desde P7',
    async (status) => {
      const { api } = preparar(estudiante);
      const harness = await RouterTestingHarness.create();
      const vista = await harness.navigateByUrl('/mis-asignaciones', MisAsignaciones);
      api.propias.mockImplementation(() => throwError(() => new HttpErrorResponse({ status })));
      await vista.cargar();
      expect(vista.pagina()).toBeNull();
      await vi.waitFor(() =>
        expect(TestBed.inject(Router).url).toBe(
          '/acceso-cursos?motivo=' + (status === 401 ? 'sesion' : 'permiso'),
        ),
      );
      expect(api.propias).toHaveBeenCalledTimes(2);
    },
  );

  it('un rechazo de acceso en detalle limpia también formularios, curso y selección', async () => {
    preparar(docente);
    const api = {
      obtener: vi.fn(() => of({ id: 'curso', vigente: true })),
      inscripciones: () => of(pagina),
      estudiantes: () => of(pagina),
      puentes: () => of(pagina),
      actualizar: () => throwError(() => new HttpErrorResponse({ status: 403 })),
    };
    TestBed.overrideProvider(CursosApi, { useValue: api });
    const harness = await RouterTestingHarness.create();
    const vista = await harness.navigateByUrl('/cursos/curso', CursoDetalle);
    vista.inscripcion.controls.estudiante.setValue('alumno');
    vista.asignacion.controls.puente.setValue('puente');
    await vista.guardar({ nombre: 'Curso', anio: 2026, semestre: 2, vigente: true });
    expect(vista.curso()).toBeNull();
    expect(vista.inscritos()).toBeNull();
    expect(vista.seleccionada()).toBeNull();
    expect(vista.inscripcion.controls.estudiante.value).toBe('');
    expect(vista.asignacion.controls.puente.value).toBe('');
  });
});

describe('Responsabilidad de Authorization al conectar P2', () => {
  it('deja al interceptor común añadir el token vigente y no llama a renovar', async () => {
    const actual = signal<SesionCursos | null>(docente);
    const interceptorP2DePrueba = vi.fn((req: HttpRequest<unknown>, next: HttpHandlerFn) =>
      next(
        req.clone({
          setHeaders: { Authorization: `Bearer ${actual()!.token}` },
        }),
      ),
    );
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([interceptorP2DePrueba])),
        provideHttpClientTesting(),
        proveerSesionCursos(() => ({
          actual,
          preparar: () => Promise.resolve(),
          urlAcceso: '/ingresar-p2',
        })),
      ],
    });
    const api = TestBed.inject(CursosApi);
    const http = TestBed.inject(HttpTestingController);
    const resultado = firstValueFrom(api.listar());
    const req = http.expectOne('/api/v1/cursos?page=0&size=20');
    expect(interceptorP2DePrueba.mock.calls[0][0].headers.has('Authorization')).toBe(false);
    expect(req.request.headers.get('Authorization')).toBe('Bearer acceso-docente');
    req.flush(pagina);
    await resultado;
    actual.set({ ...docente, token: 'renovado' });
    const fallo = firstValueFrom(api.listar());
    const rechazado = expect(fallo).rejects.toMatchObject({ status: 401 });
    const otro = http.expectOne('/api/v1/cursos?page=0&size=20');
    expect(otro.request.headers.get('Authorization')).toBe('Bearer renovado');
    otro.flush({}, { status: 401, statusText: 'Unauthorized' });
    await rechazado;
    http.expectNone('/api/v1/auth/renovar');
    http.verify();
  });
});
