import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TEXTOS } from '../../shared/textos';
import { estabilizar, escribir, proveedoresAuth } from './datos-prueba';
import { RecuperarContrasena } from './recuperar-contrasena';

describe('RecuperarContrasena', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('tras 202 muestra el texto fijo y no revela si el correo existe', async () => {
    TestBed.configureTestingModule({
      imports: [RecuperarContrasena],
      providers: proveedoresAuth(),
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(RecuperarContrasena);
    const html = fixture.nativeElement as HTMLElement;
    await estabilizar(fixture);
    escribir(html, 'correo', 'ana@correo.com');
    await estabilizar(fixture);
    html.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    await estabilizar(fixture);
    http
      .expectOne('/api/v1/auth/recuperar-contrasena')
      .flush(null, { status: 202, statusText: 'Accepted' });
    await estabilizar(fixture);
    expect(html.textContent).toContain(TEXTOS.auth.recuperar.hecho);
  });
});
