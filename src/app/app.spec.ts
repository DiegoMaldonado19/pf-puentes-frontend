import 'fake-indexeddb/auto';
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { v7 } from 'uuid';
import { AccesoLocal } from './offline/acceso-local';
import { BaseLocal } from './offline/base-local';
import { PersistenciaOffline } from './offline/persistencia';
import { App } from './app';
import { AuthService } from './core/auth/auth';
import { Rol, UsuarioSesionDTO } from './core/auth/modelos';
import { NotificacionesService } from './core/notificaciones/notificaciones.service';

class AuthFalso {
  readonly usuario = signal<UsuarioSesionDTO | null>(null);
  readonly listo = signal(true);
  readonly rol = computed(() => this.usuario()?.rol ?? null);
  readonly autenticado = computed(() => this.usuario() !== null);
  readonly cerrarSesion = vi.fn(() => of(undefined));

  entrar(rol: Rol, nombre = 'Ana Pérez'): void {
    this.usuario.set({ id: 'u1', nombre, rol });
  }
}

describe('App', () => {
  let auth: AuthFalso;
  let db: BaseLocal;
  let propietario: string;
  const notificaciones = {
    generacion: signal(0),
    sesionActiva: signal(false),
    noLeidas: signal(0),
    establecerUsuario: vi.fn(),
  };

  beforeEach(async () => {
    auth = new AuthFalso();
    notificaciones.establecerUsuario.mockClear();
    propietario = v7();
    db = new BaseLocal(`app-${v7()}`);
    const acceso = {
      propietarioActual: async () => propietario,
      consultarPropias: async <T>(id: string, leer: () => Promise<T>) =>
        id === propietario ? leer() : undefined,
      alInvalidar: () => () => undefined,
    };
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: BaseLocal, useValue: db },
        { provide: AccesoLocal, useValue: acceso },
        { provide: NotificacionesService, useValue: notificaciones },
      ],
    }).compileComponents();
  });

  afterEach(async () => {
    TestBed.resetTestingModule();
    await db.delete();
  });

  function hrefs(html: HTMLElement): (string | null)[] {
    return [...html.querySelectorAll('nav a')].map((a) => a.getAttribute('href'));
  }

  it('sincroniza las notificaciones al iniciar y terminar la sesion', async () => {
    auth.entrar('ESTUDIANTE');
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    expect(notificaciones.establecerUsuario).toHaveBeenLastCalledWith('u1');
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('app-campana-notificaciones')).not.toBeNull();
    expect(html.querySelectorAll('router-outlet')).toHaveLength(1);

    auth.usuario.set(null);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(notificaciones.establecerUsuario).toHaveBeenLastCalledWith(null);
  });

  it('ofrece un enlace para saltar al contenido y la navegación al inventario y al mapa', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const html = fixture.nativeElement as HTMLElement;

    expect(html.querySelector('a[href="#contenido"]')?.textContent).toContain('Saltar');
    expect(hrefs(html)).toEqual([
      '/',
      '/puentes',
      '/puentes/mapa',
      '/offline/local',
      '/foro',
      '/login',
      '/registro',
    ]);
    expect(html.querySelector('main#contenido router-outlet')).not.toBeNull();
    expect(html.querySelector('app-campana-notificaciones')).toBeNull();
  });

  it('actualiza en navegación los conteos distintos del propietario habilitado', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    await vi.waitFor(() =>
      expect(fixture.nativeElement.querySelector('nav [role="status"]')?.textContent).toContain(
        'Inspecciones pendientes: 0 · Archivos pendientes: 0',
      ),
    );

    const local = new PersistenciaOffline(db);
    const captura = await local.crear(propietario, v7(), v7());
    await local.editar(propietario, captura.id, { actualizada: true });
    const foto = {
      archivo: new Blob(['foto'], { type: 'image/webp' }),
      miniatura: new Blob(['mini'], { type: 'image/webp' }),
      latitud: null,
      longitud: null,
      capturada_en: '2026-10-05T00:00:00Z',
    };
    await local.foto(propietario, captura.id, foto, 'elemento');
    await local.foto(propietario, captura.id, foto, 'elemento');
    await local.crear(v7(), v7(), v7());

    await vi.waitFor(() =>
      expect(fixture.nativeElement.querySelector('nav [role="status"]')?.textContent).toContain(
        'Inspecciones pendientes: 1 · Archivos pendientes: 2',
      ),
    );
    expect(await local.operaciones(propietario)).toHaveLength(4);
  });

  it('no muestra entrar ni sesión hasta hidratar', async () => {
    auth.listo.set(false);
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const html = fixture.nativeElement as HTMLElement;

    expect(hrefs(html)).toEqual(['/', '/puentes', '/puentes/mapa', '/offline/local', '/foro']);
    expect(html.textContent).not.toContain('Entrar');
  });

  it('muestra nombre, rol, perfil y salir cuando hay sesión', async () => {
    auth.entrar('ESTUDIANTE');
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const html = fixture.nativeElement as HTMLElement;

    expect(html.textContent).toContain('Ana Pérez');
    expect(html.textContent).toContain('Estudiante');
    expect(hrefs(html)).toEqual([
      '/',
      '/puentes',
      '/puentes/mapa',
      '/offline/local',
      '/foro',
      '/mis-asignaciones',
      '/perfil',
    ]);
    expect(html.querySelector('button')?.textContent).toContain('Cerrar sesión');
  });

  it('ofrece cursos y revisión académica al catedrático', async () => {
    auth.entrar('CATEDRATICO');
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(hrefs(fixture.nativeElement)).toContain('/revisiones');
    expect(hrefs(fixture.nativeElement)).toContain('/cursos');
  });

  it('muestra administración solo al administrador', async () => {
    auth.entrar('ADMINISTRADOR');
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const html = fixture.nativeElement as HTMLElement;

    expect(html.textContent).toContain('Administrador');
    expect(hrefs(html)).toEqual([
      '/',
      '/puentes',
      '/puentes/mapa',
      '/offline/local',
      '/foro',
      '/perfil',
      '/admin/pesos',
      '/admin/usuarios',
      '/admin/invitaciones',
      '/admin/auditoria',
      '/admin/formularios',
    ]);
  });

  it('cierra la sesión al pulsar el botón', async () => {
    auth.entrar('ESTUDIANTE');
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const html = fixture.nativeElement as HTMLElement;

    html.querySelector('button')?.click();
    expect(auth.cerrarSesion).toHaveBeenCalled();
  });
});
