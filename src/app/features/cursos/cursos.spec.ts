import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { TEXTOS } from '../../shared/textos';
import { routes } from '../../app.routes';
import { CursoDetalle } from './curso-detalle';
import { CursosApi, mensajeErrorCursos } from './cursos-api';
import { FormularioCurso } from './formulario-curso';
import { MisAsignaciones } from './mis-asignaciones';
import { AsignacionDTO, CursoDTO, PaginaDTO } from './modelos';
import { SESION_CURSOS, SesionCursos } from './sesion-cursos';

const curso: CursoDTO = {
  id: '0192f5a0-0000-7000-8000-000000000301',
  nombre: 'Puentes',
  anio: 2026,
  semestre: 2,
  vigente: true,
  catedratico_id: '0192f5a0-0000-7000-8000-000000000101',
  creado_en: '2026-10-07T15:00:00Z',
  actualizado_en: '2026-10-07T15:00:00Z',
};
const asignacion: AsignacionDTO = {
  id: 'asignacion',
  curso_id: curso.id,
  inscripcion_id: 'inscripcion',
  estudiante_id: 'estudiante',
  puente_id: 'puente',
  creado_en: curso.creado_en,
};
const pagina = <T>(content: T[]): PaginaDTO<T> => ({
  content,
  number: 0,
  size: 20,
  total_elements: content.length,
  total_pages: content.length ? 1 : 0,
});

describe('Contrato HTTP de cursos', () => {
  let api: CursosApi;
  let http: HttpTestingController;
  let sesion: SesionCursos | null;
  beforeEach(() => {
    sesion = { id: curso.catedratico_id, rol: 'CATEDRATICO', token: 'token-en-memoria' };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SESION_CURSOS, useValue: () => sesion },
      ],
    });
    api = TestBed.inject(CursosApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('pagina las colecciones y usa el token actual, sin almacenar credenciales', async () => {
    const resultado = firstValueFrom(api.listar(2));
    const req = http.expectOne('/api/v1/cursos?page=2&size=20');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-en-memoria');
    req.flush(pagina([curso]));
    await resultado;
    sesion = { id: 'estudiante', rol: 'ESTUDIANTE', token: 'renovado' };
    const propias = firstValueFrom(api.propias());
    const otro = http.expectOne('/api/v1/mis-asignaciones?page=0&size=20');
    expect(otro.request.params.has('estudiante_id')).toBe(false);
    expect(otro.request.headers.get('Authorization')).toBe('Bearer renovado');
    otro.flush(pagina([asignacion]));
    expect((await propias).content).toEqual([asignacion]);
  });

  it('envía los DTO de crear, editar, inscribir y asignar con snake_case', async () => {
    const datos = { nombre: 'Puentes', anio: 2026, semestre: 2, vigente: true };
    for (const [observable, ruta, metodo, cuerpo] of [
      [api.crear(datos), '/api/v1/cursos', 'POST', datos],
      [api.actualizar(curso.id, datos), `/api/v1/cursos/${curso.id}`, 'PATCH', datos],
      [
        api.inscribir(curso.id, 'estudiante'),
        `/api/v1/cursos/${curso.id}/inscripciones`,
        'POST',
        { estudiante_id: 'estudiante' },
      ],
      [
        api.asignar(curso.id, 'inscripcion', 'puente'),
        `/api/v1/cursos/${curso.id}/inscripciones/inscripcion/asignaciones`,
        'POST',
        { puente_id: 'puente' },
      ],
    ] as const) {
      const resultado = firstValueFrom<unknown>(observable);
      const req = http.expectOne(ruta);
      expect(req.request.method).toBe(metodo);
      expect(req.request.body).toEqual(cuerpo);
      req.flush({});
      await resultado;
    }
  });

  it('consulta detalle, inscripciones, asignaciones y selectores paginados', async () => {
    const peticiones = [
      [api.obtener(curso.id), `/api/v1/cursos/${curso.id}`],
      [api.inscripciones(curso.id, 1), `/api/v1/cursos/${curso.id}/inscripciones?page=1&size=20`],
      [
        api.asignaciones(curso.id, 'inscripcion', 1),
        `/api/v1/cursos/${curso.id}/inscripciones/inscripcion/asignaciones?page=1&size=20`,
      ],
      [api.estudiantes(1), '/api/v1/cursos/estudiantes-elegibles?page=1&size=20'],
      [api.puentes(1), '/api/v1/cursos/puentes-disponibles?page=1&size=20'],
    ] as const;
    for (const [observable, ruta] of peticiones) {
      const resultado = firstValueFrom<unknown>(observable);
      http.expectOne(ruta).flush({});
      await resultado;
    }
  });

  it('envía la búsqueda normalizada junto con la página sin cambiar los filtros de sesión', async () => {
    const estudiantes = firstValueFrom(api.estudiantes(1, '  Estudiante ajeno  '));
    const req = http.expectOne((r) => r.url === '/api/v1/cursos/estudiantes-elegibles');
    expect(req.request.params.get('q')).toBe('Estudiante ajeno');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-en-memoria');
    req.flush(pagina([]));
    await estudiantes;
    const puentes = firstValueFrom(api.puentes(0, 'GT-99'));
    const otro = http.expectOne((r) => r.url === '/api/v1/cursos/puentes-disponibles');
    expect(otro.request.params.get('q')).toBe('GT-99');
    otro.flush(pagina([]));
    await puentes;
  });

  it('presenta errores semánticos y la dependencia de activación', () => {
    expect(
      mensajeErrorCursos(
        new HttpErrorResponse({ status: 409, error: { detail: 'Ya está inscrito.' } }),
      ),
    ).toBe('Ya está inscrito.');
    expect(mensajeErrorCursos(new HttpErrorResponse({ status: 503 }))).toBe(
      TEXTOS.cursos.activacionPendiente,
    );
    expect(mensajeErrorCursos(new HttpErrorResponse({ status: 401 }))).toBe(
      TEXTOS.cursos.sesionRequerida,
    );
    expect(mensajeErrorCursos(new HttpErrorResponse({ status: 403 }))).toBe(
      TEXTOS.cursos.sinPermiso,
    );
    expect(mensajeErrorCursos(new Error())).toBe(TEXTOS.cursos.error);
  });
});

describe('Guardias del módulo de cursos', () => {
  it('sin proveedor de P2 deniega las rutas privadas', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/cursos');
    expect(TestBed.inject(Router).url).toBe('/acceso-cursos');
    expect(harness.routeNativeElement?.querySelector('[role="status"]')?.textContent?.trim()).toBe(
      TEXTOS.cursos.sesionRequerida,
    );
    expect(harness.routeNativeElement?.textContent).not.toContain('P2');
    expect(harness.routeNativeElement?.querySelectorAll('p')).toHaveLength(1);
    await harness.navigateByUrl('/mis-asignaciones');
    expect(TestBed.inject(Router).url).toBe('/acceso-cursos');
  });

  it.each(['ESTUDIANTE', 'PROFESIONAL_EXTERNO', 'ADMINISTRADOR'] as const)(
    'el rol %s no administra cursos',
    async (rol) => {
      TestBed.configureTestingModule({
        providers: [
          provideRouter(routes),
          { provide: SESION_CURSOS, useValue: () => ({ id: 'id', rol, token: 'token' }) },
        ],
      });
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/cursos');
      expect(TestBed.inject(Router).url).toBe('/acceso-cursos');
    },
  );

  it('habilita solo la vista propia del estudiante', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        {
          provide: SESION_CURSOS,
          useValue: () => ({ id: 'id', rol: 'ESTUDIANTE', token: 'token' }),
        },
        { provide: CursosApi, useValue: { propias: () => of(pagina([asignacion])) } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/mis-asignaciones');
    expect(TestBed.inject(Router).url).toBe('/mis-asignaciones');
    expect(harness.routeNativeElement?.textContent).toContain('puente');
  });
});

describe('Formulario y flujos de cursos', () => {
  it('impide nombres vacíos, años fuera de rango y semestres inválidos', () => {
    const fixture = TestBed.createComponent(FormularioCurso);
    const componente = fixture.componentInstance;
    const guardado = vi.fn();
    componente.guardado.subscribe(guardado);
    for (const valores of [
      { nombre: ' ', anio: 2026, semestre: 2 },
      { nombre: 'Puentes', anio: 2019, semestre: 2 },
      { nombre: 'Puentes', anio: 2026.5, semestre: 2 },
      { nombre: 'Puentes', anio: 2026, semestre: 3 },
    ]) {
      componente.formulario.patchValue(valores);
      componente.enviar();
    }
    expect(guardado).not.toHaveBeenCalled();
    componente.formulario.patchValue({ nombre: '  Puentes  ', anio: 2026, semestre: 2 });
    componente.enviar();
    expect(guardado).toHaveBeenCalledWith({
      nombre: 'Puentes',
      anio: 2026,
      semestre: 2,
      vigente: true,
    });
  });

  const prepararDetalle = async (vigente = true) => {
    const api = {
      obtener: vi.fn(() => of({ ...curso, vigente })),
      inscripciones: vi.fn(() =>
        of(
          pagina([
            {
              id: 'inscripcion',
              estudiante_id: 'estudiante',
              estudiante_nombre: 'Estudiante visible',
              curso_id: curso.id,
              creado_en: curso.creado_en,
            },
          ]),
        ),
      ),
      estudiantes: vi.fn(() =>
        of(pagina([{ id: 'estudiante', nombre: 'Estudiante', estado: 'ACTIVO' }])),
      ),
      puentes: vi.fn(() =>
        of(pagina([{ id: 'puente', codigo: 'GT-09-0901-0001', nombre: 'Puente' }])),
      ),
      asignaciones: vi.fn(() => of(pagina([asignacion]))),
      inscribir: vi.fn(() => of({})),
      asignar: vi.fn(() => of(asignacion)),
      actualizar: vi.fn(() => of({ ...curso, vigente: false })),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ cursoId: curso.id }) } },
        },
        { provide: CursosApi, useValue: api },
      ],
    });
    const fixture = TestBed.createComponent(CursoDetalle);
    await fixture.whenStable();
    return { api, fixture, componente: fixture.componentInstance };
  };

  it('inscribe y asigna solo usando la inscripción seleccionada del curso', async () => {
    const { api, componente } = await prepararDetalle();
    componente.inscripcion.controls.estudiante.setValue('estudiante');
    await componente.inscribir();
    expect(api.inscribir).toHaveBeenCalledWith(curso.id, 'estudiante');
    await componente.seleccionar(componente.inscritos()!.content[0]);
    componente.asignacion.controls.puente.setValue('puente');
    await componente.asignar();
    expect(api.asignar).toHaveBeenCalledWith(curso.id, 'inscripcion', 'puente');
    expect(componente.mensaje()).toBe(TEXTOS.cursos.asignado);
  });

  it('busca desde la primera página y conserva el filtro aplicado al paginar', async () => {
    const { api, componente } = await prepararDetalle();
    componente.inscripcion.controls.estudiante.setValue('estudiante');
    componente.buscarEstudiante.controls.texto.setValue('  Estudiante  ');
    await componente.buscar('estudiantes');
    expect(api.estudiantes).toHaveBeenLastCalledWith(0, 'Estudiante');
    expect(componente.inscripcion.controls.estudiante.value).toBe('');
    componente.buscarEstudiante.controls.texto.setValue('Sin aplicar');
    await componente.paginar('estudiantes', 1);
    expect(api.estudiantes).toHaveBeenLastCalledWith(1, 'Estudiante');
    componente.buscarPuente.controls.texto.setValue('GT-09');
    await componente.buscar('puentes');
    await componente.paginar('puentes', 1);
    expect(api.puentes).toHaveBeenLastCalledWith(1, 'GT-09');
  });

  it('no consulta búsquedas excesivas ni cambia el filtro aplicado si falla una búsqueda', async () => {
    const { api, componente } = await prepararDetalle();
    api.estudiantes.mockClear();
    componente.buscarEstudiante.controls.texto.setValue('a'.repeat(121));
    await componente.buscar('estudiantes');
    expect(api.estudiantes).not.toHaveBeenCalled();
    componente.buscarEstudiante.controls.texto.setValue('Estudiante');
    await componente.buscar('estudiantes');
    api.estudiantes.mockImplementationOnce(() =>
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    componente.buscarEstudiante.controls.texto.setValue('Otro');
    await componente.buscar('estudiantes');
    expect(componente.error()).toBe(TEXTOS.cursos.error);
    await componente.paginar('estudiantes', 1);
    expect(api.estudiantes).toHaveBeenLastCalledWith(1, 'Estudiante');
  });

  it('muestra el nombre del estudiante y limpia la selección anterior al recargar', async () => {
    const { componente, fixture } = await prepararDetalle();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Estudiante visible');
    await componente.seleccionar(componente.inscritos()!.content[0]);
    componente.inscripcion.controls.estudiante.setValue('estudiante');
    componente.asignacion.controls.puente.setValue('puente');
    await componente.cargar();
    expect(componente.seleccionada()).toBeNull();
    expect(componente.asignaciones()).toBeNull();
    expect(componente.asignacion.controls.puente.value).toBe('');
    expect(componente.inscripcion.controls.estudiante.value).toBe('');
  });

  it('la vista del estudiante presenta etiquetas de puente y curso sin perder los UUID', async () => {
    const datos = {
      ...asignacion,
      puente_codigo: 'GT-99-9901-0201',
      puente_nombre: 'Puente legible',
      curso_nombre: 'Curso legible',
    };
    TestBed.configureTestingModule({
      providers: [{ provide: CursosApi, useValue: { propias: () => of(pagina([datos])) } }],
    });
    const fixture = TestBed.createComponent(MisAsignaciones);
    await fixture.whenStable();
    fixture.detectChanges();
    const texto = (fixture.nativeElement as HTMLElement).textContent;
    expect(texto).toContain('Puente legible');
    expect(texto).toContain('Curso legible');
    expect(fixture.componentInstance.pagina()!.content[0].puente_id).toBe('puente');
  });

  it('un curso cerrado conserva consulta y bloquea inscribir/asignar', async () => {
    const { api, componente, fixture } = await prepararDetalle(false);
    componente.inscripcion.controls.estudiante.setValue('estudiante');
    await componente.inscribir();
    await componente.seleccionar(componente.inscritos()!.content[0]);
    componente.asignacion.controls.puente.setValue('puente');
    await componente.asignar();
    expect(api.inscribir).not.toHaveBeenCalled();
    expect(api.asignar).not.toHaveBeenCalled();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      TEXTOS.cursos.cursoCerrado,
    );
  });

  it('una activación no disponible muestra el error sin anunciar éxito ni borrar la selección', async () => {
    const { api, componente } = await prepararDetalle();
    api.inscribir.mockImplementation(() =>
      throwError(() => new HttpErrorResponse({ status: 503 })),
    );
    componente.inscripcion.controls.estudiante.setValue('estudiante');
    await componente.inscribir();
    expect(componente.error()).toBe(TEXTOS.cursos.activacionPendiente);
    expect(componente.mensaje()).toBe('');
    expect(componente.inscripcion.controls.estudiante.value).toBe('estudiante');
  });

  it('mis asignaciones muestra errores de acceso sin inventar datos', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: CursosApi,
          useValue: { propias: () => throwError(() => new HttpErrorResponse({ status: 403 })) },
        },
      ],
    });
    const fixture = TestBed.createComponent(MisAsignaciones);
    await fixture.whenStable();
    expect(fixture.componentInstance.pagina()).toBeNull();
    expect(fixture.componentInstance.error()).toBe(TEXTOS.cursos.sinPermiso);
  });
});
