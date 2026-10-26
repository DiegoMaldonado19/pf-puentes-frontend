import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CanActivateFn, provideRouter, Router, UrlTree } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth';
import { authInterceptor } from '../../core/auth/auth.interceptor';
import { Rol } from '../../core/auth/modelos';
import { TEXTOS } from '../../shared/textos';
import { estabilizar, puente } from '../puentes/datos-prueba';
import { RUTAS_PUENTES } from '../puentes/puentes.routes';
import { ConsultaOrdenes } from './consulta-ordenes';
import { GestionMantenimiento } from './gestion-mantenimiento';
import { OrdenMantenimientoDTO } from './modelos';

describe('Gestión de mantenimiento con la sesión P2', () => {
  const id = puente().id;
  const base = `/api/v1/puentes/${id}/ordenes-mantenimiento`;
  const t = TEXTOS.mantenimiento.gestion;
  let fixture: ComponentFixture<GestionMantenimiento>;
  let http: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [GestionMantenimiento],
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });
  afterEach(() => {
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });
  const html = () => fixture.nativeElement as HTMLElement;
  const botones = () =>
    Array.from(
      html().querySelectorAll(`nav[aria-label="${t.navegacion}"] button`),
    ) as HTMLButtonElement[];
  const pagina = (content: readonly OrdenMantenimientoDTO[] = []) => ({
    puente_id: id,
    content,
    page: 0,
    size: 20,
    total_elements: content.length,
    total_pages: content.length ? 1 : 0,
  });
  const orden: OrdenMantenimientoDTO = {
    id: '019a0026-0000-7000-8000-000000000012',
    puente_id: id,
    inspeccion_id: null,
    tipo: 'RUTINARIO',
    estado: 'PROPUESTA',
    descripcion: 'Rutina de prueba',
    elemento_ref: null,
    prioridad_sugerida: null,
    prioridad: 'MEDIA',
    justificacion_prioridad: null,
    fecha_programada: null,
    fecha_ejecucion: null,
    responsable: null,
    motivo: null,
    creado_en: '2026-10-23T12:00:00Z',
    actualizado_en: '2026-10-23T12:00:00Z',
  };

  async function entrar(rol: Rol) {
    const respuesta = firstValueFrom(auth.iniciarSesion('persona@prueba.com', 'SoloPrueba2026'));
    http.expectOne('/api/v1/auth/login').flush({
      access_token: 'token-solo-de-prueba',
      token_type: 'Bearer',
      expires_in: 900,
      usuario: { id: 'persona-prueba', nombre: 'Persona de prueba', rol },
    });
    await respuesta;
  }

  async function crear() {
    fixture = TestBed.createComponent(GestionMantenimiento);
    fixture.componentRef.setInput('id', id);
    await estabilizar(fixture);
  }

  async function cargar() {
    http.expectOne(`/api/v1/puentes/${id}`).flush(puente());
    await estabilizar(fixture);
    const historial = http.expectOne(`${base}?page=0&size=20`);
    expect(historial.request.headers.get('Authorization')).toBe('Bearer token-solo-de-prueba');
    expect(historial.request.withCredentials).toBe(true);
    historial.flush(pagina());
    http.expectOne(`${base}/rutinario-anual?page=0&size=20`).flush({
      puente_id: id,
      fecha_evaluacion: '2026-10-23',
      fecha_referencia: '2026-01-01',
      origen_referencia: 'EJECUCION_RUTINARIA',
      fecha_limite: '2027-01-01',
      programadas_en_plazo: 0,
      sin_fecha: 0,
      fechas_pasadas: 0,
      posteriores_al_limite: 0,
      ordenes: pagina(),
    });
    await estabilizar(fixture);
  }

  it.each<Rol>(['ADMINISTRADOR', 'CATEDRATICO'])(
    'conecta %s con el puente, historial, seguimiento y permisos acordados',
    async (rol) => {
      await entrar(rol);
      await crear();
      await cargar();
      expect(html().textContent).toContain(puente().nombre);
      expect(html().querySelector('a')?.getAttribute('href')).toBe(`/puentes/${id}`);
      const consulta = fixture.debugElement.query(By.directive(ConsultaOrdenes))
        .componentInstance as ConsultaOrdenes;
      expect(consulta.puenteId()).toBe(id);
      expect([
        consulta.puedeConsultar(),
        consulta.puedeIniciar(),
        consulta.puedeConsultarEvidencia(),
        consulta.puedeSubirEvidencia(),
        consulta.puedeCerrar(),
        consulta.puedeDescartar(),
        consulta.puedeCancelar(),
        consulta.puedeAjustarPrioridad(),
        consulta.puedeProgramar(),
        consulta.mostrarSeguimientoRutinario(),
      ]).toEqual(Array(10).fill(true));
    },
  );

  it.each<Rol | null>([null, 'ESTUDIANTE', 'PROFESIONAL_EXTERNO'])(
    'no monta vistas privadas ni solicita mantenimiento con rol %s',
    async (rol) => {
      if (rol) await entrar(rol);
      await crear();
      expect(html().textContent).toContain(t.sinAcceso);
      http.expectNone((r) => r.url.startsWith('/api/v1/puentes'));
      expect(html().querySelector('app-consulta-ordenes')).toBeNull();
    },
  );

  it('carga propuestas al cambiar de vista y relee el historial al regresar', async () => {
    await entrar('CATEDRATICO');
    await crear();
    await cargar();
    botones()[1].click();
    await estabilizar(fixture);
    expect(html().querySelector('app-consulta-ordenes')).toBeNull();
    http.expectOne(`${base}/propuestas?page=0&size=20`).flush(pagina());
    await estabilizar(fixture);
    botones()[0].click();
    await estabilizar(fixture);
    // Crea una consulta nueva: no conserva datos anteriores a la aceptación de propuestas.
    http.expectOne(`${base}?page=0&size=20`).flush(pagina());
    http.expectOne(`${base}/rutinario-anual?page=0&size=20`).flush({
      puente_id: id,
      fecha_evaluacion: '2026-10-23',
      fecha_referencia: '2026-01-01',
      origen_referencia: 'REGISTRO_PUENTE',
      fecha_limite: '2027-01-01',
      programadas_en_plazo: 0,
      sin_fecha: 0,
      fechas_pasadas: 0,
      posteriores_al_limite: 0,
      ordenes: pagina(),
    });
    await estabilizar(fixture);
    expect(html().querySelector('app-consulta-propuestas')).toBeNull();
  });

  it('retira las consultas al perder sesión y cancela las lecturas pendientes', async () => {
    await entrar('ADMINISTRADOR');
    await crear();
    http.expectOne(`/api/v1/puentes/${id}`).flush(puente());
    await estabilizar(fixture);
    const historial = http.expectOne(`${base}?page=0&size=20`);
    const anual = http.expectOne(`${base}/rutinario-anual?page=0&size=20`);
    auth.cerrarSesionLocal();
    await estabilizar(fixture);
    expect(historial.cancelled).toBe(true);
    expect(anual.cancelled).toBe(true);
    expect(html().textContent).toContain(t.sinAcceso);
    expect(html().textContent).not.toContain(puente().nombre);
  });

  it('no consulta órdenes de un puente ausente y permite reintentar la lectura', async () => {
    await entrar('ADMINISTRADOR');
    await crear();
    http.expectOne(`/api/v1/puentes/${id}`).flush({}, { status: 404, statusText: 'Not Found' });
    await estabilizar(fixture);
    expect(html().textContent).toContain(t.noPuente);
    http.expectNone((r) => r.url.includes('ordenes-mantenimiento'));
    html().querySelector<HTMLButtonElement>('button')!.click();
    await estabilizar(fixture);
    await cargar();
  });

  it('bloquea cambio de vista y salida durante una aceptación real pendiente', async () => {
    await entrar('ADMINISTRADOR');
    await crear();
    await cargar();
    botones()[1].click();
    await estabilizar(fixture);
    http.expectOne(`${base}/propuestas?page=0&size=20`).flush(pagina([orden]));
    await estabilizar(fixture);
    const revisar = Array.from(html().querySelectorAll('app-bandeja-propuestas button')).find((b) =>
      b.textContent?.includes(TEXTOS.mantenimiento.bandeja.revisar),
    ) as HTMLButtonElement;
    revisar.click();
    await estabilizar(fixture);
    html().querySelector<HTMLButtonElement>('app-aceptacion-propuesta button')!.click();
    await estabilizar(fixture);
    const post = http.expectOne(`${base}/${orden.id}/aceptacion`);
    expect(post.request.method).toBe('POST');
    expect(fixture.componentInstance.operacionPendiente()).toBe(true);
    expect(botones().every((b) => b.disabled)).toBe(true);
    const guardia = RUTAS_PUENTES.find((r) => r.path === ':id/mantenimiento')!.canDeactivate![0];
    expect((guardia as (c: GestionMantenimiento) => boolean)(fixture.componentInstance)).toBe(
      false,
    );
    post.flush({ ...orden, estado: 'PROGRAMADA' });
    await estabilizar(fixture);
    http.expectOne(`${base}/propuestas?page=0&size=20`).flush(pagina());
    await estabilizar(fixture);
    expect(fixture.componentInstance.operacionPendiente()).toBe(false);
    expect(botones().every((b) => !b.disabled)).toBe(true);
  });

  it.each<Rol | null>([null, 'ESTUDIANTE', 'PROFESIONAL_EXTERNO', 'CATEDRATICO', 'ADMINISTRADOR'])(
    'la guardia real de la ruta aplica los roles acordados: %s',
    async (rol) => {
      if (rol) await entrar(rol);
      else auth.listo.set(true);
      const ruta = RUTAS_PUENTES.find((r) => r.path === ':id/mantenimiento')!;
      const resultado = await TestBed.runInInjectionContext(() =>
        (ruta.canActivate![0] as CanActivateFn)(null!, null!),
      );
      if (rol === 'CATEDRATICO' || rol === 'ADMINISTRADOR') expect(resultado).toBe(true);
      else {
        expect(resultado).toBeInstanceOf(UrlTree);
        expect(TestBed.inject(Router).serializeUrl(resultado as UrlTree)).toBe(
          rol ? '/puentes' : '/login',
        );
      }
    },
  );
});
