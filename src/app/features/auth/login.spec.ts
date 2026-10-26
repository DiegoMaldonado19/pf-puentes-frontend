import { HttpHeaders } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import { TEXTOS } from '../../shared/textos';
import { estabilizar, escribir, problema, proveedoresAuth, sesion } from './datos-prueba';
import { Login } from './login';

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let html: HTMLElement;
  let http: HttpTestingController;
  let router: Router;
  let auth: AuthService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [Login],
      providers: proveedoresAuth(),
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    auth = TestBed.inject(AuthService);
    fixture = TestBed.createComponent(Login);
    html = fixture.nativeElement as HTMLElement;
    await estabilizar(fixture);
  });

  afterEach(() => {
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  async function enviar(correo = 'ana@correo.com', contrasena = 'Puentes2026ok'): Promise<void> {
    escribir(html, 'correo', correo);
    escribir(html, 'contrasena', contrasena);
    await estabilizar(fixture);
    html.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    await estabilizar(fixture);
  }

  it('guarda el token en memoria, no toca localStorage y manda al inventario', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const navegar = vi.spyOn(router, 'navigateByUrl');
    await enviar();
    http.expectOne('/api/v1/auth/login').flush(sesion());
    await fixture.whenStable();
    await estabilizar(fixture);
    expect(auth.accessToken()).toBe('tok-1');
    expect(auth.autenticado()).toBe(true);
    expect(setItem).not.toHaveBeenCalled();
    expect(navegar).toHaveBeenCalledWith('/puentes');
  });

  it('manda al administrador a /admin/usuarios', async () => {
    const navegar = vi.spyOn(router, 'navigateByUrl');
    await enviar();
    http.expectOne('/api/v1/auth/login').flush(sesion('ADMINISTRADOR'));
    await fixture.whenStable();
    await estabilizar(fixture);
    expect(navegar).toHaveBeenCalledWith('/admin/usuarios');
  });

  it('muestra un solo mensaje si las credenciales no son correctas', async () => {
    await enviar();
    http.expectOne('/api/v1/auth/login').flush(problema('credenciales-invalidas'), {
      status: 401,
      statusText: 'Unauthorized',
    });
    await estabilizar(fixture);
    expect(html.querySelector('[role="alert"]')?.textContent).toContain(
      TEXTOS.auth.errores['credenciales-invalidas'],
    );
    expect(auth.autenticado()).toBe(false);
  });

  it('un 429 muestra espera y no credenciales inválidas', async () => {
    await enviar();
    http.expectOne('/api/v1/auth/login').flush(problema('demasiadas-solicitudes'), {
      status: 429,
      statusText: 'Too Many Requests',
      headers: new HttpHeaders({ 'Retry-After': '12' }),
    });
    await estabilizar(fixture);
    const alerta = html.querySelector('[role="alert"]')?.textContent ?? '';
    expect(alerta).toContain(TEXTOS.auth.errores['demasiadas-solicitudes']);
    expect(alerta).not.toContain(TEXTOS.auth.errores['credenciales-invalidas']);
  });

  it('muestra el detalle si la cuenta está bloqueada', async () => {
    await enviar();
    http
      .expectOne('/api/v1/auth/login')
      .flush(problema('cuenta-bloqueada', { detail: 'Inténtalo en 14 minutos.' }), {
        status: 403,
        statusText: 'Forbidden',
      });
    await estabilizar(fixture);
    expect(html.querySelector('[role="alert"]')?.textContent).toContain('Inténtalo en 14 minutos.');
  });

  it('muestra el mensaje de cuenta pendiente', async () => {
    await enviar();
    http.expectOne('/api/v1/auth/login').flush(problema('cuenta-pendiente'), {
      status: 403,
      statusText: 'Forbidden',
    });
    await estabilizar(fixture);
    expect(html.querySelector('[role="alert"]')?.textContent).toContain(
      TEXTOS.auth.errores['cuenta-pendiente'],
    );
  });
});
