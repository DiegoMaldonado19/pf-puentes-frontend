import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TEXTOS } from '../../shared/textos';
import { estabilizar, problema, proveedoresAuth, rutaConToken } from './datos-prueba';
import { VerificarCorreo } from './verificar-correo';

describe('VerificarCorreo', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('sin token muestra el error de enlace y no llama al API', async () => {
    TestBed.configureTestingModule({
      imports: [VerificarCorreo],
      providers: proveedoresAuth(rutaConToken()),
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(VerificarCorreo);
    await estabilizar(fixture);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      TEXTOS.auth.verificar.faltaToken,
    );
    http.expectNone('/api/v1/auth/verificar-correo');
  });

  it('con token verifica al entrar', async () => {
    TestBed.configureTestingModule({
      imports: [VerificarCorreo],
      providers: proveedoresAuth(rutaConToken('tok-correo')),
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(VerificarCorreo);
    http
      .expectOne('/api/v1/auth/verificar-correo')
      .flush(null, { status: 204, statusText: 'No Content' });
    await estabilizar(fixture);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      TEXTOS.auth.verificar.hecho,
    );
  });

  it('un token inválido deja el CTA de reenviar', async () => {
    TestBed.configureTestingModule({
      imports: [VerificarCorreo],
      providers: proveedoresAuth(rutaConToken('malo')),
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(VerificarCorreo);
    http.expectOne('/api/v1/auth/verificar-correo').flush(problema('token-invalido'), {
      status: 422,
      statusText: 'Unprocessable Entity',
    });
    await estabilizar(fixture);
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('[role="alert"]')?.textContent).toContain(
      TEXTOS.auth.errores['token-invalido'],
    );
    expect(html.textContent).toContain(TEXTOS.auth.verificar.reenviar);
  });
});
