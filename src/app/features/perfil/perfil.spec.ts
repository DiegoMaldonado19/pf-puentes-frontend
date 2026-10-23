import { HttpHeaders } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth';
import { TEXTOS } from '../../shared/textos';
import {
  estabilizar,
  escribir,
  perfilDto,
  problema,
  proveedoresAuth,
  sesion,
} from '../auth/datos-prueba';
import { Perfil } from './perfil';

describe('Perfil', () => {
  let http: HttpTestingController;
  let auth: AuthService;
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [Perfil],
      providers: proveedoresAuth(),
    });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    const login = firstValueFrom(auth.iniciarSesion('ana@correo.com', 'Puentes2026ok'));
    http.expectOne('/api/v1/auth/login').flush(sesion());
    await login;
  });

  afterEach(() => {
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  async function abrir() {
    const fixture = TestBed.createComponent(Perfil);
    http.expectOne('/api/v1/usuarios/me').flush(perfilDto());
    await estabilizar(fixture);
    return { fixture, html: fixture.nativeElement as HTMLElement };
  }

  it('muestra id, nombre, correo, rol y estado, sin hash', async () => {
    const { html } = await abrir();
    expect(html.textContent).toContain('u1');
    expect(html.textContent).toContain('Ana Pérez');
    expect(html.textContent).toContain('ana@correo.com');
    expect(html.textContent).toContain('Estudiante');
    expect(html.textContent).toContain('Activo');
    expect(html.textContent).not.toMatch(/\$2[aby]|hash|access_token/i);
  });

  it('un 204 limpia el JWT y va a /login con el aviso de volver a entrar', async () => {
    const navegar = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const { fixture, html } = await abrir();
    escribir(html, 'contrasena_actual', 'Puentes2026ok');
    escribir(html, 'contrasena_nueva', 'Puentes2027ok');
    escribir(html, 'confirmar', 'Puentes2027ok');
    await estabilizar(fixture);
    html.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    await estabilizar(fixture);
    const put = http.expectOne('/api/v1/usuarios/me/contrasena');
    expect(put.request.url).toBe('/api/v1/usuarios/me/contrasena');
    put.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();
    await estabilizar(fixture);
    expect(auth.accessToken()).toBeNull();
    expect(auth.autenticado()).toBe(false);
    expect(navegar).toHaveBeenCalledWith('/login', { state: { aviso: TEXTOS.auth.perfil.hecho } });
  });

  it('marca la contraseña actual si el backend dice que es incorrecta', async () => {
    const { fixture, html } = await abrir();
    escribir(html, 'contrasena_actual', 'Puentes2026ok');
    escribir(html, 'contrasena_nueva', 'Puentes2027ok');
    escribir(html, 'confirmar', 'Puentes2027ok');
    await estabilizar(fixture);
    html.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    await estabilizar(fixture);
    http
      .expectOne('/api/v1/usuarios/me/contrasena')
      .flush(problema('contrasena-actual-incorrecta'), {
        status: 422,
        statusText: 'Unprocessable Entity',
      });
    await estabilizar(fixture);
    expect(html.textContent).toContain(TEXTOS.auth.errores['contrasena-actual-incorrecta']);
    expect(html.querySelector('#error-actual')?.textContent).toContain(
      TEXTOS.auth.errores['contrasena-actual-incorrecta'],
    );
    expect(auth.accessToken()).toBe('tok-1');
  });

  it('un 429 muestra espera y no cambia la sesión', async () => {
    const { fixture, html } = await abrir();
    escribir(html, 'contrasena_actual', 'Puentes2026ok');
    escribir(html, 'contrasena_nueva', 'Puentes2027ok');
    escribir(html, 'confirmar', 'Puentes2027ok');
    await estabilizar(fixture);
    html.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    await estabilizar(fixture);
    http.expectOne('/api/v1/usuarios/me/contrasena').flush(problema('demasiadas-solicitudes'), {
      status: 429,
      statusText: 'Too Many Requests',
      headers: new HttpHeaders({ 'Retry-After': '12' }),
    });
    await estabilizar(fixture);
    expect(html.querySelector('[role="alert"]')?.textContent).toContain(
      TEXTOS.auth.errores['demasiadas-solicitudes'],
    );
    expect(auth.accessToken()).toBe('tok-1');
  });
});
