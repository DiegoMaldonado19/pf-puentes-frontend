import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth';
import { TEXTOS } from '../../shared/textos';
import { estabilizar, escribir, proveedoresAuth, rutaConToken, sesion } from './datos-prueba';
import { RestablecerContrasena } from './restablecer-contrasena';

describe('RestablecerContrasena', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('sin token muestra el error de enlace', async () => {
    TestBed.configureTestingModule({
      imports: [RestablecerContrasena],
      providers: proveedoresAuth(rutaConToken()),
    });
    const fixture = TestBed.createComponent(RestablecerContrasena);
    await estabilizar(fixture);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      TEXTOS.auth.restablecer.faltaToken,
    );
  });

  it('un 204 limpia la sesión en memoria y ofrece volver a entrar', async () => {
    TestBed.configureTestingModule({
      imports: [RestablecerContrasena],
      providers: proveedoresAuth(rutaConToken('tok-reset')),
    });
    const http = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthService);
    const login = firstValueFrom(auth.iniciarSesion('ana@correo.com', 'Puentes2026ok'));
    http.expectOne('/api/v1/auth/login').flush(sesion());
    await login;
    expect(auth.accessToken()).toBe('tok-1');

    const fixture = TestBed.createComponent(RestablecerContrasena);
    const html = fixture.nativeElement as HTMLElement;
    await estabilizar(fixture);
    escribir(html, 'contrasena', 'Puentes2027ok');
    escribir(html, 'confirmar', 'Puentes2027ok');
    await estabilizar(fixture);
    html.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    await estabilizar(fixture);
    http
      .expectOne('/api/v1/auth/restablecer-contrasena')
      .flush(null, { status: 204, statusText: 'No Content' });
    await estabilizar(fixture);
    expect(auth.accessToken()).toBeNull();
    expect(html.textContent).toContain(TEXTOS.auth.restablecer.hecho);
  });
});
