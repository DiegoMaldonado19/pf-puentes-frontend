import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CanActivateFn, CanDeactivateFn, provideRouter, Router, UrlTree } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { routes } from '../../../app.routes';
import { AuthService } from '../../../core/auth/auth';
import { authInterceptor } from '../../../core/auth/auth.interceptor';
import { Rol } from '../../../core/auth/modelos';
import { TEXTOS } from '../../../shared/textos';
import { estabilizar } from '../../puentes/datos-prueba';
import { RUTAS_ADMIN } from '../admin.routes';
import { AccesoPesos } from './acceso-pesos';

describe('Acceso administrativo a pesos con sesión P2', () => {
  const catalogo = '/api/v1/juegos-pesos/formularios?page=0&size=20';
  const formulario = { id: '019a0019-0000-7000-8000-000000000001', codigo: 'VERSION-A' };
  const otro = { id: '019a0019-0000-7000-8000-000000000002', codigo: 'VERSION-B' };
  const juego = {
    id: '019a0019-0000-7000-8000-000000000011',
    formulario_version_id: formulario.id,
    acta: 'acta-prueba.pdf',
    vigente_desde: '2026-10-19T12:00:00Z',
  };
  const t = TEXTOS.pesos;
  let fixture: ComponentFixture<AccesoPesos>;
  let http: HttpTestingController;
  let auth: AuthService;
  const html = () => fixture.nativeElement as HTMLElement;
  const pagina = <T>(content: T[], page = 0, total = content.length) => ({
    content,
    page,
    size: 20,
    total_elements: total,
    total_pages: Math.ceil(total / 20),
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AccesoPesos],
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

  async function entrar(rol: Rol = 'ADMINISTRADOR') {
    const respuesta = firstValueFrom(auth.iniciarSesion('admin@prueba.com', 'SoloPrueba2026'));
    http.expectOne('/api/v1/auth/login').flush({
      access_token: 'token-prueba',
      token_type: 'Bearer',
      expires_in: 900,
      usuario: { id: 'prueba', nombre: 'Administrador de prueba', rol },
    });
    await respuesta;
  }
  async function crear() {
    fixture = TestBed.createComponent(AccesoPesos);
    await estabilizar(fixture);
  }
  function boton(texto: string): HTMLButtonElement {
    const elegido = Array.from(html().querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === texto,
    );
    expect(elegido).toBeDefined();
    return elegido as HTMLButtonElement;
  }
  async function seleccionar() {
    html().querySelector<HTMLButtonElement>('tbody button')!.click();
    await estabilizar(fixture);
  }

  it('recorre versión, juego y pesos con Bearer usando las consultas existentes', async () => {
    await entrar();
    await crear();
    const consulta = http.expectOne(catalogo);
    expect(consulta.request.headers.get('Authorization')).toBe('Bearer token-prueba');
    expect(consulta.request.withCredentials).toBe(true);
    consulta.flush(pagina([formulario]));
    await estabilizar(fixture);
    expect(html().textContent).toContain(formulario.codigo);
    http.expectNone((r) => r.url.includes('/formularios/'));
    await seleccionar();
    http
      .expectOne(`/api/v1/formularios/${formulario.id}/juegos-pesos?page=0&size=20`)
      .flush(pagina([juego]));
    await estabilizar(fixture);
    boton(t.ver).click();
    await estabilizar(fixture);
    http
      .expectOne(`/api/v1/juegos-pesos/${juego.id}/pesos?page=0&size=20`)
      .flush(pagina([{ id: 'peso-prueba', elemento_ref: 'elemento-a', peso: 2.5 }]));
    await estabilizar(fixture);
    expect(html().textContent).toContain('elemento-a');
    expect(html().textContent).toContain(juego.acta);
  });

  it('abre los campos reales de versiones sin pesos y cancela al ocultarlos', async () => {
    await entrar();
    await crear();
    http.expectOne(catalogo).flush(pagina([]));
    await estabilizar(fixture);
    boton(t.campos.abrir).click();
    await estabilizar(fixture);
    const peticion = http.expectOne('/api/v1/formularios?page=0&size=20');
    expect(peticion.request.headers.get('Authorization')).toBe('Bearer token-prueba');
    boton(t.campos.cerrar).click();
    await estabilizar(fixture);
    expect(peticion.cancelled).toBe(true);
    expect(html().querySelector('app-campos-dano-pesos')).toBeNull();
  });

  it('crea desde el formulario real, bloquea salida y contexto mientras guarda y actualiza ambos catálogos', async () => {
    await entrar();
    await crear();
    http.expectOne(catalogo).flush(pagina([]));
    await estabilizar(fixture);
    boton(t.campos.abrir).click();
    await estabilizar(fixture);
    http.expectOne('/api/v1/formularios?page=0&size=20').flush({
      contenido: [{ ...formulario, estado: 'ACTIVA' }],
      pagina: 0,
      tamano: 20,
      total_elementos: 1,
      total_paginas: 1,
    });
    await estabilizar(fixture);
    const selector = html().querySelector('select')!;
    selector.value = formulario.id;
    selector.dispatchEvent(new Event('change'));
    await estabilizar(fixture);
    http
      .expectOne(`/api/v1/formularios/${formulario.id}/elementos-dano?page=0&size=20`)
      .flush(pagina(['elemento.a', 'elemento.b']));
    await estabilizar(fixture);
    boton(t.creacion.abrir).click();
    await estabilizar(fixture);
    http
      .expectOne(`/api/v1/formularios/${formulario.id}/elementos-dano?page=0&size=100`)
      .flush({ ...pagina(['elemento.a', 'elemento.b']), size: 100 });
    await estabilizar(fixture);
    for (const input of html().querySelectorAll<HTMLInputElement>('input[type=number]')) {
      input.value = '2';
      input.dispatchEvent(new Event('input'));
    }
    html()
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await estabilizar(fixture);
    const envio = http.expectOne(`/api/v1/formularios/${formulario.id}/juegos-pesos`);
    expect(envio.request.method).toBe('POST');
    expect(envio.request.headers.get('Authorization')).toBe('Bearer token-prueba');
    expect(fixture.componentInstance.operacionPendiente()).toBe(true);
    expect(boton(t.campos.cerrar).disabled).toBe(true);
    expect(selector.disabled).toBe(true);
    const guardia = RUTAS_ADMIN.find((r) => r.path === 'pesos')!
      .canDeactivate![0] as CanDeactivateFn<AccesoPesos>;
    expect(guardia(fixture.componentInstance, null!, null!, null!)).toBe(false);
    envio.flush({ ...juego, acta: null });
    await estabilizar(fixture);
    http.expectOne(catalogo).flush(pagina([formulario]));
    http
      .expectOne(`/api/v1/formularios/${formulario.id}/juegos-pesos?page=0&size=20`)
      .flush(pagina([{ ...juego, acta: null }]));
    await estabilizar(fixture);
    expect(fixture.componentInstance.operacionPendiente()).toBe(false);
    expect(guardia(fixture.componentInstance, null!, null!, null!)).toBe(true);
    expect(html().textContent).toContain(t.creacion.creado);
    expect(html().textContent).toContain(formulario.codigo);
    expect(html().querySelector('app-creacion-pesos')).toBeNull();
  });

  it('presenta vacío real sin pedir ni crear configuraciones', async () => {
    await entrar();
    await crear();
    http.expectOne(catalogo).flush(pagina([]));
    await estabilizar(fixture);
    expect(html().textContent).toContain(t.acceso.vacia);
    expect(html().querySelector('app-consulta-pesos')).toBeNull();
    http.expectNone((r) => r.method !== 'GET');
  });

  it('pagina versiones y cancela una consulta antigua al cambiar de página', async () => {
    await entrar();
    await crear();
    http.expectOne(catalogo).flush(pagina([formulario], 0, 21));
    await estabilizar(fixture);
    await seleccionar();
    const juegos = http.expectOne(
      `/api/v1/formularios/${formulario.id}/juegos-pesos?page=0&size=20`,
    );
    boton(t.siguiente).click();
    await estabilizar(fixture);
    expect(juegos.cancelled).toBe(true);
    expect(html().querySelector('app-consulta-pesos')).toBeNull();
    http.expectOne(catalogo.replace('page=0', 'page=1')).flush(pagina([otro], 1, 21));
    await estabilizar(fixture);
    expect(html().textContent).toContain(otro.codigo);
    expect(html().textContent).not.toContain(formulario.codigo);
  });

  it('cambia de versión dentro de la página y cancela los juegos anteriores', async () => {
    await entrar();
    await crear();
    http.expectOne(catalogo).flush(pagina([formulario, otro]));
    await estabilizar(fixture);
    await seleccionar();
    const juegos = http.expectOne(
      `/api/v1/formularios/${formulario.id}/juegos-pesos?page=0&size=20`,
    );
    html().querySelectorAll<HTMLButtonElement>('tbody button')[1].click();
    await estabilizar(fixture);
    expect(juegos.cancelled).toBe(true);
    http.expectOne(`/api/v1/formularios/${otro.id}/juegos-pesos?page=0&size=20`).flush(pagina([]));
    await estabilizar(fixture);
    expect(html().textContent).toContain(t.sinJuegos);
  });

  it('permite reintentar una lectura fallida sin repetir escrituras', async () => {
    await entrar();
    await crear();
    http.expectOne(catalogo).flush({}, { status: 503, statusText: 'Unavailable' });
    await estabilizar(fixture);
    expect(html().textContent).toContain(t.error);
    boton(t.reintentar).click();
    await estabilizar(fixture);
    http.expectOne(catalogo).flush(pagina([]));
    await estabilizar(fixture);
    expect(html().textContent).toContain(t.acceso.vacia);
  });

  it('retira datos y cancela lecturas al perder sesión', async () => {
    await entrar();
    await crear();
    http.expectOne(catalogo).flush(pagina([formulario]));
    await estabilizar(fixture);
    await seleccionar();
    const juegos = http.expectOne(
      `/api/v1/formularios/${formulario.id}/juegos-pesos?page=0&size=20`,
    );
    auth.cerrarSesionLocal();
    await estabilizar(fixture);
    expect(juegos.cancelled).toBe(true);
    expect(html().textContent).not.toContain(formulario.codigo);
    expect(html().textContent).toContain(t.sinPermiso);
  });

  it('retira catálogo y detalle cuando el servidor deniega el acceso al recargar', async () => {
    await entrar();
    await crear();
    http.expectOne(catalogo).flush(pagina([formulario]));
    await estabilizar(fixture);
    boton(t.acceso.actualizar).click();
    await estabilizar(fixture);
    http.expectOne(catalogo).flush({}, { status: 403, statusText: 'Forbidden' });
    await estabilizar(fixture);
    expect(html().textContent).toContain(t.sinPermiso);
    expect(html().textContent).not.toContain(formulario.codigo);
    expect(html().querySelector('app-consulta-pesos')).toBeNull();
  });

  it.each<Rol | null>([null, 'ESTUDIANTE', 'PROFESIONAL_EXTERNO', 'CATEDRATICO'])(
    'no solicita datos privados para el rol %s',
    async (rol) => {
      if (rol) await entrar(rol);
      await crear();
      expect(html().textContent).toContain(t.sinPermiso);
      http.expectNone(catalogo);
    },
  );

  it.each<Rol | null>([null, 'ESTUDIANTE', 'PROFESIONAL_EXTERNO', 'CATEDRATICO', 'ADMINISTRADOR'])(
    'la ruta administrativa aplica la guardia P2 al rol %s',
    async (rol) => {
      if (rol) await entrar(rol);
      else auth.listo.set(true);
      expect(RUTAS_ADMIN.find((r) => r.path === 'pesos')?.loadComponent).toBeDefined();
      const padre = routes.find((r) => r.path === 'admin')!;
      const resultado = await TestBed.runInInjectionContext(() =>
        (padre.canActivate![0] as CanActivateFn)(null!, null!),
      );
      if (rol === 'ADMINISTRADOR') expect(resultado).toBe(true);
      else
        expect(TestBed.inject(Router).serializeUrl(resultado as UrlTree)).toBe(
          rol ? '/puentes' : '/login',
        );
    },
  );
});
