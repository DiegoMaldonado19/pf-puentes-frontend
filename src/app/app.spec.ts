import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { App } from './app';
import { AuthService } from './core/auth/auth';
import { Rol, UsuarioSesionDTO } from './core/auth/modelos';

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

  beforeEach(async () => {
    auth = new AuthFalso();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function hrefs(html: HTMLElement): (string | null)[] {
    return [...html.querySelectorAll('nav a')].map((a) => a.getAttribute('href'));
  }

  it('ofrece un enlace para saltar al contenido y la navegación al inventario y al mapa', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const html = fixture.nativeElement as HTMLElement;

    expect(html.querySelector('a[href="#contenido"]')?.textContent).toContain('Saltar');
    expect(hrefs(html)).toEqual(['/', '/puentes', '/puentes/mapa', '/login', '/registro']);
    expect(html.querySelector('main#contenido router-outlet')).not.toBeNull();
  });

  it('no muestra entrar ni sesión hasta hidratar', async () => {
    auth.listo.set(false);
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const html = fixture.nativeElement as HTMLElement;

    expect(hrefs(html)).toEqual(['/', '/puentes', '/puentes/mapa']);
    expect(html.textContent).not.toContain('Entrar');
  });

  it('muestra nombre, rol, perfil y salir cuando hay sesión', async () => {
    auth.entrar('ESTUDIANTE');
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const html = fixture.nativeElement as HTMLElement;

    expect(html.textContent).toContain('Ana Pérez');
    expect(html.textContent).toContain('Estudiante');
    expect(hrefs(html)).toEqual(['/', '/puentes', '/puentes/mapa', '/perfil']);
    expect(html.querySelector('button')?.textContent).toContain('Cerrar sesión');
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
      '/perfil',
      '/admin/usuarios',
      '/admin/invitaciones',
      '/admin/auditoria',
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
